import React, { useState, useEffect } from 'react';
import LazySection from './shared/LazySection';
import LaptopMockup from './shared/LaptopMockup';
import AgentTalkMockup from './shared/AgentTalkMockup';
import NewHeroSection from './sections/NewHeroSection';
import CustomerJourneySection from './sections/CustomerJourneySection';
import EcosystemFeatureMatrixSection from './sections/EcosystemFeatureMatrixSection';
import DashboardSimulationSection from './sections/DashboardSimulationSection';
import TransformationSection from './sections/TransformationSection';
import ChatOpsSection from './sections/ChatOpsSection';
import MultiPlatformSection from './sections/MultiPlatformSection';
import DataMigrationSection from './sections/DataMigrationSection';
import PricingSection from './sections/PricingSection';
import FAQSection from './sections/FAQSection';
import FinalCTASection from './sections/FinalCTASection';
import FooterSection from './sections/FooterSection';

/* ─── Splash Screen ────────────────────────────────────────────── */
const SplashScreen = ({ isLoading, loadProgress = 0 }) => {
  const [headingText, setHeadingText] = useState('');
  const [subText, setSubText] = useState('');
  const [greeting, setGreeting] = useState('');
  const [cursorPos, setCursorPos] = useState(1);
  const [isTypingDone, setIsTypingDone] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Morning');
    else if (hour < 18) setGreeting('Afternoon');
    else setGreeting('Evening');
  }, []);

  useEffect(() => {
    if (!greeting) return;
    const fullHeading = `Hello, Good ${greeting} Boss`;
    const fullSub = "I'm ready to be your best employee for your business";
    
    let hIndex = 0;
    let sIndex = 0;
    let sInterval;
    
    setCursorPos(1);
    const hInterval = setInterval(() => {
      setHeadingText(fullHeading.slice(0, hIndex + 1));
      hIndex++;
      if (hIndex === fullHeading.length) {
        clearInterval(hInterval);
        setCursorPos(2);
        sInterval = setInterval(() => {
          setSubText(fullSub.slice(0, sIndex + 1));
          sIndex++;
          if (sIndex === fullSub.length) {
            clearInterval(sInterval);
            setCursorPos(0);
            setIsTypingDone(true);
          }
        }, 25);
      }
    }, 40);
    
    return () => {
      clearInterval(hInterval);
      if (sInterval) clearInterval(sInterval);
    };
  }, [greeting]);

  const shouldShow = isLoading || !isTypingDone;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#e6e6e6',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: shouldShow ? 1 : 0,
        pointerEvents: shouldShow ? 'all' : 'none',
        transition: 'opacity 0.6s ease-in-out',
        padding: '20px',
      }}
    >
      <h1 style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontWeight: 800, color: '#000', margin: '0 0 8px', textAlign: 'center', minHeight: '1.2em' }}>
        {headingText}{cursorPos === 1 && <span className="splash-cursor">|</span>}
      </h1>
      <p style={{ fontSize: 'clamp(16px, 2vw, 24px)', color: '#333', margin: 0, textAlign: 'center', minHeight: '1.5em' }}>
        {subText}{(cursorPos === 2 || cursorPos === 0) && subText.length > 0 && <span className="splash-cursor">|</span>}
      </p>
      
      <div style={{
        marginTop: '40px',
        width: '220px',
        opacity: (isTypingDone && isLoading) ? 1 : 0,
        transition: 'opacity 0.5s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${loadProgress}%`,
            height: '100%',
            backgroundColor: '#000',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 600, letterSpacing: '0.05em' }}>
          Loading assets {loadProgress}%
        </span>
      </div>

      <style>{`
        .splash-cursor { animation: splash-blink 1s step-end infinite; font-weight: 300; }
        @keyframes splash-blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

const LandingPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    /* ── Splash screen only waits for top-level / hero assets ── */
    const IMAGE_ASSETS = [
      '/assets/phones.png?v=3',
    ];

    const MODEL_ASSETS = [];

    const totalAssets = IMAGE_ASSETS.length + MODEL_ASSETS.length;
    let loadedCount = 0;

    const onAssetLoaded = () => {
      loadedCount++;
      setLoadProgress(Math.round((loadedCount / totalAssets) * 100));
      if (loadedCount >= totalAssets) {
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    /* Preload images via hidden Image() objects — caches them in browser */
    IMAGE_ASSETS.forEach(src => {
      const img = new Image();
      img.onload = onAssetLoaded;
      img.onerror = onAssetLoaded; // don't block on broken images
      img.src = src;
    });

    /* Preload 3D models via fetch — caches the .glb binary in browser */
    MODEL_ASSETS.forEach(src => {
      fetch(src)
        .then(res => { if (res.ok) return res.arrayBuffer(); })
        .then(onAssetLoaded)
        .catch(onAssetLoaded); // don't block on network errors
    });

    /* Fallback: force-show after 15 seconds even if some assets fail */
    const fallback = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(fallback);
  }, []);

  // Enable vertical scroll on landing page (global body has overflow:hidden for app pages)
  useEffect(() => {
    document.documentElement.classList.add('landing-page-html');
    document.body.classList.add('landing-page-body');
    return () => {
      document.documentElement.classList.remove('landing-page-html');
      document.body.classList.remove('landing-page-body');
    };
  }, []);
  return (
    <div
      style={{
        height: '100dvh',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#ffffff',
        fontFamily: "'Satoshi', 'Inter', 'Segoe UI', sans-serif",
        color: '#111111',
        position: 'relative',
      }}
    >
      {/* ─── GLOBAL MOBILE RESPONSIVE CSS ─────────────────────── */}
      <style>{`
        /* ════════════════════════════════════════════
           BASE (desktop) — no !important needed here
         ════════════════════════════════════════════ */
        .lp-navbar {
          position: fixed !important;
          top: 0 !important; left: 0 !important; right: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 16px 32px !important;
          z-index: 9999 !important;
          pointer-events: none !important;
        }
        .lp-nav-right { display: flex !important; }
        .lp-mobile-dropdown { display: none !important; }

        /* ════════════════════════════════════════════
           TABLET  (≤ 900px)
         ════════════════════════════════════════════ */
        @media (max-width: 900px) {
          .lp-navbar { padding: 12px 20px !important; }
          .lp-mobile-dropdown {
            display: flex !important;
            left: 20px !important;
            top: 64px !important;
          }

          /* NEW HERO */
          .floating-badge {
            display: none !important;
          }
          .lp-dashboard-mockup-container {
            margin-top: 24px !important;
            padding: 0 16px !important;
          }
          .lp-dashboard-mockup {
            transform: none !important;
            animation: none !important;
            box-shadow: 0 15px 30px rgba(0,0,0,0.6) !important;
          }

          /* HERO */
          .lp-hero {
            grid-template-columns: 1fr !important;
            padding: 90px 20px 40px !important;
            gap: 24px !important;
            min-height: auto !important;
          }
          .lp-hero-phone {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
            max-width: 480px !important;
            margin: 0 auto !important;
          }
          .lp-phone-mockup-wrap {
            height: 400px !important;
            justify-content: center !important;
          }
          .lp-hero-bg-anim {
            width: 420px !important;
            height: 420px !important;
            left: 50% !important;
            top: 45% !important;
            transform: translate(-50%, -50%) !important;
          }

          /* ABOUT */
          .lp-about-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 56px 20px 72px !important;
          }

          /* CHATOPS */
          .lp-chatops-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 0 20px !important;
          }

          /* DASHBOARD ASSISTANT */
          .lp-da-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 0 20px !important;
          }
          .lp-da-text {
            padding: 0 !important;
          }

          /* AGENT TALK */
          .lp-agent-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 56px 20px 72px !important;
          }

          /* MULTIPLATFORM */
          .lp-mp-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 0 20px !important;
          }
          .lp-mp-text {
            padding: 0 !important;
          }

          /* DATA MIGRATION */
          .lp-dm-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 0 20px !important;
          }
          .lp-dm-text {
            padding: 20px !important;
          }

          /* SMART DASHBOARD */
          .lp-sd-section {
            padding: 56px 20px !important;
          }
          .lp-sd-img-wrap {
            margin-bottom: 28px !important;
            max-width: 100% !important;
          }

          /* 3D MODEL SECTIONS */
          .lp-model-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 56px 20px !important;
          }
          .lp-model-viewer-wrap { height: 360px !important; }

          /* RIGGED MASCOT SHOWCASE */
          .lp-rigged-section {
            min-height: 70vh !important;
          }
          .lp-rigged-model-container {
            max-width: 500px !important;
            height: 60vh !important;
          }

          /* FOOTER */
          .lp-footer {
            padding: 24px 20px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .lp-footer p, .lp-footer span, .lp-footer a {
            font-size: 12px !important;
          }
          .lp-footer-logo-wrap {
            margin-top: 4px !important;
          }
          .lp-footer-links-wrap {
            flex-direction: row !important;
            justify-content: space-between !important;
            width: 100% !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            padding-top: 16px !important;
            gap: 16px !important;
          }
          .lp-footer-center {
            border-left: none !important;
            border-top: none !important;
            padding: 0 !important;
            height: auto !important;
          }
          .lp-footer-right {
            border-left: none !important;
            padding-left: 0 !important;
            height: auto !important;
          }
          .lp-features-dots-container {
            transform: translate(-50%, -50%) scale(0.7) !important;
          }
        }

        /* ════════════════════════════════════════════
           MOBILE  (≤ 600px)
         ════════════════════════════════════════════ */
        @media (max-width: 600px) {
          /* NAVBAR — hide nav pills, keep only logo */
          .lp-navbar {
            padding: 10px 14px !important;
            justify-content: space-between !important;
          }
          .lp-nav-right { display: none !important; }
          .lp-nav-logo-pill {
            padding: 8px 14px 8px 10px !important;
          }

          /* NEW HERO MOBILE */
          .lp-new-hero-section {
            padding: 120px 16px 60px !important;
          }

          /* HERO */
          .lp-hero {
            grid-template-columns: 1fr !important;
            padding: 76px 16px 36px !important;
            gap: 20px !important;
            min-height: auto !important;
          }
          .lp-hero-phone {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
            max-width: 320px !important;
            margin: 0 auto !important;
          }
          .lp-phone-mockup-wrap {
            height: 320px !important;
            justify-content: center !important;
          }
          .lp-hero-bg-anim {
            width: 300px !important;
            height: 300px !important;
            left: 50% !important;
            top: 55% !important;
            transform: translate(-50%, -50%) !important;
          }
          .lp-hero-text {
            max-width: 100% !important;
            width: 100% !important;
          }

          /* ABOUT */
          .lp-about-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 40px 16px 56px !important;
          }
          .lp-laptop-mockup-wrap {
            height: auto !important;
          }

          /* FEATURES — text should wrap */
          .lp-features-text {
            max-width: 90vw !important;
            white-space: normal !important;
          }
          .lp-features-dots-container {
            transform: translate(-50%, -50%) scale(0.5) !important;
          }

          /* CHATOPS */
          .lp-chatops-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 0 16px !important;
          }
          .lp-chatops-phone-wrap {
            min-height: 380px !important;
          }

          /* DASHBOARD ASSISTANT */
          .lp-da-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 0 16px !important;
          }
          .lp-da-text {
            padding: 0 !important;
          }

          /* AGENT TALK */
          .lp-agent-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 40px 16px 56px !important;
          }
          .lp-agent-text {
            order: 2 !important;
          }
          .lp-agent-mockup-wrap {
            order: 1 !important;
            min-height: 280px !important;
          }

          /* MULTIPLATFORM */
          .lp-mp-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 0 16px !important;
          }
          .lp-mp-text {
            padding: 0 !important;
            order: 2 !important;
          }
          .lp-mp-img-wrap {
            order: 1 !important;
          }

          /* DATA MIGRATION */
          .lp-dm-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 0 16px !important;
          }
          .lp-dm-text {
            padding: 0 !important;
          }

          /* SMART DASHBOARD */
          .lp-sd-section {
            padding: 40px 16px !important;
          }
          .lp-sd-img-wrap {
            margin-bottom: 20px !important;
            max-width: 100% !important;
          }

          /* 3D MODEL SECTIONS */
          .lp-model-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 40px 16px !important;
          }
          .lp-model-viewer-wrap { height: 240px !important; }

          /* RIGGED MASCOT SHOWCASE */
          .lp-rigged-section {
            min-height: 60vh !important;
          }
          .lp-rigged-model-container {
            max-width: 100% !important;
            height: 50vh !important;
            padding: 0 16px !important;
          }

          /* MASCOT ORDER: MASCOT ON TOP, TEXT ON BOTTOM */
          .lp-mascot-text {
            order: 2 !important;
          }
          .lp-mascot-viewer {
            order: 1 !important;
            height: 240px !important;
          }

          /* FOOTER */
          .lp-footer {
            padding: 20px 16px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
          .lp-footer p, .lp-footer span, .lp-footer a {
            font-size: 11px !important;
          }
          .lp-footer-logo-wrap {
            margin-top: 4px !important;
          }
          .lp-footer-links-wrap {
            flex-direction: row !important;
            justify-content: space-between !important;
            width: 100% !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            padding-top: 16px !important;
            gap: 16px !important;
          }
          .lp-footer-center {
            border-left: none !important;
            border-top: none !important;
            padding: 0 !important;
            height: auto !important;
          }
          .lp-footer-right {
            border-left: none !important;
            padding-left: 0 !important;
            height: auto !important;
          }

          .lp-mobile-dropdown {
            display: flex !important;
            left: 14px !important;
            top: 60px !important;
          }
        }

        @keyframes fade-in-slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <SplashScreen isLoading={isLoading} loadProgress={loadProgress} />

      {/* ─── NEW HERO SECTION ───────────────────────────────── */}
      <NewHeroSection />


      {/* ─── CUSTOMER JOURNEY SECTION ─────────────────────── */}
      <CustomerJourneySection />

      {/* ─── ECOSYSTEM FEATURE MATRIX SECTION ─────────────── */}
      <EcosystemFeatureMatrixSection />

      {/* ─── FIXED HEADER BAR (logo kiri + nav kanan, ikut scroll) ─────── */}
      <div
        className="lp-navbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <div
          className="lp-nav-logo-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto',
            backgroundColor: '#111',
            borderRadius: '999px',
            padding: '10px 22px 10px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <div style={{ width: 28, height: 28, flexShrink: 0 }}>
            <img
              src="/assets/logo.png"
              alt="Luevora Logo"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#fff',
            }}
          >
            Luevora AI
          </span>
        </div>

        {/* Dropdown Menu (Mobile Only) */}
        {mobileMenuOpen && (
          <div
            className="lp-mobile-dropdown"
            style={{
              position: 'absolute',
              top: '70px',
              left: '32px',
              backgroundColor: 'rgba(17, 17, 17, 0.95)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '16px 8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '200px',
              border: '1px solid rgba(255,255,255,0.08)',
              pointerEvents: 'auto',
              zIndex: 10000,
              animation: 'fade-in-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <a
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: "'Satoshi', sans-serif",
                letterSpacing: '0.04em',
                textDecoration: 'none',
                padding: '14px 28px',
                borderRadius: '999px',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Get Started
            </a>
          </div>
        )}

        {/* RIGHT: NAV PILL */}
        <div
          className="lp-nav-right"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            backgroundColor: '#111',
            borderRadius: '999px',
            padding: '6px 8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            pointerEvents: 'auto',
          }}
        >
          <a
            href="/register"
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: "'Satoshi', sans-serif",
              letterSpacing: '0.04em',
              textDecoration: 'none',
              padding: '10px 22px',
              borderRadius: '999px',
              transition: 'opacity 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Get Started
          </a>
        </div>
      </div>

      {/* ─── ABOUT SECTION ─────────────────────────────────────────── */}
      <LazySection assets={['/assets/laptop.png']}>
      <section
        id="about"
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}
      >
        {/* No dot grid — pure white background */}

        <div
          style={{
            position: 'relative', zIndex: 1,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '88px 40px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            gap: '72px',
          }}
          className="lp-about-grid"
        >

          {/* LEFT: LAPTOP IMAGE */}
          <div className="lp-about-laptop">
            <LaptopMockup />
          </div>

          {/* RIGHT: TEXT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <div>
              <p style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#6366f1',
                margin: '0 0 14px',
}}>WHO IS LUEVORA</p>
              <h2 style={{
                fontSize: 'clamp(26px, 2.8vw, 40px)',
                fontWeight: 800, color: '#0f172a',
                margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em',
              }}>
                Not a Chatbot.<br />Your New Employee.
              </h2>
            </div>

            <p style={{
              fontSize: 'clamp(14px, 1.05vw, 16px)',
              color: '#475569', lineHeight: 1.8, margin: 0,
            }}>
              Luevora isn't your average chatbot that just says &ldquo;Hello, how can I help?&rdquo; it is an AI employee that remembers every customer, actively manages operations, and reports to you when decisions matter. You focus on growth. Luevora executes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  ),
                  title: 'Photographic Memory',
                  desc: "Remembers every customer's history and CRM data across all platforms, including WhatsApp, IG, FB, Telegram, Email, and more.",
                },
                {
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M9 9h6M9 12h6M9 15h4"/>
                    </svg>
                  ),
                  title: 'Active Operations Manager',
                  desc: "Doesn't just answer FAQs; it actively manages reservations, schedules, and inventory without being asked.",
                },
                {
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.85 13 19.79 19.79 0 0 1 1.75 4.4 2 2 0 0 1 3.74 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.07 6.07l1.06-1.06a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  ),
                  title: 'Your Loyal Assistant',
                  desc: 'Reports crucial updates directly to your Telegram. You stay the boss, make the final calls, and Luevora executes the rest.',
                },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '16px', alignItems: 'flex-start',
                  padding: '18px 20px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    backgroundColor: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{
                      fontSize: '14px', fontWeight: 700,
                      color: '#0f172a', margin: '0 0 4px',
                    }}>{item.title}</p>
                    <p style={{
                      fontSize: '13px', color: '#64748b',
                      margin: 0, lineHeight: 1.65,
                    }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>
      </LazySection>

      {/* ─── CTA DIVIDER ───────────────────────────── */}
      <div style={{ width: '100%', backgroundColor: '#ffffff', padding: '32px 20px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e5e7eb' }}><a href="/register" style={{ display: 'inline-flex', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 999, background: '#6366f1', color: '#fff', textDecoration: 'none', fontFamily: "'Satoshi', sans-serif" }}>Start Free Trial →</a></div>

      {/* ─── DASHBOARD SIMULATION SECTION ───────────── */}
      <LazySection><DashboardSimulationSection /></LazySection>

      {/* ─── Agent Talk Session SECTION ─────────────────────── */}
      <LazySection assets={['/assets/agent-talk.png']}>
        <section
          style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            overflow: 'hidden',
            padding: '72px 0',
          }}
        >
          <div
            className="lp-agent-grid"
            style={{
              position: 'relative', zIndex: 1,
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '0 40px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              alignItems: 'center',
              gap: '72px',
            }}
          >
            {/* LEFT: Text */}
            <div className="lp-agent-text" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#6366f1', margin: 0,
              }}>Agent Talk Session</p>
              <h2 style={{
                fontSize: 'clamp(26px, 2.8vw, 40px)', fontWeight: 800,
                color: '#0f172a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em',
              }}>
                A 15 Minute Interview.<br />Then Your AI Is Ready.
              </h2>
              <p style={{
                fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
                lineHeight: 1.8, margin: 0, maxWidth: '500px',
              }}>
                Forget tedious manual data entry. With the AI Agent Talk Session, onboarding
                your new AI is as simple as a conversation. Our system interviews you like
                a new employee onboarding, where you answer questions about your operational hours,
                SOPs, and business rules via text, voice, or by uploading documents.
                Once the session is complete, your entire Knowledge Base is automatically
                populated and your AI is instantly ready to serve customers.
              </p>
            </div>

            {/* RIGHT: Illustration */}
            <AgentTalkMockup />
          </div>
        </section>
      </LazySection>

      {/* ─── CTA DIVIDER ───────────────────────────── */}
      <div style={{ width: '100%', backgroundColor: '#ffffff', padding: '32px 20px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e5e7eb' }}><a href="/register" style={{ display: 'inline-flex', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 999, background: '#6366f1', color: '#fff', textDecoration: 'none', fontFamily: "'Satoshi', sans-serif" }}>Start Free Trial →</a></div>

      {/* ─── CHATOPS ASSISTANT SECTION ───────────────────────── */}
      <LazySection assets={['/assets/chatops-phone.png']}><ChatOpsSection /></LazySection>


      {/* ─── MULTI-PLATFORM AGENT SECTION ───────────────── */}
      <LazySection assets={['/assets/multiplatform.png']}><MultiPlatformSection /></LazySection>

      {/* ─── DATA MIGRATION SECTION ────────────────────── */}
      <LazySection assets={['/assets/data-migration.png']}><DataMigrationSection /></LazySection>

      {/* ─── TRANSFORMATION SECTION ──────────────────── */}
      <LazySection><TransformationSection /></LazySection>

      {/* ─── CTA DIVIDER ───────────────────────────── */}
      <div style={{ width: '100%', backgroundColor: '#ffffff', padding: '32px 20px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e5e7eb' }}><a href="/register" style={{ display: 'inline-flex', padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 999, background: '#6366f1', color: '#fff', textDecoration: 'none', fontFamily: "'Satoshi', sans-serif" }}>Start Free Trial →</a></div>

      {/* ─── PRICING SECTION ───────────────────────── */}
      <LazySection><PricingSection /></LazySection>

      {/* ─── FAQ SECTION ───────────────────────────── */}
      <LazySection><FAQSection /></LazySection>

      {/* ─── FINAL CTA SECTION ─────────────────────── */}
      <FinalCTASection />

      {/* ─── FOOTER SECTION ────────────────────────── */}
      <FooterSection />
    </div>
  );
};

export default LandingPage;
