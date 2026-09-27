const express = require('express');
const pool = require('../db');
const { haversineKm } = require('../utils/distance');
const { forecastPrices } = require('../utils/forecastModel');
const { cosineSimilarity } = require('../utils/similarity');
require('dotenv').config();

const router = express.Router();

const COST_PER_KM_PER_QUINTAL = Number(process.env.TRANSPORT_COST_PER_KM_PER_QUINTAL) || 8;

// Fallback grade multiplier — only used at markets where no broker has set
// up real reference photos/prices yet. Wherever broker data DOES exist, that
// real data is used instead of this synthetic guess.
const GRADE_MULTIPLIER = { A: 1.0, B: 0.9, C: 0.75 };

// A photo is only considered a confident match to a broker's reference if
// cosine similarity clears this bar; otherwise we don't trust the grade
// match enough to override the farmer's own self-assessed grade.
const MIN_SIMILARITY = 0.5;

/**
 * POST /api/recommend
 * body: {
 *   commodity: "Chana",
 *   grade: "A" | "B" | "C",        // farmer's own/self-graded estimate (fallback)
 *   embedding: [0.12, -0.03, ...], // optional: MobileNet embedding of the farmer's photo
 *   quantityQuintals: 10,
 *   farmerLat: 18.52,
 *   farmerLng: 73.85
 * }
 *
 * For each market:
 *   - If the market's broker has uploaded grade reference photos for this
 *     commodity AND set today's price, the farmer's photo embedding is
 *     compared against those references (cosine similarity) to find the
 *     closest-matching grade, and that broker's OWN today's price for that
 *     grade is used directly. This is real, broker-set pricing — the grade
 *     shown is calibrated to what that specific mandi's broker will actually
 *     say, not an independent AI opinion.
 *   - Otherwise, falls back to the synthetic forecast * grade-multiplier
 *     model as before, clearly flagged as such in the response.
 */
router.post('/', async (req, res) => {
  try {
    const { commodity, grade = 'B', embedding, quantityQuintals = 1, farmerLat, farmerLng } = req.body;

    if (!commodity || farmerLat === undefined || farmerLng === undefined) {
      return res.status(400).json({ error: 'commodity, farmerLat and farmerLng are required' });
    }

    const [commodityRows] = await pool.query('SELECT id FROM commodities WHERE name = ?', [commodity]);
    if (commodityRows.length === 0) {
      return res.status(404).json({ error: `Commodity "${commodity}" not found` });
    }
    const commodityId = commodityRows[0].id;

    const [markets] = await pool.query('SELECT * FROM markets');
    const today = new Date().toISOString().slice(0, 10);

    const results = [];
    for (const market of markets) {
      const distanceKm = haversineKm(farmerLat, farmerLng, market.latitude, market.longitude);
      const transportCost = distanceKm * COST_PER_KM_PER_QUINTAL * quantityQuintals;

      // --- Try broker-driven pricing first ---
      const [refs] = await pool.query(
        `SELECT grade, embedding, notes FROM grade_references WHERE market_id = ? AND commodity_id = ?`,
        [market.id, commodityId]
      );
      const [gradePrices] = await pool.query(
        `SELECT grade, price FROM grade_prices WHERE market_id = ? AND commodity_id = ? AND price_date = ?`,
        [market.id, commodityId, today]
      );

      if (refs.length > 0 && gradePrices.length > 0) {
        let matchedGrade = grade; // fallback to self-graded if no embedding provided
        let similarity = null;

        if (embedding && embedding.length > 0) {
          let best = null;
          for (const ref of refs) {
            let refEmbedding;
            try { refEmbedding = JSON.parse(ref.embedding); } catch { continue; }
            const sim = cosineSimilarity(embedding, refEmbedding);
            if (!best || sim > best.sim) best = { grade: ref.grade, sim, notes: ref.notes };
          }
          if (best && best.sim >= MIN_SIMILARITY) {
            matchedGrade = best.grade;
            similarity = Math.round(best.sim * 100) / 100;
          }
        }

        const priceRow = gradePrices.find((p) => p.grade === matchedGrade);
        if (priceRow) {
          const gradeAdjustedPrice = Number(priceRow.price);
          const grossRevenue = gradeAdjustedPrice * quantityQuintals;
          const netProfit = grossRevenue - transportCost;

          results.push({
            market_id: market.id,
            market_name: market.name,
            district: market.district,
            state: market.state,
            distance_km: Math.round(distanceKm * 10) / 10,
            current_price: gradeAdjustedPrice,
            forecast_3day_high: gradeAdjustedPrice,
            grade_adjusted_price: Math.round(gradeAdjustedPrice),
            estimated_transport_cost: Math.round(transportCost),
            estimated_gross_revenue: Math.round(grossRevenue),
            estimated_net_profit: Math.round(netProfit),
            matched_grade: matchedGrade,
            similarity,
            broker_priced: true,
          });
          continue; // done with this market
        }
      }

      // --- Fallback: synthetic forecast * grade multiplier (no broker data here yet) ---
      const [history] = await pool.query(
        `SELECT price_date, modal_price FROM price_data
         WHERE commodity_id = ? AND market_id = ? ORDER BY price_date ASC`,
        [commodityId, market.id]
      );
      if (history.length === 0) continue;

      const latestPrice = Number(history[history.length - 1].modal_price);
      const forecast = forecastPrices(history, 3);
      const bestForecastPrice = forecast.length
        ? Math.max(...forecast.map((f) => f.predicted_price))
        : latestPrice;

      const gradeAdjustedPrice = bestForecastPrice * (GRADE_MULTIPLIER[grade] || 0.9);
      const grossRevenue = gradeAdjustedPrice * quantityQuintals;
      const netProfit = grossRevenue - transportCost;

      results.push({
        market_id: market.id,
        market_name: market.name,
        district: market.district,
        state: market.state,
        distance_km: Math.round(distanceKm * 10) / 10,
        current_price: latestPrice,
        forecast_3day_high: Math.round(bestForecastPrice),
        grade_adjusted_price: Math.round(gradeAdjustedPrice),
        estimated_transport_cost: Math.round(transportCost),
        estimated_gross_revenue: Math.round(grossRevenue),
        estimated_net_profit: Math.round(netProfit),
        matched_grade: grade,
        similarity: null,
        broker_priced: false,
      });
    }

    results.sort((a, b) => b.estimated_net_profit - a.estimated_net_profit);

    res.json({
      commodity,
      grade,
      quantityQuintals,
      recommendations: results,
      best_choice: results[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

module.exports = router;
