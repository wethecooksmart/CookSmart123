// api/users.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Recipe = require('../models/Recipe');

// GET /api/users/:id/saved - return saved recipes populated
router.get('/:id/saved', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id).populate({ path: 'savedRecipes' }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

  // Also include a normalized list of IDs as strings to make client matching robust
  const savedArr = user.savedRecipes || [];
  const savedIds = savedArr.map(r => String((r && (r._id || r.id)) || r));
  res.json({ success: true, saved: savedArr, savedIds });
  } catch (err) {
    console.error('GET /api/users/:id/saved error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/:id/likes - return liked recipes populated
router.get('/:id/likes', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id).populate({ path: 'likedRecipes' }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

  const likedArr = user.likedRecipes || [];
  const likedIds = likedArr.map(r => String((r && (r._id || r.id)) || r));
  res.json({ success: true, liked: likedArr, likedIds });
  } catch (err) {
    console.error('GET /api/users/:id/likes error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/users/:id - update allowed personal fields on the user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // Debug: log incoming request content-type/length and body keys to diagnose missing update fields
    try {
      const ct = req.headers['content-type'] || '';
      const cl = req.headers['content-length'] || '(unknown)';
      console.log(`PUT /api/users/${id} incoming: content-type=${ct}, content-length=${cl}`);
      if (req.body && typeof req.body === 'object') {
        console.log('PUT body keys:', Object.keys(req.body).slice(0,20));
      } else {
        console.log('PUT body is not an object or empty:', typeof req.body, req.body ? String(req.body).slice(0,200) : req.body);
      }
    } catch (e) { console.warn('Failed to log request diagnostics', e); }

    // Only allow a small set of updatable fields from the client
    // Added 'avatar' to enable uploading/storing user avatar (data URL or image URL)
  const allowed = ['name', 'email', 'contactNumber', 'avatar', 'gender', 'dob'];
    const updates = {};

    // Some clients may send a string body; attempt to parse it into an object for robustness
    let sourceBody = req.body;
    if (typeof sourceBody === 'string' && sourceBody.trim()) {
      try {
        sourceBody = JSON.parse(sourceBody);
        console.log('Parsed string body into object for updates');
      } catch (e) {
        console.warn('Could not parse string body as JSON for updates');
      }
    }

    if (sourceBody && typeof sourceBody === 'object') {
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(sourceBody, key)) {
          updates[key] = sourceBody[key];
        }
      });
    }

    // Validate avatar size if present (data URL). Limit to ~2MB for safety.
    if (updates.avatar && typeof updates.avatar === 'string' && updates.avatar.startsWith('data:')) {
      // approximate base64 payload size: after the comma
      const parts = updates.avatar.split(',');
      const b64 = parts[1] || '';
      // compute bytes: base64 length * 3/4
      const bytes = Math.ceil((b64.length * 3) / 4);
      const MAX_BYTES = 2 * 1024 * 1024; // 2MB
      if (bytes > MAX_BYTES) {
  console.warn(`Rejecting avatar upload for user ${id}: ${bytes} bytes > ${MAX_BYTES}`);
  return res.status(413).json({ message: 'Avatar image too large. Please upload an image under 2MB.' });
      }
    }

    // Validate dob if provided (ISO date string accepted)
    if (updates.dob) {
      const parsed = new Date(updates.dob);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ message: 'Invalid date of birth' });
      updates.dob = parsed;
    }

    if (Object.keys(updates).length === 0) {
      // Provide the received keys back to client for easier debugging
      let receivedKeys = [];
      if (sourceBody && typeof sourceBody === 'object') receivedKeys = Object.keys(sourceBody);
      return res.status(400).json({ message: 'No updatable fields provided', receivedKeys });
    }

  console.log(`Applying updates to user ${id}:`, Object.keys(updates));
  // avoid logging large avatar payloads
  const smallUpdatesLog = Object.assign({}, updates);
  if (smallUpdatesLog.avatar) smallUpdatesLog.avatar = `<data-url ${Math.ceil((smallUpdatesLog.avatar.length - smallUpdatesLog.avatar.indexOf(',') - 1) * 3 / 4)} bytes>`;
  console.log('Update payload preview:', smallUpdatesLog);
  const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

// GET /api/users/:id - return user (without password)
    res.json({ success: true, user });
  } catch (err) {
    console.error('PUT /api/users/:id error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/:id - return user (without password)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('GET /api/users/:id error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
