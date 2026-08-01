import express from 'express';
import { addonController, addonMediaUpload } from '../../controllers/travel/addon.controller.js';

const router = express.Router();

router.get('/:packageId/addons', addonController.getAddons);
router.post('/:packageId/addons', addonController.createAddon);
router.put('/:packageId/addons/:addonId', addonController.updateAddon);
router.delete('/:packageId/addons/:addonId', addonController.deleteAddon);

router.post('/:packageId/addons/:addonId/upload', addonMediaUpload.array('files', 10), addonController.uploadFiles);
router.delete('/:packageId/addon-files/:fileId', addonController.deleteFile);

export default router;
