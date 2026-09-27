const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { authOptional } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/uploads
 * multipart/form-data: image=<file>
 * fields: predicted_commodity, confidence, quality_grade, quality_score
 *
 * The actual image classification (MobileNet) and quality scoring (canvas
 * color analysis) run client-side in the browser for speed and to avoid
 * needing a separate ML server. This endpoint just logs the result and
 * stores the image, so results can be reviewed/audited later.
 */
router.post('/', authOptional, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const { predicted_commodity, confidence, quality_grade, quality_score } = req.body;

    const [result] = await pool.query(
      `INSERT INTO uploads (user_id, image_path, predicted_commodity, confidence, quality_grade, quality_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user ? req.user.id : null,
        req.file.filename,
        predicted_commodity || null,
        confidence || null,
        quality_grade || 'B',
        quality_score || null,
      ]
    );

    res.status(201).json({ id: result.insertId, image_path: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/uploads/mine - a farmer's upload history (requires login)
router.get('/mine', authOptional, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Login required' });
    const [rows] = await pool.query(
      'SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

module.exports = router;
