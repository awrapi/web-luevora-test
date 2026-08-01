import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import StatCard from '@/components/shared/StatCard';
import api from '@/services/api';
import CalendarPanel from '@/pages/course/schedule/CalendarPanel';
import TabSiswa from '@/pages/course/schedule/TabSiswa';
import TabReschedule from '@/pages/course/schedule/TabReschedule';
import TabDateRequests from '@/pages/course/schedule/TabDateRequests';
import CreateScheduleModal from '@/pages/course/schedule/CreateScheduleModal';

const TABS = [
  { key: 'siswa', label: 'Jadwal Siswa', icon: 'GraduationCap' },
  { key: 'reschedule', label: 'Reschedule', icon: 'RefreshCw' },
  { key: 'datereq', label: 'Request Tanggal', icon: 'CalendarPlus' },
];

const Schedule = () => {
  const [activeTab, setActiveTab] = useState('siswa');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDate, setCreateDate] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data state
  const [stats, setStats] = useState({ total: 0, upcoming: 0, sent: 0, reschedule: 0 });
  const [schedules, setSchedules] = useState([]);
  const [studentSchedules, setStudentSchedules] = useState([]);
  const [rescheduleRequests, setRescheduleRequests] = useState([]);
  const [dateRequests, setDateRequests] = useState([]);
  const [labels, setLabels] = useState([]);
  const [badges, setBadges] = useState({ reschedule: 0, datereq: 0, running: 0 });

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const schedRes = await api.get('/course/schedule/list').catch(() => ({ data: { data: [] } }));
      const schedData = schedRes.data?.data || [];
      setSchedules(schedData);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const upcoming = schedData.filter(s => s.schedule_date >= todayStr).length;
      setStats({
        total: schedData.length, upcoming,
        sent: schedData.filter(s => s.followup_status === 'done').length, reschedule: 0,
      });

      try {
        const ssRes = await api.get('/course/schedule/student-schedules');
        setStudentSchedules(ssRes.data?.data || ssRes.data?.schedules || []);
      } catch {
        setStudentSchedules(schedData.map(s => ({
          ...s, student_name: s.title,
          _rt: s.schedule_date >= todayStr ? 'upcoming' : 'completed',
        })));
      }

      try {
        const rsRes = await api.get('/course/reschedule/list');
        const rsData = rsRes.data?.data || [];
        setRescheduleRequests(rsData);
        const pendingRs = rsData.filter(r => r.status === 'pending').length;
        setBadges(prev => ({ ...prev, reschedule: pendingRs }));
        setStats(prev => ({ ...prev, reschedule: pendingRs }));
      } catch { setRescheduleRequests([]); }

      try {
        const drRes = await api.get('/course/date-requests/list');
        const drData = drRes.data?.data || [];
        setDateRequests(drData);
        setBadges(prev => ({ ...prev, datereq: drData.filter(r => r.status === 'pending').length }));
      } catch { setDateRequests([]); }

      try {
        const lblRes = await api.get('/course/schedule/labels');
        setLabels(lblRes.data?.labels || lblRes.data?.data || []);
      } catch { setLabels([]); }
    } catch (err) {
      console.error('Schedule fetch error:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const id = setInterval(fetchData, 60000); return () => clearInterval(id); }, [fetchData]);

  const handleCreateSchedule = async (data) => {
    try { await api.post('/course/schedule/create', data); fetchData(); }
    catch (err) { console.error('Create schedule error:', err); }
  };

  const handleSearchCustomers = async (query) => {
    try {
      const res = await api.get(`/course/schedule/contacts?search=${encodeURIComponent(query)}`);
      return res.data?.data || res.data?.customers || [];
    } catch { return []; }
  };

  const handleCreateClick = (date) => { setCreateDate(date); setShowCreateModal(true); };

  const statCards = [
    { label: 'Total Jadwal', value: String(stats.total), icon: 'CalendarDays', variant: 'purple' },
    { label: 'Akan Datang', value: String(stats.upcoming), icon: 'CalendarClock', variant: 'blue' },
    { label: 'WA Terkirim', value: String(stats.sent), icon: 'Send', variant: 'green' },
    { label: 'Reschedule Pending', value: String(stats.reschedule), icon: 'RefreshCw', variant: 'amber' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-base" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-heading mb-1 flex items-center gap-2">
            <Icon name="Calendar" size={24} className="text-indigo-base" />
            Kalender Jadwal
          </h2>
          <p className="text-text-muted text-sm">Manajemen jadwal les & notifikasi otomatis</p>
        </div>
        <button
          onClick={() => handleCreateClick(null)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-base text-white font-bold text-xs border-none cursor-pointer whitespace-nowrap hover:bg-indigo-mid hover:shadow-[0_2px_10px_rgba(99,102,241,0.35)] hover:-translate-y-px transition-all"
        >
          <Icon name="Plus" size={14} strokeWidth={2.5} />
          Buat Jadwal Baru
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      {/* Main Layout: Calendar + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <CalendarPanel schedules={schedules} onDateSelect={() => {}} onCreateClick={handleCreateClick} />

        <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs">
          <div className="flex border-b border-border-base bg-bg-subtle/30">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-bold border-b-2 transition-all relative ${
                  activeTab === tab.key ? 'text-indigo-base border-indigo-base' : 'text-text-muted border-transparent hover:text-text-body'
                }`}
              >
                <Icon name={tab.icon} size={14} />
                {tab.label}
                {tab.key === 'reschedule' && badges.reschedule > 0 && (
                  <span className="absolute -top-0.5 right-1 bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">{badges.reschedule}</span>
                )}
                {tab.key === 'datereq' && badges.datereq > 0 && (
                  <span className="absolute -top-0.5 right-1 bg-indigo-base text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">{badges.datereq}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'siswa' && <TabSiswa studentSchedules={studentSchedules} loading={false} onEdit={(s) => console.log('Edit:', s)} />}
            {activeTab === 'reschedule' && <TabReschedule requests={rescheduleRequests} loading={false} onApprove={(r) => console.log('Approve:', r)} onReject={(r) => console.log('Reject:', r)} />}
            {activeTab === 'datereq' && <TabDateRequests requests={dateRequests} loading={false} onApprove={(r) => console.log('DR Approve:', r)} onReject={(r) => console.log('DR Reject:', r)} />}
          </div>
        </div>
      </div>

      <CreateScheduleModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onSave={handleCreateSchedule} labels={labels} onSearchCustomers={handleSearchCustomers} />
    </div>
  );
};

export default Schedule;
