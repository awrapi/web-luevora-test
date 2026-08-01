/**
 * ================================================================
 * STAGE 1 — Pre-Validation
 * ================================================================
 * Checks:
 *   1. Tenant exists
 *   2. AI credit not exceeded / not disabled
 *
 * Decisions:
 *   abort  → tenant not found
 *   hold   → credit exceeded / disabled (returns friendly message)
 *   continue → all good
 */

import prisma from '../../../../config/database.js';
import { checkCredit } from '../../credit.service.js';
import { startWatching } from '../../gatekeeperWatcher.service.js';
import { getModelsForPlan } from '../../../../config/subscriptionModels.js';

export const runStage1PreValidation = async (ctx) => {
  // ── 1. Validate tenant ───────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });

  if (!tenant) {
    ctx.decision = 'abort';
    ctx.abortError = new Error(`Tenant ${ctx.tenantId} tidak ditemukan.`);
    return;
  }

  ctx.tenant = tenant;

  // ── Resolve AI models for this tenant's subscription tier ────────
  ctx.models = getModelsForPlan(tenant.subscription_plan);
  console.log(`[Stage1] Plan: ${tenant.subscription_plan || 'free'} → mainModel: ${ctx.models.mainModel}`);

  // ── 2. Free plan check — AI disabled for free plan tenants ──────
  // Free plan users can only operate in manual mode.
  if (!tenant.subscription_plan || tenant.subscription_plan === 'free') {
    ctx.decision = 'abort';
    ctx.abortError = new Error(`[FreePlan] Tenant ${ctx.tenantId} menggunakan paket gratis — AI dinonaktifkan. Gunakan mode manual.`);
    console.log(`[Stage1] BLOCKED: Tenant ${ctx.tenantId} (${tenant.business_name}) paket free — AI tidak aktif.`);
    return;
  }

  // ── Start Gatekeeper Agent (Agent 2) watcher ──────────────────
  // Monitors for pending messages during pipeline execution
  startWatching(ctx.tenantId, ctx.userPhone);

  // ── 2. Credit check ─────────────────────────────────────────────
  try {
    const creditStatus = await checkCredit(ctx.tenantId);
    ctx.creditStatus = creditStatus;

    if (creditStatus.is_last_chance) {
      console.warn(`[Stage1] LAST CHANCE: Tenant ${ctx.tenantId} kredit tersisa ${creditStatus.credits_remaining.toFixed(2)}`);
    } else {
      console.log(`[Stage1] Kredit OK: ${creditStatus.credits_remaining.toFixed(2)} tersisa`);
    }
  } catch (creditErr) {
    if (creditErr.code === 'AI_CREDIT_EXCEEDED') {
      ctx.decision = 'hold';
      ctx.holdResponse = 'Maaf, layanan AI saat ini tidak tersedia karena batas kredit telah tercapai. Silakan hubungi administrator untuk menambah kuota kredit.';
      ctx.holdMeta = {
        credit_exceeded: true,
        credits_used: creditErr.creditsUsed,
        credit_limit: creditErr.creditLimit,
        overdraft: creditErr.overdraft,
      };
      return;
    }
    if (creditErr.code === 'AI_CREDIT_DISABLED') {
      ctx.decision = 'hold';
      ctx.holdResponse = 'Maaf, layanan AI untuk akun Anda saat ini dinonaktifkan. Silakan hubungi administrator.';
      ctx.holdMeta = { credit_disabled: true };
      return;
    }
    throw creditErr;
  }
};
