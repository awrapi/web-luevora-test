/**
 * ================================================================
 * AI Credit Limit Service (Per-Tenant)
 * ================================================================
 * Manages credit consumption tracking per tenant.
 * - $0.00056 = 1 credit (configurable via DB)
 * - Default limit: 50,000 credits per tenant
 * - Pulls usage data from EdenAI cost monitoring API
 * ================================================================
 */

import prisma from '../../config/database.js';
import { PLAN_CREDITS } from '../shared/subscription.service.js';

const DEFAULT_RATE = parseFloat(process.env.AI_CREDIT_RATE_DOLLAR || '0.00056');
const DEFAULT_LIMIT = parseInt(process.env.AI_CREDIT_LIMIT || '50000', 10);

/**
 * Ensure tenant has a credit record; auto-create if missing.
 * @param {number} tenantId
 * @returns {Promise<Object>} TenantAiCredit record
 */
export const ensureTenantCredit = async (tenantId) => {
  let credit = await prisma.tenantAiCredit.findUnique({
    where: { tenant_id: tenantId }
  });

  if (!credit) {
    // Baca subscription_plan tenant untuk menentukan limit kredit awal
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscription_plan: true }
    });
    const plan = tenant?.subscription_plan || 'free';
    const initialLimit = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;

    credit = await prisma.tenantAiCredit.create({
      data: {
        tenant_id: tenantId,
        credits_used: 0,
        credit_limit: initialLimit,
        rate_dollar_per_credit: DEFAULT_RATE,
        is_active: 1,
      }
    });
    console.log(`[CreditService] Auto-created credit record for tenant ${tenantId} (plan: ${plan}, limit: ${initialLimit})`);
  }

  return credit;
};

/**
 * Check if a tenant can make an AI call.
 * 
 * Rules:
 * - If credits are ALREADY negative (overdrawn from last call) → BLOCK
 * - If credits are still positive (even 0.01 remaining) → ALLOW
 *   (the response may push it negative, that's fine — it becomes the "last call")
 * 
 * @param {number} tenantId
 * @returns {Promise<Object>} { credits_used, credit_limit, credits_remaining, is_active, is_last_chance }
 */
export const checkCredit = async (tenantId) => {
  const credit = await ensureTenantCredit(tenantId);

  const creditsRemaining = credit.credit_limit - credit.credits_used;

  if (credit.is_active === 0) {
    const err = new Error('AI_CREDIT_DISABLED');
    err.code = 'AI_CREDIT_DISABLED';
    throw err;
  }

  // Already overdrawn from a previous call → block
  if (creditsRemaining < 0) {
    const err = new Error('AI_CREDIT_EXCEEDED');
    err.code = 'AI_CREDIT_EXCEEDED';
    err.creditsUsed = credit.credits_used;
    err.creditLimit = credit.credit_limit;
    err.overdraft = Math.abs(creditsRemaining); // how much in the minus
    throw err;
  }

  // Flag if remaining is very low — this call will likely be the last one
  // (credits may go negative after this response, which is allowed)
  const isLastChance = creditsRemaining > 0 && creditsRemaining <= 5;

  return {
    credits_used: credit.credits_used,
    credit_limit: credit.credit_limit,
    credits_remaining: creditsRemaining,
    rate_dollar_per_credit: credit.rate_dollar_per_credit,
    is_active: credit.is_active === 1,
    is_last_chance: isLastChance,
  };
};

/**
 * Record AI usage and deduct credits for a tenant.
 * Called AFTER a successful AI response.
 * @param {number} tenantId
 * @param {Object} usageData
 * @param {string} usageData.model - Model used (e.g. "minimax/minimax-m3")
 * @param {number} usageData.cost_usd - Cost in USD from EdenAI response
 * @param {number} [usageData.tokens_prompt] - Prompt tokens
 * @param {number} [usageData.tokens_completion] - Completion tokens
 * @param {string} [usageData.source] - Source identifier (e.g. "handler", "router", "form_assistant")
 * @returns {Promise<Object>} Updated credit status
 */
export const recordUsage = async (tenantId, usageData) => {
  const { model, cost_usd = 0, tokens_prompt = 0, tokens_completion = 0, source = 'unknown' } = usageData;

  if (!cost_usd || cost_usd <= 0) {
    return { skipped: true, reason: 'no_cost' };
  }

  const credit = await ensureTenantCredit(tenantId);
  const creditsUsed = cost_usd / credit.rate_dollar_per_credit;

  // 1. Log the usage
  await prisma.aiCreditUsageLog.create({
    data: {
      tenant_id: tenantId,
      model_used: model || 'unknown',
      cost_usd,
      credits_used: creditsUsed,
      tokens_prompt: tokens_prompt || 0,
      tokens_completion: tokens_completion || 0,
      source: source || 'unknown',
      raw_cost: cost_usd,
    }
  });

  // 2. Update tenant's cumulative credits_used
  const updatedCredit = await prisma.tenantAiCredit.update({
    where: { tenant_id: tenantId },
    data: {
      credits_used: { increment: creditsUsed },
      updated_at: new Date(),
    }
  });

  const remaining = updatedCredit.credit_limit - updatedCredit.credits_used;
  const isOverdrawn = remaining < 0;
  const overdraft = isOverdrawn ? Math.abs(remaining) : 0;

  // Warn when approaching limit (80% used)
  const usagePercent = credit.credit_limit > 0
    ? (updatedCredit.credits_used / updatedCredit.credit_limit) * 100
    : 0;
  if (usagePercent >= 80 && usagePercent < 81) {
    console.warn(`[CreditService] WARNING: Tenant ${tenantId} has used ${usagePercent.toFixed(1)}% of credits (${updatedCredit.credits_used.toFixed(2)}/${updatedCredit.credit_limit})`);
  }

  if (isOverdrawn) {
    console.warn(`[CreditService] OVERDRAWN: Tenant ${tenantId} is now ${overdraft.toFixed(2)} credits in the minus! (used: ${updatedCredit.credits_used.toFixed(2)}, limit: ${updatedCredit.credit_limit}). Next call will be BLOCKED.`);
  }

  return {
    credits_used: updatedCredit.credits_used,
    credit_limit: updatedCredit.credit_limit,
    credits_remaining: remaining, // can be negative (minus)
    is_overdrawn: isOverdrawn,
    overdraft: overdraft, // how much in the minus (positive number)
    last_deduction: creditsUsed,
  };
};

/**
 * Get full credit status for a tenant (for dashboard display).
 * @param {number} tenantId
 * @returns {Promise<Object>}
 */
export const getCreditStatus = async (tenantId) => {
  const credit = await ensureTenantCredit(tenantId);

  const creditsRemaining = credit.credit_limit - credit.credits_used;
  const isOverdrawn = creditsRemaining < 0;
  const usagePercent = credit.credit_limit > 0
    ? (credit.credits_used / credit.credit_limit) * 100
    : 0;

  // Get recent usage logs (last 10)
  const recentLogs = await prisma.aiCreditUsageLog.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      model_used: true,
      cost_usd: true,
      credits_used: true,
      source: true,
      created_at: true,
    }
  });

  // Get today's usage
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayUsage = await prisma.aiCreditUsageLog.aggregate({
    where: {
      tenant_id: tenantId,
      created_at: { gte: today }
    },
    _sum: {
      cost_usd: true,
      credits_used: true,
    },
    _count: true,
  });

  return {
    credits_used: credit.credits_used,
    credit_limit: credit.credit_limit,
    credits_remaining: creditsRemaining, // can be negative (minus)
    is_overdrawn: isOverdrawn,
    overdraft: isOverdrawn ? Math.abs(creditsRemaining) : 0,
    usage_percent: parseFloat(Math.min(usagePercent, 999).toFixed(2)),
    rate_dollar_per_credit: credit.rate_dollar_per_credit,
    dollar_equivalent: parseFloat((credit.credits_used * credit.rate_dollar_per_credit).toFixed(6)),
    is_active: credit.is_active === 1,
    last_synced_at: credit.last_synced_at,
    today: {
      calls: todayUsage._count,
      cost_usd: todayUsage._sum.cost_usd || 0,
      credits_used: todayUsage._sum.credits_used || 0,
    },
    recent_logs: recentLogs,
  };
};

/**
 * Sync usage from EdenAI's cost monitoring API.
 * @param {number} tenantId
 * @param {Object} [options]
 * @param {boolean} [options.readOnly=false] - If true, only update sync timestamp (don't overwrite credits_used)
 * @returns {Promise<Object>}
 */
export const syncEdenAiUsage = async (tenantId, { readOnly = false } = {}) => {
  const apiKey = process.env.EDENAI_API_KEY;
  if (!apiKey) {
    throw new Error('EDENAI_API_KEY not configured');
  }

  const credit = await ensureTenantCredit(tenantId);

  // Fetch consumption for current month
  const now = new Date();
  const beginDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const url = `https://api.edenai.run/v2/cost_management/?begin=${beginDate}&end=${endDate}&step=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`EdenAI cost API error: ${response.status} - ${JSON.stringify(errData)}`);
  }

  const data = await response.json();

  // Calculate total cost from the response
  let totalCostUsd = 0;
  let totalCalls = 0;

  if (data?.response && Array.isArray(data.response)) {
    for (const tokenData of data.response) {
      if (tokenData?.data) {
        for (const [date, features] of Object.entries(tokenData.data)) {
          for (const [feature, details] of Object.entries(features)) {
            if (details?.total_cost) {
              totalCostUsd += details.total_cost;
            }
            if (details?.details) {
              totalCalls += details.details;
            }
          }
        }
      }
    }
  }

  // Convert to credits
  const totalCredits = totalCostUsd / credit.rate_dollar_per_credit;

  // In readOnly mode: only update sync timestamp, don't overwrite credits_used (safe for cron)
  // In reconcile mode: overwrite credits_used to match EdenAI (for manual sync)
  const updateData = {
    last_synced_at: new Date(),
    last_synced_total_usd: totalCostUsd,
    updated_at: new Date(),
  };

  if (!readOnly) {
    updateData.credits_used = totalCredits;
  }

  const previousCreditsUsed = credit.credits_used;
  const updatedCredit = await prisma.tenantAiCredit.update({
    where: { tenant_id: tenantId },
    data: updateData,
  });

  const diff = totalCredits - previousCreditsUsed;

  if (!readOnly && Math.abs(diff) > 0.01) {
    console.log(`[CreditSync] Tenant ${tenantId} reconciled: ${previousCreditsUsed.toFixed(2)} → ${totalCredits.toFixed(2)} (diff: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)})`);
  }

  return {
    synced: true,
    edenai_total_calls: totalCalls,
    edenai_credits_equivalent: totalCredits,
    previous_credits_used: previousCreditsUsed,
    credits_used: updatedCredit.credits_used,
    credits_remaining: updatedCredit.credit_limit - updatedCredit.credits_used,
    reconciled_diff: diff,
    read_only: readOnly,
    period: { begin: beginDate, end: endDate },
    last_synced_at: updatedCredit.last_synced_at,
  };
};

/**
 * Reset credits for a tenant (admin action).
 * @param {number} tenantId
 * @param {number} [newLimit] - Optional new credit limit
 * @returns {Promise<Object>}
 */
export const resetCredits = async (tenantId, newLimit = null) => {
  const data = {
    credits_used: 0,
    updated_at: new Date(),
  };

  if (newLimit !== null) {
    data.credit_limit = newLimit;
  }

  // 1. Reset credit balance
  const updated = await prisma.tenantAiCredit.update({
    where: { tenant_id: tenantId },
    data,
  });

  // 2. Clear all usage logs so "Hari Ini" and "Log Penggunaan" also reset
  const deleted = await prisma.aiCreditUsageLog.deleteMany({
    where: { tenant_id: tenantId },
  });

  console.log(`[CreditService] Reset tenant ${tenantId}: credits=0, deleted ${deleted.count} usage logs`);

  return {
    reset: true,
    credit_limit: updated.credit_limit,
    credits_used: 0,
    credits_remaining: updated.credit_limit,
    logs_cleared: deleted.count,
  };
};

/**
 * Update credit limit for a tenant (admin action).
 * @param {number} tenantId
 * @param {number} newLimit
 * @returns {Promise<Object>}
 */
export const updateCreditLimit = async (tenantId, newLimit) => {
  const updated = await prisma.tenantAiCredit.update({
    where: { tenant_id: tenantId },
    data: {
      credit_limit: newLimit,
      updated_at: new Date(),
    }
  });

  return {
    updated: true,
    credit_limit: updated.credit_limit,
    credits_used: updated.credits_used,
    credits_remaining: Math.max(0, updated.credit_limit - updated.credits_used),
    is_overdrawn: updated.credits_used > updated.credit_limit,
    overdraft: Math.max(0, updated.credits_used - updated.credit_limit),
  };
};

/**
 * Sync credits for ALL active tenants from EdenAI.
 * Runs as a background cron job every 5 minutes.
 */
export const syncAllTenantsCredits = async () => {
  const apiKey = process.env.EDENAI_API_KEY;
  if (!apiKey) return; // skip silently if no key

  const tenants = await prisma.tenant.findMany({
    where: { is_active: 1 },
    select: { id: true, business_name: true },
  });

  if (!tenants.length) return;

  let synced = 0;
  let errors = 0;

  for (const tenant of tenants) {
    try {
      await syncEdenAiUsage(tenant.id, { readOnly: true });
      synced++;
    } catch (err) {
      errors++;
      console.warn(`[CreditSync] Failed for tenant ${tenant.id} (${tenant.business_name}): ${err.message}`);
    }
  }

  if (synced > 0 || errors > 0) {
    console.log(`[CreditSync] Done: ${synced} synced, ${errors} errors`);
  }
};
