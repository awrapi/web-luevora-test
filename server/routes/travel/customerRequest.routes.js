import express from 'express';
import {
  getRequests,
  takeOver,
  approveRequest,
  rejectRequest
} from '../../controllers/travel/customerRequest.controller.js';

const router = express.Router();

router.get('/', getRequests);
router.post('/:id/takeover', takeOver);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);

export default router;
