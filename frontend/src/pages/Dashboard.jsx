import { useEffect, useState } from 'react';
import api from '../api';
import PriceChart from '../components/PriceChart';

const GRADES = ['A', 'B', 'C'];

export default function Dashboard() {
  const [commodities, setCommodities] = useState([]);
  const [selected, setSelected] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [currentPrices, setCurrentPrices] = useState([]);
  const [chartMarketId, setChartMarketId] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [gradeBoards, setGradeBoards] = useState([]);

  useEffect(() => {
    api.get('/prices/commodities').then((res) => {
      setCommodities(res.data);
      if (res.data.length) {
        setSelected(res.data[0].name);
        setSelectedId(res.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get('/prices/current', { params: { commodity: selected } }).then((res) => {
      setCurrentPrices(res.data);
      setChartData(null);
      setChartMarketId(null);
    });
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    api.get('/broker/reference-all', { params: { commodity_id: selectedId } })
      .then((res) => setGradeBoards(res.data))
      .catch(() => setGradeBoards([]));
  }, [selectedId]);

  function handleSelect(name) {
    setSelected(name);
    const c = commodities.find((c) => c.name === name);
    setSelectedId(c ? c.id : null);
  }

  async function loadChart(marketId) {
    setChartMarketId(marketId);
    const { data } = await api.get('/prices/forecast', {
      params: { commodity: selected, market_id: marketId, daysAhead: 7 },
    });
    setChartData(data);
  }

  return (
    <div className="page dashboard-page">
      <h2>Market Price Dashboard</h2>

      <select value={selected} onChange={(e) => handleSelect(e.target.value)}>
        {commodities.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      {gradeBoards.length > 0 && (
        <div className="grade-board-section">
          <h3>Grade photos &amp; today's price (set by the broker at each market)</h3>
          <p className="subtitle">
            No camera or upload needed — compare your crop with these fixed photos and read off the price
            the broker at that market is paying today.
          </p>
          {gradeBoards.map((board) => (
            <div key={board.market_id} className="grade-board-card">
              <h4>{board.market_name}{board.district ? ` · ${board.district}` : ''}</h4>
              <div className="grade-board-grid">
                {GRADES.map((grade) => {
                  const g = board.grades[grade];
                  if (!g) return null;
                  return (
                    <div key={grade} className="grade-board-item">
                      <div className={`grade-badge grade-${grade}`}>Grade {grade}</div>
                      <img src={`/uploads/${g.image_path}`} alt={`${board.market_name} grade ${grade}`} className="grade-board-img" />
                      {g.notes && <p className="grade-note">{g.notes}</p>}
                      <p className="grade-board-price">
                        {g.price !== null ? `₹${g.price} / quintal` : <span className="error">not set today</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Market</th>
            <th>Min</th>
            <th>Max</th>
            <th>Modal</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {currentPrices.map((p) => (
            <tr key={p.market_id} className={chartMarketId === p.market_id ? 'best-row' : ''}>
              <td>{p.market_name}</td>
              <td>₹{p.min_price}</td>
              <td>₹{p.max_price}</td>
              <td>₹{p.modal_price}</td>
              <td>{p.price_date?.slice(0, 10)}</td>
              <td><button onClick={() => loadChart(p.market_id)}>View trend</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {chartData && (
        <div className="chart-section">
          <h3>{selected} price trend with 7-day forecast</h3>
          <PriceChart history={chartData.history} forecast={chartData.forecast} />
        </div>
      )}
    </div>
  );
}
