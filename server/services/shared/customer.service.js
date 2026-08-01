import prisma from '../../config/database.js';
import { WA_SESSION_CONFIG } from '../../config/session.js';
import { callAI } from '../ai_agent/logic.service.js';

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// Hanya tampilkan nama yang sudah dikonfirmasi (saved_name).
// push_name (display WA/Telegram) TIDAK digunakan di UI agar tidak menyesatkan.
const resolveDisplayName = (lead) => lead?.saved_name || lead?.phone || '-';
const normalizePhone = (phone) => (phone || '').replace(/\s+/g, '').trim();

const buildManualProfileData = (payload = {}) => ({
  personal: payload.personal || {},
  education: payload.education || {},
  parents: payload.parents || {},
  notes: payload.notes || '',
  created_via: 'manual_form',
  updated_at: new Date().toISOString()
});

export const fetchCustomerList = async (tenantId, { search = '', sort = 'recent', limit = 200 } = {}) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const normalizedSearch = (search || '').trim();

  const where = {
    tenant_id: tenantId,
    label: 'customer'
  };

  if (normalizedSearch) {
    where.OR = [
      { phone: { contains: normalizedSearch } },
      { push_name: { contains: normalizedSearch } },
      { saved_name: { contains: normalizedSearch } }
    ];
  }

  let orderBy = [{ last_message_at: 'desc' }, { id: 'desc' }];
  if (sort === 'name') {
    orderBy = [{ saved_name: 'asc' }, { push_name: 'asc' }, { phone: 'asc' }];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    take: parsedLimit,
    select: {
      id: true,
      phone: true,
      push_name: true,
      saved_name: true,
      status: true,
      label: true,
      last_message_at: true,
      last_message_preview: true,
      updated_at: true
    }
  });

  const phones = leads.map((lead) => lead.phone);

  let latestTransactions = [];
  let revenueAgg = { _sum: { total_price: 0 } };
  let needFollowUp = 0;
  let unsaved = 0;
  let totalCustomers = 0;

  if (phones.length > 0) {
    [latestTransactions, revenueAgg, needFollowUp, unsaved, totalCustomers] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenant_id: tenantId,
          user_phone: { in: phones }
        },
        orderBy: [{ user_phone: 'asc' }, { created_at: 'desc' }, { id: 'desc' }],
        distinct: ['user_phone'],
        select: {
          user_phone: true,
          order_id: true,
          destination: true,
          total_price: true,
          status: true,
          created_at: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          tenant_id: tenantId,
          status: { in: ['approved', 'processing', 'shipped', 'paid'] }
        },
        _sum: { total_price: true }
      }),
      prisma.lead.count({
        where: { tenant_id: tenantId, label: 'customer', follow_up_sent: 0 }
      }),
      prisma.lead.count({
        where: { tenant_id: tenantId, label: 'customer', saved_name: null }
      }),
      prisma.lead.count({ where: { tenant_id: tenantId, label: 'customer' } })
    ]);
  } else {
    [revenueAgg, needFollowUp, unsaved, totalCustomers] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          tenant_id: tenantId,
          status: { in: ['approved', 'processing', 'shipped', 'paid'] }
        },
        _sum: { total_price: true }
      }),
      prisma.lead.count({
        where: { tenant_id: tenantId, label: 'customer', follow_up_sent: 0 }
      }),
      prisma.lead.count({
        where: { tenant_id: tenantId, label: 'customer', saved_name: null }
      }),
      prisma.lead.count({ where: { tenant_id: tenantId, label: 'customer' } })
    ]);
  }

  const latestByPhone = new Map(latestTransactions.map((trx) => [trx.user_phone, trx]));

  let customers = leads.map((lead) => {
    const trx = latestByPhone.get(lead.phone);
    return {
      ...lead,
      name: resolveDisplayName(lead),
      latest_transaction: trx
        ? {
          order_id: trx.order_id,
          destination: trx.destination,
          total_price: trx.total_price,
          status: trx.status,
          created_at: trx.created_at
        }
        : null
    };
  });

  if (sort === 'value') {
    customers = customers.sort((a, b) => {
      const va = Number(a.latest_transaction?.total_price || 0);
      const vb = Number(b.latest_transaction?.total_price || 0);
      if (vb !== va) return vb - va;
      return (b.last_message_at?.getTime?.() || 0) - (a.last_message_at?.getTime?.() || 0);
    });
  }

  return {
    customers,
    stats: {
      total: totalCustomers,
      revenue: Number(revenueAgg?._sum?.total_price || 0),
      need_followup: needFollowUp,
      unsaved
    }
  };
};

export const fetchCustomerDetail = async (tenantId, phone) => {
  const lead = await prisma.lead.findUnique({
    where: {
      uk_tenant_phone: {
        tenant_id: tenantId,
        phone
      }
    }
  });

  if (!lead || lead.label !== 'customer') {
    return null;
  }

  const [transactions, chatCount, customerLabels] = await Promise.all([
    prisma.transaction.findMany({
      where: { tenant_id: tenantId, user_phone: phone },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 100
    }),
    prisma.chatHistory.count({
      where: { tenant_id: tenantId, user_phone: phone }
    }),
    prisma.customerServiceLabel.findMany({
      where: { tenant_id: tenantId, phone },
      orderBy: { id: 'desc' }
    })
  ]);

  const labelIds = customerLabels.map((item) => item.label_id);
  let labels = [];
  if (labelIds.length > 0) {
    const services = await prisma.serviceLabel.findMany({
      where: { id: { in: labelIds }, tenant_id: tenantId },
      select: { id: true, label_name: true, color: true }
    });
    const serviceMap = new Map(services.map((item) => [item.id, item]));
    labels = customerLabels
      .map((item) => serviceMap.get(item.label_id))
      .filter(Boolean);
  }

  const registrationData =
    lead.profile_data ||
    transactions
      .map((trx) => safeJsonParse(trx.form_data))
      .find((json) => json && typeof json === 'object') ||
    null;

  return {
    lead: {
      ...lead,
      name: resolveDisplayName(lead)
    },
    transactions,
    total_chats: chatCount,
    registration_data: registrationData,
    labels
  };
};

export const fetchCustomerChat = async (tenantId, phone) => {
  const messages = await prisma.chatHistory.findMany({
    where: {
      tenant_id: tenantId,
      user_phone: phone
    },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
  });

  return messages;
};

export const fetchCustomerCrmHistory = async (tenantId, phone) => {
  const history = await prisma.customerCrmHistory.findMany({
    where: {
      tenant_id: tenantId,
      phone: phone
    },
    orderBy: {
      created_at: 'desc'
    }
  });
  return history;
};

export const fetchAvailableLabels = async (tenantId) => {
  const labels = await prisma.serviceLabel.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ usage_count: 'desc' }, { label_name: 'asc' }],
    select: {
      id: true,
      label_name: true,
      label_slug: true,
      color: true,
      usage_count: true
    }
  });
  return labels;
};

export const createManualCustomer = async (tenantId, payload = {}) => {
  const personal = payload.personal || {};
  const education = payload.education || {};
  const parents = payload.parents || {};
  const notes = (payload.notes || '').trim();
  const selectedLabelIds = Array.isArray(payload.label_ids)
    ? payload.label_ids.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id))
    : [];

  const name = (personal.name || '').trim();
  const phone = normalizePhone(personal.phone);

  if (!name) {
    throw new Error('Nama wajib diisi');
  }
  if (!phone) {
    throw new Error('Nomor WhatsApp wajib diisi');
  }

  const validLabels = selectedLabelIds.length
    ? await prisma.serviceLabel.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: selectedLabelIds }
      },
      select: { id: true, label_name: true }
    })
    : [];
  const validLabelIds = validLabels.map((label) => label.id);

  const profileData = buildManualProfileData({
    personal,
    education,
    parents,
    notes
  });

  const now = new Date();

  const lead = await prisma.$transaction(async (tx) => {
    let createdOrUpdatedLead = null;
    try {
      createdOrUpdatedLead = await tx.lead.upsert({
        where: {
          uk_tenant_phone: {
            tenant_id: tenantId,
            phone
          }
        },
        update: {
          saved_name: name,
          // JANGAN overwrite push_name — itu adalah display name dari platform (WA/IG/TG).
          // push_name hanya untuk subtitle, bukan untuk identitas utama.
          status: 'customer',
          label: 'customer',
          profile_data: profileData,
          updated_at: now
        },
        create: {
          tenant_id: tenantId,
          phone,
          saved_name: name,
          // JANGAN set push_name saat create manual — tidak ada data platform.
          // push_name hanya diisi oleh webhook dari platform (WA/IG/TG).
          status: 'customer',
          label: 'customer',
          profile_data: profileData,
          last_message_preview: 'Customer dibuat manual oleh admin',
          last_message_at: now
        }
      });
    } catch {
      // Fallback if profile_data column has not been migrated yet.
      createdOrUpdatedLead = await tx.lead.upsert({
        where: {
          uk_tenant_phone: {
            tenant_id: tenantId,
            phone
          }
        },
        update: {
          saved_name: name,
          // JANGAN overwrite push_name — itu adalah display name dari platform.
          status: 'customer',
          label: 'customer',
          former_services: JSON.stringify(profileData),
          updated_at: now
        },
        create: {
          tenant_id: tenantId,
          phone,
          saved_name: name,
          // JANGAN set push_name saat create manual — tidak ada data platform.
          status: 'customer',
          label: 'customer',
          former_services: JSON.stringify(profileData),
          last_message_preview: 'Customer dibuat manual oleh admin',
          last_message_at: now
        }
      });
    }

    await tx.customerServiceLabel.deleteMany({
      where: {
        tenant_id: tenantId,
        phone
      }
    });

    if (validLabelIds.length > 0) {
      await tx.customerServiceLabel.createMany({
        data: validLabelIds.map((labelId) => ({
          tenant_id: tenantId,
          phone,
          label_id: labelId
        })),
        skipDuplicates: true
      });

      await Promise.all(
        validLabelIds.map((labelId) =>
          tx.serviceLabel.update({
            where: { id: labelId },
            data: { usage_count: { increment: 1 } }
          })
        )
      );
    }

    await tx.chatHistory.create({
      data: {
        tenant_id: tenantId,
        user_phone: phone,
        role: 'system',
        message: `Customer manual ditambahkan: ${name}`
      }
    });

    return createdOrUpdatedLead;
  });

  return {
    message: 'Customer berhasil ditambahkan manual.',
    customer: {
      id: lead.id,
      phone: lead.phone,
      name: lead.saved_name || lead.phone
    }
  };
};

export const sendCustomerMessage = async (tenantId, phone, message) => {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.messageQueue.create({
      data: {
        tenant_id: tenantId,
        session_id: WA_SESSION_CONFIG.defaultSessionId,
        target: phone,
        phone,
        message,
        status: 'pending'
      }
    });

    await tx.chatHistory.create({
      data: {
        tenant_id: tenantId,
        user_phone: phone,
        role: 'assistant',
        message
      }
    });

    await tx.lead.upsert({
      where: {
        uk_tenant_phone: {
          tenant_id: tenantId,
          phone
        }
      },
      update: {
        last_message_at: now,
        last_message_preview: message,
        last_ai_reply: message,
        updated_at: now
      },
      create: {
        tenant_id: tenantId,
        phone,
        status: 'baru',
        label: 'potensial',
        last_message_at: now,
        last_message_preview: message,
        last_ai_reply: message
      }
    });
  });

  return { message: 'Pesan berhasil dikirim ke antrean.' };
};

export const followUpCustomer = async (tenantId, phone, instruction = '') => {
  const [lead, recentChats, recentTransactions] = await Promise.all([
    prisma.lead.findUnique({
      where: {
        uk_tenant_phone: {
          tenant_id: tenantId,
          phone
        }
      }
    }),
    prisma.chatHistory.findMany({
      where: { tenant_id: tenantId, user_phone: phone },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 10,
      select: { role: true, message: true }
    }),
    prisma.transaction.findMany({
      where: { tenant_id: tenantId, user_phone: phone },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 3,
      select: { order_id: true, destination: true, status: true }
    })
  ]);

  if (!lead) {
    throw new Error('Customer tidak ditemukan');
  }

  const chatText = recentChats
    .reverse()
    .map((item) => `${item.role === 'user' ? 'PELANGGAN' : 'CS'}: ${(item.message || '').slice(0, 300)}`)
    .join('\n');

  const trxText =
    recentTransactions.length > 0
      ? recentTransactions.map((trx) => `- #${trx.order_id || '-'} | ${trx.destination || '-'} | ${trx.status || '-'}`).join('\n')
      : '- Tidak ada transaksi';

  const prompt = `
Kamu adalah CS profesional untuk pelanggan aktif.
Nama: ${resolveDisplayName(lead)}
Nomor: ${phone}
Transaksi terbaru:
${trxText}

Riwayat chat:
${chatText || '- Tidak ada chat'}

Instruksi admin:
${instruction || 'Buat follow-up hangat untuk menjaga engagement pelanggan.'}

Tulis 1 pesan WhatsApp yang natural, singkat, dan siap kirim.
  `.trim();

  const generated = await callAI(prompt, 'Kamu menulis pesan follow-up customer yang singkat dan jelas.');
  const followUpMessage = (generated || '').trim();

  if (!followUpMessage) {
    throw new Error('Gagal membuat pesan follow-up');
  }

  await sendCustomerMessage(tenantId, phone, followUpMessage);
  return { follow_up_text: followUpMessage, message: 'Follow-up customer berhasil dibuat dan dikirim.' };
};

export default {
  fetchCustomerList,
  fetchCustomerDetail,
  fetchCustomerChat,
  fetchCustomerCrmHistory,
  fetchAvailableLabels,
  createManualCustomer,
  sendCustomerMessage,
  followUpCustomer
};
