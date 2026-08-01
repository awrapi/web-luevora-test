import express from 'express';
import { packageMediaController, mediaUpload } from '../../controllers/travel/packageMedia.controller.js';

const router = express.Router();

router.get('/:packageId/media-contexts', packageMediaController.getContexts);
router.post('/:packageId/media-contexts', packageMediaController.createContext);
router.put('/:packageId/media-contexts/:contextId', packageMediaController.updateContext);
router.delete('/:packageId/media-contexts/:contextId', packageMediaController.deleteContext);

router.post('/:packageId/media-contexts/:contextId/upload', mediaUpload.array('files', 10), packageMediaController.uploadFiles);
router.delete('/:packageId/media-files/:fileId', packageMediaController.deleteFile);

// Smart RAG Upload routes
router.post('/:packageId/smart-analyze', mediaUpload.array('files', 10), packageMediaController.smartAnalyze);
router.post('/:packageId/smart-commit', packageMediaController.smartCommit);
router.post('/:packageId/smart-regenerate-title', packageMediaController.smartRegenerateTitle);

export default router;
