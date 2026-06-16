const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const UPLOADS_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_TYPE'));
    }
  }
});

// POST /api/reports
router.post('/reports', upload.single('photo'), (req, res) => {
  try {
    const { worker_name, product, quantity, notes, priority } = req.body;

    if (!worker_name?.trim() || !product?.trim() || !priority) {
      return res.status(400).json({ error: 'جميع الحقول المطلوبة يجب تعبئتها' });
    }

    if (!['urgent', 'normal'].includes(priority)) {
      return res.status(400).json({ error: 'قيمة الأولوية غير صحيحة' });
    }

    // Support both old (quantity) and new (notes) submissions
    const qty   = quantity ? parseInt(quantity) || 0 : 0;
    const notesTxt = notes?.trim() || null;

    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO reports (worker_name, product, quantity, notes, priority, photo_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(worker_name.trim(), product.trim(), qty, notesTxt, priority, photo_path);

    res.status(201).json({ id: result.lastInsertRowid, message: 'تم إضافة البلاغ بنجاح' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/reports error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// GET /api/reports
router.get('/reports', (req, res) => {
  try {
    const { status = 'all', priority = 'all' } = req.query;

    let query = 'SELECT * FROM reports WHERE 1=1';
    const params = [];

    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (priority !== 'all') {
      query += ' AND priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY created_at DESC';

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/reports error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// PATCH /api/reports/:id/resolve
router.patch('/reports/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود' });
    if (report.status === 'resolved') return res.status(400).json({ error: 'البلاغ محلول بالفعل' });

    db.prepare(`
      UPDATE reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    res.json({ message: 'تم حل البلاغ بنجاح' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] PATCH /api/reports/:id/resolve error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// PATCH /api/reports/:id/inspect
router.patch('/reports/:id/inspect', (req, res) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود' });
    db.prepare("UPDATE reports SET inspected_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    res.json({ message: 'تم الفحص' });
  } catch (err) {
    console.error(`PATCH /api/reports/:id/inspect error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// PATCH /api/reports/:id/close
router.patch('/reports/:id/close', (req, res) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود' });
    if (report.status === 'closed') return res.status(400).json({ error: 'البلاغ مغلق بالفعل' });

    db.prepare("UPDATE reports SET status='closed', closed_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    res.json({ message: 'تم إغلاق البلاغ' });
  } catch (err) {
    console.error(`PATCH /api/reports/:id/close error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// GET /api/stats
router.get('/stats', (req, res) => {
  try {
    const g = (sql) => db.prepare(sql).get().c;
    res.json({
      total:           g(`SELECT COUNT(*) as c FROM reports`),
      urgent_open:     g(`SELECT COUNT(*) as c FROM reports WHERE status='open' AND priority='urgent'`),
      normal_open:     g(`SELECT COUNT(*) as c FROM reports WHERE status='open' AND priority='normal'`),
      resolved_total:  g(`SELECT COUNT(*) as c FROM reports WHERE status='resolved'`),
      inspected_total: g(`SELECT COUNT(*) as c FROM reports WHERE inspected_at IS NOT NULL`),
      closed_total:    g(`SELECT COUNT(*) as c FROM reports WHERE status='closed'`),
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stats error:`, err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'حجم الصورة يجب أن لا يتجاوز 5 ميجابايت' });
  }
  if (err.message === 'INVALID_TYPE') {
    return res.status(400).json({ error: 'يُسمح فقط بصور JPEG وPNG' });
  }
  next(err);
});

module.exports = router;
