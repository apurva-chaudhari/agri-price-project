const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const { cosineSimilarity } = require('../utils/similarity');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = `ref-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Only logged-in users with role 'broker' can hit the write routes below.
function brokerOnly(req, res, next) {
  if (!req.user || req.user.role !== 'broker') {
    return res.status(403).json({ error: 'Broker account required' });
  }
  next();
}

/**
 * POST /api/broker/reference
 * multipart/form-data: image=<file>
 * fields: commodity_id, grade ('A'|'B'|'C'), embedding (JSON string array), notes
 *
 * Uploads/replaces the broker's reference photo defining what this grade
 * looks like for this commodity, at the broker's own market. The embedding
 * is computed client-side (MobileNet) and sent along so the server never
 * needs to run inference itself.
 */
router.post('/reference', authRequired, brokerOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.user.market_id) {
      return res.status(400).json({ error: 'Your broker account has no market assigned' });
    }
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const { commodity_id, grade, embedding, notes } = req.body;
    if (!commodity_id || !grade || !embedding) {
      return res.status(400).json({ error: 'commodity_id, grade and embedding are required' });
    }
    if (!['A', 'B', 'C'].includes(grade)) {
      return res.status(400).json({ error: 'grade must be A, B or C' });
    }

    await pool.query(
      `INSERT INTO grade_references (market_id, commodity_id, broker_id, grade, image_path, embedding, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE image_path = VALUES(image_path), embedding = VALUES(embedding),
         notes = VALUES(notes), broker_id = VALUES(broker_id), created_at = CURRENT_TIMESTAMP`,
      [req.user.market_id, commodity_id, req.user.id, grade, req.file.filename, embedding, notes || null]
    );

    res.status(201).json({ message: 'Reference photo saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save reference photo' });
  }
});

// GET /api/broker/reference?market_id=&commodity_id= -> the 3 grade references (public read - farmers need this too)
router.get('/reference', async (req, res) => {
  try {
    const { market_id, commodity_id } = req.query;
    if (!market_id || !commodity_id) {
      return res.status(400).json({ error: 'market_id and commodity_id are required' });
    }
    const [rows] = await pool.query(
      `SELECT grade, image_path, embedding, notes, created_at FROM grade_references
       WHERE market_id = ? AND commodity_id = ?`,
      [market_id, commodity_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reference photos' });
  }
});

/**
 * POST /api/broker/prices
 * body: { commodity_id, prices: { A: 5300, B: 4800, C: 4000 } }
 * Sets/updates today's price for each grade at the broker's market in one call.
 */
router.post('/prices', authRequired, brokerOnly, async (req, res) => {
  try {
    if (!req.user.market_id) {
      return res.status(400).json({ error: 'Your broker account has no market assigned' });
    }
    const { commodity_id, prices } = req.body;
    if (!commodity_id || !prices) {
      return res.status(400).json({ error: 'commodity_id and prices are required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const entries = Object.entries(prices).filter(([grade]) => ['A', 'B', 'C'].includes(grade));

    for (const [grade, price] of entries) {
      if (price === '' || price === null || price === undefined) continue;
      await pool.query(
        `INSERT INTO grade_prices (market_id, commodity_id, broker_id, grade, price, price_date)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE price = VALUES(price), broker_id = VALUES(broker_id)`,
        [req.user.market_id, commodity_id, req.user.id, grade, Number(price), today]
      );
    }

    res.status(201).json({ message: 'Prices updated for today' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

// GET /api/broker/prices?market_id=&commodity_id= -> today's price per grade (public read)
router.get('/prices', async (req, res) => {
  try {
    const { market_id, commodity_id } = req.query;
    if (!market_id || !commodity_id) {
      return res.status(400).json({ error: 'market_id and commodity_id are required' });
    }
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `SELECT grade, price, price_date FROM grade_prices
       WHERE market_id = ? AND commodity_id = ? AND price_date = ?`,
      [market_id, commodity_id, today]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch today\'s prices' });
  }
});

// A photo is only considered a confident match to a broker's reference photo
// if cosine similarity clears this bar. Below it we don't trust it enough to
// claim "this is cotton" / "this is tomato" etc.
const MIN_IDENTIFY_SIMILARITY = 0.55;

/**
 * POST /api/broker/identify
 * body: { embedding: [0.12, -0.03, ...] }  // MobileNet embedding of the farmer's photo
 *
 * Compares the farmer's photo directly against EVERY broker-uploaded Grade
 * A/B/C reference photo (across all commodities and markets), and returns
 * the closest match. This is the primary crop+grade identification method —
 * it identifies the crop the same way it grades it: by matching against the
 * real fixed photos brokers uploaded, not a generic ImageNet/color guess.
 * The generic guess is only used as a fallback when no reference photo is
 * close enough (e.g. no broker has uploaded photos for this crop yet).
 */
router.post('/identify', async (req, res) => {
  try {
    const { embedding } = req.body;
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      return res.status(400).json({ error: 'embedding array is required' });
    }

    const [refs] = await pool.query(
      `SELECT gr.commodity_id, c.name AS commodity_name, gr.market_id, m.name AS market_name,
              gr.grade, gr.embedding, gr.notes, gr.image_path
       FROM grade_references gr
       JOIN commodities c ON gr.commodity_id = c.id
       JOIN markets m ON gr.market_id = m.id`
    );

    if (refs.length === 0) {
      return res.json({ matched: false, reason: 'no_reference_photos', candidates: [] });
    }

    // Best-matching reference photo per commodity (its highest similarity
    // across any market/grade), so one commodity isn't unfairly favored
    // just because more markets have uploaded photos for it.
    const bestPerCommodity = new Map();
    for (const ref of refs) {
      let refEmbedding;
      try { refEmbedding = JSON.parse(ref.embedding); } catch { continue; }
      const sim = cosineSimilarity(embedding, refEmbedding);
      const current = bestPerCommodity.get(ref.commodity_id);
      if (!current || sim > current.similarity) {
        bestPerCommodity.set(ref.commodity_id, {
          commodity_id: ref.commodity_id,
          commodity_name: ref.commodity_name,
          market_id: ref.market_id,
          market_name: ref.market_name,
          grade: ref.grade,
          notes: ref.notes,
          image_path: ref.image_path,
          similarity: sim,
        });
      }
    }

    const candidates = Array.from(bestPerCommodity.values()).sort((a, b) => b.similarity - a.similarity);
    const top = candidates[0];

    res.json({
      matched: !!(top && top.similarity >= MIN_IDENTIFY_SIMILARITY),
      best: top ? { ...top, similarity: Math.round(top.similarity * 100) / 100 } : null,
      candidates: candidates.slice(0, 3).map((c) => ({ ...c, similarity: Math.round(c.similarity * 100) / 100 })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to identify photo against reference images' });
  }
});

// GET /api/broker/reference-all?commodity_id= -> for EVERY market, this commodity's
// fixed A/B/C reference photos + today's broker price. This is what lets a farmer
// with a poor camera just look at the three fixed photos and read off the price,
// without uploading anything themselves.
router.get('/reference-all', async (req, res) => {
  try {
    const { commodity_id } = req.query;
    if (!commodity_id) {
      return res.status(400).json({ error: 'commodity_id is required' });
    }
    const today = new Date().toISOString().slice(0, 10);

    const [refs] = await pool.query(
      `SELECT gr.market_id, m.name AS market_name, m.district, m.state,
              gr.grade, gr.image_path, gr.notes
       FROM grade_references gr
       JOIN markets m ON gr.market_id = m.id
       WHERE gr.commodity_id = ?`,
      [commodity_id]
    );
    const [prices] = await pool.query(
      `SELECT market_id, grade, price FROM grade_prices
       WHERE commodity_id = ? AND price_date = ?`,
      [commodity_id, today]
    );

    const byMarket = {};
    for (const r of refs) {
      if (!byMarket[r.market_id]) {
        byMarket[r.market_id] = {
          market_id: r.market_id,
          market_name: r.market_name,
          district: r.district,
          state: r.state,
          grades: {},
        };
      }
      byMarket[r.market_id].grades[r.grade] = {
        image_path: r.image_path,
        notes: r.notes,
        price: null,
      };
    }
    for (const p of prices) {
      if (byMarket[p.market_id] && byMarket[p.market_id].grades[p.grade]) {
        byMarket[p.market_id].grades[p.grade].price = Number(p.price);
      }
    }

    res.json(Object.values(byMarket));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reference photos for all markets' });
  }
});

// GET /api/broker/my-references -> everything the logged-in broker has set up (for their dashboard)
router.get('/my-references', authRequired, brokerOnly, async (req, res) => {
  try {
    const [refs] = await pool.query(
      `SELECT gr.*, c.name AS commodity_name FROM grade_references gr
       JOIN commodities c ON gr.commodity_id = c.id
       WHERE gr.market_id = ? ORDER BY c.name, gr.grade`,
      [req.user.market_id]
    );
    const today = new Date().toISOString().slice(0, 10);
    const [prices] = await pool.query(
      `SELECT gp.*, c.name AS commodity_name FROM grade_prices gp
       JOIN commodities c ON gp.commodity_id = c.id
       WHERE gp.market_id = ? AND gp.price_date = ? ORDER BY c.name, gp.grade`,
      [req.user.market_id, today]
    );
    res.json({ references: refs, todayPrices: prices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch broker dashboard data' });
  }
});

module.exports = router;
