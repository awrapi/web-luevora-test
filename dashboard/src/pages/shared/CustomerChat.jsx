import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

// ================================================================
// HELPERS
// ================================================================

const AVATAR_COLORS = [
  ['#7c3aed', '#a855f7'],
  ['#2563eb', '#3b82f6'],
  ['#059669', '#10b981'],
  ['#e11d48', '#f43f5e'],
  ['#d97706', '#f59e0b'],
  ['#4f46e5', '#6366f1'],
  ['#c026d3', '#e879f9'],
  ['#0284c7', '#38bdf8'],
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  // Jika name adalah nomor telepon (hanya digit, mungkin dengan +, spasi, strip),
  // tampilkan 2 digit terakhir sebagai initials.
  const digitsOnly = name.replace(/\D/g, '');
  if (digitsOnly.length >= 2 && /^[\d+\s\-()]+$/.test(name.trim())) {
    return digitsOnly.slice(-2);
  }
  const clean = name.replace(/[+\d@.\s-]/g, ' ').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : clean.substring(0, 2).toUpperCase();
};

const formatPhone = (phone) => {
  if (!phone) return '-';
  let clean = phone.replace('@s.whatsapp.net', '');
  if (clean.startsWith('62')) return '0' + clean.substring(2);
  return clean;
};

/**
 * Determine the primary & secondary display for a contact/lead.
 * ATURAN: push_name (display name platform) BUKAN nama dikonfirmasi.
 * Hanya saved_name yang boleh tampil sebagai nama di header.
 *
 * - Jika saved_name ada: NAMA sebagai primary, identifier sebagai secondary.
 * - Jika saved_name kosong: IDENTIFIER sebagai primary, push_name sebagai secondary kecil.
 *
 * @returns {{ primary: string, secondary: string|null, isIg: boolean }}
 */
const getContactDisplay = (item) => {
  if (!item) return { primary: '-', secondary: null, isIg: false };

  const isIg = !!(item.instagram_username && !item.whatsapp_phone && !item.telegram_id && !item.phone?.match(/^\d/));
  const hasIg = !!item.instagram_username;

  // Primary line: identifier platform (nomor WA/Tele atau username IG)
  let identifier = '-';
  if (isIg || (hasIg && !item.whatsapp_phone && !item.telegram_id)) {
    identifier = `@${item.instagram_username}`;
  } else if (item.whatsapp_phone) {
    identifier = formatPhone(item.whatsapp_phone);
  } else if (item.telegram_id) {
    identifier = item.telegram_id;
  } else if (item.phone && item.phone.match(/^\d/)) {
    identifier = formatPhone(item.phone);
  } else if (hasIg) {
    identifier = `@${item.instagram_username}`;
  } else if (item.phone) {
    identifier = item.phone;
  }

  // Nama — HANYA saved_name yang dianggap dikonfirmasi
  const confirmedName = item.saved_name || null;

  if (confirmedName) {
    // Nama dikonfirmasi → nama sebagai primary, identifier sebagai secondary
    return { primary: confirmedName, secondary: identifier, isIg };
  } else {
    // Nama belum dikonfirmasi → identifier sebagai primary,
    // push_name sebagai secondary kecil (jika ada)
    const pushName = item.push_name || item.first_name || null;
    return { primary: identifier, secondary: pushName, isIg };
  }
};

const formatTimeAgo = (datetime) => {
  if (!datetime) return '';
  const now = new Date();
  const then = new Date(datetime);
  const diffMs = now - then;
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay === 0) return then.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7) return then.toLocaleDateString('id-ID', { weekday: 'short' });
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hari Ini';
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// ================================================================
// SUB-COMPONENTS
// ================================================================

/** Gradient Avatar */
const Avatar = ({ name, size = 'md', className = '', online = false }) => {
  const [colorFrom, colorTo] = getAvatarColor(name);
  const initials = getInitials(name);
  const sizes = {
    xs: { wh: 24, text: '8px' },
    sm: { wh: 30, text: '10px' },
    md: { wh: 38, text: '12px' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className="rounded-full flex items-center justify-center text-white font-bold"
        style={{ width: s.wh, height: s.wh, fontSize: s.text, background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
      >
        {initials}
      </div>
      {online && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
      )}
    </div>
  );
};

/** Sidebar header */
const SidebarHeader = ({ onSearch }) => (
  <div className="px-4 pt-4 pb-3">
    <h2 className="text-[14px] font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5 tracking-tight">
      <i className="fas fa-headset text-blue-500 text-[12px]"></i> Customer Chat
    </h2>
    <div className="relative">
      <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"></i>
      <input
        type="text"
        placeholder="Cari customer..."
        onChange={(e) => onSearch(e.target.value)}
        className="w-full py-2 pr-3 pl-8 rounded-lg border border-gray-200 bg-gray-50 text-[12px] outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 placeholder:text-gray-400"
      />
    </div>
  </div>
);

/** View toggle — Inbox / Contacts */
const ViewToggle = ({ view, onSwitch }) => (
  <div className="flex gap-0.5 py-2 px-3 border-b border-gray-100 bg-gray-50/50">
    <button
      className={`flex-1 py-[5px] px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 ${
        view === 'inbox' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 border border-transparent'
      }`}
      onClick={() => onSwitch('inbox')}
    >
      <i className="fas fa-inbox text-[9px]"></i> Inbox
    </button>
    <button
      className={`flex-1 py-[5px] px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all text-center flex items-center justify-center gap-1.5 ${
        view === 'contacts' ? 'bg-white text-blue-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 border border-transparent'
      }`}
      onClick={() => onSwitch('contacts')}
    >
      <i className="fas fa-address-book text-[9px]"></i> Kontak
    </button>
  </div>
);

/** Customer item */
const CustomerItem = ({ customer, isActive, onClick, index }) => {
  const { primary, secondary } = getContactDisplay(customer);
  const isAssistant = customer.last_message_role === 'assistant';
  return (
    <div
      className={`group flex gap-3 py-3 px-4 cursor-pointer transition-all duration-150 border-l-[3px] ${
        isActive ? 'bg-blue-50/60 border-l-blue-500' : 'border-l-transparent hover:bg-gray-50'
      }`}
      onClick={onClick}
      style={{ animation: `fadeInUp 0.25s ease-out ${Math.min(index * 0.03, 0.3)}s both` }}
    >
      <Avatar name={primary} size="md" online={true} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[13px] font-semibold text-gray-900 truncate">{primary}</span>
          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">{formatTimeAgo(customer.last_message_time || customer.last_message_at)}</span>
        </div>
        {secondary ? (
          <div className="text-[11px] text-gray-500 truncate mb-1.5 leading-snug">{secondary}</div>
        ) : (
          <div className="text-[11px] text-gray-500 truncate mb-1.5 leading-snug flex items-center gap-1">
            {isAssistant && <span className="text-gray-400 text-[10px]">↗</span>}
            {customer.last_message_preview || customer.last_message || '-'}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] py-[2px] px-2 rounded-md font-semibold bg-purple-50 text-purple-600 inline-flex items-center gap-0.5">
            Customer
          </span>
          {customer.is_saved == 1 && (
            <span className="text-[9px] py-[2px] px-2 rounded-md font-semibold bg-emerald-50 text-emerald-600">Tersimpan</span>
          )}
        </div>
      </div>
    </div>
  );
};

/** CRM History Modal */
const CrmHistoryModal = ({ phone, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/api/customers/${encodeURIComponent(phone)}/history`);
        if (res.data.status) setHistory(res.data.data);
      } catch (err) {
        console.error('Failed to fetch CRM history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [phone]);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-[520px] max-w-[90vw] max-h-[75vh] flex flex-col shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.25s ease-out' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
            <i className="fas fa-history text-blue-500 text-[11px]"></i>Riwayat CRM
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"><i className="fas fa-times text-xs"></i></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
          {loading ? (
            <div className="flex justify-center p-8"><div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div></div>
          ) : history.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-[11px]">Belum ada riwayat aktivitas CRM.</div>
          ) : (
            <div className="relative border-l-2 border-blue-100 ml-2.5 py-1">
              {history.map((h, i) => (
                <div key={i} className="mb-4 ml-5 relative" style={{ animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}>
                  <span className="absolute -left-[27px] top-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></span>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-[10px] text-blue-600">{h.event_type}</span>
                      <span className="text-[9px] text-gray-400">{new Date(h.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 m-0">{h.event_detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Contact item */
const ContactItem = ({ contact, onClick, index }) => {
  const { primary, secondary } = getContactDisplay(contact);
  return (
    <div
      className="group flex items-center gap-3 py-3 px-4 cursor-pointer transition-all duration-150 hover:bg-gray-50 border-l-[3px] border-l-transparent"
      onClick={onClick}
      style={{ animation: `fadeInUp 0.25s ease-out ${Math.min(index * 0.03, 0.3)}s both` }}
    >
      <Avatar name={primary} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 truncate">{primary}</div>
        {secondary && <div className="text-[10.5px] text-gray-400 truncate">{secondary}</div>}
      </div>
      <span className="text-[9px] py-[2px] px-2 rounded-md font-semibold bg-blue-50 text-blue-600">
        {contact.is_saved == 1 ? 'Tersimpan' : 'Customer'}
      </span>
    </div>
  );
};

/** Chat bubble with avatar */
const ChatBubble = ({ msg, leadName }) => {
  const role = msg.role;
  const isManualMsg = msg.is_manual === 1 || msg.is_manual === true;
  const isOutgoing = role === 'assistant';
  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className={`flex items-end gap-2 ${isOutgoing ? 'justify-end' : 'justify-start'}`}
      style={{ animation: `${isOutgoing ? 'messageSlideInRight' : 'messageSlideInLeft'} 0.2s ease-out` }}
    >
      {/* Avatar left (incoming) */}
      {!isOutgoing && <Avatar name={leadName} size="xs" />}

      <div className="max-w-[65%] flex flex-col">
        <div className={`py-2 px-3 text-[12.5px] leading-relaxed break-words ${
          isOutgoing
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
        } ${isOutgoing && isManualMsg ? 'bg-amber-500' : ''}`}>
          {msg.content || msg.message}
          {isOutgoing && isManualMsg && (
            <small className="block text-[0.55rem] opacity-60 mt-0.5">[Manual]</small>
          )}
        </div>
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOutgoing ? 'justify-end' : ''}`}>
          <span className="text-[9px] text-gray-400">{time}</span>
          {isOutgoing && <i className="fas fa-check-double text-[8px] text-blue-400"></i>}
        </div>
      </div>

      {/* Avatar right (outgoing) */}
      {isOutgoing && <Avatar name="AI" size="xs" />}
    </div>
  );
};

/** New Chat Modal */
const NewChatModal = ({ onClose, onSend }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const handleSend = () => {
    if (!phone.trim()) return;
    let formatted = phone.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    if (!formatted.includes('@')) formatted += '@s.whatsapp.net';
    onSend(formatted, message || 'Halo Kak! Ada yang bisa kami bantu? 😊');
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-[380px] max-w-[90vw] shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.25s ease-out' }}>
        <h3 className="text-[13px] font-semibold text-gray-900 m-0 mb-3.5 flex items-center gap-1.5">
          <i className="fas fa-plus-circle text-blue-500 text-[11px]"></i>Chat Baru
        </h3>
        <label className="text-[10px] font-semibold text-gray-500 block mb-1">Nomor WhatsApp</label>
        <input type="text" placeholder="08xx atau 628xx" value={phone} onChange={e => setPhone(e.target.value)}
          className="w-full py-2 px-3 rounded-lg border border-gray-200 text-[12px] outline-none mb-3 font-sans focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" autoFocus />
        <label className="text-[10px] font-semibold text-gray-500 block mb-1">Pesan (opsional)</label>
        <textarea rows={3} placeholder="Halo Kak! Ada yang bisa kami bantu?" value={message} onChange={e => setMessage(e.target.value)}
          className="w-full py-2 px-3 rounded-lg border border-gray-200 text-[12px] outline-none mb-3 font-sans focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none" />
        <div className="flex gap-2 justify-end">
          <button className="py-[7px] px-4 rounded-lg text-[11px] font-medium cursor-pointer border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all" onClick={onClose}>Batal</button>
          <button className="py-[7px] px-4 rounded-lg text-[11px] font-medium cursor-pointer border-none bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95" onClick={handleSend}>
            <i className="fas fa-paper-plane mr-1 text-[9px]"></i>Kirim
          </button>
        </div>
      </div>
    </div>
  );
};

// ================================================================
// MAIN COMPONENT
// ================================================================
const CustomerChat = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('inbox');
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [chatData, setChatData] = useState({ lead: null, chats: [] });
  const [chatLoading, setChatLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(null);
  const [isManual, setIsManual] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const messagesEndRef = useRef(null);
  const chatPollingRef = useRef(null);
  const inboxPollingRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const lastChatCountRef = useRef(0);

  const loadCustomers = useCallback(async (searchVal) => {
    try {
      const configRes = await api.get('/configuration').catch(() => ({ data: { data: {} } }));
      const baileyRes = await api.get('/whatsapp/status').catch(() => ({ data: { status: 'disconnected' } }));
      const hasMeta = !!(configRes.data?.data?.zernio_whatsapp_account_id);
      const hasIg = !!(configRes.data?.data?.zernio_instagram_account_id);
      const hasTelegram = !!(configRes.data?.data?.telegramConfig?.bot_token);
      if (!hasMeta && !hasTelegram && !hasIg) { setIsConnected(false); setListLoading(false); return; }
      setIsConnected(true);
      const res = await api.get('/leads/list', { params: { filter: 'customer', search: searchVal || '' } });
      if (res.data.status) setCustomers(res.data.data || []);
    } catch (err) {
      console.error('[CustomerChat] loadCustomers error:', err);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get('/leads/customers');
      if (res.data.status) setContacts(res.data.data || []);
    } catch (err) {
      console.error('[CustomerChat] loadContacts error:', err);
    }
  }, []);

  const openChat = useCallback(async (phone) => {
    setSelectedPhone(phone);
    setChatLoading(true);
    lastChatCountRef.current = 0;
    try {
      const res = await api.get('/leads/chat', { params: { phone } });
      if (res.data.status) {
        setChatData(res.data.data);
        setIsManual(res.data.data.lead?.is_manual == 1);
      }
    } catch (err) {
      console.error('[CustomerChat] openChat error:', err);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const toggleMode = async () => {
    if (!selectedPhone) return;
    const newMode = isManual ? 0 : 1;
    try {
      await api.post('/leads/mode/set', { phone: selectedPhone, is_manual: newMode });
      setIsManual(!isManual);
    } catch (err) {
      console.error('[CustomerChat] toggleMode error:', err);
    }
  };

  const sendMessage = async () => {
    const msg = msgInput.trim();
    if (!msg || !selectedPhone) return;
    setMsgInput('');
    const now = new Date().toISOString();
    setChatData(prev => ({ ...prev, chats: [...prev.chats, { role: 'assistant', content: msg, created_at: now, is_manual: 1 }] }));
    try {
      await api.post('/leads/message/send', { phone: selectedPhone, message: msg });
      loadCustomers(search);
    } catch (err) {
      console.error('[CustomerChat] sendMessage error:', err);
    }
  };

  const sendNewChat = async (phone, message) => {
    try {
      await api.post('/leads/message/send', { phone, message });
      loadCustomers(search);
      setTimeout(() => openChat(phone), 500);
    } catch (err) {
      console.error('[CustomerChat] sendNewChat error:', err);
    }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter') sendMessage(); };

  useEffect(() => { loadCustomers(''); }, [loadCustomers]);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => loadCustomers(search), 400);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [search, loadCustomers]);
  useEffect(() => { if (view === 'contacts') loadContacts(); }, [view, loadContacts]);
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chatData.chats]);
  useEffect(() => {
    if (chatPollingRef.current) clearInterval(chatPollingRef.current);
    if (!selectedPhone) return;
    chatPollingRef.current = setInterval(async () => {
      try {
        const res = await api.get('/leads/chat', { params: { phone: selectedPhone } });
        if (res.data.status && res.data.data.chats) {
          const newCount = res.data.data.chats.length;
          if (newCount !== lastChatCountRef.current) {
            lastChatCountRef.current = newCount;
            setChatData(res.data.data);
            setIsManual(res.data.data.lead?.is_manual == 1);
          }
        }
      } catch (err) { /* silent */ }
    }, 5000);
    return () => clearInterval(chatPollingRef.current);
  }, [selectedPhone]);
  useEffect(() => {
    inboxPollingRef.current = setInterval(() => loadCustomers(search), 30000);
    return () => clearInterval(inboxPollingRef.current);
  }, [search, loadCustomers]);

  // ── Render messages with date separators ──
  const renderMessages = () => {
    const chats = chatData.chats || [];
    if (chats.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 opacity-30 gap-2">
          <i className="fas fa-comments text-2xl text-gray-400"></i>
          <p className="text-[11px] font-medium text-gray-400">Belum ada percakapan</p>
        </div>
      );
    }

    const leadName = lead ? getContactDisplay(lead).primary : formatPhone(selectedPhone);
    let lastDate = '';

    return chats.map((msg, i) => {
      const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : '';
      const showDateSep = msgDate && msgDate !== lastDate;
      if (showDateSep) lastDate = msgDate;

      return (
        <React.Fragment key={i}>
          {showDateSep && (
            <div className="flex items-center justify-center my-3">
              <span className="text-[10px] font-medium text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-0.5 shadow-xs">
                {formatDate(msg.created_at)}
              </span>
            </div>
          )}
          <ChatBubble msg={msg} leadName={leadName} />
        </React.Fragment>
      );
    });
  };

  const lead = chatData.lead;
  const { primary: headerPrimary, secondary: headerSecondary } = getContactDisplay(lead || { phone: selectedPhone });
  const displayName = headerPrimary;

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-[340px_1fr] h-[calc(100vh-52px-60px)] sm:h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)] overflow-hidden bg-white border border-gray-200 rounded-none sm:rounded-2xl shadow-sm sm:mx-4 sm:my-3">

      {/* Disconnected Overlay */}
      {isConnected === false && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-2xl">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-sm text-center border border-gray-100" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-3">
              <i className="fab fa-whatsapp text-xl"></i>
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">Platform Belum Terkoneksi</h3>
            <p className="text-gray-500 mb-4 text-[11px] leading-relaxed">
              Anda belum mengkoneksikan sistem Chat ini. Silakan atur integrasi WhatsApp atau Telegram di halaman Connect Platform.
            </p>
            <button onClick={() => navigate('/connect-platform')} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium transition-colors">
              <i className="fas fa-link text-[9px]"></i>Pergi ke Connect Platform
            </button>
          </div>
        </div>
      )}

      {/* === LEFT SIDEBAR === */}
      <div className={`flex flex-col border-r border-gray-100 bg-white max-md:max-h-[45vh] ${selectedPhone ? 'hidden md:flex' : 'flex'}`}>
        <SidebarHeader onSearch={setSearch} />
        <ViewToggle view={view} onSwitch={setView} />
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {view === 'inbox' ? (
            listLoading ? (
              <div className="flex flex-col items-center justify-center p-8 gap-2">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-400">Memuat customer...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
                <i className="fas fa-headset text-2xl text-gray-400"></i>
                <p className="text-[11px] font-medium text-gray-400">Belum ada customer aktif</p>
              </div>
            ) : (
              customers.map((c, idx) => (
                <CustomerItem key={c.phone || c.id} customer={c} isActive={selectedPhone === c.phone} onClick={() => openChat(c.phone)} index={idx} />
              ))
            )
          ) : (
            <>
              <button className="flex items-center justify-center gap-1.5 p-2 mx-3 mt-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-blue-500 text-[10.5px] font-medium cursor-pointer transition-all hover:bg-blue-100" onClick={() => setShowNewChat(true)}>
                <i className="fas fa-plus-circle text-[9px]"></i> Mulai Chat Baru
              </button>
              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 opacity-30 gap-2">
                  <span className="text-[10px] text-gray-400">Belum ada kontak tersimpan</span>
                </div>
              ) : (
                contacts.map((c, idx) => (
                  <ContactItem key={c.phone || c.id} contact={c} onClick={() => { openChat(c.phone); setView('inbox'); }} index={idx} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* === RIGHT: CHAT PANEL === */}
      <div className={`flex flex-col relative overflow-hidden bg-white ${selectedPhone ? 'flex' : 'hidden md:flex'}`}>
        {selectedPhone && lead ? (
          <div className="flex flex-col h-full" style={{ animation: 'fadeIn 0.2s ease-out' }}>

            {/* Chat Header */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-gray-100">
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedPhone(null)}
                className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-all active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <Avatar name={displayName} size="md" online={true} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] sm:text-[13px] font-semibold text-gray-900 truncate leading-tight">{displayName}</div>
                {headerSecondary && (
                  <div className="text-[10px] sm:text-[10.5px] text-gray-400 font-medium truncate">{headerSecondary}</div>
                )}
              </div>
              <div className="flex gap-1 sm:gap-1.5 items-center shrink-0">
                <button className="py-1 px-2 sm:px-2.5 rounded-lg text-[9px] sm:text-[10px] font-medium cursor-pointer border border-gray-200 flex items-center gap-1 transition-all bg-gray-50 hover:bg-white hover:shadow-sm text-gray-600" onClick={() => setShowHistoryModal(true)}>
                  <i className="fas fa-history text-[8px] text-blue-500"></i> CRM
                </button>
                <button className={`py-1 px-2.5 rounded-lg text-[10px] font-medium cursor-pointer border flex items-center gap-1 transition-all ${isManual ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`} onClick={toggleMode}>
                  <i className={`fas ${isManual ? 'fa-robot' : 'fa-hand-paper'} text-[8px]`}></i>
                  {isManual ? 'Aktifkan AI' : 'Ambil Alih'}
                </button>
                <span className="py-0.5 px-2 rounded-md bg-purple-50 text-purple-600 text-[9px] font-semibold">Customer</span>
              </div>
            </div>

            {/* Mode Status Bar */}
            <div className={`flex items-center gap-2 py-1.5 px-5 text-[10px] border-b transition-all ${isManual ? 'bg-amber-50/60 border-amber-100 text-amber-700' : 'bg-blue-50/40 border-blue-100/40 text-blue-600'}`}>
              <i className={`fas ${isManual ? 'fa-hand-paper' : 'fa-robot'} text-[8px]`}></i>
              <span className="font-medium">{isManual ? 'Mode Manual — AI dijeda. Anda yang merespons.' : 'AI Aktif — AI melayani customer otomatis.'}</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 scrollbar-thin" style={{ background: '#fafbfc' }}>
              {chatLoading ? (
                <div className="flex flex-col items-center justify-center p-8 gap-2">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  <span className="text-[10px] text-gray-400">Memuat chat...</span>
                </div>
              ) : (
                <>
                  {renderMessages()}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-100 px-4 py-2.5 flex gap-2 items-center">
              <input
                type="text"
                placeholder="Ketik balasan ke customer..."
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full py-2 px-3.5 text-[12px] outline-none font-sans focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-gray-400"
              />
              <button
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all shrink-0 active:scale-90 ${
                  msgInput.trim() ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
                onClick={sendMessage}
                disabled={!msgInput.trim()}
              >
                <i className="fas fa-paper-plane text-[11px]"></i>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-25 gap-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <i className="fas fa-headset text-2xl text-gray-400"></i>
            </div>
            <p className="text-[12px] font-semibold text-gray-400">Pilih customer untuk mulai percakapan</p>
          </div>
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onSend={sendNewChat} />}
      {showHistoryModal && <CrmHistoryModal phone={selectedPhone} onClose={() => setShowHistoryModal(false)} />}
    </div>
  );
};

export default CustomerChat;