import Icon from '@/components/shared/Icon';

const TABS = [
  { id: 'customer_mgmt', label: 'Customer Management', icon: 'Users', countKey: 'customerMgmt' },
  { id: 'system_guider', label: 'System Guider', icon: 'MessageCircle', countKey: 'infoRequests' },
];

export default function TabSwitcher({ activeTab, onChange, counts }) {
  return (
    <div className="relative flex items-center gap-2 mb-6 bg-white rounded-2xl border border-border-base p-1.5 shadow-sm">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts[tab.countKey] || 0;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 overflow-hidden ${
              isActive
                ? 'text-white shadow-md'
                : 'text-text-muted hover:text-text-body'
            }`}
          >
            {isActive && (
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl animate-content-reveal" />
            )}
            <span className="relative flex items-center gap-2">
              <Icon name={tab.icon} size={16} className={isActive ? 'animate-content-reveal' : ''} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {count > 0 && (
                <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-white/25 text-white backdrop-blur-sm'
                    : 'bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-sm shadow-red-500/30'
                }`}>
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
