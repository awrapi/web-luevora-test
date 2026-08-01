import prisma from '../../config/database.js';
import { executeFastJsonAI } from './logic.service.js';
import { advancedPackageService } from '../travel/advancedPackage.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';

/**
 * ================================================================
 * MERGED RAG ANALYSIS — analyzeAndMatch()
 * ================================================================
 * Combines intent analysis + index matching into a SINGLE LLM call.
 * Previously this was 2 sequential calls (analyzeIntent → matchIndexes).
 *
 * Input:  user message, chat history, available KB/package indexes
 * Output: { intent, selectedKbIds, selectedPackageIds }
 */
export const analyzeAndMatch = async (tenantId, userMessage, chatHistorySnippet, kbIndexes = [], basicPackageIndexes = [], advPackageIndexes = []) => {
  // Build available index lists for the prompt
  let indexSection = '';
  
  if (kbIndexes.length > 0) {
    indexSection += `\nAvailable Knowledge Base:\n${kbIndexes.map(kb => `ID: KB_${kb.id} | Title: ${kb.title}`).join('\n')}`;
  }
  
  const allPackages = [];
  if (basicPackageIndexes.length > 0) {
    basicPackageIndexes.forEach(pkg => allPackages.push(`ID: BASIC_${pkg.id} | Title: ${pkg.package_name}`));
  }
  if (advPackageIndexes.length > 0) {
    advPackageIndexes.forEach(pkg => allPackages.push(`ID: ADV_${pkg.id} | Title: ${pkg.title}`));
  }
  if (allPackages.length > 0) {
    indexSection += `\nAvailable Travel Packages:\n${allPackages.join('\n')}`;
  }

  const hasIndexes = kbIndexes.length > 0 || allPackages.length > 0;

  const systemPrompt = `You are a reasoning + index matching engine for a CRM assistant.
Do TWO tasks in ONE response:

TASK 1 — INTENT ANALYSIS:
Analyze the user's message and chat history. Decide what data sources are needed:
- "needsKB": true if user asks about rules, SOPs, refund policies, FAQs, or general info
- "needsPackages": true if user asks about products, services, prices, specifications, details, or catalog items
- "needsBank": true if user asks about payment/transfer/bank accounts
- "needsPromote": true ONLY if user actively asks for recommendations (NOT on greetings)
- "needsCrmHistory": true if personalization based on past interactions would help
- "isMediaReRequest": true if user explicitly asks to resend a photo/brochure/document

CRITICAL — FOLLOW-UP QUESTIONS:
If chat history shows discussion about a specific product/service, and user asks a follow-up (price, schedule, details, "oh gitu", "oke jadi?"), set needsPackages=true even if the word "paket" or "produk" isn't in the message.

TASK 2 — INDEX MATCHING (only if needsKB or needsPackages is true):
From the available indexes below, select which specific IDs to fetch. Max 5 total.
If user asks for a list/catalog, select ALL relevant (up to 5).
${hasIndexes ? indexSection : '(No indexes available — return empty arrays)'}

Return ONLY this JSON:
{
  "needsKB": true/false,
  "needsPackages": true/false,
  "needsBank": true/false,
  "needsPromote": true/false,
  "needsCrmHistory": true/false,
  "isMediaReRequest": true/false,
  "selectedKbIds": [number, number],
  "selectedPackageIds": ["BASIC_1", "ADV_2"]
}
Note: selectedPackageIds MUST include the prefix (BASIC_ or ADV_). Return empty arrays if no matching needed.`;

  const prompt = `Chat History:\n${chatHistorySnippet}\n\nUser Message: ${userMessage}`;
  
  const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'rag_search');
  
  const defaults = {
    needsKB: false, needsPackages: false, needsBank: false,
    needsPromote: false, needsCrmHistory: false, isMediaReRequest: false,
    selectedKbIds: [], selectedPackageIds: []
  };
  
  if (!result) return defaults;

  return {
    needsKB: result.needsKB || false,
    needsPackages: result.needsPackages || false,
    needsBank: result.needsBank || false,
    needsPromote: result.needsPromote || false,
    needsCrmHistory: result.needsCrmHistory || false,
    isMediaReRequest: result.isMediaReRequest || false,
    selectedKbIds: Array.isArray(result.selectedKbIds) ? result.selectedKbIds : [],
    selectedPackageIds: Array.isArray(result.selectedPackageIds) ? result.selectedPackageIds : [],
  };
};

/**
 * Legacy wrapper: analyzeIntent()
 * Kept for backward compatibility. Calls analyzeAndMatch internally.
 */
export const analyzeIntent = async (tenantId, userMessage, chatHistorySnippet) => {
  const result = await analyzeAndMatch(tenantId, userMessage, chatHistorySnippet);
  return {
    needsKB: result.needsKB,
    needsPackages: result.needsPackages,
    needsBank: result.needsBank,
    needsPromote: result.needsPromote,
    needsCrmHistory: result.needsCrmHistory,
    isMediaReRequest: result.isMediaReRequest,
  };
};

/**
 * Legacy wrapper: matchIndexes()
 * Kept for backward compatibility. Now a no-op since analyzeAndMatch does both.
 */
export const matchIndexes = async (tenantId, userMessage, chatHistorySnippet, kbIndexes, basicPackageIndexes, advPackageIndexes) => {
  // This is now handled by analyzeAndMatch in stage4
  // If called directly (legacy), do the full combined call
  const result = await analyzeAndMatch(tenantId, userMessage, chatHistorySnippet, kbIndexes, basicPackageIndexes, advPackageIndexes);
  return {
    selectedKbIds: result.selectedKbIds,
    selectedPackageIds: result.selectedPackageIds,
  };
};

import { searchSemantic } from './vector.service.js';

/**
 * Stage 3: Deep Fetch
 * Retrieves the full content of the selected IDs and formats them for the final prompt.
 */
export const fetchDeepContent = async (tenantId, selectedKbIds, selectedBasicPackageIds, selectedAdvPackageIds, needsBank, userPhone = '', needsPromote = false, userMessage = '', needsCrmHistory = false, activeTopics = null, decomposedQueries = null) => {
  let kbContext = '';
  let promotedPackageId = null;
  let promotedPackageTitle = null;
  let promotedPackageType = null;
  let crmHistoryContext = '';

  // FETCH PROMOTED PACKAGES
  if (needsPromote) {
    const promotedPackagesSetting = await prisma.globalSetting.findUnique({
      where: {
        uk_tenant_setting: {
          tenant_id: tenantId,
          setting_key: 'promoted_packages'
        }
      }
    });

    if (promotedPackagesSetting && promotedPackagesSetting.setting_value) {
      try {
        const promotedData = JSON.parse(promotedPackagesSetting.setting_value);
        if (Array.isArray(promotedData) && promotedData.length > 0) {
          let selectedPromoted = null;

          if (promotedData.length === 1) {
            selectedPromoted = promotedData[0];
          } else if (userMessage) {
            // Intelligent Selection based on User Message
            const systemPrompt = `Kamu adalah AI pemilih prioritas promosi. Pelanggan baru saja mengirim pesan: "${userMessage}".
Tugasmu adalah memilih 1 promosi dari daftar di bawah ini yang paling MASUK AKAL dan COCOK dengan konteks obrolan pelanggan.
Daftar Promosi:
${promotedData.map((p, idx) => `[ID: ${idx}] ${p.title}`).join('\n')}

ATURAN LOGIKA WAJIB:
- Pilih promosi yang paling relevan dengan ketertarikan, produk, atau layanan yang sedang dibahas pelanggan.
- Jika tidak ada yang nyambung 100%, pilih yang paling mendekati secara logis.

KEMBALIKAN HANYA JSON: {"selectedIndex": <angka_id>}
Contoh: {"selectedIndex": 0}`;

            try {
              const aiResult = await executeFastJsonAI(tenantId, systemPrompt, `Pesan user: "${userMessage}"`, [], 'rag_promo');
              if (aiResult && typeof aiResult.selectedIndex === 'number' && promotedData[aiResult.selectedIndex]) {
                selectedPromoted = promotedData[aiResult.selectedIndex];
                console.log(`[RAG Smart Promo] AI memilih index ${aiResult.selectedIndex}: ${selectedPromoted.title}`);
              }
            } catch (e) {
              console.log('[RAG Smart Promo] Evaluasi AI gagal, fallback ke hash.');
            }
          }

          // Fallback if AI fails or userMessage is empty
          if (!selectedPromoted) {
            if (userMessage) {
              const msgLower = userMessage.toLowerCase();
              if (msgLower.includes('sewa') || msgLower.includes('rental')) {
                selectedPromoted = promotedData.find(p => p.title.toLowerCase().includes('sewa') || p.title.toLowerCase().includes('rental'));
              } else if (msgLower.includes('paket') || msgLower.includes('produk') || msgLower.includes('layanan')) {
                selectedPromoted = promotedData.find(p => !p.title.toLowerCase().includes('sewa') && !p.title.toLowerCase().includes('rental'));
              }
            }

            if (!selectedPromoted) {
              // Deterministic random selection based on userPhone
              let hash = 0;
              for (let i = 0; i < userPhone.length; i++) {
                hash = userPhone.charCodeAt(i) + ((hash << 5) - hash);
              }
              const index = Math.abs(hash) % promotedData.length;
              selectedPromoted = promotedData[index];
              console.log(`[RAG Smart Promo] Fallback hash terpilih index ${index}: ${selectedPromoted.title}`);
            } else {
              console.log(`[RAG Smart Promo] Fallback kata kunci terpilih: ${selectedPromoted.title}`);
            }
          }
          
          if (selectedPromoted && selectedPromoted.title) {
            promotedPackageId = selectedPromoted.id;
            promotedPackageTitle = selectedPromoted.title;
            promotedPackageType = selectedPromoted.type || 'basic';
            // The instruction is now moved to the very end of the prompt in langchain.service.js
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }
  
  // Parse IDs to ensure they are integers (extract only numbers in case AI returns "PKG_5" or "KB_1")
  const parseIds = (ids) => {
    if (!Array.isArray(ids)) return [];
    return ids.map(id => parseInt(String(id).replace(/\D/g, ''))).filter(n => !isNaN(n));
  };

  const cleanKbIds = parseIds(selectedKbIds);
  
  // Extract numeric IDs from BASIC_x and ADV_x strings (already handled by caller, but we parse here just in case)
  const cleanBasicPackageIds = selectedBasicPackageIds.map(id => parseInt(String(id).replace(/\D/g, ''))).filter(n => !isNaN(n));
  const cleanAdvPackageIds = selectedAdvPackageIds.map(id => parseInt(String(id).replace(/\D/g, ''))).filter(n => !isNaN(n));

  // Fetch KB contents
  let fetchedKbs = [];
  if (cleanKbIds.length > 0) {
    fetchedKbs = await prisma.knowledgeBase.findMany({
      where: { tenant_id: tenantId, id: { in: cleanKbIds } },
      include: { media_contexts: true }
    });
    if (fetchedKbs.length > 0) {
      kbContext += '=== RELEVANT KNOWLEDGE BASE ===\n';
      kbContext += fetchedKbs.map(kb => {
        let str = `Title: ${kb.title}\nContent: ${kb.content_text}\nContext: ${kb.ai_context}`;
        // Lampiran langsung (media_path) — kirim jika allow_send_media aktif
        if (kb.allow_send_media && kb.media_path) {
          str += `\n[LAMPIRAN FILE KB]: Topik ini memiliki file lampiran. Jika pertanyaan pelanggan relevan dengan topik ini, tambahkan tag ini SEKALI di akhir balasanmu (JANGAN ganti nama file — sistem akan kirim otomatis dengan nama asli dari admin): [SEND_MEDIA_DIRECT:${kb.media_path}]`;
        }
        if (kb.media_contexts && kb.media_contexts.length > 0) {
          str += `\n[MEDIA PENDUKUNG KB — ATURAN KIRIM DOKUMEN: (1) Gunakan tag PERSIS tanpa modifikasi, (2) Taruh di akhir balasan, (3) Kirim dokumen sesuai kebutuhan — tidak ada batasan jumlah, putuskan berdasarkan relevansi dan apa yang diminta pelanggan, (4) Satu tag = semua file dalam context itu akan dikirim ke pelanggan, (5) Jangan kirim dokumen yang tidak relevan dengan pertanyaan atau situasi saat ini. Contoh: [SEND_MEDIA_CTX:KB:1]]:\n` + kb.media_contexts.map(ctx => `- Tag: [SEND_MEDIA_CTX:KB:${ctx.id}] | Label: "${ctx.context_label}" | Update: ${ctx.updated_at.toISOString().split('T')[0]} | Info: ${ctx.ai_summary}`).join('\n');
        }
        return str;
      }).join('\n\n') + '\n\n';
    }
  }

  // Fetch Basic Package contents
  let pkgs = [];
  if (cleanBasicPackageIds.length > 0) {
    pkgs = await prisma.travelPackage.findMany({
      where: { tenant_id: tenantId, id: { in: cleanBasicPackageIds } },
      include: { media_contexts: true }
    });
    if (pkgs.length > 0) {
      kbContext += '=== RELEVANT PRODUCTS/SERVICES ===\n';
      
      // Build context for each package + vector search for deep details
      const packageContexts = await Promise.all(pkgs.map(async (pkg) => {
        const hasDetailDocs = pkg.media_contexts && pkg.media_contexts.length > 0;
        const priceInfo = pkg.price && parseFloat(pkg.price) > 0 ? `Rp ${parseFloat(pkg.price).toLocaleString('id-ID')}` : 'Hubungi admin';
        let str = `- Nama Item (EXACT): ${pkg.package_name}\n  Deskripsi: ${pkg.description}\n  Harga Patokan: ${priceInfo}`;
        // If price is 0 but has document attachments, note that detailed pricing is in docs
        if ((!pkg.price || parseFloat(pkg.price) <= 0) && hasDetailDocs) {
          str += `\n  ⚠️ CATATAN HARGA: Harga patokan di sistem belum diisi, NAMUN informasi harga detail (termasuk tarif per unit/orang, kebijakan harga, varian kustom) TERSEDIA di dokumen lampiran produk ini. Jika ada hasil dari "JAWABAN DARI DOKUMEN PRODUK/LAYANAN", gunakan data harga dari sana sebagai sumber yang VALID dan AKURAT.`;
        }
        if (pkg.min_pax && pkg.min_pax > 1) {
          str += `\n  ⚠️ Minimum Peserta/Kuantitas (min_quantity): ${pkg.min_pax} unit — WAJIB DIBERITAHUKAN ke pelanggan!`;
        }
        if (pkg.max_pax && pkg.max_pax < 100) {
          str += `\n  Maksimum Peserta/Kuantitas (max_quantity): ${pkg.max_pax} unit`;
        }
        if (pkg.media_contexts && pkg.media_contexts.length > 0) {
          str += `\n  [MEDIA PENDUKUNG ITEM — ATURAN KIRIM DOKUMEN: (1) Gunakan tag PERSIS tanpa modifikasi, (2) Taruh di akhir balasan, (3) Kirim dokumen sesuai kebutuhan — tidak ada batasan jumlah, putuskan berdasarkan relevansi dan apa yang diminta pelanggan, (4) Satu tag = semua file dalam context itu akan dikirim ke pelanggan, (5) Jangan kirim dokumen yang tidak relevan dengan pertanyaan atau situasi saat ini. Contoh: [SEND_MEDIA_CTX:PACKAGE:1]]:\n` + pkg.media_contexts.map(ctx => `    - Tag: [SEND_MEDIA_CTX:PACKAGE:${ctx.id}] | Label: "${ctx.context_label}" | Update: ${ctx.updated_at.toISOString().split('T')[0]} | Info: ${ctx.ai_summary}`).join('\n');
        }

        // Vector search on embedded description chunks for question-specific details
        if (userMessage) {
          try {
            const vectorResult = await embeddingService.searchByEmbedding(tenantId, 'basic_package', pkg.id, userMessage, 3);
            if (vectorResult.found && vectorResult.chunks.length > 0) {
              str += `\n  [DEEP READ — Detail relevan dari embedding vektor]:\n`;
              str += vectorResult.chunks.map(c => `    → ${(c.text || '').trim()}`).join('\n');
              console.log(`[RAG] Basic package ${pkg.id} vector search: ${vectorResult.chunks.length} relevant chunks found`);
            }
          } catch (embedErr) {
            console.warn(`[RAG] Basic package ${pkg.id} vector search failed:`, embedErr.message);
          }
        }

        return str;
      }));

      kbContext += packageContexts.join('\n\n') + '\n\n';
    }
  }

  // Fetch Bank info if needed
  let bankInfo = '';
  if (needsBank) {
    const banks = await prisma.bankAccount.findMany({ where: { tenant_id: tenantId } });
    if (banks.length > 0) {
      bankInfo = banks.map(b => `- Bank ${b.bank_name}: ${b.account_number} (a.n ${b.account_holder})`).join('\n');
    } else {
      bankInfo = 'Belum ada rekening bank yang dikonfigurasi.';
    }
  }

  // Fetch advanced package context (slot-aware)
  let advContext = '';
  if (cleanAdvPackageIds.length > 0) {
    try {
      const advancedPkgs = await prisma.advancedTravelPackage.findMany({
        where: { tenant_id: tenantId, id: { in: cleanAdvPackageIds } },
        select: { id: true, package_type: true }
      });
      
      const advPromises = advancedPkgs.map(pkg => advancedPackageService.buildAIContext(tenantId, pkg.package_type, pkg.id));
      const advCtxResults = await Promise.all(advPromises);
      
      advContext = advCtxResults.map(res => res && res.text ? res.text : res).filter(Boolean).join('\n\n');
      var advStructuredData = advCtxResults.map(res => res && res.structured ? res.structured : null).filter(Boolean);
    } catch (e) {
      console.error('[RAG] Advanced package context error:', e.message);
    }
  }

  // Merge advanced context into kbContext
  if (advContext.trim()) {
    kbContext += '\n\n' + advContext.trim();
  }

  // Fetch CRM History via Redis Vector Search
  if (needsCrmHistory && userPhone) {
    console.log(`[RAG] Fetching CRM History from Redis for ${userPhone}...`);
    try {
      // Query semantic search with filter phone = userPhone and type = CustomerCrmHistory
      // We pass the userMessage as the semantic query to find the most relevant history
      const historyIds = await searchSemantic(tenantId, userMessage || 'history perjalanan trip', 'CustomerCrmHistory', 3, { phone: { $eq: userPhone } });
      
      if (historyIds && historyIds.length > 0) {
        // Fetch the actual records from DB based on returned IDs
        const historyRecords = await prisma.customerCrmHistory.findMany({
          where: { tenant_id: tenantId, id: { in: historyIds.map(id => parseInt(id)) } },
          orderBy: { created_at: 'desc' }
        });
        
        if (historyRecords.length > 0) {
          crmHistoryContext = '=== RIWAYAT CRM PELANGGAN (DARI VECTOR DB) ===\n';
          crmHistoryContext += historyRecords.map(h => 
            `- [${h.created_at.toISOString().split('T')[0]}] Tipe: ${h.event_type} | Detail: ${h.event_detail}`
          ).join('\n') + '\n\n';
          console.log(`[RAG] Ditemukan ${historyRecords.length} history CRM relevan via Redis.`);
        }
      }
    } catch (e) {
      console.error('[RAG] Error fetching CRM History from Redis:', e.message);
    }
  }

  if (crmHistoryContext.trim()) {
    kbContext = crmHistoryContext + '\n\n' + kbContext;
  }

  return { kbContext: kbContext.trim() || 'Tidak ada data produk/informasi bisnis spesifik yang relevan.', bankInfo, packages: pkgs || [], kbs: fetchedKbs || [], promotedPackageId, promotedPackageTitle, promotedPackageType, advStructuredData: typeof advStructuredData !== 'undefined' ? advStructuredData : [] };
};

/**
 * Stage 2.5: Field Relevance Reasoning
 * After fetching full package context, AI decides which sections are relevant.
 * This reduces noise and ensures the final prompt is focused.
 */
export const filterFieldRelevance = async (tenantId, userMessage, chatHistorySnippet, rawPackageContext, advStructuredData = []) => {
  // Skip if context is empty or very short
  if (!rawPackageContext || rawPackageContext.length < 100) {
    return rawPackageContext;
  }

  const systemPrompt = `Kamu adalah AI filter konteks. Tugasmu menganalisis pertanyaan pelanggan dan memutuskan bagian mana dari data produk/layanan yang RELEVAN untuk menjawab.

Kategori field yang tersedia dalam data produk/layanan:
1. "deskripsi" — Nama, deskripsi, konteks/summary produk
2. "jadwal" — Jadwal pelaksanaan/pengiriman, tanggal tersedia, availability
3. "harga" — Harga, diskon, price override
4. "slot" — Ketersediaan kuantitas/slot, kapasitas
5. "sub_paket" — Varian/pilihan produk beserta detailnya
6. "addon" — Tambahan/addons yang tersedia
7. "status" — Status hari ini (tersedia/tidak)

Aturan:
- Jika pelanggan bertanya SPESIFIK (misal "tanggal berapa?", "berapa harganya?") → pilih HANYA field yang relevan
- Jika pelanggan minta info umum / promosi / bertanya "ceritain" → pilih SEMUA field
- Jika pelanggan bertanya tentang PERBEDAAN, VARIAN, REGULER, PILIHAN antar varian/opsi → WAJIB sertakan "sub_paket" dan "deskripsi"
- Jika ragu, lebih baik sertakan daripada tidak

Kembalikan HANYA JSON: { "relevantFields": ["deskripsi", "jadwal", ...], "reason": "singkat" }`;

  const prompt = `Chat History:\n${chatHistorySnippet}\n\nPertanyaan Pelanggan: ${userMessage}\n\nData Paket yang Tersedia:\n${rawPackageContext.substring(0, 500)}...`;

  try {
    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'rag_filter');
    
    if (!result || !Array.isArray(result.relevantFields) || result.relevantFields.length === 0) {
      console.log('[RAG] Field filter: gagal/kosong, pakai semua data');
      return rawPackageContext;
    }

    // 1. SAFEGUARD VARIAN/PILIHAN -> Wajib: sub_paket & deskripsi
    let fields = result.relevantFields;
    const combinedText = `${userMessage} ${chatHistorySnippet}`.toLowerCase();
    
    const isAskingVariants = /perbedaan|beda|vip|vvip|reguler|pilihan|varian|mana yang|bedanya|difference|which one/.test(combinedText);
    if (isAskingVariants) {
      if (!fields.includes('sub_paket')) fields.push('sub_paket');
      if (!fields.includes('deskripsi')) fields.push('deskripsi');
      console.log('[RAG] Safeguard: varian -> sub_paket, deskripsi');
    }
    
    // 2. SAFEGUARD HARGA & ANAK -> Wajib: harga & sub_paket
    if (fields.includes('harga') && !fields.includes('sub_paket')) {
      fields.push('sub_paket');
    }
    const isAskingPrice = /harga|biaya|price|cost|berapa|bayar|fee|tarif|murah|mahal|diskon|promo|anak|bayi|balita|khusus|child|kid|baby|discount|how much/.test(combinedText);
    if (isAskingPrice) {
      if (!fields.includes('harga')) fields.push('harga');
      if (!fields.includes('sub_paket')) fields.push('sub_paket');
      console.log('[RAG] Safeguard: harga/anak -> harga, sub_paket');
    }

    // 3. SAFEGUARD JADWAL -> Wajib: jadwal
    const isAskingSchedule = /jadwal|rutin|kapan|tanggal|berangkat|keberangkatan|when|date|schedule|depart|time|hari apa/.test(combinedText);
    if (isAskingSchedule && !fields.includes('jadwal')) {
      fields.push('jadwal');
      console.log('[RAG] Safeguard: jadwal -> jadwal');
    }

    // 4. SAFEGUARD SLOT & KAPASITAS -> Wajib: slot
    const isAskingSlot = /slot|sisa|penuh|kosong|kuota|capacity|peserta|orang|pax|rombongan|bisa ber|tersedia|full|available|left|rombongan/.test(combinedText);
    if (isAskingSlot && !fields.includes('slot')) {
      fields.push('slot');
      console.log('[RAG] Safeguard: slot -> slot');
    }

    // 5. SAFEGUARD FASILITAS & ITINERARY -> Wajib: deskripsi
    const isAskingFacilities = /fasilitas|itinerary|dapat apa|include|exclude|termasuk|nginap|makan|hotel|pesawat|tiket|penginapan|facility|get|accommodation/.test(combinedText);
    if (isAskingFacilities && !fields.includes('deskripsi')) {
      fields.push('deskripsi');
      console.log('[RAG] Safeguard: fasilitas -> deskripsi');
    }

    // 6. SAFEGUARD ADDON / TAMBAHAN -> Wajib: addon
    const isAskingAddon = /tambah|sewa|dokumentasi|kamera|drone|fotografer|rent|extra|add on|addon/.test(combinedText);
    if (isAskingAddon && !fields.includes('addon')) {
      fields.push('addon');
      console.log('[RAG] Safeguard: addon -> addon');
    }

    // 7. SAFEGUARD SYARAT PESERTA / SOLO / MINIMUM -> Wajib: deskripsi
    // Deskripsi paket sering menyimpan informasi "minimal X orang" yang tidak ada di section khusus
    const isAskingParticipants = /sendiri|solo|berdua|bertiga|minimal|minimum|syarat|ketentuan|peserta|orang saja|bisa berapa|berapa orang|how many|alone|single/.test(combinedText);
    if (isAskingParticipants && !fields.includes('deskripsi')) {
      fields.push('deskripsi');
      console.log('[RAG] Safeguard: minimal peserta/solo -> deskripsi');
    }

    console.log(`[RAG] Field filter: ${fields.join(', ')} — ${result.reason || ''}`);

    const lines = rawPackageContext.split('\n');
    const filteredLines = [];
    let currentState = 'default';

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Always keep package headers and category headers
      if (trimmed.startsWith('===') || trimmed.startsWith('---')) {
        currentState = 'default';
        filteredLines.push(line);
        continue;
      }

      // State Transitions based on Section Headers
      if (trimmed.startsWith('Sub-Paket:')) {
        currentState = 'sub_paket';
      } else if (trimmed.startsWith('Harga Khusus Sub-Paket')) {
        currentState = 'sub_paket_custom_prices';
      } else if (trimmed.startsWith('Harga Khusus Tambahan')) {
        currentState = 'harga_custom_prices';
      } else if (trimmed.startsWith('Layanan Tambahan (Addons)')) {
        currentState = 'addon';
      } else if (trimmed.startsWith('Jadwal Keberangkatan') || trimmed.includes('tersedia pada tanggal') || trimmed.startsWith('PENTING:')) {
        currentState = 'jadwal';
      } else if (trimmed.startsWith('Deskripsi:') || trimmed.startsWith('[Konteks Paket') || trimmed.startsWith('Tipe Paket:')) {
        currentState = 'deskripsi';
      } else if (trimmed.startsWith('Harga:') || trimmed.includes('Konteks Harga')) {
        currentState = 'harga';
      } else if (trimmed.startsWith('Status Hari Ini:') || trimmed.startsWith('Status:')) {
        currentState = 'status';
      } else if (trimmed.startsWith('Info Slot:') || trimmed.includes('SLOT PENUH')) {
        currentState = 'slot';
      } else if (trimmed.startsWith('INSTRUKSI PENTING')) {
        currentState = 'instructions';
      } else if (trimmed.startsWith('✅') && (trimmed.includes('Tersedia') || /\d{4}/.test(trimmed))) {
        // "✅ 2026-06-17" -> date list under jadwal
        currentState = 'jadwal';
      } else if (trimmed.startsWith('✅') && trimmed.includes(':') && !trimmed.includes('Tersedia') && !trimmed.includes('Tidak Tersedia') && !/\d{4}/.test(trimmed)) {
        // Sub-paket item: "✅ Reguler: Rp 1.500.000 — ..."
        currentState = 'sub_paket';
      } else if (trimmed.startsWith('❌') && trimmed.includes('SLOT PENUH')) {
        // "❌ Premium: SLOT PENUH..."
        currentState = 'sub_paket';
      }

      // Determine if the current state/section is allowed
      let keepSection = true;
      switch (currentState) {
        case 'deskripsi':
          keepSection = fields.includes('deskripsi');
          break;
        case 'status':
          keepSection = fields.includes('status');
          break;
        case 'jadwal':
          keepSection = fields.includes('jadwal');
          break;
        case 'slot':
          keepSection = fields.includes('slot');
          break;
        case 'sub_paket':
        case 'sub_paket_custom_prices':
          keepSection = fields.includes('sub_paket');
          break;
        case 'harga':
        case 'harga_custom_prices':
          keepSection = fields.includes('harga');
          break;
        case 'addon':
          keepSection = fields.includes('addon');
          break;
        case 'instructions':
        case 'default':
          keepSection = true;
          break;
      }

      if (keepSection) {
        filteredLines.push(line);
      }
    }

    // Fix #9: Use structured JSON for filtering if available
    let filtered;
    if (advStructuredData && advStructuredData.length > 0) {
      console.log('[RAG] Fix #9: Menggunakan Structured JSON output (key-based parsing) untuk Advanced Packages');
      let structuredText = '';
      for (const structured of advStructuredData) {
         if (fields.includes('deskripsi') && structured.sections.deskripsi) structuredText += structured.sections.deskripsi + '\n';
         if (fields.includes('jadwal') && structured.sections.jadwal) structuredText += structured.sections.jadwal + '\n';
         if (fields.includes('harga') && structured.sections.harga) structuredText += structured.sections.harga + '\n';
         if (fields.includes('sub_paket') && structured.sections.sub_paket) structuredText += structured.sections.sub_paket + '\n';
         if (fields.includes('addon') && structured.sections.addon) structuredText += structured.sections.addon + '\n';
         if (fields.includes('slot') && structured.sections.slot) structuredText += structured.sections.slot + '\n';
         if (fields.includes('status') && structured.sections.status) structuredText += structured.sections.status + '\n';
      }
      
      // Ekstrak bagian non-advanced (CRM, KB, Basic Package) dari rawPackageContext
      const nonAdvancedParts = [];
      let isAdvancedSection = false;
      for (const line of rawPackageContext.split('\n')) {
        if (line.startsWith('--- ')) {
          isAdvancedSection = true;
        } else if (line.startsWith('=== ')) {
          isAdvancedSection = false;
        }
        if (!isAdvancedSection) {
          nonAdvancedParts.push(line);
        }
      }
      
      filtered = nonAdvancedParts.join('\n').trim() + '\n\n' + structuredText.trim();
    } else {
      filtered = filteredLines.join('\n').trim();
    }

    // Ratio safeguard: jika terlalu banyak data dibuang, fallback ke full context
    if (filtered.length > 0 && rawPackageContext.length > 0) {
      const ratio = filtered.length / rawPackageContext.length;
      if (ratio < 0.4) {
        console.warn(`[RAG] Field filter terlalu agresif (${(ratio * 100).toFixed(1)}% tersisa). Fallback ke full context.`);
        return rawPackageContext;
      }
    }
    return filtered || rawPackageContext; // fallback to full if filter removes everything
  } catch (err) {
    console.error('[RAG] Field filter error:', err.message);
    return rawPackageContext; // fallback to full context
  }
};

export default { analyzeIntent, matchIndexes, fetchDeepContent, filterFieldRelevance };
