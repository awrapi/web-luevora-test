/**
 * ================================================================
 * Leads Controller — HTTP Request Handler
 * ================================================================
 * Extracts data from req/res and calls the LeadsService.
 */

import LeadsService from '../../services/shared/leads.service.js';
import { AI_CONFIG } from '../../config/ai.js';

export const fetchLeads = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { filter, search, exclude_customer } = req.query;

    const leads = await LeadsService.fetchLeads(tenantId, {
      filter,
      search,
      excludeCustomer: exclude_customer === '1' || exclude_customer === 'true'
    });

    res.json({ status: true, data: leads });
  } catch (err) {
    next(err);
  }
};

export const getLeadsSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const summary = await LeadsService.getLeadsSummary(tenantId);
    res.json({ status: true, data: summary });
  } catch (err) {
    next(err);
  }
};

export const fetchCustomerContacts = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const contacts = await LeadsService.fetchCustomerContacts(tenantId);
    res.json({ status: true, data: contacts });
  } catch (err) {
    next(err);
  }
};

export const fetchChat = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Parameter phone wajib diisi' });
    }

    const data = await LeadsService.fetchChat(tenantId, phone);
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const saveContact = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, name } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ status: false, message: 'Phone dan Name wajib diisi' });
    }

    const result = await LeadsService.saveContact(tenantId, phone, name);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const updateLeadStatus = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, status, label } = req.body;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const result = await LeadsService.updateLeadStatus(tenantId, phone, { status, label });
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const setMode = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, is_manual } = req.body;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const result = await LeadsService.setMode(tenantId, phone, is_manual);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const sendManualMessage = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ status: false, message: 'Phone dan message wajib diisi' });
    }

    const result = await LeadsService.sendManualMessage(tenantId, phone, message);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const sendManualMedia = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, caption = '' } = req.body;
    const file = req.file;

    // Multer LIMIT_FILE_SIZE error is attached to req by multer middleware
    if (req.fileSizeError) {
      return res.status(413).json({
        status: false,
        message: `File terlalu besar. Maksimal 25MB (batas WhatsApp). File Anda: ${(req.fileSizeError / 1024 / 1024).toFixed(1)}MB`
      });
    }

    if (!phone) return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    if (!file) return res.status(400).json({ status: false, message: 'File wajib diunggah' });

    const result = await LeadsService.sendManualMedia(tenantId, phone, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      caption
    });
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const sendLibraryMedia = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, mediaUrl, caption = '', filename = 'file' } = req.body;

    if (!phone || !mediaUrl) return res.status(400).json({ status: false, message: 'Phone dan mediaUrl wajib diisi' });

    const result = await LeadsService.sendLibraryMedia(tenantId, phone, { mediaUrl, caption, filename });
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getMediaLibrary = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const groups = await LeadsService.getMediaLibrary(tenantId);
    res.json({ status: true, data: groups });
  } catch (err) {
    next(err);
  }
};

export const followUp = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const result = await LeadsService.followUp(tenantId, AI_CONFIG, phone);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const updateCrmProfile = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, ...fields } = req.body;
    if (!phone) return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    const result = await LeadsService.updateCrmProfile(tenantId, phone, fields);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const createManualLead = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const result = await LeadsService.createManualLead(tenantId, req.body || {});
    res.status(201).json({ status: true, ...result });
  } catch (err) {
    if (err.message?.includes('wajib diisi') || err.message?.includes('sudah ada')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const getSuggestedContacts = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const data = await LeadsService.getSuggestedContacts(tenantId);
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateProfilePhoto = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone, photo_url } = req.body;
    if (!phone) return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    const result = await LeadsService.updateProfilePhoto(tenantId, phone, photo_url);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export default {
  fetchLeads,
  getLeadsSummary,
  fetchCustomerContacts,
  fetchChat,
  saveContact,
  updateLeadStatus,
  setMode,
  sendManualMessage,
  sendManualMedia,
  sendLibraryMedia,
  getMediaLibrary,
  followUp,
  updateCrmProfile,
  createManualLead,
  getSuggestedContacts,
  updateProfilePhoto,
};
