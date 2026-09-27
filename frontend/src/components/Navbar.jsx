import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('userName');
  const role = localStorage.getItem('role');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('role');
    localStorage.removeItem('marketId');
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">🌾 AgriPrice Vision</Link>
      <div className="nav-links">
        {role === 'broker' ? (
          <Link to="/broker">Broker Dashboard</Link>
        ) : (
          <>
            <Link to="/">Upload &amp; Sell</Link>
            <Link to="/location">Location Prices</Link>
            <Link to="/dashboard">Browse Prices</Link>
          </>
        )}
        {token ? (
          <>
            <span className="user-chip">Hi, {userName} {role === 'broker' && '(Broker)'}</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
