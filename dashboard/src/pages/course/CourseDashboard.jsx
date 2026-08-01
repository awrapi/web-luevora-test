import React, { useState, useEffect } from 'react';
import StatCard from '@/components/shared/StatCard';
import CourseScheduleWidget from '@/components/course/CourseScheduleWidget';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

/**
 * CourseDashboard Page
 * Modernized using Tailwind CSS v4 and Lucide React.
 */
const CourseDashboard = () => {
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [stats, setStats] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, scheduleRes] = await Promise.all([
          api.get('/leads/summary'),
          api.get('/course/schedule/list')
        ]);

        if (summaryRes.data.status) {
          const s = summaryRes.data.data;
          setStats([
            { label: 'Total Leads', value: s.total.toLocaleString(), icon: 'Users', variant: 'blue' },
            { label: 'Ghosting', value: s.ghosting.toString(), icon: 'Ghost', variant: 'purple' },
            { label: 'Pending Payment', value: s.menunggu_pembayaran.toString(), icon: 'CalendarClock', variant: 'amber' },
            { label: 'Potensial', value: s.potensial.toString(), icon: 'Star', variant: 'green' },
          ]);
        }

        if (scheduleRes.data.status) {
          // Map backend schedule to widget format
          const mapped = scheduleRes.data.data.map(sch => ({
            time: sch.schedule_time || 'TBA',
            student: sch.title, // In Course, title often represents the class/group
            subject: sch.description || sch.title,
            status: sch.status === 'active' ? 'Confirmed' : 'Pending'
          }));
          setSchedules(mapped);
        }
      } catch (err) {
        console.error('Gagal memuat data dashboard:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-base"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text-heading mb-1">Course Control Center</h2>
          <p className="text-text-muted text-xs sm:text-sm">Monitor leads, jadwal, dan performa AI Agent Anda.</p>
        </div>
        
        {/* Auto Follow-Up Toggle Widget */}
        <div className="bg-bg-surface border border-border-base p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="block text-[9px] uppercase tracking-widest text-text-muted font-bold mb-1">Auto Follow-Up</span>
              <div className={`text-[11px] font-bold ${autoFollowUp ? 'text-green-600' : 'text-text-muted'}`}>
                {autoFollowUp ? 'SISTEM AKTIF' : 'SISTEM NONAKTIF'}
              </div>
            </div>
            <button 
              onClick={() => setAutoFollowUp(!autoFollowUp)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 outline-none ${autoFollowUp ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${autoFollowUp ? 'translate-x-5' : ''}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Additional Quick Actions / Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <CourseScheduleWidget schedules={schedules} />
        </div>
        
        <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs hover:shadow-sm hover:border-border-hover transition-all">
          <div className="px-5 py-4 border-b border-bg-subtle">
            <h6 className="font-display font-bold text-sm text-text-heading">AI Insights</h6>
          </div>
          <div className="p-5">
            <div className="bg-indigo-soft/50 border border-indigo-border p-5 rounded-xl">
              <div className="flex items-center gap-2 text-indigo-base font-bold text-sm mb-2">
                <Icon name="Lightbulb" size={16} />
                Peluang Konversi
              </div>
              <p className="text-xs text-text-body leading-relaxed mb-4">
                Ada {stats.find(s => s.label === 'Ghosting')?.value || 0} leads "Ghosting" yang bisa dijangkau kembali hari ini. 
                Saran: Gunakan promo <span className="font-bold">"Early Bird Mei"</span> untuk memicu respon.
              </p>
              <button className="w-full bg-indigo-base hover:bg-indigo-mid text-white font-bold py-2 px-4 rounded-lg text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                <Icon name="Send" size={14} />
                Kirim Broadcast
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDashboard;
