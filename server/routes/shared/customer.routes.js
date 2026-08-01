import express from 'express';
import CustomerController from '../../controllers/shared/customer.controller.js';
import InteractionLogController from '../../controllers/shared/interactionLog.controller.js';

const router = express.Router();

// GET /api/customers
router.get('/', CustomerController.getCustomerList);

// GET /api/customers/labels
router.get('/labels', CustomerController.getLabels);

// POST /api/customers
router.post('/', CustomerController.createCustomer);

// GET /api/customers/:phone
router.get('/:phone', CustomerController.getCustomerDetail);

// GET /api/customers/:phone/chat
router.get('/:phone/chat', CustomerController.getCustomerChat);

// POST /api/customers/:phone/messages
router.post('/:phone/messages', CustomerController.sendCustomerMessage);

// POST /api/customers/:phone/follow-up
router.post('/:phone/follow-up', CustomerController.followUpCustomer);

// GET /api/customers/:phone/history
router.get('/:phone/history', CustomerController.getCustomerCrmHistory);

// --- Interaction Log Routes ---
// GET /api/customers/:phone/interactions
router.get('/:phone/interactions', InteractionLogController.getInteractionLogs);

// POST /api/customers/:phone/interactions
router.post('/:phone/interactions', InteractionLogController.createInteractionLog);

// DELETE /api/customers/:phone/interactions/:logId
router.delete('/:phone/interactions/:logId', InteractionLogController.deleteInteractionLog);

export default router;
