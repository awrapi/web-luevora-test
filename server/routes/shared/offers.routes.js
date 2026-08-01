import express from 'express';
import { getOffers, approveOffer, rejectOffer } from '../../controllers/offers.controller.js';

const router = express.Router();

router.get('/', getOffers);
router.post('/:id/approve', approveOffer);
router.post('/:id/reject', rejectOffer);

export default router;
