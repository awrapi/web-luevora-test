import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import prisma from '../../config/database.js';
import { processIncomingChat } from '../ai_agent/handler.service.js';
import { saveMessage } from '../shared/chat.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const verifyEmailConnection = async (config) => {
  const client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_port === 993,
    auth: {
      user: config.email_address,
      pass: config.email_password
    },
    logger: false
  });
  
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (err) {
    throw new Error(`Koneksi IMAP gagal: ${err.message}`);
  }
};

export const saveEmailConfig = async (tenantId, configData) => {
  const existing = await prisma.emailAccount.findUnique({
    where: { tenant_id: tenantId }
  });
  if (existing) {
    return await prisma.emailAccount.update({
      where: { tenant_id: tenantId },
      data: configData
    });
  } else {
    return await prisma.emailAccount.create({
      data: { tenant_id: tenantId, ...configData }
    });
  }
};

export const deleteEmailConfig = async (tenantId) => {
  return await prisma.emailAccount.deleteMany({
    where: { tenant_id: tenantId }
  });
};

export const getEmailConfig = async (tenantId) => {
  return await prisma.emailAccount.findUnique({
    where: { tenant_id: tenantId }
  });
};

// --- IN-MEMORY QUEUE (CONCURRENCY LIMITER) ---
class ConcurrencyQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
  }

  async add(task) {
    if (this.active >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
}

// Maksimal 5 koneksi IMAP bersamaan secara global di server ini
const imapQueue = new ConcurrencyQueue(5);

export const syncInbox = async (tenantId) => {
  return await imapQueue.add(async () => {
    const config = await getEmailConfig(tenantId);
    if (!config) throw new Error("Konfigurasi Email belum diatur oleh Admin.");

    const client = new ImapFlow({
      host: config.imap_host,
      port: config.imap_port,
      secure: config.imap_port === 993,
      auth: {
        user: config.email_address,
        pass: config.email_password
      },
      logger: false
    });

    await client.connect();
    let fetchedCount = 0;

    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Fetch latest 50 messages
        const status = await client.status('INBOX', { messages: true });
        const totalMessages = status.messages;
        if (totalMessages === 0) return { fetchedCount: 0 };

        const fetchStart = Math.max(1, totalMessages - 49);
        const seq = `${fetchStart}:*`;

        for await (const message of client.fetch(seq, { source: true, envelope: true })) {
          try {
            const parsed = await simpleParser(message.source);
            const messageId = parsed.messageId || message.envelope.messageId || `fallback-${Date.now()}-${Math.random()}`;
            
            const existing = await prisma.emailMessage.findUnique({
              where: { tenant_id_message_id: { tenant_id: tenantId, message_id: messageId } }
            });

            if (!existing) {
              await prisma.emailMessage.create({
                data: {
                  tenant_id: tenantId,
                  message_id: messageId,
                  subject: parsed.subject || '(Tanpa Subjek)',
                  from_name: parsed.from?.value?.[0]?.name || '',
                  from_email: parsed.from?.value?.[0]?.address || '',
                  to_email: parsed.to?.value?.map(t => t.address).join(', ') || '',
                  body_text: parsed.text || '',
                  body_html: parsed.html || parsed.textAsHtml || '',
                  date_received: parsed.date || new Date(),
                  is_read: message.flags?.has('\\Seen') ? 1 : 0,
                  folder: 'inbox'
                }
              });
              fetchedCount++;

              // --- AI AUTO REPLY LOGIC ---
              if (config.ai_auto_reply === 1) {
                const senderEmail = parsed.from?.value?.[0]?.address || '';
                const subjectLC = (parsed.subject || '').toLowerCase();
                
                // Filter email otomatis (bot, notifikasi, no-reply)
                const isBotEmail = /no-?reply|mailer-?daemon|support|billing|admin|info|newsletter|marketing/i.test(senderEmail);
                const isBotDomain = /@accounts\.google\.com|@canva\.com|@facebook\.com|@bca\.co\.id|@mail\.instagram\.com/i.test(senderEmail);
                const isBotSubject = /notifikasi|security|keamanan|invoice|receipt|reset|password|pembayaran|tagihan|transaction/i.test(subjectLC);
                
                if (senderEmail && !isBotEmail && !isBotDomain && !isBotSubject) {
                  // 1. Map to Lead Pseudo-Phone
                  let lead = await prisma.lead.findFirst({
                    where: { tenant_id: tenantId, email: senderEmail }
                  });

                  if (!lead) {
                    lead = await prisma.lead.create({
                      data: {
                        tenant_id: tenantId,
                        phone: 'EM' + Date.now().toString().slice(-10) + Math.floor(Math.random()*100),
                        email: senderEmail,
                        push_name: parsed.from?.value?.[0]?.name || senderEmail,
                        status: 'baru',
                        label: 'potensial'
                      }
                    });
                  }

                  // 2. Clean Email Text
                  const cleanText = parsed.text ? parsed.text.split(/On .* wrote:/)[0].split(/--/)[0].trim() : parsed.subject;

                  // 3. Simpan email masuk ke memori chat
                  try {
                    await saveMessage(prisma, lead.phone, 'user', cleanText, tenantId);
                  } catch (err) {
                    console.error("[AI Email] Gagal menyimpan memori chat user:", err);
                  }

                  // 4. Process via AI Agent
                  try {
                    const aiRes = await processIncomingChat({
                      tenantId,
                      userPhone: lead.phone,
                      userMessage: cleanText,
                      chatType: 'email'
                    });

                    if (aiRes?.success && aiRes.data?.reply) {
                      // Process attachments if any
                      const aiAttachments = aiRes.data.metadata?.docMediaUrls || [];
                      const nodemailerAttachments = aiAttachments.map(url => {
                        if (url.startsWith('http')) return { href: url };
                        return { path: path.join(__dirname, '../../../', url) };
                      });

                      const replySubject = parsed.subject?.toLowerCase().startsWith('re:') ? parsed.subject : `Re: ${parsed.subject || '(Tanpa Subjek)'}`;
                      let aiReplyRaw = aiRes.data.reply;

                      // --- PROCESS TAGS FOR CRM UPDATE (Like Webhook) ---
                      try {
                        const updateInfoMatch = aiReplyRaw.match(/\[UPDATE_INFO:(.+?)\]/is);
                        if (updateInfoMatch) {
                          const infoContent = updateInfoMatch[1].trim();
                          const extractField = (key) => {
                            const m = infoContent.match(new RegExp(`${key}=(.*?)(?:\\||$)`, 'is'));
                            return m ? m[1].trim() : null;
                          };
                          const isReal = (v) => v && v !== '...' && v !== '-' && v.toLowerCase() !== 'kosong';

                          const fieldMap = {
                            email: 'email', first_name: 'first_name', last_name: 'last_name',
                            position: 'position_title', city: 'city', country: 'country',
                            address: 'full_address', linkedin: 'linkedin_url',
                            social_media: 'social_media', preferences: 'preferences',
                            notes: 'chat_summary', company: 'company_name', industry: 'industry',
                            company_size: 'company_size', annual_revenue: 'annual_revenue',
                            gender: 'gender', lead_source: 'lead_source',
                            comm_pref: 'communication_preference', personal_notes: 'personal_notes',
                            pipeline_status: 'pipeline_status',
                          };

                          const updateData = {};
                          for (const [tagKey, dbCol] of Object.entries(fieldMap)) {
                            const val = extractField(tagKey);
                            if (isReal(val)) updateData[dbCol] = val.replace(/\\n/g, '\n');
                          }

                          const bdRaw = extractField('birth_date');
                          if (isReal(bdRaw)) {
                            let parsed = new Date(bdRaw);
                            if (isNaN(parsed.getTime())) {
                              const parts = bdRaw.split('/');
                              if (parts.length === 3) parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            }
                            if (!isNaN(parsed.getTime())) updateData.birth_date = parsed;
                          }

                          const npsRaw = extractField('nps_score');
                          if (isReal(npsRaw)) {
                            const nps = parseInt(npsRaw, 10);
                            if (!isNaN(nps) && nps >= 0 && nps <= 10) updateData.nps_score = nps;
                          }

                          if (Object.keys(updateData).length > 0) {
                            await prisma.lead.update({
                              where: { uk_tenant_phone: { tenant_id: tenantId, phone: lead.phone } },
                              data: updateData
                            });
                          }
                        }
                      } catch (tagErr) {
                        console.error("[AI Email] Gagal memproses tag AI:", tagErr);
                      }
                      // ----------------------------------------------------

                      // Bersihkan tag-tag sistem AI dari teks email
                      const cleanReply = aiReplyRaw
                        .replace(/\[UPDATE_INFO:.*?\]/gis, '')
                        .replace(/\[PAYMENT_PROOF_DETECTED:.*?\]/gi, '')
                        .replace(/\[OFFER_DETECTED:.*?\]/gi, '')
                        .replace(/\[CUSTOMER_REQUEST:.*?\]/gi, '')
                        .replace(/\[REQUEST:.*?\]/gi, '')
                        .replace(/\[CANCEL_INVOICE\]/gi, '')
                        .replace(/\[MODIFY_INVOICE:.*?\]/gi, '')
                        .replace(/\[ACCEPT_TERMS:.*?\]/gi, '')
                        .replace(/\[REJECT_TERMS:.*?\]/gi, '')
                        .replace(/\[SEND_INVOICE_TO:.*?\]/gi, '')
                        .trim();

                      let htmlReply = await marked.parse(cleanReply);

                      // Tampilkan lampiran secara visual di dalam body email agar terbaca di CRM
                      if (aiAttachments.length > 0) {
                        htmlReply += '<br/><br/><div style="border-top:1px solid #eee; padding-top:15px;"><p><strong>Lampiran Dokumen:</strong></p><div style="display:flex; gap:10px; flex-wrap:wrap;">';
                        
                        aiAttachments.forEach(url => {
                          const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url) || url.includes('image');
                          // Jika URL relatif (lokal), pastikan path-nya benar untuk dirender di frontend, 
                          // namun karena email dikirim ke luar, idealnya harus absolute URL. 
                          // Kita gunakan url as-is untuk frontend CRM, dan lampiran asli (buffer) tetap dikirim via nodemailer
                          
                          if (isImage) {
                            htmlReply += `<img src="${url.startsWith('http') ? url : '/' + url.replace('uploads/', '')}" style="max-width:300px; max-height:300px; border-radius:8px; border:1px solid #ddd;" />`;
                          } else {
                            htmlReply += `<a href="${url.startsWith('http') ? url : '/' + url.replace('uploads/', '')}" target="_blank" style="display:inline-block; padding:8px 12px; background:#f0f6ff; color:#2563eb; text-decoration:none; border-radius:6px;">📄 Buka Dokumen</a>`;
                          }
                        });
                        htmlReply += '</div></div>';
                      }
                      
                      // Automatically send the reply
                      await sendEmail(tenantId, senderEmail, replySubject, htmlReply, nodemailerAttachments);
                      
                      // Simpan balasan AI ke memori chat
                      try {
                        await saveMessage(prisma, lead.phone, 'assistant', cleanReply, tenantId);
                      } catch (err) {
                        console.error("[AI Email] Gagal menyimpan memori chat AI:", err);
                      }
                      
                      console.log(`[AI Email] Otomatis membalas email ke: ${senderEmail}`);
                    }
                  } catch (aiErr) {
                    console.error(`[AI Email] Gagal memproses AI untuk ${senderEmail}:`, aiErr.message);
                  }
                } else {
                  console.log(`[AI Email] Mengabaikan email otomatis dari: ${senderEmail}`);
                }
              }
            }
          } catch (parseErr) {
            console.error("[EmailService] Gagal memparsing pesan:", parseErr);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    return { fetchedCount };
  }); // End of imapQueue.add
};

export const sendEmail = async (tenantId, to, subject, htmlBody, attachments = []) => {
  const config = await getEmailConfig(tenantId);
  if (!config) throw new Error("Konfigurasi Email belum diatur oleh Admin.");

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: {
      user: config.email_address,
      pass: config.email_password
    }
  });

  const info = await transporter.sendMail({
    from: `"${config.email_address}" <${config.email_address}>`,
    to,
    subject,
    html: htmlBody,
    text: htmlBody.replace(/<[^>]+>/g, ''), // simple strip html
    attachments
  });

  // Simpan ke DB sebagai pesan terkirim
  const messageId = info.messageId || `sent-${Date.now()}`;
  await prisma.emailMessage.create({
    data: {
      tenant_id: tenantId,
      message_id: messageId,
      subject: subject || '(Tanpa Subjek)',
      from_email: config.email_address,
      to_email: to,
      body_text: htmlBody.replace(/<[^>]+>/g, ''),
      body_html: htmlBody,
      folder: 'sent',
      is_read: 1,
      date_received: new Date()
    }
  });

  return info;
};

export const getEmails = async (tenantId, folder = 'inbox') => {
  return await prisma.emailMessage.findMany({
    where: { tenant_id: tenantId, folder },
    orderBy: { date_received: 'desc' },
    take: 100
  });
};

export const getEmailThread = async (tenantId, subject, contactEmail) => {
  // Hilangkan awalan Re:, Fwd:, dll untuk mendapatkan subjek dasar
  const baseSubject = subject.replace(/^(Re|Fwd|Reply|Forward):\s*/i, '').trim();
  
  return await prisma.emailMessage.findMany({
    where: { 
      tenant_id: tenantId,
      subject: { contains: baseSubject },
      OR: [
        { from_email: contactEmail },
        { to_email: { contains: contactEmail } }
      ]
    },
    orderBy: { date_received: 'asc' }, // Urutkan dari yang terlama ke terbaru (seperti chat/thread)
    take: 50
  });
};
