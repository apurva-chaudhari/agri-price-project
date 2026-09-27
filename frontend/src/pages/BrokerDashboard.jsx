import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as mobilenet from '@tensorflow-models/mobilenet';
import api from '../api';

const GRADES = ['A', 'B', 'C'];

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const [commodities, setCommodities] = useState([]);
  const [commodityId, setCommodityId] = useState('');
  const [notes, setNotes] = useState({ A: '', B: '', C: '' });
  const [files, setFiles] = useState({ A: null, B: null, C: null });
  const [previews, setPreviews] = useState({ A: null, B: null, C: null });
  const [prices, setPrices] = useState({ A: '', B: '', C: '' });
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [existing, setExisting] = useState({ references: [], todayPrices: [] });
  const modelRef = useRef(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'broker') {
      navigate('/');
      return;
    }
    api.get('/prices/commodities').then((res) => setCommodities(res.data));
    loadExisting();
  }, []);

  function loadExisting() {
    api.get('/broker/my-references').then((res) => setExisting(res.data)).catch(() => {});
  }

  async function ensureModel() {
    if (!modelRef.current) modelRef.current = await mobilenet.load();
    return modelRef.current;
  }

  function handleFile(grade, e) {
    const file = e.target.files[0];
    if (!file) return;
    setFiles((f) => ({ ...f, [grade]: file }));
    setPreviews((p) => ({ ...p, [grade]: URL.createObjectURL(file) }));
  }

  async function computeEmbedding(file) {
    const model = await ensureModel();
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const tensor = model.infer(img, true);
    const embedding = Array.from(await tensor.data());
    tensor.dispose();
    URL.revokeObjectURL(url);
    return embedding;
  }

  async function uploadReference(grade) {
    if (!commodityId || !files[grade]) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const embedding = await computeEmbedding(files[grade]);
      const formData = new FormData();
      formData.append('image', files[grade]);
      formData.append('commodity_id', commodityId);
      formData.append('grade', grade);
      formData.append('embedding', JSON.stringify(embedding));
      formData.append('notes', notes[grade]);

      await api.post('/broker/reference', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(`Grade ${grade} reference photo saved.`);
      loadExisting();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to save Grade ${grade} reference`);
    } finally {
      setUploading(false);
    }
  }

  async function savePrices() {
    if (!commodityId) return;
    setError('');
    setMessage('');
    try {
      await api.post('/broker/prices', { commodity_id: commodityId, prices });
      setMessage("Today's prices saved.");
      loadExisting();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save prices');
    }
  }

  const selectedCommodityName = commodities.find((c) => c.id === Number(commodityId))?.name;

  return (
    <div className="page broker-page">
      <h2>Broker Dashboard</h2>
      <p className="subtitle">
        Upload reference photos defining Grade A/B/C for each crop, and set today's price per grade.
        Farmers' photos are matched against YOUR reference photos, so the price they see matches what you'll actually offer.
      </p>

      <label className="district-label">
        Commodity
        <select value={commodityId} onChange={(e) => { setCommodityId(e.target.value); setMessage(''); setError(''); }}>
          <option value="">-- select a commodity --</option>
          {commodities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      {commodityId && (
        <>
          <div className="broker-grade-grid">
            {GRADES.map((grade) => (
              <div key={grade} className="broker-grade-card">
                <div className={`grade-badge grade-${grade}`}>Grade {grade}</div>
                <label className="file-drop small-drop">
                  <input type="file" accept="image/*" onChange={(e) => handleFile(grade, e)} hidden />
                  {previews[grade] ? <img src={previews[grade]} alt={`grade ${grade}`} className="preview-img" /> : <span>Upload reference photo</span>}
                </label>
                <input
                  className="notes-input"
                  placeholder={`Notes (e.g. "no stones/kadi/kachra")`}
                  value={notes[grade]}
                  onChange={(e) => setNotes((n) => ({ ...n, [grade]: e.target.value }))}
                />
                <button onClick={() => uploadReference(grade)} disabled={!files[grade] || uploading}>
                  Save Grade {grade} reference
                </button>
              </div>
            ))}
          </div>

          <div className="confirmed-box price-box">
            <h3>Today's prices for {selectedCommodityName} (₹ per quintal)</h3>
            <div className="price-input-row">
              {GRADES.map((grade) => (
                <label key={grade}>
                  Grade {grade}
                  <input type="number" min="0" value={prices[grade]} onChange={(e) => setPrices((p) => ({ ...p, [grade]: e.target.value }))} />
                </label>
              ))}
            </div>
            <button onClick={savePrices}>Save today's prices</button>
          </div>
        </>
      )}

      {message && <p className="status-text">{message}</p>}
      {error && <p className="error">{error}</p>}

      {existing.references.length > 0 && (
        <div className="chart-section">
          <h3>Your current setup</h3>
          <table>
            <thead><tr><th>Commodity</th><th>Grade</th><th>Notes</th><th>Today's price</th></tr></thead>
            <tbody>
              {existing.references.map((r) => {
                const priceRow = existing.todayPrices.find((p) => p.commodity_id === r.commodity_id && p.grade === r.grade);
                return (
                  <tr key={r.id}>
                    <td>{r.commodity_name}</td>
                    <td><span className={`grade-pill grade-${r.grade}`}>{r.grade}</span></td>
                    <td>{r.notes || '—'}</td>
                    <td>{priceRow ? `₹${priceRow.price}` : <span className="error">not set today</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
