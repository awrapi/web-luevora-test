/**
 * ================================================================
 * Leads Service — Leads Management & CRM Operations
 * ================================================================
 * Refactored for Single Database Multi-Tenant Architecture.
 * No req/res objects here. Pure business logic using Prisma.
 */

import prisma from '../../config/database.js';
import { callAI } from '../ai_agent/logic.service.js';
import { isProcessing } from './interruptState.js';
import { getPipelineProgress } from '../ai_agent/pipelineProgress.service.js';
import { saveMessage, getRecentChat, buildConversationText } from './chat.service.js';
import { sendText, sendMedia } from './messaging.service.js';
import { broadcast } from './sse.service.js';
import { uploadBufferToStorage } from './storage.service.js';

/**
 * Fetch leads with filters, search, and optional timer data.
 */
export const fetchLeads = async (tenantId, { filter = 'terbaru', search = '', excludeCustomer = false } = {}) => {
  console.log(`[Leads] Fetching leads for tenant ${tenantId} — filter=${filter}, search=${search}`);

  // Construct WHERE clause based on tenantId and filters
  const where = { 
    tenant_id: tenantId,
    NOT: { phone: { startsWith: 'EM' } }
  };

  if (excludeCustomer && filter !== 'customer') {
    where.OR = [
      { label: null },
      { label: { not: 'member' } }
    ];
  }

  if (filter === 'potensial') where.status = 'potensial';
  else if (filter === 'menunggu_pembayaran') where.status = 'menunggu_pembayaran';
  else if (filter === 'not_potensial') where.status = 'not_potensial';
  else if (filter === 'customer') where.label = 'member';
  else if (filter === 'komplain') where.status = 'komplain';
  let leads = [];

  if (filter === 'ghosting') {
    // Ghost/Idle Timer System: filter by ghost_status instead of time-based logic
    const ghostWhere = {
      tenant_id: tenantId,
      ghost_status: { in: ['idle', 'ghosted'] },
      phone: { not: { startsWith: 'EM' } },
    };
    if (excludeCustomer) {
      ghostWhere.OR = [{ label: null }, { label: { not: 'member' } }];
    }
    if (search) {
      ghostWhere.AND = [
        ...(ghostWhere.AND || []),
        {
          OR: [
            { phone: { contains: search } },
            { push_name: { contains: search } },
            { saved_name: { contains: search } }
          ]
        }
      ];
    }
    leads = await prisma.lead.findMany({
      where: ghostWhere,
      orderBy: { ghost_timer_expires_at: 'asc' },
      take: 100
    });
  } else {
    if (search) {
      // If OR is already used by excludeCustomer, we must use AND for search
      const searchFilter = {
        OR: [
          { phone: { contains: search } },
          { push_name: { contains: search } },
          { saved_name: { contains: search } }
        ]
      };
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchFilter
        ];
        delete where.OR;
      } else {
        where.OR = searchFilter.OR;
      }
    }

    leads = await prisma.lead.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
      take: 100
    });
  }

  // Fetch travel bookings history + transaction aggregates for these leads
  const phones = leads.map(l => l.phone);
  if (phones.length > 0) {
    const [bookings, trxAgg] = await Promise.all([
      prisma.travelBooking.findMany({
        where: { tenant_id: tenantId, phone: { in: phones } },
        select: { phone: true, package_name: true, status: true, departure_date: true },
        orderBy: { created_at: 'desc' }
      }),
      prisma.transaction.groupBy({
        by: ['user_phone'],
        where: {
          tenant_id: tenantId,
          user_phone: { in: phones },
          status: { in: ['approved', 'paid', 'completed', 'processing', 'shipped'] }
        },
        _sum: { total_price: true },
        _min: { created_at: true },
        _max: { created_at: true },
        _count: true
      })
    ]);

    const trxMap = new Map(trxAgg.map(t => [t.user_phone, t]));

    return leads.map(lead => {
      const leadBookings = bookings.filter(b => b.phone === lead.phone);
      const trx = trxMap.get(lead.phone);
      return {
        ...lead,
        travel_bookings: leadBookings,
        computed_total_spent: Number(trx?._sum?.total_price || 0),
        computed_first_purchase_at: trx?._min?.created_at || null,
        computed_last_purchase_at: trx?._max?.created_at || null,
        computed_purchase_count: trx?._count || 0
      };
    });
  }

  return leads;
};

/**
 * Get aggregated summary counts for the leads sidebar badges.
 */
export const getLeadsSummary = async (tenantId) => {
  console.log(`[Leads] Fetching summary counts for tenant ${tenantId}`);

  const total = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } } } });
  const total_non_customer = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, OR: [{ label: null }, { label: { not: 'member' } }] } });
  const potensial = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, status: 'potensial', OR: [{ label: null }, { label: { not: 'member' } }] } });
  const menunggu_pembayaran = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, status: 'menunggu_pembayaran', OR: [{ label: null }, { label: { not: 'member' } }] } });
  const not_potensial = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, status: 'not_potensial', OR: [{ label: null }, { label: { not: 'member' } }] } });
  const customer = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, label: 'member' } });
  const komplain = await prisma.lead.count({ where: { tenant_id: tenantId, NOT: { phone: { startsWith: 'EM' } }, status: 'komplain', OR: [{ label: null }, { label: { not: 'member' } }] } });

  // Ghost/Idle Timer System: count by ghost_status
  const ghosting = await prisma.lead.count({
    where: {
      tenant_id: tenantId,
      ghost_status: { in: ['idle', 'ghosted'] },
      NOT: { phone: { startsWith: 'EM' } },
      OR: [{ label: null }, { label: { not: 'member' } }]
    }
  });

  return {
    total, total_non_customer, potensial, menunggu_pembayaran, not_potensial, customer, komplain,
    ghosting
  };
};

/**
 * Fetch customer contacts sorted by saved status.
 */
export const fetchCustomerContacts = async (tenantId) => {
  return await prisma.$queryRaw`
    SELECT * FROM leads 
    WHERE tenant_id = ${tenantId} 
      AND label = 'member' 
      AND phone NOT LIKE 'EM%'
    ORDER BY CASE WHEN saved_name IS NOT NULL THEN 0 ELSE 1 END, 
    saved_name ASC, push_name ASC
  `;
};

/**
 * Fetch chat + lead data for a specific phone.
 */
export const fetchChat = async (tenantId, phone) => {
  const chats = await prisma.chatHistory.findMany({
    where: { tenant_id: tenantId, user_phone: phone },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
  });
  const lead = await prisma.lead.findUnique({ 
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } } 
  });

  // Check if AI pipeline is actively processing this phone right now.
  // This survives page refresh / tab navigation because it reads live Redis state.
  const aiProcessing = await isProcessing(`${tenantId}:${phone}`);

  // If pipeline is active, also fetch the current progress snapshot from Redis
  // so the dashboard can fully restore the pipeline viewer state.
  const pipelineProgress = aiProcessing
    ? await getPipelineProgress(tenantId, phone)
    : null;

  return { chats, lead, aiProcessing, pipelineProgress };
};

/**
 * Save/update a contact name.
 */
export const saveContact = async (tenantId, phone, name) => {
  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: { saved_name: name, updated_at: new Date() }
  });
  return { message: 'Kontak berhasil disimpan' };
};

/**
 * Update lead status and/or label.
 */
export const updateLeadStatus = async (tenantId, phone, { status, label } = {}) => {
  const data = { updated_at: new Date() };
  if (status) data.status = status;
  if (label !== undefined && label !== null) data.label = label;

  await prisma.lead.update({ 
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } }, 
    data 
  });
  return { message: 'Status updated' };
};

/**
 * Toggle AI/manual mode for a lead.
 */
export const setMode = async (tenantId, phone, isManual) => {
  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: { is_manual: isManual ? 1 : 0, updated_at: new Date() }
  });

  await prisma.modeChangeLog.create({
    data: { tenant_id: tenantId, phone, is_manual: isManual ? 1 : 0 }
  });

  return { message: `Mode diubah: ${isManual ? 'Ambil Alih' : 'AI Otomatis'}`, is_manual: isManual };
};

/**
 * Send a manual message + save to history + update lead.
 */
export const sendManualMessage = async (tenantId, phone, message) => {
  // Send via Provider/Queue with tenantId
  const sendResult = await sendText(prisma, phone, message, { tenantId });
  await saveMessage(prisma, phone, 'assistant', message, tenantId);
  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: {
      last_message_preview: message,
      last_message_at: new Date(),
      updated_at: new Date()
    }
  });

  // Broadcast to dashboard so chat updates in real-time
  broadcast(tenantId, 'new_message', {
    phone,
    message,
    role: 'assistant',
  });

  // Broadcast lead_updated to update the sidebar list
  broadcast(tenantId, 'lead_updated', {
    phone,
    last_message_preview: message.substring(0, 500),
    last_message_at: new Date().toISOString(),
  });

  return { 
    message: sendResult.via === 'meta' 
      ? 'Pesan terkirim via WhatsApp' 
      : 'Pesan masuk antrian (Provider gagal, cek konfigurasi)',
    via: sendResult.via 
  };
};

/**
 * Send a media file (uploaded from device) to a lead via WhatsApp.
 * Accepts a buffer (from multer), uploads to storage, then sends via sendMedia.
 */
export const sendManualMedia = async (tenantId, phone, { buffer, mimetype, originalname, caption = '' }) => {
  // 1. Upload file to storage and get a public URL
  let mediaUrl;
  try {
    mediaUrl = await uploadBufferToStorage(buffer, originalname, mimetype, tenantId);
  } catch (err) {
    console.error('[sendManualMedia] Storage upload failed:', err.message);
    throw new Error('Gagal mengupload file ke storage');
  }

  // 2. Send via messaging service (routes to WA/TG/IG automatically)
  const sendResult = await sendMedia(prisma, phone, caption, mediaUrl, { tenantId, filename: originalname });

  // 3. Save to chat history with media preview
  const msgPreview = caption || `[Media: ${originalname}]`;
  await saveMessage(prisma, phone, 'assistant', msgPreview, tenantId, mediaUrl);

  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: { last_message_preview: msgPreview, last_message_at: new Date(), updated_at: new Date() }
  });

  broadcast(tenantId, 'new_message', { phone, message: msgPreview, role: 'assistant', media_url: mediaUrl });
  broadcast(tenantId, 'lead_updated', { phone, last_message_preview: msgPreview, last_message_at: new Date().toISOString() });

  return { message: 'Media berhasil dikirim', via: sendResult.via, media_url: mediaUrl };
};

/**
 * Send a library media item (already has a URL) to a lead.
 */
export const sendLibraryMedia = async (tenantId, phone, { mediaUrl, caption = '', filename = 'file' }) => {
  const sendResult = await sendMedia(prisma, phone, caption, mediaUrl, { tenantId, filename });

  const msgPreview = caption || `[Media: ${filename}]`;
  await saveMessage(prisma, phone, 'assistant', msgPreview, tenantId, mediaUrl);

  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: { last_message_preview: msgPreview, last_message_at: new Date(), updated_at: new Date() }
  });

  broadcast(tenantId, 'new_message', { phone, message: msgPreview, role: 'assistant', media_url: mediaUrl });
  broadcast(tenantId, 'lead_updated', { phone, last_message_preview: msgPreview, last_message_at: new Date().toISOString() });

  return { message: 'Media berhasil dikirim dari library', via: sendResult.via };
};

/**
 * Fetch all media assets available in the tenant's system, grouped by source.
 * Sources: Knowledge Base files, Travel Packages (images), Retail Inventory.
 */
export const getMediaLibrary = async (tenantId) => {
  const groups = [];

  // ── 1. KB Media Files (KbMediaFile model, file_path field) ──
  try {
    const kbFiles = await prisma.kbMediaFile.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        file_name: true,
        file_path: true,
        file_type: true,
        created_at: true,
        context: { select: { context_label: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    if (kbFiles.length > 0) {
      groups.push({
        id: 'knowledge_base',
        label: 'Knowledge Base',
        icon: 'BookOpen',
        items: kbFiles.map(f => ({
          id: `kb_${f.id}`,
          name: f.file_name,
          url: f.file_path,
          mime: f.file_type,
          context: f.context?.context_label || 'Knowledge Base',
          type: (f.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.file_path)) ? 'image' : 'document'
        }))
      });
    }
  } catch (e) { console.warn('[Library] KB files query failed:', e.message); }

  // ── 2. Travel Package Media Files (PackageMediaFile model) ──
  try {
    const pkgFiles = await prisma.packageMediaFile.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        file_name: true,
        file_path: true,
        file_type: true,
        created_at: true,
        context: { select: { context_label: true, travel_package: { select: { package_name: true } } } }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    if (pkgFiles.length > 0) {
      groups.push({
        id: 'travel_packages',
        label: 'Gambar Paket Travel',
        icon: 'Map',
        items: pkgFiles.map(f => ({
          id: `pkg_${f.id}`,
          name: f.file_name,
          url: f.file_path,
          mime: f.file_type,
          context: f.context?.travel_package?.package_name || f.context?.context_label || 'Paket Travel',
          type: (f.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.file_path)) ? 'image' : 'document'
        }))
      });
    }
  } catch (e) { console.warn('[Library] Travel package files query failed:', e.message); }

  // ── 3. Advanced Package Main Media (MainPackageMediaFile) ──
  try {
    const advFiles = await prisma.mainPackageMediaFile.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        file_name: true,
        file_path: true,
        file_type: true,
        created_at: true,
        package: { select: { title: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 30
    });
    if (advFiles.length > 0) {
      groups.push({
        id: 'advanced_packages',
        label: 'Gambar Paket Lanjutan',
        icon: 'Layers',
        items: advFiles.map(f => ({
          id: `adv_${f.id}`,
          name: f.file_name,
          url: f.file_path,
          mime: f.file_type,
          context: f.package?.title || 'Paket Lanjutan',
          type: (f.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.file_path)) ? 'image' : 'document'
        }))
      });
    }
  } catch (e) { console.warn('[Library] Advanced package files query failed:', e.message); }

  // ── 4. Basic TravelPackage thumbnail (image_url field) ──
  try {
    const basicPkgs = await prisma.travelPackage.findMany({
      where: { tenant_id: tenantId, image_url: { not: null } },
      select: { id: true, package_name: true, image_url: true, destination: true },
      orderBy: { created_at: 'desc' },
      take: 30
    });
    if (basicPkgs.length > 0) {
      // Add to travel_packages group if exists, otherwise create new
      const existing = groups.find(g => g.id === 'travel_packages');
      const newItems = basicPkgs.map(p => ({
        id: `tpkg_${p.id}`,
        name: p.package_name,
        url: p.image_url,
        mime: 'image/jpeg',
        context: p.destination || 'Paket Travel',
        type: 'image'
      }));
      if (existing) {
        existing.items = [...newItems, ...existing.items];
      } else {
        groups.push({
          id: 'travel_packages',
          label: 'Gambar Paket Travel',
          icon: 'Map',
          items: newItems
        });
      }
    }
  } catch (e) { console.warn('[Library] Basic travel packages query failed:', e.message); }

  return groups;
};

/**
 * AI-powered follow-up generation + send.
 */
export const followUp = async (tenantId, aiConfig, phone) => {
  const lead = await prisma.lead.findUnique({ 
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } } 
  });
  if (!lead) throw new Error('Lead not found');

  // getRecentChat must be updated to accept tenantId
  const chatHistory = await getRecentChat(prisma, phone, 10, tenantId);
  const conversationText = buildConversationText(chatHistory);

  const isCustomer = lead.label === 'member';
  let systemRole = 'Kamu adalah Customer Service yang ramah dan profesional.';

  const sr = await prisma.knowledgeBase.findFirst({
    where: { tenant_id: tenantId, type: isCustomer ? 'customer_system_role' : 'system_role' }
  });
  if (sr && sr.content_text) systemRole = sr.content_text;

  const statusContextMap = {
    potensial: 'User ini POTENSIAL (tertarik/serius). Follow up dengan menawarkan bantuan lanjutan, tanyakan apakah ada yang bisa dibantu, dorong untuk closing.',
    not_potensial: 'User ini BUKAN POTENSIAL. Sapa saja dengan hangat dan tanyakan apakah ada produk yang sedang dicari.',
    menunggu_pembayaran: `User ini MENUNGGU PEMBAYARAN. Ingatkan dengan sopan untuk menyelesaikan pembayaran. Jangan terlalu memaksa.`,
    customer: 'User ini sudah jadi CUSTOMER AKTIF. Follow up untuk memastikan kepuasan.',
    komplain: 'User ini sedang KOMPLAIN. Tanggapi dengan empati.',
  };
  const statusContext = statusContextMap[lead.status] || '';

  const followUpPrompt = `
    ${systemRole}
    KONTEKS: Kamu sedang melakukan FOLLOW UP kepada pelanggan via WhatsApp.
    STATUS LEAD: ${lead.status}\n${statusContext}
    RIWAYAT PERCAKAPAN TERAKHIR:\n${conversationText}
    TUGAS: Buatkan pesan follow-up WhatsApp yang natural, ramah, dan sesuai konteks percakapan terakhir. Singkat saja. Langsung tulis isinya.
  `;

  const followUpMessage = await callAI(followUpPrompt, 'Kamu adalah CS yang melakukan follow-up. Tulis pesan WhatsApp yang natural.');
  if (!followUpMessage) throw new Error('AI gagal generate follow-up message');

  await sendText(prisma, phone, followUpMessage);
  await saveMessage(prisma, phone, 'assistant', followUpMessage, tenantId);

  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: {
      follow_up_sent: (lead.follow_up_sent || 0) + 1,
      last_message_preview: followUpMessage,
      last_message_at: new Date()
    }
  });

  // Broadcast to dashboard
  broadcast(tenantId, 'new_message', {
    phone,
    message: followUpMessage,
    role: 'assistant',
    created_at: new Date().toISOString()
  });

  broadcast(tenantId, 'lead_updated', {
    phone,
    last_message_preview: followUpMessage,
    last_message_at: new Date().toISOString()
  });

  return { message: 'Follow-up berhasil dikirim', follow_up_text: followUpMessage };
};


/**
 * Update CRM profile fields for an existing lead.
 */
export const updateCrmProfile = async (tenantId, phone, fields) => {
  const allowed = [
    'saved_name', 'first_name', 'last_name', 'position_title',
    'city', 'country', 'full_address', 'linkedin_url',
    'company_name', 'industry', 'company_size', 'annual_revenue',
    'lead_source', 'gender', 'birth_date', 'pipeline_status',
    'personal_notes', 'communication_preference', 'preferences', 'chat_summary',
    'nps_score', 'status', 'label',
    'email', 'former_services', 'contract_renewal_at', 'social_media',
    // Platform identity (cross-platform unification)
    'whatsapp_phone', 'telegram_id', 'instagram_username'
  ];
  const data = { updated_at: new Date() };
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      // Convert empty string to null for optional fields
      data[key] = fields[key] === '' ? null : fields[key];
    }
  }

  // ── Type conversions for Prisma schema compatibility ──
  if (data.birth_date && typeof data.birth_date === 'string') {
    try { const d = new Date(data.birth_date); data.birth_date = isNaN(d) ? null : d; }
    catch { data.birth_date = null; }
  }
  if (data.contract_renewal_at && typeof data.contract_renewal_at === 'string') {
    try { const d = new Date(data.contract_renewal_at); data.contract_renewal_at = isNaN(d) ? null : d; }
    catch { data.contract_renewal_at = null; }
  }
  if (data.nps_score !== undefined && data.nps_score !== null) {
    const n = parseInt(data.nps_score, 10);
    data.nps_score = (!isNaN(n) && n >= 0 && n <= 10) ? n : null;
  }

  const updated = await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data
  });
  return { message: 'Profil CRM berhasil diperbarui', data: updated };
};

/**
 * Create a new lead manually (no chat history required).
 */
export const createManualLead = async (tenantId, fields) => {
  const phone = (fields.phone || '').trim();
  if (!phone) throw new Error('Nomor telepon wajib diisi');

  // Check if already exists
  const existing = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } }
  });
  if (existing) throw new Error('Kontak dengan nomor ini sudah ada di CRM');

  // ── Type conversions ──
  let birthDate = null;
  if (fields.birth_date) {
    try { const d = new Date(fields.birth_date); if (!isNaN(d)) birthDate = d; } catch {}
  }
  let contractRenewal = null;
  if (fields.contract_renewal_at) {
    try { const d = new Date(fields.contract_renewal_at); if (!isNaN(d)) contractRenewal = d; } catch {}
  }
  let npsScore = null;
  if (fields.nps_score !== undefined && fields.nps_score !== '') {
    const n = parseInt(fields.nps_score, 10);
    if (!isNaN(n) && n >= 0 && n <= 10) npsScore = n;
  }

  const lead = await prisma.lead.create({
    data: {
      tenant_id: tenantId,
      phone,
      saved_name: fields.saved_name || fields.first_name || null,
      first_name: fields.first_name || null,
      last_name: fields.last_name || null,
      position_title: fields.position_title || null,
      gender: fields.gender || null,
      birth_date: birthDate,
      city: fields.city || null,
      country: fields.country || null,
      full_address: fields.full_address || null,
      linkedin_url: fields.linkedin_url || null,
      email: fields.email || null,
      company_name: fields.company_name || null,
      industry: fields.industry || null,
      company_size: fields.company_size || null,
      annual_revenue: fields.annual_revenue || null,
      lead_source: fields.lead_source || 'manual',
      pipeline_status: fields.pipeline_status || 'new_prospect',
      communication_preference: fields.communication_preference || null,
      personal_notes: fields.personal_notes || null,
      preferences: fields.preferences || null,
      chat_summary: fields.chat_summary || null,
      nps_score: npsScore,
      contract_renewal_at: contractRenewal,
      social_media: fields.social_media || null,
      status: 'baru',
      label: fields.label || 'potensial',
      is_manual: 1,
      created_at: new Date(),
      updated_at: new Date(),
      last_message_at: new Date()
    }
  });
  return { message: 'Kontak berhasil ditambahkan', data: lead };
};

/**
 * Get contacts that have sent messages but are NOT yet in the Lead table.
 * Used for "suggestion" to add to CRM for free-plan users.
 */
export const getSuggestedContacts = async (tenantId) => {
  // Get phones that exist in ChatHistory but NOT in Lead
  const suggestions = await prisma.$queryRaw`
    SELECT 
      ch.user_phone as phone,
      MAX(ch.message) as last_message,
      MAX(ch.created_at) as last_seen,
      COUNT(*) as message_count
    FROM chat_history ch
    WHERE ch.tenant_id = ${tenantId}
      AND ch.role = 'user'
      AND ch.user_phone NOT LIKE 'EM%'
      AND NOT EXISTS (
        SELECT 1 FROM leads l 
        WHERE l.tenant_id = ${tenantId} 
          AND l.phone = ch.user_phone
      )
    GROUP BY ch.user_phone
    ORDER BY MAX(ch.created_at) DESC
    LIMIT 20
  `;
  return suggestions;
};

/**
 * Update profile photo URL for a lead.
 */
export const updateProfilePhoto = async (tenantId, phone, photoUrl) => {
  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    data: { profile_photo_url: photoUrl || null, updated_at: new Date() }
  });
  return { message: 'Foto profil berhasil diperbarui' };
};

export default {
  fetchLeads, getLeadsSummary, fetchCustomerContacts,
  fetchChat, saveContact, updateLeadStatus, setMode,
  sendManualMessage, sendManualMedia, sendLibraryMedia, getMediaLibrary,
  followUp, updateCrmProfile, createManualLead, getSuggestedContacts,
  updateProfilePhoto,
};
