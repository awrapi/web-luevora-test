/**
 * ================================================================
 * STAGE 6 — AI Execution
 * ================================================================
 * Runs the AI (LangChain / EdenAI) with the assembled prompt.
 * Includes:
 *   - Vision Gate: decides whether to send full image or use summary
 *   - Multi-bubble (WhatsApp) vs single reply (Email)
 *   - Model fallback (main model → tool model)
 */

import { executeLangChain } from '../../logic.service.js';
import { processMultiBubble }  from '../../bubble.service.js';

export const runStage6AIExecution = async (ctx) => {
  const {
    tenantId, userPhone, chatType, lead,
    personaText, kbContext, bankInfo,
    userMessage, mediaUrl, longTermMemory, promoInstruction,
    customerHistoryText, currentMediaSummary, selectedModuleIds,
    models,
  } = ctx;

  // ── Vision Gate ───────────────────────────────────────────────
  let finalMediaUrlToVision = null;
  let finalUserMessage = userMessage;

  if (mediaUrl) {
    if (currentMediaSummary) {
      try {
        const prompt = `Pelanggan mengirimkan pesan: "${userMessage}" beserta gambar yang dirangkum sebagai berikut: "${currentMediaSummary}".
Apakah AI perlu membaca gambar aslinya dengan sangat detail menggunakan Vision API untuk menjawab permintaan pelanggan, atau apakah rangkuman tersebut sudah cukup jelas?
Jika informasi di gambar tidak relevan atau sudah terwakili oleh rangkuman (misal brosur wisata yang informasinya ada di RAG), pilih false.
Hanya pilih true jika butuh analisis visual mendalam yang tidak ada di rangkuman.
Jawab HANYA dengan JSON valid: { "needsVision": true } atau { "needsVision": false }`;

        const { executeFastJsonAI } = await import('../../logic.service.js');
        const response = await executeFastJsonAI(tenantId, 'Kamu adalah AI pengambil keputusan Vision.', prompt, [], 'vision_gate');

        if (response?.needsVision === true) {
          finalMediaUrlToVision = mediaUrl;
          console.log('[Stage6] Vision Gate: READ_FULL_IMAGE');
        } else {
          console.log('[Stage6] Vision Gate: SKIP_VISION, using summary');
          finalUserMessage += `\n\n[Sistem: Pelanggan melampirkan gambar dengan rangkuman: "${currentMediaSummary}". PERINGATAN KRITIKAL: Rangkuman gambar INI HANYA UNTUK MENGIDENTIFIKASI TOPIK. Untuk menjawab pertanyaan pelanggan tentang harga, itinerary, atau ketersediaan, ANDA WAJIB MUTLAK MENGGUNAKAN DATA DARI 'KNOWLEDGE BASE' / 'DOKUMEN PAKET'! DILARANG menjadikan teks rangkuman gambar ini sebagai sumber kebenaran data.]`;
        }
      } catch (e) {
        console.error('[Stage6] Vision Gate error, defaulting to full vision:', e.message);
        finalMediaUrlToVision = mediaUrl;
      }
    } else {
      finalMediaUrlToVision = mediaUrl;
    }
  }

  ctx.finalUserMessage = finalUserMessage;
  ctx.finalMediaUrlToVision = finalMediaUrlToVision;

  // ── Build customer context object ─────────────────────────────
  const customerContext = {
    phone:                  userPhone,
    savedName:              lead?.saved_name || null,
    pushName:               lead?.push_name || 'WhatsApp User',
    email:                  lead?.email || null,
    first_name:             lead?.first_name || null,
    last_name:              lead?.last_name || null,
    position_title:         lead?.position_title || null,
    company_name:           lead?.company_name || null,
    industry:               lead?.industry || null,
    city:                   lead?.city || null,
    country:                lead?.country || null,
    gender:                 lead?.gender || null,
    preferences:            lead?.preferences || null,
    notes:                  lead?.chat_summary || null,
    communication_preference: lead?.communication_preference || null,
    personal_notes:         lead?.personal_notes || null,
    lead_source:            lead?.lead_source || null,
    whatsapp_phone:         lead?.whatsapp_phone || null,
    telegram_id:            lead?.telegram_id || null,
    instagram_username:     lead?.instagram_username || null,
    crmHistory:             customerHistoryText || null,
  };

  // ── Execute AI ────────────────────────────────────────────────
  let aiResponseContent;
  let multiBubbles = null;

  if (chatType === 'email') {
    // Email: single coherent reply
    aiResponseContent = await executeLangChain({
      tenantId, personaText, kbContext, bankInfo,
      userMessage: finalUserMessage,
      mediaUrl:    finalMediaUrlToVision,
      longTermMemory, promoInstruction, customerContext, chatType, selectedModuleIds,
      models,
    });
  } else {
    // WhatsApp/Chat: multi-bubble
    try {
      const bubbleResult = await processMultiBubble({
        tenantId, personaText, kbContext, bankInfo,
        userMessage: finalUserMessage,
        mediaUrl:    finalMediaUrlToVision,
        longTermMemory, customerContext,
        chatHistorySnippet: ctx.chatHistorySnippet,
        promoInstruction,
        executeLangChainFn: executeLangChain,
        selectedModuleIds,
        models,
      });
      aiResponseContent = bubbleResult.combinedReply;
      multiBubbles      = bubbleResult.bubbles;
    } catch (bubbleErr) {
      console.error('[Stage6] MultiBubble failed, fallback to single reply:', bubbleErr.message);
      aiResponseContent = await executeLangChain({
        tenantId, personaText, kbContext, bankInfo,
        userMessage: finalUserMessage,
        mediaUrl:    finalMediaUrlToVision,
        longTermMemory, promoInstruction, customerContext, chatType, selectedModuleIds,
        models,
      });
    }
  }

  ctx.aiResponseRaw     = aiResponseContent;
  ctx.aiResponseContent = aiResponseContent;
  ctx.multiBubbles      = multiBubbles;
};
