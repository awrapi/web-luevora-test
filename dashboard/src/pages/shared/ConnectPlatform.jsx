import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { PLATFORMS } from '@/lib/config/platforms';
import api from '@/services/api';

const ConnectPlatform = () => {
  const [statuses, setStatuses] = useState({});
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/configuration');
      const emailRes = await api.get('/email/config').catch(() => ({ data: null }));
      const telegramRes = await api.get('/telegram/config').catch(() => ({ data: { data: null } }));
      
      if (res.data.success) {
        const mergedData = { 
          ...res.data.data, 
          emailConfig: emailRes.data || {},
          telegramConfig: telegramRes.data?.data || {}
        };
        setFormData(mergedData);
        
        setStatuses(prev => ({
          ...prev,
          meta: {
            checking: false,
            connected: !!res.data.data.zernio_whatsapp_account_id,
            label: res.data.data.zernio_whatsapp_account_id
              ? 'Connected'
              : 'Not Connected'
          },
          telegram: {
            checking: false,
            connected: !!(telegramRes.data?.data?.bot_token && telegramRes.data?.data?.is_active),
            label: telegramRes.data?.data?.bot_token 
              ? (telegramRes.data?.data?.is_active ? 'Connected' : 'Token Tersimpan (Nonaktif)')
              : 'Not Connected'
          },
          email: {
            checking: false,
            connected: !!emailRes.data?.email_address,
            label: emailRes.data?.email_address ? 'Connected' : 'Not Connected'
          },
          instagram: {
            checking: false,
            connected: !!res.data.data.zernio_instagram_account_id,
            label: res.data.data.zernio_instagram_account_id ? 'Connected' : 'Not Connected'
          }
        }));
      }
    } catch (err) {
      console.error(err);
      // Jika gagal fetch (misal backend mati), jangan biarkan stuck di "Mengecek..."
      setStatuses(prev => {
        const newStatuses = { ...prev };
        Object.keys(newStatuses).forEach(key => {
          newStatuses[key] = { checking: false, connected: false, label: 'Error (Offline)' };
        });
        return newStatuses;
      });
    }
  };

  const checkAllStatuses = useCallback(() => {
    const initial = {};
    PLATFORMS.forEach((p) => {
      if (p.available) {
        initial[p.id] = { checking: true, connected: false, label: 'Mengecek...' };
      }
    });
    setStatuses(initial);
    fetchConfig();
  }, []);

  useEffect(() => { 
    checkAllStatuses(); 
  }, [checkAllStatuses]);

  const handleConnect = async (platformId) => {
    if (platformId === 'meta' || platformId === 'email' || platformId === 'telegram' || platformId === 'instagram') {
      setActiveModal(platformId);
    } else {
      alert(`Integrasi ${platformId} akan segera tersedia.`);
    }
  };


  const handleZernioOAuth = async (platform) => {
    setIsSaving(true);
    try {
      localStorage.setItem('zernio_connect_platform', platform);
      const redirectUrl = `${window.location.origin}/zernio-callback`;
      const res = await api.post('/zernio/connect-url', { platform, redirectUrl });
      if (res.data.success && res.data.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      alert(err.response?.data?.message || `Gagal memulai koneksi ${platform} via Zernio.`);
    } finally {
      setIsSaving(false);
    }
  };


  const handleDisconnectMeta = async () => {
    if (!confirm('Yakin ingin memutus koneksi WhatsApp (Zernio)?')) return;
    setIsSaving(true);
    try {
      const payload = { zernio_whatsapp_account_id: '' };
      await api.post('/configuration', payload);
      alert('Koneksi WhatsApp berhasil diputus.');
      setActiveModal(null);
      checkAllStatuses();
    } catch (err) {
      alert('Gagal memutus koneksi WhatsApp.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!confirm('Yakin ingin memutus koneksi Instagram (Zernio)?')) return;
    setIsSaving(true);
    try {
      const payload = { zernio_instagram_account_id: '' };
      await api.post('/configuration', payload);
      alert('Koneksi Instagram berhasil diputus.');
      setActiveModal(null);
      checkAllStatuses();
    } catch (err) {
      alert('Gagal memutus koneksi Instagram.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!confirm('Yakin ingin memutus koneksi Telegram Bot?')) return;
    setIsSaving(true);
    try {
      await api.post('/telegram/config', { bot_token: '', bot_username: '', is_active: 0 });
      alert('Koneksi Telegram berhasil diputus.');
      setActiveModal(null);
      checkAllStatuses();
    } catch (err) {
      alert('Gagal memutus koneksi Telegram.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeModal === 'email') {
        const emailPayload = formData.emailConfig || {};
        await api.post('/email/config', emailPayload);
        alert('Konfigurasi Email berhasil disimpan!');
        setActiveModal(null);
        checkAllStatuses();
        setIsSaving(false);
        return;
      }

      if (activeModal === 'telegram') {
        const tgPayload = formData.telegramConfig || {};
        await api.post('/telegram/config', tgPayload);
        alert('Konfigurasi Telegram berhasil disimpan!');
        setActiveModal(null);
        checkAllStatuses();
        setIsSaving(false);
        return;
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan konfigurasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!confirm('Yakin ingin memutus koneksi Email?')) return;
    setIsSaving(true);
    try {
      await api.delete('/email/config');
      alert('Koneksi Email berhasil diputus.');
      setActiveModal(null);
      checkAllStatuses();
    } catch (err) {
      alert('Gagal memutus koneksi Email.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-text-heading mb-1">Connect Platform</h2>
        <p className="text-text-muted text-sm">Hubungkan channel messaging untuk menerima dan membalas pesan pelanggan secara otomatis.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((p) => {
          const status = statuses[p.id];
          const isConnected = status?.connected;
          const isChecking = status?.checking;

          return (
            <div
              key={p.id}
              className={`bg-bg-surface border-2 rounded-2xl shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-sm ${
                isConnected ? 'border-green-300' : p.available ? `${p.borderColor} hover:border-indigo-border` : 'border-border-base opacity-65'
              }`}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${p.iconBg} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                    {p.brandIcon ? (
                      <img src={p.brandIcon} alt={p.title} className="w-5 h-5 object-contain" />
                    ) : (
                      <Icon name={p.icon} size={18} className="text-white" strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-text-heading leading-tight">{p.title}</div>
                    <div className="text-[10px] text-text-muted">{p.subtitle}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.chips.map((chip, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-subtle border border-border-base text-[10px] font-semibold text-text-body">
                      {chip.icon && <Icon name={chip.icon} size={10} strokeWidth={2.5} />}
                      {chip.label}
                      {chip.dotColor && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotColor}`} />}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-text-muted leading-relaxed line-clamp-4">{p.description}</p>
              </div>

              <div className="mt-auto px-4 pb-4 pt-2 flex items-center gap-2 flex-wrap">
                {p.available ? (
                  <>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      isChecking ? 'bg-bg-subtle text-text-muted border-border-base' : isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-500 border-red-200'
                    }`}>
                      {isChecking ? <><Icon name="Loader2" size={10} className="animate-spin" /> Mengecek...</> : isConnected ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected</> : <><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Offline</>}
                    </div>

                    <button onClick={() => handleConnect(p.id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-base hover:bg-indigo-mid text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-sm">
                      <Icon name="Plug" size={11} strokeWidth={2.5} />
                      Connect / Manage
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      <Icon name="Code" size={10} strokeWidth={2.5} /> On Development
                    </div>
                    <button disabled className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-text-muted rounded-lg text-[10px] font-bold border border-border-base cursor-not-allowed">
                      <Icon name="Clock" size={11} strokeWidth={2.5} /> Coming Soon
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-base">
              <h3 className="font-display font-bold text-lg text-text-heading">
                {activeModal === 'email' ? 'Pengaturan IMAP & SMTP' :
                 activeModal === 'meta' ? 'Integrasi WhatsApp Business' :
                 activeModal === 'instagram' ? 'Integrasi Instagram Graph API' :
                 'Konfigurasi Telegram Bot'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-text-muted hover:text-text-body rounded-full hover:bg-bg-subtle transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveConfig} className="p-6 flex flex-col gap-5">
              {activeModal === 'meta' && (
                <div className="flex flex-col gap-4">
                  {statuses.meta?.connected ? (
                    <div className="flex flex-col items-center justify-center text-center py-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <Icon name="CheckCircle2" size={32} className="text-green-600" />
                      </div>
                      <h4 className="font-bold text-lg text-text-heading mb-1">WhatsApp (Zernio) Terkoneksi</h4>
                      <p className="text-sm text-text-muted mb-5">Akun produksi WhatsApp Business aktif.</p>
                      <button type="button" onClick={handleDisconnectMeta} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors">
                        Putuskan Koneksi
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-4">
                      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <Icon name="MessageCircle" size={32} className="text-green-600" />
                      </div>
                      <h4 className="font-bold text-lg text-text-heading mb-2">Hubungkan WhatsApp Business</h4>
                      <p className="text-sm text-text-muted mb-6 px-4">
                        Masuk menggunakan akun Facebook Anda. Pastikan akun Facebook Anda <strong>wajib memiliki Halaman Bisnis (Facebook Page)</strong> dan nomor WhatsApp Anda terdaftar sebagai <strong>WhatsApp Business</strong>.
                      </p>
                      <button type="button" onClick={() => handleZernioOAuth('whatsapp')} disabled={isSaving} className="px-6 py-3 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Icon name="Facebook" size={20} /> Lanjutkan dengan Facebook
                      </button>
                    </div>
                  )}
                </div>
              )}



              {activeModal === 'instagram' && (
                statuses.instagram?.connected ? (
                  <div className="flex flex-col items-center justify-center text-center py-6">
                    <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                      <Icon name="CheckCircle2" size={32} className="text-pink-600" />
                    </div>
                    <h4 className="font-bold text-lg text-text-heading mb-2">Instagram Terkoneksi</h4>
                    <button type="button" onClick={handleDisconnectInstagram} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors">
                      Putuskan Koneksi
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-4">
                    <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-4">
                      <Icon name="Instagram" size={32} className="text-pink-600" />
                    </div>
                    <h4 className="font-bold text-lg text-text-heading mb-2">Hubungkan Instagram</h4>
                    <p className="text-sm text-text-muted mb-6 px-4">
                      Masuk menggunakan akun Facebook / Instagram Anda. Akun Instagram Anda <strong>wajib berupa akun Instagram Bisnis (Business Account)</strong> yang telah terhubung ke Halaman Bisnis Facebook Anda.
                    </p>
                    
                    <button type="button" onClick={() => handleZernioOAuth('instagram')} disabled={isSaving} className="px-6 py-3 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Icon name="Instagram" size={20} /> Lanjutkan dengan Instagram
                    </button>
                  </div>
                )
              )}

              {activeModal === 'telegram' && (
                statuses.telegram?.connected ? (
                  <div className="flex flex-col items-center justify-center text-center py-6">
                    <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                      <Icon name="CheckCircle2" size={32} className="text-sky-600" />
                    </div>
                    <h4 className="font-bold text-lg text-text-heading mb-2">Telegram Bot Terkoneksi</h4>
                    <button type="button" onClick={handleDisconnectTelegram} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors">
                      Putuskan Koneksi
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-text-heading mb-1.5">Bot Token</label>
                      <input 
                        type="password" required value={formData.telegramConfig?.bot_token || ''} 
                        onChange={(e) => setFormData({...formData, telegramConfig: {...formData.telegramConfig, bot_token: e.target.value}})} 
                        className="w-full px-4 py-2.5 rounded-xl border border-border-base bg-bg-subtle text-sm" placeholder="123456789:AAH..." />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-text-heading mb-1.5">Bot Username</label>
                      <input 
                        type="text" value={formData.telegramConfig?.bot_username || ''} 
                        onChange={(e) => setFormData({...formData, telegramConfig: {...formData.telegramConfig, bot_username: e.target.value}})} 
                        className="w-full px-4 py-2.5 rounded-xl border border-border-base bg-bg-subtle text-sm" placeholder="@MyBot" />
                    </div>
                    <div className="flex items-center mt-2">
                      <input type="checkbox" id="tgActive" className="mr-2" checked={formData.telegramConfig?.is_active === 1 || formData.telegramConfig?.is_active === true} onChange={(e) => setFormData({...formData, telegramConfig: {...formData.telegramConfig, is_active: e.target.checked ? 1 : 0}})} />
                      <label htmlFor="tgActive" className="text-sm font-bold text-text-heading">Aktifkan Bot</label>
                    </div>
                  </>
                )
              )}

              {activeModal === 'email' && (
                statuses.email?.connected ? (
                  <div className="flex flex-col items-center justify-center text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <Icon name="CheckCircle2" size={32} className="text-green-600" />
                    </div>
                    <h4 className="font-bold text-lg text-text-heading mb-2">Email Berhasil Terkoneksi</h4>
                    <button type="button" onClick={handleDisconnectEmail} className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors">
                      Putuskan Koneksi
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl border border-blue-200 leading-relaxed mb-2">
                      <p className="font-bold mb-1 flex items-center gap-1.5"><Icon name="Info" size={14} /> Panduan Koneksi Email</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Jika menggunakan <strong>Zoho / Google Workspace / Titan</strong> dll dengan pengamanan (2FA), <strong>JANGAN</strong> gunakan password login utama Anda. Anda harus membuat <strong>App Password (Sandi Aplikasi)</strong> di pengaturan keamanan email Anda dan menempelkannya di bawah ini.</li>
                        <li>Pastikan fitur <strong>Akses IMAP</strong> telah diaktifkan pada menu Settings/Pengaturan di akun Email Anda agar sistem dapat membaca pesan.</li>
                      </ul>
                    </div>
                    <div><label className="block text-sm font-bold text-text-heading mb-1.5">Email</label><input type="email" required className="w-full px-4 py-2.5 rounded-xl border border-border-base bg-bg-subtle text-sm" value={formData.emailConfig?.email_address || ''} onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, email_address: e.target.value}})} /></div>
                    <div><label className="block text-sm font-bold text-text-heading mb-1.5">Password / App Password</label><input type="password" required className="w-full px-4 py-2.5 rounded-xl border border-border-base bg-bg-subtle text-sm" onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, email_password: e.target.value}})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm">IMAP Host</label><input type="text" required className="w-full px-4 py-2 border rounded-md" value={formData.emailConfig?.imap_host || ''} onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, imap_host: e.target.value}})} /></div>
                      <div><label className="block text-sm">IMAP Port</label><input type="number" required className="w-full px-4 py-2 border rounded-md" value={formData.emailConfig?.imap_port || 993} onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, imap_port: parseInt(e.target.value)}})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm">SMTP Host</label><input type="text" required className="w-full px-4 py-2 border rounded-md" value={formData.emailConfig?.smtp_host || ''} onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, smtp_host: e.target.value}})} /></div>
                      <div><label className="block text-sm">SMTP Port</label><input type="number" required className="w-full px-4 py-2 border rounded-md" value={formData.emailConfig?.smtp_port || 465} onChange={e => setFormData({...formData, emailConfig: {...formData.emailConfig, smtp_port: parseInt(e.target.value)}})} /></div>
                    </div>
                  </>
                )
              )}

              <div className="flex items-center justify-between mt-2">
                <div></div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setActiveModal(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-text-muted hover:text-text-body hover:bg-bg-subtle transition-colors">Batal</button>
                  {activeModal !== 'meta' && activeModal !== 'instagram' && !(activeModal === 'telegram' && statuses.telegram?.connected) && !(activeModal === 'email' && statuses.email?.connected) && (
                    <button type="submit" disabled={isSaving} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-base text-white hover:bg-indigo-mid disabled:opacity-50 transition-all shadow-sm flex items-center gap-2">
                      {isSaving ? <><Icon name="Loader2" size={16} className="animate-spin" /> Menyimpan...</> : 'Simpan & Connect'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectPlatform;
