import { Link } from 'react-router-dom';

/** 404 Not Found page */
const NotFound = () => (
  <div className="page page--not-found">
    <h2>404 — Halaman Tidak Ditemukan</h2>
    <p>Halaman yang Anda cari tidak ada.</p>
    <Link to="/dashboard">Kembali ke Dashboard</Link>
  </div>
);
export default NotFound;
