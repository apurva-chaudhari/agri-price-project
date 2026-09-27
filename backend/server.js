const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/markets');
const priceRoutes = require('./routes/prices');
const uploadRoutes = require('./routes/uploads');
const recommendRoutes = require('./routes/recommend');
const districtRoutes = require('./routes/districts');
const brokerRoutes = require('./routes/broker');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'agri-price-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/broker', brokerRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`AgriPrice backend running on http://localhost:${PORT}`));
