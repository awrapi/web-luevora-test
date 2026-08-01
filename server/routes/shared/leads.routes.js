/**
 * ================================================================
 * Leads Routes — Endpoint mapping
 * ================================================================
 * Only defines route definitions and maps them to controllers.
 * NO req.db.query allowed here!
 */

import express from 'express';
import multer from 'multer';
import LeadsController from '../../controllers/shared/leads.controller.js';

const router = express.Router();

// WhatsApp/Zernio accepts up to 25MB for attachments (JPEG, PNG, GIF, MP4, AAC, WAV).
// We allow 25MB to match that limit. Larger files are rejected by WhatsApp anyway.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — matches WhatsApp/Zernio attachment limit
});

// GET /api/leads/list
router.get('/list', LeadsController.fetchLeads);

// GET /api/leads/summary
router.get('/summary', LeadsController.getLeadsSummary);

// GET /api/leads/customers
router.get('/customers', LeadsController.fetchCustomerContacts);

// GET /api/leads/chat
router.get('/chat', LeadsController.fetchChat);

// POST /api/leads/contact/save
router.post('/contact/save', LeadsController.saveContact);

// POST /api/leads/status/update
router.post('/status/update', LeadsController.updateLeadStatus);

// POST /api/leads/mode/set
router.post('/mode/set', LeadsController.setMode);

// POST /api/leads/message/send
router.post('/message/send', LeadsController.sendManualMessage);

// POST /api/leads/message/send-media (multipart: file from device)
// Custom error handler captures multer LIMIT_FILE_SIZE so the controller
// can return a friendly 413 instead of a generic 500.
router.post('/message/send-media', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        req.fileSizeError = err.limit;
      } else {
        return res.status(400).json({ status: false, message: err.message });
      }
    }
    next();
  });
}, LeadsController.sendManualMedia);

// POST /api/leads/message/send-library (send URL-based media from system library)
router.post('/message/send-library', LeadsController.sendLibraryMedia);

// GET /api/leads/library (files already in system: KB, packages, inventory)
router.get('/library', LeadsController.getMediaLibrary);

// POST /api/leads/followup
router.post('/followup', LeadsController.followUp);

// POST /api/leads/crm/update — update profile data of an existing lead
router.post('/crm/update', LeadsController.updateCrmProfile);


// POST /api/leads/crm/create — manually add a new lead to CRM
router.post('/crm/create', LeadsController.createManualLead);

// GET /api/leads/crm/suggestions — contacts with chat history but not in CRM
router.get('/crm/suggestions', LeadsController.getSuggestedContacts);

// POST /api/leads/photo/update — manually update profile photo URL for a lead
router.post('/photo/update', LeadsController.updateProfilePhoto);

export default router;
