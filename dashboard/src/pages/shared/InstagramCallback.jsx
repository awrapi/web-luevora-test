import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const InstagramCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Sedang memproses autentikasi Instagram...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Gagal menghubungkan Instagram: ${searchParams.get('error_description') || error}`);
      setTimeout(() => navigate('/connect-platform'), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Kode autentikasi tidak ditemukan. Silakan coba lagi.');
      setTimeout(() => navigate('/connect-platform'), 3000);
      return;
    }

    // Tukar kode dengan access token di backend
    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/instagram-callback`;
        const state = searchParams.get('state');
        // Jika state=fb_instagram, gunakan endpoint Facebook OAuth (Page token untuk DM webhook)
        const endpoint = state === 'fb_instagram'
          ? '/instagram/oauth/exchange-fb'
          : '/instagram/oauth/exchange-ig';
        const res = await api.post(endpoint, { code, redirectUri });
        
        if (res.data.success) {
          setStatus('success');
          setMessage('Instagram berhasil terhubung!');
        } else {
          setStatus('error');
          setMessage(res.data.message || 'Gagal menyimpan konfigurasi.');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage(err.response?.data?.message || 'Terjadi kesalahan saat menghubungi server.');
      } finally {
        setTimeout(() => navigate('/connect-platform'), 2000);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-surface p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
        {status === 'processing' && (
          <>
            <Icon name="Loader2" size={48} className="animate-spin text-indigo-base mb-4" />
            <h2 className="text-xl font-bold text-text-heading mb-2">Memproses...</h2>
            <p className="text-sm text-text-muted">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="CheckCircle2" size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-text-heading mb-2">Berhasil!</h2>
            <p className="text-sm text-text-muted">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="XCircle" size={32} className="text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-text-heading mb-2">Gagal</h2>
            <p className="text-sm text-text-muted">{message}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default InstagramCallback;
