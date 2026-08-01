import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import * as SubscriptionController from '../../controllers/shared/subscription.controller.js';

const router = express.Router();

router.post('/transaction', authMiddleware, SubscriptionController.createTransaction);
router.post('/webhook', SubscriptionController.midtransWebhook);
router.get('/status', authMiddleware, SubscriptionController.getSubscriptionStatus);

export default router;
