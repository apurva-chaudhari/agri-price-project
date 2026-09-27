const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/markets
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM markets ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

module.exports = router;
