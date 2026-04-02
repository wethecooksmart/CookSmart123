// server.js
const path = require('path');
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
// Allow larger JSON payloads for avatar data URLs (base64). Default is small; bump to 10MB.
app.use(express.json({ limit: '10mb' }));
// Also parse URL-encoded bodies with the same limit (in case forms are used)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'))); // serve frontend public files

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// mount authentication router
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
  console.log('✅ Auth router loaded successfully');
} catch (e) {
  console.error('❌ Error loading ./routes/auth:', e.message);
  console.error(e.stack);
}

// mount routers if present
try {
  const recipesRouter = require('./routes/recipes');
  app.use('/api/recipes', recipesRouter);
} catch (e) {
  console.warn('Could not load ./routes/recipes. Falling back to a simple mock route.');
  app.get('/api/recipes', (req, res) => {
    const recipes = [
      { _id: '1', name: 'Tomato Pasta', ingredients: ['tomato','pasta','garlic'], time:20 },
      { _id: '2', name: 'Egg Fried Rice', ingredients: ['rice','egg','soy sauce'], time:15 }
    ];
    res.json(recipes);
  });
}

try {
  const searchRouter = require('./routes/search');
  app.use('/api/search', searchRouter);
} catch (e) {
  console.warn('Could not load ./routes/search. Search routes will be unavailable.');
}

// Mount debug router (small testing helpers)
try {
  const debugRouter = require('./routes/debug');
  app.use('/api/debug', debugRouter);
  console.log('✅ Debug router loaded');
} catch (e) {
  console.warn('Could not load ./routes/debug:', e.message);
}

// mount OTP router for email verification (uses env COOKSMART_EMAIL / COOKSMART_EMAIL_PASSWORD)
try {
  const otpRouter = require('./routes/otp');
  app.use('/api/otp', otpRouter);
  console.log('✅ OTP router loaded');
} catch (e) {
  console.warn('Could not load ./routes/otp:', e.message);
}

try {
  const usersRouter = require('./routes/users');
  app.use('/api/users', usersRouter);
  console.log('✅ Users router loaded');
} catch (e) {
  console.warn('Could not load ./routes/users:', e.message);
}

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

// Test API endpoints
app.get('/api/test', (req, res) => res.json({ success: true, message: 'API is working' }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

async function shutdown() {
  console.log('Shutting down server...');
  try { await mongoose.disconnect(); } catch (e) { console.warn(e.message); }
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (r) => console.error('Unhandled Rejection:', r));
