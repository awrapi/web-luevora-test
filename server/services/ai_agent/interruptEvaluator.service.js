/**
 * ================================================================
 * Interrupt Evaluator — Evaluasi Pesan Baru Saat AI Processing
 * ================================================================
 * Micro AI call untuk mengevaluasi apakah respons AI yang sudah
 * di-generate masih valid/cukup setelah ada pesan baru masuk,
 * atau perlu di-reprocess karena topik berubah / konteks baru.
 * ================================================================
 */

import { executeFastJsonAI } from './logic.service.js';

/**
 * Evaluasi apakah respons AI yang sudah di-generate masih relevan
 * setelah ada pesan baru yang masuk saat AI sedang processing.
 *
 * @param {number} tenantId
 * @param {string} aiGeneratedReply - Respons AI yang sudah ready
 * @param {Array<{text: string}>} pendingMessages - Pesan baru yang masuk saat proses
 * @param {string} originalUserMessage - Pesan asli yang memicu AI
 * @returns {Promise<{verdict: 'SEND'|'REPROCESS', reason: string}>}
 */
export const evaluateInterrupt = async (tenantId, aiGeneratedReply, pendingMessages, originalUserMessage) => {
  const pendingTexts = pendingMessages.map(m => {
    const vnTag = m.isVoiceNote ? ' [Voice Note]' : '';
    return m.text + vnTag;
  }).join('\n');

  const systemPrompt = `You are a WhatsApp conversation analyst. Your job is to determine if an AI-generated reply is STILL VALID and SUFFICIENT after new messages arrived during processing.

CONTEXT:
- A customer sent message(s), AI processed them and generated a reply.
- While AI was thinking, the customer sent MORE messages.
- You must decide: should the AI reply be sent AS-IS, or does it need REPROCESSING?

CRITICAL PRINCIPLE: Evaluate objectively. If the new messages contain questions, requests, or information that the generated reply does NOT address, you MUST choose REPROCESS.

RULES:
1. verdict = "SEND" if:
   - The new messages are just reactions, agreements, or continuations of the SAME topic.
   - The new messages don't change the subject or add critical new information.
   - The AI reply already covers what the new messages are about (even partially).
   - The new messages are just emojis or short filler words.

2. verdict = "REPROCESS" if:
   - The new messages ask a NEW QUESTION that is not answered in the AI reply.
   - The new messages ask about a DIFFERENT topic.
   - The new messages contain "[CUSTOMER MENGOREKSI PESANNYA MENJADI]". If you see this, you MUST choose REPROCESS because the AI generated a reply based on a typo or incorrect message that the customer has now fixed.
   - The existing AI reply would be confusing, incomplete, or wrong if sent after the new messages.
   - The new messages provide crucial information that changes how the AI should respond.

Return JSON:
{
  "verdict": "SEND" or "REPROCESS",
  "reason": "Brief explanation in Indonesian"
}`;

  const userPrompt = `PESAN ASLI CUSTOMER:
${originalUserMessage}

BALASAN AI YANG SUDAH DI-GENERATE:
${aiGeneratedReply}

PESAN BARU YANG MASUK SAAT AI PROCESSING:
${pendingTexts}

Evaluasi: Apakah balasan AI di atas SUDAH MENJAWAB pesan baru tersebut, atau perlu di-reprocess karena pesan baru butuh jawaban/konteks baru?`;

  try {
    const result = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'interrupt_evaluator');
    console.log('[Interrupt Evaluator] Raw result:', JSON.stringify(result));

    if (result) {
      const verdict = result.verdict || result.Verdict || result.VERDICT;
      const reason = result.reason || result.Reason || result.REASON;
      
      if (verdict) {
        console.log(`[Interrupt Evaluator] Verdict: ${verdict} — ${reason}`);
        return {
          verdict: String(verdict).toUpperCase() === 'REPROCESS' ? 'REPROCESS' : 'SEND',
          reason: reason || ''
        };
      }
    }
  } catch (err) {
    console.error('[Interrupt Evaluator] Error:', err.message);
  }

  // Default: kirim saja (jangan delay customer lebih lama)
  console.log('[Interrupt Evaluator] Fallback → SEND (evaluation failed)');
  return { verdict: 'SEND', reason: 'Evaluation failed, defaulting to send' };
};
