/**
 * ================================================================
 * GHOST TIMER SERVICE — Proactive Idle/Ghosted Detection
 * ================================================================
 *
 * Instead of reactively detecting ghosting when a customer returns,
 * this service ARM a countdown timer every time AI sends a reply.
 * If the customer doesn't reply before the timer expires, the lead
 * is automatically transitioned to IDLE or GHOSTED.
 *
 * Flow:
 *   1. AI replies → armTimer(tenantId, phone, intent)
 *      ghost_status = 'at_risk', ghost_timer_expires_at = now + duration
 *
 *   2. Customer replies → cancelTimer(tenantId, phone)
 *      ghost_status = 'active', timer cleared
 *
 *   3. Cron runs every 5 min → processExpiredTimers()
 *      Finds at_risk leads with expired timer → sets idle or ghosted
 *
 * Intent classification:
 *   'casual'  → no serious buying signals  → 30 min  → IDLE
 *   'serious' → showed real engagement      → 60 min  → GHOSTED
 */

import prisma from '../../config/database.js';

// ── Timer durations (easy to tweak) ──────────────────────────────
const TIMER_DURATIONS = {
  casual:  2 * 24 * 60 * 60 * 1000,   // 48 hours (2 days) — customer just browsing → IDLE
  serious: 2 * 24 * 60 * 60 * 1000,   // 48 hours (2 days) — customer showed serious intent → GHOSTED
};

/**
 * Arm the ghost timer for a lead after AI sends a reply.
 * Sets ghost_status = 'at_risk' and schedules the expiry timestamp.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {'casual'|'serious'} intent — classified by AI
 */
export const armTimer = async (tenantId, phone, intent = 'casual') => {
  const duration = TIMER_DURATIONS[intent] || TIMER_DURATIONS.casual;
  const expiresAt = new Date(Date.now() + duration);

  try {
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
      data: {
        ghost_status:           'at_risk',
        ghost_timer_expires_at: expiresAt,
        ghost_intent:           intent,
        last_ai_reply_at:       new Date(),
      },
    });
    const mins = Math.round(duration / 60000);
    console.log(`[GhostTimer] ⏱️  Timer armed — ${phone} | intent=${intent} | expires in ${mins}min (${expiresAt.toISOString()})`);
  } catch (err) {
    console.error(`[GhostTimer] Failed to arm timer for ${phone}:`, err.message);
  }
};

/**
 * Cancel the ghost timer — customer has replied.
 * Resets ghost_status to 'active' and clears timer fields.
 *
 * @param {number} tenantId
 * @param {string} phone
 */
export const cancelTimer = async (tenantId, phone) => {
  try {
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
      data: {
        ghost_status:           'active',
        ghost_timer_expires_at: null,
        ghost_intent:           null,
      },
    });
    console.log(`[GhostTimer] ✅ Timer cancelled — ${phone} replied, status reset to active`);
  } catch (err) {
    console.error(`[GhostTimer] Failed to cancel timer for ${phone}:`, err.message);
  }
};

/**
 * Process all expired ghost timers — called by background cron every 5 minutes.
 * Transitions 'at_risk' leads to 'idle' or 'ghosted' based on ghost_intent.
 */
export const processExpiredTimers = async () => {
  const now = new Date();

  try {
    // Find all leads whose timer has expired and are still at_risk
    const expiredLeads = await prisma.lead.findMany({
      where: {
        ghost_status:           'at_risk',
        ghost_timer_expires_at: { lte: now },
      },
      select: {
        id: true,
        phone: true,
        tenant_id: true,
        ghost_intent: true,
      },
    });

    if (expiredLeads.length === 0) return;

    console.log(`[GhostTimer] 🔍 Processing ${expiredLeads.length} expired timer(s)...`);

    for (const lead of expiredLeads) {
      const newStatus = lead.ghost_intent === 'serious' ? 'ghosted' : 'idle';

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          ghost_status:           newStatus,
          ghost_timer_expires_at: null,
        },
      });

      const emoji = newStatus === 'ghosted' ? '👻' : '⏸️';
      console.log(`[GhostTimer] ${emoji} ${lead.phone} → ${newStatus} (intent was: ${lead.ghost_intent || 'casual'})`);

      // Clean up deferred guidance intent if customer ghosted
      try {
        const { cancelIntent } = await import('./deferredGuidance.service.js');
        const cancelled = await cancelIntent(lead.tenant_id, lead.phone);
        if (cancelled) {
          console.log(`[GhostTimer] 🗑️ Deferred guidance intent also cleaned up for ${lead.phone}`);
        }
      } catch {}
    }

    console.log(`[GhostTimer] ✅ Done — ${expiredLeads.length} lead(s) transitioned`);
  } catch (err) {
    console.error('[GhostTimer] processExpiredTimers error:', err.message);
  }
};

/**
 * Get ghost status summary counts for dashboard badges.
 *
 * @param {number} tenantId
 * @returns {{ idle: number, ghosted: number, at_risk: number }}
 */
export const getGhostSummary = async (tenantId) => {
  try {
    const [idle, ghosted, at_risk] = await Promise.all([
      prisma.lead.count({ where: { tenant_id: tenantId, ghost_status: 'idle' } }),
      prisma.lead.count({ where: { tenant_id: tenantId, ghost_status: 'ghosted' } }),
      prisma.lead.count({ where: { tenant_id: tenantId, ghost_status: 'at_risk' } }),
    ]);
    return { idle, ghosted, at_risk };
  } catch (err) {
    console.error('[GhostTimer] getGhostSummary error:', err.message);
    return { idle: 0, ghosted: 0, at_risk: 0 };
  }
};
