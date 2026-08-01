import React from 'react';
import Icon from '@/components/shared/Icon';

/**
 * RentalRequestWidget Component
 * Modernized using Tailwind CSS v4 and Lucide React.
 */
const RentalRequestWidget = ({ requests = [] }) => {
  return (
    <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs transition-all hover:shadow-sm hover:border-border-hover">
      <div className="px-5 py-4 border-b border-bg-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="ClipboardList" size={18} className="text-indigo-base" />
          <h6 className="font-display font-bold text-sm text-text-heading">Rental Requests Terbaru</h6>
        </div>
        <button className="px-3 py-1.5 rounded-md border border-border-base text-[11px] font-bold text-text-body hover:bg-bg-subtle transition-all">
          Lihat Semua
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg-subtle border-y border-border-base">
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Aset</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Penyewa</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Durasi</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-subtle/50">
            {requests.map((item, index) => (
              <tr key={index} className="hover:bg-indigo-soft/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-bg-subtle flex items-center justify-center border border-border-base overflow-hidden">
                      {item.assetImage ? (
                        <img src={item.assetImage} alt={item.assetName} className="w-full h-full object-cover" />
                      ) : (
                        <Icon name="Box" size={16} className="text-text-muted" />
                      )}
                    </div>
                    <div className="text-[12px] font-bold text-text-heading">{item.assetName}</div>
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-text-body">{item.customerName}</td>
                <td className="px-5 py-3 text-[12px] text-text-body">{item.duration}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    item.status === 'Lunas' 
                      ? 'bg-green-soft text-green-700 border-green-border' 
                      : 'bg-amber-soft text-amber-700 border-amber-border'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RentalRequestWidget;
