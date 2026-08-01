import { runPipeline } from './pipeline/pipeline.engine.js';
import prisma from '../../config/database.js';

/**
 * ================================================================
 * HANDLER SERVICE — Entry Point for AI Chat Processing
 * ================================================================
 * Thin wrapper that delegates all processing to the Pipeline Engine.
 *
 * Pipeline stages:
 *   Stage 1 — Pre-validation (tenant, credits)
 *   Stage 2 — Context loader (persona, CRM, forms, memory)
 *   Stage 3 — State resolver (conversation state machine)
 *   Stage 4 — RAG pipeline (intent analysis, KB/package fetch)
 *   Stage 5 — Prompt assembler (module selection)
 *   Stage 6 — AI execution (LLM call + tool loops)
 *   Stage 7 — Post-processor (tag parsing, side effects, anti-hallucination)
 *   Stage 8 — Response emitter (multi-bubble formatting)
 *
 * Consumers:
 *   - webhook.service.js (WhatsApp, Telegram, Instagram)
 *   - email.service.js
 *   - ai.controller.js (API test endpoint)
 *   - index.js (direct WA socket)
 *
 * @param {Object} params
 * @param {number} params.tenantId - Tenant ID.
 * @param {string} params.userPhone - Customer phone number.
 * @param {string} params.userMessage - Incoming message from user.
 * @param {string} [params.mediaUrl] - Image/media URL (if any).
 * @param {string} [params.chatType='sales'] - AI type ('sales' or 'cs').
 * @returns {Promise<Object>} AI response object.
 */
export const processIncomingChat = async ({ tenantId, userPhone, userMessage, mediaUrl, chatType = 'sales' }) => {
  // ── AI Service Switch ──────────────────────────────────────────
  // When the tenant disables the AI service (ai_service_enabled = 'false'),
  // the AI will NOT respond to any inbox message at all. The pipeline is
  // short-circuited here so no LLM call, no reply, no side effects run.
  // Default is ENABLED when the setting is absent (backward compatible).
  try {
    const aiSwitch = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'ai_service_enabled' } },
    });
    const enabled = aiSwitch?.setting_value !== 'false';
    if (!enabled) {
      console.log(`[Handler] 🛑 AI service is DISABLED for tenant ${tenantId} — skipping inbox response for ${userPhone}`);
      return {
        success: true,
        data: {
          reply: '',
          bubbles: [],
          metadata: {
            ai_service_disabled: true,
            chat_type: chatType,
          },
        },
      };
    }
  } catch (switchErr) {
    // Fail-open: if the DB lookup fails, let the AI run normally.
    console.warn('[Handler] AI service switch check failed, defaulting to enabled:', switchErr.message);
  }

  return await runPipeline({ tenantId, userPhone, userMessage, mediaUrl, chatType });
};
