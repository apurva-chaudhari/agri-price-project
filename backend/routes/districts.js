const express = require('express');
const { DISTRICTS } = require('../data/maharashtraDistricts');

const router = express.Router();

// GET /api/districts -> list of all district names
router.get('/', (req, res) => {
  res.json(Object.keys(DISTRICTS).sort());
});

// GET /api/districts/:name/talukas -> talukas (APMCs) for that district, with village counts
router.get('/:name/talukas', (req, res) => {
  const districtName = req.params.name;
  // case-insensitive match, since GPS reverse-geocoding results can vary in casing/spelling
  const key = Object.keys(DISTRICTS).find(
    (d) => d.toLowerCase() === districtName.toLowerCase()
  );
  if (!key) {
    return res.status(404).json({ error: `District "${districtName}" not found` });
  }
  res.json({ district: key, talukas: DISTRICTS[key] });
});

module.exports = router;
