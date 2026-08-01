import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/shared/Icon';

const todayStr = () => new Date().toISOString().slice(0, 10);
const formatDateShort = (d) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const getInitials = (name) => { if (!name) return '?'; const p = name.replace(/[+\d@.\-]/g, ' ').trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase(); };
const getSSStatus = (s) => {
  const now = new Date(), sTime = s.schedule_time || '00:00:00', dur = parseInt(s.duration_minutes) || 60;
  const start = new Date(s.schedule_date + 'T' + sTime), end = new Date(start.getTime() + dur * 60000);
  const autoComplete = new Date(end.getTime() + 12 * 3600000);
  if (s.status === 'completed') return 'completed'; if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'rescheduled') return 'rescheduled'; if (now >= start && now <= autoComplete) return 'running';
  if (now > autoComplete) return 'completed'; if (s.schedule_date === todayStr() && now < start) return 'today';
  return 'upcoming';
};

const STATUS_CONFIG = {
  running:   { label: 'Berlangsung', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', dot: true },
  today:     { label: 'Hari Ini', bg: 'bg-indigo-soft', text: 'text-indigo-base', border: 'border-indigo-border' },
  upcoming:  { label: 'Mendatang', bg: 'bg-indigo-soft', text: 'text-indigo-base', border: 'border-indigo-border' },
  completed: { label: 'Selesai', bg: 'bg-bg-subtle', text: 'text-text-muted', border: 'border-border-base' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200' },
  rescheduled: { label: 'Dijadwalkan Ulang', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
};

const FILTERS = [
  { key: 'all', label: 'Semua', icon: null },
  { key: 'running', label: 'Berlangsung', color: 'bg-green-500' },
  { key: 'upcoming', label: 'Mendatang', color: 'bg-indigo-base' },
  { key: 'completed', label: 'Selesai', color: 'bg-gray-400' },
];

const TabSiswa = ({ studentSchedules = [], loading = false, onEdit }) => {
  const [filter, setFilter] = useState('all');
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock([n.getHours(), n.getMinutes(), n.getSeconds()].map(v => String(v).padStart(2, '0')).join(':'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const enriched = useMemo(() =>
    studentSchedules.map(s => ({ ...s, _rt: getSSStatus(s) })),
    [studentSchedules]
  );

  const counts = useMemo(() => {
    const c = { all: 0, running: 0, upcoming: 0, completed: 0 };
    enriched.forEach(s => {
      c.all++;
      if (s._rt === 'running') c.running++;
      else if (s._rt === 'upcoming' || s._rt === 'today') c.upcoming++;
      else c.completed++;
    });
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    if (filter === 'all') return enriched;
    if (filter === 'running') return enriched.filter(s => s._rt === 'running');
    if (filter === 'upcoming') return enriched.filter(s => s._rt === 'upcoming' || s._rt === 'today');
    return enriched.filter(s => s._rt === 'completed' || s._rt === 'cancelled' || s._rt === 'rescheduled');
  }, [enriched, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-base" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-subtle border border-border-base text-xs font-semibold text-text-body mr-auto">
          <Icon name="Clock" size={12} />
          <span className="text-indigo-base font-bold tabular-nums">{clock}</span>
          <span className="text-text-muted">WIB</span>
        </div>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              filter === f.key
                ? 'bg-indigo-soft text-indigo-base border-indigo-border'
                : 'bg-bg-subtle text-text-muted border-border-base hover:border-border-hover'
            }`}
          >
            {f.color && <span className={`w-1.5 h-1.5 rounded-full ${f.color}`} />}
            {f.label}
            <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[9px] ${
              filter === f.key ? 'bg-indigo-base text-white' : 'bg-bg-surface text-text-muted'
            }`}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Schedule List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="CalendarOff" size={32} className="mx-auto text-text-muted opacity-40 mb-2" />
          <p className="text-sm text-text-muted">Tidak ada jadwal siswa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => {
            const cfg = STATUS_CONFIG[s._rt] || STATUS_CONFIG.upcoming;
            return (
              <div
                key={s.id || i}
                onClick={() => onEdit?.(s)}
                className="bg-bg-surface border border-border-base rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-border hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-soft border border-indigo-border flex items-center justify-center text-[11px] font-black text-indigo-base flex-shrink-0">
                      {getInitials(s.student_name || s.title)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-text-heading truncate">
                        {s.title || s.service_label || 'Jadwal Les'}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {s.student_name || s.phone || '—'}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                    {cfg.label}
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-soft text-indigo-base border border-indigo-border">
                    <Icon name="Calendar" size={10} /> {formatDateShort(s.schedule_date)}
                  </span>
                  {s.schedule_time && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-600 border border-cyan-200">
                      <Icon name="Clock" size={10} /> {s.schedule_time.slice(0, 5)} WIB
                    </span>
                  )}
                  {s.service_label && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-200">
                      <Icon name="Tag" size={10} /> {s.service_label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TabSiswa;
