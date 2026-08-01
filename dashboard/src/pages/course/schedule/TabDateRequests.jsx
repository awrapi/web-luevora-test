import React, { useState } from 'react';
import Icon from '@/components/shared/Icon';

const formatDateShort = (d) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const getInitials = (name) => { if (!name) return '?'; const p = name.replace(/[+\d@.\-]/g, ' ').trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase(); };
const timeAgo = (ts) => { if (!ts) return ''; const d = Math.floor((Date.now() - new Date(ts)) / 1000); if (d < 60) return `${d}d lalu`; if (d < 3600) return `${Math.floor(d/60)}m lalu`; if (d < 86400) return `${Math.floor(d/3600)}j lalu`; return `${Math.floor(d/86400)}h lalu`; };

const STATUS_STYLES = {
  pending:  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', label: 'Pending' },
  approved: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', label: 'Approved' },
  rejected: { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200', label: 'Rejected' },
};

const TabDateRequests = ({ requests = [], loading = false, onApprove, onReject }) => {
  const [filter, setFilter] = useState('pending');

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-base" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              filter === f
                ? 'bg-indigo-soft text-indigo-base border-indigo-border'
                : 'bg-bg-subtle text-text-muted border-border-base hover:border-border-hover'
            }`}
          >
            {f === 'all' ? 'Semua' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="CalendarPlus" size={32} className="mx-auto text-text-muted opacity-40 mb-2" />
          <p className="text-sm text-text-muted">Tidak ada request tanggal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req, i) => {
            const st = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            return (
              <div key={req.id || i} className="bg-bg-surface border border-border-base rounded-xl px-4 py-3 hover:border-indigo-border hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-soft border border-indigo-border flex items-center justify-center text-[11px] font-black text-indigo-base flex-shrink-0">
                      {getInitials(req.customer_name || req.phone)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-text-heading truncate">
                        {req.customer_name || req.phone}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {req.service_label || req.phone || '—'}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border flex-shrink-0 ${st.bg} ${st.text} ${st.border}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex gap-1.5 flex-wrap mt-2">
                  {req.requested_date && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-soft text-indigo-base border border-indigo-border">
                      <Icon name="Calendar" size={10} /> {formatDateShort(req.requested_date)}
                    </span>
                  )}
                  {req.requested_time && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-600 border border-cyan-200">
                      <Icon name="Clock" size={10} /> {req.requested_time.slice(0, 5)}
                    </span>
                  )}
                  {req.created_at && (
                    <span className="text-[10px] text-text-muted">{timeAgo(req.created_at)}</span>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onApprove?.(req)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-green-500 text-white hover:bg-green-600 transition-all"
                    >
                      <Icon name="Check" size={12} /> Approve
                    </button>
                    <button
                      onClick={() => onReject?.(req)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Icon name="X" size={12} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TabDateRequests;
