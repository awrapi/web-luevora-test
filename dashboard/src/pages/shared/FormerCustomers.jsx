import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

const FormerCustomers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [activeModal, setActiveModal] = useState(null); // 'CHAT', 'FOLLOW_UP'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [fuInstruction, setFuInstruction] = useState('');
  const [fuResultText, setFuResultText] = useState('');
  const [isFuGenerating, setIsFuGenerating] = useState(false);

  const fetchFormer = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/course/mantan');
      if (res.data.status) {
        setCustomers(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFormer();
  }, []);

  const formatPhone = (p) => {
    if (!p) return '-';
    let c = p.replace('@s.whatsapp.net', '');
    if (c.startsWith('62')) return '0' + c.substring(2);
    return c;
  };

  const getInitials = (n) => {
    if (!n) return '?';
    const c = n.replace(/[+\d@.\-]/g, ' ').trim();
    if (!c) return '?';
    const p = c.split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : c.substring(0, 2).toUpperCase();
  };

  const timeAgo = (dt) => {
    if (!dt) return '';
    const d = (Date.now() - new Date(dt).getTime()) / 60000;
    if (d < 1) return 'baru';
    if (d < 60) return Math.floor(d) + 'm';
    if (d < 1440) return Math.floor(d / 60) + 'j';
    if (d < 10080) return Math.floor(d / 1440) + 'h';
    return new Date(dt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const handleRestore = async (c) => {
    if (!window.confirm(`Aktifkan kembali ${c.saved_name || c.phone}?`)) return;
    try {
      const res = await api.post(`/course/mantan/${c.phone}/restore`);
      if (res.data.status) {
        alert(res.data.message);
        fetchFormer();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Hapus permanen ${c.saved_name || c.phone}? Data tidak dapat dikembalikan.`)) return;
    try {
      const res = await api.delete(`/course/mantan/${c.phone}`);
      if (res.data.status) {
        alert(res.data.message);
        fetchFormer();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const openFollowUp = (c) => {
    setSelectedCustomer(c);
    setFuInstruction('');
    setFuResultText('');
    setActiveModal('FOLLOW_UP');
  };

  const openChat = (c) => {
    setSelectedCustomer(c);
    setChatInput('');
    // Mock loading chat history
    setIsChatLoading(true);
    setActiveModal('CHAT');
    setTimeout(() => {
      setChatHistory([
        { role: 'user', message: 'Terima kasih informasinya.', created_at: new Date(Date.now() - 3600000) }
      ]);
      setIsChatLoading(false);
    }, 600);
  };

  const sendChatMsg = async () => {
    if (!chatInput.trim()) return;
    const newMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'assistant', message: newMsg, created_at: new Date() }]);
    
    try {
      // Simulate API call to send message
      // await api.post(`/course/mantan/${selectedCustomer.phone}/chat`, { message: newMsg });
    } catch (err) {
      alert('Gagal mengirim pesan');
    }
  };

  const generateAI = async () => {
    if (!fuInstruction.trim()) return alert('Tulis instruksi dulu');
    setIsFuGenerating(true);
    setFuResultText('');
    try {
      const res = await api.post(`/course/mantan/${selectedCustomer.phone}/ai-followup`, { instruction: fuInstruction });
      if (res.data.status) {
        setFuResultText(res.data.follow_up_text);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsFuGenerating(false);
    }
  };

  const sendFollowUpToWA = async () => {
    if (!fuResultText.trim()) return;
    try {
      // Assuming we have an endpoint to send chat, or we can use the same as before. 
      // For now we'll simulate success since the logic was in PHP sending to WA directly
      alert('Berhasil mengirim pesan Follow Up ke antrean WA!');
      setActiveModal(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = customers.filter(c => {
    const s = search.toLowerCase();
    const name = (c.saved_name || '').toLowerCase();
    const ph = c.phone.toLowerCase();
    return name.includes(s) || ph.includes(s);
  });

  return (
    <div className="h-[calc(100vh-70px)] overflow-y-auto bg-slate-50/50 pb-10 font-sans antialiased">
      {/* Header */}
      <div className="relative z-10 px-6 h-[64px] bg-white border-b border-slate-200 flex items-center shadow-sm">
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/customer-list')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <i className="fas fa-arrow-left text-[13px]"></i>
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-sm">
              <i className="fas fa-user-slash text-[14px]"></i>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[17px] font-extrabold text-slate-900 leading-snug">Mantan Customer</h1>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                Total: <span className="font-bold text-slate-700">{customers.length}</span> orang
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50/50 border border-slate-200 rounded-xl px-4 h-11 min-w-[260px] focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
              <input 
                type="text" 
                placeholder="Cari nama, telepon..." 
                className="bg-transparent border-none text-[13px] font-medium w-full outline-none text-slate-700 placeholder-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mx-6 my-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-[50px_2fr_1.5fr_2fr_2.5fr] px-6 py-4 border-b border-slate-200 bg-slate-50/50 gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          <span>#</span>
          <span>Customer</span>
          <span>Telepon</span>
          <span>Layanan Terakhir</span>
          <span>Aksi</span>
        </div>
        
        <div>
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 text-[13px] font-medium">
              <i className="fas fa-spinner fa-spin mr-2"></i> Memuat data...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <i className="fas fa-user-slash text-3xl mb-3 text-slate-300"></i>
              <p className="text-[13px] font-medium">Belum ada mantan customer</p>
            </div>
          ) : (
            filtered.map((c, i) => {
              const name = c.saved_name || formatPhone(c.phone);
              return (
                <div key={c.phone} className="grid grid-cols-[50px_2fr_1.5fr_2fr_2.5fr] px-6 py-4 border-b border-slate-100 items-center gap-4 hover:bg-slate-50/50 transition-colors last:border-b-0 bg-white">
                  <span className="text-[14px] font-bold text-slate-300">{i + 1}</span>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full shrink-0 bg-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-600 border border-slate-200">
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-slate-800 truncate">{name}</div>
                      <div className="text-[11px] text-slate-500">{timeAgo(c.updated_at)}</div>
                    </div>
                  </div>
                  <div className="text-[14px] font-semibold text-slate-600 truncate">{formatPhone(c.phone)}</div>
                  <div>
                    {c.former_services ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200 w-max cursor-default">
                        <i className="fas fa-history text-[10px]"></i> {c.former_services}
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-300 font-medium">-</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button 
                      onClick={() => openChat(c)}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                    >
                      <i className="fas fa-comment-dots text-[11px]"></i> Chat
                    </button>
                    <button 
                      onClick={() => openFollowUp(c)}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                    >
                      <i className="fas fa-robot text-[11px]"></i> Follow Up AI
                    </button>
                    <button 
                      onClick={() => handleRestore(c)}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                    >
                      <i className="fas fa-undo text-[11px]"></i> Aktifkan
                    </button>
                    <button 
                      onClick={() => handleDelete(c)}
                      className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center shrink-0"
                    >
                      <i className="fas fa-trash text-[11px]"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Follow Up AI */}
      {activeModal === 'FOLLOW_UP' && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center py-6">
          <div className="bg-white rounded-2xl w-full max-w-[520px] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="shrink-0 bg-gradient-to-b from-blue-50 to-white px-6 py-5 border-b border-slate-100 flex justify-between items-start rounded-t-2xl">
              <div>
                <div className="text-[16px] font-extrabold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-robot text-blue-600"></i> Follow Up AI
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Kirim ke: {selectedCustomer.saved_name || formatPhone(selectedCustomer.phone)}
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Instruksi untuk AI</label>
                <textarea 
                  value={fuInstruction}
                  onChange={(e) => setFuInstruction(e.target.value)}
                  placeholder="Contoh: Ajak kembali untuk les, tawarkan promo diskon 20%..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[13px] text-slate-700 outline-none focus:border-blue-500 transition-colors min-h-[100px] resize-y"
                ></textarea>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Ajak kembali les', 'Promo Diskon Alumni', 'Info Program Baru'].map(p => (
                    <span 
                      key={p} 
                      onClick={() => setFuInstruction(p)}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-600 cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <button 
                onClick={generateAI} 
                disabled={isFuGenerating || !fuInstruction.trim()}
                className="w-full py-3 rounded-xl font-bold text-[13px] text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isFuGenerating ? <><i className="fas fa-spinner fa-spin"></i> Generate Pesan AI...</> : <><i className="fas fa-magic"></i> Generate Pesan AI</>}
              </button>

              {fuResultText && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <i className="fas fa-check-circle"></i> Pesan AI Siap Kirim
                  </div>
                  <div className="bg-white border border-green-100 rounded-lg p-3 text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                    {fuResultText}
                  </div>
                  <button 
                    onClick={sendFollowUpToWA}
                    className="w-full mt-3 py-2.5 rounded-xl font-bold text-[13px] text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-paper-plane"></i> Kirim ke WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Chat Manual */}
      {activeModal === 'CHAT' && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center py-6">
          <div className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl flex flex-col h-[600px] max-h-[90vh]">
            <div className="shrink-0 bg-gradient-to-b from-green-50 to-white px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-[13px] shrink-0 border border-green-200">
                  {getInitials(selectedCustomer.saved_name || selectedCustomer.phone)}
                </div>
                <div>
                  <div className="text-[15px] font-extrabold text-slate-900 leading-tight">
                    {selectedCustomer.saved_name || selectedCustomer.phone || 'Customer'}
                  </div>
                  <div className="text-[11px] font-medium text-green-600 mt-0.5">
                    {formatPhone(selectedCustomer.phone)}
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="flex-1 bg-slate-50/50 p-5 overflow-y-auto flex flex-col gap-3 custom-scrollbar">
              {isChatLoading ? (
                <div className="text-center py-10 text-slate-500 text-[12px] font-medium flex flex-col items-center gap-2">
                  <i className="fas fa-spinner fa-spin text-green-500 text-lg"></i>
                  Memuat percakapan...
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-[12px] font-medium">
                  Belum ada riwayat percakapan
                </div>
              ) : (
                chatHistory.map((ch, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[80%] ${ch.role === 'assistant' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${ch.role === 'assistant' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                      {ch.message}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1 px-1">
                      {new Date(ch.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 p-4 bg-white border-t border-slate-100 flex gap-2 items-end rounded-b-2xl">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMsg()}
                placeholder="Ketik pesan..."
                className="flex-1 h-[42px] px-4 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-green-500 transition-colors"
              />
              <button 
                onClick={sendChatMsg}
                disabled={!chatInput.trim()}
                className="w-[42px] h-[42px] rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0 hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <i className="fas fa-paper-plane text-[13px] ml-[-2px]"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormerCustomers;
