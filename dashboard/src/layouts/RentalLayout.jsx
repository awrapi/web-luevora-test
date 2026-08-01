import SharedLayout from '@/layouts/SharedLayout';

/**
 * RentalLayout
 * Modernized using Tailwind CSS v4.
 */
const RentalLayout = () => {
  const rentalWidgets = (
    <div className="space-y-4">
      {/* Asset availability summary */}
      <div className="bg-bg-surface p-4 rounded-xl border border-border-base shadow-xs">
        <h4 className="text-[10px] uppercase tracking-widest font-black text-text-muted mb-2">Aset Tersedia</h4>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-text-heading leading-none">85%</span>
          <span className="text-[10px] text-green-600 font-bold mb-0.5">High availability</span>
        </div>
        <div className="mt-2 w-full bg-bg-subtle h-1 rounded-full overflow-hidden">
          <div className="bg-indigo-base h-full w-[85%]"></div>
        </div>
      </div>

      {/* New rental alerts */}
      <div className="bg-indigo-soft p-4 rounded-xl border border-indigo-border flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[10px] uppercase tracking-widest font-black text-indigo-base mb-1">Alerts</h4>
          <p className="text-[11px] font-bold text-indigo-900 leading-none">5 Rental akan berakhir</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-indigo-base text-white flex items-center justify-center text-[10px] font-black">
          5
        </div>
      </div>
    </div>
  );

  return <SharedLayout extraWidgets={rentalWidgets} />;
};

export default RentalLayout;
