// api/search.js
const express = require('express');
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');

const router = express.Router();

// Reusable connect helper (avoids duplicate connections)
async function connectToDatabase() {
  if (mongoose.connection && mongoose.connection.readyState === 1) return;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI not set in .env');

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

// GET /api/search
// Query params:
//   - ingredients: comma-separated string (e.g. "tomato,egg")
//   - mode: "and" (all ingredients) or "or" (any ingredient) — defaults to "and"
//   - q: full text search across name/description/tags
//   - page, limit: pagination
router.get('/', async (req, res) => {
  try {
    await connectToDatabase();

    const {
      ingredients = '',
      mode = 'and',
      q = '',
      page = 1,
      limit = 20,
      vegetarian // optional: "true" or "false"
    } = req.query;

    const filters = {};

    // ingredients parsing
    const ingredientList = ingredients
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (ingredientList.length > 0) {
      if (mode === 'or') {
        filters.ingredients = { $in: ingredientList };
      } else {
        // default to "and"
        filters.ingredients = { $all: ingredientList };
      }
    }

    // vegetarian filter
    if (typeof vegetarian !== 'undefined') {
      if (vegetarian === 'true' || vegetarian === '1') filters.isVegetarian = true;
      else if (vegetarian === 'false' || vegetarian === '0') filters.isVegetarian = false;
    }

    // text search (requires text index on model)
    let query;
    if (q && q.trim().length > 0) {
      query = Recipe.find({ $text: { $search: q }, ...filters });
    } else {
      query = Recipe.find(filters);
    }

    // pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * lim;

    const [results, total] = await Promise.all([
      query.sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      (q && q.trim().length > 0)
        ? Recipe.countDocuments({ $text: { $search: q }, ...filters })
        : Recipe.countDocuments(filters)
    ]);

    res.json({
      page: pageNum,
      limit: lim,
      total,
      results
    });
  } catch (err) {
    console.error('GET /api/search error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// A helper route that returns matching ingredient suggestions (optional)
// GET /api/search/ingredients?s=tom
router.get('/ingredients', async (req, res) => {
  try {
    await connectToDatabase();
    const s = (req.query.s || '').trim().toLowerCase();
    if (!s) return res.json({ suggestions: [] });

    // aggregation to get distinct ingredients that match prefix
    const agg = [
      { $unwind: '$ingredients' },
      { $project: { ingredient: { $toLower: '$ingredients' } } },
      { $match: { ingredient: { $regex: `^${escapeRegExp(s)}` } } },
      { $group: { _id: '$ingredient', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ];

    const rows = await Recipe.aggregate(agg);
    res.json({ suggestions: rows.map(r => r._id) });
  } catch (err) {
    console.error('GET /api/search/ingredients error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
