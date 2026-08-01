import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const PLAN_CREDIT_INFO = {
  free:    700,
  lite:    10000,
  starter: 50000,
  growth:  125000,
  scale:   200000,
};

/**
 * Billing Page — AI Credit Usage Monitoring
 * Displays credit balance, usage stats, recent logs, and admin actions.
 */
const Billing = () => {
  const [credit, setCredit] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [error, setError] = useState(null);

  const fetchCredit = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch credit status (critical — show error if this fails)
      const creditRes = await api.get('/ai-credits/status');
      if (creditRes.data.success) setCredit(creditRes.data.data);

      // Fetch subscription status (non-critical — fail silently)
      try {
        const subRes = await api.get('/subscription/status');
        if (subRes.data.status) setSubscription(subRes.data.data);
      } catch {
        // subscription endpoint failure doesn't block the billing page
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data kredit');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load credit data on mount (real-time tracking already updates per-call)
  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  const handleReset = async () => {
    if (!window.confirm('Yakin ingin reset kredit ke 0? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      setActionLoading(true);
      await api.post('/ai-credits/reset');
      await fetchCredit();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal reset kredit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLimit = async () => {
    const limit = parseInt(newLimit, 10);
    if (!limit || limit <= 0) return;
    try {
      setActionLoading(true);
      await api.put('/ai-credits/limit', { credit_limit: limit });
      setShowLimitModal(false);
      setNewLimit('');
      await fetchCredit();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah limit');
    } finally {
      setActionLoading(false);
    }
  };

  const formatNumber = (n) => {
    if (n === undefined || n === null) return '0';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="h-[calc(100vh-70px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-[13px] text-slate-500 font-medium">Memuat data kredit...</p>
        </div>
      </div>
    );
  }

  if (error && !credit) {
    return (
      <div className="h-[calc(100vh-70px)] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center max-w-md">
          <Icon name="AlertCircle" size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-800 mb-1">Gagal Memuat</p>
          <p className="text-[12px] text-slate-500 mb-4">{error}</p>
          <button onClick={fetchCredit} className="px-4 py-2 bg-indigo-500 text-white text-[12px] font-semibold rounded-lg hover:bg-indigo-600 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const used = credit?.credits_used || 0;
  const limit = credit?.credit_limit || 50000;
  const remaining = credit?.credits_remaining ?? (limit - used);
  const isOverdrawn = credit?.is_overdrawn || false;
  const overdraft = credit?.overdraft || 0;
  const usagePercent = Math.min((used / limit) * 100, 100);
  const today = credit?.today || {};


  // Progress bar color based on usage
  const barColor = isOverdrawn
    ? 'bg-red-500'
    : usagePercent >= 90
    ? 'bg-red-400'
    : usagePercent >= 70
    ? 'bg-amber-400'
    : 'bg-indigo-500';

  return (
    <div className="h-[calc(100vh-70px)] overflow-y-auto bg-slate-50/50 pb-10 font-sans antialiased">
      {/* ── Header ── */}
      <div className="relative z-10 px-4 sm:px-6 h-[64px] bg-white border-b border-slate-200 flex items-center justify-between shadow-sm sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500">
            <Icon name="Wallet" size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-snug">AI Billing</h1>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Monitoring Penggunaan Kredit AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Icon name="RefreshCw" size={12} className="animate-spin" />
              Sinkronisasi...
            </span>
          )}
          <button
            onClick={fetchCredit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <Icon name="RefreshCw" size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-[1100px] mx-auto space-y-5">
        {/* ── Subscription Plan Banner ── */}
        <div className={`flex items-center gap-4 rounded-2xl px-5 py-4 border ${
          subscription?.subscription_plan && subscription.subscription_plan !== 'free'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            subscription?.subscription_plan && subscription.subscription_plan !== 'free'
              ? 'bg-emerald-100'
              : 'bg-amber-100'
          }`}>
            <Icon
              name={subscription?.subscription_plan && subscription.subscription_plan !== 'free' ? 'Crown' : 'AlertTriangle'}
              size={18}
              className={subscription?.subscription_plan && subscription.subscription_plan !== 'free' ? 'text-emerald-600' : 'text-amber-600'}
            />
          </div>
          <div className="flex-1">
            <p className={`text-[13px] font-bold ${
              subscription?.subscription_plan && subscription.subscription_plan !== 'free' ? 'text-emerald-800' : 'text-amber-800'
            }`}>
              Paket: <span className="uppercase">{subscription?.subscription_plan || 'free'}</span>
              {subscription?.subscription_plan && subscription.subscription_plan !== 'free' && (
                <span className="ml-2 text-[10px] bg-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-bold">AKTIF</span>
              )}
            </p>
            <p className={`text-[11.5px] mt-0.5 ${
              subscription?.subscription_plan && subscription.subscription_plan !== 'free' ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              Limit kredit paket ini: <span className="font-bold">
                {new Intl.NumberFormat('id-ID').format(PLAN_CREDIT_INFO[subscription?.subscription_plan || 'free'] ?? 700)} kredit
              </span>
              {subscription?.subscription_expires_at && (
                <span className="ml-2 text-[11px] opacity-75">
                  — aktif hingga {new Date(subscription.subscription_expires_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </p>
          </div>
          <Link
            to="/subscription"
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
          >
            <Icon name="Crown" size={12} />
            {subscription?.subscription_plan && subscription.subscription_plan !== 'free' ? 'Ubah Paket' : 'Upgrade'}
          </Link>
        </div>
        {/* ── Error Toast ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Icon name="AlertTriangle" size={15} className="text-red-500 shrink-0" />
            <p className="text-[12px] text-red-700 font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* ── Sync Result Toast ── */}
        {syncResult && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <Icon name="CheckCircle2" size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[12px] text-emerald-800 font-semibold">Sinkronisasi Berhasil</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Berhasil menarik data EdenAI: {formatNumber(syncResult.edenai_credits_equivalent)} kredit dari {syncResult.edenai_total_calls} panggilan
              </p>
            </div>
            <button onClick={() => setSyncResult(null)} className="text-emerald-400 hover:text-emerald-600">
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* ── Overdraft Warning ── */}
        {isOverdrawn && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Icon name="AlertOctagon" size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-[13px] text-red-800 font-bold">Kredit Melebihi Batas!</p>
              <p className="text-[11px] text-red-600 mt-0.5">
                Saldo minus <span className="font-bold">{formatNumber(overdraft)} kredit</span>. Layanan AI telah diblokir hingga kredit direset oleh administrator.
              </p>
            </div>
          </div>
        )}

        {/* ══════════ CREDIT OVERVIEW CARDS ══════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card: Credits Remaining */}
          <div className={`bg-white rounded-2xl border p-5 ${isOverdrawn ? 'border-red-200' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sisa Kredit</p>
              <Icon name={isOverdrawn ? 'TrendingDown' : 'Coins'} size={16} className={isOverdrawn ? 'text-red-400' : 'text-indigo-400'} />
            </div>
            <p className={`text-[28px] font-extrabold leading-none ${isOverdrawn ? 'text-red-600' : 'text-slate-900'}`}>
              {isOverdrawn ? '-' : ''}{formatNumber(Math.abs(remaining))}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">dari {formatNumber(limit)} kredit</p>
          </div>

          {/* Card: Total Used */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Terpakai</p>
              <Icon name="Activity" size={16} className="text-amber-400" />
            </div>
            <p className="text-[28px] font-extrabold text-slate-900 leading-none">{formatNumber(used)}</p>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">dari {formatNumber(limit)} kredit</p>
          </div>

          {/* Card: Today */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hari Ini</p>
              <Icon name="Calendar" size={16} className="text-emerald-400" />
            </div>
            <p className="text-[28px] font-extrabold text-slate-900 leading-none">{formatNumber(today.credits_used || 0)}</p>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
              {today.calls || 0} panggilan hari ini
            </p>
          </div>
        </div>

        {/* ══════════ PROGRESS BAR ══════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-slate-800">Penggunaan Kredit</p>
              {isOverdrawn && (
                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase">Overdrawn</span>
              )}
              {!isOverdrawn && usagePercent >= 80 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[10px] font-bold rounded-full uppercase">Hampir Habis</span>
              )}
            </div>
            <p className="text-[13px] font-bold text-slate-600">{usagePercent.toFixed(1)}%</p>
          </div>

          {/* Bar */}
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>

          <div className="flex justify-between mt-2.5 text-[11px] text-slate-400 font-medium">
            <span>{formatNumber(used)} terpakai</span>
            <span>{formatNumber(limit)} kredit</span>
          </div>
        </div>

        {/* ══════════ ADMIN ACTIONS ══════════ */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setNewLimit(String(limit)); setShowLimitModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Icon name="Sliders" size={14} />
            Ubah Limit
          </button>
          <button
            onClick={handleReset}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Icon name="RotateCcw" size={14} />
            Reset Kredit
          </button>
        </div>



        {/* ══════════ LAST SYNCED ══════════ */}
        {credit?.last_synced_at && (
          <div className="text-center">
            <p className="text-[11px] text-slate-400">
              Terakhir sinkronisasi EdenAI: <span className="font-semibold">{formatDate(credit.last_synced_at)}</span>
            </p>
          </div>
        )}
      </div>

      {/* ══════════ LIMIT MODAL ══════════ */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowLimitModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-1">Ubah Limit Kredit</h3>
            <p className="text-[12px] text-slate-500 mb-4">Limit saat ini: {formatNumber(limit)} kredit</p>

            <div className="mb-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Limit Baru (kredit)</label>
              <input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                placeholder="50000"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowLimitModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateLimit}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
