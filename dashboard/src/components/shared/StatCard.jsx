import React from 'react';
import Icon from '@/components/shared/Icon';

/**
 * StatCard Component
 * Modernized using Tailwind CSS v4 and Lucide React.
 */
const StatCard = ({ label, value, icon, variant = 'blue', trend = null }) => {
  const variants = {
    blue: {
      bg: 'bg-indigo-soft',
      icon: 'text-indigo-base',
      border: 'border-indigo-border',
      value: 'text-indigo-base'
    },
    green: {
      bg: 'bg-green-soft',
      icon: 'text-green-600',
      border: 'border-green-border',
      value: 'text-green-600'
    },
    amber: {
      bg: 'bg-amber-soft',
      icon: 'text-amber-600',
      border: 'border-amber-border',
      value: 'text-amber-600'
    },
    purple: {
      bg: 'bg-purple-soft',
      icon: 'text-purple-600',
      border: 'border-purple-border',
      value: 'text-purple-600'
    }
  };

  const style = variants[variant] || variants.blue;

  return (
    <div className="bg-bg-surface border border-border-base rounded-lg p-4 shadow-xs transition-all hover:shadow-sm hover:-translate-y-0.5 hover:border-border-hover">
      <div className="flex justify-between items-start mb-3">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${style.bg} ${style.icon} ${style.border}`}>
          <Icon name={icon} size={20} strokeWidth={2.5} />
        </div>
        {trend && (
          <div className={`text-[10px] font-bold flex items-center gap-1 ${trend.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            <Icon name={trend.type === 'up' ? 'TrendingUp' : 'TrendingDown'} size={12} strokeWidth={3} />
            {trend.value}%
          </div>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">{label}</div>
      <div className={`text-2xl font-display font-extrabold tracking-tight ${style.value}`}>{value}</div>
    </div>
  );
};

export default StatCard;
