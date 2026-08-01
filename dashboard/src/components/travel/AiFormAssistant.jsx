import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const AiFormAssistant = ({ 
  isOpen, 
  setIsOpen, 
  currentFormState, 
  schema, 
  onFieldsUpdate 
}) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Saya asisten AI untuk mempermudah Anda mengisi form paket wisata ini. Silakan beritahu saya apa yang ingin dibuat, misalnya "Buatkan paket Bali Eksotis 3 Hari 2 Malam dengan harga 2 juta".' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [internalHistory, setInternalHistory] = useState([]); // This stores the actual history array sent/received from backend
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Optimistic UI update
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    setIsLoading(true);

    try {
      const res = await api.post('/ai/form-assistant/chat', {
        message: userMessage,
        currentFormState: currentFormState,
        schema: schema,
        history: internalHistory
      });

      if (res.data?.success) {
        const { fieldsToUpdate, aiMessage, updatedHistory, reasoning } = res.data.data;
        
        // Update the form fields via parent callback
        if (fieldsToUpdate && Object.keys(fieldsToUpdate).length > 0) {
          onFieldsUpdate(fieldsToUpdate);
        }

        // Update UI messages
        setMessages(prev => [...prev, { role: 'assistant', content: aiMessage, reasoning }]);
        
        // Update internal tracking history
        setInternalHistory(updatedHistory);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, terjadi kesalahan pada server saat memproses pesan Anda.' }]);
      }
    } catch (error) {
      console.error('AI Form Assistant error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gagal terhubung ke layanan AI.' }]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Slide-out Panel (Floating Card) */}
      <div 
        className={`absolute -right-[396px] top-0 h-full w-[380px] bg-white border border-border-base rounded-2xl shadow-2xl z-[60] flex flex-col transition-all duration-300 ease-in-out transform origin-left ${isOpen ? 'scale-x-100 opacity-100 visible' : 'scale-x-95 opacity-0 invisible'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-base bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Icon name="Bot" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-heading">AI Form Assistant</h3>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-text-muted hover:text-text-heading hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Status Checklist Tracker (Simplified visual) */}
        <div className="px-4 py-2 bg-gray-50 border-b border-border-base flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Progress:</span>
          {schema.map((f, i) => {
            const isFilled = !!currentFormState[f.name];
            return (
              <div 
                key={i} 
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium border ${isFilled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}
                title={f.label}
              >
                <Icon name={isFilled ? "CheckCircle2" : "Circle"} size={10} />
                {f.label}
              </div>
            );
          })}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                    : 'bg-white text-text-heading rounded-tl-sm shadow-sm border border-border-base'
                }`}
              >
                {msg.content}
              </div>
              {msg.reasoning && (
                <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 ml-1">
                  <Icon name="Info" size={10} />
                  {msg.reasoning}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start">
              <div className="bg-white border border-border-base text-text-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                <Icon name="Loader" size={14} className="animate-spin text-indigo-500" />
                Menganalisis form...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-border-base rounded-b-2xl">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik instruksi form di sini..."
              disabled={isLoading}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              <Icon name="Send" size={16} />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-400">Tekan Enter untuk mengirim</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default AiFormAssistant;
