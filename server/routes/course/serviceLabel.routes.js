import express from 'express';
import ServiceLabelController from '../../controllers/course/serviceLabel.controller.js';

const router = express.Router();

router.get('/', ServiceLabelController.getServiceLabels);
router.post('/', ServiceLabelController.createServiceLabel);
router.put('/:id', ServiceLabelController.updateServiceLabel);
router.delete('/:id', ServiceLabelController.deleteServiceLabel);

export default router;
