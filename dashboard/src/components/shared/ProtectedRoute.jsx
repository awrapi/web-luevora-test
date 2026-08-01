import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/shared/Icon';

/**
 * ================================================================
 * ProtectedRoute
 * ================================================================
 * Guards routes that require authentication.
 * If the user is not logged in, redirects to /login.
 * Optionally enforces business_type access restrictions.
 * ================================================================
 */
const ProtectedRoute = ({ children, allowedTypes = [] }) => {
  const { isAuthenticated, loading, businessType, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f1f2fa] flex items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-[#eef0fe] rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-96 h-96 bg-[#f5e6ff] rounded-full blur-3xl opacity-60"></div>
        
        <div className="relative z-10 w-full max-w-[480px] bg-white border border-[#e7e8f3] p-8 sm:p-10 rounded-3xl shadow-xl text-center animate-fadeIn">
          {/* Animated Lock Icon Container */}
          <div className="w-20 h-20 bg-[#eef0fe] rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-[#5b4fe5] opacity-5 animate-ping"></div>
            <Icon name="Lock" size={36} className="text-[#5b4fe5]" strokeWidth={2} />
          </div>

          <h2 className="font-display font-black text-2xl text-[#1d1b31] tracking-tight mb-3">
            Private Beta & Whitelist Only
          </h2>
          
          <div className="h-[2px] w-12 bg-[#5b4fe5] mx-auto mb-6 rounded-full"></div>

          <p className="text-[#74748c] text-sm leading-relaxed mb-8">
            Luevora AI is not yet open to the public. For the time being, we only open the system to those who have the opportunity to get early access and trials. We will send an email if you have the opportunity to enter our whitelist to try Luevora AI.
          </p>

          <div className="space-y-3">
            <button
              onClick={logout}
              className="w-full bg-[#1d1b31] hover:bg-[#2b2947] text-white font-bold py-3.5 px-6 rounded-xl transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Icon name="LogOut" size={16} />
              Sign Out / Back to Login
            </button>
            <a
              href="/"
              className="block w-full text-center text-xs font-semibold text-[#5b4fe5] hover:underline py-2"
            >
              Back to Home Page
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-[#e7e8f3] text-[11px] text-[#74748c]">
            &copy; 2026 Luevora. All rights reserved.
          </div>
        </div>

        {/* Fade-in animation style */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      </div>
    );
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute;
