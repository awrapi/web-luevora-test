/**
 * ================================================================
 * STAGE 7 — Post Processor
 * ================================================================
 * Orchestrates post-processing of AI output:
 *   1. Media tag processing     → tagProcessor.media.js
 *   2. Identity & CRM tags      → inline (small)
 *   3. Central info tags         → inline (small)
 *   4. Legacy tag safety nets    → inline (strip only)
 *   5. Date request tags         → tagProcessor.dateRequest.js
 *   6. Anti-hallucination verify → antiHallucination.js
 *   7. Ghost timer & cleanup     → inline
 */

import prisma from '../../../../config/database.js';
import { recordCrmHistory } from '../../../shared/crm_history.service.js';
import * as centralInfoRequestService from '../../../shared/centralInfoRequest.service.js';
import { STAGE_INDEX } from '../pipeline.context.js';
import { armTimer } from '../../ghostTimer.service.js';
import { stopWatching } from '../../gatekeeperWatcher.service.js';

// ── Extracted modules ────────────────────────────────────────────
import { processMediaTags } from './tagProcessor.media.js';
import { processDateTags } from './tagProcessor.dateRequest.js';
import { verifyAntiHallucination } from './antiHallucination.js';

export const runStage7PostProcessor = async (ctx) => {
  const {
    tenantId, userPhone, userMessage, lead,
    kbContext, fullKbContextForVerify, promoInstruction,
    pendingCentralInfoInstruction,
  } = ctx;

  let finalReply = ctx.aiResponseContent || '';
  let bubbles = ctx.multiBubbles
    ? ctx.multiBubbles.map(b => b.trim()).filter(b => b.length > 0)
    : finalReply.split(/\[NEXT\]/gi).map(b => b.trim()).filter(b => b.length > 0);

  // ── Helper: strip tag from reply + all bubbles ────────────────
  const stripTag = (regex) => {
    finalReply = finalReply.replace(regex, '').trim();
    bubbles = bubbles.map(b => b.replace(regex, '').trim()).filter(b => b.length > 0);
  };

  // ══════════════════════════════════════════════════════════════
  // 1. MEDIA TAGS (delegated to tagProcessor.media.js)
  // ══════════════════════════════════════════════════════════════
  const mediaResult = await processMediaTags(finalReply, bubbles, ctx, stripTag);
  finalReply = mediaResult.finalReply;
  bubbles = mediaResult.bubbles;

  // ══════════════════════════════════════════════════════════════
  // 2. IDENTITY TAGS
  // ══════════════════════════════════════════════════════════════

  // [UPDATE_NAME:name] — LEGACY SAFETY NET (now handled by update_customer_name tool)
  stripTag(/\[UPDATE_NAME:\s*(.+?)\]/gi);

  // [MERGE_LEAD:phone] — LEGACY SAFETY NET (now handled by merge_lead tool)
  stripTag(/\[MERGE_LEAD:\s*(.+?)\]/gi);

  // ══════════════════════════════════════════════════════════════
  // 3. CRM UPDATE TAG — [UPDATE_INFO:key=val|key2=val2]
  // ══════════════════════════════════════════════════════════════
  // [UPDATE_INFO:key=val|...] — LEGACY SAFETY NET (execute then strip)
  // Some cheaper models emit this tag instead of calling update_crm_profile tool.
  // Parse and save to DB so data is not lost.
  const updateInfoRegex = /\[UPDATE_INFO:\s*([^\]]+)\]/gi;
  let updateInfoMatch;
  while ((updateInfoMatch = updateInfoRegex.exec(finalReply)) !== null) {
    try {
      const pairs = updateInfoMatch[1].split('|').reduce((acc, pair) => {
        const [k, ...vParts] = pair.split('=');
        if (k && vParts.length > 0) acc[k.trim()] = vParts.join('=').trim();
        return acc;
      }, {});
      if (Object.keys(pairs).length > 0) {
        const allowedFields = ['email', 'preferences', 'chat_summary', 'first_name', 'last_name', 'position_title', 'company_name', 'industry', 'company_size', 'city', 'country', 'full_address', 'gender', 'lead_source', 'communication_preference', 'personal_notes', 'pipeline_status', 'former_services'];
        const updates = {};
        for (const [k, v] of Object.entries(pairs)) {
          if (allowedFields.includes(k) && v && v !== 'kosong' && v !== '-') updates[k] = v;
        }
        if (Object.keys(updates).length > 0) {
          await prisma.lead.update({
            where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
            data: updates
          }).catch(e => console.error('[Stage7] UPDATE_INFO save error:', e.message));
          console.log(`[Stage7] ⚠️ Legacy [UPDATE_INFO] safety net executed: ${Object.keys(updates).join(', ')}`);
        }
      }
    } catch (e) { console.error('[Stage7] UPDATE_INFO parse error:', e.message); }
  }
  stripTag(/\[UPDATE_INFO:\s*([^\]]+)\]/gi);

  // ══════════════════════════════════════════════════════════════
  // 4. CENTRAL INFO TAGS
  // ══════════════════════════════════════════════════════════════

  // [CENTRAL_INFO_REQUEST:question] — LEGACY SAFETY NET (now handled by request_admin_guidance tool)
  if (/\[CENTRAL_INFO_REQUEST:/i.test(finalReply)) {
    console.warn('[Stage7] ⚠️ Legacy [CENTRAL_INFO_REQUEST] tag detected — should now use request_admin_guidance tool. Stripping tag.');
  }
  stripTag(/\[CENTRAL_INFO_REQUEST:\s*[^\]]+\]/gi);

  // [CENTRAL_INFO_RESOLVED] — still tag-based (resolves pending admin instruction)
  if (/\[CENTRAL_INFO_RESOLVED\]/i.test(finalReply) && pendingCentralInfoInstruction) {
    centralInfoRequestService.markResolved(pendingCentralInfoInstruction.requestId, tenantId)
      .catch(err => console.error('[Stage7] CentralInfo resolve error:', err.message));
    console.log(`[Stage7] Central info request #${pendingCentralInfoInstruction.requestId} marked resolved`);
  }
  stripTag(/\[CENTRAL_INFO_RESOLVED\]/gi);


  // ══════════════════════════════════════════════════════════════
  // 4b. DEFERRED GUIDANCE — Auto-trigger when all data collected
  // ══════════════════════════════════════════════════════════════
  // ALWAYS check for deferred guidance, not just when ctx.hasDeferredGuidance.
  // This makes it resilient to Redis glitches during Stage 2 that might
  // cause the flag to not be set, preventing auto-trigger.
  try {
    const { getIntent, refreshFromCrm, executeIntent } = await import('../../deferredGuidance.service.js');
    const currentIntent = await getIntent(tenantId, userPhone);

    if (currentIntent) {
      const refreshResult = await refreshFromCrm(tenantId, userPhone);

      if (refreshResult.allCollected) {
        console.log(`[Stage7] 🎯 Deferred guidance: ALL data collected! Auto-executing request_admin_guidance for ${userPhone}...`);
        const execResult = await executeIntent(tenantId, userPhone);
        if (execResult) {
          console.log(`[Stage7] ✅ Deferred guidance auto-executed: Request #${execResult.id} sent to System Guider`);
        }
      } else if (refreshResult.updated) {
        const missingLabels = refreshResult.missingFields.map(f => f.label).join(', ');
        console.log(`[Stage7] 📊 Deferred guidance progress: still missing [${missingLabels}] for ${userPhone}`);
      }
    }
  } catch (deferErr) {
    console.error('[Stage7] Deferred guidance auto-trigger error:', deferErr.message);
  }

  // ══════════════════════════════════════════════════════════════
  // 4c. PROGRAMMATIC OPEN QUESTION ANSWER DETECTION — Proactive Catch
  // ══════════════════════════════════════════════════════════════
  try {
    const currentLead = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
      select: { id: true, open_questions: true }
    });

    if (currentLead && Array.isArray(currentLead.open_questions) && currentLead.open_questions.length > 0) {
      const unanswered = currentLead.open_questions.filter(q => !q.answered);
      if (unanswered.length > 0) {
        console.log(`[Stage7] 🕵️ Unanswered open questions detected (${unanswered.length}). Running programmatic answer detector...`);
        const { executeFastJsonAI } = await import('../../logic.service.js');
        
        const detectionPrompt = `Kamu adalah AI validator jawaban customer. Baca pesan customer dan tentukan apakah pesan tersebut menjawab pertanyaan berikut:
PERTANYAAN:
${unanswered.map((q, idx) => `${idx + 1}. Key: "${q.key}", Pertanyaan: "${q.question}"`).join('\n')}

PESAN CUSTOMER:
"${userMessage}"

TUGAS: Untuk setiap pertanyaan di atas, periksa apakah pesan customer memberikan jawabannya.
Hanya deteksi jawaban yang VALID, SPESIFIK, dan JELAS. Jika tidak ada jawaban, biarkan answer_found false.

Output JSON format:
{
  "answers": [
    { "key": "key_pertanyaan", "answer_found": true, "answer_text": "Isi jawaban singkat" }
  ]
}`;

        const detectionResult = await executeFastJsonAI(tenantId, detectionPrompt, `USER MESSAGE:\n"${userMessage}"`, [], 'open_question_detector');
        
        if (detectionResult && Array.isArray(detectionResult.answers)) {
          let updatedQuestions = [...currentLead.open_questions];
          let anyAnswered = false;

          for (const ans of detectionResult.answers) {
            if (ans.answer_found && ans.answer_text) {
              const qIdx = updatedQuestions.findIndex(q => q.key === ans.key && !q.answered);
              if (qIdx !== -1) {
                updatedQuestions[qIdx].answered = true;
                updatedQuestions[qIdx].answer = ans.answer_text;
                anyAnswered = true;
                console.log(`[Stage7] 🎯 Programmatically detected answer for key "${ans.key}": "${ans.answer_text}"`);
                
                // Broadcast SSE for dashboard
                try {
                  const { broadcast } = await import('../../../shared/sse.service.js');
                  broadcast(tenantId, 'open_question_answered', {
                    phone: userPhone,
                    key: ans.key,
                    answer: ans.answer_text,
                    progress: `${updatedQuestions.filter(q => q.answered).length}/${updatedQuestions.length}`
                  });
                } catch (sseErr) {}
              }
            }
          }

          if (anyAnswered) {
            // Save updated questions to DB
            await prisma.lead.update({
              where: { id: currentLead.id },
              data: { open_questions: updatedQuestions }
            });

            const allAnswered = updatedQuestions.every(q => q.answered);
            if (allAnswered) {
              console.log(`[Stage7] ⚡ All open questions answered programmatically! Auto-completing open questions...`);
              const questions = updatedQuestions;
              const requestId = questions[0]?.request_id;
              const reportLines = questions.map(q => `- ${q.question}: ${q.answer}`).join('\n');
              const summary = `Semua pertanyaan dijawab oleh customer (auto-detected).`;

              if (requestId) {
                await prisma.systemGuiderChat.create({
                  data: {
                    tenant_id: tenantId,
                    request_id: requestId,
                    role: 'system',
                    message: `✅ Semua pertanyaan terjawab (Auto-detected)!\n\n${reportLines}`,
                    message_type: 'system'
                  }
                });

                await prisma.systemGuiderTodo.updateMany({
                  where: {
                    tenant_id: tenantId,
                    request_id: requestId,
                    todo_type: 'need_info',
                    status: 'awaiting_customer'
                  },
                  data: { status: 'info_received', result: summary, executed_at: new Date() }
                });

                await prisma.centralInfoRequest.update({
                  where: { id: requestId },
                  data: { status: 'info_received', updated_at: new Date() }
                });

                try {
                  const { broadcast } = await import('../../../shared/sse.service.js');
                  broadcast(tenantId, 'open_questions_completed', {
                    phone: userPhone,
                    request_id: requestId,
                    summary,
                    answers: questions
                  });
                } catch (sseErr) {}

                // Save to personal_notes & clear open_questions
                const note = `[Info dari customer (Auto-detect) ${new Date().toLocaleDateString('id-ID')}]: ${reportLines.substring(0, 500)}`;
                const existing = (await prisma.lead.findUnique({ where: { id: currentLead.id }, select: { personal_notes: true } }))?.personal_notes || '';
                await prisma.lead.update({
                  where: { id: currentLead.id },
                  data: {
                    personal_notes: (existing ? existing + '\n' + note : note).substring(0, 2000),
                    open_questions: []
                  }
                });
                console.log(`[Stage7] ✅ Open questions completed and cleared programmatically for ${userPhone}`);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Stage7] Programmatic open question detector error:', err.message);
  }

  // ══════════════════════════════════════════════════════════════
  // 5. LEGACY TAG SAFETY NETS (strip only, logic in tools)
  // ══════════════════════════════════════════════════════════════
  const formUpdateRegex = /\[ORDER_FORM_UPDATE:\s*([^\]]+)\]/gi;
  if (formUpdateRegex.test(finalReply)) {
    console.log('[Stage7] ORDER_FORM_UPDATE tag detected (legacy) — action handled by tool');
  }
  stripTag(formUpdateRegex);
  stripTag(/\[ORDER_FORM_CONFIRM\]/gi);
  stripTag(/\[ORDER_FORM_FINALIZE\]/gi);
  stripTag(/\[CUSTOMER_REQUEST:\s*([^\]]+)\]/gi);
  stripTag(/\[OFFER_DETECTED:\s*([^\]]+)\]/gi);

  // ══════════════════════════════════════════════════════════════
  // 6. DATE REQUEST TAGS (delegated to tagProcessor.dateRequest.js)
  // ══════════════════════════════════════════════════════════════
  await processDateTags(finalReply, ctx, stripTag);

  // ══════════════════════════════════════════════════════════════
  // 7. ANTI-HALLUCINATION (delegated to antiHallucination.js)
  // ══════════════════════════════════════════════════════════════
  const contextForVerify = (fullKbContextForVerify || kbContext) +
    (promoInstruction ? `\n\n[KONTEKS PROMOSI YANG DIBERIKAN KE AI]:\n${promoInstruction}` : '') +
    (ctx.longTermMemory ? `\n\n[RIWAYAT PERCAKAPAN DENGAN PELANGGAN — informasi dari sini VALID, bukan halusinasi]:\n${ctx.longTermMemory.substring(0, 3000)}` : '');

  // Skip anti-hallucination for trivial messages (name replies, greetings, confirmations)
  // These don't contain factual claims that need verification
  const trivialPatterns = /^([\w\s]{1,40})\s*(kak|ya|nih|dong|deh)?\.?\s*$/i;
  const isTrivialMessage = trivialPatterns.test(userMessage.trim()) || userMessage.trim().length < 30;

  if (!isTrivialMessage) {
    const verifyResult = await verifyAntiHallucination(tenantId, userMessage, finalReply, contextForVerify);
    if (!verifyResult.verified && verifyResult.correctedReply) {
      // SAFEGUARD: Only replace if corrected reply retains substantial content
      // Don't let anti-hallucination destroy multi-bubble conversational context
      const correctedLen = verifyResult.correctedReply.length;
      const originalLen = finalReply.length;
      
      if (correctedLen >= originalLen * 0.4) {
        console.warn(`[AntiHallucination] Applying correction (${originalLen} → ${correctedLen} chars). Violations:`, verifyResult.violations);
        finalReply = verifyResult.correctedReply;
        bubbles = finalReply.split(/\[NEXT\]/gi).map(b => b.trim()).filter(b => b.length > 0);
      } else {
        console.warn(`[AntiHallucination] ⚠️ Correction REJECTED — too short (${correctedLen} vs original ${originalLen}). Would destroy context. Violations:`, verifyResult.violations);
      }
    }
  } else {
    console.log(`[Stage7] Anti-hallucination skipped for trivial message: "${userMessage.substring(0, 50)}"`);
  }

  // ══════════════════════════════════════════════════════════════
  // 8. GHOST TIMER — CONVERSATION_INTENT tag
  // ══════════════════════════════════════════════════════════════
  const intentTagRegex = /\[CONVERSATION_INTENT:\s*(casual|serious)\s*\]/gi;
  const intentMatches = [...ctx.aiResponseContent.matchAll(intentTagRegex)];
  let detectedIntent = 'casual';

  if (intentMatches.length > 0) {
    const lastMatch = intentMatches[intentMatches.length - 1];
    detectedIntent = lastMatch[1].toLowerCase();
    console.log(`[Stage7] 🧠 Ghost Timer Intent: ${detectedIntent}`);
    armTimer(tenantId, userPhone, detectedIntent).catch(err =>
      console.error('[Stage7] armTimer failed:', err.message)
    );
  } else {
    armTimer(tenantId, userPhone, 'casual').catch(err =>
      console.error('[Stage7] armTimer failed:', err.message)
    );
    console.log('[Stage7] No CONVERSATION_INTENT tag found — defaulting to casual');
  }

  // ══════════════════════════════════════════════════════════════
  // 9. CATCH-ALL: Strip remaining internal/system tags
  // ══════════════════════════════════════════════════════════════
  const internalTagPatterns = [
    /UPDATE_ACTIVE_TOPICS:?\s*[^\n]*/gi,
    /\[SISTEM[:\s][^\]]*\]/gi,
    /\[REKOMENDASI KONSULTAN[^\]]*\]/gi,
    /\[NEXT\]/gi,
    /\[INTERNAL[^\]]*\]/gi,
    /\[DEBUG[^\]]*\]/gi,
    /\[AI_NOTE[^\]]*\]/gi,
    /\[ACTIVE_TOPICS?[^\]]*\]/gi,
    /\[BASIC_DATE_REQUEST:\s*[^\]]+\]/gi,
    /\[BASIC_DATE_CHANGED:\s*[^\]]+\]/gi,
    /\[CONVERSATION_INTENT:\s*[^\]]+\]/gi,
  ];
  for (const pattern of internalTagPatterns) {
    finalReply = finalReply.replace(pattern, '').trim();
    bubbles    = bubbles.map(b => b.replace(pattern, '').trim()).filter(b => b.length > 0);
  }

  // ── Clean excessive newlines ──────────────────────────────────
  finalReply = finalReply.replace(/\n{3,}/g, '\n\n').trim();
  bubbles    = bubbles.map(b => b.replace(/\n{3,}/g, '\n\n').trim()).filter(b => b.length > 0);

  // ══════════════════════════════════════════════════════════════
  // 9b. BUBBLE DEDUPLICATION — Prevent duplicate messages
  // ══════════════════════════════════════════════════════════════
  try {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const recentSent = await prisma.chatHistory.findMany({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: 'assistant',
        created_at: { gte: thirtySecondsAgo }
      },
      select: { message: true }
    });

    if (recentSent.length > 0) {
      const normalizedSent = recentSent.map(h => (h.message || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
      const originalCount = bubbles.length;
      
      bubbles = bubbles.filter(b => {
        const normBubble = b.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const isDuplicate = normalizedSent.includes(normBubble);
        if (isDuplicate) {
          console.log(`[Stage7] 🛡️ Deduplicated identical bubble sent recently: "${b}"`);
        }
        return !isDuplicate;
      });

      if (bubbles.length !== originalCount) {
        if (bubbles.length === 0) {
          // Revert to prevent empty response
          bubbles = ctx.multiBubbles
            ? ctx.multiBubbles.map(b => b.trim()).filter(b => b.length > 0)
            : finalReply.split(/\[NEXT\]/gi).map(b => b.trim()).filter(b => b.length > 0);
          console.warn('[Stage7] Deduplication filtered all bubbles. Reverted to prevent empty response.');
        } else {
          finalReply = bubbles.join('\n\n');
        }
      }
    }
  } catch (dedupErr) {
    console.error('[Stage7] Bubble deduplication error:', dedupErr.message);
  }

  // ── Deduplicate media ────────────────────────────────────────
  const uniqueUrls = [...new Set(ctx.docMediaUrls)];
  ctx.docMediaMeta = uniqueUrls.map(url => ctx.docMediaMeta.find(m => m.mediaUrl === url)).filter(Boolean);
  ctx.docMediaUrls = uniqueUrls;

  ctx.finalReply = finalReply;
  ctx.bubbles    = bubbles;

  // ── Stop Gatekeeper Agent (Agent 2) watcher ────────────────
  await stopWatching(tenantId, userPhone);
};
