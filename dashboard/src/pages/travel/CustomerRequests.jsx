import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const STATUS_CONFIG = {
  pending:             { label: 'Menunggu Admin',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  pending_customer:    { label: 'Menunggu Customer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  approved:            { label: 'Disetujui',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  approved_with_terms: { label: 'Disetujui (Syarat)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:            { label: 'Ditolak',         color: 'bg-red-100 text-red-700 border-red-200' },
  taken_over:          { label: 'Diambil Alih',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const CustomerRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);

  // Modal states
  const [rejectModal, setRejectModal]     = useState(null);  // request obj
  const [approveModal, setApproveModal]   = useState(null);  // request obj
  const [rejectReason, setRejectReason]   = useState('');
  const [approveMode, setApproveMode]     = useState('direct'); // 'direct' | 'with_terms'
  const [aiContext, setAiContext]          = useState('');
  const approveDropdownRef = useRef({});

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/travel/customer-requests', {
        params: { status: activeTab === 'history' ? undefined : activeTab }
      });
      if (res.data.success) {
        let data = res.data.data;
        if (activeTab === 'history') {
          data = data.filter(r => r.status !== 'pending' && r.status !== 'pending_customer');
        }
        setRequests(data);
      }
    } catch (err) {
      console.error('[CustomerRequests] fetch error:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const handler = () => fetchRequests();
    window.addEventListener('sse_new_customer_request', handler);
    return () => window.removeEventListener('sse_new_customer_request', handler);
  }, [activeTab]);

  // ─── TAKE OVER ────────────────────────────────────────────────
  const handleTakeOver = async (req) => {
    setActionLoading(req.id);
    try {
      const res = await api.post(`/travel/customer-requests/${req.id}/takeover`);
      if (res.data.success) {
        navigate(`/customers?chat=${req.phone}`);
        fetchRequests();
      }
    } catch (err) {
      alert('Gagal mengambil alih request');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── APPROVE ──────────────────────────────────────────────────
  const openApproveModal = (req) => {
    setApproveModal(req);
    setApproveMode('direct');
    setAiContext('');
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    if (approveMode === 'with_terms' && !aiContext.trim()) {
      alert('Syarat/catatan untuk AI wajib diisi');
      return;
    }
    setActionLoading(approveModal.id);
    try {
      await api.post(`/travel/customer-requests/${approveModal.id}/approve`, {
        with_terms: approveMode === 'with_terms',
        ai_context: approveMode === 'with_terms' ? aiContext.trim() : undefined,
      });
      setApproveModal(null);
      fetchRequests();
    } catch (err) {
      alert('Gagal menyetujui request');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── REJECT ───────────────────────────────────────────────────
  const openRejectModal = (req) => {
    setRejectModal(req);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) { alert('Alasan penolakan wajib diisi'); return; }
    setActionLoading(rejectModal.id);
    try {
      await api.post(`/travel/customer-requests/${rejectModal.id}/reject`, { reason: rejectReason.trim() });
      setRejectModal(null);
      fetchRequests();
    } catch (err) {
      alert('Gagal menolak request');
    } finally {
      setActionLoading(null);
    }
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  const TABS = [
    { key: 'pending', label: 'Menunggu Admin', icon: 'Clock' },
    { key: 'pending_customer', label: 'Menunggu Customer', icon: 'UserCircle' },
    { key: 'history', label: 'Histori', icon: 'Archive' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-heading mb-1 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Icon name="Inbox" size={20} />
            </span>
            Request Pelanggan
          </h1>
          <p className="text-text-muted text-sm">Request khusus dari pelanggan yang perlu keputusan manajemen.</p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-base rounded-xl text-sm font-bold text-text-body hover:bg-bg-subtle transition-all shadow-xs"
        >
          <Icon name="RefreshCw" size={14} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-bg-surface border border-border-base p-1 rounded-xl mb-4 sm:mb-6 w-full sm:w-fit overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[12px] sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-amber-50 text-amber-700 shadow-sm'
                : 'text-text-muted hover:text-text-heading hover:bg-bg-page/50'
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-bg-subtle flex items-center justify-center mb-4 text-text-muted">
              <Icon name="CheckCircle2" size={32} />
            </div>
            <h3 className="text-lg font-bold text-text-heading mb-1">
              {activeTab === 'pending' ? 'Tidak Ada Request Menunggu' : 'Belum Ada Histori Request'}
            </h3>
            <p className="text-text-muted text-sm max-w-sm">
              {activeTab === 'pending'
                ? 'Jika AI menemukan customer yang buntu dan membutuhkan bantuan manajemen, requestnya akan muncul di sini.'
                : 'Semua request yang sudah diproses akan tersimpan di sini.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-base p-3 sm:p-5 space-y-4 sm:space-y-6">
            {Object.values(requests.reduce((acc, req) => {
              if (!acc[req.phone]) {
                acc[req.phone] = { phone: req.phone, customer_name: req.customer_name, items: [] };
              }
              acc[req.phone].items.push(req);
              return acc;
            }, {})).map(group => (
              <div key={group.phone} className="bg-white border border-border-base rounded-2xl overflow-hidden shadow-sm">
                {/* Header Pelanggan */}
                <div className="bg-slate-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-border-base flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
                       {(group.customer_name || '?')[0].toUpperCase()}
                     </div>
                     <div>
                       <div className="font-bold text-text-heading">{group.customer_name || 'Tanpa Nama'}</div>
                       <div className="text-sm text-text-muted">{group.phone}</div>
                     </div>
                   </div>
                   <div className="text-xs font-bold text-text-muted bg-white px-3 py-1.5 rounded-lg border border-border-base shadow-xs">
                      {group.items.length} Request
                   </div>
                </div>

                {/* Daftar Request */}
                <div className="divide-y divide-border-base bg-white">
                  {group.items.map(req => {
                    const statusCfg = STATUS_CONFIG[req.status] || { label: req.status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                    const isPending = req.status === 'pending';

                    return (
                      <div key={req.id} className={`p-3 sm:p-5 transition-colors ${isPending ? 'hover:bg-amber-50/20' : 'hover:bg-bg-subtle/30'}`}>
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                              <span className="text-xs text-text-muted">{fmtDate(req.created_at)}</span>
                              {req.package_name && (
                                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                  {req.package_name}
                                </span>
                              )}
                              {req.request_type === 'revision' && (
                                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                  Revisi
                                </span>
                              )}
                            </div>

                            <div className="bg-bg-subtle rounded-xl px-4 py-3 text-sm text-text-body mb-3 whitespace-pre-wrap">
                              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1">Detail Request</span>
                              {req.request_detail}
                            </div>
                            
                            {/* Menampilkan revision note jika ada */}
                            {req.revision_note && (
                              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Catatan Revisi Terbaru</span>
                                {req.revision_note}
                              </div>
                            )}

                            {/* Admin note / ai_context for history */}
                            {!isPending && req.admin_note && (
                              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 mt-2">
                                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Alasan Penolakan</span>
                                {req.admin_note}
                              </div>
                            )}
                            {!isPending && req.ai_context && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700 mt-2">
                                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Syarat yang Diberikan</span>
                                {req.ai_context}
                              </div>
                            )}
                          </div>

                          {/* Right: Actions */}
                          {isPending && (
                            <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto sm:min-w-[130px]">
                              {/* Take Over */}
                              <button
                                onClick={() => handleTakeOver(req)}
                                disabled={actionLoading === req.id}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                <Icon name="MessageCircle" size={13} />
                                Ambil Alih
                              </button>

                              {/* Approve */}
                              <button
                                onClick={() => openApproveModal(req)}
                                disabled={actionLoading === req.id}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                <Icon name="CheckCircle" size={13} />
                                Setujui
                              </button>

                              {/* Reject */}
                              <button
                                onClick={() => openRejectModal(req)}
                                disabled={actionLoading === req.id}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                <Icon name="XCircle" size={13} />
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── APPROVE MODAL ─── */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-border-base overflow-hidden">
            <div className="px-6 py-4 border-b border-border-base flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                  <Icon name="CheckCircle" size={16} />
                </div>
                <h3 className="font-bold text-lg text-text-heading">Setujui Request</h3>
              </div>
              <button onClick={() => setApproveModal(null)} className="text-text-muted hover:text-text-heading">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-bg-subtle rounded-xl p-4 text-sm text-text-body">
                <p className="font-bold text-text-heading mb-1">{approveModal.customer_name}</p>
                <p className="text-text-muted text-xs mb-2">{approveModal.package_name}</p>
                <p>{approveModal.request_detail}</p>
              </div>

              {/* Mode selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-heading uppercase tracking-wider mb-3">Jenis Persetujuan</label>
                <button
                  onClick={() => setApproveMode('direct')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    approveMode === 'direct' ? 'border-green-500 bg-green-50' : 'border-border-base hover:border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${approveMode === 'direct' ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                      {approveMode === 'direct' && <Icon name="Check" size={10} strokeWidth={4} className="text-white" />}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-heading">Setujui Langsung</div>
                      <div className="text-xs text-text-muted mt-0.5">AI akan memberitahu pelanggan bahwa request disetujui</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setApproveMode('with_terms')}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    approveMode === 'with_terms' ? 'border-blue-500 bg-blue-50' : 'border-border-base hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${approveMode === 'with_terms' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {approveMode === 'with_terms' && <Icon name="Check" size={10} strokeWidth={4} className="text-white" />}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-heading">Setujui dengan Syarat</div>
                      <div className="text-xs text-text-muted mt-0.5">Berikan konteks/syarat → AI sampaikan ke pelanggan dengan bahasa natural</div>
                    </div>
                  </div>
                </button>

                {approveMode === 'with_terms' && (
                  <textarea
                    autoFocus
                    placeholder="Contoh: Boleh booking 1 pax tapi harga dinaikkan 20% karena biaya operasional solo..."
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    rows={3}
                    className="w-full mt-2 px-4 py-3 border border-border-base rounded-xl text-sm text-text-heading placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  />
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-bg-subtle border-t border-border-base flex justify-end gap-3">
              <button onClick={() => setApproveModal(null)} className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-heading">
                Batal
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === approveModal.id || (approveMode === 'with_terms' && !aiContext.trim())}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === approveModal.id ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Memproses...</>
                ) : (
                  <><Icon name="CheckCircle" size={14} />Kirim Keputusan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REJECT MODAL ─── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-border-base overflow-hidden">
            <div className="px-6 py-4 border-b border-border-base flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                  <Icon name="XCircle" size={16} />
                </div>
                <h3 className="font-bold text-lg text-text-heading">Tolak Request</h3>
              </div>
              <button onClick={() => setRejectModal(null)} className="text-text-muted hover:text-text-heading">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-bg-subtle rounded-xl p-4 text-sm text-text-body">
                <p className="font-bold text-text-heading mb-1">{rejectModal.customer_name}</p>
                <p>{rejectModal.request_detail}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-heading uppercase tracking-wider mb-2">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  autoFocus
                  placeholder="Contoh: Maaf, paket ini tidak bisa dimodifikasi karena ketentuan kerja sama dengan vendor..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-border-base rounded-xl text-sm text-text-heading placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                />
                <p className="text-xs text-text-muted mt-1.5">Alasan ini akan disampaikan ke pelanggan oleh AI dengan bahasa yang sopan.</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-bg-subtle border-t border-border-base flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-heading">
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal.id || !rejectReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === rejectModal.id ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Memproses...</>
                ) : (
                  <><Icon name="XCircle" size={14} />Tolak & Kirim</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerRequests;
