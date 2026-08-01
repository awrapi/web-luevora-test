import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A generic placeholder for settings and management pages.
 */
const SettingsPlaceholder = ({ title }) => {
  const location = useLocation();
  const pageTitle = title || location.pathname.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="p-8">
      <div className="bg-white border border-border-base rounded-2xl p-12 text-center shadow-sm">
        <div className="w-20 h-20 bg-indigo-soft rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-tools text-indigo-base text-2xl"></i>
        </div>
        <h2 className="text-2xl font-display font-bold text-text-heading mb-2">{pageTitle}</h2>
        <p className="text-text-muted max-w-md mx-auto">
          Halaman ini sedang dalam tahap migrasi. <br/>
          Semua fitur dari sistem legacy akan segera tersedia di sini dengan antarmuka yang lebih modern.
        </p>
        <button className="mt-8 px-6 py-2 bg-indigo-base text-white font-bold rounded-lg hover:bg-indigo-mid transition-all active:scale-95">
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
};

export default SettingsPlaceholder;
