import React, { useState, useEffect, useRef } from 'react';

const MARKETING_IMAGES = [
  { src: '/assets/landingpage/marketingspace.png',     alt: 'Marketing Space' },
  { src: '/assets/landingpage/marketingdashboard.png', alt: 'Marketing Dashboard' },
];

const MarketingSpaceSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setActiveSlide(i => (i + 1) % MARKETING_IMAGES.length);
        setFade(true);
      }, 300);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const goTo = (idx) => {
    if (idx === activeSlide) return;
    setFade(false);
    setTimeout(() => { setActiveSlide(idx); setFade(true); }, 300);
  };

  const goPrev = () => goTo((activeSlide - 1 + MARKETING_IMAGES.length) % MARKETING_IMAGES.length);
  const goNext = () => goTo((activeSlide + 1) % MARKETING_IMAGES.length);

  const copywritingPillars = [
    {
      num: '01',
      title: 'Deep Business & Market Intelligence',
      desc: 'Luevora connects your internal data. CRM stages, past chat logs, and average transaction values. with live web research on competitor moves and market demand to build high-converting growth strategies.',
    },
    {
      num: '02',
      title: 'Multi-Channel Ad & Content Generator',
      desc: 'Instantly receive optimized Meta and Google Ad copy, social media content, and hyper-personalized WhatsApp/Email broadcast drafts tailored to your warm and cold audience segments.',
    },
    {
      num: '03',
      title: 'One-Click Campaign Execution',
      desc: 'Collaborate with your AI, refine the direction, and deploy. Schedule paid ads directly to Meta and Google Ads, or trigger automated broadcast sequences across internal leads without leaving the dashboard.',
    },
  ];

  return (
    <section
      id="marketing-space"
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        overflow: 'hidden',
        padding: '110px 24px 60px',
        fontFamily: "'Satoshi', sans-serif",
      }}
    >
      <style>{`
        #marketing-space,
        #marketing-space *,
        .lp-mkt-container,
        .lp-mkt-header,
        .lp-mkt-header h2,
        .lp-mkt-header p,
        .lp-mkt-copy-list,
        .lp-mkt-copy-row,
        .lp-mkt-copy-row h3,
        .lp-mkt-copy-row p,
        .lp-mkt-copy-row span {
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .lp-mkt-container {
          max-width: 1240px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }

        .lp-mkt-header {
          text-align: center;
          max-width: 880px;
          margin: 0 auto 56px;
        }

        /* 2-Column Grid Layout */
        .lp-mkt-grid {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 40px;
          align-items: center;
          width: 100%;
        }

        /* 1911:1294 Poster Space (Showcase Frame di sebelah kiri) */
        .lp-mkt-poster-wrap {
          width: 100%;
          padding: 16px;
          border-radius: 24px;
          background: linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8);
          display: flex;
          align-items: center;
          justifyContent: center;
          position: relative;
          box-sizing: border-box;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-mkt-poster-wrap:hover {
          box-shadow: 0 30px 70px -15px rgba(99, 102, 241, 0.14), 0 0 0 1px rgba(199, 210, 254, 0.9);
          transform: translateY(-2px);
        }

        .lp-mkt-poster-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 16px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
          transition: opacity 0.3s ease;
        }

        /* Vertical Typography-First Copywriting Space di sebelah kanan */
        .lp-mkt-copy-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        .lp-mkt-copy-row {
          padding: 22px 26px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
          transition: all 0.25s ease;
        }

        .lp-mkt-copy-row:hover {
          border-color: #c7d2fe;
          box-shadow: 0 10px 28px -6px rgba(99, 102, 241, 0.09);
          background: #fafbff;
          transform: translateX(4px);
        }

        @media (max-width: 960px) {
          .lp-mkt-grid {
            grid-template-columns: 1fr;
            gap: 36px;
          }
          .lp-mkt-poster-wrap {
            max-width: 680px;
            margin: 0 auto;
          }
          .lp-mkt-copy-row:hover {
            transform: none;
          }
        }

        @media (max-width: 640px) {
          .lp-mkt-header h2 {
            font-size: 26px !important;
          }
          .lp-mkt-poster-wrap {
            padding: 10px !important;
            border-radius: 16px !important;
          }
          .lp-mkt-poster-img {
            border-radius: 10px !important;
          }
          .lp-mkt-copy-row {
            padding: 18px 16px !important;
          }
          .lp-mkt-copy-desc {
            padding-left: 0 !important;
            margin-top: 8px !important;
          }
        }
      `}</style>

      {/* Decorative ambient background glows */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(236,72,153,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div className="lp-mkt-container">
        {/* ─── SECTION HEADER ─────────────────────────── */}
        <div
          className="lp-mkt-header"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateY(24px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(21px, 2.4vw, 33px)',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 18px',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            Close the Entire Customer Loop: Attract New Leads, Convert Automatically, and Scale Revenue
          </h2>

          <p
            style={{
              fontSize: 'clamp(14px, 1.05vw, 16px)',
              color: '#475569',
              maxWidth: '820px',
              margin: '0 auto',
              lineHeight: 1.75,
            }}
          >
            Luevora AI doesn’t just wait for customers to arrive. With Marketing Space, your AI virtual team analyzes historical chats, CRM behavior, and live market trends to craft and launch high-performing marketing campaigns in a single click.
          </p>
        </div>

        {/* ─── 2-COLUMN GRID: IMAGE (LEFT) + LIST 1, 2, 3 (RIGHT) ─────── */}
        <div
          className="lp-mkt-grid"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateY(30px)',
            transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
          }}
        >
          {/* Left Column: Copywriting List (Cards 1, 2, 3) */}
          <div className="lp-mkt-copy-list">
            {copywritingPillars.map((item, idx) => (
              <div key={idx} className="lp-mkt-copy-row">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontFamily: "'Satoshi', sans-serif",
                      fontSize: '16px',
                      fontWeight: 800,
                      color: '#6366f1',
                      flexShrink: 0,
                    }}
                  >
                    {item.num}.
                  </span>
                  <h3
                    style={{
                      fontSize: 'clamp(16px, 1.4vw, 18px)',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.35,
                    }}
                  >
                    {item.title}
                  </h3>
                </div>

                <p
                  className="lp-mkt-copy-desc"
                  style={{
                    fontSize: 'clamp(13px, 0.95vw, 14.5px)',
                    color: '#475569',
                    lineHeight: 1.7,
                    margin: 0,
                    paddingLeft: '32px',
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Right Column: Image Carousel */}
          <div className="lp-mkt-poster-wrap">
            <img
              src={MARKETING_IMAGES[activeSlide].src}
              alt={MARKETING_IMAGES[activeSlide].alt}
              className="lp-mkt-poster-img"
              style={{ opacity: fade ? 1 : 0 }}
            />

            {/* Prev Arrow */}
            <button
              onClick={goPrev}
              aria-label="Previous"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Next Arrow */}
            <button
              onClick={goNext}
              aria-label="Next"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '6px',
              zIndex: 10,
            }}>
              {MARKETING_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === activeSlide ? '22px' : '8px',
                    height: '8px',
                    borderRadius: '999px',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: i === activeSlide ? '#6366f1' : 'rgba(100,100,100,0.3)',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketingSpaceSection;
