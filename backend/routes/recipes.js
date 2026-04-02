// api/recipes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');

let isConnected = false;

async function connectToDatabase() {
  // avoid reconnecting if mongoose is already connected
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI not set in .env');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  isConnected = true;
}

// GET /api/recipes/trending
router.get('/trending', async (req, res) => {
  try {
    await connectToDatabase();

    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    // Calculate trending score: weeklyViews * 0.7 + likes * 0.3
    // Sort by this score, then by rating
    const trendingRecipes = await Recipe.find({
      lastViewed: { $gte: weekStart }
    })
    .sort({ 
      weeklyViews: -1, 
      likes: -1, 
      rating: -1,
      createdAt: -1 
    })
    .limit(6)
    .lean();

    // If we don't have enough weekly recipes, fill with all-time popular
    if (trendingRecipes.length < 6) {
      const additionalRecipes = await Recipe.find({
        _id: { $nin: trendingRecipes.map(r => r._id) }
      })
      .sort({ 
        likes: -1, 
        views: -1, 
        rating: -1,
        createdAt: -1 
      })
      .limit(6 - trendingRecipes.length)
      .lean();

      trendingRecipes.push(...additionalRecipes);
    }

    res.json(trendingRecipes.slice(0, 6));
  } catch (err) {
    console.error('GET /api/recipes/trending error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/recipes/:id/view - increment view count
router.post('/:id/view', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;

    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id: Number(id) };
    
    // Get current week start
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    // Check if lastViewed is within current week
    const recipe = await Recipe.findOne(filter);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const needsWeeklyReset = !recipe.lastViewed || recipe.lastViewed < weekStart;
    
    const update = {
      $inc: { views: 1 },
      lastViewed: now
    };

    if (needsWeeklyReset) {
      update.weeklyViews = 1;
    } else {
      update.$inc.weeklyViews = 1;
    }

    const updated = await Recipe.findOneAndUpdate(filter, update, { new: true }).lean();
    res.json({ success: true, views: updated.views, weeklyViews: updated.weeklyViews });
  } catch (err) {
    console.error('POST /api/recipes/:id/view error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/recipes
// supports: q (text search), ingredient, page, limit
router.get('/', async (req, res) => {
  try {
    await connectToDatabase();

    const { q, ingredient, page = 1, limit = 20 } = req.query;
    const filters = {};

    if (ingredient) {
      // match ingredient in the ingredients array (case-insensitive)
      filters.ingredients = { $regex: new RegExp(ingredient, 'i') };
    }

    let query = Recipe.find(filters);

    if (q) {
      // text search (requires the text index added in model)
      query = Recipe.find({ $text: { $search: q } });
    }

    // pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * lim;

    const [items, total] = await Promise.all([
      query.sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Recipe.countDocuments(q ? { $text: { $search: q } } : filters)
    ]);

    res.json({
      page: pageNum,
      limit: lim,
      total,
      results: items
    });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/recipes/:id  (supports Mongo _id or numeric legacy id)
router.get('/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;

    let recipe = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      recipe = await Recipe.findById(id).lean();
    }
    if (!recipe) {
      // try numeric legacy id
      const num = Number(id);
      if (!Number.isNaN(num)) {
        recipe = await Recipe.findOne({ id: num }).lean();
      }
    }

    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/recipes  create new recipe
router.post('/', async (req, res) => {
  try {
    await connectToDatabase();
    const payload = req.body;

    // minimal validation
    if (!payload.name || !payload.ingredients || !payload.instructions) {
      return res.status(400).json({ message: 'Missing required fields: name, ingredients, instructions' });
    }

    const recipe = new Recipe(payload);
    const saved = await recipe.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    // duplicate id or validation errors
    if (err.name === 'MongoServerError' && err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate key', error: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/recipes/:id  update
router.put('/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const payload = req.body;

    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id: Number(id) };
    const updated = await Recipe.findOneAndUpdate(filter, payload, { new: true, runValidators: true }).lean();

    if (!updated) return res.status(404).json({ message: 'Recipe not found' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/recipes/:id error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id: Number(id) };

    const deleted = await Recipe.findOneAndDelete(filter).lean();
    if (!deleted) return res.status(404).json({ message: 'Recipe not found' });

    res.json({ message: 'Deleted', deleted });
  } catch (err) {
    console.error('DELETE /api/recipes/:id error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/recipes/:id/like - toggle like for a recipe
router.post('/:id/like', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id: Number(id) };
    const recipe = await Recipe.findOne(filter);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Use equals to compare ObjectId values reliably
    const isLiked = user.likedRecipes.some(r => r && r.equals && r.equals(recipe._id));
    
    if (isLiked) {
      // Unlike: remove from user's liked recipes and decrement count
      user.likedRecipes = user.likedRecipes.filter(r => !(r && r.equals && r.equals(recipe._id)));
      recipe.likes = Math.max(0, recipe.likes - 1);
    } else {
      // Like: add to user's liked recipes and increment count
      user.likedRecipes.push(recipe._id);
      recipe.likes += 1;
    }

    await user.save();
    await recipe.save();

    res.json({ 
      success: true, 
      liked: !isLiked, 
      likes: recipe.likes 
    });
  } catch (err) {
    console.error('POST /api/recipes/:id/like error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/recipes/:id/save - toggle save for a recipe
router.post('/:id/save', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id: Number(id) };
    const recipe = await Recipe.findOne(filter);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isSaved = user.savedRecipes.some(r => r && r.equals && r.equals(recipe._id));
    
    if (isSaved) {
      // Unsave: remove from user's saved recipes
      user.savedRecipes = user.savedRecipes.filter(r => !(r && r.equals && r.equals(recipe._id)));
    } else {
      // Save: add to user's saved recipes
      user.savedRecipes.push(recipe._id);
    }

    await user.save();

    res.json({ 
      success: true, 
      saved: !isSaved
    });
  } catch (err) {
    console.error('POST /api/recipes/:id/save error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// POST /api/recipes/:id/rate - submit star rating
// POST /api/recipes/:id/rate
router.post('/:id/rate', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const { rating, sessionId, review, userName } = req.body; // ✅ added review & userName

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    // Check if already rated
    const alreadyRated = recipe.userRatings.find(r => r.sessionId === sessionId);
    if (alreadyRated) {
      return res.status(400).json({ message: 'You have already rated this recipe' });
    }

    // Add new rating + review
    recipe.userRatings.push({
      sessionId,
      userName: userName || 'Anonymous',
      rating,
      review: review || ''
    });

    // Recalculate average
    const total = recipe.userRatings.length;
    const sum = recipe.userRatings.reduce((acc, r) => acc + r.rating, 0);
    recipe.rating = parseFloat((sum / total).toFixed(1));

    await recipe.save();

    res.json({ success: true, newRating: recipe.rating, totalRatings: total });

  } catch (err) {
    console.error('POST /api/recipes/:id/rate error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ NEW - GET /api/recipes/:id/reviews - get all reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(id).select('userRatings name');
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    // Only return reviews that have text
    const reviews = recipe.userRatings
      .filter(r => r.review && r.review.trim() !== '')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, reviews });

  } catch (err) {
    console.error('GET /api/recipes/:id/reviews error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
module.exports = router;
