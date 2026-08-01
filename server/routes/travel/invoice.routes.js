import express from 'express';
import { invoiceController, invoiceUpload } from '../../controllers/travel/invoice.controller.js';

const router = express.Router();

router.get('/template/:type', invoiceController.getTemplate);
router.post('/template/:type', invoiceController.saveTemplate);
router.put('/template/:type/:id/active', invoiceController.setActiveTemplate);
router.post('/preview', invoiceController.generatePreview);

// Image upload routes
router.post('/uploads', invoiceUpload.single('image'), invoiceController.uploadImage);
router.get('/uploads', invoiceController.getImages);
router.delete('/uploads/:filename', invoiceController.deleteImage);

export default router;
