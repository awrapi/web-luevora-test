import React, { useState, useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, format, isSameMonth, isSameDay, isToday,
  isBefore, startOfDay,
  differenceInDays, eachDayOfInterval, isWithinInterval, parseISO
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import Icon from '@/components/shared/Icon';

export const HOLIDAY_PRESETS = [
  { key: 'tahun_baru', label: 'Tahun Baru (1 Jan)' },
  { key: 'imlek', label: 'Tahun Baru Imlek' },
  { key: 'nyepi', label: 'Hari Raya Nyepi' },
  { key: 'wafat_isa', label: 'Wafat Isa Al-Masih' },
  { key: 'hari_buruh', label: 'Hari Buruh (1 Mei)' },
  { key: 'kenaikan_isa', label: 'Kenaikan Isa Al-Masih' },
  { key: 'waisak', label: 'Hari Raya Waisak' },
  { key: 'pancasila', label: 'Lahir Pancasila (1 Jun)' },
  { key: 'kemerdekaan', label: 'Kemerdekaan (17 Agt)' },
  { key: 'maulid_nabi', label: 'Maulid Nabi' },
  { key: 'isra_miraj', label: "Isra' Mi'raj" },
  { key: 'idul_fitri', label: 'Idul Fitri' },
  { key: 'idul_adha', label: 'Idul Adha' },
  { key: 'tahun_baru_hijriah', label: 'Tahun Baru Islam' },
  { key: 'natal', label: 'Natal (25 Des)' },
];

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * AvailabilityCalendar
 *
 * availabilityType: 'always' | 'configured'
 *
 * always     → all dates blue by default. Admin clicks a date to toggle it OFF (unavailable).
 * configured → no dates blue by default. Admin sets a range or clicks dates to turn them ON,
 *              then can click blue dates to turn them OFF again.
 *
 * Rules stored:
 *  - { rule_type: 'specific_date', rule_value: 'YYYY-MM-DD', is_unavailable: true }   → blocked in "always" mode
 *  - { rule_type: 'available_date', rule_value: 'YYYY-MM-DD', is_unavailable: false }  → available in "configured" mode
 *  - { rule_type: 'available_range', rule_value: 'YYYY-MM-DD|YYYY-MM-DD', is_unavailable: false }
 *  - { rule_type: 'every_day_of_week', ... }  (recurring — only when range > 1 month)
 *  - { rule_type: 'holiday_preset', ... }
 *  - etc.
 */
const AvailabilityCalendar = ({
  availabilityType = 'always',
  rules = [],
  onRulesChange,
  // Validity info (from parent form)
  validityType = 'always_on',
  expiryDate = '',
  // Slot & price modes (unchanged)
  mode = 'availability',
  slotOverrides = [],
  onSlotOverridesChange,
  priceOverrides = [],
  onPriceOverridesChange,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popover, setPopover] = useState(null);
  const [popoverInput, setPopoverInput] = useState('');
  const [popoverContext, setPopoverContext] = useState('');

  // Range selection mode: user clicks "Aktifkan Rentang" button, then picks 2 dates
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeSelectStart, setRangeSelectStart] = useState(null);
  const [rangeSelectEnd, setRangeSelectEnd] = useState(null);

  // Manual range input (for configured mode)
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = [];
    let day = calStart;
    while (day <= calEnd) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [currentMonth]);

  // Compute the total range span for "configured" mode
  const configuredRangeSpan = useMemo(() => {
    const ranges = rules.filter(r => r.rule_type === 'available_range' && !r.is_unavailable);
    const singles = rules.filter(r => r.rule_type === 'available_date' && !r.is_unavailable);
    let allDates = singles.map(r => r.rule_value);
    ranges.forEach(r => {
      const [s, e] = r.rule_value.split('|');
      if (s && e) {
        try { if (differenceInDays(parseISO(e), parseISO(s)) > 0) allDates.push(s, e); } catch {}
      }
    });
    if (allDates.length < 2) return 0;
    allDates.sort();
    try { return differenceInDays(parseISO(allDates[allDates.length - 1]), parseISO(allDates[0])); } catch { return 0; }
  }, [rules]);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Is a date available?
  const isDateAvailable = (date) => {
    if (isBefore(date, today)) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = DAY_KEYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
    const dayOfMonth = String(date.getDate());
    const monthDay = format(date, 'MM-dd');

    if (availabilityType === 'always') {
      const blocked = rules.some(rule => {
        if (!rule.is_unavailable) return false;
        if (rule.rule_type === 'specific_date' && rule.rule_value === dateStr) return true;
        if (rule.rule_type === 'every_day_of_week' && rule.rule_value === dayOfWeek) return true;
        if (rule.rule_type === 'every_day_of_month' && rule.rule_value === dayOfMonth) return true;
        if (rule.rule_type === 'every_date_yearly' && rule.rule_value === monthDay) return true;
        return false;
      });
      return !blocked;
    } else {
      const blocked = rules.some(r => r.is_unavailable && r.rule_type === 'specific_date' && r.rule_value === dateStr);
      if (blocked) return false;
      return rules.some(rule => {
        if (rule.is_unavailable) return false;
        if (rule.rule_type === 'available_date' && rule.rule_value === dateStr) return true;
        if (rule.rule_type === 'available_range') {
          const [s, e] = rule.rule_value.split('|');
          try { return isWithinInterval(date, { start: parseISO(s), end: parseISO(e) }); } catch { return false; }
        }
        return false;
      });
    }
  };

  // Should we show recurring options?
  const showMonthlyOption = useMemo(() => {
    if (validityType === 'always_on') return true;
    if (validityType === 'expiry_date' && expiryDate) {
      try { return differenceInDays(parseISO(expiryDate), today) >= 30; } catch { return false; }
    }
    return false;
  }, [validityType, expiryDate, today]);

  const showYearlyOption = useMemo(() => {
    if (validityType === 'always_on') return true;
    if (validityType === 'expiry_date' && expiryDate) {
      try { return differenceInDays(parseISO(expiryDate), today) >= 365; } catch { return false; }
    }
    return false;
  }, [validityType, expiryDate, today]);

  // Handle date click
  const handleDateClick = (date, e) => {
    if (!isSameMonth(date, currentMonth)) return;
    if (isBefore(date, today)) return;

    if (rangeMode) {
      // Range selection mode
      if (!rangeSelectStart) {
        // First click: set start
        setRangeSelectStart(date);
        setRangeSelectEnd(null);
        setPopover(null);
      } else if (!rangeSelectEnd) {
        // Second click: set end, show confirmation popover
        const s = isBefore(rangeSelectStart, date) ? rangeSelectStart : date;
        const eDate = isBefore(rangeSelectStart, date) ? date : rangeSelectStart;
        setRangeSelectStart(s);
        setRangeSelectEnd(eDate);
        setPopover({ clickedDate: date, isRangeConfirm: true });
      }
      return;
    }

    // Normal mode: open popover for this date
    setPopover({ clickedDate: date });
    setPopoverInput('');
  };

  // Toggle single date or range (called from popover)
  const toggleSingleDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const available = isDateAvailable(date);

    if (availabilityType === 'always') {
      if (available) {
        // Mark unavailable
        if (!rules.some(r => r.rule_type === 'specific_date' && r.rule_value === dateStr && r.is_unavailable)) {
          onRulesChange([...rules, { rule_type: 'specific_date', rule_value: dateStr, is_unavailable: true }]);
        }
      } else {
        // Remove block → make available again
        onRulesChange(rules.filter(r => !(r.rule_type === 'specific_date' && r.rule_value === dateStr && r.is_unavailable)));
      }
    } else {
      if (available) {
        // Remove availability
        const isFromSingle = rules.some(r => r.rule_type === 'available_date' && r.rule_value === dateStr);
        if (isFromSingle) {
          onRulesChange(rules.filter(r => !(r.rule_type === 'available_date' && r.rule_value === dateStr)));
        } else {
          // It's available via range, block it specifically
          onRulesChange([...rules, { rule_type: 'specific_date', rule_value: dateStr, is_unavailable: true }]);
        }
      } else {
        // Make available
        const cleaned = rules.filter(r => !(r.rule_type === 'specific_date' && r.rule_value === dateStr && r.is_unavailable));
        onRulesChange([...cleaned, { rule_type: 'available_date', rule_value: dateStr, is_unavailable: false }]);
      }
    }
    setPopover(null);
  };

  const toggleRange = (start, end, makeAvailable) => {
    const days = eachDayOfInterval({ start, end });
    const dateStrs = days.map(d => format(d, 'yyyy-MM-dd'));

    if (availabilityType === 'always') {
      if (makeAvailable) {
        // Remove blocks for these days
        onRulesChange(rules.filter(r => !(r.rule_type === 'specific_date' && dateStrs.includes(r.rule_value) && r.is_unavailable)));
      } else {
        // Block these days
        let newRules = [...rules];
        dateStrs.forEach(ds => {
          if (!newRules.some(r => r.rule_type === 'specific_date' && r.rule_value === ds && r.is_unavailable)) {
            newRules.push({ rule_type: 'specific_date', rule_value: ds, is_unavailable: true });
          }
        });
        onRulesChange(newRules);
      }
    } else {
      // Configured mode
      if (makeAvailable) {
        // Remove any blocks in this range, then add available_range
        let newRules = rules.filter(r => !(r.rule_type === 'specific_date' && dateStrs.includes(r.rule_value) && r.is_unavailable));
        // Also remove individual available_dates that are now covered by the range
        newRules = newRules.filter(r => !(r.rule_type === 'available_date' && dateStrs.includes(r.rule_value)));
        newRules.push({ rule_type: 'available_range', rule_value: `${format(start, 'yyyy-MM-dd')}|${format(end, 'yyyy-MM-dd')}`, is_unavailable: false });
        onRulesChange(newRules);
      } else {
        // Remove available_dates and available_ranges that overlap, then add blocks
        let newRules = [...rules];
        // Remove single available_dates in range
        newRules = newRules.filter(r => !(r.rule_type === 'available_date' && dateStrs.includes(r.rule_value)));
        // Remove available_ranges that overlap with our range
        newRules = newRules.filter(r => {
          if (r.rule_type !== 'available_range' || r.is_unavailable) return true;
          const [rs, re] = r.rule_value.split('|');
          try {
            const rStart = parseISO(rs), rEnd = parseISO(re);
            // If range overlaps, remove it
            return isBefore(rEnd, start) || isBefore(end, rStart);
          } catch { return true; }
        });
        // Add specific blocks
        dateStrs.forEach(ds => {
          if (!newRules.some(r => r.rule_type === 'specific_date' && r.rule_value === ds && r.is_unavailable)) {
            newRules.push({ rule_type: 'specific_date', rule_value: ds, is_unavailable: true });
          }
        });
        onRulesChange(newRules);
      }
    }
    setRangeMode(false);
    setRangeSelectStart(null);
    setRangeSelectEnd(null);
    setPopover(null);
  };

  // Apply range (from manual input)
  const applyRange = () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return;
    onRulesChange([...rules, { rule_type: 'available_range', rule_value: `${rangeStart}|${rangeEnd}`, is_unavailable: false }]);
    setRangeStart(''); setRangeEnd('');
  };

  // Remove rule
  const removeRule = (index) => { const n = [...rules]; n.splice(index, 1); onRulesChange(n); };

  // Add recurring rule
  const addRecurringRule = (ruleType, ruleValue) => {
    const exists = rules.some(r => r.rule_type === ruleType && r.rule_value === ruleValue);
    if (!exists) onRulesChange([...rules, { rule_type: ruleType, rule_value: ruleValue, is_unavailable: true }]);
  };

  // Slot / Price override helpers
  const addSlotOverride = (dateStr, limit) => {
    const existing = slotOverrides.filter(so => so.override_date !== dateStr);
    onSlotOverridesChange([...existing, { override_date: dateStr, slot_limit: parseInt(limit) }]);
    setPopover(null);
  };
  const addPriceOverride = (dateStr, price, context) => {
    const existing = priceOverrides.filter(po => po.override_date !== dateStr);
    onPriceOverridesChange([...existing, { override_date: dateStr, override_price: parseFloat(price), context: context || '' }]);
    setPopover(null);
    setPopoverContext('');
  };

  // Get slot/price override for a date
  const getSlotOverride = (date) => slotOverrides.find(so => so.override_date === format(date, 'yyyy-MM-dd'));
  const getPriceOverride = (date) => priceOverrides.find(po => po.override_date === format(date, 'yyyy-MM-dd'));

  // Rule label
  const getRuleLabel = (rule) => {
    const isBlock = rule.is_unavailable;
    switch (rule.rule_type) {
      case 'specific_date': return `${isBlock ? '❌ Libur:' : '✅ Buka:'} ${rule.rule_value}`;
      case 'available_date': return `✅ Buka: ${rule.rule_value}`;
      case 'available_range': { const [s, e] = rule.rule_value.split('|'); return `✅ Rentang: ${s} s/d ${e}`; }
      case 'every_day_of_week': { const i = DAY_KEYS.indexOf(rule.rule_value); return `🔁 ${isBlock ? 'Libur Tiap' : 'Buka Tiap'} ${i >= 0 ? DAY_NAMES[i] : rule.rule_value}`; }
      case 'every_day_of_month': return `🔁 ${isBlock ? 'Libur' : 'Buka'} Tiap tgl ${rule.rule_value}`;
      case 'every_date_yearly': return `📅 ${isBlock ? 'Libur' : 'Buka'} Tiap ${rule.rule_value} /tahun`;
      case 'holiday_preset': { const h = HOLIDAY_PRESETS.find(p => p.key === rule.rule_value); return `🏖️ Libur: ${h ? h.label : rule.rule_value}`; }
      default: return rule.rule_value;
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setRangeMode(false); setRangeSelectStart(null); setRangeSelectEnd(null); setPopover(null); }} className="p-1.5 rounded-lg hover:bg-bg-page text-text-muted hover:text-text-heading transition-colors">
          <Icon name="ChevronLeft" size={18} />
        </button>
        <h4 className="text-sm font-bold text-text-heading">{format(currentMonth, 'MMMM yyyy', { locale: localeId })}</h4>
        <button type="button" onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setRangeMode(false); setRangeSelectStart(null); setRangeSelectEnd(null); setPopover(null); }} className="p-1.5 rounded-lg hover:bg-bg-page text-text-muted hover:text-text-heading transition-colors">
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map(d => (<div key={d} className="text-center text-[10px] font-bold text-text-muted uppercase py-1">{d}</div>))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const available = isDateAvailable(day);
          const todayMark = isToday(day);
          const isDisabled = !inMonth || isPast;
          const slotOv = mode === 'slot' ? getSlotOverride(day) : null;
          const priceOv = mode === 'price' ? getPriceOverride(day) : null;
          const hasOverride = slotOv || priceOv;

          // Range selection highlight
          const isRangeStart = rangeMode && rangeSelectStart && isSameDay(day, rangeSelectStart);
          const isRangeEnd = rangeMode && rangeSelectEnd && isSameDay(day, rangeSelectEnd);
          const inRange = rangeMode && rangeSelectStart && rangeSelectEnd &&
            isWithinInterval(day, { start: rangeSelectStart, end: rangeSelectEnd });

          return (
            <button key={idx} type="button"
              onClick={(e) => { e.stopPropagation(); !isDisabled && handleDateClick(day, e); }}
              disabled={isDisabled}
              className={`relative h-10 rounded-lg text-xs font-medium transition-all ${
                !inMonth ? 'text-gray-300 cursor-default'
                : isPast ? 'text-gray-300 bg-gray-50 cursor-default'
                : (isRangeStart || isRangeEnd) ? 'bg-indigo-500 text-white ring-2 ring-indigo-600 font-bold'
                : inRange ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                : rangeMode ? (available
                    ? 'bg-blue-50 text-blue-600 hover:bg-indigo-100 ring-1 ring-blue-200 cursor-crosshair'
                    : 'bg-white text-text-muted hover:bg-indigo-100 cursor-crosshair')
                : hasOverride ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-1 ring-amber-300'
                : available ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 ring-1 ring-blue-200'
                  + (todayMark ? ' ring-2 ring-blue-500 font-bold' : '')
                : todayMark ? 'bg-gray-100 text-text-heading font-bold ring-1 ring-gray-300 hover:bg-red-50'
                : 'bg-white text-text-muted hover:bg-red-50 hover:text-red-500'
              }`}>
              {format(day, 'd')}
              {slotOv && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px] font-bold text-amber-600">{slotOv.slot_limit}s</span>}
              {priceOv && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px]">💰</span>}
            </button>
          );
        })}
      </div>

      {/* Legend + Range Mode Button */}
      {mode === 'availability' && (
        <div className="flex items-center gap-3 text-[10px] text-text-muted pt-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white ring-1 ring-gray-200" /> Tidak Available</span>
          <button type="button" onClick={() => {
            if (rangeMode) {
              setRangeMode(false); setRangeSelectStart(null); setRangeSelectEnd(null); setPopover(null);
            } else {
              setRangeMode(true); setRangeSelectStart(null); setRangeSelectEnd(null); setPopover(null);
            }
          }} className={`ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
            rangeMode ? 'bg-indigo-500 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
          }`}>
            {rangeMode ? '✕ Batal Rentang' : '📅 Pilih Rentang'}
          </button>
        </div>
      )}

      {/* Range mode status bar */}
      {rangeMode && (
        <div className="text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200">
          {!rangeSelectStart && '👆 Klik tanggal awal rentang'}
          {rangeSelectStart && !rangeSelectEnd && `✅ Awal: ${format(rangeSelectStart, 'd MMM yyyy')} — Sekarang klik tanggal akhir`}
          {rangeSelectStart && rangeSelectEnd && `📌 ${format(rangeSelectStart, 'd MMM')} s/d ${format(rangeSelectEnd, 'd MMM yyyy')} — Pilih aksi di bawah`}
        </div>
      )}

      {/* Popover — normal mode: single date options */}
      {popover && !popover.isRangeConfirm && !rangeMode && (() => {
        const d = popover.clickedDate;
        const available = isDateAvailable(d);
        const dayNum = d.getDate();
        const monthName = format(d, 'MMMM', { locale: localeId });
        const monthDay = format(d, 'MM-dd');
        const dayStr = String(dayNum);
        const hasMonthly = rules.some(r => r.rule_type === 'every_day_of_month' && r.rule_value === dayStr && r.is_unavailable);
        const hasYearly = rules.some(r => r.rule_type === 'every_date_yearly' && r.rule_value === monthDay && r.is_unavailable);

        return (
          <div className="relative z-30">
            <div className="absolute bg-white border border-border-base rounded-xl shadow-lg p-3 w-72 -mt-1" style={{ left: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="Calendar" size={14} className="text-indigo-base" />
                  {format(d, 'd MMMM yyyy', { locale: localeId })}
                </div>
                <button type="button" onClick={() => setPopover(null)} className="text-gray-400 hover:text-gray-600 p-0.5"><Icon name="X" size={14} /></button>
              </div>

              {mode === 'availability' && (
                <div className="space-y-1">
                  <button type="button" onClick={() => toggleSingleDate(d)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2 ${available ? 'hover:bg-red-50 text-text-body hover:text-red-700' : 'hover:bg-blue-50 text-text-body hover:text-blue-700'}`}>
                    <span className="text-sm">{available ? '❌' : '✅'}</span>
                    {available ? 'Tandai tidak available (hanya tgl ini)' : 'Tandai available (hanya tgl ini)'}
                  </button>

                  <div className="border-t border-border-base my-1" />

                  {showMonthlyOption && (
                    <button type="button" onClick={() => {
                      if (hasMonthly) { onRulesChange(rules.filter(r => !(r.rule_type === 'every_day_of_month' && r.rule_value === dayStr))); }
                      else { onRulesChange([...rules, { rule_type: 'every_day_of_month', rule_value: dayStr, is_unavailable: true }]); }
                      setPopover(null);
                    }} className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2 ${hasMonthly ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'hover:bg-red-50 text-text-body hover:text-red-700'}`}>
                      <span className="text-sm">🔁</span>
                      {hasMonthly ? `✓ Setiap tanggal ${dayNum} tiap bulan (aktif)` : `Setiap tanggal ${dayNum} tiap bulan`}
                    </button>
                  )}

                  {showYearlyOption && (
                    <button type="button" onClick={() => {
                      if (hasYearly) { onRulesChange(rules.filter(r => !(r.rule_type === 'every_date_yearly' && r.rule_value === monthDay))); }
                      else { onRulesChange([...rules, { rule_type: 'every_date_yearly', rule_value: monthDay, is_unavailable: true }]); }
                      setPopover(null);
                    }} className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2 ${hasYearly ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'hover:bg-red-50 text-text-body hover:text-red-700'}`}>
                      <span className="text-sm">📅</span>
                      {hasYearly ? `✓ Setiap ${dayNum} ${monthName} tiap tahun (aktif)` : `Setiap ${dayNum} ${monthName} tiap tahun`}
                    </button>
                  )}
                </div>
              )}

              {mode === 'slot' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Limit Slot tanggal ini</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" value={popoverInput} onChange={e => setPopoverInput(e.target.value)} placeholder="Jumlah slot" className="flex-1 px-2.5 py-1.5 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-1 focus:ring-indigo-base/30" autoFocus />
                    <button type="button" onClick={() => popoverInput && addSlotOverride(format(d, 'yyyy-MM-dd'), popoverInput)} className="px-3 py-1.5 bg-indigo-base text-white text-xs font-bold rounded-lg hover:bg-indigo-mid transition-colors">Set</button>
                  </div>
                </div>
              )}
              {mode === 'price' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Harga Khusus tanggal ini</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" value={popoverInput} onChange={e => setPopoverInput(e.target.value)} placeholder="Rp ..." className="flex-1 px-2.5 py-1.5 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-1 focus:ring-indigo-base/30" autoFocus />
                  </div>
                  <label className="text-[10px] text-text-muted uppercase font-bold">Konteks untuk AI <span className="text-text-muted/50 normal-case">(opsional)</span></label>
                  <input type="text" value={popoverContext} onChange={e => setPopoverContext(e.target.value)} placeholder="Contoh: Peak season, harga naik karena libur Natal" className="w-full px-2.5 py-1.5 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-1 focus:ring-indigo-base/30" />
                  <button type="button" onClick={() => popoverInput && addPriceOverride(format(d, 'yyyy-MM-dd'), popoverInput, popoverContext)} className="w-full px-3 py-1.5 bg-indigo-base text-white text-xs font-bold rounded-lg hover:bg-indigo-mid transition-colors">Set Harga</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Range confirmation popover */}
      {popover && popover.isRangeConfirm && rangeSelectStart && rangeSelectEnd && (
        <div className="relative z-30">
          <div className="absolute bg-white border border-indigo-200 rounded-xl shadow-lg p-3 w-72 -mt-1" style={{ left: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                <Icon name="Calendar" size={14} className="text-indigo-base" />
                {format(rangeSelectStart, 'd MMM')} — {format(rangeSelectEnd, 'd MMM yyyy')}
              </div>
              <button type="button" onClick={() => { setPopover(null); setRangeSelectEnd(null); }} className="text-gray-400 hover:text-gray-600 p-0.5"><Icon name="X" size={14} /></button>
            </div>
            <div className="space-y-1">
              <button type="button" onClick={() => toggleRange(rangeSelectStart, rangeSelectEnd, true)}
                className="w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2 hover:bg-blue-50 text-text-body hover:text-blue-700">
                <span className="text-sm">✅</span> Aktifkan semua tanggal di rentang ini
              </button>
              <button type="button" onClick={() => toggleRange(rangeSelectStart, rangeSelectEnd, false)}
                className="w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-2 hover:bg-red-50 text-text-body hover:text-red-700">
                <span className="text-sm">❌</span> Nonaktifkan semua tanggal di rentang ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configured Mode: Range Input */}
      {mode === 'availability' && availabilityType === 'configured' && (
        <div className="pt-3 border-t border-border-base space-y-3">
          <label className="text-[10px] text-text-muted uppercase font-bold block">Set Range Tanggal Available</label>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">Dari</label>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-1 focus:ring-indigo-base/30" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted mb-1 block">Sampai</label>
              <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-1 focus:ring-indigo-base/30" />
            </div>
            <button type="button" onClick={applyRange} disabled={!rangeStart || !rangeEnd} className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40 shrink-0">
              Terapkan
            </button>
          </div>
          <p className="text-[10px] text-text-muted">Atau klik langsung tanggal di kalender untuk menandai available satu per satu.</p>
        </div>
      )}

      {/* Recurring Rules (show when always mode OR configured with range > 30 days) */}
      {mode === 'availability' && (availabilityType === 'always' || configuredRangeSpan > 30) && (
        <div className="space-y-3 pt-3 border-t border-border-base">
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold mb-2 block">Tidak Available Setiap Hari</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((d, i) => {
                const active = rules.some(r => r.rule_type === 'every_day_of_week' && r.rule_value === DAY_KEYS[i]);
                return (
                  <button key={d} type="button" onClick={() => {
                    if (active) onRulesChange(rules.filter(r => !(r.rule_type === 'every_day_of_week' && r.rule_value === DAY_KEYS[i])));
                    else addRecurringRule('every_day_of_week', DAY_KEYS[i]);
                  }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-red-500 text-white shadow-sm' : 'bg-bg-page text-text-muted hover:bg-red-50 hover:text-red-600 border border-border-base'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-text-muted uppercase font-bold mb-2 block">Tidak Available di Hari Libur</label>
            <div className="flex flex-wrap gap-1.5">
              {HOLIDAY_PRESETS.map(h => {
                const active = rules.some(r => r.rule_type === 'holiday_preset' && r.rule_value === h.key);
                return (
                  <button key={h.key} type="button" onClick={() => {
                    if (active) onRulesChange(rules.filter(r => !(r.rule_type === 'holiday_preset' && r.rule_value === h.key)));
                    else addRecurringRule('holiday_preset', h.key);
                  }} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${active ? 'bg-red-500 text-white shadow-sm' : 'bg-bg-page text-text-muted hover:bg-red-50 hover:text-red-600 border border-border-base'}`}>
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* All Rules List */}
      {(() => {
        const allRules = rules.map((r, i) => ({ ...r, _idx: i }));
        return allRules.length > 0 && mode === 'availability' && (
          <div className="pt-3 border-t border-border-base">
            <label className="text-[10px] text-text-muted uppercase font-bold mb-2 block">Daftar Aturan Konfigurasi ({allRules.length})</label>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {allRules.map((rule) => {
                const isBlock = rule.is_unavailable;
                return (
                  <div key={rule._idx} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${isBlock ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                    <span className={`text-xs font-medium ${isBlock ? 'text-red-700' : 'text-blue-700'}`}>{getRuleLabel(rule)}</span>
                    <button type="button" onClick={() => removeRule(rule._idx)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5"><Icon name="X" size={12} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Slot overrides list */}
      {slotOverrides && slotOverrides.length > 0 && mode === 'slot' && (
        <div className="pt-3 border-t border-border-base">
          <label className="text-[10px] text-text-muted uppercase font-bold mb-2 block">Limit Slot Khusus ({slotOverrides.length})</label>
          <div className="space-y-1">
            {slotOverrides.map((so, idx) => (
              <div key={idx} className="flex items-center justify-between bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-amber-700 font-medium">{so.override_date} — {so.slot_limit} slot</span>
                <button type="button" onClick={() => onSlotOverridesChange(slotOverrides.filter((_, i) => i !== idx))} className="text-amber-400 hover:text-amber-600 transition-colors p-0.5"><Icon name="X" size={12} strokeWidth={3} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price overrides list */}
      {priceOverrides && priceOverrides.length > 0 && mode === 'price' && (
        <div className="pt-3 border-t border-border-base">
          <label className="text-[10px] text-text-muted uppercase font-bold mb-2 block">Harga Khusus ({priceOverrides.length})</label>
          <div className="space-y-1.5">
            {priceOverrides.map((po, idx) => (
              <div key={idx} className="bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-700 font-bold">{po.override_date} — Rp {parseFloat(po.override_price).toLocaleString('id-ID')}</span>
                  <button type="button" onClick={() => onPriceOverridesChange(priceOverrides.filter((_, i) => i !== idx))} className="text-amber-400 hover:text-amber-600 transition-colors p-0.5"><Icon name="X" size={12} strokeWidth={3} /></button>
                </div>
                {po.context && <p className="text-[10px] text-amber-600/80 mt-0.5">💬 {po.context}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
