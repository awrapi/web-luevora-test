/**
 * ================================================================
 * Rental Request Service — Request Lifecycle Management
 * ================================================================
 * Ported from: api_rental_request.php
 */

import { callAI } from '../ai_agent/logic.service.js';
import { sendText } from '../shared/messaging.service.js';
import { saveMessage } from '../shared/chat.service.js';
import { checkAvailability, calculatePrice } from './rentalUnit.service.js';

const generateRentalNotif = async (db, aiConfig, type, data) => {
  let sysRole = 'Kamu adalah Customer Service rental kendaraan yang ramah dan profesional.';
  const sr = await db.knowledgeBase.findFirst({ where: { type: 'system_role' } });
  if (sr && sr.content_text) sysRole = sr.content_text;

  const prompts = {
    approved: `Buat pesan WhatsApp singkat (4-5 kalimat, emoji) memberitahu customer "${data.name}" bahwa permintaan rental DISETUJUI. Unit: ${data.unit_name}. Periode: ${data.start_date} s/d ${data.end_date} (${data.duration_days} hari). Estimasi: Rp ${data.estimated_price}. Informasikan perlu PEMBAYARAN. Langsung tulis isi pesan saja.`,
    rejected: `Buat pesan WhatsApp singkat (3-4 kalimat, emoji) memberitahu customer "${data.name}" bahwa permintaan rental TIDAK DAPAT disetujui. Alasan: ${data.reason}. Sarankan hubungi admin. Langsung tulis isi pesan saja.`,
    rental_active: `Buat pesan WhatsApp singkat (3-4 kalimat, emoji) memberitahu customer "${data.name}" bahwa RENTAL SUDAH AKTIF – pembayaran terverifikasi. Unit: ${data.unit_name}. Periode: ${data.start_date} s/d ${data.end_date}. Unit siap digunakan. Langsung tulis isi pesan saja.`,
  };

  if (!prompts[type]) return '';
  const msg = await callAI(prompts[type], sysRole);
  return msg || '';
};

const sendWaNotif = async (db, phone, message, sessionId) => {
  await sendText(db, phone, message, { sessionId });
  await saveMessage(db, phone, 'assistant', message);
};

export const fetchRequests = async (db, statusFilter = 'all') => {
  console.log(`[RentalRequest] Fetching requests — status=${statusFilter}`);
  
  let whereStr = '';
  if (statusFilter !== 'all') {
    whereStr = `WHERE rr.status = '${statusFilter}'`;
  }

  const data = await db.$queryRawUnsafe(`
    SELECT rr.*, ru.unit_name AS assigned_unit_name, ru.plate_number AS assigned_plate, 
           ru.unit_type AS assigned_unit_type, DATEDIFF(rr.end_date, rr.start_date) AS calc_duration 
    FROM rental_requests rr 
    LEFT JOIN rental_units ru ON rr.approved_unit_id = ru.id 
    ${whereStr}
    ORDER BY CASE rr.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, rr.created_at DESC 
    LIMIT 100
  `);

  const countRows = await db.$queryRaw`SELECT status, COUNT(*) as cnt FROM rental_requests GROUP BY status`;
  const counts = {}; for (const r of countRows) counts[r.status] = Number(r.cnt);

  return { data, counts };
};

export const approveRequest = async (db, aiConfig, { requestId, unitId = 0, adminNote = '', sendFollowup = true, customPrice = 0 }) => {
  console.log(`[RentalRequest] Approving #${requestId}`);
  if (!requestId) throw new Error('Request ID wajib');

  const req = await db.rentalRequest.findFirst({ where: { id: requestId, status: 'pending' } });
  if (!req) throw new Error('Request tidak ditemukan atau sudah diproses');

  let unitName = req.unit_name, plateNumber = '';
  if (unitId) {
    const unit = await db.rentalUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error('Unit tidak ditemukan');
    if (!await checkAvailability(db, unitId, req.start_date, req.end_date)) throw new Error('Unit tidak tersedia pada tanggal tersebut');
    unitName = unit.unit_name;
    plateNumber = unit.plate_number || '';
  }

  const durationDays = req.duration_days || Math.max(1, Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000));
  const estimatedPrice = customPrice > 0 ? customPrice : (unitId ? await calculatePrice(db, unitId, durationDays) : req.estimated_price);

  await db.rentalRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      approved_unit_id: unitId || null,
      admin_note: adminNote,
      estimated_price: estimatedPrice,
      unit_name: unitName,
      duration_days: durationDays,
      actioned_at: new Date(),
      wa_notif_sent: sendFollowup ? 1 : 0,
      payment_status: 'unpaid'
    }
  });

  if (unitId) {
    await db.rentalUnit.update({
      where: { id: unitId },
      data: { status: 'rented', current_renter_phone: req.phone }
    });
  }

  let notifSent = false;
  if (sendFollowup) {
    const name = req.name || req.phone;
    const sDate = req.start_date ? req.start_date.toISOString().split('T')[0] : '';
    const eDate = req.end_date ? req.end_date.toISOString().split('T')[0] : '';
    
    let notifMsg = await generateRentalNotif(db, aiConfig, 'approved', { name, unit_name: unitName, start_date: sDate, end_date: eDate, duration_days: durationDays, estimated_price: estimatedPrice });
    if (!notifMsg) notifMsg = `Halo Kak ${name},\n\nPermintaan rental *${unitName}* Anda telah DISETUJUI! 🎉\n\nSilakan lakukan pembayaran untuk mengonfirmasi booking. Terima kasih! 🙏`;
    await sendWaNotif(db, req.phone, notifMsg, req.session_id);
    notifSent = true;

    const orderId = 'RNT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
      await db.transaction.create({
        data: {
          order_id: orderId,
          user_phone: req.phone,
          sender_name: name,
          customer_name: name,
          destination: `Rental ${unitName}${plateNumber?` (${plateNumber})`:''}`,
          pax_count: 1,
          total_price: estimatedPrice,
          status: 'awaiting_payment',
          form_filled: 1,
          form_data: JSON.stringify({ rental_request_id: requestId, unit_id: unitId, unit_name: unitName, start_date: req.start_date, end_date: req.end_date, duration_days: durationDays, type: 'rental' }),
        }
      });
    } catch (err) { console.log(`[RentalRequest] Failed to create transaction: ${err.message}`); }
  }

  return { message: `Request disetujui!${notifSent?' Follow-up & info pembayaran terkirim.':''}`, price: estimatedPrice };
};

export const rejectRequest = async (db, aiConfig, { requestId, reason, sendFollowup = true }) => {
  console.log(`[RentalRequest] Rejecting #${requestId}`);
  if (!requestId || !reason) throw new Error('ID dan alasan wajib diisi');

  const req = await db.rentalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error('Request tidak ditemukan');

  await db.rentalRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected', reject_reason: reason, admin_note: reason,
      actioned_at: new Date(), wa_notif_sent: sendFollowup ? 1 : 0
    }
  });

  if (sendFollowup) {
    const name = req.name || req.phone;
    let notifMsg = await generateRentalNotif(db, aiConfig, 'rejected', { name, reason });
    if (!notifMsg) notifMsg = `Halo Kak ${name},\n\nMaaf, permintaan rental belum dapat diproses.\n\n❌ Alasan: ${reason}\n\nSilakan hubungi admin. Terima kasih! 🙏`;
    await sendWaNotif(db, req.phone, notifMsg, req.session_id);
  }

  return { message: 'Request ditolak.' };
};

export const activateRental = async (db, aiConfig, requestId, transactionId = 0) => {
  console.log(`[RentalRequest] Activating rental for request #${requestId}`);
  if (!requestId) throw new Error('Request ID wajib');

  const req = await db.rentalRequest.findFirst({ where: { id: requestId, status: 'approved' } });
  if (!req) throw new Error('Request approved tidak ditemukan');

  const unitId = req.approved_unit_id;
  const durationDays = req.duration_days || Math.max(1, Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000));

  let unitName = req.unit_name, plateNumber = '', unitType = req.unit_type;
  if (unitId) {
    const unit = await db.rentalUnit.findUnique({ where: { id: unitId } });
    if (unit) { unitName = unit.unit_name; plateNumber = unit.plate_number||''; unitType = unit.unit_type; }
  }

  await db.activeRental.create({
    data: {
      phone: req.phone,
      name: req.name,
      unit_id: unitId || 0,
      unit_name: unitName,
      unit_type: unitType,
      plate_number: plateNumber,
      start_date: req.start_date,
      end_date: req.end_date,
      duration_days: durationDays,
      total_price: req.estimated_price,
      rental_request_id: requestId,
      transaction_id: transactionId || 0,
      status: 'active'
    }
  });

  await db.rentalRequest.update({
    where: { id: requestId },
    data: { status: 'active', payment_status: 'verified' }
  });

  if (unitId) {
    await db.rentalUnit.update({
      where: { id: unitId },
      data: { status: 'rented', current_renter_phone: req.phone }
    });
  }
  
  // Try update lead
  await db.lead.updateMany({
    where: { phone: req.phone },
    data: { status: 'customer', label: 'customer', updated_at: new Date() }
  });

  const name = req.name || req.phone;
  const sDate = req.start_date ? req.start_date.toISOString().split('T')[0] : '';
  const eDate = req.end_date ? req.end_date.toISOString().split('T')[0] : '';
  let notifMsg = await generateRentalNotif(db, aiConfig, 'rental_active', { name, unit_name: unitName, start_date: sDate, end_date: eDate });
  if (notifMsg) await sendWaNotif(db, req.phone, notifMsg, req.session_id);

  return { message: 'Rental aktif! Notifikasi terkirim ke customer.' };
};

export const saveRequest = async (db, data) => {
  const { phone, name='', message='', session_id, unit_type='', unit_name='', start_date, end_date, duration_raw='', purpose='', pickup_location='' } = data;
  if (!phone || !message) throw new Error('Phone dan message wajib');

  const durationDays = (start_date && end_date) ? Math.max(1, Math.ceil((new Date(end_date).getTime()-new Date(start_date).getTime())/86400000)) : 0;
  
  const existing = await db.rentalRequest.findFirst({
    where: { phone, status: 'pending', unit_type }
  });

  if (existing) {
    await db.rentalRequest.update({
      where: { id: existing.id },
      data: {
        original_message: message, name, unit_name,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        duration_days: durationDays, duration_raw, purpose, pickup_location,
        created_at: new Date()
      }
    });
    return { action: 'updated' };
  }

  await db.rentalRequest.create({
    data: {
      phone, name, session_id, unit_type, unit_name, original_message: message,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      duration_days: durationDays, duration_raw, purpose, pickup_location
    }
  });
  return { action: 'created' };
};

export default { fetchRequests, approveRequest, rejectRequest, activateRental, saveRequest };
