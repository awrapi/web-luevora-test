import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Inbox, 
  Send, 
  Settings, 
  RefreshCw, 
  Mail, 
  PenTool, 
  X, 
  CheckCircle,
  AlertCircle,
  Link,
  Bot,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const EmailInbox = () => {
  const { user } = useAuth();
  const tenantId = user?.tenant_id || 11;

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [threadEmails, setThreadEmails] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [isConnected, setIsConnected] = useState(null); // null = checking, true/false
  const [aiAutoReply, setAiAutoReply] = useState(false); // Modals

  // Modals
  const [showCompose, setShowCompose] = useState(false);

  // Compose State
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    htmlBody: ''
  });
  const [sending, setSending] = useState(false);

  const [notification, setNotification] = useState(null);

  const fetchEmails = async (folder = 'inbox') => {
    setLoading(true);
    try {
      const configRes = await api.get('/email/config').catch(() => ({ data: null }));
      if (!configRes.data?.email_address) {
        setIsConnected(false);
        setLoading(false);
        return;
      }
      setIsConnected(true);
      setAiAutoReply(!!configRes.data.ai_auto_reply);

      const res = await api.get(`/email/inbox?folder=${folder}`);
      setEmails(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails(activeTab);

    let syncInterval;

    // Auto sync di background setiap kali tab inbox dibuka
    if (activeTab === 'inbox') {
      const doSync = () => {
        api.post('/email/sync')
          .then(res => {
            // Jika ada email baru yang ditarik, refresh list secara diam-diam
            if (res.data?.message && !res.data.message.includes('0 email')) {
              api.get('/email/inbox?folder=inbox').then(r => setEmails(r.data));
            }
          })
          .catch(() => {}); // abaikan error background sync
      };
      
      // Tarik segera saat pertama dibuka
      doSync();
      
      // Lakukan penarikan rutin setiap 15 detik untuk simulasi real-time
      syncInterval = setInterval(doSync, 15000);
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [activeTab]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleAi = async (e) => {
    const newVal = e.target.value === 'on';
    if (newVal === aiAutoReply) return;

    try {
      setAiAutoReply(newVal);
      await api.post('/email/config/ai-toggle', { ai_auto_reply: newVal ? 1 : 0 });
      showNotification(newVal ? 'AI Auto-Reply Diaktifkan' : 'AI Auto-Reply Dinonaktifkan', 'success');
    } catch (err) {
      setAiAutoReply(!newVal); // revert
      showNotification('Gagal mengubah pengaturan AI', 'error');
    }
  };

  useEffect(() => {
    if (selectedEmail) {
      setLoadingThread(true);
      const contact = activeTab === 'inbox' ? selectedEmail.from_email : selectedEmail.to_email;
      api.get(`/email/thread?subject=${encodeURIComponent(selectedEmail.subject)}&contact=${encodeURIComponent(contact)}`)
        .then(res => setThreadEmails(res.data))
        .catch(err => console.error(err))
        .finally(() => setLoadingThread(false));
    } else {
      setThreadEmails([]);
    }
  }, [selectedEmail, activeTab]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/email/sync');
      showNotification(res.data.message);
      fetchEmails(activeTab);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Gagal sinkronisasi email', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/email/send', composeData);
      showNotification('Email berhasil dikirim');
      setShowCompose(false);
      setComposeData({ to: '', subject: '', htmlBody: '' });
      if (activeTab === 'sent') fetchEmails('sent');
    } catch (err) {
      showNotification(err.response?.data?.error || 'Gagal mengirim email', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-100px)] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Disconnected Overlay */}
      {isConnected === false && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center border border-gray-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <Mail size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Email Belum Terkoneksi</h3>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              Anda belum mengkoneksikan sistem Email ini. Silakan atur IMAP & SMTP Anda di halaman Connect Platform untuk mulai menerima dan membalas email pelanggan.
            </p>
            <button 
              onClick={() => navigate('/connect-platform')}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <Link size={18} />
              Pergi ke Connect Platform
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <button 
            onClick={() => setShowCompose(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors"
          >
            <PenTool size={18} />
            Tulis Email
          </button>
        </div>
        
        <div className="flex-1 py-4">
          <button 
            onClick={() => { setActiveTab('inbox'); setSelectedEmail(null); }}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'inbox' ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Inbox size={18} />
            Kotak Masuk
          </button>
          <button 
            onClick={() => { setActiveTab('sent'); setSelectedEmail(null); }}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'sent' ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Send size={18} />
            Terkirim
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
          <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {activeTab === 'inbox' ? <Inbox className="text-blue-600" size={20} /> : <Send className="text-blue-600" size={20} />}
            {activeTab === 'inbox' ? 'Kotak Masuk' : 'Pesan Terkirim'}
          </h1>
          <div className="flex items-center gap-4">
            {notification && (
              <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {notification.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {notification.msg}
              </div>
            )}
            {activeTab === 'inbox' && (
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Menarik data...' : 'Sinkronisasi'}
              </button>
            )}
          </div>
        </div>

        {/* Email List or Detail View */}
        <div className="flex-1 flex overflow-hidden">
          {/* List Column */}
          <div className={`w-full lg:w-[400px] flex-shrink-0 border-r border-gray-200 overflow-y-auto ${selectedEmail ? 'hidden lg:block' : 'block'}`}>
            
            {/* AI Toggle Bar - Dipindah ke list column agar rapih di pojok kiri */}
            {activeTab === 'inbox' && (
              <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${aiAutoReply ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                    {aiAutoReply ? <Sparkles size={13} /> : <Bot size={13} />}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-gray-800 leading-none mb-0.5">AI Auto-Reply</h3>
                    <p className="text-[10px] text-gray-500 leading-none">Membalas otomatis.</p>
                  </div>
                </div>
                
                <select 
                  value={aiAutoReply ? 'on' : 'off'} 
                  onChange={handleToggleAi}
                  className={`pl-2.5 pr-7 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors appearance-none outline-none border shadow-sm
                    ${aiAutoReply 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 focus:ring-1 focus:ring-indigo-300 bg-[url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%234338ca%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")]' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 focus:ring-1 focus:ring-gray-300 bg-[url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")]'
                    } bg-[length:12px_12px] bg-no-repeat bg-[position:right_6px_center]`}
                >
                  <option value="off">Off (Manual)</option>
                  <option value="on">On (Auto)</option>
                </select>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Memuat email...</div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
                <Mail size={40} className="mb-3 opacity-20" />
                Belum ada email di folder ini.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {emails.map(email => (
                  <div 
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedEmail?.id === email.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'} ${!email.is_read ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {activeTab === 'inbox' ? (email.from_name || email.from_email) : email.to_email}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(email.date_received).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className={`text-sm mb-1 truncate ${!email.is_read ? 'font-semibold text-gray-800' : 'text-gray-800'}`}>
                      {email.subject}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {email.body_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail View Column */}
          <div className={`flex-1 overflow-y-auto bg-gray-50 ${!selectedEmail ? 'hidden lg:flex items-center justify-center' : 'block'}`}>
            {!selectedEmail ? (
              <div className="text-center text-gray-400 flex flex-col items-center">
                <Mail size={60} className="mb-4 opacity-20" />
                <p>Pilih email dari daftar untuk membaca</p>
              </div>
            ) : (
              <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full bg-white min-h-full shadow-sm">
                <div className="flex items-center gap-3 mb-6 lg:hidden">
                  <button onClick={() => setSelectedEmail(null)} className="text-gray-500 hover:text-gray-900">
                    &larr; Kembali ke daftar
                  </button>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{selectedEmail.subject.replace(/^(Re|Fwd|Reply|Forward):\s*/i, '').trim()}</h2>
                
                {loadingThread ? (
                  <div className="text-center py-10 text-gray-400">Memuat percakapan...</div>
                ) : (
                  <div className="space-y-8 pb-10">
                    {(threadEmails.length > 0 ? threadEmails : [selectedEmail]).map((msg, idx) => {
                      const isMe = msg.folder === 'sent';
                      return (
                        <div key={msg.id || idx} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                          <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isMe ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                                {isMe ? 'A' : (msg.from_name ? msg.from_name.charAt(0).toUpperCase() : msg.from_email.charAt(0).toUpperCase())}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {isMe ? 'Anda (Luevora CRM)' : (msg.from_name || msg.from_email)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {isMe ? `Ke: ${msg.to_email}` : `Dari: <${msg.from_email}>`}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(msg.date_received).toLocaleString('id-ID')}
                            </div>
                          </div>
          
                          <iframe 
                            title={`Email Content ${idx}`}
                            className="w-full border-none"
                            style={{ minHeight: '600px' }}
                            srcDoc={msg.body_html || msg.body_text?.replace(/\n/g, '<br/>') || ''}
                            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                            onLoad={(e) => {
                              try {
                                e.target.style.height = e.target.contentWindow.document.documentElement.scrollHeight + 'px';
                              } catch (err) {}
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">Tulis Email Baru</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <div className="flex border-b border-gray-200">
                  <span className="text-gray-500 py-2 pr-3 w-20">Kepada:</span>
                  <input type="email" required className="flex-1 py-2 outline-none" value={composeData.to} onChange={e => setComposeData({...composeData, to: e.target.value})} placeholder="email@tujuan.com" />
                </div>
                <div className="flex border-b border-gray-200">
                  <span className="text-gray-500 py-2 pr-3 w-20">Subjek:</span>
                  <input type="text" required className="flex-1 py-2 outline-none" value={composeData.subject} onChange={e => setComposeData({...composeData, subject: e.target.value})} placeholder="Judul email..." />
                </div>
                <div className="pt-2 h-64">
                  <textarea 
                    required 
                    className="w-full h-full resize-none outline-none text-gray-800 leading-relaxed" 
                    placeholder="Tulis pesan Anda di sini..."
                    value={composeData.htmlBody}
                    onChange={e => setComposeData({...composeData, htmlBody: e.target.value})}
                  ></textarea>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button type="button" onClick={() => setShowCompose(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-md transition-colors font-medium">Batal</button>
                <button type="submit" disabled={sending} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors shadow-sm">
                  {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  {sending ? 'Mengirim...' : 'Kirim Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailInbox;
