import express from 'express';

const router = express.Router();

// Get products (publicly available for form submission)
router.get('/products', (req, res) => {
  res.json({ status: true, data: [] });
});

// Submit order
router.post('/submit-order', (req, res) => {
  res.json({ status: true, order_id: 'ORD-MOCK' });
});

/**
 * Media Proxy
 * GET /api/public/media/proxy?url=<encoded_url>
 * This avoids the browser's "Sign in" popup when loading media URLs directly.
 */
router.get('/media/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url parameter' });
  }

  try {
    const headers = {};



    const upstream = await fetch(targetUrl, { headers });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream error: ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=86400'); // cache 1 day

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);

  } catch (err) {
    console.error('[MediaProxy] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

export default router;
