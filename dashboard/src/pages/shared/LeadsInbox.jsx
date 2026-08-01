import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LeadsPanel from '@/components/shared/LeadsPanel';
import api from '@/services/api';

/** Leads Inbox — Lead management with filtering, follow-up, manual messaging */
const LeadsInbox = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(null); // null = checking, true/false
  const [connectedPlatforms, setConnectedPlatforms] = useState({ wa: false, telegram: false });
  const [sseEvent, setSseEvent] = useState(null); // triggers child refresh (chat panel)
  const [aiTypingPhone, setAiTypingPhone] = useState(null);
  const sseRef = useRef(null);

  const fetchLeads = useCallback(async () => {
    try {
      const configRes = await api.get('/configuration').catch(() => ({ data: { data: {} } }));
      const telegramRes = await api.get('/telegram/config').catch(() => ({ data: { data: {} } }));
      
      const hasMeta = !!(configRes.data?.data?.zernio_whatsapp_account_id) 
        || configRes.data?.data?.zernio_sandbox_mode === 'true';
      const hasIg = !!(configRes.data?.data?.zernio_instagram_account_id);
      const tgData = telegramRes.data?.data;
      const hasTelegram = !!(tgData?.bot_token && tgData?.is_active);
      
      setConnectedPlatforms({ wa: hasMeta, telegram: hasTelegram, ig: hasIg });

      if (!hasMeta && !hasTelegram && !hasIg) {
        setIsConnected(false);
        setLoading(false);
        return;
      }
      setIsConnected(true);

      const res = await api.get('/leads/list');
      if (res.data.status) {
        // ── LOGIKA TAMPILAN: Hanya saved_name sebagai nama dikonfirmasi ──
        // push_name (display name platform) BUKAN nama asli, tidak boleh jadi header.
        // displayTitle: saved_name jika dikonfirmasi, fallback ke identifier platform
        const displayTitle = (l) => {
          if (l.saved_name) return l.saved_name;
          // Tidak pakai push_name sebagai title — langsung ke identifier
          if (l.instagram_username && !l.whatsapp_phone && !l.telegram_id &&
              !(l.phone && /^\d/.test(l.phone))) {
            return `@${l.instagram_username}`;
          }
          return l.phone;
        };
        // displayUsername: subtitle kecil di bawah header.
        // Jika saved_name ada → tampilkan identifier platform (nomor/username)
        // Jika saved_name kosong → tampilkan push_name sebagai keterangan kecil
        const displayUsername = (l) => {
          if (l.saved_name) {
            // Nama dikonfirmasi → subtitle = identifier platform
            if (l.instagram_username && !l.whatsapp_phone && !l.telegram_id &&
                !(l.phone && /^\d/.test(l.phone))) {
              return `@${l.instagram_username}`;
            }
            if (l.whatsapp_phone) return l.whatsapp_phone;
            if (l.telegram_id) return l.telegram_id;
            return l.phone;
          }
          // Nama belum dikonfirmasi → subtitle = push_name (jika ada)
          return l.push_name || null;
        };
        // Infer platform from channel field; fallback ke prefix phone (legacy)
        const inferPlatform = (l) => {
          if (l.channel) return l.channel;
          if (l.instagram_username || l.phone?.startsWith('ig_')) return 'instagram';
          if (l.phone?.startsWith('tg_')) return 'telegram';
          if (/^\d{6,12}$/.test(l.phone || '')) return 'wa';
          return 'wa';
        };
        const mapped = res.data.data.map(l => ({
          id: l.id,
          phone: l.phone,
          name: displayTitle(l),
          username: displayUsername(l),
          saved: !!l.saved_name,
          lastMessage: l.last_message_preview || 'Belum ada pesan',
          status: l.status,
          label: l.label,
          ghost_status: l.ghost_status || 'active',
          lastMessageAt: l.last_message_at,
          platform: inferPlatform(l),
          profile_photo_url: l.profile_photo_url || null,
          instagram_username: l.instagram_username || null,
          whatsapp_phone: l.whatsapp_phone || null,
          telegram_id: l.telegram_id || null,
        }));
        setLeads(mapped);
      }
    } catch (err) {
      console.error('Gagal mengambil data leads:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update leads list in-memory from SSE lead_updated event.
   * If lead exists → update preview & timestamp.
   * If lead is new → prepend to list.
   */
  const updateLeadFromSSE = useCallback((data) => {
    setLeads(prev => {
      const existingIdx = prev.findIndex(l =>
        l.phone === data.phone ||
        l.phone?.includes(data.phone) ||
        data.phone?.includes(l.phone)
      );

      if (existingIdx >= 0) {
        // Update existing lead in-place, move to top (most recent)
        const updated = { ...prev[existingIdx] };
        // Hanya update lastMessage jika server mengirim nilai non-null.
        // Null berarti "jangan overwrite" — dipakai saat AI reply untuk
        // menjaga preview tetap menampilkan pesan user terakhir.
        if (data.last_message_preview !== undefined && data.last_message_preview !== null) updated.lastMessage = data.last_message_preview;
        if (data.last_message_at !== undefined) updated.lastMessageAt = data.last_message_at;
        if (data.status !== undefined) updated.status = data.status;
        if (data.label !== undefined) updated.label = data.label;
        // LOGIKA: Hanya saved_name yang jadi header nama.
        // push_name hanya subtitle kecil ketika nama belum dikonfirmasi.
        if (data.saved_name !== undefined || data.push_name !== undefined) {
          if (data.saved_name) {
            // Nama dikonfirmasi → nama jadi title, identifier sebagai subtitle
            updated.name = data.saved_name;
            updated.saved = true;
            updated.username = data.whatsapp_phone || data.phone || updated.phone || null;
          } else {
            // Nama belum dikonfirmasi → identifier tetap title
            updated.saved = false;
            // push_name jadi subtitle kecil (bukan title)
            updated.username = data.push_name || null;
          }
        }
        if (data.channel !== undefined) updated.platform = data.channel;
        if (data.profile_photo_url !== undefined) updated.profile_photo_url = data.profile_photo_url;
        if (data.instagram_username !== undefined) updated.instagram_username = data.instagram_username || null;
        if (data.whatsapp_phone !== undefined) updated.whatsapp_phone = data.whatsapp_phone || null;
        if (data.telegram_id !== undefined) updated.telegram_id = data.telegram_id || null;

        const rest = prev.filter((_, i) => i !== existingIdx);
        return [updated, ...rest]; // move to top
      } else {
        // New lead — prepend to list
        // saved_name → jadi title. Jika kosong → identifier jadi title, push_name jadi subtitle.
        const isIgOnly = data.instagram_username && !data.whatsapp_phone && !data.telegram_id &&
          !(data.phone && /^\d/.test(data.phone));
        const identifier = isIgOnly ? `@${data.instagram_username}` : data.phone;
        const title = data.saved_name || identifier;
        const subtitle = data.saved_name
          ? identifier  // Nama dikonfirmasi → subtitle = identifier
          : (data.push_name || null);  // Nama belum dikonfirmasi → subtitle = push_name
        return [{
          id: data.id || Date.now(),
          phone: data.phone,
          name: title,
          username: subtitle,
          saved: !!data.saved_name,
          lastMessage: data.last_message_preview || 'Pesan baru',
          status: data.status || 'baru',
          label: data.label || 'potensial',
          lastMessageAt: data.last_message_at || new Date().toISOString(),
          platform: data.channel || 'wa',
          profile_photo_url: data.profile_photo_url || null,
          instagram_username: data.instagram_username || null,
          whatsapp_phone: data.whatsapp_phone || null,
          telegram_id: data.telegram_id || null,
        }, ...prev];
      }
    });
  }, []);

  // SSE Connection — instant push from server
  useEffect(() => {
    const session = localStorage.getItem('luevora_session');
    if (!session) return;
    const { tenant } = JSON.parse(session);
    const tenantId = tenant?.id;
    if (!tenantId) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';
    const eventSource = new EventSource(`${apiBase}/events/stream?tenantId=${tenantId}`);
    sseRef.current = eventSource;

    // new_message: notify chat panel to append message directly (no HTTP fetch)
    eventSource.addEventListener('new_message', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] New message received:', data);
      // Pass to LeadsPanel using CustomEvent to avoid React batching dropping rapid messages
      document.dispatchEvent(new CustomEvent('luevora_new_message', { detail: data }));

      // Clear AI typing when assistant reply arrives
      if (data.role === 'assistant') {
        setAiTypingPhone(null);
      }
    });

    // lead_updated: update sidebar list instantly without any HTTP request
    eventSource.addEventListener('lead_updated', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Lead updated:', data);
      updateLeadFromSSE(data);
    });

    eventSource.addEventListener('ai_typing', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] AI typing:', data);
      if (data.typing) {
        setAiTypingPhone(data.phone);
      } else {
        setAiTypingPhone(null);
      }
    });

    // Pipeline events: forward to LeadsPanel/PipelineViewer
    eventSource.addEventListener('pipeline_event', (e) => {
      const data = JSON.parse(e.data);
      document.dispatchEvent(new CustomEvent('luevora_pipeline', { detail: data }));
    });

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected to real-time stream');
      // On reconnect, refresh leads list to catch any missed messages
      fetchLeads();
    });

    eventSource.onerror = () => {
      console.warn('[SSE] Connection lost, will auto-reconnect...');
    };

    return () => {
      eventSource.close();
      sseRef.current = null;
    };
  }, [fetchLeads, updateLeadFromSSE]);

  // Initial fetch only
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-base"></div>
      </div>
    );
  }

  return (
    <div className="leads-inbox-container relative h-[calc(100dvh-52px-60px)] sm:h-[calc(100dvh-56px)] lg:h-[calc(100dvh-64px)] p-2 sm:p-6 box-border flex flex-col overflow-hidden">
      {/* Disconnected Overlay */}
      {isConnected === false && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center border border-gray-100">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
              <i className="fab fa-whatsapp text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Platform Belum Terkoneksi</h3>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              Anda belum mengkoneksikan sistem Chat ini. Silakan atur integrasi WhatsApp atau Telegram Anda di halaman Connect Platform untuk mulai menerima Leads.
            </p>
            <button 
              onClick={() => navigate('/connect-platform')}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
            >
              <i className="fas fa-link"></i>
              Pergi ke Connect Platform
            </button>
          </div>
        </div>
      )}

      <LeadsPanel leads={leads} sseEvent={sseEvent} aiTypingPhone={aiTypingPhone} setAiTypingPhone={setAiTypingPhone} connectedPlatforms={connectedPlatforms} />
    </div>
  );
};

export default LeadsInbox;
