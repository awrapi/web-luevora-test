import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart
} from 'recharts';
import { ChevronDown, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

/* ─── Wave Decoration SVG ──────────────────────────────────────── */
const WaveDecoration = () => (
  <svg
    viewBox="0 0 340 260"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="absolute top-0 right-0 w-[280px] sm:w-[340px] h-auto pointer-events-none select-none opacity-60"
    aria-hidden="true"
  >
    {[0, 18, 36, 54, 72, 90, 108].map((offset, i) => (
      <ellipse
        key={i}
        cx="270"
        cy="20"
        rx={90 + i * 22}
        ry={80 + i * 20}
        stroke="#d1d5db"
        strokeWidth="1.2"
        fill="none"
        opacity={0.55 - i * 0.06}
      />
    ))}
  </svg>
);

/* ─── Stat Card ─────────────────────────────────────────────────── */
const StatCard = ({ label, value, isCurrency, isPercentage }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-5 px-4 shadow-sm hover:shadow-md transition-shadow duration-200 h-[110px]"
    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
  >
    <span className="text-[26px] sm:text-[30px] font-black text-gray-900 leading-none tracking-tight">
      {isCurrency
        ? `Rp ${Number(value).toLocaleString('id-ID')}`
        : isPercentage
          ? `${value}%`
          : value}
    </span>
    <span className="mt-2 text-[11px] sm:text-[13px] text-gray-500 font-semibold text-center leading-snug">
      {label}
    </span>
  </div>
);

/* ─── Custom Tooltips ────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-[11px] min-w-[120px]">
      <p className="text-gray-400 mb-1 font-semibold">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="font-bold text-[12px]" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString('id-ID')}
        </p>
      ))}
    </div>
  );
};

/* ─── Period Filter Dropdown ────────────────────────────────────── */
const PERIODS = ['Hari ini', 'Minggu ini', 'Bulan ini', 'Tahun ini', 'Semua waktu'];

const PeriodFilter = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block z-50">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all duration-150 select-none"
      >
        {value}
        <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden w-40 animate-[fadeSlideDown_0.18s_ease-out]">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-[12px] font-medium transition-colors hover:bg-indigo-50 hover:text-indigo-600 ${p === value ? 'text-indigo-600 bg-indigo-50/60' : 'text-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Dashboard Component (Replaced TravelDashboard)
════════════════════════════════════════════════════════════════ */
const TravelDashboard = () => {
  const [period, setPeriod] = useState('Hari ini');
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsGhosting: 0,
    pelangganSerius: 0,
    totalTransaksi: 0,
    menungguBayar: 0,
    totalRevenue: 0,
    aiClosingRate: 0,
    aiCostEfficiency: 0,
  });
  const [funnelData, setFunnelData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [leadsRepeatTrend, setLeadsRepeatTrend] = useState([]);
  const [actionCenter, setActionCenter] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await api.get('/dashboard/stats', { params: { period } });
        if (res.data?.status && res.data?.data) {
          const d = res.data.data;
          setStats(d.kpis);
          setFunnelData(d.funnelData);
          setTrendData(d.trendData);
          setLeadsRepeatTrend(d.leadsRepeatTrend);
          setActionCenter(d.actionCenter);
          setTopProducts(d.topProducts);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [period]);

  return (
    <div className="relative min-h-full overflow-x-hidden" style={{ background: '#f5f6fa' }}>
      <WaveDecoration />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">

        {/* ── Page Header ── */}
        <div className="mb-4 animate-[fadeSlideDown_0.35s_ease-out]">
          <h1
            className="text-[28px] sm:text-[32px] font-black leading-none"
            style={{ color: '#4f46e5', fontFamily: '"Satoshi", system-ui, sans-serif' }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-gray-400 font-medium">
            Ringkasan Penjualan & Performa AI Top Closer
          </p>
        </div>

        {/* ── Period Filter ── */}
        <div className="mb-6 animate-[fadeSlideDown_0.4s_ease-out]">
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        {/* ── Top Row: KPI Cards (8 Cards) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-[fadeSlideUp_0.4s_ease-out]">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Leads Ghosting" value={stats.leadsGhosting} />
          <StatCard label="Pelanggan Serius" value={stats.pelangganSerius} />
          <StatCard label="Total Transaksi" value={stats.totalTransaksi} />
          <StatCard label="Menunggu Bayar" value={stats.menungguBayar} />
          <StatCard label="Total Revenue (Omzet)" value={stats.totalRevenue} isCurrency />
          <StatCard label="AI Closing Rate" value={stats.aiClosingRate} isPercentage />
          <StatCard label="Biaya AI per Closing" value={stats.aiCostEfficiency} isCurrency />
        </div>

        {/* ── Middle Row: Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 animate-[fadeSlideUp_0.5s_ease-out]">
          
          {/* Sales Funnel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Sales Funnel (Corong Penjualan)</h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={100} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Jumlah" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue vs Interaction Trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Tren Pendapatan & Interaksi</h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  
                  {/* Left Y-Axis for Revenue */}
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => `Rp${(value/1000000).toFixed(1)}M`} />
                  
                  {/* Right Y-Axis for Messages */}
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  
                  <Bar yAxisId="right" dataKey="messages" name="Volume Pesan" fill="#e2e8f0" barSize={12} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Omzet Harian" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* ── Leads & Repeat Order Trend Row ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 animate-[fadeSlideUp_0.55s_ease-out]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Tren Leads Baru & Repeat Order</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={leadsRepeatTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="leads" name="Leads Baru" fill="#818cf8" barSize={14} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="repeatOrders" name="Repeat Order" stroke="#a78bfa" strokeWidth={3} dot={{ r: 4, fill: '#a78bfa' }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bottom Row: Leaderboard & Action Center ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10 animate-[fadeSlideUp_0.6s_ease-out]">
          
          {/* Leaderboard Top Products */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="bg-gray-50/50 px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-bold text-gray-800">Top 5 Produk/Layanan Terlaris</h2>
            </div>
            <div className="p-2">
              {!topProducts || topProducts.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Belum ada transaksi</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {topProducts.map((prod, idx) => (
                    <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="text-[13px] font-semibold text-gray-700">{prod.name}</span>
                      </div>
                      <span className="text-[13px] font-bold text-gray-900">
                        Rp {Number(prod.revenue).toLocaleString('id-ID')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Action Center (Alerts) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="bg-red-50/30 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                Action Center (Pusat Perhatian)
              </h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {!actionCenter || actionCenter.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Semua aman & terkendali</p>
              ) : (
                actionCenter.map((alert, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border ${alert.type === 'critical' ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${alert.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        {alert.type === 'critical' ? <AlertCircle size={18} /> : <AlertTriangle size={18} />}
                      </div>
                      <span className="text-[13px] font-bold text-gray-800">{alert.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[15px] font-black ${alert.type === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                        {alert.count}
                      </span>
                      <button className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${alert.type === 'critical' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                        Tinjau
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TravelDashboard;
