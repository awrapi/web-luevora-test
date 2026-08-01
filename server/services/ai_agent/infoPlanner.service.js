/**
 * ================================================================
 * INFO PLANNER SERVICE — AI-Driven "Plan and Execute"
 * ================================================================
 * 
 * FLOW:
 *   1. PLAN: AI reads conversation + available data sources → creates a 
 *      structured list of "what information do I need?"
 *   2. EXECUTE: Each info item is fetched from the appropriate source:
 *      - package_docs → deep read PDF/document files via vector search
 *      - package_description → vector search on embedded descriptions
 *      - kb_docs → deep read KB document files
 *      - crm_history → search CRM event history
 *      - transaction_history → search past bookings/transactions
 *      - order_forms → search active/past order forms
 *      - general_knowledge → general vector search across all indexed data
 *   3. AGGREGATE: All results combined into enriched context
 *
 * This replaces the old keyword-based decomposition with pure AI reasoning.
 */

import prisma from '../../config/database.js';
import { executeFastJsonAI } from './logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { searchSemantic } from './vector.service.js';
import { documentReaderService } from './documentReader.service.js';

/**
 * STEP 1: AI PLANNING — Decide what information is needed
 * 
 * The AI reads the full conversation context and creates a structured list
 * of information needs, each with a source type and search query.
 */
const planInformationNeeds = async (tenantId, userMessage, chatHistorySnippet, availableSources = {}) => {
  try {
    // Build source descriptions dynamically based on what's available
    let sourceDesc = 'SUMBER DATA YANG TERSEDIA:\n';
    
    if (availableSources.hasPackages) {
      sourceDesc += '- "package_docs": ⭐ PRIORITAS UTAMA untuk HARGA & DETAIL TEKNIS. Dokumen PDF/file lampiran produk/layanan (berisi: TABEL HARGA DETAIL per unit/pax, harga per kategori/varian, kebijakan harga khusus, syarat & ketentuan lengkap, detail spesifikasi, inclusions/exclusions). WAJIB cari di sini jika pertanyaan tentang HARGA, TARIF, atau DETAIL TEKNIS PRODUK.\n';
      sourceDesc += '- "package_description": Deskripsi RINGKASAN teks produk/layanan (berisi: overview singkat, highlight, nama item). HANYA digunakan untuk pertanyaan UMUM seperti "ada produk apa", "ceritakan tentang X". JANGAN gunakan untuk pertanyaan harga — harga detail TIDAK ADA di sini.\n';
    }
    if (availableSources.hasKb) {
      sourceDesc += '- "kb_docs": Dokumen lampiran basis pengetahuan/SOP (berisi pedoman, FAQ, prosedur, kebijakan)\n';
    }
    if (availableSources.hasCrmHistory) {
      sourceDesc += '- "crm_history": Riwayat interaksi customer ini (perjalanan sebelumnya, preferensi, komplain, dll)\n';
    }
    sourceDesc += '- "transaction_history": Riwayat booking/transaksi customer ini (pesanan aktif, pembayaran, status)\n';
    sourceDesc += '- "order_forms": Formulir pesanan customer (data yang sudah dikumpulkan: nama, jumlah orang, tanggal, dll)\n';

    sourceDesc += '\n⚠️ ATURAN WAJIB PEMILIHAN SUMBER:\n';
    sourceDesc += '1. Jika customer bertanya tentang HARGA, TARIF, BIAYA, "berapa", "per pax", "per orang" → WAJIB gunakan "package_docs" (BUKAN package_description)\n';
    sourceDesc += '2. Jika customer bertanya tentang CHILD POLICY, tarif anak, usia anak → WAJIB gunakan "package_docs"\n';
    sourceDesc += '3. Jika customer bertanya tentang SYARAT, KETENTUAN, ATURAN → WAJIB gunakan "package_docs"\n';
    sourceDesc += '4. Jika customer bertanya tentang ITINERARY detail → gunakan "package_docs"\n';
    sourceDesc += '5. Hanya gunakan "package_description" untuk pertanyaan umum yang TIDAK menyangkut harga/aturan/detail teknis\n';

    const systemPrompt = `Kamu adalah AI perencana yang menganalisis percakapan dan menentukan informasi apa yang PERLU DICARI dari database/dokumen untuk menjawab pelanggan dengan LENGKAP dan AKURAT.

${sourceDesc}

TUGAS:
1. Baca SELURUH percakapan (chat history + pesan terbaru)
2. Tentukan apakah pesan ini BUTUH informasi dari sumber data (needs_info=true) atau hanya chat biasa/sapaan (needs_info=false)
3. Jika needs_info=true, buat LIST item informasi yang harus dicari

ATURAN REASONING:
- Untuk pesan follow-up ("bintang 3 aja", "oke yang itu"), kamu HARUS melihat konteks percakapan sebelumnya untuk memahami apa yang dimaksud
- Jika ada ANAK disebutkan di mana pun percakapan → WAJIB cari child policy/tarif anak
- Jika membahas HARGA → WAJIB cari tabel harga detail dari dokumen
- Jika customer pernah booking sebelumnya → pertimbangkan cari history
- Jika customer sedang mengisi form/pesan → cari data form yang sudah ada
- Setiap item harus punya search_query yang SPESIFIK (bukan umum)
- Maksimal 5 item

Output HANYA JSON valid:
{
  "needs_info": true/false,
  "reasoning": "penjelasan singkat mengapa info ini dibutuhkan",
  "items": [
    { "topic": "deskripsi singkat apa yang dicari", "source": "package_docs|package_description|kb_docs|crm_history|transaction_history|order_forms", "search_query": "frasa pencarian spesifik" }
  ]
}

Jika needs_info=false, items boleh kosong [].`;

    const prompt = `Percakapan Sebelumnya:\n${chatHistorySnippet || '(tidak ada)'}\n\nPesan Pelanggan Terbaru: "${userMessage}"`;

    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'info_planner');
    
    if (result && typeof result.needs_info === 'boolean') {
      const items = Array.isArray(result.items) ? result.items.slice(0, 5) : [];
      console.log(`[InfoPlanner] 🧠 AI Plan: needs_info=${result.needs_info}, ${items.length} item(s)`);
      if (result.reasoning) console.log(`[InfoPlanner] 💡 Reasoning: ${result.reasoning}`);
      
      for (const item of items) {
        console.log(`[InfoPlanner]   → [${item.source}] "${item.topic}" → search: "${item.search_query}"`);
      }
      
      return { needsInfo: result.needs_info, items, reasoning: result.reasoning || '' };
    }
  } catch (err) {
    console.error('[InfoPlanner] Planning failed:', err.message);
  }

  // Fallback: assume info needed, generic search
  return { needsInfo: true, items: [{ topic: 'informasi umum', source: 'package_description', search_query: userMessage }], reasoning: 'fallback' };
};


/**
 * STEP 2: EXECUTE PLAN — Fetch each info item from the appropriate source
 */
const executeInfoPlan = async (tenantId, userPhone, infoPlan, sourceData = {}) => {
  const { packages, kbs, mediaSendHistory, isMediaReRequest } = sourceData;
  const results = [];
  const mediaUrls = [];
  const mediaMeta = [];

  for (const item of infoPlan.items) {
    const startTime = Date.now();
    console.log(`[InfoPlanner] 🔍 Executing: [${item.source}] "${item.search_query}"`);

    try {
      let result = null;

      switch (item.source) {
        // ── Package Documents (PDFs) ────────────────────────────
        case 'package_docs': {
          if (!packages || packages.length === 0) break;
          const selectedFileIds = await documentReaderService.evaluateContextNeed(tenantId, item.search_query, packages, '');
          if (selectedFileIds.length > 0) {
            const readResult = await documentReaderService.deepReadDocumentFiles(
              tenantId, userPhone, packages[0].id, selectedFileIds, item.search_query
            );
            if (readResult.found && readResult.answer) {
              result = { found: true, answer: readResult.answer, source: 'package_docs' };
              if (readResult.mediaFiles) {
                const { checkMediaAllowed } = await import('../shared/mediaDedup.service.js');
                for (const file of readResult.mediaFiles) {
                  // Gunakan mediaKey yang sama dengan tagProcessor agar dedup lintas-stage berfungsi
                  const mediaKey = `ctx:package:${file.context_id || 'unknown'}:file:${file.id}`;
                  const dedupCheck = checkMediaAllowed(mediaSendHistory, mediaKey, isMediaReRequest, file.updated_at);
                  if (dedupCheck.allowed) {
                    mediaUrls.push(file.mediaUrl);
                    mediaMeta.push({ 
                      mediaKey, 
                      description: 'Dokumen produk/layanan', 
                      filename: file.filename,
                      fileUpdatedAt: file.updated_at, 
                      mediaUrl: file.mediaUrl, 
                      mediaSummary: file.ai_summary 
                    });
                  } else {
                    console.log(`[InfoPlanner] Media dedup blocked auto-attach for file ${file.filename}: ${dedupCheck.reason}`);
                  }
                }
              }
            }
          }
          break;
        }

        // ── Package Description (embedded text) ─────────────────
        case 'package_description': {
          if (!packages || packages.length === 0) break;
          const allChunks = [];
          for (const pkg of packages) {
            try {
              const vectorResult = await embeddingService.searchByEmbedding(tenantId, 'basic_package', pkg.id, item.search_query, 3);
              if (vectorResult.found && vectorResult.chunks.length > 0) {
                for (const chunk of vectorResult.chunks) {
                  allChunks.push({ text: chunk.text, packageName: pkg.package_name });
                }
              }
            } catch (e) { /* skip */ }
          }
          if (allChunks.length > 0) {
            result = {
              found: true,
              answer: allChunks.map(c => `[${c.packageName}] ${(c.text || '').trim()}`).join('\n'),
              source: 'package_description'
            };
          }
          break;
        }

        // ── KB Documents ────────────────────────────────────────
        case 'kb_docs': {
          if (!kbs || kbs.length === 0) break;
          const selectedFileIds = await documentReaderService.evaluateKbContextNeed(tenantId, item.search_query, kbs, '');
          if (selectedFileIds.length > 0) {
            const kbId = kbs[0].id;
            const readResult = await documentReaderService.deepReadKbDocumentFiles(tenantId, userPhone, kbId, selectedFileIds, item.search_query);
            if (readResult.found && readResult.answer) {
              result = { found: true, answer: readResult.answer, source: 'kb_docs' };
              if (readResult.mediaFiles) {
                const { checkMediaAllowed } = await import('../shared/mediaDedup.service.js');
                for (const file of readResult.mediaFiles) {
                  const mediaKey = `ctx:kb:${file.context_id || 'unknown'}:file:${file.id}`;
                  const dedupCheck = checkMediaAllowed(mediaSendHistory, mediaKey, isMediaReRequest, file.updated_at);
                  if (dedupCheck.allowed) {
                    mediaUrls.push(file.mediaUrl);
                    mediaMeta.push({ 
                      mediaKey, 
                      description: 'Dokumen basis pengetahuan', 
                      filename: file.filename, 
                      fileUpdatedAt: file.updated_at, 
                      mediaUrl: file.mediaUrl, 
                      mediaSummary: file.ai_summary 
                    });
                  }
                }
              }
            }
          }
          break;
        }

        // ── CRM History ─────────────────────────────────────────
        case 'crm_history': {
          if (!userPhone) break;
          const historyIds = await searchSemantic(tenantId, item.search_query, 'CustomerCrmHistory', 5, { phone: { $eq: userPhone } });
          if (historyIds && historyIds.length > 0) {
            const records = await prisma.customerCrmHistory.findMany({
              where: { tenant_id: tenantId, id: { in: historyIds.map(id => parseInt(id)) } },
              orderBy: { created_at: 'desc' }
            });
            if (records.length > 0) {
              result = {
                found: true,
                answer: records.map(h => `[${h.created_at.toISOString().split('T')[0]}] ${h.event_type}: ${h.event_detail}`).join('\n'),
                source: 'crm_history'
              };
            }
          }
          break;
        }

        // ── Transaction / Booking History ────────────────────────
        case 'transaction_history': {
          if (!userPhone) break;
          const bookings = await prisma.travelBooking.findMany({
            where: { tenant_id: tenantId, phone: userPhone },
            orderBy: { created_at: 'desc' },
            take: 5,
            select: { id: true, package_name: true, pax_count: true, total_price: true, status: true, payment_status: true, booking_code: true, created_at: true, special_request: true }
          });
          const transactions = await prisma.transaction.findMany({
            where: { tenant_id: tenantId, user_phone: userPhone },
            orderBy: { created_at: 'desc' },
            take: 5,
            select: { order_id: true, customer_name: true, destination: true, pax_count: true, total_price: true, status: true, created_at: true }
          });
          const combined = [];
          if (bookings.length > 0) {
            combined.push('BOOKING HISTORY:\n' + bookings.map(b => 
              `- [${b.created_at.toISOString().split('T')[0]}] ${b.package_name} | ${b.pax_count} pax | Rp ${b.total_price} | Status: ${b.status} | Bayar: ${b.payment_status} | Kode: ${b.booking_code}`
            ).join('\n'));
          }
          if (transactions.length > 0) {
            combined.push('TRANSACTION HISTORY:\n' + transactions.map(t =>
              `- [${t.created_at.toISOString().split('T')[0]}] ${t.destination || '-'} | ${t.pax_count} pax | Rp ${t.total_price} | Status: ${t.status} | Order: ${t.order_id}`
            ).join('\n'));
          }
          if (combined.length > 0) {
            result = { found: true, answer: combined.join('\n\n'), source: 'transaction_history' };
          }
          break;
        }

        // ── Order Forms ─────────────────────────────────────────
        case 'order_forms': {
          if (!userPhone) break;
          const forms = await prisma.orderForm.findMany({
            where: { tenant_id: tenantId, phone: userPhone },
            orderBy: { updated_at: 'desc' },
            take: 3
          });
          if (forms.length > 0) {
            const formTexts = forms.map(f => {
              const data = JSON.parse(f.form_data || '{}');
              const fields = Object.entries(data).map(([k, v]) => `  ${k}: ${v}`).join('\n');
              return `Form #${f.id} (${f.status}) — updated: ${f.updated_at.toISOString().split('T')[0]}\n${fields}`;
            });
            result = { found: true, answer: formTexts.join('\n\n'), source: 'order_forms' };
          }
          break;
        }

        default:
          console.warn(`[InfoPlanner] Unknown source: ${item.source}`);
      }

      const elapsed = Date.now() - startTime;
      if (result && result.found) {
        console.log(`[InfoPlanner] ✅ Found [${item.source}] "${item.topic}" (${elapsed}ms)`);
        results.push({ ...item, result });
      } else {
        console.log(`[InfoPlanner] ❌ Not found [${item.source}] "${item.topic}" (${elapsed}ms)`);
      }
    } catch (err) {
      console.error(`[InfoPlanner] Error executing [${item.source}]:`, err.message);
    }
  }

  return { results, mediaUrls, mediaMeta };
};


/**
 * STEP 3: AGGREGATE — Combine all results into enriched context
 */
const aggregateResults = (executionResults) => {
  if (executionResults.results.length === 0) return '';

  const sections = {
    package_docs: [],
    package_description: [],
    kb_docs: [],
    crm_history: [],
    transaction_history: [],
    order_forms: [],
  };

  for (const item of executionResults.results) {
    const source = item.result.source;
    if (sections[source]) {
      sections[source].push(item.result.answer);
    }
  }

  let aggregated = '';

  if (sections.package_docs.length > 0) {
    aggregated += `\n\n=== JAWABAN DARI DOKUMEN PRODUK/LAYANAN ===\n${sections.package_docs.join('\n\n')}\n`;
  }
  if (sections.package_description.length > 0) {
    aggregated += `\n\n=== DETAIL DARI DESKRIPSI PAKET ===\n${sections.package_description.join('\n\n')}\n`;
  }
  if (sections.kb_docs.length > 0) {
    aggregated += `\n\n=== JAWABAN DARI DOKUMEN BASIS PENGETAHUAN ===\nKamu telah menemukan referensi dari pedoman/SOP. Detail:\n${sections.kb_docs.join('\n\n')}\n`;
  }
  if (sections.crm_history.length > 0) {
    aggregated += `\n\n=== RIWAYAT CRM PELANGGAN ===\n${sections.crm_history.join('\n\n')}\n`;
  }
  if (sections.transaction_history.length > 0) {
    aggregated += `\n\n=== RIWAYAT TRANSAKSI/BOOKING PELANGGAN ===\n${sections.transaction_history.join('\n\n')}\n`;
  }
  if (sections.order_forms.length > 0) {
    aggregated += `\n\n=== DATA FORMULIR PESANAN PELANGGAN ===\n${sections.order_forms.join('\n\n')}\n`;
  }

  return aggregated;
};


/**
 * PUBLIC API: Full Plan-and-Execute pipeline
 */
export const infoPlannerService = {
  planInformationNeeds,
  executeInfoPlan,
  aggregateResults,

  /**
   * One-call convenience: plan → execute → aggregate
   */
  async planAndExecute(tenantId, userPhone, userMessage, chatHistorySnippet, sourceData) {
    const availableSources = {
      hasPackages: sourceData.packages && sourceData.packages.length > 0,
      hasKb: sourceData.kbs && sourceData.kbs.length > 0,
      hasCrmHistory: true, // always available
    };

    // STEP 1: Plan
    const plan = await planInformationNeeds(tenantId, userMessage, chatHistorySnippet, availableSources);
    
    if (!plan.needsInfo || plan.items.length === 0) {
      console.log('[InfoPlanner] No info needed — skipping execution');
      return { context: '', mediaUrls: [], mediaMeta: [], plan };
    }

    // STEP 2: Execute
    const executionResults = await executeInfoPlan(tenantId, userPhone, plan, sourceData);

    // STEP 3: Aggregate
    const context = aggregateResults(executionResults);

    console.log(`[InfoPlanner] ✅ Complete: ${executionResults.results.length}/${plan.items.length} items found, ${context.length} chars context`);

    return {
      context,
      mediaUrls: executionResults.mediaUrls,
      mediaMeta: executionResults.mediaMeta,
      plan,
    };
  }
};
