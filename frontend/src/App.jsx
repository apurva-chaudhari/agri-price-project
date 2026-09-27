import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import UploadPage from './pages/UploadPage';
import Dashboard from './pages/Dashboard';
import LocationMarket from './pages/LocationMarket';
import BrokerDashboard from './pages/BrokerDashboard';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/location" element={<LocationMarket />} />
          <Route path="/broker" element={<BrokerDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
