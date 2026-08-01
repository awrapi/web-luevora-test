import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/shared/Icon';

/**
 * Login page - Luevora AI
 * Floating Card / Modal Layout with heavily blurred purple background landscape.
 */
const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const result = await login({ email: usernameOrEmail, password });
    
    setIsLoading(false);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Invalid username or password');
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{ fontFamily: "'Satoshi', sans-serif" }}
    >
      {/* ── HEAVILY BLURRED BACKGROUND IMAGE ── */}
      <div
        style={{
          position: 'absolute',
          inset: '-24px',
          backgroundImage: "url('/assets/login-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(24px) brightness(0.85)',
          transform: 'scale(1.05)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Subtle Dark Vignette Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.25)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* ── FLOATING CARD CONTAINER (100% Sharp & Crisp) ─────────────────── */}
      <div
        className="relative z-10 w-full max-w-[960px] bg-white rounded-[32px] border border-white/50 shadow-2xl shadow-purple-950/60 overflow-hidden flex flex-col md:flex-row my-auto"
        style={{ minHeight: '580px' }}
      >
        
        {/* ── LEFT COLUMN: Clean Empty Photo/Illustration Placeholder Box ── */}
        <div className="hidden md:flex w-1/2 p-4 bg-[#f8fafc] border-r border-slate-200">
          <div
            className="w-full h-full rounded-[24px] bg-[#f1f5f9] border border-[#cbd5e1] flex items-center justify-center relative overflow-hidden"
          >
            {/* Inner subtle grid */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)',
              backgroundSize: '20px 20px',
              pointerEvents: 'none', opacity: 0.4,
            }} />
          </div>
        </div>

        {/* ── RIGHT COLUMN: Clean Login Form Container ── */}
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8 sm:p-12 relative">
          <div className="w-full max-w-[380px] mx-auto">
            
            {/* Brand Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 mb-4">
                <img src="/assets/logo.png" alt="Luevora Logo" className="w-full h-full object-contain" />
              </div>
              
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 font-['Satoshi']">
                Luevora AI
              </h1>
              <p className="text-slate-500 text-sm font-medium font-['Satoshi']">
                Sign in to access your frontliner dashboard
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-3 animate-shake font-['Satoshi']">
                <Icon name="AlertCircle" size={16} className="text-rose-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 font-['Satoshi']">
              {/* Username/Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  Username or Email
                </label>
                <div className="relative group">
                  <Icon name="User" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                  <input 
                    id="email" 
                    type="text" 
                    value={usernameOrEmail} 
                    onChange={(e) => setUsernameOrEmail(e.target.value)} 
                    required 
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                    placeholder="Enter your username or email"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  Password
                </label>
                <div className="relative group">
                  <Icon name="Lock" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                  <input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#18181b] hover:bg-[#09090b] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                {isLoading ? (
                  <>
                    <Icon name="Loader2" size={18} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <Icon name="ArrowRight" size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-8 text-center font-['Satoshi']">
              <p className="text-sm text-slate-500 font-medium">
                Don't have an account?{' '}
                <Link to="/register" className="text-[#4f46e5] font-bold hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center font-['Satoshi']">
              <p className="text-xs text-slate-400 font-medium">
                &copy; 2026 Luevora AI. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
