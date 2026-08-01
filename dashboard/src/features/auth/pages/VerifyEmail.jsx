import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${token}`);
        if (res.data.status) {
          setStatus('success');
          setMessage(res.data.message);
        } else {
          setStatus('error');
          setMessage(res.data.message || 'Gagal memverifikasi email.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || err.message || 'Gagal terhubung ke server');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-indigo-soft rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-96 h-96 bg-purple-soft rounded-full blur-3xl opacity-50"></div>

      <div className="relative z-10 w-full max-w-[440px] bg-bg-surface border border-border-base p-8 sm:p-10 rounded-2xl shadow-lg text-center">
        {status === 'loading' && (
          <div className="animate-fadeIn">
            <Icon name="Loader2" size={48} className="animate-spin text-indigo-base mx-auto mb-6" />
            <h2 className="font-display font-black text-2xl text-indigo-base tracking-tighter mb-2">Memverifikasi...</h2>
            <p className="text-text-muted text-sm">Harap tunggu sebentar selagi kami memverifikasi email Anda.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-fadeIn">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="CheckCircle" size={40} className="text-green-500" strokeWidth={2.5} />
            </div>
            <h2 className="font-display font-black text-2xl text-indigo-base tracking-tighter mb-3">Email Berhasil Diverifikasi!</h2>
            <p className="text-text-muted text-sm mb-8 leading-relaxed">
              {message}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-indigo-base hover:bg-indigo-mid text-white font-black py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              Lanjut ke Login
              <Icon name="ArrowRight" size={18} />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fadeIn">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="XCircle" size={40} className="text-red-500" strokeWidth={2.5} />
            </div>
            <h2 className="font-display font-black text-2xl text-red-600 tracking-tighter mb-3">Verifikasi Gagal</h2>
            <p className="text-text-muted text-sm mb-8 leading-relaxed">
              {message}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-bg-subtle hover:bg-gray-200 text-gray-700 font-black py-3.5 rounded-xl transition-all active:scale-[0.98]"
            >
              <Icon name="ArrowLeft" size={18} />
              Kembali ke Login
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default VerifyEmail;
