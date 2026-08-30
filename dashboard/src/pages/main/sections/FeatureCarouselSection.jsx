import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentTalkMockup from '../shared/AgentTalkMockup';
import ChatOpsPhoneMockup from '../shared/ChatOpsPhoneMockup';
import useThrottledMouseMove from '../shared/useThrottledMouseMove';

/* ── Interactive MultiPlatform Visual ── */
const MultiPlatformVisual = () => {
  const ref = useRef(null);
  const [hov, setHov] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const _move = useCallback((e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  }, []);
  const onMove = useThrottledMouseMove(_move);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setTilt({ x: 0, y: 0 }); }} onMouseMove={onMove}
        style={{ width: '100%', maxWidth: '440px', animation: hov ? 'none' : 'fc-float 7s ease-in-out infinite', transform: hov ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.03)` : undefined, transition: hov ? 'transform 0.08s linear' : 'transform 0.7s ease', cursor: 'default' }}>
        <img src="/assets/multiplatform.png" alt="Multi-Platform Agent" onLoad={() => setLoaded(true)}
          style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', opacity: loaded ? 1 : 0.8, transition: 'opacity 0.4s ease' }} />
      </div>
    </div>
  );
};

/* ── Interactive Data Migration Visual ── */
const DataMigrationVisual = () => {
  const ref = useRef(null);
  const [hov, setHov] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const _move = useCallback((e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  }, []);
  const onMove = useThrottledMouseMove(_move);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setTilt({ x: 0, y: 0 }); }} onMouseMove={onMove}
        style={{ width: '100%', maxWidth: '560px', animation: hov ? 'none' : 'fc-float 7s ease-in-out infinite', transform: hov ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)` : undefined, transition: hov ? 'transform 0.08s linear' : 'transform 0.7s ease', cursor: 'default' }}>
        <img src="/assets/data-migration.png" alt="Data Migration Dashboard" onLoad={() => setLoaded(true)}
          style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', opacity: loaded ? 1 : 0.8, transition: 'opacity 0.4s ease' }} />
      </div>
    </div>
  );
};

/* ── Custom Job Workflow Visual ── */
const CustomJobWorkflowVisual = () => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      {!imgError ? (
        <img
          src="/assets/landingpage/jobsystem.png"
          alt="Custom Job Workflow"
          onError={() => setImgError(true)}
          style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', borderRadius: '12px' }}
        />
      ) : (
        <div style={{
          width: '100%',
          maxWidth: '520px',
          aspectRatio: '1647 / 1142',
          background: 'rgba(255,255,255,0.08)',
          border: '2px dashed rgba(255,255,255,0.25)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '24px',
          boxSizing: 'border-box',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>1647 × 1142 px</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>custom-job-workflow.png</span>
        </div>
      )}
    </div>
  );
};

/* ── Custom Table Visual ── */
const CustomTableVisual = () => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      {!imgError ? (
        <img
          src="/assets/landingpage/customtable.png"
          alt="Custom Table"
          onError={() => setImgError(true)}
          style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', borderRadius: '12px' }}
        />
      ) : (
        <div style={{
          width: '100%',
          maxWidth: '520px',
          aspectRatio: '1366 / 1163',
          background: 'rgba(255,255,255,0.08)',
          border: '2px dashed rgba(255,255,255,0.25)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '24px',
          boxSizing: 'border-box',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>1366 × 1163 px</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>customtable.png</span>
        </div>
      )}
    </div>
  );
};

/* ── MCP Connector Visual ── */
const McpConnectorVisual = () => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      {!imgError ? (
        <img
          src="/assets/landingpage/mcp.png"
          alt="MCP Connector"
          onError={() => setImgError(true)}
          style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', borderRadius: '12px' }}
        />
      ) : (
        <div style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(255,255,255,0.08)',
          border: '2px dashed rgba(255,255,255,0.25)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '48px 24px',
          boxSizing: 'border-box',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>mcp.png</span>
        </div>
      )}
    </div>
  );
};

/* ── Auto Invoice & Receipt Visual ── */
const AutoInvoiceVisual = () => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
      {!imgError ? (
        <img
          src="/assets/landingpage/invoicereceipt.png"
          alt="Auto Invoice and Receipt"
          onError={() => setImgError(true)}
          style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none', borderRadius: '12px' }}
        />
      ) : (
        <div style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(255,255,255,0.08)',
          border: '2px dashed rgba(255,255,255,0.25)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '48px 24px',
          boxSizing: 'border-box',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>invoicereceipt.png</span>
        </div>
      )}
    </div>
  );
};

/* ── Slide Data — Visual is a Component reference (not pre-created JSX) ── */
const SLIDES = [
  {
    id: 'agent-talk',
    title: 'A 15 Minute Interview. Then Your AI Is Ready.',
    body: [
      'Forget tedious manual data entry. With the AI Agent Talk Session, onboarding your new AI is as simple as a conversation. Our system interviews you like a new employee onboarding, where you answer questions about your operational hours, SOPs, and business rules via text, voice, or by uploading documents.',
      'Once the session is complete, your entire Knowledge Base is automatically populated and your AI is instantly ready to serve customers.',
    ],
    accent: '#ef4444',
    bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 60%, #b91c1c 100%)',
    titleColor: '#ffffff',
    bodyColor: '#fecdd3',
    Visual: AgentTalkMockup,
  },
  {
    id: 'chatops',
    title: 'Monitor from Mobile. Anywhere, Anytime.',
    body: [
      'Imagine having a proactive manager right in your pocket. With our Agent Management Router, your AI doesn\u2019t just wait for instructions; it actively keeps you in the loop.',
      'The AI proactively sends you important updates directly, alerting you to reservations, leads, and special customer requests.',
    ],
    accent: '#3b82f6',
    bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
    titleColor: '#ffffff',
    bodyColor: '#bfdbfe',
    Visual: ChatOpsPhoneMockup,
  },
  {
    id: 'multi-platform',
    title: 'Omnichannel Support with Perfect Memory',
    body: [
      'Stop losing track of customer chats spread across different apps. Luevora seamlessly connects to WhatsApp, LINE, Instagram, Facebook, Telegram, and Email.',
      'The best part? It features an \u201call-in-one memory\u201d. The AI remembers your customers across every platform, meaning no more asking them to repeat themselves.',
    ],
    accent: '#eab308',
    bg: 'linear-gradient(135deg, #eab308 0%, #ca8a04 60%, #a16207 100%)',
    titleColor: '#ffffff',
    bodyColor: '#fef08a',
    Visual: MultiPlatformVisual,
  },
  {
    id: 'data-migration',
    title: 'Bring Your Old Data Along',
    body: [
      'Starting fresh doesn’t mean starting from zero. During onboarding, simply upload your old inventory, transactions, CRM, and customer history data.',
      'Luevora AI reads, filters, and maps your legacy data automatically, populating your dashboard so you’re ready to serve customers from day one.',
    ],
    accent: '#8b5cf6',
    bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 60%, #6d28d9 100%)',
    titleColor: '#ffffff',
    bodyColor: '#ddd6fe',
    Visual: DataMigrationVisual,
  },
  {
    id: 'custom-job-workflow',
    title: 'Custom Job Workflow',
    body: [
      'Beyond driving leads and sales, Luevora AI features an autonomous Job System designed to execute complex operational workflows across your entire business. Simply define your instructions in natural language, such as handling refunds, onboarding clients, or processing support requests, and set the trigger to run automatically via live chat, scheduled timers, or manual commands. Once activated, Luevora AI intelligently builds its own step-by-step pipeline, executes the task end-to-end, and delivers organized logs, updates, and attachments directly to your Job Dashboard.',
    ],
    accent: '#10b981',
    bg: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
    titleColor: '#ffffff',
    bodyColor: '#a7f3d0',
    Visual: CustomJobWorkflowVisual,
  },
  {
    id: 'custom-table',
    title: 'Custom Table',
    body: [
      'Luevora AI features a flexible Custom Sheet engine that allows business owners to create and store custom, spreadsheet-style databases directly within the platform. Instead of forcing rigid data structures, you can simply upload existing Excel files or create custom tables to give your AI instant access to crucial operational data, product statuses, and service schedules.',
      'What sets Luevora AI apart is its ability to update these sheets in real time. When granted permission, the AI dynamically modifies entries, such as updating booking schedules, adjusting inventory slots, or refreshing unit statuses.',
    ],
    accent: '#f97316',
    bg: 'linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%)',
    titleColor: '#ffffff',
    bodyColor: '#fed7aa',
    Visual: CustomTableVisual,
  },
  {
    id: 'mcp-connector',
    title: 'MCP Connector',
    body: [
      'Luevora AI features an open MCP Connector framework, allowing businesses to effortlessly link their AI agents to custom Model Context Protocol (MCP) servers. This grants the AI direct, secure access to your proprietary tools, internal software, and external databases without complex custom code.',
      'By bridging conversational AI with your technical infrastructure, Luevora AI can fetch real-time data, trigger external actions, and collaborate with your existing software stack during live customer interactions or job workflows. It turns your AI into an active digital worker capable of executing actions across all your favorite business tools seamlessly.',
    ],
    accent: '#06b6d4',
    bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 60%, #0e7490 100%)',
    titleColor: '#ffffff',
    bodyColor: '#a5f3fc',
    Visual: McpConnectorVisual,
  },
  {
    id: 'auto-invoice-receipt',
    title: 'Auto Invoice and Receipt',
    body: [
      'Luevora AI automatically generates professional invoices and receipts at the right moment in your customer journey. Whether triggered after a booking confirmation, payment completion, or job closure, the AI handles document creation end-to-end without manual input.',
      'Each document is formatted with your business details, transaction data, and customer information, then delivered instantly via WhatsApp, email, or your preferred channel, keeping your operations smooth and your customers informed.',
    ],
    accent: '#f59e0b',
    bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)',
    titleColor: '#ffffff',
    bodyColor: '#fde68a',
    Visual: AutoInvoiceVisual,
  },
];

const N = SLIDES.length;
function mod(n, m) { return ((n % m) + m) % m; }

/* ─────────────────────────────────────────────────────────── */

const FeatureCarouselSection = () => {
  const sectionRef   = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused]   = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [cw, setCw] = useState(1100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCw(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const PEEK   = Math.max(60, Math.min(130, cw * 0.10));
  const GAP    = 24;
  const CARD_W = cw - 2 * PEEK;
  const CARD_H = 460;

  const navigate = useCallback((dir) => {
    if (isSliding) return;
    setIsSliding(true);
    // All cards slide in unison via shared slideOffset
    setSlideOffset(dir * -(CARD_W + GAP));
    setTimeout(() => {
      // Instantly update index + snap back (no transition since isSliding→false)
      setCurrentIndex(i => mod(i + dir, N));
      setSlideOffset(0);
      setIsSliding(false);
    }, 420);
  }, [isSliding, CARD_W, GAP]);

  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(() => navigate(1), 7000);
    return () => clearInterval(t);
  }, [isPaused, navigate]);

  const active = SLIDES[currentIndex];
  const SLIDE_TRANSITION = isSliding
    ? 'transform 0.42s cubic-bezier(0.16,1,0.3,1)'
    : 'none';

  return (
    <section
      id="core-features-carousel"
      ref={sectionRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#000000',
        borderTop: '1px solid #1f2937',
        borderBottom: '1px solid #1f2937',
        overflow: 'hidden',
        padding: '96px 0 108px',
        fontFamily: "'Satoshi', sans-serif",
      }}
    >
      <style>{`
        #core-features-carousel,
        #core-features-carousel * {
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        @keyframes fc-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-9px); } }
        .fc-nav-btn {
          width: 44px; height: 44px; border-radius: 12px;
          border: 1px solid #374151; background: #111827; color: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          transition: all 0.22s ease; flex-shrink: 0;
        }
        .fc-nav-btn:hover { background: #f1f5f9; color: #0f172a; border-color: #f1f5f9; box-shadow: 0 6px 18px rgba(241,245,249,0.15); transform: translateY(-2px); }
        .fc-nav-btn:active { transform: translateY(0); }
        .fc-visual-inner .lp-chatops-phone-wrap { min-height: unset !important; height: 430px !important; max-width: 380px !important; margin: 0 auto !important; }
        .fc-visual-inner .lp-agent-mockup-wrap  { min-height: unset !important; height: 350px !important; max-width: 520px !important; margin: 0 auto !important; }
      `}</style>

      {/* ─── HEADLINE ─── */}
      <div
        style={{
          maxWidth: '1300px',
          margin: '0 auto 48px',
          padding: '0 40px',
          textAlign: 'left',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      >
        <h2
          style={{
            fontFamily: "'Satoshi', sans-serif",
            fontSize: 'clamp(16px, 1.8vw, 24px)',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            maxWidth: '700px',
          }}
        >
          Luevora makes your business operations more efficient, modern, smart, and fast
        </h2>
        <p
          style={{
            fontFamily: "'Satoshi', sans-serif",
            fontSize: 'clamp(13px, 1vw, 15px)',
            fontWeight: 400,
            color: '#94a3b8',
            margin: '12px 0 0',
            lineHeight: 1.7,
            maxWidth: '620px',
          }}
        >
          Luevora supports you from broadcasting prospects, capturing leads, serving leads, closing sales, and managing active customers, to updating data and handling after sales activities.
        </p>
      </div>

      {/* ─── CAROUSEL TRACK ─── */}
      <div
        ref={containerRef}
        style={{
          maxWidth: '1300px',
          margin: '0 auto',
          padding: '0 40px',
          boxSizing: 'border-box',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      >
        {/* overflow:hidden clips the peeking prev/next cards */}
        <div style={{ position: 'relative', width: '100%', height: `${CARD_H}px`, overflow: 'hidden' }}>

          {/*
            Render ALL slides keyed by slide.id.
            This means Visual components are ALWAYS mounted — never remounted on transition.
            No blank flash when a card becomes active.
          */}
          {/* Left fade overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '160px',
            height: '100%',
            background: 'linear-gradient(to right, #000000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 100%)',
            zIndex: 20,
            pointerEvents: 'none',
          }} />
          {/* Right fade overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '160px',
            height: '100%',
            background: 'linear-gradient(to left, #000000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 100%)',
            zIndex: 20,
            pointerEvents: 'none',
          }} />

          {SLIDES.map((slide, i) => {
            // Shortest-path distance around the ring [-N/2 … N/2)
            let relPos = i - currentIndex;
            if (relPos > N / 2)  relPos -= N;
            if (relPos < -N / 2) relPos += N;

            const isActive = relPos === 0;
            const isPrev   = relPos === -1;
            const isNext   = relPos === 1;
            const x = relPos * (CARD_W + GAP) + slideOffset;
            const { Visual } = slide;

            return (
              <div
                key={slide.id}
                onClick={isPrev ? () => navigate(-1) : isNext ? () => navigate(1) : undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: PEEK,
                  width: CARD_W,
                  height: CARD_H,
                  transform: `translateX(${x}px)`,
                  transition: SLIDE_TRANSITION,
                  background: slide.bg,
                  borderRadius: '24px',
                  border: 'none',
                  boxShadow: isActive
                    ? '0 32px 80px -16px rgba(0,0,0,0.38), 0 12px 32px -8px rgba(0,0,0,0.20)'
                    : '0 12px 40px -8px rgba(0,0,0,0.30), 0 4px 12px -2px rgba(0,0,0,0.15)',
                  boxSizing: 'border-box',
                  padding: isActive ? '36px 44px' : '28px 32px',
                  overflow: 'hidden',
                  filter: isActive ? 'none' : 'brightness(0.78)',
                  cursor: !isActive ? 'pointer' : 'default',
                  zIndex: isActive ? 10 : 2,
                }}
              >
                {/* White gloss overlay (z-index: 0, below content) */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '24px',
                  pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 65%)',
                }} />

                {/* Card content (z-index: 1 → above gloss) */}
                <div style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.1fr',
                  gap: '40px',
                  alignItems: 'center',
                  height: '100%',
                  minHeight: '380px',
                }}>
                  {/* Text */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h2 style={{
                      fontSize: 'clamp(22px, 2.4vw, 34px)',
                      fontWeight: 800, color: slide.titleColor,
                      margin: 0, lineHeight: 1.25, letterSpacing: '-0.025em',
                    }}>
                      {slide.title}
                    </h2>
                    {slide.body.map((p, pi) => (
                      <p key={pi} style={{ fontSize: 'clamp(13px, 1vw, 15px)', color: slide.bodyColor, lineHeight: 1.75, margin: 0 }}>
                        {p}
                      </p>
                    ))}
                  </div>

                  {/* Visual — ALWAYS visible, never hidden. Side cards are clipped + darkened anyway. */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '340px',
                    width: '100%',
                  }}>
                    <div className="fc-visual-inner" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Visual />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── BOTTOM NAV ─── */}
      <div
        style={{
          maxWidth: '1300px',
          margin: '32px auto 0',
          padding: '0 40px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(12px)',
          transition: 'opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s',
        }}
      >
        <button type="button" className="fc-nav-btn" onClick={() => navigate(-1)} aria-label="Previous">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {/* 4 fixed dots — active dot moves between them */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', padding: '9px 16px', borderRadius: '999px', border: '1px solid #374151', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {SLIDES.map((slide, i) => {
            const isAct = i === currentIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  const diff = i - currentIndex;
                  if (diff !== 0) navigate(diff > 0 ? 1 : -1);
                }}
                style={{
                  height: '8px',
                  width: isAct ? '28px' : '8px',
                  borderRadius: '999px',
                  backgroundColor: isAct ? slide.accent : '#cbd5e1',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: isAct ? 1 : 0.5,
                  transition: 'all 0.32s cubic-bezier(0.16,1,0.3,1)',
                }}
                title={slide.title}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#111827', padding: '9px 16px', borderRadius: '12px', border: '1px solid #374151', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9' }}>0{currentIndex + 1}</span>
          <span style={{ fontSize: '12px', color: '#4b5563' }}>/</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>0{N}</span>
        </div>

        <button type="button" className="fc-nav-btn" onClick={() => navigate(1)} aria-label="Next">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </section>
  );
};

export default FeatureCarouselSection;
