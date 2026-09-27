# AgriPrice Vision
### Crop Photo → Market Price → Best-Market Recommendation for Farmers

A full-stack web app: a farmer photographs their crop, the app identifies the
crop and estimates its quality, then shows **current mandi (market) prices,
a short-term price forecast, and a ranked list of the most profitable nearby
markets to sell at** — accounting for transport cost, not just raw price.

This is a fresh, standalone project (built from scratch for this field
project topic).

---

## Why this is more than "just another price app"

Most existing tools do one thing each:
- **Plantix / Plant.id** — identify crops/diseases from photos, but don't touch prices
- **AGMARKNET / e-NAM** — show mandi prices, but require the farmer to already know the commodity name and don't grade quality or recommend where to sell

This project's differentiators, useful to highlight in your report:
1. **Photo → auto crop identification** (no manual dropdown needed as the first step)
2. **Quality grading from the same photo** (A/B/C), which adjusts the expected selling price — most price-lookup tools ignore quality entirely
3. **Net-profit market recommender** — ranks markets by `forecast price − estimated transport cost`, not just gross price, using the farmer's live location (Haversine distance)
4. **Short-term price forecasting** per market so a farmer can decide whether to sell today or wait a few days

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), plain CSS |
| Crop identification | TensorFlow.js + MobileNet — runs **in the browser**, no ML server needed |
| Quality grading | Canvas-based pixel/brightness analysis (JS) |
| Backend | Node.js + Express |
| Database | MySQL |
| Auth | JWT + bcrypt |
| Charts | Recharts |

---

## Project Structure

```
agri-price-project/
├── backend/
│   ├── db/
│   │   ├── schema.sql        # run this first
│   │   └── seed.js           # sample markets/commodities/21-day price history
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── markets.js
│   │   ├── prices.js
│   │   ├── uploads.js
│   │   └── recommend.js      # the core "best market" engine
│   ├── utils/
│   │   ├── distance.js       # Haversine formula
│   │   └── forecastModel.js  # linear-regression price forecast
│   ├── uploads/               # uploaded crop photos land here
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── PhotoUpload.jsx        # MobileNet classification + grading
    │   │   ├── PriceChart.jsx
    │   │   ├── MarketRecommendation.jsx
    │   │   └── Navbar.jsx
    │   ├── pages/
    │   │   ├── UploadPage.jsx         # main "sell my crop" flow
    │   │   ├── Dashboard.jsx          # browse prices without a photo
    │   │   ├── Login.jsx
    │   │   └── Register.jsx
    │   ├── App.jsx
    │   ├── api.js
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup Instructions

### 1. Database
```bash
mysql -u root -p < backend/db/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # edit DB_PASSWORD and JWT_SECRET
npm run seed               # populates sample markets/commodities/prices
npm run dev                 # starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` calls to
the backend automatically (see `vite.config.js`).

### 4. Using the app
1. Register an account (or just browse `/dashboard` without logging in)
2. On the home page, upload/take a photo of a crop (try Google Images for
   banana, orange, cauliflower, cucumber, mushroom, etc. while testing —
   these are commodities pre-loaded in the seed data and match well against
   MobileNet's ImageNet classes)
3. Allow location access
4. Enter quantity in quintals → **Find best market to sell**
5. See the ranked market list + 7-day price forecast chart

---

## Known Limitations (good to state honestly in your report/viva)

- **Crop recognition** uses a general-purpose pretrained model (MobileNet/ImageNet), not a model trained specifically on Indian crops — so recognition is strongest for common fruits/vegetables that overlap with ImageNet's categories, and a manual-select fallback is provided when it isn't confident.
- **Quality grading** is a simple brightness/blemish heuristic, not a trained defect-detection model — a good "future scope" item.
- **Price forecasting** uses linear regression on recent history for reliability without heavy infrastructure; an LSTM (as in more complex forecasting systems) is a natural upgrade path if you want to extend accuracy.
- **Price data** here is realistic synthetic data (seed.js) generated around plausible Maharashtra APMC price ranges; for a real deployment, this table would be populated from a live source like the AGMARKNET/e-NAM API.

## Future Scope (for your report's conclusion)
- Train a custom CNN on an Indian-crop image dataset for higher accuracy
- Multilingual voice interface for low-literacy farmers
- SMS/WhatsApp price alerts
- Live mandi price ingestion via government APIs
- Offline-first PWA for low-connectivity rural areas
