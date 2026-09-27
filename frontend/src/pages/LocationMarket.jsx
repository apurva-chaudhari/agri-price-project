import { useEffect, useState } from 'react';
import api from '../api';

export default function LocationMarket() {
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [talukas, setTalukas] = useState([]);
  const [markets, setMarkets] = useState([]); // all seeded markets, for name-matching
  const [selectedTaluka, setSelectedTaluka] = useState(null);
  const [marketPrices, setMarketPrices] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | detecting | detected | denied | no-match
  const [detectedLabel, setDetectedLabel] = useState('');
  const [loadingTalukas, setLoadingTalukas] = useState(false);

  useEffect(() => {
    api.get('/districts').then((res) => setDistricts(res.data));
    api.get('/markets').then((res) => setMarkets(res.data));
    detectDistrict();
  }, []);

  function detectDistrict() {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Free reverse-geocoding (OpenStreetMap Nominatim) - no API key needed.
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await resp.json();
          const addr = data.address || {};
          const rawDistrict = addr.state_district || addr.county || addr.city_district || '';
          setDetectedLabel(rawDistrict || data.display_name || 'your location');

          const cleaned = rawDistrict.replace(/\s*district\s*/i, '').trim();
          const match = await tryMatchDistrict(cleaned);
          if (match) {
            setSelectedDistrict(match);
            setGeoStatus('detected');
          } else {
            setGeoStatus('no-match');
          }
        } catch (err) {
          console.error(err);
          setGeoStatus('no-match');
        }
      },
      () => setGeoStatus('denied'),
      { timeout: 8000 }
    );
  }

  async function tryMatchDistrict(name) {
    if (!name) return null;
    try {
      const { data } = await api.get(`/districts/${encodeURIComponent(name)}/talukas`);
      return data.district;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!selectedDistrict) return;
    setLoadingTalukas(true);
    setSelectedTaluka(null);
    setMarketPrices(null);
    api
      .get(`/districts/${encodeURIComponent(selectedDistrict)}/talukas`)
      .then((res) => setTalukas(res.data.talukas))
      .finally(() => setLoadingTalukas(false));
  }, [selectedDistrict]);

  function findMatchingMarket(talukaName) {
    const lower = talukaName.toLowerCase();
    return markets.find(
      (m) => m.name.toLowerCase().includes(lower) || lower.includes(m.name.toLowerCase().replace(' apmc', ''))
    );
  }

  async function selectTaluka(t) {
    setSelectedTaluka(t);
    setMarketPrices(null);
    const market = findMatchingMarket(t.taluka);
    if (!market) {
      setMarketPrices({ noData: true });
      return;
    }
    const { data } = await api.get(`/prices/market/${market.id}`);
    setMarketPrices({ market, rows: data });
  }

  return (
    <div className="page location-page">
      <h2>Location-Based Market Price</h2>
      <p className="subtitle">Find your district, browse its talukas/APMCs, and see the latest crop prices at each.</p>

      <div className="location-detect-box">
        {geoStatus === 'detecting' && <p className="status-text">📍 Detecting your district via GPS...</p>}
        {geoStatus === 'detected' && <p className="status-text">📍 Detected district: <strong>{selectedDistrict}</strong></p>}
        {geoStatus === 'no-match' && (
          <p className="status-text error">
            Detected "{detectedLabel}" but it's not in our Maharashtra district list — please select your district manually below.
          </p>
        )}
        {geoStatus === 'denied' && (
          <p className="status-text error">Location access unavailable — please select your district manually below.</p>
        )}
        <button className="link-btn" onClick={detectDistrict}>Re-detect my location</button>
      </div>

      <label className="district-label">
        Select district
        <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
          <option value="">-- choose a district --</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      {loadingTalukas && <p className="status-text">Loading talukas...</p>}

      {!loadingTalukas && selectedDistrict && talukas.length > 0 && (
        <div className="taluka-grid">
          {talukas.map((t) => (
            <button
              key={t.taluka}
              className={`taluka-card ${selectedTaluka?.taluka === t.taluka ? 'active' : ''}`}
              onClick={() => selectTaluka(t)}
            >
              <span className="taluka-name">{t.taluka}</span>
              <span className="taluka-villages">
                {t.villages !== null ? `${t.villages} villages` : 'Village count N/A'}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedTaluka && marketPrices && (
        <div className="market-price-box">
          {marketPrices.noData ? (
            <p className="hint">
              No live price data available for <strong>{selectedTaluka.taluka}</strong> in this demo dataset yet.
              Try: Amravati, Daryapur, Achalpur, Chandur Bazar, Akot, Murtizapur, Yavatmal or Washim — these have seeded APMC price data.
            </p>
          ) : (
            <>
              <h3>Latest prices at {marketPrices.market.name}</h3>
              <table>
                <thead>
                  <tr><th>Commodity</th><th>Category</th><th>Min</th><th>Max</th><th>Modal</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {marketPrices.rows.map((r) => (
                    <tr key={r.commodity_id}>
                      <td>{r.commodity_name}</td>
                      <td>{r.category}</td>
                      <td>₹{r.min_price}</td>
                      <td>₹{r.max_price}</td>
                      <td>₹{r.modal_price}</td>
                      <td>{r.price_date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
