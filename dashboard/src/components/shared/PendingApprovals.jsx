import React, { useState, useEffect } from 'react';
import api from '@/services/api';

const PendingApprovals = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reasons, setReasons] = useState({});
  const [actionLoading, setActionLoading] = useState(null); // id_action

  const fetchPendingOrders = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/pending-orders');
      if (res.data.status) {
        setOrders(res.data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();
    // Optional polling
    const interval = setInterval(fetchPendingOrders, 30000); // 30s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (trxId, actType) => {
    const reason = reasons[trxId] || '';
    if (actType === 'decline' && !reason.trim()) {
      alert('Mohon masukkan alasan penolakan.');
      return;
    }

    if (!window.confirm(`Yakin ingin ${actType === 'approve' ? 'menyetujui' : 'menolak'} transaksi ini?`)) return;

    setActionLoading(`${trxId}_${actType}`);
    try {
      const res = await api.post('/admin/transaction/verify', {
        trx_id: trxId,
        act_type: actType,
        reason: actType === 'decline' ? reason : undefined
      });
      if (res.data.status) {
        alert(res.data.message);
        fetchPendingOrders();
      } else {
        alert('Gagal: ' + res.data.message);
      }
    } catch (error) {
      console.error('Error verifying transaction:', error);
      alert('Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReasonChange = (trxId, val) => {
    setReasons(prev => ({ ...prev, [trxId]: val }));
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-[13px] font-medium">
        <i className="fas fa-spinner fa-spin mr-2"></i> Memuat antrean persetujuan...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <i className="fas fa-check-circle text-4xl mb-3 text-emerald-400"></i>
        <p className="text-[14px] font-bold text-slate-700">Aman.</p>
        <p className="text-[13px] font-medium mt-1">Tidak ada pesanan menunggu verifikasi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[15px] font-bold text-slate-800">Menunggu Verifikasi ({orders.length})</h3>
        <button 
          onClick={fetchPendingOrders}
          className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-sync-alt text-slate-500"></i> Refresh
        </button>
      </div>

      {orders.map(t => {
        const img = t.proof_image || 'https://via.placeholder.com/150?text=No+Image';
        const clientName = t.sender_name || t.customer_name || 'Belum Diketahui';
        const userPhone = t.user_phone || '-';
        const productName = t.destination || 'Belum Diketahui';
        const paxCnt = t.pax_count || 1;
        const formFilled = t.form_filled === 1;

        let aiData = null;
        if (t.ai_analysis) {
          try {
            aiData = JSON.parse(t.ai_analysis);
          } catch (e) {}
        }

        let formData = {};
        if (t.form_data) {
          try {
            formData = JSON.parse(t.form_data);
          } catch (e) {}
        }

        const borderColor = formFilled ? 'border-emerald-500' : 'border-amber-400';

        return (
          <div key={t.id} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${borderColor} p-5 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex flex-col md:flex-row gap-5">
              {/* Gambar Bukti */}
              <div className="w-full md:w-[140px] shrink-0 flex flex-col items-center">
                <img 
                  src={img} 
                  alt="Bukti" 
                  className="w-full h-[140px] object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-90"
                  onClick={() => window.open(img, '_blank')}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Gagal+Muat'; }}
                />
                <a 
                  href={img} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <i className="fas fa-external-link-alt"></i> Buka Asli
                </a>
                <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">Bukti Transfer</span>
              </div>

              {/* Konten Detail */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-[14px] font-bold text-slate-800">Order #{t.order_id}</h4>
                  {t.status === 'paid' ? (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Sudah Bayar</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Menunggu Verifikasi</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <i className="fas fa-phone-alt text-[9px] mr-1"></i> {userPhone}
                  </span>
                  {formFilled ? (
                    <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <i className="fas fa-wpforms mr-1"></i> Form Terisi
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                      <i className="fas fa-hourglass-half mr-1"></i> Menunggu Form
                    </span>
                  )}
                </div>

                <div className="text-[13px] font-medium text-slate-700 mb-2">
                  👤 <strong className="font-bold">{clientName}</strong>
                </div>

                {formFilled ? (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg py-2 px-3 mb-3 text-[12px] font-bold flex justify-between items-center">
                    <div className="flex items-center gap-2 truncate">
                      <span>🛍️ {productName}</span>
                    </div>
                    <span className="bg-white px-2 py-0.5 rounded text-emerald-700 border border-emerald-200 shrink-0">{paxCnt}x</span>
                  </div>
                ) : (
                  <>
                    <div className="text-[12px] font-medium text-slate-600 mb-2">
                      💰 Nominal: {t.detected_amount > 0 ? <strong className="text-slate-800">Rp {t.detected_amount.toLocaleString('id-ID')}</strong> : <em className="text-slate-400">Belum terdeteksi</em>}
                      {t.detected_bank && <span className="ml-2 border-l border-slate-300 pl-2">🏦 {t.detected_bank}</span>}
                    </div>
                    <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg py-2 px-3 mb-3 text-[11px] font-medium flex gap-2">
                      <i className="fas fa-info-circle mt-0.5"></i>
                      <span>Setelah approve, AI akan mengirimkan link formulir ke customer.</span>
                    </div>
                  </>
                )}

                {/* Form Data Preview (if Form Filled) */}
                {formFilled && Object.keys(formData).length > 0 && (
                  <div className="bg-slate-50 border border-emerald-100 rounded-xl p-3 mb-3">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <i className="fas fa-clipboard-check"></i> Data Formulir
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-[12px]">
                      {Object.entries(formData).filter(([k]) => !k.startsWith('_')).map(([key, val]) => (
                        <div key={key} className="flex flex-col mb-1">
                          <span className="text-slate-500 font-medium capitalize">{key.replace(/[-_]/g, ' ')}</span>
                          <span className="text-slate-800 font-bold truncate" title={val}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Vision Insight */}
                {aiData && (
                  <div className="bg-slate-50 border border-blue-100 rounded-xl p-3 mb-3">
                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <i className="fas fa-robot"></i> AI Vision Insight
                      {aiData.confidence === 'high' && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] ml-1">High</span>}
                      {aiData.confidence === 'medium' && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] ml-1">Medium</span>}
                      {aiData.confidence === 'low' && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[9px] ml-1">Low</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <div className="text-slate-500 font-medium">Nominal</div>
                        <div className="text-slate-800 font-bold">{aiData.amount ? `Rp ${parseInt(aiData.amount).toLocaleString('id-ID')}` : '-'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Bank/Metode</div>
                        <div className="text-slate-800 font-bold">{aiData.bank || '-'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Tgl Transaksi</div>
                        <div className="text-slate-800 font-bold">{aiData.date || '-'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleAction(t.id, 'approve')}
                    disabled={actionLoading !== null}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 flex justify-center items-center gap-1.5"
                  >
                    {actionLoading === `${t.id}_approve` ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                    Verifikasi & Approve
                  </button>
                  <div className="flex-1 flex border border-red-200 rounded-xl overflow-hidden focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 transition-all bg-white">
                    <input 
                      type="text" 
                      placeholder="Alasan tolak..." 
                      className="w-full text-[12px] font-medium text-slate-700 px-3 outline-none"
                      value={reasons[t.id] || ''}
                      onChange={(e) => handleReasonChange(t.id, e.target.value)}
                    />
                    <button
                      onClick={() => handleAction(t.id, 'decline')}
                      disabled={actionLoading !== null}
                      className="px-4 py-2 text-[12px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors shrink-0 disabled:opacity-50 border-l border-red-200"
                    >
                      {actionLoading === `${t.id}_decline` ? <i className="fas fa-spinner fa-spin"></i> : 'Tolak'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingApprovals;
