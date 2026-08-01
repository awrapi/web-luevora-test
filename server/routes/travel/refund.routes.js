import express from 'express';
import { refundController } from '../../controllers/travel/refund.controller.js';

const router = express.Router();

// GET /api/refunds
router.get('/', refundController.getRefunds);

// PUT /api/refunds/:id
router.put('/:id', refundController.updateRefund);

export default router;
