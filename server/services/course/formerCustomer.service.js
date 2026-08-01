import prisma from '../../config/database.js';
import { AI_CONFIG } from '../../config/ai.js';
import { ChatOpenAI } from '@langchain/openai';

export const getFormerCustomers = async (tenantId) => {
  return await prisma.lead.findMany({
    where: { tenant_id: tenantId, label: 'mantan' },
    orderBy: { updated_at: 'desc' }
  });
};

export const moveToFormer = async (tenantId, phone) => {
  const currentLabels = await prisma.customerServiceLabel.findMany({
    where: { tenant_id: tenantId, phone: phone },
    include: { serviceLabel: true }
  });
  
  const formerServicesStr = currentLabels.map(l => l.serviceLabel.label_name).join(', ');

  await prisma.customerServiceLabel.deleteMany({
    where: { tenant_id: tenantId, phone: phone }
  });

  try {
    await prisma.courseSchedule.deleteMany({
      where: { tenant_id: tenantId, phone: phone }
    });
  } catch(e) {}

  const updatedLead = await prisma.lead.updateMany({
    where: { tenant_id: tenantId, phone: phone },
    data: {
      label: 'mantan',
      former_services: formerServicesStr || null,
      updated_at: new Date()
    }
  });

  if (updatedLead.count === 0) {
    throw new Error('Customer tidak ditemukan');
  }

  return { status: true, message: 'Berhasil dipindahkan ke Mantan Customer' };
};

export const restoreCustomer = async (tenantId, phone) => {
  const updatedLead = await prisma.lead.updateMany({
    where: { tenant_id: tenantId, phone: phone },
    data: {
      label: 'customer',
      updated_at: new Date()
    }
  });

  if (updatedLead.count === 0) {
    throw new Error('Customer tidak ditemukan');
  }

  return { status: true, message: 'Berhasil dikembalikan ke aktif' };
};

export const deletePermanent = async (tenantId, phone) => {
  await prisma.customerServiceLabel.deleteMany({ where: { tenant_id: tenantId, phone: phone } });
  
  try {
    await prisma.courseSchedule.deleteMany({ where: { tenant_id: tenantId, phone: phone } });
  } catch(e) {}

  await prisma.transaction.deleteMany({ where: { tenant_id: tenantId, user_phone: phone } });
  
  const deletedLead = await prisma.lead.deleteMany({
    where: { tenant_id: tenantId, phone: phone }
  });

  if (deletedLead.count === 0) {
    throw new Error('Customer tidak ditemukan');
  }

  return { status: true, message: 'Data dihapus permanen' };
};

export const generateAIFollowUp = async (tenantId, phone, instruction) => {
  const lead = await prisma.lead.findFirst({
    where: { tenant_id: tenantId, phone: phone }
  });

  if (!lead) throw new Error('Customer tidak ditemukan');

  const displayName = lead.saved_name || lead.push_name || lead.phone;
  const trxContext = lead.former_services ? `Pernah mengambil layanan: ${lead.former_services}` : '';

  const systemRole = 'Kamu adalah Customer Service yang ramah dan profesional.';

  const prompt = `
  ${systemRole}

  KONTEKS: Kamu sedang melakukan FOLLOW UP kepada MANTAN CUSTOMER via WhatsApp.
  Tujuannya adalah mengajak kembali customer ini untuk mendaftar lagi.
  NAMA CUSTOMER: ${displayName}
  STATUS: Mantan Customer (Pernah mendaftar sebelumnya)

  DATA PEMBELIAN SEBELUMNYA:
  ${trxContext}

  INSTRUKSI ADMIN:
  ${instruction}

  TUGAS:
  Buatkan pesan follow-up WhatsApp berdasarkan instruksi admin.
  - Natural, ramah, persuasif tapi tidak memaksa
  - Gunakan emoji yang sesuai tapi jangan berlebihan
  - Langsung tulis isi pesannya saja, TANPA tanda kutip, TANPA penjelasan
  - Pesan harus PENDEK (maksimal 4-5 kalimat)
  - Sapa customer dengan namanya
  - Ingatkan tentang pengalaman sebelumnya secara positif
  `;

  const chatModel = new ChatOpenAI({
    openAIApiKey: AI_CONFIG.apiKey,
    modelName: AI_CONFIG.defaultModel,
    temperature: 0.7,
    maxRetries: 2,
    configuration: {
      baseURL: AI_CONFIG.baseUrl
    }
  });

  const response = await chatModel.invoke(prompt);
  let followUpText = response.content || '';
  followUpText = followUpText.replace(/^"|"$/g, '').trim();

  if (!followUpText) throw new Error('AI gagal mengenerate pesan');

  return followUpText;
};

export default {
  getFormerCustomers,
  moveToFormer,
  restoreCustomer,
  deletePermanent,
  generateAIFollowUp
};
