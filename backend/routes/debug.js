const express = require('express');
const router = express.Router();

// POST /api/debug/echo -> returns the parsed body and some headers so clients can verify what the server received
router.post('/echo', (req, res) => {
  try {
    const body = req.body;
    const headers = req.headers;
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];
    res.json({ success: true, receivedKeys: keys, receivedBody: body, receivedHeaders: { 'content-type': headers['content-type'], 'content-length': headers['content-length'] } });
  } catch (err) {
    console.error('POST /api/debug/echo error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/debug/echo -> quick health
router.get('/echo', (req, res) => res.json({ success: true, message: 'Debug echo route' }));

module.exports = router;
