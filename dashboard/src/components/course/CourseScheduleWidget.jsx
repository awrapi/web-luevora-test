import React from 'react';
import Icon from '@/components/shared/Icon';

/**
 * CourseScheduleWidget Component
 * Modernized using Tailwind CSS v4 and Lucide React.
 */
const CourseScheduleWidget = ({ schedules = [] }) => {
  return (
    <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs transition-all hover:shadow-sm hover:border-border-hover">
      <div className="px-5 py-4 border-b border-bg-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="Calendar" size={18} className="text-indigo-base" />
          <h6 className="font-display font-bold text-sm text-text-heading">Jadwal Mendatang (Hari Ini)</h6>
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 rounded-md border border-border-base text-text-body hover:bg-bg-subtle transition-all">
            <Icon name="CalendarSearch" size={14} />
          </button>
          <button className="px-3 py-1.5 rounded-md border border-border-base text-[11px] font-bold text-text-body hover:bg-bg-subtle transition-all">
            Lihat Semua
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg-subtle border-y border-border-base">
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Waktu</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Siswa</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Materi</th>
              <th className="px-5 py-2.5 text-left text-[10px] uppercase tracking-wider text-text-muted font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-subtle/50">
            {schedules.map((item, index) => (
              <tr key={index} className="hover:bg-indigo-soft/30 transition-colors">
                <td className="px-5 py-3 text-[12px] font-bold text-indigo-base">{item.time}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 text-[12px] text-text-body">
                    <div className="w-6 h-6 rounded-full bg-bg-subtle flex items-center justify-center font-bold text-[10px] text-text-muted border border-border-base">
                      {item.student.charAt(0)}
                    </div>
                    {item.student}
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-text-body">{item.subject}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    item.status === 'Confirmed' 
                      ? 'bg-green-soft text-green-700 border-green-border' 
                      : 'bg-amber-soft text-amber-700 border-amber-border'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-10 text-[13px] text-text-muted italic">
                  Tidak ada jadwal untuk hari ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CourseScheduleWidget;
