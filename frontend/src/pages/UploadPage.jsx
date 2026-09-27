import { useEffect, useState } from 'react';
import api from '../api';
import PhotoUpload from '../components/PhotoUpload';
import MarketRecommendation from '../components/MarketRecommendation';
import PriceChart from '../components/PriceChart';

export default function UploadPage() {
  const [commodities, setCommodities] = useState([]);
  const [classification, setClassification] = useState(null);
  const [quantity, setQuantity] = useState(5);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [recommendation, setRecommendation] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/prices/commodities').then((res) => setCommodities(res.data)).catch(() => {});
    detectLocation();
  }, []);

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    setLocationStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('done');
      },
      () => setLocationStatus('denied'),
      { timeout: 6000 }
    );
  }

  async function getRecommendations() {
    if (!classification?.commodity || !location) return;
    setLoadingRecommend(true);
    setError('');
    try {
      const { data } = await api.post('/recommend', {
        commodity: classification.commodity,
        grade: classification.grade,
        embedding: classification.embedding || null,
        quantityQuintals: Number(quantity),
        farmerLat: location.lat,
        farmerLng: location.lng,
      });
      setRecommendation(data);

      if (data.best_choice) {
        const { data: forecastData } = await api.get('/prices/forecast', {
          params: { commodity: classification.commodity, market_id: data.best_choice.market_id, daysAhead: 7 },
        });
        setChartData(forecastData);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate recommendations. Is the backend/database running?');
    } finally {
      setLoadingRecommend(false);
    }
  }

  return (
    <div className="page upload-page">
      <h2>Upload your crop photo</h2>
      <p className="subtitle">We'll identify the crop, estimate quality, and tell you the best market to sell for maximum profit.</p>

      {!classification && (
        <PhotoUpload commodities={commodities} onResult={setClassification} />
      )}

      {classification && (
        <div className="confirmed-box">
          <p>
            Selling: <strong>{classification.commodity}</strong> · Your estimated grade: <strong>{classification.grade}</strong>
            <br /><small className="hint">This may be refined per market below if that market's broker has set up grading.</small>
          </p>
          <button className="link-btn" onClick={() => { setClassification(null); setRecommendation(null); }}>
            Retake photo
          </button>

          <label>
            Quantity (quintals)
            <input type="number" min="0.5" step="0.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>

          <div className="location-row">
            {locationStatus === 'detecting' && <span>Detecting your location...</span>}
            {locationStatus === 'done' && <span>📍 Location detected</span>}
            {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
              <span className="error">Location unavailable — allow location access to get accurate distance-based recommendations.</span>
            )}
          </div>

          <button onClick={getRecommendations} disabled={!location || loadingRecommend}>
            {loadingRecommend ? 'Calculating best market...' : 'Find best market to sell'}
          </button>

          {error && <p className="error">{error}</p>}
        </div>
      )}

      {recommendation && <MarketRecommendation data={recommendation} />}

      {chartData && (
        <div className="chart-section">
          <h3>Price trend at {recommendation.best_choice.market_name} (with 7-day forecast)</h3>
          <PriceChart history={chartData.history} forecast={chartData.forecast} />
        </div>
      )}
    </div>
  );
}
