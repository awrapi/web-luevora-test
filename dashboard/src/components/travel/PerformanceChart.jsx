import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

// Custom smooth tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="px-4 py-3 rounded-2xl text-[12px]"
        style={{
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 8px 32px rgba(123,97,255,0.15)',
          border: '1px solid rgba(123,97,255,0.1)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <p className="font-bold text-gray-800 mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-bold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PerformanceChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      let url = `/travel/bookings/performance?range=${timeRange}`;
      if (timeRange === 'custom') {
        if (!customStart || !customEnd) { setLoading(false); return; }
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      }
      const res = await api.get(url);
      if (res.data.status) setData(res.data.data);
    } catch (error) {
      console.error('Failed to fetch performance data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [timeRange, customStart, customEnd]);

  const ranges = [
    { value: 'today', label: 'Hari Ini' },
    { value: '7d', label: '1 Minggu' },
    { value: '1m', label: '1 Bulan' },
    { value: '3m', label: '3 Bulan' },
    { value: '6m', label: '6 Bulan' },
    { value: '1y', label: '1 Tahun' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: '#FFFFFF',
        boxShadow: '0 4px 30px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header */}
      <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">PERFORMA</p>
          <h3 className="text-[18px] font-extrabold text-gray-900 mt-0.5 tracking-tight">Leads & Closing</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Range selector */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {ranges.slice(0, 5).map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  timeRange === r.value
                    ? 'bg-white text-[#7B61FF] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchPerformance}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#7B61FF] hover:bg-[#7B61FF]/10 transition-all"
          >
            <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {timeRange === 'custom' && (
        <div className="px-6 pb-4 flex items-center gap-2">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7B61FF]/30" />
          <span className="text-gray-400 text-xs font-bold">–</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7B61FF]/30" />
        </div>
      )}

      {/* Chart */}
      <div className="px-2 pb-5 h-[220px] sm:h-[280px] w-full">
        {loading && data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#7B61FF]/20 border-t-[#7B61FF] animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <Icon name="BarChart2" size={40} className="mb-3 opacity-30" />
            <p className="text-[12px] font-medium">Belum ada data untuk rentang ini.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7B61FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorClosings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(123,97,255,0.15)', strokeWidth: 1 }} />
              <Area
                type="monotoneX"
                name="Leads Masuk"
                dataKey="leads"
                stroke="#7B61FF"
                strokeWidth={2.5}
                fill="url(#colorLeads)"
                dot={false}
                activeDot={{ r: 5, fill: '#7B61FF', strokeWidth: 0 }}
              />
              <Area
                type="monotoneX"
                name="Closing"
                dataKey="closings"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#colorClosings)"
                dot={false}
                activeDot={{ r: 5, fill: '#34d399', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 pb-5 flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#7B61FF' }} />
          <span className="text-[11px] font-semibold text-gray-500">Leads Masuk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#34d399' }} />
          <span className="text-[11px] font-semibold text-gray-500">Closing</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
