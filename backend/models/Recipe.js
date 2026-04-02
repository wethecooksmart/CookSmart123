// models/Recipe.js
const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  // optional numeric id from your JSON data (keep if you import legacy data)
  id: {
    type: Number,
    unique: true,
    sparse: true // allows multiple docs without `id`
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  image: {
    type: String,
    default: null
  },

  ingredients: {
    type: [String],
    required: true,
    default: []
  },

  // instructions can be string or array of steps
  instructions: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  prepTime: {
    type: Number,
    default: 0 // minutes
  },

  cookTime: {
    type: Number,
    default: 0 // minutes
  },

  // we'll compute cookingTime automatically if user doesn't provide one
  cookingTime: {
    type: Number,
    default: null
  },

  servings: {
    type: Number,
    default: 4
  },

  // store difficulty normalized to lowercase
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
    set: v => (typeof v === 'string' ? v.toLowerCase() : v)
  },

  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.5
  },

  likes: {
    type: Number,
    default: 0
  },
 userRatings: [
  {
    sessionId: { type: String },
    userId: { type: String, default: null },
    userName: { type: String, default: 'Anonymous' },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, default: '' },  // ✅ NEW
    createdAt: { type: Date, default: Date.now }
  }
],
  views: {
    type: Number,
    default: 0
  },

  weeklyViews: {
    type: Number,
    default: 0
  },

  lastViewed: {
    type: Date,
    default: null
  },

  isVegetarian: {
    type: Boolean,
    default: false
  },

  tags: {
    type: [String],
    default: []
  },

  nutrition: {
    calories: { type: Number, default: 0 },
    protein_g: { type: Number, default: 0 },
    fat_g: { type: Number, default: 0 },
    carbs_g: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Before save: if cookingTime is not set, compute from prepTime + cookTime
recipeSchema.pre('save', function (next) {
  if (this.cookingTime === null || this.cookingTime === undefined) {
    this.cookingTime = (this.prepTime || 0) + (this.cookTime || 0);
  }
  // ensure difficulty is lowercase (in case someone bypasses the setter)
  if (this.difficulty && typeof this.difficulty === 'string') {
    this.difficulty = this.difficulty.toLowerCase();
  }
  next();
});

// Indexes for common queries
recipeSchema.index({ ingredients: 1 });
recipeSchema.index({ tags: 1 });
recipeSchema.index({ difficulty: 1 });
recipeSchema.index({ name: 'text', description: 'text', tags: 'text' }); // helpful for search

module.exports = mongoose.model('Recipe', recipeSchema);
