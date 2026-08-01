import { useState, useEffect } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';
import InvoiceTemplateEditor from '@/components/travel/InvoiceTemplateEditor';
import ReceiptTemplateEditor from '@/components/travel/ReceiptTemplateEditor';
import BankSettings from '@/components/shared/BankSettings';
import { useAuth } from '@/hooks/useAuth';

/**
 * Configuration Page
 * Migrated from legacy admin.php tab-central.
 * Manages store globals, shipping API, and AI System Roles (Sales & CS).
 */
const Configuration = () => {
  const { businessType } = useAuth();
  const [activeView, setActiveView] = useState('list');
  // Store Config State
  const [storeConfig, setStoreConfig] = useState({
    form_url: '',
    api_key: '',
    origin_id: '',
  });

  // Search Origin State
  const [searchOriginTxt, setSearchOriginTxt] = useState('');
  const [originResults, setOriginResults] = useState([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);

  // Personas State
  const [salesPersona, setSalesPersona] = useState('');
  const [csPersona, setCsPersona] = useState('');
  
  // Settings
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoFollowUp, setAutoFollowUp] = useState(false);

  // AI Service Switch
  const [aiServiceEnabled, setAiServiceEnabled] = useState(true);
  const [aiSwitchSaving, setAiSwitchSaving] = useState(false);

  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // DP & Transaction Config
  const [dpEnabled, setDpEnabled] = useState(false);
  const [dpPercentage, setDpPercentage] = useState('50');
  const [signDelayHours, setSignDelayHours] = useState('4');
  const [autoFollowupExpiryHours, setAutoFollowupExpiryHours] = useState('72');
  const [expiredDelayHours, setExpiredDelayHours] = useState('48');

  // Invoice / Receipt State
  const [invoiceTemplates, setInvoiceTemplates] = useState([]);
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [showReceiptEditor, setShowReceiptEditor] = useState(false);
  const [invoiceTemplate, setInvoiceTemplate] = useState(null);
  const [receiptTemplate, setReceiptTemplate] = useState(null);

  // Fetch configs on mount
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await api.get('/configuration');
        if (res.data.success) {
          const conf = res.data.data;
          setStoreConfig({
            form_url: conf.store_form_url || '',
            api_key: conf.store_api_key || '',
            origin_id: conf.store_origin_id || '',
          });
          setSalesPersona(
            conf.ai_sales_persona ||
            'PERAN: Kamu adalah AI Assistant dari [Nama Bisnis] yang ramah dan membantu calon customer.\n\nTugas:\n- Menjawab pertanyaan seputar produk\n- Mengarahkan customer untuk checkout\n\nGaya Bahasa: Santai, ramah, dan profesional.'
          );
          setCsPersona(
            conf.ai_cs_persona ||
            'PERAN: Kamu adalah Customer Service [Nama Bisnis] yang melayani pelanggan aktif.\n\nTugas:\n- Membantu pertanyaan terkait pesanan, pengiriman, dan kendala produk\n- Menangani keluhan dengan empati dan solusi cepat\n- Memastikan kepuasan pelanggan\n\nGaya bahasa: Hangat, tanggap, dan profesional.'
          );
          setAutoApprove(conf.auto_approve_modification === 'true');
          setAutoFollowUp(conf.auto_follow_up === 'true');
          setAiServiceEnabled(conf.ai_service_enabled !== 'false');
          setDpEnabled(conf.dp_enabled === 'true');
          setDpPercentage(conf.dp_percentage || '50');
          setSignDelayHours(conf.sign_delay_hours || '4');
          setAutoFollowupExpiryHours(conf.auto_followup_expiry_hours || '72');
          setExpiredDelayHours(conf.expired_delay_hours || '48');
        }
      } catch (error) {
        console.error('Error fetching configurations:', error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchConfigs();
  }, []);

  const fetchInvoiceTemplates = async () => {
    setInvoiceLoading(true);
    try {
      const [resInvoice, resReceipt] = await Promise.all([
        api.get('/travel/invoices/template/invoice').catch(() => ({ data: { status: false } })),
        api.get('/travel/invoices/template/receipt').catch(() => ({ data: { status: false } })),
      ]);
      if (resInvoice.data.status) setInvoiceTemplates(resInvoice.data.data || []);
      if (resReceipt.data.status) setReceiptTemplates(resReceipt.data.data || []);
    } catch (err) {
      console.error('Error fetching invoice templates:', err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (businessType === 'travel') {
      fetchInvoiceTemplates();
    }
  }, [businessType]);

  const handleSaveDpConfigs = async () => {
    setIsSaving(true);
    try {
      await api.post('/configuration', {
        dp_enabled: dpEnabled ? 'true' : 'false',
        dp_percentage: dpPercentage,
        sign_delay_hours: signDelayHours,
        auto_followup_expiry_hours: autoFollowupExpiryHours,
        expired_delay_hours: expiredDelayHours,
        auto_follow_up: autoFollowUp ? 'true' : 'false'
      });
      alert('Pengaturan DP & Transaksi berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAiService = async (nextValue) => {
    setAiServiceEnabled(nextValue);
    setAiSwitchSaving(true);
    try {
      await api.post('/configuration', { ai_service_enabled: nextValue ? 'true' : 'false' });
      alert(nextValue ? 'AI service diaktifkan.' : 'AI service dimatikan — AI tidak akan merespons inbox.');
    } catch (error) {
      // Revert on failure
      setAiServiceEnabled(!nextValue);
      alert('Gagal mengubah status AI service.');
    } finally {
      setAiSwitchSaving(false);
    }
  };

  const handleSetActiveTemplate = async (id) => {
    try {
      await api.put(`/travel/invoices/template/invoice/${id}/active`);
      fetchInvoiceTemplates();
    } catch (err) { alert('Gagal mengaktifkan model invoice.'); }
  };

  const handleSetActiveReceiptTemplate = async (id) => {
    try {
      await api.put(`/travel/invoices/template/receipt/${id}/active`);
      fetchInvoiceTemplates();
    } catch (err) { alert('Gagal mengaktifkan model receipt.'); }
  };

  const handleSaveInvoiceTemplate = async (templateData) => {
    try {
      const res = await api.post('/travel/invoices/template/invoice', {
        id: invoiceTemplate?.id,
        name: templateData.name,
        design_data: templateData
      });
      if (res.data.status) {
        setShowInvoiceEditor(false);
        fetchInvoiceTemplates();
        alert('Model Invoice berhasil disimpan!');
      }
    } catch (err) { alert('Gagal menyimpan model invoice.'); }
  };

  const handleSaveReceiptTemplate = async (templateData) => {
    try {
      const res = await api.post('/travel/invoices/template/receipt', {
        id: receiptTemplate?.id,
        name: templateData.name,
        design_data: templateData
      });
      if (res.data.status) {
        setShowReceiptEditor(false);
        fetchInvoiceTemplates();
        alert('Model Receipt berhasil disimpan!');
      }
    } catch (err) { alert('Gagal menyimpan model receipt.'); }
  };

  const openEditInvoice = (template) => {
    const templateData = { ...template };
    if (templateData.design_data) {
      const parsed = JSON.parse(templateData.design_data);
      templateData.items = parsed.items || [];
      templateData.canvasColor = parsed.canvasColor || '#ffffff';
    }
    setInvoiceTemplate(templateData);
    setShowInvoiceEditor(true);
  };

  const openEditReceipt = (template) => {
    const templateData = { ...template };
    if (templateData.design_data) {
      const parsed = JSON.parse(templateData.design_data);
      templateData.items = parsed.items || [];
      templateData.canvasColor = parsed.canvasColor || '#ffffff';
    }
    setReceiptTemplate(templateData);
    setShowReceiptEditor(true);
  };

  // Handlers
  const handleSaveStoreConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/configuration', {
        store_form_url: storeConfig.form_url,
        store_api_key: storeConfig.api_key,
        store_origin_id: storeConfig.origin_id,
      });
      alert('Store configuration saved!');
    } catch (error) {
      console.error('Error saving store config:', error);
      alert('Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchOrigin = () => {
    if (!searchOriginTxt.trim()) return;
    setIsSearchingOrigin(true);
    // Simulate API search
    setTimeout(() => {
      setOriginResults([
        { id: '1', name: 'Kota Bandung' },
        { id: '2', name: 'Kabupaten Bandung' },
      ]);
      setIsSearchingOrigin(false);
    }, 800);
  };

  const handleClearHistory = async () => {
    if (confirm('Confirm clear all chat history?')) {
      try {
        await api.delete('/configuration/chat-history');
        alert('Chat history cleared successfully.');
      } catch (error) {
        console.error('Error clearing chat history:', error);
        alert('Failed to clear chat history.');
      }
    }
  };

  if (isFetching) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto flex justify-center items-center h-64">
        <Icon name="Loader2" size={32} className="animate-spin text-indigo-base" />
      </div>
    );
  }

  const menuItems = [
    businessType !== 'travel' ? { id: 'store', label: 'Store Configuration', icon: 'Settings2', desc: 'Pengaturan API, URL, dan lokasi.' } : null,
    { id: 'bank', label: 'Bank Settings', icon: 'Landmark', desc: 'Kelola rekening bank pembayaran.' },
    { id: 'ai_persona', label: 'AI System Role', icon: 'Bot', desc: 'Persona AI untuk Sales & Customer Service.' },
    { id: 'ai_switch', label: 'AI Service Switch', icon: 'Power', desc: 'Aktifkan atau matikan seluruh layanan AI.' },
    { id: 'invoice', label: 'Invoice Settings', icon: 'FileText', desc: 'Pengaturan auto-approve modifikasi.' },
    businessType === 'travel' ? { id: 'dp', label: 'Transaksi & DP', icon: 'CreditCard', desc: 'Aturan down payment dan auto follow-up.' } : null,
    businessType === 'travel' ? { id: 'templates', label: 'Invoice & Receipt', icon: 'Layout', desc: 'Desain template kuitansi dan invoice.' } : null,
  ].filter(Boolean);

  return (
    <div className="p-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        {activeView !== 'list' && (
          <button
            onClick={() => setActiveView('list')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
          >
            <Icon name="ArrowLeft" size={16} />
          </button>
        )}
        <div>
          <h2 className="text-[18px] font-semibold text-gray-900 leading-tight">
            {activeView === 'list' ? 'Configuration' : menuItems.find(m => m.id === activeView)?.label || 'Settings'}
          </h2>
          {activeView === 'list' && (
            <p className="text-[12px] text-gray-400 mt-0.5">Kelola pengaturan sistem dan AI.</p>
          )}
        </div>
      </div>

      {/* ── List View ── */}
      {activeView === 'list' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {menuItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-all group ${
                idx < menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div>
                <div className="text-[13px] font-semibold text-gray-800 group-hover:text-gray-900 leading-snug">{item.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{item.desc}</div>
              </div>
              <Icon name="ChevronRight" size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 ml-4" />
            </button>
          ))}
        </div>
      )}

      {/* ── Store Configuration Card ── */}
      {activeView === 'store' && businessType !== 'travel' && (
        <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-subtle">
          <h6 className="font-display font-bold text-sm text-text-heading flex items-center gap-2">
            <Icon name="Settings2" size={16} /> Store Configuration
          </h6>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveStoreConfig} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Order Form URL</label>
              <input
                type="text"
                value={storeConfig.form_url}
                onChange={(e) => setStoreConfig({ ...storeConfig, form_url: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                placeholder="Contoh: https://pesan.toko-anda.com/checkout"
                required
              />
              <span className="block mt-1 text-[11px] text-text-muted">Link ini akan otomatis dikirimkan oleh AI kepada pelanggan ketika mereka siap memesan.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">API.CO.ID Token</label>
                <input
                  type="text"
                  value={storeConfig.api_key}
                  onChange={(e) => setStoreConfig({ ...storeConfig, api_key: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                  placeholder="Contoh: abcdef1234567890 (Token dari rajaongkir/biteship dll)"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Origin Location (ID Kota Pengiriman)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={searchOriginTxt}
                    onChange={(e) => setSearchOriginTxt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchOrigin())}
                    className="flex-1 px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                    placeholder="Search City..."
                  />
                  <button
                    type="button"
                    onClick={handleSearchOrigin}
                    className="w-10 h-10 flex-shrink-0 bg-bg-page hover:bg-bg-subtle border border-border-base rounded-xl flex items-center justify-center text-text-body transition-colors"
                  >
                    {isSearchingOrigin ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Search" size={14} />}
                  </button>
                </div>

                {originResults.length > 0 && (
                  <select
                    className="w-full mb-2 px-3.5 py-2 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none"
                    onChange={(e) => setStoreConfig({ ...storeConfig, origin_id: e.target.value })}
                    value={storeConfig.origin_id}
                  >
                    <option value="">-- Select Location --</option>
                    {originResults.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  value={storeConfig.origin_id}
                  readOnly
                  className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-gray-50 text-text-muted opacity-70"
                  placeholder="ID Kota akan terisi otomatis (Contoh: 152)"
                  required
                />
              </div>
            </div>

            <div className="text-right pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-base hover:bg-indigo-mid text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* ── Bank Settings Card ── */}
      {activeView === 'bank' && <BankSettings />}

      {/* ── AI Service Switch ── */}
      {activeView === 'ai_switch' && (
      <div className="space-y-6">
        <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
            <h6 className="font-display font-bold text-sm text-text-heading">AI Service Switch</h6>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${aiServiceEnabled ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {aiServiceEnabled ? 'AKTIF' : 'MATI'}
            </span>
          </div>
          <div className="p-5">
            <div className="mb-4 p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1">
                <Icon name="Info" size={14} /> Kontrol utama layanan AI
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Ketika <b>aktif</b>, AI bekerja normal seperti sekarang — membalas semua pesan masuk (inbox WhatsApp, Email, Instagram, dll).
                Ketika <b>mati</b>, seluruh layanan AI berhenti dan AI <b>tidak akan merespons inbox sama sekali</b>. Pesan customer tetap masuk dan tersimpan, namun tidak ada balasan otomatis dari AI.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border border-border-base rounded-xl bg-bg-page">
              <div>
                <p className="text-xs font-bold text-text-heading">Status Layanan AI</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {aiServiceEnabled ? 'AI aktif dan akan merespons inbox.' : 'AI mati — tidak ada respons inbox.'}
                </p>
              </div>
              <button
                type="button"
                disabled={aiSwitchSaving}
                onClick={() => handleToggleAiService(!aiServiceEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${aiServiceEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                aria-label="Toggle AI Service"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${aiServiceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiSwitchSaving || aiServiceEnabled}
                onClick={() => handleToggleAiService(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Aktifkan AI
              </button>
              <button
                type="button"
                disabled={aiSwitchSaving || !aiServiceEnabled}
                onClick={() => handleToggleAiService(false)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Matikan AI
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── AI System Roles ── */}
      {activeView === 'ai_persona' && (
      <div className="space-y-6">
        <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-subtle">
            <h6 className="font-display font-bold text-sm text-text-heading">AI System Role — Sales & Leads</h6>
          </div>
          <div className="p-5">
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSaving(true);
              try {
                await api.post('/configuration', { ai_sales_persona: salesPersona });
                alert('Sales persona saved!');
              } catch (error) {
                console.error('Error saving sales persona:', error);
                alert('Failed to save persona.');
              } finally {
                setIsSaving(false);
              }
            }}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-heading mb-1.5">Persona Definition <span className="text-text-muted font-normal">(Karakter dan instruksi AI saat membalas pesan ke leads/calon pembeli)</span></label>
                <textarea
                  rows={8}
                  value={salesPersona}
                  onChange={(e) => setSalesPersona(e.target.value)}
                  className="w-full px-3.5 py-3 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all resize-y"
                  placeholder="Tuliskan peran dan instruksi AI di sini..."
                  required
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-base hover:bg-indigo-mid text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Update Persona
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-border-base flex justify-between items-center flex-wrap gap-3">
              <span className="text-xs text-text-muted">Clear all chat context?</span>
              <button
                onClick={handleClearHistory}
                className="px-4 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 font-bold rounded-lg text-xs transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
            <h6 className="font-display font-bold text-sm text-text-heading">AI System Role — Customer Service</h6>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">BARU</span>
          </div>
          <div className="p-5">
            <div className="mb-4 p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 mb-1">
                <Icon name="Info" size={14} /> Prompt ini digunakan saat AI melayani customer aktif
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Berbeda dengan AI Sales (menawarkan), AI ini berfungsi untuk melayani pelanggan yang sudah menjadi customer — membantu pertanyaan pesanan, keluhan, after-sales, dll.
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSaving(true);
              try {
                await api.post('/configuration', { ai_cs_persona: csPersona });
                alert('CS persona saved!');
              } catch (error) {
                console.error('Error saving CS persona:', error);
                alert('Failed to save persona.');
              } finally {
                setIsSaving(false);
              }
            }}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-heading mb-1.5">Customer Service AI Persona</label>
                <textarea
                  rows={10}
                  value={csPersona}
                  onChange={(e) => setCsPersona(e.target.value)}
                  className="w-full px-3.5 py-3 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all resize-y"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Update Customer AI Persona
              </button>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* 🚀 Invoice Settings Card 🚀 */}
      {activeView === 'invoice' && (
      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
          <h6 className="font-display font-bold text-sm text-text-heading flex items-center gap-2">
            <Icon name="FileText" size={16} /> Invoice Settings
          </h6>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-text-heading mb-1">Auto-Approve Modifikasi Invoice</h4>
              <p className="text-xs text-text-muted leading-relaxed max-w-2xl">
                Jika diaktifkan, permintaan modifikasi invoice oleh pelanggan (seperti mengubah jumlah orang) akan disetujui secara otomatis, dan AI akan langsung membuatkan invoice baru tanpa menunggu konfirmasi dari Admin.
              </p>
            </div>
            <div>
              <button
                onClick={async () => {
                  const newVal = !autoApprove;
                  setAutoApprove(newVal);
                  try {
                    await api.post('/configuration', { auto_approve_modification: newVal ? 'true' : 'false' });
                  } catch (err) {
                    console.error('Failed to update toggle', err);
                    setAutoApprove(!newVal); // revert on failure
                    alert('Gagal menyimpan pengaturan auto-approve.');
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoApprove ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoApprove ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── TRANSACTIONS & DP SETTINGS ── */}
      {activeView === 'dp' && businessType === 'travel' && (
        <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
            <h6 className="font-display font-bold text-sm text-text-heading flex items-center gap-2">
              <Icon name="Settings" size={16} /> Pengaturan Transaksi & DP
            </h6>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="font-bold text-gray-800">Sistem DP</p>
                  <p className="text-xs text-gray-500">Aktifkan pembayaran uang muka</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={dpEnabled}
                    onChange={(e) => setDpEnabled(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col">
                <p className="font-bold text-gray-800 mb-2">Persentase DP (%)</p>
                <input type="number" className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm"
                  value={dpPercentage} disabled={!dpEnabled}
                  onChange={(e) => setDpPercentage(e.target.value)} />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="font-bold text-gray-800">Auto Follow-Up AI</p>
                  <p className="text-xs text-gray-500">AI otomatis followup invoice</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={autoFollowUp}
                    onChange={(e) => setAutoFollowUp(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col">
                <p className="font-bold text-gray-800 mb-2">Pending ke Sign (Jam)</p>
                <input type="number" className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm"
                  value={signDelayHours} onChange={(e) => setSignDelayHours(e.target.value)} />
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col">
                <p className="font-bold text-gray-800 mb-2">Sign ke 2nd Pending (Jam)</p>
                <input type="number" className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm"
                  value={autoFollowupExpiryHours} onChange={(e) => setAutoFollowupExpiryHours(e.target.value)} />
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col">
                <p className="font-bold text-gray-800 mb-2">Expired Delay (Jam)</p>
                <input type="number" className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm"
                  value={expiredDelayHours} onChange={(e) => setExpiredDelayHours(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveDpConfigs} disabled={isSaving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50">
                {isSaving ? <Icon name="Loader2" className="animate-spin" size={16} /> : <Icon name="Save" size={16} />}
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVOICE & RECEIPT TEMPLATES ── */}
      {activeView === 'templates' && businessType === 'travel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* MODEL INVOICE */}
          <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-soft flex items-center justify-center">
                  <Icon name="FileText" size={18} className="text-indigo-base" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-text-heading">Model Invoice</h3>
                  <p className="text-[11px] text-text-muted">Template aktif yang digunakan AI.</p>
                </div>
              </div>
              <button onClick={() => { setInvoiceTemplate(null); setShowInvoiceEditor(true); }}
                className="flex items-center gap-1.5 bg-indigo-base hover:bg-indigo-mid text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-sm transition-all">
                <Icon name="Plus" size={14} /> Buat Baru
              </button>
            </div>
            <div className="p-4 space-y-3">
              {invoiceLoading ? (
                <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-indigo-base" /></div>
              ) : invoiceTemplates.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">Belum ada template invoice.</div>
              ) : invoiceTemplates.map((t) => (
                <div key={t.id} className={`p-4 rounded-xl border-2 transition-all ${t.is_active ? 'border-indigo-400 bg-indigo-soft/30' : 'border-border-base bg-bg-subtle/30 hover:border-border-hover'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${t.is_active ? 'bg-indigo-base text-white' : 'bg-bg-subtle text-text-muted'}`}>
                        {t.is_active ? <Icon name="Check" size={14} /> : (invoiceTemplates.indexOf(t))}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-heading">{t.name}</p>
                        <p className="text-[11px] text-text-muted">Dibuat: {new Date(t.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    {t.is_active ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-indigo-soft text-indigo-base border border-indigo-border">AKTIF</span>
                    ) : (
                      <button onClick={() => handleSetActiveTemplate(t.id)} className="text-xs font-bold text-indigo-base hover:text-indigo-mid transition-colors">
                        Aktifkan
                      </button>
                    )}
                  </div>
                  <button onClick={() => openEditInvoice(t)}
                    className="mt-3 w-full text-xs font-bold text-indigo-base hover:text-indigo-mid flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-indigo-soft/50 transition-colors">
                    <Icon name="Pencil" size={12} /> Edit Desain
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* MODEL RECEIPT */}
          <div className="bg-bg-surface border border-border-base rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-bg-subtle flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <Icon name="Receipt" size={18} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-text-heading">Model Receipt</h3>
                  <p className="text-[11px] text-text-muted">Template kuitansi otomatis.</p>
                </div>
              </div>
              <button onClick={() => { setReceiptTemplate(null); setShowReceiptEditor(true); }}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-sm transition-all">
                <Icon name="Plus" size={14} /> Buat Baru
              </button>
            </div>
            <div className="p-4 space-y-3">
              {invoiceLoading ? (
                <div className="flex justify-center py-8"><Icon name="Loader2" size={24} className="animate-spin text-green-600" /></div>
              ) : receiptTemplates.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">Belum ada template receipt.</div>
              ) : receiptTemplates.map((t) => (
                <div key={t.id} className={`p-4 rounded-xl border-2 transition-all ${t.is_active ? 'border-green-400 bg-green-50/40' : 'border-border-base bg-bg-subtle/30 hover:border-border-hover'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${t.is_active ? 'bg-green-600 text-white' : 'bg-bg-subtle text-text-muted'}`}>
                        {t.is_active ? <Icon name="Check" size={14} /> : (receiptTemplates.indexOf(t))}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-heading">{t.name}</p>
                        <p className="text-[11px] text-text-muted">Dibuat: {new Date(t.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    {t.is_active ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-green-100 text-green-700 border border-green-200">AKTIF</span>
                    ) : (
                      <button onClick={() => handleSetActiveReceiptTemplate(t.id)} className="text-xs font-bold text-green-600 hover:text-green-700 transition-colors">
                        Aktifkan
                      </button>
                    )}
                  </div>
                  <button onClick={() => openEditReceipt(t)}
                    className="mt-3 w-full text-xs font-bold text-green-600 hover:text-green-700 flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-green-50 transition-colors">
                    <Icon name="Pencil" size={12} /> Edit Desain
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INVOICE EDITOR MODAL ── */}
      {showInvoiceEditor && (
        <InvoiceTemplateEditor
          template={invoiceTemplate}
          onSave={handleSaveInvoiceTemplate}
          onClose={() => setShowInvoiceEditor(false)}
        />
      )}

      {/* ── RECEIPT EDITOR MODAL ── */}
      {showReceiptEditor && (
        <ReceiptTemplateEditor
          template={receiptTemplate}
          onSave={handleSaveReceiptTemplate}
          onClose={() => setShowReceiptEditor(false)}
        />
      )}

    </div>
  );
};

export default Configuration;
