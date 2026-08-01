import express from 'express';
import { getNotifications, streamNotifications } from '../../controllers/notification.controller.js';

const router = express.Router();

// GET /api/notifications/stream
router.get('/stream', streamNotifications);

// GET /api/notifications
router.get('/', getNotifications);

export default router;
