const express = require('express');
const pool = require('../db');
const { forecastPrices } = require('../utils/forecastModel');

const router = express.Router();

// GET /api/prices/commodities  -> list of all commodities (with imagenet label mapping)
router.get('/commodities', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM commodities ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch commodities' });
  }
});

// GET /api/prices/current?commodity=Banana
// Latest price for that commodity across every market.
router.get('/current', async (req, res) => {
  try {
    const { commodity } = req.query;
    if (!commodity) return res.status(400).json({ error: 'commodity query param required' });

    const [rows] = await pool.query(
      `SELECT p.*, m.name AS market_name, m.district, m.state, m.latitude, m.longitude, c.name AS commodity_name
       FROM price_data p
       JOIN markets m ON p.market_id = m.id
       JOIN commodities c ON p.commodity_id = c.id
       WHERE c.name = ?
       AND p.price_date = (
         SELECT MAX(price_date) FROM price_data WHERE commodity_id = p.commodity_id AND market_id = p.market_id
       )
       ORDER BY p.modal_price DESC`,
      [commodity]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch current prices' });
  }
});

// GET /api/prices/history?commodity=Banana&market_id=1&days=21
router.get('/history', async (req, res) => {
  try {
    const { commodity, market_id, days = 21 } = req.query;
    if (!commodity || !market_id) {
      return res.status(400).json({ error: 'commodity and market_id are required' });
    }

    const [rows] = await pool.query(
      `SELECT p.price_date, p.min_price, p.max_price, p.modal_price, p.arrival_qty
       FROM price_data p
       JOIN commodities c ON p.commodity_id = c.id
       WHERE c.name = ? AND p.market_id = ?
       ORDER BY p.price_date DESC
       LIMIT ?`,
      [commodity, Number(market_id), Number(days)]
    );
    res.json(rows.reverse()); // ascending by date for charting
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// GET /api/prices/forecast?commodity=Banana&market_id=1&daysAhead=7
router.get('/forecast', async (req, res) => {
  try {
    const { commodity, market_id, daysAhead = 7 } = req.query;
    if (!commodity || !market_id) {
      return res.status(400).json({ error: 'commodity and market_id are required' });
    }

    const [history] = await pool.query(
      `SELECT p.price_date, p.modal_price
       FROM price_data p
       JOIN commodities c ON p.commodity_id = c.id
       WHERE c.name = ? AND p.market_id = ?
       ORDER BY p.price_date ASC`,
      [commodity, Number(market_id)]
    );

    const forecast = forecastPrices(history, Number(daysAhead));
    res.json({ history, forecast });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// GET /api/prices/market/:market_id -> latest price for every commodity at this one market
router.get('/market/:market_id', async (req, res) => {
  try {
    const marketId = Number(req.params.market_id);
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS commodity_name, c.category, m.name AS market_name
       FROM price_data p
       JOIN commodities c ON p.commodity_id = c.id
       JOIN markets m ON p.market_id = m.id
       WHERE p.market_id = ?
       AND p.price_date = (
         SELECT MAX(price_date) FROM price_data WHERE commodity_id = p.commodity_id AND market_id = p.market_id
       )
       ORDER BY c.name`,
      [marketId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch market prices' });
  }
});

module.exports = router;
