import express from 'express';
import CustomerController from '../../controllers/shared/customer.controller.js';

const router = express.Router();

// GET /api/labels
router.get('/', CustomerController.getLabels);

export default router;
