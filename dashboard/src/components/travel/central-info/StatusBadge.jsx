const STATUS_CONFIG = {
  pending_approval: { label: 'Menunggu Persetujuan', color: 'amber' },
  approved:         { label: 'Disetujui', color: 'emerald' },
  rejected:         { label: 'Ditolak', color: 'red' },
  pending:          { label: 'Pending', color: 'amber' },
  counter:          { label: 'Counter', color: 'blue' },
  done:             { label: 'Selesai', color: 'emerald' },
  canceled_customer:{ label: 'Batal', color: 'red' },
  waiting_payment:  { label: 'Menunggu Pembayaran', color: 'violet' },
  waiting_offer:    { label: 'Proses Order', color: 'indigo' },
  waiting_date:     { label: 'Konfirmasi Tanggal', color: 'amber' },
  instructed:       { label: 'Sudah Diinstruksi', color: 'blue' },
  taken_over:       { label: 'Diambil Alih', color: 'violet' },
  resolved:         { label: 'Selesai', color: 'emerald' },
  pending_customer: { label: 'Menunggu Customer', color: 'blue' },
  awaiting_customer:{ label: 'Menunggu Customer', color: 'sky' },
  info_received:    { label: 'Info Diterima', color: 'teal' },
};

const COLOR_MAP = {
  amber:   'bg-amber-50 text-amber-700 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red:     'bg-red-50 text-red-700 ring-red-200',
  blue:    'bg-blue-50 text-blue-700 ring-blue-200',
  violet:  'bg-violet-50 text-violet-700 ring-violet-200',
  indigo:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
  slate:   'bg-slate-100 text-slate-600 ring-slate-200',
  sky:     'bg-sky-50 text-sky-700 ring-sky-200',
  teal:    'bg-teal-50 text-teal-700 ring-teal-200',
};

export default function StatusBadge({ status, children, size = 'md' }) {
  const config = STATUS_CONFIG[status] || { label: status || 'Baru', color: 'slate' };
  const colorClasses = COLOR_MAP[config.color];
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children || config.label}
    </span>
  );
}
