import SharedLayout from '@/layouts/SharedLayout';

/**
 * CourseLayout
 * Modernized using Tailwind CSS v4.
 */
const CourseLayout = () => {
  const courseWidgets = (
    <div className="space-y-4">
      {/* Upcoming schedule summary widget */}
      <div className="bg-bg-surface p-4 rounded-xl border border-border-base shadow-xs">
        <h4 className="text-[10px] uppercase tracking-widest font-black text-text-muted mb-2">Sesi Terdekat</h4>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-soft flex flex-col items-center justify-center border border-indigo-border">
            <span className="text-[10px] font-black text-indigo-base leading-none">24</span>
            <span className="text-[8px] font-bold text-indigo-base uppercase">Apr</span>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-heading">Matematika Dasar</div>
            <div className="text-[10px] text-text-muted">09:00 WIB • Budi S.</div>
          </div>
        </div>
      </div>

      {/* Pending reschedule badge */}
      <div className="bg-amber-soft p-4 rounded-xl border border-amber-border flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-amber-700 mb-1">Reschedule</h4>
          <p className="text-[11px] font-bold text-amber-900 leading-none">3 Permintaan Pending</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-black">
          3
        </div>
      </div>
    </div>
  );

  return <SharedLayout extraWidgets={courseWidgets} />;
};

export default CourseLayout;
