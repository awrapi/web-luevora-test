import React, { useState, useEffect } from 'react';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const resolveProofUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url;
};

const STATUS_OPTIONS = [
  { value: 'all',     label: 'Semua Transaksi',                icon: 'Layers',        gradient: 'from-indigo-500 to-violet-600', activeBg: 'bg-indigo-50', activeText: 'text-indigo-700', countColor: 'bg-indigo-100 text-indigo-600' },
  { value: 'pending', label: 'Pending Approval (Wait)',        icon: 'Clock',         gradient: 'from-amber-400 to-orange-500',  activeBg: 'bg-amber-50',  activeText: 'text-amber-700',  countColor: 'bg-amber-100 text-amber-600' },
  { value: 'active',  label: 'Active Orders (Lunas DP/Full)', icon: 'CheckCircle',   gradient: 'from-emerald-400 to-teal-500',  activeBg: 'bg-emerald-50', activeText: 'text-emerald-700', countColor: 'bg-emerald-100 text-emerald-600' },
  { value: 'history', label: 'History (Selesai/Expired)',     icon: 'Archive',       gradient: 'from-slate-400 to-gray-500',    activeBg: 'bg-slate-50',  activeText: 'text-slate-700',  countColor: 'bg-slate-100 text-slate-600' },
];

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [pendingForms, setPendingForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [configs, setConfigs] = useState({
    dp_enabled: 'false',
    dp_percentage: '50',
    sign_delay_hours: '4',
    auto_followup_expiry_hours: '72',
    expired_delay_hours: '48',
    auto_follow_up: 'false'
  });
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  

  // Quick-add tag presets
  const TAG_PRESETS = [
    { label: 'Nama Lengkap', key: 'nama', type: 'text', placeholder: 'Nama lengkap customer' },
    { label: 'Email', key: 'email', type: 'email', placeholder: 'Alamat email customer' },
    { label: 'No. Telepon', key: 'no_telp', type: 'phone', placeholder: 'Nomor WhatsApp/HP' },
    { label: 'Paket yang Diambil', key: 'paket', type: 'text', placeholder: 'Nama paket perjalanan' },
    { label: 'Jumlah Orang', key: 'jumlah_orang', type: 'text', placeholder: 'Berapa peserta' },
    { label: 'Tanggal Keberangkatan', key: 'tanggal', type: 'text', placeholder: 'Tanggal trip' },
    { label: 'Request Khusus', key: 'request', type: 'textarea', placeholder: 'Permintaan/catatan khusus', required: false },
    { label: 'Catatan', key: 'catatan', type: 'textarea', placeholder: 'Catatan tambahan', required: false },
  ];


  useEffect(() => {
    fetchConfigs();
    fetchTransactions();
    fetchPendingForms();
    const handleSse = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'payment_proof_received' || data.type === 'new_transaction') {
          fetchTransactions();
        }
        
      } catch (err) {}
    };

    window.addEventListener('luevora_sse', handleSse);
    return () => window.removeEventListener('luevora_sse', handleSse);
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/configuration');
      if (res.data.success && res.data.data) {
        setConfigs(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  

  
  // ─────────────────────────────────────────────────────────────────


  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/transactions');
      if (res.data.success) {
        setTransactions(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingForms = async () => {
    try {
      setIsPendingLoading(true);
      const res = await api.get('/travel/order-form/forms/pending');
      if (res.data.success) {
        setPendingForms(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending forms:', error);
    } finally {
      setIsPendingLoading(false);
    }
  };



  const handleApprove = async (id, paymentType) => {
    if (!window.confirm(`Setujui sebagai pembayaran ${paymentType.toUpperCase()}?`)) return;
    setIsProcessing(true);
    try {
      const res = await api.post(`/transactions/${id}/approve`, { payment_type: paymentType });
      if (res.data.success) {
        alert('Pembayaran disetujui!');
        setSelectedApproval(null);
        fetchTransactions();
      }
    } catch (error) {
      alert('Gagal menyetujui.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveForm = async (id) => {
    if (!window.confirm('Buat invoice untuk pesanan ini?')) return;
    try {
      setIsProcessing(true);
      const res = await api.post(`/travel/order-form/forms/${id}/approve`);
      if (res.data.success) {
        alert('Invoice berhasil dibuat!');
        fetchPendingForms();
        fetchTransactions();
      }
    } catch (error) {
      alert('Gagal membuat invoice: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectForm = async (id) => {
    const reason = window.prompt('Alasan penolakan pesanan ini (akan disampaikan AI ke customer):');
    if (!reason) return;
    try {
      setIsProcessing(true);
      const res = await api.post(`/travel/order-form/forms/${id}/reject`, { reason });
      if (res.data.success) {
        alert('Pesanan ditolak, AI akan mengirimkan pesan.');
        fetchPendingForms();
      }
    } catch (error) {
      alert('Gagal menolak pesanan: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualFollowUp = async (id) => {
    if (!window.confirm('Kirim pesan follow-up ke pelanggan sekarang?')) return;
    try {
      const res = await api.post(`/transactions/${id}/follow-up`);
      if (res.data.success) {
        alert('Follow up terkirim!');
        fetchTransactions();
      }
    } catch (error) {
      alert('Gagal mengirim follow up.');
    }
  };



  const getStatusBadge = (status) => {
    const map = {
      pending:      { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-400', label: 'Pending Invoice' },
      sign:         { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-400', label: 'Tahap Sign' },
      '2nd_pending': { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-400', label: 'Followed Up' },
      expired:      { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-400', label: 'Expired' },
      paid_dp:      { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-400', label: 'Lunas DP' },
      paid_full:    { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-400', label: 'Lunas Full' },
      canceled:     { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-400', label: 'Dibatalkan' },
      cancelled:    { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', dot: 'bg-red-400', label: 'Dibatalkan' },
      completed:    { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200', dot: 'bg-slate-400', label: 'Selesai' },
    };
    const s = map[status] || { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200', dot: 'bg-slate-400', label: status };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${s.bg} ${s.text} ring-1 ${s.ring}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
        {s.label}
      </span>
    );
  };

  const filteredTransactions = transactions.filter(trx => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return ['pending', 'sign', '2nd_pending'].includes(trx.status);
    if (activeFilter === 'active') return ['paid_dp', 'paid_full'].includes(trx.status);
    if (activeFilter === 'history') return ['expired', 'completed', 'canceled', 'cancelled'].includes(trx.status);
    return true;
  });

  const currentFilterLabel = STATUS_OPTIONS.find(o => o.value === activeFilter)?.label || 'Semua';

  return (
    <div className="p-3 sm:p-6 max-w-[1440px] mx-auto w-full pb-24 sm:pb-32">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-3 animate-[fadeSlideDown_0.5s_ease-out]">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Icon name="ClipboardCheck" size={20} />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-text-heading tracking-tight">Transactions</h1>
            <p className="text-text-muted text-xs sm:text-sm mt-0.5 hidden sm:block">Kelola semua transaksi aktif, history, dan verifikasi pembayaran.</p>
          </div>
        </div>
        <button
          onClick={() => { fetchTransactions(); fetchPendingForms(); }}
          className="group flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-bg-surface border border-border-base rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-text-body hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 shrink-0"
        >
          <Icon name="RefreshCw" size={15} className="text-text-muted group-hover:text-indigo-500 transition-colors" />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── STATS SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-6 animate-[fadeSlideDown_0.6s_ease-out]">
        <div className="bg-bg-surface border border-border-base rounded-2xl p-4 hover:shadow-md hover:shadow-amber-500/5 hover:border-amber-200/50 transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-400/20 group-hover:scale-110 transition-transform duration-300">
              <Icon name="Clock" size={18} />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-text-heading">
                {transactions.filter(t => ['pending', 'sign', '2nd_pending'].includes(t.status)).length}
              </div>
              <div className="text-[11px] text-text-muted font-medium">Pending Approval</div>
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border-base rounded-2xl p-4 hover:shadow-md hover:shadow-emerald-500/5 hover:border-emerald-200/50 transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-400/20 group-hover:scale-110 transition-transform duration-300">
              <Icon name="CheckCircle" size={18} />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-text-heading">
                {transactions.filter(t => ['paid_dp', 'paid_full'].includes(t.status)).length}
              </div>
              <div className="text-[11px] text-text-muted font-medium">Transaksi Aktif (Lunas)</div>
            </div>
          </div>
        </div>
        <div className="bg-bg-surface border border-border-base rounded-2xl p-4 hover:shadow-md hover:shadow-slate-500/5 hover:border-slate-200/50 transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-gray-500 flex items-center justify-center text-white shadow-md shadow-slate-400/20 group-hover:scale-110 transition-transform duration-300">
              <Icon name="Archive" size={18} />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-text-heading">
                {transactions.filter(t => ['expired', 'completed', 'canceled', 'cancelled'].includes(t.status)).length}
              </div>
              <div className="text-[11px] text-text-muted font-medium">History (Selesai/Expired)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER DROPDOWN ── */}
      <div className="relative mb-3 sm:mb-6 animate-[fadeSlideDown_0.7s_ease-out] w-full">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 sm:gap-3 bg-bg-surface border border-border-base rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-text-heading hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 w-full sm:w-auto"
          >
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${STATUS_OPTIONS.find(o => o.value === activeFilter)?.gradient} flex items-center justify-center text-white shrink-0 transition-all duration-300`}>
              <Icon name={STATUS_OPTIONS.find(o => o.value === activeFilter)?.icon || 'Filter'} size={14} />
            </div>
            <span className="text-text-muted font-medium text-[10px] sm:text-xs">Filter:</span>
            <span className="text-text-heading">{STATUS_OPTIONS.find(o => o.value === activeFilter)?.label}</span>
            <Icon name="ChevronDown" size={14} className={`text-text-muted transition-transform duration-300 ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-xs text-text-muted bg-bg-subtle border border-border-base px-3 py-1.5 rounded-full font-bold">
            {filteredTransactions.length} transaksi
          </span>
        </div>

        {filterOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
            <div className="absolute top-full left-0 right-0 sm:right-auto mt-2 bg-bg-surface border border-border-base rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-20 w-full sm:w-80 animate-[fadeSlideUp_0.2s_ease-out]">
              {STATUS_OPTIONS.map(opt => {
                const count = opt.value === 'all' ? transactions.length :
                  opt.value === 'pending' ? transactions.filter(t => ['pending', 'sign', '2nd_pending'].includes(t.status)).length :
                  opt.value === 'active' ? transactions.filter(t => ['paid_dp', 'paid_full'].includes(t.status)).length :
                  transactions.filter(t => ['expired', 'completed', 'canceled', 'cancelled'].includes(t.status)).length;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setActiveFilter(opt.value); setFilterOpen(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
                      activeFilter === opt.value
                        ? `${opt.activeBg} ${opt.activeText}`
                        : 'text-text-body hover:bg-bg-subtle hover:text-text-heading'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      activeFilter === opt.value
                        ? `bg-gradient-to-br ${opt.gradient} text-white shadow-sm`
                        : 'bg-bg-subtle text-text-muted'
                    }`}>
                      <Icon name={opt.icon} size={15} />
                    </div>
                    <span className="flex-1 text-left">{opt.label}</span>
                    {count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[22px] text-center ${
                        activeFilter === opt.value ? opt.countColor : 'bg-bg-subtle text-text-muted'
                      }`}>
                        {count}
                      </span>
                    )}
                    {activeFilter === opt.value && (
                      <Icon name="Check" size={14} className={`${opt.activeText} shrink-0`} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── PENDING FORMS (MANUAL MODE) ── */}
      {pendingForms.length > 0 && (
        <div className="mb-6 animate-[fadeSlideUp_0.4s_ease-out]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <Icon name="Inbox" size={14} className="text-orange-500" />
            </div>
            <h3 className="font-bold text-text-heading text-sm">Pesanan Menunggu Konfirmasi (Mode Manual)</h3>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded-full">{pendingForms.length}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {pendingForms.map(form => {
              let parsedData = {};
              try {
                if (form.form_data) parsedData = typeof form.form_data === 'string' ? JSON.parse(form.form_data) : form.form_data;
              } catch (err) {}
              return (
                <div key={form.id} className="bg-bg-surface border border-orange-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-orange-300/60 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                        {(form.customer_name || parsedData.nama || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-text-heading text-[15px]">{form.customer_name || parsedData.nama || 'Tanpa Nama'}</h4>
                        <p className="text-xs text-text-muted font-mono">{form.phone}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      Awaiting Admin
                    </span>
                  </div>
                  
                  <div className="text-sm text-text-body mb-4 bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-100/80">
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-2">Data Pesanan</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(parsedData).map(([key, value]) => (
                        <div key={key} className="bg-white/60 rounded-lg px-3 py-2">
                          <span className="block text-[10px] text-orange-500 uppercase tracking-wider font-semibold">{key.replace(/_/g, ' ')}</span>
                          <span className="text-sm font-semibold text-text-heading">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleApproveForm(form.id)} disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0">
                      <Icon name="CheckCircle" size={14} /> Create Invoice
                    </button>
                    <button onClick={() => handleRejectForm(form.id)} disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-surface border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0">
                      <Icon name="XCircle" size={14} /> Tolak
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS LIST ── */}
      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden animate-[fadeSlideUp_0.4s_ease-out]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 sm:h-72 gap-3 sm:gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-[3px] border-indigo-100 border-t-indigo-500 animate-spin" />
            </div>
            <p className="text-sm text-text-muted font-medium">Memuat transaksi...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-xl animate-[float_3s_ease-in-out_infinite]">
                <Icon name="CheckCircle2" size={36} />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-2 bg-black/[0.04] rounded-full blur-sm" />
            </div>
            <h3 className="text-lg font-display font-bold text-text-heading mb-2">Semua Bersih!</h3>
            <p className="text-text-muted text-sm max-w-sm leading-relaxed">Tidak ada transaksi untuk filter ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-base/60">
            {filteredTransactions.map((trx, idx) => (
              <div
                key={trx.id}
                className="p-4 sm:p-6 hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-transparent transition-all duration-300 group/item"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
                  <div className="flex-1 min-w-0 w-full">
                    {/* Status + Meta */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {getStatusBadge(trx.status)}
                      <span className="text-xs text-text-muted font-mono font-medium bg-bg-subtle px-2.5 py-1 rounded-lg">{trx.order_id}</span>
                      <span className="text-xs text-text-muted flex items-center gap-1.5 bg-bg-subtle px-2.5 py-1 rounded-lg">
                        <Icon name="Clock" size={11} /> {trx.created_at ? new Date(trx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>

                    {/* Customer Card */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {(trx.customer_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-text-heading text-[15px]">{trx.customer_name}</h3>
                        <span className="text-text-muted text-xs font-medium">{trx.phone}</span>
                      </div>
                    </div>

                    {/* Items */}
                    {trx.items && trx.items.length > 0 && (
                      <div className="mb-4">
                        <span className="block text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Items</span>
                        <div className="bg-gradient-to-br from-bg-subtle to-bg-page border border-border-base/80 rounded-xl p-4 space-y-2">
                          {trx.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-text-body">{item.item_name} <span className="text-text-muted">(x{item.quantity})</span></span>
                              <span className="font-semibold text-text-heading">Rp {parseFloat(item.subtotal).toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Total + DP */}
                    <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/80 rounded-xl p-4 mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-text-muted">Total Transaksi</span>
                        <span className="font-bold text-text-heading text-base">Rp {parseFloat(trx.total_price).toLocaleString('id-ID')}</span>
                      </div>
                      {trx.dp_amount && parseFloat(trx.dp_amount) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-text-muted">Min. DP ({trx.dp_percentage}%)</span>
                          <span className="font-bold text-orange-600">Rp {parseFloat(trx.dp_amount).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    {/* Proof + Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {trx.proof_image && (
                        <button onClick={() => setSelectedApproval(trx)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-200 hover:bg-blue-100 hover:shadow-sm transition-all">
                          <Icon name="Image" size={13} /> Lihat Bukti Transfer
                        </button>
                      )}
                      {trx.status === 'sign' && configs.auto_follow_up === 'false' && (
                        <button onClick={() => handleManualFollowUp(trx.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold border border-orange-200 hover:bg-orange-100 hover:shadow-sm transition-all">
                          <Icon name="Send" size={13} /> Manual Follow Up
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL VERIFIKASI PEMBAYARAN ── */}
      {selectedApproval && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-surface rounded-t-3xl sm:rounded-3xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl ring-1 ring-white/20 animate-[modalCardIn_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <div className="flex-1 bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center p-6 relative min-h-[300px]">
              <img src={resolveProofUrl(selectedApproval.proof_image)} alt="Bukti Transfer"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg" />
            </div>
            <div className="w-full md:w-96 p-6 sm:p-8 flex flex-col border-l border-border-base bg-bg-surface overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
                    <Icon name="Shield" size={16} />
                  </div>
                  <h2 className="text-lg font-display font-bold text-text-heading">Verifikasi Pembayaran</h2>
                </div>
                <button onClick={() => setSelectedApproval(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                  <Icon name="X" size={18} />
                </button>
              </div>
              <div className="space-y-4 flex-1">
                <div className="p-4 bg-gradient-to-br from-bg-subtle to-bg-page rounded-xl border border-border-base">
                  <p className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">Total Transaksi</p>
                  <p className="font-display font-bold text-2xl text-text-heading">Rp {parseFloat(selectedApproval.total_price).toLocaleString('id-ID')}</p>
                </div>
                {selectedApproval.dp_amount && parseFloat(selectedApproval.dp_amount) > 0 && (
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200/80">
                    <p className="text-[10px] text-orange-700 mb-1 uppercase tracking-wider font-bold">Target DP ({selectedApproval.dp_percentage}%)</p>
                    <p className="font-display font-bold text-2xl text-orange-600">Rp {parseFloat(selectedApproval.dp_amount).toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
              <div className="mt-8 space-y-3">
                <button onClick={() => handleApprove(selectedApproval.id, 'dp')} disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:shadow-orange-500/25 hover:-translate-y-0.5 transition-all duration-300">
                  <Icon name="CheckCircle" size={16} /> Setujui sebagai DP
                </button>
                <button onClick={() => handleApprove(selectedApproval.id, 'full')} disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300">
                  <Icon name="Check" size={16} /> Setujui Lunas (Full)
                </button>
                <button onClick={() => setSelectedApproval(null)} disabled={isProcessing}
                  className="w-full py-3 bg-bg-surface border border-border-base hover:bg-red-50 hover:border-red-200 disabled:opacity-50 text-text-muted hover:text-red-600 font-bold rounded-xl transition-all duration-300">
                  Tolak Bukti (Tutup)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
