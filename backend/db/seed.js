/**
 * Seeds the database with sample markets, commodities (mapped to ImageNet
 * labels for the client-side classifier), and 21 days of synthetic price
 * history so the forecast + recommendation engine has something to work with.
 *
 * Run: node db/seed.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

// Real district/taluka-level APMC markets in the Vidarbha (cotton belt) region
// of Maharashtra, instead of generic big-city markets — this is what makes
// the "best market near me" recommendation actually meaningful for a local farmer.
const MARKETS = [
  { name: 'Amravati APMC', district: 'Amravati', state: 'Maharashtra', lat: 20.9374, lng: 77.7796 },
  { name: 'Daryapur APMC', district: 'Amravati', state: 'Maharashtra', lat: 20.9264, lng: 77.3339 },
  { name: 'Achalpur APMC', district: 'Amravati', state: 'Maharashtra', lat: 21.2585, lng: 77.5108 },
  { name: 'Chandur Bazar APMC', district: 'Amravati', state: 'Maharashtra', lat: 21.2333, lng: 77.5333 },
  { name: 'Akot APMC', district: 'Akola', state: 'Maharashtra', lat: 21.0999, lng: 77.0592 },
  { name: 'Murtizapur APMC', district: 'Akola', state: 'Maharashtra', lat: 20.7333, lng: 77.3667 },
  { name: 'Yavatmal APMC', district: 'Yavatmal', state: 'Maharashtra', lat: 20.3888, lng: 78.1204 },
  { name: 'Washim APMC', district: 'Washim', state: 'Maharashtra', lat: 20.1097, lng: 77.1333 },
];

// name -> [base price per quintal (INR), volatility %, ImageNet/MobileNet labels]
const COMMODITIES = [
  { name: 'Banana', category: 'Fruit', base: 1800, vol: 0.06, labels: 'banana' },
  { name: 'Orange', category: 'Fruit', base: 4200, vol: 0.08, labels: 'orange' },
  { name: 'Lemon', category: 'Fruit', base: 3500, vol: 0.07, labels: 'lemon' },
  { name: 'Pomegranate', category: 'Fruit', base: 9000, vol: 0.09, labels: 'pomegranate' },
  { name: 'Strawberry', category: 'Fruit', base: 6000, vol: 0.10, labels: 'strawberry' },
  { name: 'Pineapple', category: 'Fruit', base: 2500, vol: 0.07, labels: 'pineapple,ananas' },
  { name: 'Fig', category: 'Fruit', base: 8000, vol: 0.08, labels: 'fig' },
  { name: 'Cauliflower', category: 'Vegetable', base: 1500, vol: 0.12, labels: 'cauliflower' },
  { name: 'Broccoli', category: 'Vegetable', base: 3000, vol: 0.11, labels: 'broccoli' },
  { name: 'Cucumber', category: 'Vegetable', base: 1200, vol: 0.10, labels: 'cucumber' },
  { name: 'Bell Pepper', category: 'Vegetable', base: 2800, vol: 0.09, labels: 'bell_pepper' },
  { name: 'Mushroom', category: 'Vegetable', base: 5000, vol: 0.10, labels: 'mushroom,agaric' },
  { name: 'Artichoke', category: 'Vegetable', base: 4000, vol: 0.08, labels: 'artichoke' },
  { name: 'Cabbage', category: 'Vegetable', base: 900, vol: 0.13, labels: 'head_cabbage' },
  { name: 'Corn', category: 'Grain', base: 2100, vol: 0.05, labels: 'ear,corn' },

  // Pulses & grains: MobileNet/ImageNet has no matching classes for these
  // (bulk grain/pulse piles weren't part of its original training categories),
  // so imagenet_labels is intentionally left empty. The app still shows full
  // price/forecast/recommendation data for them — the farmer just selects the
  // crop manually from the dropdown after taking the photo instead of relying
  // on auto-detection. This is a documented, expected limitation, not a bug.
  { name: 'Wheat', category: 'Grain', base: 2300, vol: 0.04, labels: '' },
  { name: 'Rice (Paddy)', category: 'Grain', base: 2100, vol: 0.05, labels: '' },
  { name: 'Bajra (Pearl Millet)', category: 'Grain', base: 2400, vol: 0.05, labels: '' },
  { name: 'Jowar (Sorghum)', category: 'Grain', base: 2900, vol: 0.06, labels: '' },
  { name: 'Chana (Chickpea)', category: 'Pulse', base: 5300, vol: 0.07, labels: '' },
  { name: 'Toor (Pigeon Pea / Arhar)', category: 'Pulse', base: 7000, vol: 0.08, labels: '' },
  { name: 'Moong (Green Gram)', category: 'Pulse', base: 7500, vol: 0.08, labels: '' },
  { name: 'Masoor (Red Lentil)', category: 'Pulse', base: 6200, vol: 0.07, labels: '' },
  { name: 'Urad (Black Gram)', category: 'Pulse', base: 7200, vol: 0.08, labels: '' },
  { name: 'Soybean', category: 'Oilseed', base: 4300, vol: 0.09, labels: '' },
  { name: 'Groundnut', category: 'Oilseed', base: 6000, vol: 0.08, labels: '' },
  { name: 'Onion', category: 'Vegetable', base: 1400, vol: 0.15, labels: '' },
  { name: 'Potato', category: 'Vegetable', base: 1100, vol: 0.12, labels: '' },
  { name: 'Tomato', category: 'Vegetable', base: 1300, vol: 0.16, labels: '' },

  // Vidarbha's major cash crops
  { name: 'Cotton', category: 'Cash Crop', base: 7200, vol: 0.06, labels: '' },
  { name: 'Sugarcane', category: 'Cash Crop', base: 320, vol: 0.04, labels: '' },
  { name: 'Turmeric', category: 'Spice', base: 14000, vol: 0.09, labels: '' },
  { name: 'Ginger', category: 'Spice', base: 6000, vol: 0.10, labels: '' },
  { name: 'Garlic', category: 'Spice', base: 8000, vol: 0.11, labels: '' },
  { name: 'Sunflower', category: 'Oilseed', base: 6500, vol: 0.07, labels: '' },
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agri_price_db',
    multipleStatements: true,
  });

  console.log('Connected. Seeding...');

  // Clear existing sample data (keeps schema intact)
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE price_data');
  await conn.query('TRUNCATE TABLE forecasts');
  await conn.query('TRUNCATE TABLE markets');
  await conn.query('TRUNCATE TABLE commodities');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  const marketIds = [];
  for (const m of MARKETS) {
    const [res] = await conn.query(
      'INSERT INTO markets (name, district, state, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [m.name, m.district, m.state, m.lat, m.lng]
    );
    marketIds.push(res.insertId);
  }

  const commodityIds = [];
  for (const c of COMMODITIES) {
    const [res] = await conn.query(
      'INSERT INTO commodities (name, category, unit, imagenet_labels) VALUES (?, ?, ?, ?)',
      [c.name, c.category, 'quintal', c.labels]
    );
    commodityIds.push(res.insertId);
  }

  // 21 days of price history, per commodity per market, with a mild
  // per-market bias and daily random walk so trends/forecast look realistic.
  const today = new Date();
  const rows = [];
  for (let ci = 0; ci < COMMODITIES.length; ci++) {
    const c = COMMODITIES[ci];
    for (let mi = 0; mi < MARKETS.length; mi++) {
      const marketBias = rand(0.9, 1.1); // some markets pay more than others
      let price = c.base * marketBias;
      for (let d = 20; d >= 0; d--) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        // random walk
        price = price * (1 + rand(-c.vol / 4, c.vol / 4));
        const modal = Math.round(price);
        const min = Math.round(modal * rand(0.9, 0.96));
        const max = Math.round(modal * rand(1.04, 1.1));
        const arrival = Math.round(rand(50, 500));
        rows.push([commodityIds[ci], marketIds[mi], min, max, modal, arrival,
          date.toISOString().slice(0, 10)]);
      }
    }
  }

  const placeholders = rows.map(() => '(?,?,?,?,?,?,?)').join(',');
  const flatValues = rows.flat();
  await conn.query(
    `INSERT INTO price_data (commodity_id, market_id, min_price, max_price, modal_price, arrival_qty, price_date) VALUES ${placeholders}`,
    flatValues
  );

  console.log(`Seeded ${MARKETS.length} markets, ${COMMODITIES.length} commodities, ${rows.length} price records.`);
  await conn.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
