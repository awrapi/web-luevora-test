/**
 * ================================================================
 * STAGE 4 — RAG Pipeline (with AI-Driven Info Planner)
 * ================================================================
 * Runs the full Agentic RAG flow:
 *   1. Intent analysis + Index matching (1 merged LLM call)
 *   2. Deep content fetch (basic package/KB text data)
 *   3. AI INFO PLANNER: Plan-and-Execute for deep document reads
 *      - AI reasons about what info is needed from ALL sources
 *      - Executes each: docs, CRM, transactions, forms, etc.
 *      - Aggregates results into enriched context
 *   4. Brochure registration
 *   5. Package title list injection (anti-hallucination)
 *   6. Field relevance filtering
 *   7. Deterministic media injection
 */

import prisma from '../../../../config/database.js';
import { analyzeAndMatch, fetchDeepContent, filterFieldRelevance } from '../../rag.service.js';
import { documentReaderService } from '../../documentReader.service.js';
import { infoPlannerService } from '../../infoPlanner.service.js';
import { checkMediaAllowed } from '../../../shared/mediaDedup.service.js';
import { CONVERSATION_STATES } from '../pipeline.context.js';

const MAX_BROCHURES = 2;

export const runStage4RagPipeline = async (ctx) => {
  const { tenantId, userPhone, userMessage, chatHistorySnippet, lead, mediaSendHistory, conversationState } = ctx;

  // ── Force needsPackages if active_topics has entries ──────────
  let forceNeedsPackages = false;
  if (lead?.active_topics) {
    try {
      const topics = JSON.parse(lead.active_topics);
      if (Array.isArray(topics) && topics.length > 0) {
        forceNeedsPackages = true;
        console.log('[Stage4] Force needsPackages=true from active_topics:', topics);
      }
    } catch {}
  }

  // ── Fetch all available indexes upfront (cheap DB queries) ────
  const [kbIndexes, basicPackageIndexes] = await Promise.all([
    prisma.knowledgeBase.findMany({ where: { tenant_id: tenantId }, select: { id: true, title: true } }),
    prisma.travelPackage.findMany({ where: { tenant_id: tenantId }, select: { id: true, package_name: true } }),
  ]);

  // Also force if chat history mentions products/services dynamically built from DB titles
  if (!forceNeedsPackages && chatHistorySnippet) {
    const keywordStrings = [
      'paket', 'produk', 'layanan', 'product', 'service', 'item', 'harga', 'price', 'booking', 'order', 'sewa', 'rental',
      ...basicPackageIndexes.map(p => (p.package_name || '').split(/\s+/)).flat().filter(w => w.length > 3),
      ...kbIndexes.map(k => (k.title || '').split(/\s+/)).flat().filter(w => w.length > 3)
    ];
    const uniqueKeywords = [...new Set(keywordStrings)]
      .map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .filter(w => w.length > 2);
    
    if (uniqueKeywords.length > 0) {
      const packageKeywords = new RegExp(uniqueKeywords.join('|'), 'i');
      if (packageKeywords.test(chatHistorySnippet.toLowerCase())) {
        forceNeedsPackages = true;
        console.log('[Stage4] Force needsPackages=true from chat history keywords');
      }
    }
  }

  // ── MERGED Step 1+2: Intent analysis + Index matching (1 LLM call) ──
  console.log('[Stage4] Step 1+2: Analyzing intent & matching indexes (merged)...');
  const ragAnalysis = await analyzeAndMatch(tenantId, userMessage, chatHistorySnippet, kbIndexes, basicPackageIndexes, []);
  
  if (forceNeedsPackages) ragAnalysis.needsPackages = true;
  ctx.intent = ragAnalysis;
  console.log('[Stage4] RAG Analysis:', {
    needsKB: ragAnalysis.needsKB, needsPackages: ragAnalysis.needsPackages,
    needsBank: ragAnalysis.needsBank, needsPromote: ragAnalysis.needsPromote,
    selectedKbIds: ragAnalysis.selectedKbIds, selectedPackageIds: ragAnalysis.selectedPackageIds
  });

  // ── Extract selected IDs ──────────────────────────────────────
  let selectedKbIds = ragAnalysis.selectedKbIds || [];
  let selectedBasicPackageIds = (ragAnalysis.selectedPackageIds || []).filter(id => String(id).startsWith('BASIC_'));
  
  console.log('[Stage4] Selected IDs:', { selectedKbIds, selectedBasicPackageIds });

  // ── Step 3: Deep content fetch (basic text data) ──────────────
  console.log('[Stage4] Step 3: Deep content fetch...');
  const ragResult = await fetchDeepContent(
    tenantId, selectedKbIds, selectedBasicPackageIds, [],
    ragAnalysis.needsBank, userPhone, ragAnalysis.needsPromote, userMessage,
    ragAnalysis.needsCrmHistory, lead?.active_topics
  );

  let { kbContext, bankInfo, packages, kbs, promotedPackageId, promotedPackageTitle, promotedPackageType } = ragResult;

  // ── Auto-sync matched packages to lead's active_topics ────────
  if (packages && packages.length > 0) {
    try {
      let existingTopics = [];
      if (lead?.active_topics) {
        existingTopics = JSON.parse(lead.active_topics);
      }
      if (!Array.isArray(existingTopics)) existingTopics = [];

      let updated = false;
      for (const pkg of packages) {
        if (pkg.package_name && !existingTopics.includes(pkg.package_name)) {
          existingTopics.push(pkg.package_name);
          updated = true;
        }
      }

      if (updated) {
        const topicsJson = JSON.stringify(existingTopics);
        await prisma.lead.update({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
          data: { active_topics: topicsJson }
        });
        if (ctx.lead) ctx.lead.active_topics = topicsJson;
        console.log('[Stage4] Automatically synchronized active_topics with matched package(s):', existingTopics);
      }
    } catch (err) {
      console.error('[Stage4] Failed to auto-sync active_topics:', err.message);
    }
  }

  // ── Step 3b: Always-on context for active_topics ──────────────
  // (active_topics now only references basic packages)

  // ── Step 3c: CRM history smart greeting ──────────────────────
  if (ragAnalysis.needsCrmHistory && kbContext.includes('RIWAYAT CRM PELANGGAN (DARI VECTOR DB)')) {
    ctx.personaText += `\n\n[SMART GREETING & CONTEXT]
Berdasarkan data RIWAYAT CRM PELANGGAN di konteks Anda, JANGAN menyapa pelanggan ini seperti orang baru. 
Sapa secara personal berdasarkan riwayat perjalanan/interaksi terbarunya.`;
  }

  // ── Step 4: Brochure registration ────────────────────────────
  const sentBrochurePackageIds = new Set();
  const availableBrochures = {};

  const registerBrochure = (packageName, poster) => {
    availableBrochures[packageName] = {
      mediaUrl: poster.mediaUrl,
      meta: { mediaKey: poster.mediaKey, description: `Brosur paket "${packageName}"`, fileUpdatedAt: poster.updatedAt, mediaUrl: poster.mediaUrl, mediaSummary: poster.summary }
    };
  };

  const findBestPosterForPackage = async (pkgId) => {
    try {
      let files = [];
      {
        const contexts = await prisma.packageMediaContext.findMany({ where: { tenant_id: tenantId, travel_package_id: pkgId } });
        if (contexts.length > 0) {
          files = await prisma.packageMediaFile.findMany({ where: { tenant_id: tenantId, context_id: { in: contexts.map(c => c.id) }, file_type: 'image' } });
        }
      }
      if (files.length === 0) return null;
      const posterFile = files.find(f => /poster|brosur|promo|thumbnail/i.test(f.file_name || f.ai_title || '')) || files[0];
      const mediaUrl = posterFile.file_path.startsWith('http') ? posterFile.file_path : `/uploads/${posterFile.file_path.replace('uploads/', '')}`;
      const mediaKey = `pkg:${pkgId}:file:${posterFile.id}`;
      return { mediaUrl, mediaKey, updatedAt: posterFile.updated_at, summary: posterFile.ai_summary || 'Brosur produk/layanan' };
    } catch (e) {
      console.error(`[Stage4] Error finding poster for pkg ${pkgId}:`, e.message);
      return null;
    }
  };

  // ── Promoted package brochure ─────────────────────────────────
  const greetingOnlyRegex = /^(halo|hai|hi|hello|hey|pagi|siang|sore|malam|selamat|assalamu|ping|permisi|ada\??|kak|hei|hy)[\s!.,😊🙏]*$/i;
  const isGreetingOnly = greetingOnlyRegex.test(userMessage.trim());
  let promoInstruction = '';

  if (promotedPackageId && !isGreetingOnly) {
    const discussedPackageIds = new Set([
      ...(packages || []).map(p => String(p.id)),
    ]);
    const isDiscussingSpecificPackage = discussedPackageIds.size > 0;
    const isPromotedRelevant = discussedPackageIds.has(String(promotedPackageId)) || !isDiscussingSpecificPackage;

    if (isPromotedRelevant) {
      const poster = await findBestPosterForPackage(promotedPackageId, promotedPackageType || 'basic');
      if (poster) {
        const dedupCheck = checkMediaAllowed(mediaSendHistory, poster.mediaKey, ragAnalysis.isMediaReRequest, poster.updatedAt);
        if (dedupCheck.allowed) {
          registerBrochure(promotedPackageTitle, poster);
          sentBrochurePackageIds.add(String(promotedPackageId));
          const versionNote = dedupCheck.isNewVersion ? ' VERSI TERBARU' : '';
          promoInstruction = `\n\n[REKOMENDASI KONSULTAN - BROSUR${versionNote} TERSEDIA]:\nBrosur paket "${promotedPackageTitle}" TERSEDIA dan bisa kamu kirim ke kustomer.\nUntuk mengirim brosur, WAJIB gunakan tag: [SEND_BROCHURE: ${promotedPackageTitle}]\nATURAN: Hanya kirim brosur jika kustomer menunjukkan minat atau bertanya spesifik tentang paket ini.`;
        } else {
          promoInstruction = `\n\n[REKOMENDASI KONSULTAN]:\nSistem mengizinkanmu merekomendasikan paket "${promotedPackageTitle}".\nPENTING: Brosur sudah pernah dikirim (${dedupCheck.reason}). JANGAN KIRIM GAMBAR LAGI.`;
        }
      } else {
        promoInstruction = `\n\n[REKOMENDASI KONSULTAN]:\nSistem mengizinkanmu meng-highlight paket "${promotedPackageTitle}".`;
      }
    } else {
      promoInstruction = `\n\n[REKOMENDASI KONSULTAN - SOFT SELL SAJA]:\nKamu DIIZINKAN menyebutkan paket "${promotedPackageTitle}" jika konteksnya pas.\nTAPI JANGAN kirim brosur/gambar paket ini karena pelanggan sedang fokus membahas paket lain.`;
    }
  }

  // ── Basic package brochures ───────────────────────────────────
  if (packages && packages.length > 0) {
    for (const pkg of packages) {
      const pkgIdStr = String(pkg.id);
      if (sentBrochurePackageIds.has(pkgIdStr) || Object.keys(availableBrochures).length >= MAX_BROCHURES) continue;
      const poster = await findBestPosterForPackage(pkg.id, 'basic');
      if (poster) {
        const dedupCheck = checkMediaAllowed(mediaSendHistory, poster.mediaKey, ragAnalysis.isMediaReRequest, poster.updatedAt);
        if (dedupCheck.allowed) {
          registerBrochure(pkg.package_name, poster);
          sentBrochurePackageIds.add(pkgIdStr);
        }
      }
    }
  }

  // (Advanced package brochures removed — only basic packages are supported)

  // ══════════════════════════════════════════════════════════════
  // AI INFO PLANNER — Plan-and-Execute deep information retrieval
  // ══════════════════════════════════════════════════════════════
  console.log('[Stage4] Step 3b: AI Info Planner — Plan & Execute...');
  let docMediaUrls = [], docMediaMeta = [];

  const plannerResult = await infoPlannerService.planAndExecute(
    tenantId, userPhone, userMessage, chatHistorySnippet,
    { packages, kbs, mediaSendHistory, isMediaReRequest: ragAnalysis.isMediaReRequest }
  );

  // Append planner results to kbContext
  if (plannerResult.context) {
    kbContext += plannerResult.context;
  }
  docMediaUrls = plannerResult.mediaUrls || [];
  docMediaMeta = plannerResult.mediaMeta || [];

  // KB direct file (simple attachment send — not deep read)
  if (kbs && kbs.length > 0) {
    const kbsWithDirectFile = kbs.filter(kb => kb.media_path && kb.allow_send_media);
    for (const kb of kbsWithDirectFile) {
      const directResult = await documentReaderService.deepReadKbDirectFile(tenantId, userPhone, kb.id, kb.title, kb.media_path, userMessage);
      if (directResult.found) {
        kbContext += `\n\n=== JAWABAN DARI LAMPIRAN KB: ${kb.title} ===\n${directResult.answer}\n`;
        break;
      }
    }
  }

  // ── Package title list injection (anti-hallucination) ────────
  try {
    const basicPkgs = await prisma.travelPackage.findMany({ where: { tenant_id: tenantId, status: 'active' }, select: { package_name: true } });
    const activeTitles = basicPkgs.map(p => p.package_name);
    if (activeTitles.length > 0) {
      kbContext += '\n\n=== DAFTAR PRODUK/LAYANAN YANG TERSEDIA ===\nBerikut adalah HANYA produk/layanan yang kami sediakan. DILARANG KERAS menawarkan/menyebutkan pilihan di luar daftar ini:\n';
      kbContext += activeTitles.map(t => `- ${t}`).join('\n');
    }
  } catch (e) { console.error('[Stage4] Error fetching package titles:', e.message); }

  // ── Brochure instruction for AI ───────────────────────────────
  const brochureNames = Object.keys(availableBrochures);
  if (brochureNames.length > 0) {
    promoInstruction += `\n\n=== LAMPIRAN/MEDIA YANG TERSEDIA UNTUK DIKIRIM ===\nBerikut adalah brosur/gambar yang BISA kamu kirim menggunakan tag [SEND_BROCHURE: nama_produk]:\n${brochureNames.map(n => `- ${n}`).join('\n')}\n\nATURAN KIRIM LAMPIRAN/GAMBAR:\n- Gunakan tag [SEND_BROCHURE: nama_produk] DI BARIS TERAKHIR pesan kamu.\n- HANYA kirim lampiran jika kustomer MENUNJUKKAN MINAT atau BERTANYA SPESIFIK tentang produk tersebut.\n- JANGAN kirim lampiran di pesan pertama (sapaan) atau saat kustomer hanya bertanya umum.\n- JANGAN kirim lebih dari 1 lampiran sekaligus kecuali kustomer meminta perbandingan.`;
  }

  // ── Field relevance filtering ─────────────────────────────────
  ctx.fullKbContextForVerify = kbContext;
  if (ragAnalysis.needsPackages && kbContext.includes('---')) {
    kbContext = await filterFieldRelevance(tenantId, userMessage, chatHistorySnippet, kbContext, []);
  }

  // ── Deterministic media injection (payment proof / brochure re-request) ──
  if (ctx.currentMediaData) {
    const mediaData = ctx.currentMediaData;
    if (mediaData.image_category === 'brosur' && mediaData.detected_package_name) {
      const exactPackage = await prisma.travelPackage.findFirst({ where: { tenant_id: tenantId, package_name: { contains: mediaData.detected_package_name } } });
      if (exactPackage) {
        const pkgDetails = `Nama Item: ${exactPackage.package_name}\nHarga: ${exactPackage.price}\nDeskripsi: ${exactPackage.description}\nFasilitas: ${exactPackage.facilities}\nItinerary: ${exactPackage.itinerary}\nAturan: ${exactPackage.rules}`;
        kbContext = `\n\n[PERINTAH MUTLAK DARI SISTEM]\nPelanggan mengirim atau me-reply gambar LAMPIRAN/BROSUR untuk produk/layanan spesifik berikut. ANDA WAJIB menjawab menggunakan data akurat di bawah ini:\n\n=== DATA ITEM YANG DIMAKSUD ===\n${pkgDetails}\n\n` + kbContext;
        ctx.currentMediaSummary = null;
      }
    } else if (mediaData.image_category === 'bukti_transfer') {
      const amount = mediaData.payment_amount || 0;
      kbContext = `\n\n[PERINTAH MUTLAK DARI SISTEM]\nPelanggan baru saja mengirimkan BUKTI TRANSFER dengan nominal terdeteksi Rp ${amount}. Segera ucapkan terima kasih dan beritahu bahwa pembayaran sedang diverifikasi oleh admin!\n\n` + kbContext;
      ctx.currentMediaSummary = null;
    }
  }

  // ── Populate router signals from RAG results ──────────────────
  ctx.routerSignals.hasBrochures     = brochureNames.length > 0;
  ctx.routerSignals.hasPackageContext = packages && packages.length > 0;
  ctx.routerSignals.isBasicPackage   = packages && packages.length > 0;

  // ── Write results to context ──────────────────────────────────
  ctx.kbContext          = kbContext;
  ctx.bankInfo           = bankInfo || '';
  ctx.packages           = packages || [];
  ctx.kbs                = kbs || [];
  ctx.advStructuredData  = [];
  ctx.promotedPackageId  = promotedPackageId;
  ctx.promotedPackageTitle = promotedPackageTitle;
  ctx.promotedPackageType  = promotedPackageType;
  ctx.promoInstruction   = promoInstruction;
  ctx.availableBrochures = availableBrochures;
  ctx.docMediaUrls       = docMediaUrls;
  ctx.docMediaMeta       = docMediaMeta;

  // ── Inject sentMediaHistory & active_topics into personaText ─
  if (ctx.sentMediaHistoryText) ctx.personaText += ctx.sentMediaHistoryText;

  if (lead?.active_topics) {
    try {
      const topics = JSON.parse(lead.active_topics);
      if (Array.isArray(topics) && topics.length > 0) {
        ctx.personaText += `\n\n[TOPIK AKTIF / DYNAMIC NOTES]\nDaftar produk/layanan/topik yang SEDANG AKTIF dibahas: ${JSON.stringify(topics)}.\nATURAN AMBIGUITAS: Jika daftar ini berisi LEBIH DARI 1 topik dan kustomer mengajukan pertanyaan spesifik TANPA menyebutkan nama produknya, WAJIB tanyakan kembali produk/topik mana yang dimaksud.`;
      }
    } catch {}
  }
};
