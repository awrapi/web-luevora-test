import express from 'express';
import { kbMediaController, mediaUpload } from '../../controllers/shared/kbMedia.controller.js';

const router = express.Router();

router.get('/:kbId/media-contexts', kbMediaController.getContexts);
router.post('/:kbId/media-contexts', kbMediaController.createContext);
router.put('/:kbId/media-contexts/:contextId', kbMediaController.updateContext);
router.delete('/:kbId/media-contexts/:contextId', kbMediaController.deleteContext);

router.post('/:kbId/media-contexts/:contextId/upload', mediaUpload.array('files', 10), kbMediaController.uploadFiles);
router.delete('/:kbId/media-files/:fileId', kbMediaController.deleteFile);
// Smart RAG Upload routes
router.post('/:kbId/smart-analyze', mediaUpload.array('files', 10), kbMediaController.smartAnalyze);
router.post('/:kbId/smart-commit', kbMediaController.smartCommit);
router.post('/:kbId/smart-regenerate-title', kbMediaController.smartRegenerateTitle);

export default router;
