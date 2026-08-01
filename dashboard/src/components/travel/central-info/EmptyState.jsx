import Icon from '@/components/shared/Icon';

export default function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-bg-subtle flex items-center justify-center text-text-muted mb-5">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="text-base font-bold text-text-heading mb-1">{title}</h3>
      <p className="text-text-muted text-sm max-w-sm">{subtitle}</p>
    </div>
  );
}
