import React, { useState, useMemo } from 'react';
import Icon from '@/components/shared/Icon';

const todayStr = () => new Date().toISOString().slice(0, 10);
const getMonthName = (month, year) => new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month - 1, 1).getDay();
const formatDateShort = (d) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const CalendarPanel = ({ schedules = [], onDateSelect, onCreateClick }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);

  const scheduleDates = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      if (s.schedule_date) {
        if (!map[s.schedule_date]) map[s.schedule_date] = [];
        map[s.schedule_date].push(s);
      }
    });
    return map;
  }, [schedules]);

  const days = useMemo(() => {
    const total = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const changeMonth = (dir) => {
    let m = month + dir, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y); setSelectedDate(null);
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    onDateSelect?.(dateStr);
  };

  const today = todayStr();
  const stripSchedules = selectedDate ? (scheduleDates[selectedDate] || []) : [];

  return (
    <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs flex flex-col">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-base bg-bg-subtle/50">
        <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg border border-border-base hover:bg-bg-surface hover:border-border-hover transition-all">
          <Icon name="ChevronLeft" size={16} />
        </button>
        <span className="text-sm font-display font-bold text-text-heading tracking-tight">
          {getMonthName(month, year)}
        </span>
        <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg border border-border-base hover:bg-bg-surface hover:border-border-hover transition-all">
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 px-3 pt-2">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={`text-center text-[10px] font-black uppercase tracking-wider py-1 ${i === 0 || i === 6 ? 'text-red-400' : 'text-text-muted'}`}>
            {wd}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-[3px] px-3 pb-3 pt-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const hasSched = !!scheduleDates[dateStr];
          const isSunday = idx % 7 === 0;

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClick(day)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium relative border transition-all cursor-pointer
                ${isSelected ? 'bg-indigo-base border-indigo-base text-white font-bold shadow-md' :
                  isToday ? 'bg-indigo-soft border-indigo-border text-indigo-base font-bold' :
                  'border-transparent hover:bg-bg-subtle hover:border-border-base'}
                ${isSunday && !isSelected ? 'text-red-400 opacity-70' : ''}
                ${hasSched && !isSelected ? 'font-semibold text-text-heading' : ''}
              `}
            >
              {day}
              {hasSched && (
                <span className={`absolute bottom-[3px] w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Schedule Strip for Selected Date */}
      <div className="border-t border-border-base bg-bg-subtle/50 px-3 py-3 max-h-[200px] overflow-y-auto">
        {!selectedDate ? (
          <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted text-center py-2">
            Klik tanggal untuk melihat jadwal
          </p>
        ) : stripSchedules.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-text-muted mb-2">Tidak ada jadwal pada {formatDateShort(selectedDate)}</p>
            <button
              onClick={() => onCreateClick?.(selectedDate)}
              className="text-[11px] font-bold text-indigo-base hover:underline flex items-center gap-1 mx-auto"
            >
              <Icon name="Plus" size={12} /> Buat Jadwal
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">
              {formatDateShort(selectedDate)} — {stripSchedules.length} jadwal
            </p>
            {stripSchedules.map((s, i) => (
              <div key={s.id || i} className="bg-bg-surface rounded-lg px-3 py-2 mb-1.5 border border-border-base hover:border-indigo-border hover:bg-indigo-soft/30 transition-all cursor-pointer">
                <div className="text-[13px] font-bold text-text-heading">{s.title || 'Jadwal'}</div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {s.schedule_time ? s.schedule_time.slice(0, 5) + ' WIB' : ''} • {s.total_contacts || 0} kontak
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default CalendarPanel;
