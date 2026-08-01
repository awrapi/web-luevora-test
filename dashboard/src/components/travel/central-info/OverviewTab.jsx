import Icon from '@/components/shared/Icon';
import StatusBadge from './StatusBadge';

const parseCollectedData = (raw) => {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
};

const parseSuggestedDates = (raw) => {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
};

const fmtDateOnly = (d) => d
  ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  : '-';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-';

export default function OverviewTab({ customer }) {
  const collectedData = parseCollectedData(customer.collected_data);
  const collectedEntries = Object.entries(collectedData);
  const suggestedDates = parseSuggestedDates(customer.date_suggested);
  const isApproved = customer.date_status === 'approved';
  const isRejected = customer.date_status === 'rejected';

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="flex flex-wrap gap-3">
        {customer.requested_date && (
          <div className="px-4 py-3 rounded-xl border border-border-base bg-bg-subtle/30">
            <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-1">
              {isApproved ? 'Tanggal Disetujui' : 'Tanggal Diminta'}
            </span>
            <span className={`text-sm font-bold ${
              isApproved ? 'text-emerald-600' : isRejected ? 'text-red-500' : 'text-text-heading'
            }`}>
              {fmtDateOnly(customer.requested_date)}
            </span>
          </div>
        )}
        {customer.departure_date && !isApproved && (
          <div className="px-4 py-3 rounded-xl border border-border-base bg-bg-subtle/30">
            <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-1">Keberangkatan</span>
            <span className="text-sm font-bold text-text-heading">{fmtDateOnly(customer.departure_date)}</span>
          </div>
        )}
        {customer.package_name && (
          <div className="px-4 py-3 rounded-xl border border-border-base bg-bg-subtle/30">
            <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-1">Paket</span>
            <span className="text-sm font-bold text-text-heading">{customer.package_name}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <span className="block text-[10px] text-text-muted uppercase tracking-wide font-semibold mb-2">Status</span>
        <StatusBadge status={customer.date_status || customer.status || 'pending'} />
      </div>

      {/* Collected Data */}
      {collectedEntries.length > 0 && (
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wide font-semibold mb-3">Data Terkumpul</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {collectedEntries.map(([key, val]) => (
              <div key={key} className="bg-bg-subtle rounded-lg px-3 py-2.5">
                <span className="block text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5">{key.replace(/_/g, ' ')}</span>
                <span className="text-xs font-semibold text-text-heading">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Summary */}
      {customer.lead_profile?.chat_summary && (
        <div className="bg-bg-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="FileText" size={14} className="text-text-muted" />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Ringkasan Chat</span>
          </div>
          <p className="text-sm text-text-body leading-relaxed">{customer.lead_profile.chat_summary}</p>
        </div>
      )}

      {/* Rejection Info */}
      {isRejected && customer.date_reject_reason && (
        <div className="border border-red-100 bg-red-50/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="XCircle" size={14} className="text-red-500" />
            <span className="text-[11px] text-red-600 uppercase tracking-wide font-semibold">Alasan Penolakan</span>
          </div>
          <p className="text-sm text-red-700 leading-relaxed mb-3">{customer.date_reject_reason}</p>
          {suggestedDates.length > 0 && (
            <div>
              <span className="block text-[10px] text-red-500 uppercase tracking-wide font-semibold mb-2">Tanggal Alternatif</span>
              <div className="flex gap-2 flex-wrap">
                {suggestedDates.map((d, i) => (
                  <span key={i} className="bg-white border border-red-100 text-red-600 text-xs font-medium px-3 py-1 rounded-lg">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Note */}
      {customer.admin_note && (
        <div className="bg-bg-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="FileText" size={14} className="text-text-muted" />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Catatan Admin</span>
          </div>
          <p className="text-sm text-text-body leading-relaxed whitespace-pre-wrap">{customer.admin_note}</p>
        </div>
      )}

      {/* Actioned by info */}
      {customer.date_actioned_by && (
        <div className="pt-4 border-t border-border-base/60">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">Diproses oleh</div>
          <div className="text-sm text-text-body font-semibold">{customer.date_actioned_by}</div>
          {customer.date_approved_at && (
            <div className="text-xs text-text-muted mt-1">{fmtDate(customer.date_approved_at)}</div>
          )}
        </div>
      )}
    </div>
  );
}
