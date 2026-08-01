import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

/**
 * ZernioCallback — halaman yang menerima redirect dari Zernio setelah OAuth.
 * 
 * Setelah OAuth selesai, Zernio me-redirect ke:
 *   /zernio-callback?connected={platform}&profileId=X&accountId=Y&username=Z
 * 
 * Halaman ini membaca query params tersebut dan mengirimnya ke backend
 * untuk menyimpan accountId ke database tenant.
 */
const ZernioCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Sedang memproses autentikasi Zernio...');

  useEffect(() => {
    const error = searchParams.get('error') || searchParams.get('error_description');
    if (error) {
      setStatus('error');
      setMessage(`Gagal menghubungkan akun: ${error}`);
      setTimeout(() => navigate('/connect-platform'), 3000);
      return;
    }

    const verifyConnection = async () => {
      try {
        // Ambil data dari query params yang dikirim Zernio
        const connectedPlatform = searchParams.get('connected');
        const accountId = searchParams.get('accountId');
        
        // Fallback ke localStorage jika Zernio tidak mengirim platform di query
        const platform = connectedPlatform 
          || localStorage.getItem('zernio_connect_platform') 
          || 'whatsapp';
        
        // Kirim accountId langsung ke backend — tidak perlu listAccounts lagi
        const res = await api.post('/zernio/callback', { 
          platform, 
          accountId: accountId || undefined 
        });
        
        if (res.data.success) {
          setStatus('success');
          setMessage(`Akun ${platform} berhasil terhubung via Zernio!`);
        } else {
          setStatus('error');
          setMessage(res.data.message || 'Gagal memverifikasi akun.');
        }
      } catch (err) {
        console.error('[ZernioCallback]', err);
        setStatus('error');
        setMessage(err.response?.data?.message || 'Terjadi kesalahan saat menghubungi server.');
      } finally {
        localStorage.removeItem('zernio_connect_platform');
        setTimeout(() => navigate('/connect-platform'), 2000);
      }
    };

    verifyConnection();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-surface p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center flex flex-col items-center">
        {status === 'processing' && (
          <>
            <Icon name="Loader2" size={48} className="animate-spin text-[#10a37f] mb-4" />
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

export default ZernioCallback;
