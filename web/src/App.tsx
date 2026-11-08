import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { useAsync } from './lib/hooks';
import { api } from './lib/api';
import DashboardPage from './pages/DashboardPage';
import PelangganPage from './pages/PelangganPage';
import LayananPage from './pages/LayananPage';
import PesananPage from './pages/PesananPage';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/pesanan', label: 'Pesanan' },
  { to: '/pelanggan', label: 'Pelanggan' },
  { to: '/layanan', label: 'Layanan' },
];

function ApiStatus() {
  const { data, error, loading } = useAsync(() => api.stats(), []);
  const state = loading ? 'checking' : error || !data ? 'offline' : 'online';
  const text = { checking: 'Menghubungkan…', offline: 'API offline', online: 'API terhubung' }[state];
  return <span className={`api-status api-${state}`}><i />{text}</span>;
}

export default function App() {
  return (
    <ToastProvider>
      <div className="shell">
        <header className="topbar">
          <div className="brand"><span className="logo" aria-hidden>◎</span> Rinso Laundry</div>
          <nav className="nav" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
            ))}
          </nav>
          <ApiStatus />
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pesanan" element={<PesananPage />} />
            <Route path="/pelanggan" element={<PelangganPage />} />
            <Route path="/layanan" element={<LayananPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="footer muted">PBAD 2026/2027 · Sistem Laundry · Web Client React TypeScript</footer>
      </div>
    </ToastProvider>
  );
}
