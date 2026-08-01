import Icon from '@/components/shared/Icon';

export default function StatsSummary({ stats }) {
  const items = [
    {
      key: 'customers',
      label: 'Pelanggan',
      value: stats.customers,
      gradient: 'from-indigo-500 to-violet-500',
      bgGradient: 'from-indigo-50 to-violet-50',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600',
    },
    {
      key: 'decisions',
      label: 'Butuh Keputusan',
      value: stats.decisions,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    },
    {
      key: 'infoRequests',
      label: 'Info Request',
      value: stats.infoRequests,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
      key: 'autoMods',
      label: 'Auto Mod',
      value: stats.autoMods,
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((item, idx) => (
        <div
          key={item.key}
          className={`relative overflow-hidden bg-gradient-to-br ${item.bgGradient} rounded-2xl border border-white p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default group animate-content-reveal animate-content-reveal-${idx + 1}`}
        >
          <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${item.gradient} opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500`} />
          <div className="relative">
            <div className={`w-11 h-11 rounded-xl ${item.iconBg} text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
              <Icon name={item.icon} size={20} />
            </div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">{item.label}</div>
            <div className={`text-3xl font-display font-bold bg-gradient-to-br ${item.gradient} bg-clip-text text-transparent mt-1`}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
