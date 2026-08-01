import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import useNotificationSound from '@/hooks/useNotificationSound';
import { getBusinessConfig } from '@/config/businessTypes';
import Icon from '@/components/shared/Icon';
import AdminCopilot from '@/components/shared/AdminCopilot';
import api from '@/services/api';

/**
 * SharedLayout — Clean sidebar nav, consistent with modern chat UI style.
 * Mobile: Bottom nav bar + slide-out sidebar + safe area support.
 */
const SharedLayout = ({ extraWidgets = null }) => {
  const { user, businessType, logout } = useAuth();
  const config = getBusinessConfig(businessType);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState('free');
  const location = useLocation();

  // 🔊 Global notification sound — aktif di semua halaman
  useNotificationSound();

  // Fetch subscription status on mount
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const res = await api.get('/subscription/status');
        if (res.data.status && res.data.data?.subscription_plan) {
          setSubscriptionPlan(res.data.data.subscription_plan);
        }
      } catch {
        // silent fail — default to 'free'
      }
    };
    fetchSubscription();
  }, []);

  // Close sidebar and more menu on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const userName = user?.name?.replace(' (Owner)', '') || 'User';
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const isSubscribed = subscriptionPlan && subscriptionPlan !== 'free';
  const isHighestPlan = subscriptionPlan === 'scale';

  // Bottom nav items — quick access on mobile (max 5 icons)
  const bottomNavItems = [
    { path: '/dashboard', label: 'Home', icon: 'LayoutDashboard' },
    { path: '/leads', label: 'Leads', icon: 'Inbox' },
    { path: '/transactions', label: 'Transaksi', icon: 'ClipboardCheck' },
    { path: '/customers', label: 'Chat', icon: 'MessageSquare' },
    { path: '/notifications', label: 'Notif', icon: 'Bell' },
  ];

  // Paths already in the bottom nav — excluded from the "Lainnya" popup
  const bottomNavPaths = new Set(bottomNavItems.map(i => i.path));
  const moreMenuGroups = config.navGroups.map(group => ({
    group: group.group,
    items: group.items.filter(item => !bottomNavPaths.has(item.path)),
  })).filter(g => g.items.length > 0);

  /**
   * Render the subscription/upgrade action in different contexts.
   * - free plan → "Subscription Plan" orange button (desktop) or link (dropdown)
   * - subscribed (not highest) → "Upgrade Plan" indigo link (dropdown only, no orange button)
   * - highest plan (scale) → "Request Enterprise" mailto link
   */
  const renderSubscriptionAction = (context) => {
    if (isHighestPlan) {
      // Highest plan — Request Enterprise via email
      if (context === 'desktop-button') return null; // hide orange button
      return (
        <a
          href="mailto:contact@luevora.com?subject=Enterprise%20Plan%20Request"
          onClick={() => { setShowUserMenu(false); setShowMoreMenu(false); }}
          className={
            context === 'dropdown'
              ? 'flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-all border-b border-gray-50'
              : 'flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-[12.5px] font-bold text-purple-600 hover:bg-purple-50 transition-all mb-1'
          }
        >
          <Icon name="Building2" size={15} />
          Request Enterprise
        </a>
      );
    }

    if (isSubscribed) {
      // Subscribed but not highest — show "Upgrade Plan"
      if (context === 'desktop-button') return null; // hide orange button
      return (
        <Link
          to="/subscription"
          onClick={() => { setShowUserMenu(false); setShowMoreMenu(false); }}
          className={
            context === 'dropdown'
              ? 'flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all border-b border-gray-50'
              : 'flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-[12.5px] font-bold text-indigo-600 hover:bg-indigo-50 transition-all mb-1'
          }
        >
          <Icon name="ArrowUpCircle" size={15} />
          Upgrade Plan
        </Link>
      );
    }

    // Free plan — show "Subscription Plan"
    if (context === 'desktop-button') {
      return (
        <Link
          to="/subscription"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/20 transition-all duration-150"
        >
          <Icon name="Crown" size={13} />
          Subscription Plan
        </Link>
      );
    }

    return (
      <Link
        to="/subscription"
        onClick={() => { setShowUserMenu(false); setShowMoreMenu(false); }}
        className={
          context === 'dropdown'
            ? 'flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-all border-b border-gray-50'
            : 'flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-[12.5px] font-bold text-amber-600 hover:bg-amber-50 transition-all mb-1'
        }
      >
        <Icon name="Crown" size={15} />
        Subscription Plan
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: '#f5f6fa' }}>

      {/* ═══════════════ TOP BAR ═══════════════ */}
      <header className="h-[52px] sm:h-[56px] bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-3 sm:px-6 fixed lg:sticky top-0 left-0 right-0 z-50 transition-transform duration-200"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Logo — no hamburger on mobile (use bottom nav "Lainnya" instead) */}
        <div className="flex items-center gap-2">
          <h1 className="font-serif font-bold text-[20px] sm:text-[22px] tracking-tight"
            style={{ color: '#4f46e5', letterSpacing: '-0.5px' }}>
            Luevora
          </h1>
        </div>

        {/* Right: Ask AI + user info + logout */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* ── Ask AI Button — next to profile photo, all screen sizes ── */}
          <button
            onClick={() => setCopilotOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-bold transition-all duration-200 active:scale-95 select-none ${
              copilotOpen
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600 shadow-md shadow-indigo-400/25 hover:shadow-indigo-500/35'
            }`}
            title="AI Copilot"
          >
            <Icon name="Sparkles" size={12} className="shrink-0" />
            <span className="hidden sm:inline leading-none">Ask AI</span>
          </button>

          {/* User avatar + name — tap for menu */}
          <button
            onClick={() => setShowUserMenu(prev => !prev)}
            className="flex items-center gap-2 sm:gap-2.5 p-1 -mr-1 rounded-xl hover:bg-gray-50 transition-all"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-[11px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {initials}
            </div>
            <span className="text-[12px] sm:text-[13px] font-semibold text-gray-700 leading-none hidden sm:block">{userName}</span>
            <Icon name="ChevronDown" size={12} className="text-gray-400 hidden sm:block" />
          </button>

          {/* Desktop Divider + Plan & Logout */}
          <div className="w-px h-5 bg-gray-200 hidden sm:block"></div>

          {/* Desktop subscription button — only shown for free plan */}
          {renderSubscriptionAction('desktop-button')}

          <button
            onClick={logout}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
          >
            <Icon name="LogOut" size={13} />
            Logout
          </button>
        </div>

        {/* ── User dropdown menu (mobile) ── */}
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute top-full right-3 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50 w-56 animate-[fadeSlideDown_0.2s_ease-out]">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">{userName}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{user?.email || ''}</p>
              </div>
              {renderSubscriptionAction('dropdown')}
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
              >
                <Icon name="LogOut" size={15} />
                Logout
              </button>
            </div>
          </>
        )}
      </header>

      <div className="flex flex-1 relative min-h-0 pt-[52px] sm:pt-[56px] lg:pt-0 chat-header-offset">
        {/* ═══════════════ MOBILE OVERLAY ═══════════════ */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ═══════════════ SIDEBAR ═══════════════ */}
        <aside
          className={`w-[260px] sm:w-[220px] bg-white border-r border-gray-100 flex flex-col top-0 h-full overflow-y-auto scrollbar-thin transition-transform duration-300 ease-out z-40
            fixed lg:sticky
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
          style={{ boxShadow: sidebarOpen ? '8px 0 30px rgba(0,0,0,0.08)' : '1px 0 0 #f1f2f6' }}
        >
          {/* Mobile sidebar header */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-serif font-bold text-[18px]" style={{ color: '#4f46e5' }}>Menu</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all active:scale-95"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          <nav className="px-3 py-4 space-y-5 flex-1">
            {config.navGroups.map((group) => (
              <div key={group.group}>
                {/* Group Label */}
                <p className="px-3 mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  {group.group}
                </p>

                {/* Nav Items */}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-xl sm:rounded-lg transition-all duration-150 text-[13px] sm:text-[12.5px] font-medium ${isActive
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`shrink-0 transition-colors ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                            <Icon name={item.icon} size={16} strokeWidth={isActive ? 2.5 : 2} />
                          </span>
                          <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                          {/* Active indicator dot */}
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Business-specific sidebar widgets */}
          {extraWidgets && (
            <div className="p-3 border-t border-gray-100">
              <div className="space-y-3">{extraWidgets}</div>
            </div>
          )}

          {/* Mobile sidebar footer — user info + logout */}
          <div className="lg:hidden p-3 border-t border-gray-100">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Icon name="LogOut" size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-[68px] lg:pb-0" style={{ background: '#f5f6fa' }}>
          <Outlet />
        </main>
      </div>

      {/* ═══════════════ MOBILE BOTTOM NAV BAR ═══════════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200/60 mobile-bottom-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-[60px] px-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 w-14 py-1 rounded-xl transition-all duration-200 ${isActive
                  ? 'text-indigo-600'
                  : 'text-gray-400 active:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-indigo-50 scale-105' : ''
                    }`}>
                    <Icon name={item.icon} size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                  <span className={`text-[9px] font-bold leading-tight ${isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" button — opens compact popup anchored at button corner */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(prev => !prev)}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 py-1 rounded-xl transition-all ${showMoreMenu ? 'text-indigo-600' : 'text-gray-400 active:text-gray-600'
                }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${showMoreMenu ? 'bg-indigo-50' : ''}`}>
                <Icon name="MoreHorizontal" size={18} strokeWidth={showMoreMenu ? 2.5 : 1.8} />
              </div>
              <span className={`text-[9px] font-bold leading-tight ${showMoreMenu ? 'text-indigo-600' : ''}`}>Lainnya</span>
            </button>

            {/* ── Lebih Menu Popup ── */}
            {showMoreMenu && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-[60]" onClick={() => setShowMoreMenu(false)} />
                {/* Popup card — anchored at bottom-right corner of button */}
                <div className="absolute bottom-full right-0 mb-2 z-[70] w-[220px] max-h-[60vh] overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-xl shadow-black/12 animate-[fadeSlideUp_0.18s_ease-out]">
                  {moreMenuGroups.map((group, gi) => (
                    <div key={group.group} className={gi > 0 ? 'border-t border-gray-100' : ''}>
                      <p className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">{group.group}</p>
                      <div className="px-2 pb-2">
                        {group.items.map(item => (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setShowMoreMenu(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-[12.5px] font-medium ${isActive
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-100'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className={`shrink-0 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`}>
                                  <Icon name={item.icon} size={15} strokeWidth={isActive ? 2.5 : 1.8} />
                                </span>
                                <span className={`flex-1 min-w-0 truncate ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                                {isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                )}
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Subscription/Upgrade action + Logout in popup */}
                  <div className="border-t border-gray-100 px-2 py-2">
                    {renderSubscriptionAction('more-menu')}
                    <button
                      onClick={() => { setShowMoreMenu(false); logout(); }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-[12.5px] font-medium text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Icon name="LogOut" size={15} />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <AdminCopilot isOpen={copilotOpen} onToggle={setCopilotOpen} />
    </div>
  );
};

export default SharedLayout;
