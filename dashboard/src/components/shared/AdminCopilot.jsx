import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

// Lazy-load the entire Three.js + @react-three/fiber bundle
// so it's only downloaded when the 3D model first mounts.
const CopilotModel3D = lazy(() => import('./CopilotModel3D'));

/** Skeleton shown while the 3D model chunk is being downloaded */
const Model3DSkeleton = ({ size = 64 }) => (
  <div
    style={{ width: size, height: size, flexShrink: 0 }}
    className="rounded-full bg-gray-200/60 animate-pulse"
  />
);

/**
 * Helper sederhana untuk me-render markdown dasar secara aman di dalam chat bubble.
 * Mendukung tebal (**), miring (*), bullet list (-), inline code (`), dan baris baru (\n).
 */
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Pisahkan baris
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let cleanLine = line;
    
    // Deteksi Bullet List (- atau *)
    const isBullet = cleanLine.trim().startsWith('- ') || cleanLine.trim().startsWith('* ');
    if (isBullet) {
      cleanLine = cleanLine.trim().substring(2);
    }
    
    // Parse Tautan / Link ([text](url))
    cleanLine = cleanLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 underline font-semibold decoration-indigo-300 hover:decoration-indigo-600 underline-offset-2 transition-colors">$1</a>');

    // Parse Tebal (**text**)
    cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Parse Miring (*text*)
    cleanLine = cleanLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Parse Inline Code (`code`)
    cleanLine = cleanLine.replace(/`(.*?)`/g, '<code class="bg-indigo-50 text-indigo-600 font-mono text-xs px-1.5 py-0.5 rounded border border-indigo-100 font-semibold">$1</code>');
    
    if (isBullet) {
      return (
        <ul key={idx} className="list-disc list-inside ml-2 my-1 text-[13px] leading-relaxed text-text-body">
          <li dangerouslySetInnerHTML={{ __html: cleanLine }} />
        </ul>
      );
    }
    
    return (
      <p 
        key={idx} 
        className="my-1.5 text-[13px] leading-relaxed text-text-body font-medium" 
        dangerouslySetInnerHTML={{ __html: cleanLine || '&nbsp;' }} 
      />
    );
  });
};

const AdminCopilot = ({ isOpen: externalOpen, onToggle }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  // Use external control if provided, otherwise internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (val) => {
    if (onToggle) onToggle(typeof val === 'function' ? val(externalOpen) : val);
    else setInternalOpen(typeof val === 'function' ? val(internalOpen) : val);
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Halo Admin! Saya adalah AI Copilot Anda. Saya dapat membantu mencari data CRM, menganalisis status transaksi hari ini, atau memeriksa status request dan chat dari kontak tertentu secara real-time. Ada yang bisa saya bantu?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningStep, setReasoningStep] = useState(0);

  const messagesEndRef = useRef(null);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Efek simulasi logger penalaran langkah-demi-langkah (reasoning steps)
  useEffect(() => {
    if (isLoading) {
      setReasoningStep(1); // Menganalisis
      const timer1 = setTimeout(() => setReasoningStep(2), 2500); // Membaca tabel
      const timer2 = setTimeout(() => setReasoningStep(3), 5000); // Menyintesis
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setReasoningStep(0);
    }
  }, [isLoading]);

  // Generator UUID sederhana untuk sesi chat baru
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Mengambil daftar sesi dari backend
  const fetchSessions = async (selectActiveId = null) => {
    try {
      const res = await api.get('/admin-copilot/sessions');
      if (res.data?.success) {
        setSessions(res.data.sessions);
        
        // Coba gunakan ID sesi terpilih, atau dari localStorage, atau sesi terbaru dari backend
        let savedSessionId = selectActiveId || localStorage.getItem('admin_copilot_session_id');
        
        if (res.data.sessions.length > 0) {
          if (!savedSessionId || !res.data.sessions.some(s => s.sessionId === savedSessionId)) {
            savedSessionId = res.data.sessions[0].sessionId;
          }
          setActiveSessionId(savedSessionId);
          localStorage.setItem('admin_copilot_session_id', savedSessionId);
          await loadSessionHistory(savedSessionId);
        } else {
          // Jika belum ada sesi sama sekali, buat baru
          handleStartNewConversation();
        }
      }
    } catch (err) {
      console.error('[AdminCopilot FetchSessions Error]:', err);
    }
  };

  // Memuat riwayat chat lengkap untuk sesi tertentu
  const loadSessionHistory = async (sessionId) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/admin-copilot/sessions/${sessionId}`);
      if (res.data?.success) {
        if (res.data.history.length > 0) {
          setMessages(res.data.history.map(h => ({
            role: h.role,
            content: h.message
          })));
        } else {
          setMessages([
            {
              role: 'assistant',
              content: 'Halo Admin! Percakapan ini masih baru. Ada analitik data CRM atau transaksi hari ini yang ingin saya bantu cari?'
            }
          ]);
        }
      }
    } catch (err) {
      console.error('[AdminCopilot LoadHistory Error]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Pemicu pertama kali widget dibuka
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  // Handler membuat percakapan baru
  const handleStartNewConversation = () => {
    const newId = generateUUID();
    setActiveSessionId(newId);
    localStorage.setItem('admin_copilot_session_id', newId);
    setMessages([
      {
        role: 'assistant',
        content: 'Halo Admin! Saya adalah AI Copilot Anda. Saya dapat membantu mencari data CRM, menganalisis status transaksi hari ini, atau memeriksa status request dan chat dari kontak tertentu secara real-time. Ada yang bisa saya bantu?'
      }
    ]);
  };

  // Handler menghapus sesi chat
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation(); // Cegah auto-select session
    if (!window.confirm('Hapus sesi obrolan ini beserta seluruh riwayatnya secara permanen?')) return;

    try {
      const res = await api.delete(`/admin-copilot/sessions/${sessionId}`);
      if (res.data?.success) {
        // Update list local
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        
        // Jika yang dihapus adalah sesi aktif saat ini
        if (activeSessionId === sessionId) {
          const remainingSessions = sessions.filter(s => s.sessionId !== sessionId);
          if (remainingSessions.length > 0) {
            const nextSessionId = remainingSessions[0].sessionId;
            setActiveSessionId(nextSessionId);
            localStorage.setItem('admin_copilot_session_id', nextSessionId);
            await loadSessionHistory(nextSessionId);
          } else {
            handleStartNewConversation();
          }
        }
      }
    } catch (err) {
      console.error('[AdminCopilot DeleteSession Error]:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    
    // Tambahkan pesan pengguna ke chat log
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Panggil backend API dengan mengirim activeSessionId
      const res = await api.post('/admin-copilot/chat', {
        message: userMsg,
        sessionId: activeSessionId
      }, { timeout: 120000 }); // Copilot AI butuh waktu lebih lama dari 30 detik (default API)

      if (res.data?.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
        
        // Segarkan daftar sesi setelah pesan pertama untuk memperbarui judul yang di-generate AI
        const isNewSession = !sessions.some(s => s.sessionId === activeSessionId);
        if (isNewSession) {
          setTimeout(() => {
            fetchSessions(activeSessionId);
          }, 2000); // Beri jeda 2 detik agar background title generation selesai
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, saya mengalami kegagalan sistem saat memproses data Anda.' }]);
      }
    } catch (err) {
      console.error('[AdminCopilot Frontend Error]:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Terjadi kesalahan jaringan atau otoritas sesi. Pastikan Anda telah masuk sebagai admin.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-[76px] right-2 sm:bottom-6 sm:right-6 z-[9999] font-sans">
      {/* ===== PANEL CHAT COPILOT (EXPANDED) ===== */}
      {isOpen && (
        <div
          className="bg-white flex overflow-hidden
            fixed inset-0 sm:static sm:inset-auto
            sm:rounded-2xl sm:border sm:border-gray-200"
          style={{
            ...(window.innerWidth >= 640 ? {
              width: isSidebarOpen ? 'min(620px, calc(100vw - 1rem))' : 'min(380px, calc(100vw - 1rem))',
              height: 'min(600px, calc(100vh - 8rem))',
              animation: 'fadeInUp 0.2s cubic-bezier(0.16,1,0.3,1)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.14)'
            } : {})
          }}
        >
          {/* ── SIDEBAR RIWAYAT — overlay on mobile, side panel on desktop ── */}
          {isSidebarOpen && (
            <div className="w-full sm:w-[210px] h-full bg-gray-50 sm:border-r sm:border-gray-100 flex flex-col shrink-0
              absolute inset-0 sm:static z-10 sm:z-auto">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Mobile: Back button to close sidebar */}
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="sm:hidden p-1.5 -ml-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all"
                  >
                    <Icon name="ArrowLeft" size={16} />
                  </button>
                  <span className="text-[11px] font-semibold text-gray-500">Riwayat</span>
                </div>
                <button
                  onClick={handleStartNewConversation}
                  title="Percakapan baru"
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
                >
                  <Icon name="Plus" size={13} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-[11px] text-gray-400">Belum ada riwayat.</p>
                  </div>
                ) : (
                  sessions.map((sess) => {
                    const isActive = sess.sessionId === activeSessionId;
                    const dateFormatted = sess.created_at
                      ? new Date(sess.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : 'Baru saja';
                    return (
                      <div
                        key={sess.sessionId}
                        onClick={() => {
                          setActiveSessionId(sess.sessionId);
                          localStorage.setItem('admin_copilot_session_id', sess.sessionId);
                          loadSessionHistory(sess.sessionId);
                          // Close sidebar on mobile after selecting a session
                          if (window.innerWidth < 640) setIsSidebarOpen(false);
                        }}
                        className={`group px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isActive ? 'bg-white border border-gray-200 shadow-sm' : 'border border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] truncate leading-snug ${isActive ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                            {sess.title}
                          </p>
                          <span className="text-[9px] text-gray-400 block mt-0.5">{dateFormatted}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(e, sess.sessionId)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all shrink-0 cursor-pointer"
                        >
                          <Icon name="Trash2" size={11} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── PANEL CHAT UTAMA ── */}
          <div className="flex-1 h-full flex flex-col min-w-0">
            {/* Header — clean white, with back button on mobile */}
            <div className="px-3 sm:px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 safe-top">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                {/* Mobile: Back button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-all"
                >
                  <Icon name="ArrowLeft" size={18} />
                </button>
                {/* Desktop: Sidebar toggle */}
                <button
                  onClick={() => setIsSidebarOpen(prev => !prev)}
                  className={`hidden sm:block p-1.5 rounded-lg transition-all cursor-pointer ${isSidebarOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                >
                  <Icon name="PanelLeft" size={14} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[14px] sm:text-[13px] font-semibold text-gray-900 leading-tight">AI Copilot</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Asisten analitik CRM</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Mobile: New conversation + sidebar history toggle */}
                <button
                  onClick={handleStartNewConversation}
                  title="Percakapan Baru"
                  className="sm:hidden p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all"
                >
                  <Icon name="Plus" size={18} />
                </button>
                <button
                  onClick={() => setIsSidebarOpen(prev => !prev)}
                  title="Riwayat"
                  className={`sm:hidden p-2 rounded-lg transition-all ${isSidebarOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                >
                  <Icon name="History" size={18} />
                </button>
                {/* Desktop only */}
                {!isSidebarOpen && (
                  <button
                    onClick={handleStartNewConversation}
                    title="Percakapan Baru"
                    className="hidden sm:block p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all cursor-pointer"
                  >
                    <Icon name="Plus" size={14} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hidden sm:block p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-all cursor-pointer"
                >
                  <Icon name="X" size={14} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-white">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[8px] font-bold text-gray-500 tracking-tight">AI</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 text-[12.5px] leading-relaxed break-words ${
                      msg.role === 'user'
                        ? 'bg-gray-900 text-white rounded-2xl rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? <p>{msg.content}</p> : renderMarkdown(msg.content)}
                  </div>
                </div>
              ))}

              {/* Thinking indicator — modern rotating spinner */}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[8px] font-bold text-gray-500 tracking-tight">AI</span>
                  </div>
                  <div className="ai-thinking-bubble" style={{ borderRadius: '14px', borderBottomLeftRadius: '4px' }}>
                    <span className="ai-thinking-spinner ai-thinking-spinner--sm" />
                    <span className="ai-thinking-bubble__label">Sedang berpikir...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input footer */}
            <form onSubmit={handleSend} className="px-3 py-3 border-t border-gray-100 bg-white shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className={`flex items-center gap-2 border rounded-xl px-3.5 py-2.5 transition-all ${
                isLoading
                  ? 'bg-gray-50 border-gray-100'
                  : 'bg-white border-gray-200 focus-within:border-gray-300 focus-within:shadow-sm'
              }`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLoading ? 'Sedang berpikir...' : 'Tanya sesuatu...'}
                  disabled={isLoading}
                  className="flex-1 bg-transparent outline-none text-[12.5px] text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
                    input.trim() && !isLoading
                      ? 'bg-gray-900 text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Icon name="Send" size={13} strokeWidth={2.5} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCopilot;
