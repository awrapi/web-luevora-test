import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const NotificationCenter = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Audio notifikasi sekarang ditangani secara global oleh useNotificationSound di SharedLayout.
  // SSE di sini hanya untuk me-refresh daftar notifikasi di UI.

  useEffect(() => {
    fetchNotifications(page);
    
    // Server-Sent Events (SSE) untuk update daftar notifikasi secara Real-Time
    let eventSource;
    
    if (page === 1) {
      let token = null;
      try {
        const session = localStorage.getItem('luevora_session');
        if (session) {
          token = JSON.parse(session).token;
        }
      } catch (e) {}
      token = token || localStorage.getItem('token');
      const baseURL = api.defaults.baseURL || 'http://127.0.0.1:3001/api';
      
      eventSource = new EventSource(`${baseURL}/notifications/stream?token=${token}`);
      
      eventSource.onmessage = (event) => {
        if (event.data === 'NEW_DATA') {
          fetchNotifications(1, true); // fetch data baru di background
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource.close();
      };
    }
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [page]);

  const fetchNotifications = async (currentPage, isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await api.get(`/notifications?page=${currentPage}&limit=${limit}`);
      if (res.data.success) {
        const newData = res.data.data;
        setNotifications(newData);
        setTotalPages(res.data.meta.total_pages);
        setTotalItems(res.data.meta.total_items);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const groupNotificationsByDate = (notifs) => {
    const grouped = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    notifs.forEach((notif) => {
      const date = new Date(notif.created_at);
      const dateStr = date.toDateString();
      let groupKey = dateStr;

      if (dateStr === todayStr) {
        groupKey = 'Hari Ini';
      } else if (dateStr === yesterdayStr) {
        groupKey = 'Kemarin';
      } else {
        groupKey = date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(notif);
    });

    return grouped;
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'transaction': return { name: 'ClipboardCheck', bg: 'bg-green-100', text: 'text-green-600' };
      case 'request': return { name: 'HelpCircle', bg: 'bg-indigo-100', text: 'text-indigo-600' };
      case 'info': return { name: 'Activity', bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'offer': return { name: 'Tag', bg: 'bg-orange-100', text: 'text-orange-600' };
      default: return { name: 'Bell', bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  const groupedNotifications = groupNotificationsByDate(notifications);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const handleNotificationClick = (link) => {
    if (link) {
      navigate(link);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Pusat Notifikasi</h2>
          <p className="text-sm text-text-secondary mt-1">Aktivitas dan pembaruan terbaru sistem ({totalItems} total)</p>
        </div>
        <button 
          onClick={() => fetchNotifications(page)}
          className="p-2 bg-bg-surface border border-border-base rounded-xl hover:bg-bg-subtle transition-colors"
          title="Refresh"
        >
          <Icon name="RefreshCw" size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 bg-bg-surface rounded-2xl border border-border-base">
          <Icon name="Loader2" className="animate-spin text-indigo-base mb-4" size={32} />
          <p className="text-text-secondary">Memuat notifikasi...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 bg-bg-surface rounded-2xl border border-border-base">
          <div className="w-16 h-16 bg-bg-subtle rounded-full flex items-center justify-center mb-4">
            <Icon name="BellOff" size={32} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">Tidak ada notifikasi</h3>
          <p className="text-text-secondary">Belum ada aktivitas terbaru yang tercatat.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedNotifications).map(([groupDate, items]) => (
            <div key={groupDate}>
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 pl-1">
                {groupDate}
              </h3>
              <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
                <div className="divide-y divide-border-base">
                  {items.map((notif) => {
                    const iconStyling = getIconForType(notif.type);
                    return (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif.link)}
                        className="p-4 flex gap-4 hover:bg-bg-subtle/50 transition-colors cursor-pointer group"
                      >
                        <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconStyling.bg} ${iconStyling.text}`}>
                          <Icon name={iconStyling.name} size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-text-primary group-hover:text-indigo-base transition-colors truncate pr-4">
                              {notif.title}
                            </h4>
                            <span className="text-xs font-medium text-text-muted whitespace-nowrap">
                              {formatTime(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                          {notif.customer_name && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-page border border-border-base text-[11px] font-medium text-text-secondary">
                                <Icon name="User" size={10} />
                                {notif.customer_name}
                              </span>
                              {notif.status && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-page border border-border-base text-[11px] font-medium text-text-secondary uppercase">
                                  Status: {notif.status.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon name="ChevronRight" size={20} className="text-text-muted" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6 bg-bg-surface p-4 rounded-2xl border border-border-base shadow-xs">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 ${
                  page === 1 
                    ? 'text-text-muted bg-bg-page cursor-not-allowed' 
                    : 'text-text-body bg-bg-page border border-border-base hover:bg-bg-subtle hover:text-indigo-base transition-colors'
                }`}
              >
                <Icon name="ChevronLeft" size={16} />
                Sebelumnya
              </button>
              <span className="text-sm font-medium text-text-secondary">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 ${
                  page === totalPages 
                    ? 'text-text-muted bg-bg-page cursor-not-allowed' 
                    : 'text-text-body bg-bg-page border border-border-base hover:bg-bg-subtle hover:text-indigo-base transition-colors'
                }`}
              >
                Selanjutnya
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
