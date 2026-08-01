import prisma from '../../config/database.js';
import { saveMessage } from './chat.service.js';
import { broadcast } from './sse.service.js';

/**
 * Handle name extraction from AI output.
 * Checks if the name exists in the database. If so, inserts a SYSTEM_NOTE 
 * so the AI knows to ask for confirmation in the next turn.
 * 
 * @param {number} tenantId - The tenant ID
 * @param {object} currentLead - The current lead object
 * @param {string} newSavedName - The extracted name from AI
 */
export const handleNameExtraction = async (tenantId, currentLead, newSavedName) => {
  try {
    // 1. Update the current lead's name
    const updatedLead = await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: currentLead.phone } },
      data: { saved_name: newSavedName },
      select: { phone: true, whatsapp_phone: true, telegram_id: true, instagram_username: true, channel: true }
    });

    // 1a. Broadcast SSE agar Leads Inbox update real-time (nama jadi judul)
    broadcast(tenantId, 'lead_updated', {
      phone: currentLead.phone,
      saved_name: newSavedName,
      whatsapp_phone: updatedLead.whatsapp_phone || null,
      telegram_id: updatedLead.telegram_id || null,
      instagram_username: updatedLead.instagram_username || null,
    });

    // 1b. Sync name to active CustomerManagement records (Central Info page)
    prisma.customerManagement.updateMany({
      where: { tenant_id: tenantId, phone: currentLead.phone },
      data: { customer_name: newSavedName }
    }).catch(err => console.error('[Identity Service] Failed to sync name to CM:', err.message));

    // 2. Check for duplicate names across platforms (excluding current lead)
    if (newSavedName.length > 3) {
      // Search by saved_name OR by first_name+last_name combination
      const existingLeads = await prisma.lead.findMany({
        where: { 
          tenant_id: tenantId, 
          phone: { not: currentLead.phone },
          status: { not: 'closed' },
          OR: [
            { saved_name: { equals: newSavedName } },
            { saved_name: { contains: newSavedName } },
          ]
        },
        take: 3
      });

      for (const match of existingLeads) {
        // Build platform identity description for the AI
        const platforms = [];
        if (match.whatsapp_phone) platforms.push(`WhatsApp: ${match.whatsapp_phone}`);
        if (match.telegram_id) platforms.push(`Telegram: ${match.telegram_id}`);
        if (match.email) platforms.push(`Email: ${match.email}`);
        const platformInfo = platforms.length > 0 
          ? platforms.join(', ') 
          : `${match.channel || 'whatsapp'} (${match.phone})`;

        const note = `[SYSTEM_NOTE] Terdeteksi profil pelanggan lain bernama "${match.saved_name}" dengan ID Sistem: ${match.phone}. ` +
          `Kontak terdaftar: ${platformInfo}. ` +
          `Pada pesan balasanmu selanjutnya (nanti), TANYAKAN secara natural apakah dia orang yang sama yang sebelumnya menghubungi via platform tersebut. ` +
          `JIKA DIA MENJAWAB YA, sisipkan tag [MERGE_LEAD:${match.phone}] pada akhir balasanmu untuk menggabungkan semua data ke satu profil CRM.`;
        
        await saveMessage(prisma, currentLead.phone, 'system', note, tenantId);
        console.log(`[Identity Service] Found potential match for ${newSavedName} (${platformInfo}). Injected SYSTEM_NOTE.`);
        break; // Only notify for the first match
      }
    }
  } catch (err) {
    console.error('[Identity Service] Error in handleNameExtraction:', err.message);
  }
};

/**
 * Merges an old lead's history into the master lead — unified single-profile merge.
 * All platform IDs (WhatsApp, Telegram, Email) are consolidated into one CRM record.
 * The slave lead is marked as closed/merged.
 * 
 * @param {number} tenantId - The tenant ID
 * @param {object} currentLead - The current lead object (the one that triggered merge)
 * @param {string} oldPhone - The phone/ID of the old lead to merge from
 */
export const handleLeadMerge = async (tenantId, currentLead, oldPhone) => {
  try {
    const lead1 = await prisma.lead.findUnique({ 
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: currentLead.phone } } 
    });
    
    const lead2 = await prisma.lead.findUnique({ 
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: oldPhone } } 
    });

    if (!lead1 || !lead2) {
      console.warn(`[Identity Service] Merge failed. One of the leads is missing (probably already merged).`);
      return false;
    }

    // Determine Master (kept) and Slave (deprecated)
    // Rule: Lower ID (older) = Master. Prevents race conditions / deadlocks.
    let masterLead, slaveLead;
    if (lead1.id <= lead2.id) {
      masterLead = lead1;
      slaveLead = lead2;
    } else {
      masterLead = lead2;
      slaveLead = lead1;
    }

    const masterPhone = masterLead.phone;
    const slavePhone = slaveLead.phone;

    console.log(`[Identity Service] Unified merge: ${slavePhone} → ${masterPhone}...`);

    // ── 1. Build unified platform identity ──
    // Merge whatsapp_phone and telegram_id: take from whichever lead has it
    const mergedWhatsapp = masterLead.whatsapp_phone || slaveLead.whatsapp_phone || null;
    const mergedTelegram = masterLead.telegram_id || slaveLead.telegram_id || null;
    const mergedEmail = masterLead.email || slaveLead.email || null;

    // Also maintain legacy platform_ids JSON for backward compatibility
    let platformIds = {};
    if (masterLead.platform_ids) {
      try { platformIds = JSON.parse(masterLead.platform_ids); } catch(e) {}
    }
    let slavePlatformIds = {};
    if (slaveLead.platform_ids) {
      try { slavePlatformIds = JSON.parse(slaveLead.platform_ids); } catch(e) {}
    }
    platformIds = { ...slavePlatformIds, ...platformIds };
    const slaveChannel = slaveLead.channel || 'unknown';
    platformIds[slaveChannel] = slavePhone;
    // Ensure new fields are also in platform_ids
    if (mergedWhatsapp) platformIds.whatsapp = mergedWhatsapp;
    if (mergedTelegram) platformIds.telegram = mergedTelegram;

    // ── 2. Merge CRM profile fields (fill blanks on master from slave) ──
    const mergedProfileData = {};
    const profileFields = [
      'first_name', 'last_name', 'position_title', 'city', 'country',
      'full_address', 'linkedin_url', 'social_media',
      'birth_date', 'gender', 'company_name', 'industry',
      'company_size', 'annual_revenue', 'lead_source',
      'pipeline_status', 'communication_preference', 'personal_notes',
      'nps_score', 'preferences'
    ];
    for (const field of profileFields) {
      if (!masterLead[field] && slaveLead[field]) {
        mergedProfileData[field] = slaveLead[field];
      }
    }

    // ── 3. Build merged chat summary ──
    const oldChats = await prisma.chatHistory.findMany({
      where: { tenant_id: tenantId, user_phone: slavePhone },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 10
    });
    
    const oldChatText = oldChats.reverse().map(c => `${c.role === 'user' ? 'Customer' : 'AI'}: ${c.message}`).join('\n');
    const newSummary = (masterLead.chat_summary || '') + 
      `\n\n--- [RIWAYAT DARI PLATFORM LAMA (${slavePhone} via ${slaveChannel})] ---\n` +
      `Ringkasan lama: ${slaveLead.chat_summary || 'Tidak ada'}\nPercakapan terakhir:\n${oldChatText}`;

    // ── 4. Perform the merge in a transaction ──
    await prisma.$transaction([
      // Move all related records from slave → master
      prisma.customerSchedule.updateMany({ 
        where: { tenant_id: tenantId, phone: slavePhone }, 
        data: { phone: masterPhone } 
      }),
      prisma.customerRequest.updateMany({ 
        where: { tenant_id: tenantId, phone: slavePhone }, 
        data: { phone: masterPhone } 
      }),
      prisma.customerServiceLabel.updateMany({ 
        where: { tenant_id: tenantId, phone: slavePhone }, 
        data: { phone: masterPhone } 
      }),
      prisma.transaction.updateMany({
        where: { tenant_id: tenantId, user_phone: slavePhone },
        data: { user_phone: masterPhone }
      }),
      prisma.customerManagement.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.offer.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.customerCrmHistory.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.customerInteractionLog.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.orderForm.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.invoice.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.customerStat.updateMany({
        where: { tenant_id: tenantId, phone: slavePhone },
        data: { phone: masterPhone }
      }),
      prisma.chatHistory.updateMany({
        where: { tenant_id: tenantId, user_phone: slavePhone },
        data: { user_phone: masterPhone }
      }),
      // Update master lead with unified data
      prisma.lead.update({
        where: { id: masterLead.id },
        data: {
          chat_summary: newSummary,
          updated_at: new Date(),
          // Platform identity unification
          whatsapp_phone: mergedWhatsapp,
          telegram_id: mergedTelegram,
          email: mergedEmail,
          platform_ids: JSON.stringify(platformIds),
          // Merged profile fields (fill blanks)
          ...mergedProfileData
        }
      })
    ]);

    // Mark slaveLead as closed/merged alias
    await prisma.lead.update({
      where: { id: slaveLead.id },
      data: {
        status: 'closed',
        traffic_source: `MERGED_TO:${masterPhone}`
      }
    });

    console.log(`[Identity Service] Unified merge complete: ${slavePhone} → ${masterPhone}`);
    console.log(`  WhatsApp: ${mergedWhatsapp || 'N/A'} | Telegram: ${mergedTelegram || 'N/A'} | Email: ${mergedEmail || 'N/A'}`);
    return true;
  } catch (err) {
    console.error('[Identity Service] Error in handleLeadMerge:', err.message);
    return false;
  }
};
