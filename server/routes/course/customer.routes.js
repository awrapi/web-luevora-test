import express from 'express';
import CustomerController from '../../controllers/course/customer.controller.js';

const router = express.Router();

// POST /api/course/customers/add
router.post('/add', CustomerController.addCustomerManual);

// GET /api/course/customers/:phone
router.get('/:phone', CustomerController.getCustomerDetail);

// PUT /api/course/customers/:phone
router.put('/:phone', CustomerController.editCustomer);

// POST /api/course/customers/:phone/ai-followup
router.post('/:phone/ai-followup', CustomerController.generateAIFollowUp);

export default router;
