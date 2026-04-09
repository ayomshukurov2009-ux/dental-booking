const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Datastore = require('@seald-io/nedb');

// ─── Database Setup ────────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'data');
fs.mkdirSync(dbPath, { recursive: true });

const appointmentsDB = new Datastore({ filename: path.join(dbPath, 'appointments.db'), autoload: true });
const usersDB = new Datastore({ filename: path.join(dbPath, 'users.db'), autoload: true });

// Unique index on date+time combination (we'll enforce manually)
appointmentsDB.ensureIndex({ fieldName: 'slotKey', unique: true }, () => {});

// Seed admin user (idempotent)
const ADMIN_EMAIL = 'ayomshukurov2009@gmail.com';
const ADMIN_PASS  = '20090829';
const JWT_SECRET  = 'dental_crm_secret_2024_$';

usersDB.findOne({ email: ADMIN_EMAIL }, (err, doc) => {
  if (!doc) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    usersDB.insert({ email: ADMIN_EMAIL, password_hash: hash });
    console.log('✅ Admin user created');
  }
});

// ─── Apps ─────────────────────────────────────────────────────────────────────
const app = express();

// Security: hide server fingerprint
app.disable('x-powered-by');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// CORS for all routes
app.use(cors({
  origin: function(origin, cb) {
    // Permit all origins for flexibility, or you can restrict it here
    cb(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50kb' }));

// ─── JWT Middleware ────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Helper: date range for stats ─────────────────────────────────────────────
function getDateStrings() {
  const now = new Date();

  const yearStart  = `${now.getFullYear()}-01-01`;

  const m = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${now.getFullYear()}-${m}-01`;

  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() + diff);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const today = now.toISOString().slice(0, 10);

  return { yearStart, monthStart, weekStart, today };
}

// ══════════════════════════════════════════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
app.get('/api/slots', (req, res) => {
  const { startDate = '', endDate = '9999-12-31' } = req.query;
  appointmentsDB.find(
    { date: { $gte: startDate, $lte: endDate } },
    { date: 1, time: 1, _id: 0 },
    (err, docs) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(docs);
    }
  );
});

// POST /api/book
app.post('/api/book', (req, res) => {
  const { date, time, client_name, client_phone, procedure } = req.body;

  if (!date || !time || !client_name || !client_phone || !procedure)
    return res.status(400).json({ error: 'Все поля обязательны' });

  if (!/^\+992\d{9}$/.test(client_phone))
    return res.status(400).json({ error: 'Номер телефона должен быть в формате +992XXXXXXXXX (9 цифр)' });

  const slotKey = `${date}_${time}`;

  // Check if slot exists
  appointmentsDB.findOne({ slotKey }, (err, existing) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (existing) return res.status(409).json({ error: 'Это время уже занято' });

    const doc = {
      slotKey,
      date,
      time,
      client_name,
      client_phone,
      procedure,
      final_price: null,
      price_set_at: null,
      created_at: new Date().toISOString()
    };

    appointmentsDB.insert(doc, (err2, newDoc) => {
      if (err2) {
        if (err2.errorType === 'uniqueViolated')
          return res.status(409).json({ error: 'Это время уже занято' });
        return res.status(500).json({ error: 'Ошибка сервера' });
      }
      res.json({ success: true, id: newDoc._id });
    });
  });
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  usersDB.findOne({ email }, (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Неверная почта или пароль' });
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, email: user.email });
  });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const { yearStart, monthStart, weekStart, today } = getDateStrings();

  appointmentsDB.find({}, (err, all) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    const yearCount  = all.filter(a => a.date >= yearStart).length;
    const monthCount = all.filter(a => a.date >= monthStart).length;
    const weekCount  = all.filter(a => a.date >= weekStart).length;
    const todayCount = all.filter(a => a.date === today).length;
    const totalCount = all.length;
    const priceSetCount = all.filter(a => a.final_price !== null).length;

    res.json({ yearCount, monthCount, weekCount, todayCount, totalCount, priceSetCount });
  });
});

// GET /api/admin/appointments
app.get('/api/admin/appointments', authMiddleware, (req, res) => {
  appointmentsDB.find({}).sort({ date: -1, time: 1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(docs.map(d => ({ ...d, id: d._id })));
  });
});

// PATCH /api/admin/appointments/:id/price
app.patch('/api/admin/appointments/:id/price', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { final_price } = req.body;

  if (typeof final_price !== 'number' || final_price < 0)
    return res.status(400).json({ error: 'Некорректная цена' });

  appointmentsDB.findOne({ _id: id }, (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Запись не найдена' });
    if (doc.final_price !== null)
      return res.status(403).json({ error: 'Цена уже установлена и не может быть изменена' });

    appointmentsDB.update(
      { _id: id },
      { $set: { final_price, price_set_at: new Date().toISOString() } },
      {},
      err2 => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
      }
    );
  });
});

// DELETE /api/admin/appointments/:id
app.delete('/api/admin/appointments/:id', authMiddleware, (req, res) => {
  appointmentsDB.remove({ _id: req.params.id }, {}, (err, n) => {
    if (err || n === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ success: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  STATIC FILES (FRONTEND)
// ══════════════════════════════════════════════════════════════════════════════

// Serve Admin UI on /admin
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve Main UI on /
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for /admin/* (SPA routing if needed)
app.get('/admin/*', (req, res) =>
  res.sendFile(path.join(__dirname, 'admin', 'index.html'))
);

// Catch-all for main site (SPA routing if needed)
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT,  () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
