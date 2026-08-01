import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const BUSINESS_TYPES = [
  { value: 'clinic', label: 'Clinic & Healthcare', icon: 'Heart', description: 'Clinics, hospitals, wellness centers, labs' },
  { value: 'rental', label: 'Rental & Leasing', icon: 'Car', description: 'Vehicles, gear, tools, property' },
  { value: 'travel', label: 'Travel & Tourism', icon: 'Plane', description: 'Travel agencies, operators, tour guides' },
  { value: 'course', label: 'Courses & Education', icon: 'GraduationCap', description: 'Tuitions, courses, bootcamps, training' },
  { value: 'retail', label: 'Online Product / Retail', icon: 'ShoppingBag', description: 'E-commerce, shops, product sales' },
];

const STEPS = [
  { number: 1, title: 'Owner Details' },
  { number: 2, title: 'Business Info' },
  { number: 3, title: 'Security' },
];

const Register = () => {
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!email.trim() || !username.trim() || !ownerName.trim()) {
        setError('Email, Username, and Owner Name are required');
        return;
      }
      if (username.length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Invalid email address format');
        return;
      }
    }
    if (step === 2) {
      if (!businessType) {
        setError('Please select your business type');
        return;
      }
      if (!businessName.trim()) {
        setError('Business Name is required');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/register', {
        businessName,
        businessType,
        businessDescription,
        ownerName,
        username,
        email,
        password,
        phone: phone || undefined,
      });

      if (res.data.status) {
        if (res.data.requires_verification) {
          setIsSuccess(true);
        } else {
          const loginResult = await login({ email, password });
          if (loginResult.success) {
            navigate('/dashboard');
          }
        }
      } else {
        setError(res.data.message || 'Registration failed');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to connect to server';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    if (otp.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      if (res.data.status) {
        const loginResult = await login({ email, password });
        if (loginResult.success) {
          navigate('/dashboard');
        } else {
          navigate('/login');
        }
      } else {
        setError(res.data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
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
        className="relative z-10 w-full max-w-[1020px] bg-white rounded-[32px] border border-white/50 shadow-2xl shadow-purple-950/60 overflow-hidden flex flex-col md:flex-row my-auto"
        style={{ minHeight: '620px' }}
      >
        
        {/* ── LEFT COLUMN: Clean Empty Photo/Illustration Placeholder Box ── */}
        <div className="hidden md:flex w-1/2 p-4 bg-[#f8fafc] border-r border-slate-200">
          <div
            className="w-full h-full rounded-[24px] bg-[#f1f5f9] border border-[#cbd5e1] flex items-center justify-center relative overflow-hidden"
          >
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)',
              backgroundSize: '20px 20px',
              pointerEvents: 'none', opacity: 0.4,
            }} />
          </div>
        </div>

        {/* ── RIGHT COLUMN: Clean Register Form Container ── */}
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8 sm:p-12 relative overflow-y-auto">
          <div className="w-full max-w-[440px] mx-auto py-4">
            {isSuccess ? (
              <div className="text-center animate-fadeIn py-4 font-['Satoshi']">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm shadow-indigo-100">
                  <Icon name="MailCheck" size={32} className="text-[#4f46e5]" strokeWidth={2} />
                </div>
                <h2 className="font-display font-black text-2xl text-slate-900 tracking-tight mb-2">
                  Email Verification
                </h2>
                <p className="text-slate-500 text-xs mb-6 leading-relaxed max-w-sm mx-auto">
                  We have sent a 6-digit verification code to <strong className="text-slate-700">{email}</strong>. 
                  Enter the code below to verify your account.
                </p>

                {error && (
                  <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 text-left animate-shake">
                    <Icon name="AlertCircle" size={16} className="text-rose-500 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-2">
                    <div className="relative max-w-[200px] mx-auto">
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                        autoFocus
                        className="w-full text-center tracking-[0.8em] font-bold text-xl py-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                        placeholder="------"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="w-full max-w-[250px] mx-auto bg-[#18181b] hover:bg-[#09090b] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Icon name="Loader2" size={18} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Code</span>
                        <Icon name="CheckCircle2" size={18} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-6 font-['Satoshi']">
                  <div className="inline-flex items-center justify-center w-14 h-14 mb-4">
                    <img src="/assets/logo.png" alt="Luevora Logo" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 font-['Satoshi']">
                    Get Started with Luevora AI
                  </h1>
                  <p className="text-slate-500 text-xs font-semibold tracking-wide">Deploy your 24/7 AI frontliner in minutes</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-0 mb-8 font-['Satoshi']">
                  {STEPS.map((s, i) => (
                    <div key={s.number} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                          step > s.number 
                            ? 'bg-[#4f46e5] text-[#ffffff] shadow-sm' 
                            : step === s.number 
                              ? 'bg-[#4f46e5] text-[#ffffff] ring-4 ring-indigo-100/60 shadow-sm' 
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          {step > s.number ? <Icon name="Check" size={14} strokeWidth={3} /> : s.number}
                        </div>
                        <span className={`text-[9px] uppercase tracking-wider mt-2 font-bold transition-colors duration-300 ${
                          step >= s.number ? 'text-[#4f46e5]' : 'text-slate-400'
                        }`}>{s.title}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`w-14 sm:w-18 h-[2.5px] mx-2 mb-5 transition-colors duration-300 rounded-full ${
                          step > s.number ? 'bg-[#4f46e5]' : 'bg-slate-100'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-3 animate-shake font-['Satoshi']">
                    <Icon name="AlertCircle" size={16} className="text-rose-500 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Step 1: Owner Details */}
                {step === 1 && (
                  <div className="animate-fadeIn font-['Satoshi']">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="regEmail" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Email Address *</label>
                        <div className="relative group">
                          <Icon name="Mail" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="regEmail"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="owner@yourcompany.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="regUsername" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Username *</label>
                        <div className="relative group">
                          <Icon name="AtSign" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="regUsername"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            required
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="e.g. johndoe"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ownerName" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Owner Full Name *</label>
                        <div className="relative group">
                          <Icon name="User" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="ownerName"
                            type="text"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="Your full name"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full bg-[#18181b] hover:bg-[#09090b] text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      <span>Continue</span>
                      <Icon name="ArrowRight" size={18} />
                    </button>
                  </div>
                )}

                {/* Step 2: Business Info */}
                {step === 2 && (
                  <div className="animate-fadeIn font-['Satoshi']">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="businessType" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Business Type *</label>
                        <div className="relative group">
                          <Icon name="Briefcase" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                          <select
                            id="businessType"
                            value={businessType}
                            onChange={(e) => setBusinessType(e.target.value)}
                            required
                            className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all appearance-none cursor-pointer"
                          >
                            <option value="" disabled>Select Business Type</option>
                            {BUSINESS_TYPES.map(bt => (
                              <option key={bt.value} value={bt.value}>{bt.label}</option>
                            ))}
                          </select>
                          <Icon name="ChevronDown" size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="businessName" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Business Name *</label>
                        <div className="relative group">
                          <Icon name="Building2" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="businessName"
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="e.g. Apex Travel & Tours"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="businessDescription" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">About the Business <span className="text-slate-400/60">(Optional)</span></label>
                        <div className="relative">
                          <textarea
                            id="businessDescription"
                            value={businessDescription}
                            onChange={(e) => setBusinessDescription(e.target.value)}
                            className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all resize-none h-24 duration-200"
                            placeholder="Briefly describe your business, services, or target audience..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <Icon name="ArrowLeft" size={18} />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="flex-[2] bg-[#18181b] hover:bg-[#09090b] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <span>Continue</span>
                        <Icon name="ArrowRight" size={18} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Security & Contact */}
                {step === 3 && (
                  <form onSubmit={handleSubmit} className="animate-fadeIn font-['Satoshi']">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="phone" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Phone Number <span className="text-slate-400/60">(Optional)</span></label>
                        <div className="relative group">
                          <Icon name="Phone" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="regPassword" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Password *</label>
                        <div className="relative group">
                          <Icon name="Lock" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="regPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="At least 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4f46e5] transition-colors cursor-pointer"
                          >
                            <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="block text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Confirm Password *</label>
                        <div className="relative group">
                          <Icon name="ShieldCheck" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4f46e5] transition-colors" />
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all duration-200"
                            placeholder="Confirm your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4f46e5] transition-colors cursor-pointer"
                          >
                            <Icon name={showConfirmPassword ? 'EyeOff' : 'Eye'} size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <Icon name="ArrowLeft" size={18} />
                        <span>Back</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-[2] bg-[#18181b] hover:bg-[#09090b] text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer text-sm"
                      >
                        {isLoading ? (
                          <>
                            <Icon name="Loader2" size={18} className="animate-spin" />
                            <span>Registering...</span>
                          </>
                        ) : (
                          <>
                            <span>Register Now</span>
                            <Icon name="CheckCircle" size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Footer Links */}
                <div className="mt-8 text-center font-['Satoshi']">
                  <p className="text-sm text-slate-500 font-medium">
                    Already have an account?{' '}
                    <Link to="/login" className="text-[#4f46e5] font-bold hover:underline">
                      Sign In here
                    </Link>
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center font-['Satoshi']">
                  <p className="text-xs text-slate-400 font-medium">
                    &copy; 2026 Luevora AI. All rights reserved.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
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

export default Register;
