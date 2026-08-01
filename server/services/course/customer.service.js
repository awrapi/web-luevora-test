import prisma from '../../config/database.js';
import { AI_CONFIG } from '../../config/ai.js';
import { ChatOpenAI } from '@langchain/openai';

/**
 * ================================================================
 * Course Customer Service
 * ================================================================
 * Handles adding customers manually with full course-specific form data.
 */

export const addCustomerManual = async (tenantId, payload) => {
  const {
    // Data Pribadi
    nama_lengkap, phone, jenis_kelamin, agama, tempat_lahir, tanggal_lahir,
    kebangsaan, email, alamat, kota, propinsi, nomer_telepon, link_sosmed,
    // Pendidikan
    jenjang, sekolah, pend_alamat, pend_kota, pend_telepon,
    // Ortu
    ortu_nama_ayah, ortu_hp_ayah, ortu_pekerjaan_ayah, ortu_email_ayah,
    ortu_nama_ibu, ortu_hp_ibu, ortu_pekerjaan_ibu, ortu_email_ibu,
    // Lainnya
    catatan, label_ids = [], new_labels = []
  } = payload;

  if (!nama_lengkap) throw new Error('Nama lengkap wajib diisi');
  if (!phone) throw new Error('Nomor HP wajib diisi');

  // Normalisasi nomor HP
  let phoneClean = phone.replace(/\D/g, '');
  if (phoneClean.startsWith('0')) {
    phoneClean = '62' + phoneClean.substring(1);
  } else if (!phoneClean.startsWith('62')) {
    phoneClean = '62' + phoneClean;
  }

  // Cek duplikat lead
  const existingLead = await prisma.lead.findUnique({
    where: {
      uk_tenant_phone: {
        tenant_id: tenantId,
        phone: phoneClean
      }
    }
  });

  if (existingLead) {
    throw new Error('Nomor HP sudah terdaftar sebagai customer');
  }

  // Bangun catatan gabungan
  const catatanParts = [];
  if (kota) catatanParts.push(`Kota: ${kota}`);
  if (propinsi) catatanParts.push(`Propinsi: ${propinsi}`);
  if (agama) catatanParts.push(`Agama: ${agama}`);
  if (kebangsaan && kebangsaan !== 'Indonesia') catatanParts.push(`Kebangsaan: ${kebangsaan}`);
  if (ortu_nama_ayah) catatanParts.push(`Ayah: ${ortu_nama_ayah}`);
  if (ortu_nama_ibu) catatanParts.push(`Ibu: ${ortu_nama_ibu}`);
  if (catatan) catatanParts.push(catatan);
  const catatanFinal = catatanParts.join(' | ');

  // Insert ke tabel leads
  const newLead = await prisma.lead.create({
    data: {
      tenant_id: tenantId,
      phone: phoneClean,
      push_name: nama_lengkap,
      saved_name: nama_lengkap,
      label: 'customer',
      // Note: jenjang, sekolah, alamat are not standard fields in Prisma Lead model
      // They are stored in form_data in transactions.
      // But we will populate whatever is available.
      // If schema doesn't have them, we skip them from Lead.
      // Prisma schema doesn't have jenjang, sekolah, alamat in Lead, only in form_data.
    }
  });

  // Bangun form_data JSON lengkap
  const rawFormData = {
    nama_lengkap, no_hp: phone, jenis_kelamin, agama, tempat_lahir,
    tanggal_lahir, kebangsaan, email, alamat, kota, propinsi,
    nomer_telepon, link_sosmed,
    pendidikan_jenjang: jenjang,
    pendidikan_nama_sekolah: sekolah,
    pendidikan_alamat: pend_alamat,
    pendidikan_kota: pend_kota,
    pendidikan_telepon: pend_telepon,
    ortu_nama_ayah, ortu_hp_ayah, ortu_pekerjaan_ayah, ortu_email_ayah,
    ortu_nama_ibu, ortu_hp_ibu, ortu_pekerjaan_ibu, ortu_email_ibu,
    _submitted_at: new Date().toISOString(),
    _source: 'manual_admin'
  };

  // Remove empty/undefined/null fields
  const formData = Object.fromEntries(
    Object.entries(rawFormData).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
  );

  const formDataJson = JSON.stringify(formData);

  // Simpan ke transactions agar form_data bisa dibaca di popup detail
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const orderId = `MAN-${randomSuffix}`;

  try {
    await prisma.transaction.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        user_phone: phoneClean,
        customer_name: nama_lengkap,
        destination: 'Manual Entry',
        pax_count: 1,
        total_price: 0,
        status: 'approved',
        payment_flow: 'manual',
        form_filled: 1,
        form_data: formDataJson,
        sender_name: nama_lengkap
      }
    });
  } catch (e) {
    console.error('Failed to create dummy transaction for form_data', e);
    // Non-fatal, let it proceed
  }

  // Handle new labels creation
  if (new_labels && Array.isArray(new_labels) && new_labels.length > 0) {
    for (const labelName of new_labels) {
      if (!labelName || !labelName.trim()) continue;
      
      const cleanName = labelName.trim();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      try {
        const existingLabel = await prisma.serviceLabel.findFirst({
          where: { tenant_id: tenantId, label_slug: slug }
        });
        
        if (existingLabel) {
          if (!label_ids.includes(existingLabel.id)) {
            label_ids.push(existingLabel.id);
          }
        } else {
          const newLabel = await prisma.serviceLabel.create({
            data: {
              tenant_id: tenantId,
              label_name: cleanName,
              label_slug: slug,
              color: '#6366f1' // default indigo color
            }
          });
          label_ids.push(newLabel.id);
        }
      } catch (e) {
        console.error('Failed to create new service label:', cleanName, e);
      }
    }
  }

  // Assign label/les ke customer_service_labels
  if (label_ids && Array.isArray(label_ids) && label_ids.length > 0) {
    // Ensure uniqueness in label_ids array
    const uniqueLabelIds = [...new Set(label_ids)];
    
    const labelData = uniqueLabelIds.map(id => ({
      tenant_id: tenantId,
      phone: phoneClean,
      label_id: parseInt(id)
    }));

    // Use createMany
    try {
      await prisma.customerServiceLabel.createMany({
        data: labelData,
        skipDuplicates: true
      });
    } catch (e) {
      console.error('Failed to assign service labels', e);
    }
  }

  return { status: true, message: 'Berhasil menambahkan customer manual' };
};

export const getCustomerDetail = async (tenantId, phone) => {
  let phoneClean = phone.replace(/\D/g, '');
  if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.substring(1);
  else if (!phoneClean.startsWith('62')) phoneClean = '62' + phoneClean;

  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: phoneClean } }
  });

  if (!lead) throw new Error('Customer tidak ditemukan');

  const lastTrx = await prisma.transaction.findFirst({
    where: { tenant_id: tenantId, user_phone: phoneClean },
    orderBy: { created_at: 'desc' }
  });

  let formData = {};
  if (lastTrx && lastTrx.form_data) {
    try { formData = JSON.parse(lastTrx.form_data); } catch(e) {}
  }

  const currentLabels = await prisma.customerServiceLabel.findMany({
    where: { tenant_id: tenantId, phone: phoneClean },
    select: { label_id: true }
  });

  return {
    ...lead,
    ...formData,
    label_ids: currentLabels.map(l => l.label_id)
  };
};

export const editCustomer = async (tenantId, phone, payload) => {
  const {
    // Data Pribadi
    nama_lengkap, jenis_kelamin, agama, tempat_lahir, tanggal_lahir,
    kebangsaan, email, alamat, kota, propinsi, nomer_telepon, link_sosmed,
    // Pendidikan
    jenjang, sekolah, pend_alamat, pend_kota, pend_telepon,
    // Ortu
    ortu_nama_ayah, ortu_hp_ayah, ortu_pekerjaan_ayah, ortu_email_ayah,
    ortu_nama_ibu, ortu_hp_ibu, ortu_pekerjaan_ibu, ortu_email_ibu,
    // Lainnya
    catatan, label_ids = [], new_labels = []
  } = payload;

  if (!nama_lengkap) throw new Error('Nama lengkap wajib diisi');

  let phoneClean = phone.replace(/\D/g, '');
  if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.substring(1);
  else if (!phoneClean.startsWith('62')) phoneClean = '62' + phoneClean;

  const existingLead = await prisma.lead.findUnique({
    where: {
      uk_tenant_phone: { tenant_id: tenantId, phone: phoneClean }
    }
  });

  if (!existingLead) throw new Error('Customer tidak ditemukan');

  await prisma.lead.update({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: phoneClean } },
    data: {
      push_name: nama_lengkap,
      saved_name: nama_lengkap,
      updated_at: new Date()
    }
  });

  const rawFormData = {
    nama_lengkap, no_hp: phoneClean, jenis_kelamin, agama, tempat_lahir,
    tanggal_lahir, kebangsaan, email, alamat, kota, propinsi,
    nomer_telepon, link_sosmed,
    pendidikan_jenjang: jenjang,
    pendidikan_nama_sekolah: sekolah,
    pendidikan_alamat: pend_alamat,
    pendidikan_kota: pend_kota,
    pendidikan_telepon: pend_telepon,
    ortu_nama_ayah, ortu_hp_ayah, ortu_pekerjaan_ayah, ortu_email_ayah,
    ortu_nama_ibu, ortu_hp_ibu, ortu_pekerjaan_ibu, ortu_email_ibu,
    _updated_at: new Date().toISOString()
  };

  const formData = Object.fromEntries(
    Object.entries(rawFormData).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
  );

  const formDataJson = JSON.stringify(formData);

  const lastTrx = await prisma.transaction.findFirst({
    where: { tenant_id: tenantId, user_phone: phoneClean },
    orderBy: { created_at: 'desc' }
  });

  if (lastTrx) {
    let existingData = {};
    try { existingData = JSON.parse(lastTrx.form_data || '{}'); } catch(e) {}
    await prisma.transaction.update({
      where: { id: lastTrx.id },
      data: {
        customer_name: nama_lengkap,
        form_data: JSON.stringify({ ...existingData, ...formData })
      }
    });
  }

  // Labels
  const finalLabelIds = [...label_ids];
  if (new_labels && Array.isArray(new_labels)) {
    for (const labelName of new_labels) {
      if (!labelName || !labelName.trim()) continue;
      const cleanName = labelName.trim();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      try {
        let l = await prisma.serviceLabel.findFirst({ where: { tenant_id: tenantId, label_slug: slug } });
        if (!l) {
          l = await prisma.serviceLabel.create({
            data: { tenant_id: tenantId, label_name: cleanName, label_slug: slug, color: '#6366f1' }
          });
        }
        if (!finalLabelIds.includes(l.id)) finalLabelIds.push(l.id);
      } catch(e) {}
    }
  }

  await prisma.customerServiceLabel.deleteMany({
    where: { tenant_id: tenantId, phone: phoneClean }
  });

  if (finalLabelIds.length > 0) {
    const assigns = finalLabelIds.map(id => ({ tenant_id: tenantId, phone: phoneClean, label_id: id }));
    await prisma.customerServiceLabel.createMany({ data: assigns, skipDuplicates: true });
  }

  return { status: true, message: 'Berhasil mengedit customer' };
};

export const generateAIFollowUp = async (tenantId, phone, instruction) => {
  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } }
  });

  if (!lead) throw new Error('Customer tidak ditemukan');

  const displayName = lead.saved_name || lead.push_name || lead.phone;

  const systemRole = 'Kamu adalah Customer Service yang ramah dan profesional dari lembaga bimbingan belajar/kursus.';

  const prompt = `
  ${systemRole}

  KONTEKS: Kamu sedang melakukan FOLLOW UP / MENGHUBUNGI CUSTOMER AKTIF via WhatsApp.
  NAMA CUSTOMER: ${displayName}

  INSTRUKSI ADMIN:
  ${instruction}

  TUGAS:
  Buatkan pesan WhatsApp berdasarkan instruksi admin di atas.
  - Natural, ramah, dan profesional
  - Gunakan emoji yang sesuai tapi jangan berlebihan
  - Langsung tulis isi pesannya saja, TANPA tanda kutip, TANPA penjelasan tambahan
  - Sapa customer dengan namanya
  `;

  const chatModel = new ChatOpenAI({
    openAIApiKey: AI_CONFIG.apiKey,
    modelName: AI_CONFIG.defaultModel,
    temperature: 0.7,
    maxRetries: 2,
    configuration: { baseURL: AI_CONFIG.baseUrl }
  });

  const response = await chatModel.invoke(prompt);
  let followUpText = response.content || '';
  followUpText = followUpText.replace(/^"|"$/g, '').trim();

  if (!followUpText) throw new Error('AI gagal mengenerate pesan');

  return followUpText;
};

export default { addCustomerManual, editCustomer, getCustomerDetail, generateAIFollowUp };
