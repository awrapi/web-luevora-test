import Icon from '@/components/shared/Icon';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-';

const fmtCurrency = (n) => typeof n === 'number' ? `Rp${n.toLocaleString('id-ID')}` : '-';

const Section = ({ title, count, icon, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <Icon name={icon} size={14} className="text-text-muted" />
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{title}</span>
      {count > 0 && (
        <span className="text-[10px] font-medium text-text-muted">({count})</span>
      )}
    </div>
    <div className="space-y-2">
      {children}
    </div>
  </div>
);

export default function HistoryTab({
  customer,
  cancellations,
  modifications,
  statusInfo,
  refunds,
}) {
  const custCancel = cancellations.filter(c => c.user_phone === customer.phone);
  const custMods = modifications.requests.filter(m => m.phone === customer.phone);
  const custAutoMods = modifications.auto_approved.filter(m => m.user_phone === customer.phone);
  const custStatus = statusInfo.filter(s => s.phone === customer.phone);
  const custRefunds = refunds.filter(r => r.phone === customer.phone);

  const hasAny = custCancel.length > 0 || custMods.length > 0 || custAutoMods.length > 0 || custStatus.length > 0 || custRefunds.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-text-muted">Belum ada riwayat untuk pelanggan ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {custCancel.length > 0 && (
        <Section title="Pembatalan" count={custCancel.length} icon="XCircle">
          {custCancel.map(cancel => (
            <div key={cancel.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <span className="text-sm font-semibold text-text-heading">Order #{cancel.order_id}</span>
                <span className="text-sm font-semibold text-text-body">{fmtCurrency(cancel.total_price)}</span>
              </div>
              <p className="text-xs text-text-muted mb-1">Paket: <span className="font-medium text-text-body">{cancel.destination}</span></p>
              {cancel.admin_note && (
                <div className="bg-bg-subtle rounded-lg px-3 py-2 mt-2">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide font-medium block mb-0.5">Catatan</span>
                  <p className="text-xs text-text-body">{cancel.admin_note}</p>
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {(custMods.length > 0 || custAutoMods.length > 0) && (
        <Section title="Modifikasi" count={custMods.length + custAutoMods.length} icon="Edit3">
          {custAutoMods.map(mod => (
            <div key={`auto_${mod.id}`} className="px-4 py-3 rounded-xl border border-border-base bg-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-semibold text-text-heading">Order #{mod.order_id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium text-indigo-600 bg-indigo-50">Auto-Approved</span>
              </div>
              <p className="text-xs text-text-muted">Tujuan: <span className="font-medium text-text-body">{mod.destination}</span></p>
            </div>
          ))}
          {custMods.map(req => (
            <div key={`req_${req.id}`} className="px-4 py-3 rounded-xl border border-border-base bg-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  req.status === 'approved' ? 'text-emerald-600 bg-emerald-50' :
                  req.status === 'rejected' ? 'text-red-600 bg-red-50' :
                  'text-amber-600 bg-amber-50'
                }`}>
                  {req.status === 'approved' ? 'Disetujui' : req.status === 'rejected' ? 'Ditolak' : 'Pending'}
                </span>
                {req.transaction && <span className="text-xs font-semibold text-text-heading">{req.transaction.order_id}</span>}
              </div>
              <p className="text-xs text-text-body leading-relaxed whitespace-pre-wrap">{req.request_text}</p>
            </div>
          ))}
        </Section>
      )}

      {custStatus.length > 0 && (
        <Section title="Status Info" count={custStatus.length} icon="Info">
          {custStatus.map(info => (
            <div key={info.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-semibold text-text-heading">
                  {info.info_type === 'canceled_request' ? 'Membatalkan Request' : info.info_type === 'canceled_offer' ? 'Membatalkan Penawaran' : info.info_type}
                </span>
                <span className="text-[10px] text-text-muted">{fmtDate(info.created_at)}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{info.detail}</p>
            </div>
          ))}
        </Section>
      )}

      {custRefunds.length > 0 && (
        <Section title="Refund" count={custRefunds.length} icon="RotateCcw">
          {custRefunds.map(ref => (
            <div key={ref.id} className="px-4 py-3 rounded-xl border border-border-base bg-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  ref.status === 'approved' ? 'text-emerald-600 bg-emerald-50' :
                  ref.status === 'rejected' ? 'text-red-600 bg-red-50' :
                  'text-amber-600 bg-amber-50'
                }`}>
                  {ref.status === 'approved' ? 'Disetujui' : ref.status === 'rejected' ? 'Ditolak' : 'Pending'}
                </span>
                {ref.transaction && <span className="text-sm font-semibold text-text-heading">{ref.transaction.order_id}</span>}
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{ref.reason}</p>
              {ref.admin_note && (
                <div className="mt-2 bg-bg-subtle rounded-lg px-3 py-2">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide font-medium block mb-0.5">Catatan Admin</span>
                  <p className="text-xs text-text-body">{ref.admin_note}</p>
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
