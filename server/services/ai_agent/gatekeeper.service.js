/**
 * ================================================================
 * GATEKEEPER AGENT (Agent 2) — Intelligent Pending Message Handler
 * ================================================================
 *
 * Lightweight AI agent that activates when pending messages arrive
 * while Agent 1 (main pipeline) is still reasoning.
 *
 * Responsibilities:
 *   1. Read pending messages
 *   2. Read Agent 1's pipeline progress (how far it has gotten)
 *   3. Classify the pending messages
 *   4. Make a decision:
 *      - CONTINUE:    Let Agent 1 finish, pending is filler/same topic
 *      - ABORT_AT:    Stop Agent 1 at a specific stage, reprocess needed
 *      - HOLD:        Send a quick AI-generated holding response to customer
 *      - QUEUE_AFTER: Agent 1 finishes, pending becomes next pipeline cycle
 *
 * Architecture:
 *   - Uses executeFastJsonAI for decision-making (one fast AI call)
 *   - Uses executeFastJsonAI for dynamic holding message generation
 *   - No pipeline re-run needed — Gatekeeper decides in <3 seconds
 */

import { executeFastJsonAI } from './logic.service.js';
import { getPipelineProgress } from './pipelineProgress.service.js';
import redisClient, { REDIS_PREFIX } from '../../config/redis.js';

const GATEKEEPER_MODEL = process.env.GATEKEEPER_MODEL || null; // Falls back to EDENAI_MODEL if not set

/**
 * Stage name mapping for human-readable AI prompt.
 */
const STAGE_NAMES = {
  1: 'PreValidation (validating tenant & credits)',
  2: 'ContextLoader (loading CRM data, chat history, customer profile)',
  3: 'StateResolver (determining conversation state & intent signals)',
  4: 'RagPipeline (searching knowledge base, fetching packages, analyzing intent)',
  5: 'PromptAssembler (building the AI prompt with all context)',
  6: 'AIExecution (generating the actual reply — this is the slowest stage)',
  7: 'PostProcessor (post-processing reply, arming ghost timer)',
  8: 'ResponseEmitter (sending reply to customer)',
};

/**
 * Evaluate what to do with pending messages while Agent 1 is processing.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {Array<{text: string}>} pendingMessages - New messages that arrived during processing
 * @param {Object} [pipelineProgress] - Current Agent 1 progress (from Redis)
 * @returns {Promise<{
 *   decision: 'CONTINUE'|'ABORT_AT'|'HOLD'|'QUEUE_AFTER',
 *   abortAtStage?: number,
 *   reason: string,
 *   holdMessage?: string
 * }>}
 */
export const evaluateGatekeeperDecision = async (tenantId, phone, pendingMessages, pipelineProgress = null, gatekeeperModel = null) => {
  // Fetch progress if not provided
  const progress = pipelineProgress || await getPipelineProgress(tenantId, phone);

  const currentStage = progress?.stage || 1;
  const stageName = STAGE_NAMES[currentStage] || `Stage ${currentStage}`;
  const originalMessage = progress?.originalMessage || '(unknown)';
  const conversationState = progress?.conversationState || 'EXPLORATION';
  const elapsedMs = progress?.elapsedMs || (Date.now() - (progress?.startedAt || Date.now()));

  const pendingTexts = pendingMessages.map(m => m.text).join('\n');

  // Check if a HOLD was already sent for this pipeline cycle
  const holdCount = parseInt(await redisClient.get(`gatekeeper:${REDIS_PREFIX}:handled:${tenantId}:${phone}:holdcount`) || '0', 10);
  const holdContext = holdCount > 0
    ? `\n\nIMPORTANT: A HOLD message was ALREADY sent to the customer earlier (${holdCount}x). The customer may be responding to that HOLD. If they just acknowledge the HOLD (e.g., "oke", "baik", "siap", "oke kak"), use CONTINUE — no need to reply again.`
    : '';

  const systemPrompt = `You are a WhatsApp conversation gatekeeper agent. Your job is to decide what to do when a customer sends NEW messages while the AI assistant is still processing their PREVIOUS message.

CURRENT SITUATION:
- The AI assistant (Agent 1) is currently at: ${stageName} (Stage ${currentStage} of 8)
- Time elapsed: ${Math.round(elapsedMs / 1000)} seconds
- Conversation state: ${conversationState}
- The ORIGINAL message Agent 1 is processing: "${originalMessage}"${holdContext}

NEW PENDING MESSAGES from the customer:
${pendingTexts}

You must return ONE of these decisions:

1. "CONTINUE" — Use when:
   - New messages are filler words (e.g., "iya", "ok", "oke", "hehe", "makasih", emojis)
   - New messages are acknowledgments to a HOLD message you already sent (e.g., "oke kak", "baik", "siap kak")
   - New messages continue the SAME topic (adding minor details to what they already said)
   - Agent 1 is already at Stage 5+ (almost done generating reply) and the new messages don't change the question
   - The AI reply that Agent 1 is generating will likely still be relevant
   - IMPORTANT: CONTINUE means the messages are DISCARDED — Agent 1 will NOT process them. Only use CONTINUE for messages that truly don't need any response.

2. "ABORT_AT" — Use when:
   - New messages ask a COMPLETELY DIFFERENT question/topic than the original
   - New messages contain "[CUSTOMER MENGOREKSI PESANNYA MENJADI]" (customer corrected their message)
   - New messages provide CRITICAL INFO that would change the AI's reply (e.g., answering a question the AI was about to ask)
   - The topic has shifted so much that Agent 1's reply would be irrelevant or repetitive
   - You MUST also specify "abortAtStage": the stage where Agent 1 should stop
     * If Agent 1 is at Stage 1-3: set abortAtStage to current stage + 1 (stop right after current)
     * If Agent 1 is at Stage 4-5 (RAG/prompt assembly): set abortAtStage to 6 (stop before AI generates reply)
     * If Agent 1 is at Stage 6 (generating reply): set abortAtStage to 7 (stop before post-processing — the reply may already be stale)
     * If Agent 1 is at Stage 7+ (post-processing/sending): DO NOT abort — use QUEUE_AFTER instead, reply is already generated

3. "HOLD" — Use when:
   - Agent 1 is still at early stages (Stage 1-4) and will take a while
   - Customer seems impatient or sent a message expecting acknowledgment
   - The new messages deserve a quick acknowledgment while Agent 1 finishes
   - IMPORTANT: If processing has taken more than 8 seconds AND there are pending messages, strongly prefer HOLD
   - IMPORTANT: If there are multiple pending messages, the customer is likely getting anxious — prefer HOLD
   - You MUST also provide "holdMessage": a natural, friendly WhatsApp message in Indonesian that acknowledges the customer (e.g., "Halo kak, sebentar ya kami sedang cek ketersediaannya 🙏" or "Siap kak, mohon tunggu sebentar ya sedang kami carikan infonya 😊")
   - The hold message should be contextual to what the customer asked — NOT generic
   - After HOLD is sent, Agent 1 CONTINUES working in the background — the hold message just buys time

4. "QUEUE_AFTER" — Use when:
   - New messages are clearly a SEPARATE question that should be answered AFTER Agent 1's current reply
   - Example: original was about package A, new message asks about package B — let Agent 1 finish, then process new question separately
   - Agent 1 should finish normally, then pending messages get re-processed as a new pipeline cycle

Return JSON:
{
  "decision": "CONTINUE" or "ABORT_AT" or "HOLD" or "QUEUE_AFTER",
  "abortAtStage": number (only for ABORT_AT),
  "holdMessage": "string" (only for HOLD — natural Indonesian WhatsApp message),
  "reason": "Brief explanation in Indonesian"
}`;

  const userPrompt = `Original message being processed: "${originalMessage}"
New pending messages:
${pendingTexts}

Agent 1 is at Stage ${currentStage} (${stageName}), ${Math.round(elapsedMs / 1000)}s elapsed.
What should we do?`;

  try {
    // Priority: per-tier override → GATEKEEPER_MODEL env → EDENAI_MODEL fallback
    const modelToUse = gatekeeperModel || GATEKEEPER_MODEL || null;
    const result = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'gatekeeper_decision', modelToUse);
    if (result && result.decision) {
      const decision = String(result.decision).toUpperCase();
      const validDecisions = ['CONTINUE', 'ABORT_AT', 'HOLD', 'QUEUE_AFTER'];

      if (validDecisions.includes(decision)) {
        console.log(`[Gatekeeper] Decision: ${decision} — ${result.reason || ''}`);
        return {
          decision,
          abortAtStage: result.abortAtStage || result.abort_at_stage || null,
          holdMessage: result.holdMessage || result.hold_message || null,
          reason: result.reason || '',
        };
      }
    }
  } catch (err) {
    console.error('[Gatekeeper] AI decision failed:', err.message);
  }

  // Fallback: safest default — let Agent 1 continue, queue pending for after
  console.log('[Gatekeeper] Fallback → CONTINUE (AI decision failed)');
  return {
    decision: 'CONTINUE',
    reason: 'Gatekeeper AI call failed, defaulting to safe behavior',
  };
};

/**
 * Generate a dynamic holding response for the customer.
 * Used when Gatekeeper decides HOLD and needs a contextual message.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {Array<{text: string}>} pendingMessages
 * @param {string} conversationState
 * @returns {Promise<string>} The holding message to send
 */
export const generateHoldingResponse = async (tenantId, phone, pendingMessages, conversationState = 'EXPLORATION', gatekeeperModel = null) => {
  const pendingTexts = pendingMessages.map(m => m.text).join('\n');

  const systemPrompt = `You are a friendly Indonesian WhatsApp sales assistant. A customer just sent you message(s) and you need to acknowledge them quickly while you prepare a full response.

Generate a SHORT, natural, friendly WhatsApp message (1-2 sentences max) that:
1. Acknowledges what the customer said
2. Tells them you're looking into it
3. Sounds warm and human-like (use casual Indonesian, not formal)
4. Optionally uses 1 emoji

IMPORTANT: The message must be CONTEXTUAL to what they asked — not a generic "please wait" message.

Examples of GOOD holding messages:
- "Halo kak! Sebentar ya, aku cek dulu ketersediaan paket Jogja-nya 🙏"
- "Siap kak, mohon tunggu sebentar ya sedang aku carikan info tanggalnya 😊"
- "Oke kak, bentar ya aku cek dulu harga paketnya hehe"
- "Wah boleh kak! Sebentar ya aku cek dulu detailnya 🙏"
- "Halo kak, maaf tunggu sebentar ya, sedang aku siapkan infonya 😊"

Return JSON:
{
  "message": "the holding message in Indonesian"
}`;

  const userPrompt = `Customer's messages:\n${pendingTexts}\n\nConversation state: ${conversationState}\n\nGenerate a contextual holding message:`;

  try {
    const modelToUse = gatekeeperModel || GATEKEEPER_MODEL || null;
    const result = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'gatekeeper_hold', modelToUse);
    if (result && result.message) {
      return result.message;
    }
  } catch (err) {
    console.error('[Gatekeeper] Holding response generation failed:', err.message);
  }

  // Fallback holding messages
  const fallbacks = [
    'Halo kak, sebentar ya kami sedang proses permintaan kakak 🙏',
    'Siap kak, mohon tunggu sebentar ya 😊',
    'Oke kak, sebentar ya kami cek dulu 🙏',
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
};

export default {
  evaluateGatekeeperDecision,
  generateHoldingResponse,
};
