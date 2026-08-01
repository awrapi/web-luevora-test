import express from 'express';
import { getTopics, createTopic, updateTopic, deleteTopic, uploadKbMedia } from '../../controllers/shared/knowledgeBase.controller.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', getTopics);
router.post('/', createTopic);
router.put('/:id', updateTopic);
router.delete('/:id', deleteTopic);
router.post('/upload-media', upload.single('file'), uploadKbMedia);

export default router;
