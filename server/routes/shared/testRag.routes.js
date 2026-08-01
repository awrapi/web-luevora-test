import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testRagService } from '../../services/test_rag/testRag.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../../uploads/test-rag');

// Ensure upload dir exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `testrag_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.xls', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 500 * 1024 * 1024 }
});

const router = express.Router();

// Upload document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const sessionId = req.body.sessionId || 'default';
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await testRagService.uploadDocument(sessionId, req.file);
    return res.json(result);
  } catch (err) {
    console.error('[TestRAG] Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Chat
router.post('/chat', async (req, res) => {
  try {
    const { sessionId = 'default', message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const result = await testRagService.chat(sessionId, message);
    return res.json(result);
  } catch (err) {
    console.error('[TestRAG] Chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get logs
router.get('/logs/:sessionId', (req, res) => {
  const logs = testRagService.getLogs(req.params.sessionId);
  return res.json(logs);
});

// Get session info
router.get('/session/:sessionId', (req, res) => {
  const info = testRagService.getSession(req.params.sessionId);
  return res.json(info);
});

// Reset session
router.post('/reset', async (req, res) => {
  const { sessionId = 'default' } = req.body;
  const result = await testRagService.resetSession(sessionId);
  return res.json(result);
});

export default router;
