import { runAdminCopilot } from '../services/ai_agent/adminCopilot.service.js';
import prisma from '../config/database.js';

/**
 * Endpoint Controller untuk Admin AI Copilot Chat.
 * Mengelola interaksi analitis data CRM secara aman, terisolasi per tenant, dan persisten menggunakan session.
 */
export const handleAdminCopilotChat = async (req, res) => {
  const tenantId = req.tenant?.id;
  const { message, sessionId } = req.body;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Identitas tenant tidak ditemukan. Silakan login kembali.'
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Pesan obrolan wajib diisi.'
    });
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Session ID wajib disertakan untuk melacak memori obrolan.'
    });
  }

  try {
    console.log(`[AdminCopilotController] Menerima request chat untuk tenant_id: ${tenantId}, session: ${sessionId}`);
    const answer = await runAdminCopilot(tenantId, sessionId, message);
    
    return res.status(200).json({
      success: true,
      answer
    });
  } catch (error) {
    console.error('[AdminCopilotController Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses obrolan Anda.'
    });
  }
};

/**
 * Mengambil daftar seluruh sesi percakapan admin untuk tenant aktif.
 */
export const handleGetAdminSessions = async (req, res) => {
  const tenantId = req.tenant?.id;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Identitas tenant tidak ditemukan.'
    });
  }

  try {
    console.log(`[AdminCopilotController] Mengambil daftar sesi untuk tenant: ${tenantId}`);
    const sessionMetaRecords = await prisma.chatHistory.findMany({
      where: {
        tenant_id: tenantId,
        role: 'session_meta',
        user_phone: { startsWith: 'ADMIN_SESSION_' }
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }]
    });

    const sessions = sessionMetaRecords.map(rec => {
      const sessionId = rec.user_phone.replace('ADMIN_SESSION_', '');
      let metaData = { title: 'Percakapan Baru', chat_summary: '' };
      try {
        metaData = JSON.parse(rec.message);
      } catch (e) {}

      return {
        sessionId,
        title: metaData.title,
        chat_summary: metaData.chat_summary,
        created_at: rec.created_at
      };
    });

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('[AdminCopilotController GetSessions Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar riwayat sesi obrolan.'
    });
  }
};

/**
 * Mengambil log riwayat pesan lengkap untuk sesi percakapan admin tertentu.
 */
export const handleGetSessionHistory = async (req, res) => {
  const tenantId = req.tenant?.id;
  const { sessionId } = req.params;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Identitas tenant tidak ditemukan.'
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID wajib disertakan.'
    });
  }

  try {
    console.log(`[AdminCopilotController] Mengambil history pesan sesi: ${sessionId} untuk tenant: ${tenantId}`);
    const records = await prisma.chatHistory.findMany({
      where: {
        tenant_id: tenantId,
        user_phone: `ADMIN_SESSION_${sessionId}`,
        role: { not: 'session_meta' }
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
    });

    const history = records.map(r => ({
      role: r.role,
      message: r.message,
      created_at: r.created_at
    }));

    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error('[AdminCopilotController GetHistory Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat riwayat obrolan sesi ini.'
    });
  }
};

/**
 * Menghapus seluruh riwayat pesan sesi percakapan admin secara permanen.
 */
export const handleDeleteSession = async (req, res) => {
  const tenantId = req.tenant?.id;
  const { sessionId } = req.params;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Identitas tenant tidak ditemukan.'
    });
  }

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID wajib disertakan.'
    });
  }

  try {
    console.log(`[AdminCopilotController] Menghapus sesi: ${sessionId} untuk tenant: ${tenantId}`);
    
    await prisma.chatHistory.deleteMany({
      where: {
        tenant_id: tenantId,
        user_phone: `ADMIN_SESSION_${sessionId}`
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Sesi obrolan berhasil dihapus secara permanen.'
    });
  } catch (error) {
    console.error('[AdminCopilotController DeleteSession Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus sesi obrolan.'
    });
  }
};
