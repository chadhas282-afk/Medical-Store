const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==========================================
// 1. DATABASE & CONNECTION CACHE (SERVERLESS SAFE)
// ==========================================
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, indexesSynced: false };
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-inventory';
const isProduction = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'pharmatrack-dev-secret-change-me';

if (isProduction && !process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set in production. Using fallback secret. Please configure JWT_SECRET in environment variables.');
}

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      autoIndex: !isProduction,
    };

    mongoose.set('debug', process.env.MONGOOSE_DEBUG === 'true');

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (m) => {
      console.log('Connected to MongoDB');
      if (!cached.indexesSynced && !isProduction) {
        try {
          await Promise.all([Medicine.syncIndexes(), StockLog.syncIndexes(), Sale.syncIndexes(), User.syncIndexes()]);
          cached.indexesSynced = true;
        } catch (e) {
          console.warn('Index sync notice:', e.message);
        }
      }
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// ==========================================
// 2. MONGOOSE MODELS
// ==========================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: { type: String },
  category: { type: String, required: true },
  batchNumber: { type: String, required: true },
  manufacturer: { type: String },
  supplier: { type: String },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  manufacturingDate: { type: Date },
  lowStockThreshold: { type: Number, default: 10 },
  location: { type: String },
  notes: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
medicineSchema.index({ userId: 1, expiryDate: 1 });
medicineSchema.index({ userId: 1, quantity: 1 });
medicineSchema.index({ userId: 1, createdAt: -1 });
medicineSchema.index({ name: 'text', genericName: 'text', batchNumber: 'text' });
const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', medicineSchema);

const stockLogSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  medicineName: { type: String, required: true },
  batchNumber: { type: String },
  action: { type: String, enum: ['created', 'updated', 'stock-in', 'stock-out', 'deleted'], required: true },
  quantityChange: { type: Number, default: 0 },
  quantityBefore: { type: Number },
  quantityAfter: { type: Number },
  note: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
stockLogSchema.index({ userId: 1, medicineId: 1, createdAt: -1 });
stockLogSchema.index({ userId: 1, createdAt: -1 });
const StockLog = mongoose.models.StockLog || mongoose.model('StockLog', stockLogSchema);

const saleSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  medicineName: { type: String, required: true },
  batchNumber: { type: String },
  category: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true },
  soldBy: { type: String, default: 'staff' },
  kind: { type: String, enum: ['sale', 'return'], default: 'sale' },
  note: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  soldAt: { type: Date, default: Date.now }
});
saleSchema.index({ userId: 1, soldAt: -1 });
saleSchema.index({ userId: 1, medicineId: 1, soldAt: -1 });
const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema);

// ==========================================
// 3. HELPERS & MIDDLEWARE
// ==========================================
async function logStock({ medicineId, medicineName, batchNumber, action, quantityChange, quantityBefore, quantityAfter, note, userId }) {
  try {
    await StockLog.create({
      medicineId,
      medicineName,
      batchNumber,
      action,
      quantityChange,
      quantityBefore,
      quantityAfter,
      note,
      userId
    });
  } catch (err) {
    console.error('Failed to write stock log:', err.message);
  }
}

function parsePagination(query, { defaultLimit = 50, maxLimit = 500 } = {}) {
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, skip: (page - 1) * limit };
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function signToken(user) {
  return jwt.sign({ uid: user._id.toString() }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
  return { _id: user._id, name: user.name, email: user.email };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.uid);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

const rateBuckets = new Map();
function createRateLimit({ windowMs, max, name }) {
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const key = `${ip}:${name}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || entry.reset < now) {
      rateBuckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateBuckets) {
    if (entry.reset < now) rateBuckets.delete(key);
  }
}, 60000).unref();

// ==========================================
// 4. EXPRESS APP CONFIGURATION
// ==========================================
const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Trigger initial connection
connectDB().catch(err => {
  console.error('Initial MongoDB connection notice:', err.message);
});

// Database connectivity assurance middleware
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();

  if (mongoose.connection.readyState === 1) return next();

  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error during request:', err.message);
    if (req.path.startsWith('/api')) {
      return res.status(503).json({
        error: 'Database connection failed. Please ensure MONGODB_URI is configured correctly.',
        details: err.message
      });
    }
    next(err);
  }
});

// ==========================================
// 5. PUBLIC API ROUTES
// ==========================================
app.get('/api', (req, res) => {
  res.json({
    name: 'PharmaTrack API',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  let dbError = null;
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      dbError = err.message;
    }
  }

  const dbState = mongoose.connection.readyState;
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const hasUri = !!process.env.MONGODB_URI;
  const maskedUri = hasUri
    ? process.env.MONGODB_URI.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
    : 'NOT_SET (fallback to localhost:27017)';

  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'ok' : 'degraded',
    database: dbStates[dbState] || 'unknown',
    uri_configured: hasUri,
    uri_preview: maskedUri,
    error: dbError,
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
const authLimiter = createRateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: 'auth' });

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();

    if (!trimmedName) return res.status(400).json({ error: 'Name is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      passwordHash: await bcrypt.hash(String(password), 10),
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'No account found with that email' });

    const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password. Try again.' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const valid = await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    req.user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await req.user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. PROTECTED API ROUTES
// ==========================================
app.use('/api', requireAuth);

// --- MEDICINES ---
app.get('/api/medicines', async (req, res) => {
  try {
    const { search, category, status, sortBy, sortOrder } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const query = { userId: req.user._id };

    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (status) {
      const now = new Date();
      if (status === 'expired') {
        query.expiryDate = { $lt: now };
      } else if (status === 'expiring-soon') {
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        query.expiryDate = { $gte: now, $lte: thirtyDays };
      } else if (status === 'expiring-later') {
        const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        query.expiryDate = { $gt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), $lte: sixtyDays };
      } else if (status === 'low-stock') {
        query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
      }
    }

    const allowedSort = ['name', 'genericName', 'category', 'quantity', 'unitPrice', 'expiryDate', 'manufacturer', 'batchNumber', 'createdAt', 'updatedAt'];
    const sort = {};
    if (sortBy && allowedSort.includes(sortBy)) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.expiryDate = 1;
    }

    const medicines = await Medicine.find(query).sort(sort).skip(skip).limit(limit).lean();
    const total = await Medicine.countDocuments(query);

    res.json({ medicines, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/alerts', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const expired = await Medicine.find({ userId: req.user._id, expiryDate: { $lt: now } }).sort({ expiryDate: 1 }).lean();
    const expiringSoon = await Medicine.find({ userId: req.user._id, expiryDate: { $gte: now, $lte: thirtyDays } }).sort({ expiryDate: 1 }).lean();
    const expiringLater = await Medicine.find({ userId: req.user._id, expiryDate: { $gt: thirtyDays, $lte: sixtyDays } }).sort({ expiryDate: 1 }).lean();
    const lowStock = await Medicine.find({ userId: req.user._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }).sort({ quantity: 1 }).lean();

    res.json({
      expired: expired.map(m => ({ ...m, alertType: 'expired', daysRemaining: Math.ceil((m.expiryDate - now) / (1000 * 60 * 60 * 24)) })),
      expiringSoon: expiringSoon.map(m => ({ ...m, alertType: 'expiring-soon', daysRemaining: Math.ceil((m.expiryDate - now) / (1000 * 60 * 60 * 24)) })),
      expiringLater: expiringLater.map(m => ({ ...m, alertType: 'expiring-later', daysRemaining: Math.ceil((m.expiryDate - now) / (1000 * 60 * 60 * 24)) })),
      lowStock: lowStock.map(m => ({ ...m, alertType: 'low-stock' }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/stats', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const totalMedicines = await Medicine.countDocuments({ userId: req.user._id });
    const expiredCount = await Medicine.countDocuments({ userId: req.user._id, expiryDate: { $lt: now } });
    const expiringSoonCount = await Medicine.countDocuments({ userId: req.user._id, expiryDate: { $gte: now, $lte: thirtyDays } });
    const expiringLaterCount = await Medicine.countDocuments({ userId: req.user._id, expiryDate: { $gt: thirtyDays, $lte: sixtyDays } });
    const lowStockCount = await Medicine.countDocuments({ userId: req.user._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } });

    const totalValue = await Medicine.aggregate([
      { $match: { userId: req.user._id } },
      { $project: { totalValue: { $multiply: ['$quantity', '$unitPrice'] } } },
      { $group: { _id: null, total: { $sum: '$totalValue' } } }
    ]);

    const categories = await Medicine.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const nearestExpiry = await Medicine.findOne({ userId: req.user._id, expiryDate: { $gte: new Date() } })
      .sort({ expiryDate: 1 })
      .select('name batchNumber expiryDate quantity unitPrice')
      .lean();

    const expiryBuckets = await Medicine.aggregate([
      { $match: { userId: req.user._id } },
      {
        $project: {
          days: { $floor: { $divide: [{ $subtract: ['$expiryDate', now] }, 86400000] } }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$days', 0] }, then: 'expired' },
                { case: { $lt: ['$days', 31] }, then: '0-30' },
                { case: { $lt: ['$days', 61] }, then: '31-60' },
                { case: { $lt: ['$days', 91] }, then: '61-90' },
                { case: { $lt: ['$days', 181] }, then: '91-180' },
              ],
              default: '180+'
            }
          },
          count: { $sum: 1 },
          value: { $sum: { $multiply: ['$quantity', '$unitPrice'] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalMedicines,
      expiredCount,
      expiringSoonCount,
      expiringLaterCount,
      lowStockCount,
      totalValue: totalValue[0]?.total || 0,
      categories,
      nearestExpiry,
      expiryBuckets
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/check-duplicate', async (req, res) => {
  try {
    const { name, batchNumber } = req.query;
    if (!name || !batchNumber) return res.status(400).json({ error: 'name and batchNumber are required' });

    const duplicate = await Medicine.findOne({
      _id: { $ne: req.query.id || null },
      userId: req.user._id,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      batchNumber: { $regex: new RegExp(`^${escapeRegex(batchNumber)}$`, 'i') }
    }).lean();

    res.json({ isDuplicate: !!duplicate, duplicate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/reorder', async (req, res) => {
  try {
    const medicines = await Medicine.find({ userId: req.user._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }).lean();
    const suggestions = medicines.map(m => {
      const suggested = Math.max(m.lowStockThreshold * 3 - m.quantity, m.lowStockThreshold - m.quantity);
      return {
        _id: m._id,
        name: m.name,
        category: m.category,
        batchNumber: m.batchNumber,
        location: m.location,
        quantity: m.quantity,
        lowStockThreshold: m.lowStockThreshold,
        suggestedQuantity: suggested,
        expiryDays: Math.ceil((new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
      };
    }).sort((a, b) => (a.quantity / Math.max(a.lowStockThreshold, 1)) - (b.quantity / Math.max(b.lowStockThreshold, 1)));

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medicines/import', async (req, res) => {
  try {
    const items = req.body && Array.isArray(req.body.medicines) ? req.body.medicines : null;
    if (!items) return res.status(400).json({ error: 'Request body must include a medicines array' });

    const created = [];
    const skipped = [];
    const errors = [];

    for (const item of items) {
      const name = String(item.name || '').trim();
      const batchNumber = String(item.batchNumber || '').trim();
      const category = String(item.category || '').trim();

      if (!name || !batchNumber || !category) {
        errors.push({ name, batchNumber, reason: 'Name, Category, and Batch Number are required' });
        continue;
      }
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push({ name, batchNumber, reason: 'Quantity and Unit Price must be valid non-negative numbers' });
        continue;
      }
      const expiry = new Date(item.expiryDate);
      if (isNaN(expiry.getTime())) {
        errors.push({ name, batchNumber, reason: 'Invalid Expiry Date' });
        continue;
      }

      const duplicate = await Medicine.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        batchNumber: { $regex: new RegExp(`^${escapeRegex(batchNumber)}$`, 'i') }
      }).lean();

      if (duplicate) {
        skipped.push({ name, batchNumber, reason: 'Duplicate name + batch already exists' });
        continue;
      }

      const mfg = item.manufacturingDate ? new Date(item.manufacturingDate) : undefined;
      const lowStock = Number(item.lowStockThreshold);
      const medicine = new Medicine({
        name,
        genericName: item.genericName || undefined,
        category,
        batchNumber,
        manufacturer: item.manufacturer || undefined,
        supplier: item.supplier || undefined,
        quantity,
        unitPrice,
        expiryDate: expiry,
        manufacturingDate: mfg && !isNaN(mfg.getTime()) ? mfg : undefined,
        lowStockThreshold: Number.isFinite(lowStock) && lowStock > 0 ? lowStock : 10,
        location: item.location || undefined,
        notes: item.notes || undefined,
        userId: req.user._id,
      });
      await medicine.save();
      await logStock({
        medicineId: medicine._id,
        medicineName: medicine.name,
        batchNumber: medicine.batchNumber,
        action: 'created',
        quantityChange: medicine.quantity,
        quantityBefore: 0,
        quantityAfter: medicine.quantity,
        note: 'Imported via CSV',
        userId: req.user._id
      });
      created.push({ name, batchNumber });
    }

    res.json({
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      created,
      skipped,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medicines', async (req, res) => {
  try {
    const medicine = new Medicine({
      ...req.body,
      userId: req.user._id,
      expiryDate: new Date(req.body.expiryDate),
      manufacturingDate: req.body.manufacturingDate ? new Date(req.body.manufacturingDate) : undefined
    });
    await medicine.save();
    await logStock({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      action: 'created',
      quantityChange: medicine.quantity,
      quantityBefore: 0,
      quantityAfter: medicine.quantity,
      note: 'Medicine added',
      userId: req.user._id
    });
    res.status(201).json(medicine);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    res.json(medicine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/medicines/:id/logs', async (req, res) => {
  try {
    const logs = await StockLog.find({ medicineId: req.params.id, userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/medicines/:id', async (req, res) => {
  try {
    const previous = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!previous) return res.status(404).json({ error: 'Medicine not found' });

    const updateData = {
      ...req.body,
      userId: req.user._id,
      expiryDate: new Date(req.body.expiryDate),
      manufacturingDate: req.body.manufacturingDate ? new Date(req.body.manufacturingDate) : undefined,
      updatedAt: new Date()
    };
    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    const quantityChange = medicine.quantity - previous.quantity;
    await logStock({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      action: 'updated',
      quantityChange,
      quantityBefore: previous.quantity,
      quantityAfter: medicine.quantity,
      note: quantityChange === 0 ? 'Details updated' : quantityChange > 0 ? 'Stock increased' : 'Stock decreased',
      userId: req.user._id
    });
    res.json(medicine);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/medicines/:id/stock', async (req, res) => {
  try {
    const { quantity, note } = req.body;
    if (typeof quantity !== 'number') return res.status(400).json({ error: 'Quantity must be a number' });
    const previous = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!previous) return res.status(404).json({ error: 'Medicine not found' });

    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { quantity, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    const quantityChange = quantity - previous.quantity;
    await logStock({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      action: quantityChange >= 0 ? 'stock-in' : 'stock-out',
      quantityChange,
      quantityBefore: previous.quantity,
      quantityAfter: medicine.quantity,
      note: note || (quantityChange >= 0 ? 'Stock added' : 'Stock deducted'),
      userId: req.user._id
    });
    res.json(medicine);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/medicines/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    await StockLog.deleteMany({ medicineId: req.params.id, userId: req.user._id });
    await Sale.deleteMany({ medicineId: req.params.id, userId: req.user._id });
    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SALES ---
app.get('/api/sales/summary', async (req, res) => {
  try {
    const { range = 'all' } = req.query;
    const now = new Date();
    let start = null;
    if (range === 'today') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
      start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    } else if (range === 'month') {
      start = new Date(now); start.setMonth(start.getMonth() - 1);
    }

    const match = start ? { soldAt: { $gte: start }, userId: req.user._id } : { userId: req.user._id };
    const sales = await Sale.find(match).lean();

    const byKind = kind => sales.filter(s => s.kind === kind);
    const saleTotal = byKind('sale').reduce((s, x) => s + x.total, 0);
    const returnTotal = byKind('return').reduce((s, x) => s + Math.abs(x.total), 0);
    const saleUnits = byKind('sale').reduce((s, x) => s + x.quantity, 0);
    const returnUnits = byKind('return').reduce((s, x) => s + x.quantity, 0);

    const byCategoryAgg = {};
    [...byKind('sale'), ...byKind('return')].forEach(s => {
      const key = s.category || 'Other';
      if (!byCategoryAgg[key]) byCategoryAgg[key] = { revenue: 0, units: 0, returns: 0 };
      if (s.kind === 'sale') { byCategoryAgg[key].revenue += s.total; byCategoryAgg[key].units += s.quantity; }
      else { byCategoryAgg[key].returns += s.quantity; }
    });
    const byCategory = Object.entries(byCategoryAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const byDayAgg = {};
    sales.forEach(s => {
      const day = s.soldAt.toISOString().slice(0, 10);
      if (!byDayAgg[day]) byDayAgg[day] = { date: day, revenue: 0, units: 0 };
      byDayAgg[day].revenue += s.total;
      byDayAgg[day].units += s.quantity;
    });
    const byDay = Object.values(byDayAgg).sort((a, b) => a.date.localeCompare(b.date));

    const recent = await Sale.find(match).sort({ soldAt: -1 }).limit(25).lean();

    res.json({
      range,
      count: sales.length,
      revenue: saleTotal - returnTotal,
      grossRevenue: saleTotal,
      returnsValue: returnTotal,
      units: saleUnits - returnUnits,
      today: range === 'all' ? (() => {
        const t = new Date(); t.setHours(0,0,0,0);
        return sales.filter(s => s.soldAt >= t).reduce((a, s) => a + (s.kind === 'sale' ? s.total : -Math.abs(s.total)), 0);
      })() : null,
      byCategory,
      byDay,
      recent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { medicineId, quantity, soldBy, note } = req.body;
    if (!medicineId || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'medicineId and a positive quantity are required' });
    }
    const medicine = await Medicine.findOne({ _id: medicineId, userId: req.user._id });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    if (medicine.quantity < quantity) {
      return res.status(400).json({ error: `Insufficient stock: only ${medicine.quantity} unit(s) available` });
    }
    const total = quantity * medicine.unitPrice;

    medicine.quantity -= quantity;
    medicine.updatedAt = new Date();
    await medicine.save();

    await logStock({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      action: 'stock-out',
      quantityChange: -quantity,
      quantityBefore: medicine.quantity + quantity,
      quantityAfter: medicine.quantity,
      note: note || `Dispensed ${quantity} unit(s)`,
      userId: req.user._id
    });

    const sale = await Sale.create({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      category: medicine.category,
      quantity,
      unitPrice: medicine.unitPrice,
      total,
      soldBy: soldBy || 'staff',
      kind: 'sale',
      note: note || '',
      userId: req.user._id
    });

    res.status(201).json({ sale, stockRemaining: medicine.quantity });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/sales/return', async (req, res) => {
  try {
    const { medicineId, quantity, soldBy, note } = req.body;
    if (!medicineId || typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'medicineId and a positive quantity are required' });
    }
    const medicine = await Medicine.findOne({ _id: medicineId, userId: req.user._id });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    medicine.quantity += quantity;
    medicine.updatedAt = new Date();
    await medicine.save();

    await logStock({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      action: 'stock-in',
      quantityChange: quantity,
      quantityBefore: medicine.quantity - quantity,
      quantityAfter: medicine.quantity,
      note: note || `Returned ${quantity} unit(s)`,
      userId: req.user._id
    });

    const sale = await Sale.create({
      medicineId: medicine._id,
      medicineName: medicine.name,
      batchNumber: medicine.batchNumber,
      category: medicine.category,
      quantity,
      unitPrice: medicine.unitPrice,
      total: -(quantity * medicine.unitPrice),
      soldBy: soldBy || 'staff',
      kind: 'return',
      note: note || '',
      userId: req.user._id
    });

    res.status(201).json({ sale, stockRemaining: medicine.quantity });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- REPORTS ---
app.get('/api/reports/summary', async (req, res) => {
  try {
    const now = new Date();
    const allMedicine = await Medicine.find({ userId: req.user._id }).lean();

    const expiredValue = allMedicine
      .filter(m => new Date(m.expiryDate) < now)
      .reduce((s, m) => s + m.quantity * m.unitPrice, 0);

    const expiringSoonValue = allMedicine
      .filter(m => { const d = new Date(m.expiryDate); return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); })
      .reduce((s, m) => s + m.quantity * m.unitPrice, 0);

    const lowStockCount = allMedicine.filter(m => m.quantity <= m.lowStockThreshold).length;
    const totalValue = allMedicine.reduce((s, m) => s + m.quantity * m.unitPrice, 0);

    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);
    const monthSales = await Sale.find({ soldAt: { $gte: monthStart }, userId: req.user._id }).lean();
    const monthRevenue = monthSales.reduce((a, s) => a + (s.kind === 'sale' ? s.total : -Math.abs(s.total)), 0);
    const unitsSoldMonth = monthSales.filter(s => s.kind === 'sale').reduce((a, s) => a + s.quantity, 0);

    const recentLogs = await StockLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10).lean();

    res.json({
      totalValue,
      expiredValue,
      expiringSoonValue,
      atRiskValue: expiredValue + expiringSoonValue,
      lowStockCount,
      monthRevenue,
      unitsSoldMonth,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/expiry', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const mapWithDays = m => {
      const days = Math.ceil((new Date(m.expiryDate) - now) / (1000 * 60 * 60 * 24));
      return { ...m, daysRemaining: days };
    };

    const expired = await Medicine.find({ userId: req.user._id, expiryDate: { $lt: now } }).sort({ expiryDate: 1 }).lean();
    const expiringSoon = await Medicine.find({ userId: req.user._id, expiryDate: { $gte: now, $lte: thirtyDays } }).sort({ expiryDate: 1 }).lean();
    const lowStock = await Medicine.find({ userId: req.user._id, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }).sort({ quantity: 1, name: 1 }).lean();

    res.json({
      generatedAt: now.toISOString(),
      expired: expired.map(mapWithDays),
      expiringSoon: expiringSoon.map(mapWithDays),
      lowStock,
      counts: {
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        lowStock: lowStock.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CATEGORIES ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category', { userId: req.user._id });
    res.json(categories.filter(c => c).sort());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BACKUP ---
app.get('/api/backup/export', async (req, res) => {
  try {
    const [medicines, sales, stockLogs] = await Promise.all([
      Medicine.find({ userId: req.user._id }).lean(),
      Sale.find({ userId: req.user._id }).lean(),
      StockLog.find({ userId: req.user._id }).lean(),
    ]);

    res.json({
      app: 'pharmatrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      medicines,
      sales,
      stockLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/import', async (req, res) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.medicines) && !Array.isArray(body.sales) && !Array.isArray(body.stockLogs)) {
      return res.status(400).json({ error: 'Request body must include a medicines, sales or stockLogs array' });
    }

    let medicinesAdded = 0;
    let medicinesSkipped = 0;
    const saleDocs = [];
    const logDocs = [];
    const oldToNew = new Map();

    for (const raw of body.medicines || []) {
      if (!raw || typeof raw !== 'object') continue;
      const name = String(raw.name || '').trim();
      const batchNumber = String(raw.batchNumber || '').trim();
      const category = String(raw.category || '').trim();
      const expiry = new Date(raw.expiryDate);
      if (!name || !batchNumber || !category || isNaN(expiry.getTime())) continue;

      const existing = await Medicine.findOne({
        userId: req.user._id,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        batchNumber: { $regex: new RegExp(`^${escapeRegex(batchNumber)}$`, 'i') }
      }).lean();

      if (existing) {
        medicinesSkipped += 1;
        if (raw._id) oldToNew.set(String(raw._id), existing._id.toString());
        continue;
      }

      const quantity = Number(raw.quantity);
      const unitPrice = Number(raw.unitPrice);
      const lowStock = Number(raw.lowStockThreshold);
      const medicine = new Medicine({
        name,
        genericName: raw.genericName || undefined,
        category,
        batchNumber,
        manufacturer: raw.manufacturer || undefined,
        supplier: raw.supplier || undefined,
        quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        expiryDate: expiry,
        manufacturingDate: raw.manufacturingDate ? new Date(raw.manufacturingDate) : undefined,
        lowStockThreshold: Number.isFinite(lowStock) && lowStock > 0 ? lowStock : 10,
        location: raw.location || undefined,
        notes: raw.notes || undefined,
        userId: req.user._id,
      });
      await medicine.save();
      const newId = medicine._id.toString();
      if (raw._id) oldToNew.set(String(raw._id), newId);
      medicinesAdded += 1;

      await logStock({
        medicineId: medicine._id,
        medicineName: medicine.name,
        batchNumber: medicine.batchNumber,
        action: 'created',
        quantityChange: medicine.quantity,
        quantityBefore: 0,
        quantityAfter: medicine.quantity,
        note: 'Restored from backup',
        userId: req.user._id
      });
    }

    const resolveMedicineId = async (id) => {
      const oldId = String(id || '');
      if (oldToNew.has(oldId)) return oldToNew.get(oldId);
      if (mongoose.isValidObjectId(id)) {
        const exists = await Medicine.findOne({ _id: id, userId: req.user._id }).lean();
        if (exists) return id.toString();
      }
      return null;
    };

    for (const raw of body.sales || []) {
      if (!raw || typeof raw !== 'object') continue;
      const medicineId = await resolveMedicineId(raw.medicineId);
      if (!medicineId) continue;
      const quantity = Number(raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      saleDocs.push({
        medicineId,
        medicineName: String(raw.medicineName || 'Unknown'),
        batchNumber: raw.batchNumber || undefined,
        category: raw.category || undefined,
        quantity,
        unitPrice: Number.isFinite(Number(raw.unitPrice)) ? Number(raw.unitPrice) : 0,
        total: Number.isFinite(Number(raw.total)) ? Number(raw.total) : 0,
        soldBy: raw.soldBy || 'staff',
        kind: raw.kind === 'return' ? 'return' : 'sale',
        note: raw.note || undefined,
        soldAt: raw.soldAt ? new Date(raw.soldAt) : undefined,
        userId: req.user._id
      });
    }

    for (const raw of body.stockLogs || []) {
      if (!raw || typeof raw !== 'object') continue;
      const medicineId = await resolveMedicineId(raw.medicineId);
      if (!medicineId) continue;
      logDocs.push({
        medicineId,
        medicineName: String(raw.medicineName || 'Unknown'),
        batchNumber: raw.batchNumber || undefined,
        action: ['created', 'updated', 'stock-in', 'stock-out', 'deleted'].includes(raw.action) ? raw.action : 'updated',
        quantityChange: Number.isFinite(Number(raw.quantityChange)) ? Number(raw.quantityChange) : 0,
        quantityBefore: Number.isFinite(Number(raw.quantityBefore)) ? Number(raw.quantityBefore) : undefined,
        quantityAfter: Number.isFinite(Number(raw.quantityAfter)) ? Number(raw.quantityAfter) : undefined,
        note: raw.note || undefined,
        createdAt: raw.createdAt ? new Date(raw.createdAt) : undefined,
        userId: req.user._id
      });
    }

    let salesRestored = 0;
    let logsRestored = 0;
    if (saleDocs.length) {
      await Sale.insertMany(saleDocs);
      salesRestored = saleDocs.length;
    }
    if (logDocs.length) {
      await StockLog.insertMany(logDocs);
      logsRestored = logDocs.length;
    }

    res.json({
      medicinesAdded,
      medicinesSkipped,
      salesRestored,
      logsRestored
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ==========================================
// 7. STATIC CLIENT SERVING & SPA FALLBACK
// ==========================================
const possibleDistPaths = [
  path.join(__dirname, 'frontend', 'dist'),
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(__dirname, 'dist')
];

let frontendDist = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (frontendDist) {
  app.use(express.static(frontendDist, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  console.log(`Serving frontend static build from ${frontendDist}`);
} else {
  console.log('Frontend dist not found - running in API-only mode');
}

// ==========================================
// 8. SERVER START & EXPORT
// ==========================================
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`PharmaTrack Server running on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
    console.log(`Available on all network interfaces (IP addresses) at port ${PORT}`);
  });
}

module.exports = app;
