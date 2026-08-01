import { useState } from 'react';
import Icon from '@/components/shared/Icon';
import OverviewTab from './OverviewTab';
import DecisionsTab from './DecisionsTab';
import HistoryTab from './HistoryTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'User' },
  { id: 'decisions', label: 'Keputusan', icon: 'CheckSquare' },
  { id: 'history', label: 'Riwayat', icon: 'Clock' },
];

const getAvatarGradient = (customer) => {
  if (customer.status === 'done') return 'from-emerald-400 to-teal-500';
  if (customer.status === 'canceled_customer') return 'from-rose-400 to-red-500';
  if (customer.status === 'waiting_payment') return 'from-violet-400 to-purple-500';
  if (customer.date_status === 'pending_approval') return 'from-amber-400 to-orange-500';
  if (customer.date_status === 'approved') return 'from-indigo-400 to-blue-500';
  return 'from-slate-400 to-slate-500';
};

export default function CustomerDetailDrawer(props) {
  const { customer, onClose } = props;
  const [activeTab, setActiveTab] = useState('overview');

  if (!customer) return null;

  const gradient = getAvatarGradient(customer);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-md animate-modal-backdrop"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[560px] lg:w-[640px] bg-slate-50 shadow-2xl flex flex-col animate-modal-card">
        {/* Gradient Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 px-6 py-5 shrink-0">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative flex items-center gap-4 mb-5">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-lg shadow-lg ring-2 ring-white/20`}>
              {(customer.customer_name || 'P').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-display font-bold text-white truncate">{customer.customer_name || 'Pelanggan'}</h2>
              <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
                <Icon name="Phone" size={12} />
                <span className="truncate">{customer.phone}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white/90 hover:text-white transition-all hover:rotate-90 duration-300 shrink-0"
            >
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="relative flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    isActive ? 'text-indigo-700' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-white rounded-lg shadow-sm animate-content-reveal" />
                  )}
                  <Icon name={tab.icon} size={14} className="relative" />
                  <span className="relative hidden sm:inline">{tab.label}</span>
                  <span className="relative sm:hidden">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div key={activeTab} className="animate-content-reveal">
            {activeTab === 'overview' && <OverviewTab customer={customer} />}
            {activeTab === 'decisions' && <DecisionsTab {...props} />}
            {activeTab === 'history' && <HistoryTab {...props} />}
          </div>
        </div>
      </div>
    </>
  );
}
