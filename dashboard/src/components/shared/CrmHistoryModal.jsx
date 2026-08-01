import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const CrmHistoryModal = ({ phone, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!phone) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/customers/${encodeURIComponent(phone)}/history`);
        if (res.data.status) {
          setHistory(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch CRM history', err);
        setError('Gagal memuat riwayat CRM. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [phone]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden animate-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Icon name="History" size={16} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Riwayat CRM</h3>
              <p className="text-xs text-slate-400 font-mono">{phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 rounded-full border-[3px] border-indigo-100 border-t-indigo-500 animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Memuat riwayat...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white shadow-lg mb-4">
                <Icon name="AlertCircle" size={24} />
              </div>
              <h4 className="font-bold text-slate-800 mb-1">Gagal Memuat</h4>
              <p className="text-sm text-slate-400 max-w-xs">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-300 to-gray-400 flex items-center justify-center text-white shadow-lg mb-4 animate-[float_3s_ease-in-out_infinite]">
                <Icon name="Inbox" size={24} />
              </div>
              <h4 className="font-bold text-slate-800 mb-1">Belum Ada Riwayat</h4>
              <p className="text-sm text-slate-400 max-w-xs">Belum ada riwayat aktivitas CRM untuk kontak ini.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-100 ml-3 py-2">
              {history.map((h, i) => (
                <div key={i} className="mb-5 ml-6 relative">
                  <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {h.event_type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">{new Date(h.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{h.event_detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/50">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CrmHistoryModal;
