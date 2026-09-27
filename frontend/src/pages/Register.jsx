import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [role, setRole] = useState('farmer');
  const [marketId, setMarketId] = useState('');
  const [markets, setMarkets] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/markets').then((res) => setMarkets(res.data));
  }, []);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (role === 'broker' && !marketId) {
      setError('Please select which market/APMC you represent');
      return;
    }
    try {
      const geo = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 4000 }
        );
      });

      const { data } = await api.post('/auth/register', {
        ...form,
        role,
        market_id: role === 'broker' ? Number(marketId) : undefined,
        location_lat: geo?.lat,
        location_lng: geo?.lng,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.user.name);
      localStorage.setItem('role', data.user.role);
      localStorage.setItem('marketId', data.user.market_id || '');
      navigate(data.user.role === 'broker' ? '/broker' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="auth-page">
      <h2>Create your account</h2>
      <form onSubmit={handleSubmit}>
        <div className="role-toggle">
          <button type="button" className={role === 'farmer' ? 'active' : ''} onClick={() => setRole('farmer')}>I'm a Farmer</button>
          <button type="button" className={role === 'broker' ? 'active' : ''} onClick={() => setRole('broker')}>I'm a Broker</button>
        </div>

        <input placeholder="Full name" value={form.name} onChange={update('name')} required />
        <input type="email" placeholder="Email" value={form.email} onChange={update('email')} required />
        <input type="password" placeholder="Password" value={form.password} onChange={update('password')} required />
        <input placeholder="Phone (optional)" value={form.phone} onChange={update('phone')} />

        {role === 'broker' && (
          <>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} required>
              <option value="">-- which market/APMC do you represent? --</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.district})</option>
              ))}
            </select>
            <p className="hint">As a broker, you'll set daily grade-wise prices and upload reference photos so farmers get accurate, market-matched pricing.</p>
          </>
        )}
        {role === 'farmer' && <p className="hint">We'll ask for your location to recommend nearby markets.</p>}

        {error && <p className="error">{error}</p>}
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}
