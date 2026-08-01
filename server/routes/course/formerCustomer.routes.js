import express from 'express';
import FormerCustomerController from '../../controllers/course/formerCustomer.controller.js';

const router = express.Router();

router.get('/', FormerCustomerController.getFormerCustomers);
router.post('/:phone/mantanify', FormerCustomerController.moveToFormer);
router.post('/:phone/restore', FormerCustomerController.restoreCustomer);
router.delete('/:phone', FormerCustomerController.deletePermanent);
router.post('/:phone/ai-followup', FormerCustomerController.generateAIFollowUp);

export default router;
