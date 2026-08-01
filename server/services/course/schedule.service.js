/**
 * ================================================================
 * Schedule Service — Course Class & Appointments
 * ================================================================
 * Ported from: api_schedule.php
 * Handles Class schedules, student rosters, follow-up queues.
 * ================================================================
 */

import { callAI } from '../ai_agent/logic.service.js';
import { sendText } from '../shared/messaging.service.js';
import { saveMessage } from '../shared/chat.service.js';

export const fetchSchedules = async (tenantId, db, status = 'all') => {
  console.log(`[Schedule] Fetching schedules for tenant ${tenantId} (status=${status})`);
  let whereStr = `WHERE s.tenant_id = ${tenantId}`;
  if (status !== 'all') {
    whereStr += ` AND s.status = '${status}'`;
  }
  const rows = await db.$queryRawUnsafe(`
    SELECT s.*, 
           (SELECT COUNT(*) FROM schedule_contacts sc WHERE sc.schedule_id = s.id AND sc.tenant_id = ${tenantId} AND sc.status != 'cancelled') as current_booked,
           (SELECT COUNT(*) FROM schedule_contacts sc WHERE sc.schedule_id = s.id AND sc.tenant_id = ${tenantId} AND sc.status = 'pending') as pending_count,
           (SELECT COUNT(*) FROM schedule_contacts sc WHERE sc.schedule_id = s.id AND sc.tenant_id = ${tenantId} AND sc.status = 'confirmed') as confirmed_count
    FROM schedules s
    ${whereStr}
    ORDER BY s.schedule_date DESC, s.schedule_time DESC
  `);
  return rows;
};


export const createSchedule = async (tenantId, db, aiConfig, data) => {
  const { title, schedule_date, schedule_time, max_capacity, description, 
          label_ids = '', manual_phones = '', exclude_phones = '', auto_followup = 1 } = data;

  const newSched = await db.schedule.create({
    data: {
      tenant_id: tenantId,
      title,
      schedule_date: new Date(schedule_date),
      schedule_time: schedule_time || null,
      max_capacity: parseInt(max_capacity) || 10,
      description,
      status: 'active',
      label_ids,
      manual_phones,
      excluded_phones: exclude_phones,
      followup_enabled: parseInt(auto_followup) || 0,
      followup_status: 'idle'
    }
  });

  const contacts = await resolveContacts(tenantId, db, label_ids, manual_phones, exclude_phones);
  
  if (contacts.length > 0) {
    const contactData = contacts.map(c => ({
      tenant_id: tenantId,
      schedule_id: newSched.id,
      phone: c.phone,
      name: c.name,
      source: c.source,
      status: 'pending'
    }));
    await db.scheduleContact.createMany({ data: contactData, skipDuplicates: true });
  }


  await db.schedule.update({
    where: { id: newSched.id },
    data: { total_contacts: contacts.length }
  });

  if (newSched.followup_enabled === 1) {
    await queueFollowup(tenantId, db, aiConfig, newSched.id, title, schedule_date, schedule_time, contacts);
  }


  return { message: 'Jadwal dibuat dan kontak disinkronisasi', total_contacts: contacts.length };
};

const resolveContacts = async (tenantId, db, labelIds, manualPhonesRaw, excludePhonesRaw) => {
  const contacts = [];
  const seen = new Set();
  
  const manualPhones = (manualPhonesRaw||'').split(',').map(s=>s.trim()).filter(s=>s);
  const excludedPhones = (excludePhonesRaw||'').split(',').map(s=>s.trim()).filter(s=>s);

  if (labelIds) {
    const rows = await db.$queryRawUnsafe(`
      SELECT DISTINCT REPLACE(l.phone,'@s.whatsapp.net','') as phone,
             COALESCE(l.saved_name,l.push_name,REPLACE(l.phone,'@s.whatsapp.net','')) as name
      FROM leads l INNER JOIN customer_service_labels csl ON l.phone=csl.phone
      WHERE l.tenant_id = ${tenantId} AND csl.label_id IN (${labelIds}) ORDER BY name ASC
    `);
    for (const r of rows) {
      if (!seen.has(r.phone)) { contacts.push({...r, source:'label'}); seen.add(r.phone); }
    }
  }

  for (const raw of manualPhones) {
    const phone = raw.replace('@s.whatsapp.net','');
    if (!phone || seen.has(phone)) continue;
    const l = await db.lead.findUnique({ 
      where: { uk_tenant_phone: { tenant_id: tenantId, phone } } 
    });
    contacts.push({ phone, name: l?.saved_name || l?.push_name || phone, source: 'manual' }); 
    seen.add(phone);
  }

  if (excludedPhones.length > 0) {
    const ex = new Set(excludedPhones.map(p=>p.replace('@s.whatsapp.net','')));
    return contacts.filter(c => !ex.has(c.phone));
  }
  return contacts;
};

const generateScheduleMessage = async (tenantId, db, aiConfig, schedule, contactName) => {
  let sysRole = 'Kamu adalah Customer Service ramah.';
  const sr = await db.knowledgeBase.findFirst({ where: { tenant_id: tenantId, type: 'system_role' } });
  if (sr && sr.content_text) sysRole = sr.content_text;

  const prompt = `
    Buat pesan WhatsApp singkat mengundang "${contactName}" ke jadwal "${schedule.title}" 
    pada ${schedule.schedule_date} jam ${schedule.schedule_time||'TBA'}. 
    Minta konfirmasi kehadiran. Langsung tulis isi pesan saja.
  `;
  const msg = await callAI(prompt, sysRole);
  return msg || `Halo Kak ${contactName},\nMengingatkan jadwal: *${schedule.title}*\nTgl: ${schedule.schedule_date}\nJam: ${schedule.schedule_time||'TBA'}\n\nMohon konfirmasi kehadirannya ya Kak. Terima kasih!`;
};

const queueFollowup = async (tenantId, db, aiConfig, scheduleId, title, date, time, contacts) => {
  await db.scheduleFollowupQueue.deleteMany({ where: { tenant_id: tenantId, schedule_id: scheduleId, status: 'pending' } });
  
  const schedule = { title, schedule_date: date, schedule_time: time };
  for (const c of contacts) {
    const msg = await generateScheduleMessage(tenantId, db, aiConfig, schedule, c.name);
    await db.scheduleFollowupQueue.create({
      data: { 
        tenant_id: tenantId,
        schedule_id: scheduleId, 
        phone: c.phone, 
        name: c.name, 
        message: msg, 
        status: 'pending' 
      }
    });
  }

  await db.schedule.update({ where: { id: scheduleId }, data: { followup_status: 'processing' } });
};

export const fetchContacts = async (tenantId, db, scheduleId) => {
  return await db.scheduleContact.findMany({
    where: { tenant_id: tenantId, schedule_id: scheduleId },
    orderBy: { name: 'asc' }
  });
};

export const fetchCustomerSchedules = async (tenantId, db) => {
  return await db.customerSchedule.findMany({
    where: { tenant_id: tenantId, status: 'active' },
    orderBy: { schedule_date: 'desc' },
    take: 100
  });
};

export const fetchQueue = async (tenantId, db) => {
  return await db.$queryRaw`
    SELECT q.*, s.title as schedule_title, s.schedule_date 
    FROM schedule_followup_queue q 
    JOIN schedules s ON q.schedule_id = s.id 
    WHERE q.tenant_id = ${tenantId} AND q.status = 'pending' 
    ORDER BY q.id ASC LIMIT 50
  `;
};


export const processFollowupNext = async (db, sessionId) => {
  const next = await db.scheduleFollowupQueue.findFirst({
    where: { status: 'pending' },
    orderBy: { id: 'asc' }
  });

  if (!next) return { status: false, message: 'Queue is empty' };

  await db.scheduleFollowupQueue.update({
    where: { id: next.id },
    data: { status: 'processing', session_id: sessionId }
  });

  await sendText(db, next.phone, next.message, { sessionId });
  await saveMessage(db, next.phone, 'assistant', next.message);

  await db.scheduleFollowupQueue.update({
    where: { id: next.id },
    data: { status: 'sent', sent_at: new Date() }
  });

  await db.scheduleContact.updateMany({
    where: { schedule_id: next.schedule_id, phone: next.phone },
    data: { followup_sent: 1, followup_sent_at: new Date() }
  });

  await db.$queryRaw`
    UPDATE schedules 
    SET followup_sent_count = (SELECT COUNT(*) FROM schedule_contacts WHERE schedule_id=${next.schedule_id} AND followup_sent=1),
        followup_status = CASE 
          WHEN total_contacts <= (SELECT COUNT(*) FROM schedule_contacts WHERE schedule_id=${next.schedule_id} AND followup_sent=1)
          THEN 'completed' ELSE 'processing' END
    WHERE id = ${next.schedule_id}
  `;

  return { status: true, processed_id: next.id, phone: next.phone };
};

export const triggerFollowup = async (tenantId, db, aiConfig, scheduleId) => {
  const s = await db.schedule.findUnique({ where: { id: scheduleId } });
  if (!s || s.tenant_id !== tenantId) throw new Error('Schedule not found');
  
  const contacts = await db.scheduleContact.findMany({ where: { tenant_id: tenantId, schedule_id: scheduleId, followup_sent: 0, is_excluded: 0 } });
  if (contacts.length === 0) return { message: 'Tidak ada kontak yang perlu di-followup' };

  await queueFollowup(tenantId, db, aiConfig, scheduleId, s.title, s.schedule_date.toISOString().split('T')[0], s.schedule_time, contacts);
  return { message: 'Follow up dimasukkan ke antrean processing' };
};


export const confirmContact = async (db, contactId, status) => {
  const allowed = ['confirmed','pending','cancelled'];
  if (!allowed.includes(status)) throw new Error('Status invalid');
  
  await db.scheduleContact.update({
    where: { id: contactId },
    data: { status }
  });
  return { message: `Status kontak diubah ke ${status}` };
};

export default { fetchSchedules, createSchedule, fetchContacts, fetchCustomerSchedules, fetchQueue, processFollowupNext, triggerFollowup, confirmContact };
