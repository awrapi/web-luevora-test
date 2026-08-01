import Icon from '@/components/shared/Icon';
import StatusBadge from './StatusBadge';

const getInitials = (name) => (name || 'P').slice(0, 1).toUpperCase();

const getAvatarGradient = (customer) => {
  if (customer.status === 'done') return 'from-emerald-400 to-teal-500';
  if (customer.status === 'canceled_customer') return 'from-rose-400 to-red-500';
  if (customer.status === 'waiting_payment') return 'from-violet-400 to-purple-500';
  if (customer.date_status === 'pending_approval') return 'from-amber-400 to-orange-500';
  if (customer.date_status === 'approved') return 'from-indigo-400 to-blue-500';
  return 'from-slate-400 to-slate-500';
};

export default function CustomerCard({ customer, pendingCounts, smartStatus, onClick, isOpen, index = 0 }) {
  const gradient = getAvatarGradient(customer);

  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
      className={`group relative flex items-center gap-4 px-5 py-4 cursor-pointer transition-all duration-300 border-b border-border-base/60 last:border-b-0 animate-content-reveal ${
        isOpen
          ? 'bg-gradient-to-r from-indigo-50/80 to-violet-50/60'
          : 'hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-50/50 hover:translate-x-1'
      }`}
    >
      {isOpen && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-r" />}

      <div className="relative shrink-0">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-base shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
          {getInitials(customer.customer_name)}
        </div>
        {pendingCounts.total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md shadow-red-500/30 animate-badge-pop">
            {pendingCounts.total}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-semibold text-text-heading text-sm truncate group-hover:text-indigo-base transition-colors">
            {customer.customer_name || 'Pelanggan'}
          </h3>
          <StatusBadge status={smartStatus.status} size="sm">{smartStatus.label}</StatusBadge>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Icon name="Phone" size={11} className="shrink-0" />
          <span className="truncate">{customer.phone}</span>
          {customer.package_name && (
            <>
              <span className="text-border-base">·</span>
              <span className="truncate">{customer.package_name}</span>
            </>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0">
        {pendingCounts.total > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 border border-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-600">{pendingCounts.total} pending</span>
          </div>
        )}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-indigo-500 text-white rotate-90' : 'text-text-muted group-hover:bg-indigo-500 group-hover:text-white group-hover:translate-x-1'
        }`}>
          <Icon name="ChevronRight" size={16} />
        </div>
      </div>
      <div className={`sm:hidden shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
        <Icon name="ChevronRight" size={18} className="text-text-muted" />
      </div>
    </div>
  );
}
