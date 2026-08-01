import React, { useState } from 'react';
import PendingApprovals from '@/components/shared/PendingApprovals';
// import KnowledgeBase from '@/pages/shared/KnowledgeBase'; // Assuming this will be used for Produk

/** Admin Dashboard — Knowledge base CRUD, store config, transaction verification */
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending_approvals');

  return (
    <div className="h-[calc(100vh-70px)] overflow-y-auto bg-slate-50/50 pb-10 font-sans antialiased">
      <div className="relative z-10 px-4 sm:px-6 h-[64px] bg-white border-b border-slate-200 flex items-center justify-between shadow-sm sticky top-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col justify-center">
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-snug">Admin Panel</h1>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Verifikasi Pembayaran & Konfigurasi
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-[1000px] mx-auto">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6">
          <button
            className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'pending_approvals' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            onClick={() => setActiveTab('pending_approvals')}
          >
            Verifikasi Pembayaran
          </button>
          <button
            className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'produk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            onClick={() => setActiveTab('produk')}
          >
            Data Produk
          </button>
          <button
            className={`flex-1 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${activeTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            onClick={() => setActiveTab('config')}
          >
            Konfigurasi Toko
          </button>
        </div>

        <div className="bg-transparent">
          {activeTab === 'pending_approvals' && <PendingApprovals />}
          {activeTab === 'produk' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
              <i className="fas fa-box-open text-3xl mb-3 text-slate-300"></i>
              <p className="text-[13px] font-medium">Manajemen Data Produk akan tampil di sini.</p>
            </div>
          )}
          {activeTab === 'config' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
              <i className="fas fa-cogs text-3xl mb-3 text-slate-300"></i>
              <p className="text-[13px] font-medium">Konfigurasi Toko akan tampil di sini.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
