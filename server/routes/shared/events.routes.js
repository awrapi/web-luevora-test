import express from 'express';
import { addClient, removeClient } from '../../services/shared/sse.service.js';

const router = express.Router();

/**
 * SSE Stream Endpoint
 * GET /api/events/stream?tenantId=7
 * Dashboard connects here to receive real-time push notifications.
 */
router.get('/stream', (req, res) => {
  const tenantId = parseInt(req.query.tenantId, 10);
  if (!tenantId) {
    return res.status(400).json({ status: false, message: 'tenantId is required' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected', tenantId })}\n\n`);

  // Register this client
  addClient(tenantId, res);

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(tenantId, res);
  });
});

export default router;
