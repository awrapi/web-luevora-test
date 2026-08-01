import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Icon from '@/components/shared/Icon';
import BrandIcon from '@/components/shared/BrandIcon';
import MediaLibraryModal from '@/components/shared/MediaLibraryModal';
import PipelineViewer from '@/components/shared/PipelineViewer';
import api from '@/services/api';

const DocumentPreview = lazy(() => import('@/components/shared/DocumentPreview'));
const MediaEditor = lazy(() => import('@/components/shared/MediaEditor'));

// ── Normalize legacy pipeline_status values from DB → valid PipelineViewer state IDs ──
const LEGACY_STATE_MAP = {
  // Old CRM-style states → new conversation phases
  'new_prospect':  'EXPLORATION',
  'contacted':     'EXPLORATION',
  'evaluation':    'PACKAGE_DISCUSS',
  'closing':       'NEGOTIATION',
  'closed_won':    'COMPLETED',
  'closed_lost':   'CANCELLED',
  // Lowercase aliases (in case DB has mixed casing)
  'exploration':       'EXPLORATION',
  'package_discuss':   'PACKAGE_DISCUSS',
  'negotiation':       'NEGOTIATION',
  'order_form':        'ORDER_FORM',
  'waiting_date':      'WAITING_DATE',
  'date_confirmed':    'DATE_CONFIRMED',
  'invoice_pending':   'INVOICE_PENDING',
  'payment_proof':     'PAYMENT_PROOF',
  'request_stuck':     'REQUEST_STUCK',
  'admin_pending':     'ADMIN_PENDING',
  'considering':       'CONSIDERING',
  'ghosted':           'GHOSTED',
  'idle':              'IDLE',
  'cancelled':         'CANCELLED',
  'completed':         'COMPLETED',
};
const VALID_STATES = new Set([
  'EXPLORATION', 'PACKAGE_DISCUSS', 'NEGOTIATION', 'ORDER_FORM',
  'WAITING_DATE', 'DATE_CONFIRMED', 'INVOICE_PENDING', 'PAYMENT_PROOF',
  'REQUEST_STUCK', 'ADMIN_PENDING', 'CONSIDERING', 'GHOSTED', 'IDLE',
  'CANCELLED', 'COMPLETED',
]);
const normalizePipelineStatus = (raw) => {
  if (!raw) return null;
  if (VALID_STATES.has(raw)) return raw;
  return LEGACY_STATE_MAP[raw.toLowerCase()] || 'EXPLORATION';
};

// ── AVATAR GRADIENT HELPER ──────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#7c3aed', '#a855f7'], // violet
  ['#2563eb', '#3b82f6'], // blue
  ['#059669', '#10b981'], // emerald
  ['#e11d48', '#f43f5e'], // rose
  ['#d97706', '#f59e0b'], // amber
  ['#4f46e5', '#6366f1'], // indigo
  ['#c026d3', '#e879f9'], // fuchsia
  ['#0284c7', '#38bdf8'], // sky
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  // Jika name adalah nomor telepon (hanya digit, mungkin dengan +, @, spasi, strip),
  // tampilkan 2 digit terakhir sebagai initials.
  const digitsOnly = name.replace(/\D/g, '');
  if (digitsOnly.length >= 2 && /^[\d+\s\-@.]+$/.test(name.trim())) {
    return digitsOnly.slice(-2);
  }
  const clean = name.replace(/[+\d@.\s-]/g, ' ').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : clean.substring(0, 2).toUpperCase();
};

const formatTimeAgo = (datetime) => {
  if (!datetime) return '';
  const now = new Date();
  const then = new Date(datetime);
  const diffMs = now - then;
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay === 0) {
    return then.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7) {
    return then.toLocaleDateString('id-ID', { weekday: 'short' });
  }
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const formatDateSeparator = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hari Ini';
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// ── MEDIA RENDERER HELPERS ──────────────────────────────────────────────────

const detectMediaType = (url) => {
  if (!url) return null;
  const lower = url.toLowerCase().split('?')[0];
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp|svg)$/.test(lower)) return 'image';
  if (/\.pdf$/.test(lower)) return 'pdf';
  if (/\.(doc|docx)$/.test(lower)) return 'word';
  if (/\.(xls|xlsx|csv)$/.test(lower)) return 'excel';
  if (/\.(ppt|pptx)$/.test(lower)) return 'powerpoint';
  if (/\.(txt|log|md)$/.test(lower)) return 'text';
  if (/\.(mp4|mov|avi|webm)$/.test(lower)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|oga)$/.test(lower)) return 'audio';
  return 'file';
};

const FILE_META = {
  pdf:        { icon: 'FileText',    color: 'text-red-500',    bg: 'bg-red-50',    label: 'PDF Document' },
  word:       { icon: 'FileText',    color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'Word Document' },
  excel:      { icon: 'Table2',      color: 'text-green-600',  bg: 'bg-green-50',  label: 'Spreadsheet' },
  powerpoint: { icon: 'Presentation',color: 'text-orange-500', bg: 'bg-orange-50', label: 'Presentation' },
  text:       { icon: 'FileText',    color: 'text-gray-500',   bg: 'bg-gray-50',   label: 'Text File' },
  video:      { icon: 'Video',       color: 'text-purple-500', bg: 'bg-purple-50', label: 'Video' },
  audio:      { icon: 'Music',       color: 'text-pink-500',   bg: 'bg-pink-50',   label: 'Audio' },
  file:       { icon: 'Paperclip',   color: 'text-gray-500',   bg: 'bg-gray-50',   label: 'File' },
};

const toProxyUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/uploads/')) {
    let backendBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    backendBase = backendBase.replace(/\/api\/?$/, '');
    return `${backendBase}${url}`;
  }
  return url;
};

const MediaRenderer = ({ url, isUser }) => {
  const [imgError, setImgError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoInlineRef = React.useRef(null);
  const type = detectMediaType(url);
  const filename = url.split('/').pop().split('?')[0] || 'Lampiran';
  const displayUrl = toProxyUrl(url);

  if (type === 'image') {
    if (imgError) {
      return (
        <a href={displayUrl} target="_blank" rel="noopener noreferrer"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] ${
            isUser ? 'border-gray-200 bg-white/80 text-gray-500' : 'border-white/20 bg-white/10 text-blue-200'
          }`}
        >
          <Icon name="ImageOff" size={14} />
          <span>Gambar (klik untuk buka)</span>
          <Icon name="ExternalLink" size={10} className="ml-auto" />
        </a>
      );
    }
    return (
      <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={displayUrl}
          alt="Gambar"
          className="rounded-lg max-w-[220px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onError={() => setImgError(true)}
        />
      </a>
    );
  }

  if (type === 'video') {
    return (
      <div className="relative rounded-lg overflow-hidden" style={{ maxWidth: 240 }}>
        <video
          ref={videoInlineRef}
          src={displayUrl}
          className="w-full max-h-[200px] object-cover bg-black rounded-lg"
          onClick={() => {
            if (videoInlineRef.current) {
              if (playing) { videoInlineRef.current.pause(); setPlaying(false); }
              else { videoInlineRef.current.play(); setPlaying(true); }
            }
          }}
          onEnded={() => setPlaying(false)}
          playsInline
        />
        {!playing && (
          <button
            className="absolute inset-0 flex items-center justify-center"
            onClick={() => { if (videoInlineRef.current) { videoInlineRef.current.play(); setPlaying(true); } }}
          >
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Icon name="Play" size={18} className="text-white ml-0.5" />
            </div>
          </button>
        )}
        {playing && (
          <button
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
            onClick={() => { if (videoInlineRef.current) { videoInlineRef.current.pause(); setPlaying(false); } }}
          >
            <Icon name="Pause" size={12} className="text-white" />
          </button>
        )}
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <audio controls className="max-w-[220px] h-8">
        <source src={displayUrl} />
        Browser tidak mendukung audio.
      </audio>
    );
  }

  const meta = FILE_META[type] || FILE_META.file;
  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all hover:shadow-sm ${
        isUser
          ? 'border-gray-200 bg-white/80 hover:bg-white'
          : 'border-white/20 bg-white/10 hover:bg-white/20'
      }`}
      style={{ maxWidth: 240, minWidth: 180 }}
    >
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${meta.bg}`}>
        <Icon name={meta.icon} size={16} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-semibold truncate ${isUser ? 'text-gray-800' : 'text-white'}`}>
          {filename}
        </div>
        <div className={`text-[9px] ${isUser ? 'text-gray-400' : 'text-blue-200'}`}>{meta.label}</div>
      </div>
      <Icon name="Download" size={14} className={isUser ? 'text-gray-400 shrink-0' : 'text-blue-200 shrink-0'} />
    </a>
  );
};

// ── AVATAR COMPONENT ────────────────────────────────────────────────────────

const Avatar = ({ name, photo = null, phone = null, size = 'md', className = '', online = false }) => {
  const [imgError, setImgError] = React.useState(false);

  // Use photo from DB (populated by webhook sender.picture)
  const resolvedPhoto = photo || null;

  const sizes = {
    xs: { wh: 24 },
    sm: { wh: 30 },
    md: { wh: 38 },
    lg: { wh: 44 },
  };
  const s = sizes[size] || sizes.md;
  const showPhoto = resolvedPhoto && !imgError;

  // Clean SVG default avatar — same style as WhatsApp/Instagram default
  const DefaultAvatar = () => (
    <svg
      width={s.wh}
      height={s.wh}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="20" cy="20" r="20" fill="#D1D5DB" />
      {/* Head */}
      <circle cx="20" cy="16" r="7" fill="#F9FAFB" />
      {/* Body / shoulders */}
      <path
        d="M4 38 C4 28 36 28 36 38"
        fill="#F9FAFB"
      />
    </svg>
  );

  return (
    <div className={`relative shrink-0 ${className}`}>
      {showPhoto ? (
        <img
          src={resolvedPhoto}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
          className="rounded-full object-cover"
          style={{ width: s.wh, height: s.wh, display: 'block' }}
          referrerPolicy="no-referrer"
        />
      ) : (
        <DefaultAvatar />
      )}
      {online && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
      )}
    </div>
  );
};


// ──────────────────────────────────────────────────────────────────────────────

const LeadsPanel = ({ leads = [], sseEvent = null, aiTypingPhone = null, setAiTypingPhone = () => {}, connectedPlatforms = {} }) => {
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activePlatform, setActivePlatform] = useState('mix');
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [toast, setToast] = useState(null);
  // Attachment / media
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  // ── File Staging (pending files before send) ──────────────────
  const [pendingFiles, setPendingFiles] = useState([]); // [{ id, file, previewUrl, type }]
  const [previewItem, setPreviewItem] = useState(null);  // file being previewed in lightbox
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  // ── Pipeline Viewer ──────────────────────────────────────────
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineData, setPipelineData] = useState(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const dropdownRef = useRef(null);
  const attachMenuRef = useRef(null);

  // ── AI Typing: robust phone-match helper ────────────────────────────────────
  // Normalises phones to digits-only and checks either direction of inclusion.
  const normalizeDigits = (v) => (v || '').replace(/\D/g, '');
  const isAiThinking =
    aiTypingPhone &&
    selectedLead?.phone &&
    (() => {
      const a = normalizeDigits(selectedLead.phone);
      const b = normalizeDigits(aiTypingPhone);
      if (!a || !b) return false;
      return a.includes(b) || b.includes(a);
    })();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsPlatformDropdownOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (type, text) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  const fetchChat = useCallback(async (phone) => {
    if (!phone) return;
    try {
      const res = await api.get(`/leads/chat?phone=${encodeURIComponent(phone)}`);
      if (res.data.status) {
        setChatHistory(res.data.data.chats || []);
        const lead = res.data.data.lead;
        if (lead) {
          setIsManual(lead.is_manual === 1);
          // ── Sync profile photo URL from DB into selectedLead ──
          // fetchChat returns the freshest lead data from DB, including profile_photo_url
          // which may have been written by the webhook since the last leads list fetch.
          if (lead.profile_photo_url !== undefined) {
            setSelectedLead(prev => prev ? { ...prev, profile_photo_url: lead.profile_photo_url } : prev);
          }
          // ── Restore conversation state from DB pipeline_status ──
          // When user navigates away and returns, or selects a lead that already
          // has a conversation state persisted in the DB, we restore it so the
          // Pipeline panel shows the correct status instead of being empty.
          if (lead.pipeline_status) {
            const normalizedState = normalizePipelineStatus(lead.pipeline_status);
            setPipelineData(prev => ({
              ...(prev || {}),
              conversationState: normalizedState,
              pendingItems: prev?.pendingItems || [],
            }));
            // Pipeline data restored but panel stays closed — user opens it manually
          }
        }

        // ── Restore AI thinking indicator from live Redis state ──
        // Survives page refresh / tab navigation by checking server-side processing flag
        if (res.data.data.aiProcessing) {
          setAiTypingPhone(phone);

          // ── Restore pipeline viewer state from Redis progress ──
          // If pipeline is actively running, restore stage data and auto-open the panel
          const progress = res.data.data.pipelineProgress;
          if (progress) {
            setPipelineRunning(true);
            setPipelineData({
              conversationState: progress.conversationState || null,
              pendingItems: [],
              stages: progress.stageName ? [{
                id: progress.stage,
                name: progress.stageName,
                elapsed: progress.elapsedMs || 0,
                decision: null,
              }] : [],
              totalMs: null,
              decision: null,
              originalMessage: progress.originalMessage || null,
              startedAt: progress.startedAt || null,
            });
            setPipelineOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch chat history', err);
    }
  }, [setAiTypingPhone]);

  // Toggle mobile-chat-active class on body for header hiding
  useEffect(() => {
    if (selectedLead?.phone) {
      document.body.classList.add('mobile-chat-active');
    } else {
      document.body.classList.remove('mobile-chat-active');
    }
    return () => document.body.classList.remove('mobile-chat-active');
  }, [selectedLead?.phone]);

  useEffect(() => {
    if (!selectedLead?.phone) {
      setChatHistory([]);
      setIsManual(false);
      return;
    }
    setLoadingChat(true);
    setMessageText('');
    // Reset pipeline data when switching contacts — prevents stale pipeline from previous lead
    // The fetchChat call below will restore it from DB if the lead has a pipeline_status
    setPipelineData(null);
    setPipelineRunning(false);
    fetchChat(selectedLead.phone).finally(() => setLoadingChat(false));
  }, [selectedLead?.phone, fetchChat]);

  useEffect(() => {
    const handleNewMessage = (e) => {
      const sseEvent = e.detail;
      if (!sseEvent || !selectedLead?.phone) return;
      const isForCurrentChat =
        selectedLead.phone === sseEvent.phone ||
        selectedLead.phone?.includes(sseEvent.phone) ||
        sseEvent.phone?.includes(selectedLead.phone);
      if (!isForCurrentChat) return;

      if (sseEvent.message && sseEvent.role && sseEvent.created_at) {
        const newMsg = {
          id: sseEvent.id ?? Date.now(),
          role: sseEvent.role,
          message: sseEvent.message,
          created_at: sseEvent.created_at,
          user_phone: selectedLead.phone,
          media_url: sseEvent.media_url || null,
        };
        setChatHistory(prev => {
          const isDuplicate = prev.some(m => m.id && m.id === newMsg.id);
          if (isDuplicate) return prev;
          return [...prev, newMsg];
        });
      } else {
        fetchChat(selectedLead.phone);
      }
    };
    document.addEventListener('luevora_new_message', handleNewMessage);
    return () => document.removeEventListener('luevora_new_message', handleNewMessage);
  }, [selectedLead, fetchChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // ── Pipeline SSE listener ──────────────────────────────────────
  useEffect(() => {
    const handlePipelineEvent = (e) => {
      const evt = e.detail;
      if (!evt || !selectedLead?.phone) return;
      // only for current chat
      const isForThis =
        selectedLead.phone === evt.phone ||
        selectedLead.phone?.includes(evt.phone) ||
        evt.phone?.includes(selectedLead.phone);
      if (!isForThis) return;

      if (evt.type === 'pipeline_start') {
        setPipelineRunning(true);
        setPipelineOpen(true); // Auto-open panel so user sees the pipeline in action
        setPipelineData(prev => ({ ...(prev || {}), stages: [], conversationState: null, pendingItems: [], totalMs: null, decision: null }));
      } else if (evt.type === 'pipeline_stage') {
        setPipelineRunning(true);
        setPipelineData(prev => {
          const stages = [...((prev?.stages) || [])];
          const idx = stages.findIndex(s => s.id === evt.stage.id);
          if (idx >= 0) stages[idx] = evt.stage;
          else stages.push(evt.stage);
          return { ...(prev || {}), stages };
        });
      } else if (evt.type === 'pipeline_state') {
        setPipelineData(prev => ({ ...(prev || {}), conversationState: evt.conversationState, pendingItems: evt.pendingItems || [] }));
      } else if (evt.type === 'pipeline_done') {
        setPipelineRunning(false);
        setPipelineData(prev => ({ ...(prev || {}), totalMs: evt.totalMs, decision: evt.decision }));
      }
    };
    document.addEventListener('luevora_pipeline', handlePipelineEvent);
    return () => document.removeEventListener('luevora_pipeline', handlePipelineEvent);
  }, [selectedLead]);

  useEffect(() => {
    if (isManual && inputRef.current) inputRef.current.focus();
  }, [isManual]);

  const handleToggleMode = async () => {
    if (!selectedLead?.phone || togglingMode) return;
    setTogglingMode(true);
    try {
      const newMode = !isManual;
      await api.post('/leads/mode/set', { phone: selectedLead.phone, is_manual: newMode });
      setIsManual(newMode);
      showToast('success', newMode ? 'Mode Manual aktif — AI dinonaktifkan' : 'AI Otomatis aktif kembali');
    } catch (err) {
      console.error('Failed to toggle mode', err);
      showToast('error', 'Gagal mengubah mode');
    } finally {
      setTogglingMode(false);
    }
  };

  /** Add file to staging queue — tidak langsung kirim */
  const addFileToPending = (file) => {
    if (!file) return;
    // WhatsApp/Zernio attachment limit is 25MB — reject early with clear message
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('error', `File "${file.name}" terlalu besar (${(file.size / 1024 / 1024).toFixed(1)}MB). Maksimal 25MB (batas WhatsApp).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const previewUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null;
    const type = isImage ? 'image' : isVideo ? 'video' : 'document';
    setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), file, previewUrl, type }]);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  /** Remove one file from staging */
  const removePendingFile = (id) => {
    setPendingFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  /** Upload a single file to the server */
  const uploadFileToServer = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('phone', selectedLead.phone);
    try {
      await api.post('/leads/message/send-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error(`[LeadsInbox] Gagal mengirim file "${file.name}":`, msg);
      return { success: false, error: msg, filename: file.name };
    }
  };

  /** Send text message + all staged files sequentially */
  const handleSendAll = async () => {
    const text = messageText.trim();
    const hasText = !!text;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || !selectedLead?.phone || sending) return;

    setSending(true);
    let tempMsg = null;

    try {
      // 1. Send text first
      if (hasText) {
        tempMsg = {
          role: 'assistant',
          message: text,
          created_at: new Date().toISOString(),
          is_manual_reply: true,
          status: 'sending'
        };
        setChatHistory(prev => [...prev, tempMsg]);
        setMessageText('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        const res = await api.post('/leads/message/send', { phone: selectedLead.phone, message: text });
        if (res.data.via === 'queue') showToast('warning', '⚠ Pesan masuk antrian.');
      }

      // 2. Send each pending file one by one
      const failedFiles = [];
      let successCount = 0;
      for (const pf of pendingFiles) {
        const result = await uploadFileToServer(pf.file);
        if (result.success) {
          successCount++;
        } else {
          failedFiles.push({ name: result.filename, error: result.error });
        }
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
      setPendingFiles([]);

      // 3. Refresh chat
      await fetchChat(selectedLead.phone);

      // 4. Report results — show partial failures clearly
      if (failedFiles.length === 0) {
        if (hasFiles) showToast('success', `✓ ${successCount} file berhasil dikirim`);
      } else if (successCount === 0) {
        const names = failedFiles.map(f => f.name).join(', ');
        showToast('error', `Gagal mengirim ${failedFiles.length} file (${names}): ${failedFiles[0].error}`);
      } else {
        showToast('warning', `${successCount} file terkirim, ${failedFiles.length} gagal: ${failedFiles.map(f => f.name).join(', ')}`);
      }

    } catch (err) {
      console.error('Failed to send', err);
      showToast('error', `Gagal mengirim: ${err.response?.data?.message || err.message}`);
      if (tempMsg) setChatHistory(prev => prev.filter(m => m !== tempMsg));
    } finally {
      setSending(false);
    }
  };

  const handleSaveEditedMedia = (newFile) => {
    setPendingFiles(prev => prev.map(pf => {
      if (pf.id === previewItem.id) {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        return {
          ...pf,
          file: newFile,
          previewUrl: URL.createObjectURL(newFile)
        };
      }
      return pf;
    }));
    setIsEditingMedia(false);
    setPreviewItem({ ...previewItem, file: newFile, previewUrl: URL.createObjectURL(newFile) });
  };

  /** Handle sending a file from the media library (URL-based) */
  const handleSendLibraryItem = async ({ mediaUrl, filename, caption }) => {
    if (!selectedLead?.phone) return;
    try {
      await api.post('/leads/message/send-library', {
        phone: selectedLead.phone,
        mediaUrl,
        caption,
        filename
      });
      showToast('success', `✓ ${filename} berhasil dikirim`);
      await fetchChat(selectedLead.phone);
    } catch (err) {
      showToast('error', `Gagal mengirim: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAll();
    }
  };

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'potensial', label: 'Potensial' },
    { id: 'customer', label: 'Customer' },
    { id: 'needs_admin', label: 'Needs Admin' },
    { id: 'ghosting', label: 'Ghosting' },
    { id: 'idle', label: 'Idle' },
  ];

  const filteredLeads = leads.filter(lead => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (lead.name || '').toLowerCase().includes(q);
      const matchUsername = (lead.username || '').toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').includes(q);
      if (!matchName && !matchUsername && !matchPhone) return false;
    }
    if (activeFilter !== 'all') {
      if (activeFilter === 'customer') return lead.label === 'customer';
      if (activeFilter === 'ghosting') return lead.ghost_status === 'ghosted';
      if (activeFilter === 'idle') return lead.ghost_status === 'idle';
      return lead.status === activeFilter;
    }
    if (activePlatform !== 'mix') {
      const lp = (lead.platform || '').toLowerCase();
      const normPlatform = (p) => (p === 'instagram' ? 'ig' : p === 'whatsapp' || p === 'meta' ? 'wa' : p);
      if (normPlatform(lp) !== activePlatform) return false;
    }
    return true;
  });

  const platforms = [
    { id: 'mix', label: 'Semua Platform', icon: 'Globe' },
    { id: 'wa', label: 'WhatsApp', icon: 'MessageCircle' },
    { id: 'telegram', label: 'Telegram', icon: 'Send' },
    { id: 'ig', label: 'Instagram', icon: 'Instagram' },
    { id: 'fb', label: 'Facebook', icon: 'Facebook' },
    { id: 'line', label: 'LINE', icon: 'MessageSquare' },
    { id: 'tiktok', label: 'TikTok', icon: 'Video' },
  ];

  // ── Render chat messages with date separators ──
  const renderChatMessages = () => {
    if (chatHistory.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-30">
          <Icon name="MessageCircle" size={32} className="text-gray-400" />
          <span className="text-[11px] text-gray-400 font-medium">Belum ada riwayat percakapan</span>
        </div>
      );
    }

    // Sort chatHistory copy chronologically to ensure correct sequence in UI
    const sortedChats = [...chatHistory].sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || 0) - (b.id || 0);
    });

    let lastDateStr = '';
    const leadName = selectedLead?.name || selectedLead?.phone || '';

    return sortedChats.map((msg, i) => {
      const isUser = msg.role === 'user';
      const hasMedia = !!msg.media_url;
      const isMediaPlaceholder = /^\[Media:/i.test((msg.message || '').trim());
      const hasText = msg.message && msg.message.trim() && msg.message !== '[Gambar/Media Dikirim]' && !isMediaPlaceholder;
      const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : '';
      const showDateSep = msgDate && msgDate !== lastDateStr;
      if (showDateSep) lastDateStr = msgDate;
      const time = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '';

      return (
        <React.Fragment key={i}>
          {/* ── Date Separator ── */}
          {showDateSep && (
            <div className="flex items-center justify-center my-3">
              <span className="text-[10px] font-medium text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-0.5 shadow-xs">
                {formatDateSeparator(msg.created_at)}
              </span>
            </div>
          )}

          {/* ── Message Row ── */}
          <div
            className={`flex items-end gap-2 ${isUser ? 'justify-start' : 'justify-end'}`}
            style={{ animation: `${isUser ? 'messageSlideInLeft' : 'messageSlideInRight'} 0.2s ease-out` }}
          >
            {/* Avatar left (incoming) */}
            {isUser && (
              <Avatar name={leadName} photo={selectedLead?.profile_photo_url || null} phone={selectedLead?.phone || null} size="xs" />
            )}

            {/* Bubble Container */}
            <div className={`max-w-[65%] flex flex-col gap-1 ${isUser ? 'items-start' : 'items-end'}`}>
              
              {/* For user: Image first, Text second (mimicking WhatsApp caption). For AI: Text first, Image second (since AI sends text before media) */}
              
              {/* Media Block - Renders first for user, second for AI */}
              {isUser && hasMedia && (
                <div className="flex flex-col">
                  <div
                    className={`p-1 flex flex-col gap-1.5 ${
                      isUser
                        ? 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
                        : 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                    }`}
                  >
                    <MediaRenderer url={msg.media_url} isUser={isUser} />
                  </div>
                  {!hasText && (
                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isUser ? '' : 'justify-end'}`}>
                      <span className="text-[9px] text-gray-400">{time}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Text Block - Renders second for user, first for AI */}
              {hasText && (
                <div className="flex flex-col">
                  <div
                    className={`py-2 px-3 text-[12.5px] leading-relaxed break-words flex flex-col gap-1.5 ${
                      isUser
                        ? 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
                        : 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                    }`}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${isUser ? '' : 'justify-end'}`}>
                    <span className="text-[9px] text-gray-400">{time}</span>
                    {!isUser && (
                      msg.status === 'sending' ? (
                        <Icon name="Clock" size={10} className="text-gray-400" />
                      ) : (
                        <Icon name="CheckCheck" size={11} className="text-blue-400" />
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Media Block - Renders second for AI */}
              {!isUser && hasMedia && (
                <div className="flex flex-col">
                  <div
                    className={`p-1 flex flex-col gap-1.5 ${
                      isUser
                        ? 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
                        : 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                    }`}
                  >
                    <MediaRenderer url={msg.media_url} isUser={isUser} />
                  </div>
                  {!hasText && (
                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isUser ? '' : 'justify-end'}`}>
                      <span className="text-[9px] text-gray-400">{time}</span>
                      {!isUser && (
                        msg.status === 'sending' ? (
                          <Icon name="Clock" size={10} className="text-gray-400" />
                        ) : (
                          <Icon name="CheckCheck" size={11} className="text-blue-400" />
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Avatar right (outgoing) */}
            {!isUser && (
              <Avatar name="AI" size="xs" />
            )}
          </div>
        </React.Fragment>
      );
    });
  };

  const statusLabelMap = {
    potensial: { label: 'Potensial', color: 'bg-blue-50 text-blue-600' },
    customer: { label: 'Customer', color: 'bg-purple-50 text-purple-600' },
    needs_admin: { label: 'Needs Admin', color: 'bg-amber-50 text-amber-600' },
    ghosting: { label: 'Ghosted', color: 'bg-red-50 text-red-500' },
    idle: { label: 'Idle', color: 'bg-gray-100 text-gray-500' },
    baru: { label: 'New Lead', color: 'bg-blue-50 text-blue-600' },
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Toast — dark minimal, centered top */}
      {toast && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[12px] font-medium text-white whitespace-nowrap"
          style={{
            background: 'rgba(17, 17, 17, 0.88)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            animation: 'fadeInUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Status dot */}
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-400' :
            toast.type === 'warning' ? 'bg-amber-400' :
            'bg-red-400'
          }`} />
          <span className="text-white/90">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-1 opacity-40 hover:opacity-80 transition-opacity p-0.5"
          >
            <Icon name="X" size={11} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white md:border md:border-gray-200 md:rounded-2xl overflow-hidden shadow-sm flex">

        {/* ═══════════ LEFT: Contact List ═══════════ */}
        <div className={`flex flex-col border-r border-gray-100 min-h-0 w-full md:w-[340px] md:shrink-0 transition-[max-width,opacity] duration-200 ${
          selectedLead ? 'max-md:hidden' : 'max-md:max-w-full'
        }`}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h6 className="font-semibold text-[14px] text-gray-900 tracking-tight">Leads Inbox</h6>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
                  className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <BrandIcon name={activePlatform} size={12} className={
                    activePlatform === 'wa' ? 'text-emerald-500' :
                    activePlatform === 'telegram' ? 'text-sky-500' :
                    activePlatform === 'ig' ? 'text-pink-500' :
                    activePlatform === 'fb' ? 'text-blue-500' :
                    activePlatform === 'line' ? 'text-[#00c300]' :
                    activePlatform === 'tiktok' ? 'text-black' :
                    'text-gray-400'
                  } />
                  <span>{platforms.find(p => p.id === activePlatform)?.label}</span>
                  <Icon name="ChevronDown" size={12} className={`text-gray-400 transition-transform duration-200 ${isPlatformDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isPlatformDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-[170px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-1" style={{ animation: 'fadeInUp 0.15s ease-out' }}>
                    {platforms.map(p => {
                      const isActive = activePlatform === p.id;
                      const isConnected = p.id === 'mix' || connectedPlatforms[p.id];
                      if (isConnected) {
                        return (
                          <button key={p.id} onClick={() => { setActivePlatform(p.id); setIsPlatformDropdownOpen(false); }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all w-full text-left ${isActive ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
                          >
                            <BrandIcon name={p.id} size={12} className={isActive ? 'text-blue-600' : p.id === 'wa' ? 'text-emerald-500' : p.id === 'telegram' ? 'text-sky-500' : p.id === 'ig' ? 'text-pink-500' : p.id === 'fb' ? 'text-blue-500' : p.id === 'line' ? 'text-[#00c300]' : p.id === 'tiktok' ? 'text-black' : 'text-gray-400'} />
                            {p.label}
                          </button>
                        );
                      } else {
                        return (
                          <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium rounded-lg w-full text-gray-300 cursor-default group">
                            <div className="flex items-center gap-2">
                              <BrandIcon name={p.id} size={12} className="text-gray-300 grayscale" />{p.label}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); window.location.href = '/connect-platform'; }} className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline px-1.5 py-0.5 rounded bg-blue-50">Connect</button>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <Icon name="Search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-[12px] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-gray-400"
                placeholder="Cari nama atau nomor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-3 py-[5px] rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                  activeFilter === filter.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredLeads.map((lead, idx) => {
              const isSelected = selectedLead?.id === lead.id;
              const statusInfo = statusLabelMap[lead.status] || statusLabelMap[lead.label] || statusLabelMap.baru;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`group flex gap-3 py-3 px-4 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-blue-50/60'
                      : 'hover:bg-gray-50'
                  }`}
                  style={{ animation: `fadeInUp 0.25s ease-out ${Math.min(idx * 0.03, 0.3)}s both` }}
                >
                  {/* Avatar */}
                  <Avatar name={lead.name || lead.phone} photo={lead.profile_photo_url || null} phone={lead.phone || null} size="md"  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[13px] text-gray-900 truncate">{lead.name || lead.phone}</span>
                      <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">{formatTimeAgo(lead.lastMessageAt)}</span>
                    </div>
                    {/* Subtitle: identifier platform (nomor/username) — tampil saat nama diketahui */}
                    {lead.username && (
                      <div className="text-[10px] text-gray-400 truncate mb-1 leading-snug font-mono">
                        {lead.username}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500 truncate mb-1.5 leading-snug flex items-center gap-1">
                      <span className="text-gray-400 text-[10px]">↗</span>
                      {lead.lastMessage || 'No messages yet'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] py-[2px] px-2 rounded-md font-semibold inline-flex items-center gap-1 ${statusInfo.color}`}>
                        <Icon name="Tag" size={8} />
                        {statusInfo.label}
                      </span>
                      {/* Platform icon */}
                      {(() => {
                        const lp = (lead.platform || '').toLowerCase();
                        const isWA = lp === 'wa' || lp === 'whatsapp' || lp === 'meta';
                        const isIG = lp === 'ig' || lp === 'instagram';
                        const isTG = lp === 'telegram';
                        const isFB = lp === 'fb' || lp === 'facebook';
                        const isLine = lp === 'line';
                        const isTT = lp === 'tiktok';
                        const bgClass = isWA ? 'bg-emerald-500'
                          : isIG ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
                          : isTG ? 'bg-sky-500'
                          : isFB ? 'bg-blue-600'
                          : isLine ? 'bg-[#00c300]'
                          : isTT ? 'bg-black'
                          : 'bg-gray-400';
                        const iconName = isWA ? 'wa' : isIG ? 'ig' : isTG ? 'telegram' : isFB ? 'fb' : isLine ? 'line' : isTT ? 'tiktok' : 'mix';
                        return (
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-white ${bgClass}`}>
                            <BrandIcon name={iconName} size={9} className="text-white" />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredLeads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center opacity-30">
                <Icon name="Inbox" size={32} className="mb-2 text-gray-400" />
                <p className="text-[11px] font-medium text-gray-400">Belum ada leads.</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ RIGHT: Chat Room ═══════════ */}
        <div className={`flex-1 flex flex-col relative min-h-0 bg-white min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ${
          selectedLead ? 'max-md:max-w-full' : 'max-md:hidden max-md:max-w-0'
        }`}>
          {selectedLead ? (
            <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>

              {/* Chat Header — fixed, non-scrollable */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-gray-100 shrink-0" style={{ position: 'relative' }}>
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="md:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500 transition-all active:scale-95 shrink-0"
                  aria-label="Back to contacts"
                >
                  <Icon name="ArrowLeft" size={18} />
                </button>
                <Avatar name={selectedLead.name || selectedLead.phone} photo={selectedLead.profile_photo_url || null} phone={selectedLead.phone || null} size="md"  />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] sm:text-[14px] text-gray-900 truncate leading-tight">{selectedLead.name || selectedLead.phone}</div>
                  {/* Subtitle: identifier platform (nomor/username) — tampil saat nama diketahui */}
                  {selectedLead.username && (
                    <div className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate">
                      {selectedLead.username}
                    </div>
                  )}
                </div>

                {/* Pipeline trigger button */}
                <button
                  id="pipeline-viewer-btn"
                  onClick={() => setPipelineOpen(p => !p)}
                  title={pipelineOpen ? 'Tutup Pipeline' : 'Lihat AI Pipeline'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 11px 5px 9px',
                    borderRadius: 10,
                    border: pipelineOpen ? '1px solid rgba(99,102,241,0.45)' : '1px solid #e5e7eb',
                    background: pipelineOpen ? 'linear-gradient(135deg,#6366f1,#3b82f6)' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: pipelineOpen ? '0 2px 12px rgba(99,102,241,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!pipelineOpen) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f0f0ff'; } }}
                  onMouseLeave={e => { if (!pipelineOpen) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; } }}
                >
                  {/* Live pulse dot */}
                  {pipelineRunning && (
                    <span style={{
                      position: 'absolute', top: -3, right: -3,
                      width: 9, height: 9, borderRadius: '50%',
                      background: '#22c55e', border: '1.5px solid white',
                      boxShadow: '0 0 8px rgba(34,197,94,0.7)',
                      animation: 'pulse 1.2s ease-in-out infinite',
                    }} />
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={pipelineOpen ? 'white' : '#6366f1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 600, color: pipelineOpen ? 'white' : '#6366f1', whiteSpace: 'nowrap' }}>
                    {pipelineOpen ? 'Tutup' : 'Pipeline'}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={pipelineOpen ? 'rgba(255,255,255,0.6)' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: pipelineOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Chat Messages Area — only this section scrolls */}
              <div className="flex-1 min-h-0 px-5 py-4 flex flex-col gap-3 overflow-y-auto overflow-x-hidden scrollbar-thin" style={{ background: '#fafbfc' }}>
                {loadingChat ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] text-gray-400 font-medium">Memuat chat...</span>
                  </div>
                ) : (
                  renderChatMessages()
                )}

                {/* Admin Typing Indicator */}
                {isManual && messageText.trim().length > 0 && (
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[9px] text-gray-400 italic">mengetik</span>
                    <div className="flex gap-[3px]">
                      <span className="w-1 h-1 rounded-full bg-gray-400" style={{ animation: 'typingDot 1.4s ease-in-out infinite' }} />
                      <span className="w-1 h-1 rounded-full bg-gray-400" style={{ animation: 'typingDot 1.4s ease-in-out 0.2s infinite' }} />
                      <span className="w-1 h-1 rounded-full bg-gray-400" style={{ animation: 'typingDot 1.4s ease-in-out 0.4s infinite' }} />
                    </div>
                  </div>
                )}

                {/* AI Thinking — modern rotating spinner */}
                {isAiThinking && (
                  <div className="flex items-end gap-2 justify-end" style={{ animation: 'messageSlideInRight 0.25s ease-out' }}>
                    <div className="ai-thinking-bubble">
                      <div className="relative flex items-center justify-center">
                        <span className="ai-thinking-spinner ai-thinking-spinner--sm" />
                        <span className="ai-thinking-spinner__ring" />
                      </div>
                      <span className="ai-thinking-bubble__label flex items-center gap-1">
                        <Icon name="Bot" size={11} style={{ color: '#6366f1' }} />
                        AI memproses
                      </span>
                    </div>
                    <Avatar name="AI" size="xs" />
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* ── Bottom Bar — fixed, non-scrollable ── */}
              <div className="chat-bottom-bar border-t border-gray-100 pb-0 shrink-0">
                {/* Platform + Handle/Back-to-AI row */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-b border-gray-100">
                  {/* Platform label */}
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-500 font-medium">
                    <BrandIcon
                      name={(selectedLead.platform === 'meta' || selectedLead.platform === 'whatsapp') ? 'wa' : (selectedLead.platform || 'wa')}
                      size={12}
                      className={
                        selectedLead.platform === 'wa' || selectedLead.platform === 'whatsapp' || selectedLead.platform === 'meta' ? 'text-emerald-500' :
                        selectedLead.platform === 'telegram' ? 'text-sky-500' :
                        selectedLead.platform === 'ig' ? 'text-pink-500' :
                        'text-gray-400'
                      }
                    />
                    <span className="hidden sm:inline">{
                      selectedLead.platform === 'wa' || selectedLead.platform === 'whatsapp' || selectedLead.platform === 'meta' ? 'WhatsApp' :
                      selectedLead.platform === 'telegram' ? 'Telegram' :
                      selectedLead.platform === 'ig' ? 'Instagram' :
                      selectedLead.platform === 'fb' ? 'Facebook' :
                      'WhatsApp'
                    }</span>
                  </div>

                  {/* Handle / Back to AI button */}
                  {isManual ? (
                    <button
                      onClick={handleToggleMode}
                      disabled={togglingMode}
                      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-medium text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 transition-all duration-150 disabled:opacity-50"
                    >
                      {togglingMode ? (
                        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="Bot" size={11} className="text-gray-400" />
                      )}
                      <span className="hidden sm:inline">{togglingMode ? 'Menyimpan...' : 'Serahkan ke AI'}</span>
                      <span className="sm:hidden">{togglingMode ? '...' : 'AI'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleToggleMode}
                      disabled={togglingMode}
                      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all duration-150 disabled:opacity-60"
                      style={{ boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
                    >
                      {togglingMode ? (
                        <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Icon name="User" size={11} />
                      )}
                      <span className="hidden sm:inline">{togglingMode ? 'Menyimpan...' : 'Handle'}</span>
                      <span className="sm:hidden">{togglingMode ? '...' : 'Handle'}</span>
                    </button>
                  )}
                </div>

                {/* ── Hidden file inputs ── */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={e => { if (e.target.files[0]) addFileToPending(e.target.files[0]); }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                  className="hidden"
                  onChange={e => { if (e.target.files[0]) addFileToPending(e.target.files[0]); }}
                />

                {/* ── File Staging Preview ── */}
                {isManual && pendingFiles.length > 0 && (
                  <div className="px-3 pt-2 flex gap-2 flex-wrap">
                    {pendingFiles.map(pf => (
                      <div
                        key={pf.id}
                        className="relative group flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer"
                        style={{ width: pf.type === 'document' ? 'auto' : 64, height: pf.type === 'document' ? 'auto' : 64, animation: 'fadeInUp 0.18s ease-out' }}
                        onClick={() => setPreviewItem(pf)}
                        title="Klik untuk preview"
                      >
                        {pf.type === 'image' && (
                          <>
                            <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Icon name="ZoomIn" size={18} className="text-white drop-shadow" />
                            </div>
                          </>
                        )}
                        {pf.type === 'video' && (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 gap-1 relative">
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                              <Icon name="Play" size={12} className="text-white ml-0.5" />
                            </div>
                            <span className="text-[7px] text-gray-300 px-1 truncate max-w-[56px]">{pf.file.name}</span>
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                        {pf.type === 'document' && (
                          <div className="relative flex items-center gap-2 px-3 py-2">
                            <Icon name="FileText" size={16} className="text-orange-500 shrink-0" />
                            <span className="text-[11px] text-gray-700 font-medium max-w-[120px] truncate">{pf.file.name}</span>
                            <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-end pr-8">
                              <Icon name="Eye" size={12} className="text-orange-400" />
                            </div>
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          onClick={e => { e.stopPropagation(); removePendingFile(pf.id); }}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-gray-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                        >
                          <Icon name="X" size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Input row ── */}
                <div className="px-3 pt-2 pr-3">
                  <div className={`chat-input-wrapper flex items-center gap-2 rounded-2xl border px-3 py-2 sm:py-2.5 transition-all ${
                    isManual
                      ? 'border-gray-200 bg-white shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50'
                      : 'border-gray-100 bg-gray-50/60'
                  }`}>
                    {/* AI active spinner (visible when AI manages the chat) */}
                    {!isManual && (
                      <div className="ai-status-bar" title="AI sedang aktif mengelola percakapan">
                        <span className="ai-thinking-spinner ai-thinking-spinner--xs" />
                        <span className="ai-status-bar__dot" />
                      </div>
                    )}
                    {/* Text input */}
                    <textarea
                      ref={inputRef}
                      rows="1"
                      className="chat-input-field flex-1 bg-transparent text-[13px] sm:text-[13px] outline-none placeholder:text-gray-400 text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300 resize-none py-1 min-h-[24px] max-h-[120px] scrollbar-thin"
                      style={{ lineHeight: '1.4' }}
                      placeholder={isManual ? (pendingFiles.length > 0 ? `${pendingFiles.length} file siap dikirim — tambah pesan (opsional)...` : 'Balas pesan...') : (isAiThinking ? 'AI sedang memproses pesan...' : 'AI sedang mengelola percakapan ini...')}
                      value={messageText}
                      onChange={(e) => {
                        if (isManual) {
                          setMessageText(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      disabled={!isManual || sending}
                      readOnly={!isManual}
                    />
                    {/* Send button — active if has text OR pending files */}
                    <button
                      onClick={handleSendAll}
                      disabled={!isManual || (!messageText.trim() && pendingFiles.length === 0) || sending}
                      className={`chat-send-btn w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                        isManual && (messageText.trim() || pendingFiles.length > 0) && !sending
                          ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700 shadow-sm'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Icon name="Send" size={14} strokeWidth={2.5} className={isManual ? '' : 'opacity-40'} />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Attachment action buttons (below input) ── */}
                <div className="px-3 pb-2 pt-1.5 flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={() => isManual && imageInputRef.current?.click()}
                    disabled={!isManual || sending}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                      isManual
                        ? 'border-gray-200 text-gray-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 cursor-pointer'
                        : 'border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                    title="Tambah gambar atau video"
                  >
                    <Icon name="Image" size={12} />
                    Gambar / Video
                  </button>

                  <button
                    onClick={() => isManual && fileInputRef.current?.click()}
                    disabled={!isManual || sending}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                      isManual
                        ? 'border-gray-200 text-gray-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 cursor-pointer'
                        : 'border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                    title="Tambah dokumen (PDF, Word, Excel, dll)"
                  >
                    <Icon name="FileText" size={12} />
                    Dokumen
                  </button>

                  <button
                    onClick={() => isManual && setShowLibrary(true)}
                    disabled={!isManual || sending}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                      isManual
                        ? 'border-gray-200 text-gray-500 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 cursor-pointer'
                        : 'border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                    title="Pilih dari Knowledge Base, Paket, atau Inventory"
                  >
                    <Icon name="Library" size={12} />
                    Dari Library
                  </button>

                  {/* File count badge */}
                  {isManual && pendingFiles.length > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                      <Icon name="Paperclip" size={10} />
                      {pendingFiles.length} file
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full opacity-25 gap-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Icon name="MessageSquare" size={28} className="text-gray-400" />
              </div>
              <p className="text-[12px] font-semibold text-gray-400">Pilih kontak untuk memulai percakapan</p>
            </div>
          )}
        </div>

        {/* ═══════════ Pipeline Panel — full-screen overlay on mobile, inline on desktop ═══════════ */}
        {pipelineOpen && (
          <div className="fixed inset-0 z-[60] md:static md:inset-auto md:z-auto md:w-[320px] md:shrink-0 bg-white md:bg-transparent">
            {/* Mobile overlay backdrop */}
            <div className="absolute inset-0 bg-black/20 md:hidden" onClick={() => setPipelineOpen(false)} />
            {/* Pipeline viewer container */}
            <div className="relative z-10 h-full w-full md:w-[320px] md:h-auto">
              <PipelineViewer
                isOpen={pipelineOpen}
                onClose={() => setPipelineOpen(false)}
                pipelineData={pipelineData}
                isRunning={pipelineRunning}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Media Library Modal ── */}
      <MediaLibraryModal
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSend={handleSendLibraryItem}
        disabled={!isManual || sending}
      />

      {/* ── Media Editor Lightbox ── */}
      {isEditingMedia && previewItem && (
        <Suspense fallback={null}>
          <MediaEditor
            file={previewItem.file}
            type={previewItem.type}
            onSave={handleSaveEditedMedia}
            onCancel={() => setIsEditingMedia(false)}
          />
        </Suspense>
      )}

      {/* ── File Preview Lightbox ── */}
      {previewItem && !isEditingMedia && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.18s ease-out' }}
          onClick={() => setPreviewItem(null)}
        >
          {/* Header */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Icon
                name={previewItem.type === 'video' ? 'Video' : 'Image'}
                size={14}
                className="text-white/70"
              />
              <span className="text-white text-[13px] font-medium truncate max-w-[260px]">
                {previewItem.file.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(previewItem.type === 'image' || previewItem.type === 'video') && (
                <button
                  onClick={() => setIsEditingMedia(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium transition-all"
                >
                  <Icon name="Edit3" size={14} />
                  Edit
                </button>
              )}
              <button
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <Icon name="X" size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {previewItem.type === 'image' && (
              <img
                src={previewItem.previewUrl}
                alt={previewItem.file.name}
                className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
                style={{ animation: 'fadeInUp 0.2s ease-out' }}
              />
            )}
            {previewItem.type === 'video' && (
              <video
                src={previewItem.previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl bg-black"
                style={{ animation: 'fadeInUp 0.2s ease-out', outline: 'none' }}
              />
            )}
            {previewItem.type === 'document' && (
              <Suspense fallback={
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-[12px]">Memuat preview…</span>
                </div>
              }>
                <DocumentPreview file={previewItem.file} />
              </Suspense>
            )}
          </div>

          {/* Hint */}
          <p className="absolute bottom-4 text-white/40 text-[11px]">
            Klik di luar untuk tutup
          </p>
        </div>
      )}
    </div>

  );
};

export default LeadsPanel;

