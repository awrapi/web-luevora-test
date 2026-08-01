import express from 'express';
import { 
  saveEmailConfig, 
  getEmailConfig, 
  deleteEmailConfig,
  syncInbox, 
  sendEmail, 
  getEmails,
  getEmailThread,
  verifyEmailConnection 
} from '../../services/email/email.service.js';

const router = express.Router();

// Get Config
router.get('/config', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const config = await getEmailConfig(tenantId);
    if (!config) return res.json(null);
    
    // Hide password for frontend
    const safeConfig = { ...config };
    safeConfig.email_password = ''; 
    res.json(safeConfig);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save Config
router.post('/config', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { email_address, email_password, imap_host, imap_port, smtp_host, smtp_port, ai_auto_reply } = req.body;
    
    const updateData = { 
      email_address, 
      imap_host, 
      imap_port: parseInt(imap_port || 993), 
      smtp_host, 
      smtp_port: parseInt(smtp_port || 465)
    };
    
    if (ai_auto_reply !== undefined) {
      updateData.ai_auto_reply = ai_auto_reply ? 1 : 0;
    }

    if (email_password) {
      updateData.email_password = email_password;
    } else {
      // Jika ini edit config dan password tidak dikirim, fetch dari DB
      const existing = await getEmailConfig(tenantId);
      if (existing && existing.email_password) {
        updateData.email_password = existing.email_password;
      } else {
        return res.status(400).json({ success: false, message: 'Password (App Password) wajib diisi.' });
      }
    }

    // Validasi koneksi terlebih dahulu
    await verifyEmailConnection(updateData);

    const saved = await saveEmailConfig(tenantId, updateData);
    res.json({ success: true, message: 'Kredensial valid dan Konfigurasi email berhasil disimpan.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete Config
router.delete('/config', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    await deleteEmailConfig(tenantId);
    res.json({ success: true, message: 'Koneksi email berhasil diputus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle AI Auto-Reply ONLY
router.post('/config/ai-toggle', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { ai_auto_reply } = req.body;
    const existingConfig = await getEmailConfig(tenantId);
    if (!existingConfig) return res.status(404).json({ error: 'Config not found' });
    
    // Perform partial update
    const updateData = { ...existingConfig, ai_auto_reply: ai_auto_reply ? 1 : 0 };
    await saveEmailConfig(tenantId, updateData);
    res.json({ success: true, ai_auto_reply: updateData.ai_auto_reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync Inbox
router.post('/sync', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const result = await syncInbox(tenantId);
    res.json({ success: true, message: `Berhasil menarik ${result.fetchedCount} email baru.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Inbox
router.get('/inbox', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const folder = req.query.folder || 'inbox';
    const emails = await getEmails(tenantId, folder);
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Email Thread
router.get('/thread', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { subject, contact } = req.query;
    if (!subject || !contact) return res.json([]);
    
    const thread = await getEmailThread(tenantId, subject, contact);
    res.json(thread);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Email
router.post('/send', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { to, subject, htmlBody } = req.body;
    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ error: 'Harap isi Kepada, Subjek, dan Pesan.' });
    }

    await sendEmail(tenantId, to, subject, htmlBody);
    res.json({ success: true, message: 'Email berhasil dikirim.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
