import React, { useState, useEffect, useRef } from 'react';

// Gambar dashboard ukuran 2270 x 1344
const DASHBOARD_IMAGE_SRC = '/assets/landingpage/leadsinbox.webp';

const DashboardSimulationSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="simulation"
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '100px 24px 110px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <style>{`
        #simulation,
        #simulation *,
        .lp-sim-image-container,
        .lp-sim-image-wrap {
          font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .lp-sim-image-container {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }
        .lp-sim-image-wrap {
          width: 100%;
          padding: 20px;
          border-radius: 24px;
          background: linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8);
          display: flex;
          align-items: center;
          justifyContent: center;
          position: relative;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          box-sizing: border-box;
        }
        .lp-sim-image-wrap:hover {
          box-shadow: 0 30px 70px -15px rgba(99, 102, 241, 0.14), 0 0 0 1px rgba(199, 210, 254, 0.9);
          transform: translateY(-2px);
        }
        .lp-sim-img {
          width: 100%;
          height: auto;
          aspect-ratio: 2270 / 1344;
          object-fit: cover;
          display: block;
          border-radius: 16px;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
        }
        @media (max-width: 640px) {
          .lp-sim-image-wrap {
            padding: 10px;
            border-radius: 16px;
          }
          .lp-sim-img {
            border-radius: 10px;
          }
        }
      `}</style>

      {/* Decorative ambient background glows */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '8%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          right: '8%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          maxWidth: '1200px',
          width: '100%',
          textAlign: 'center',
          marginBottom: '52px',
          position: 'relative',
          zIndex: 2,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6366f1',
            display: 'inline-block',
            marginBottom: '12px',
          }}
        >
          SEE LUEVORA IN ACTION
        </span>
        <h2
          style={{
            fontSize: 'clamp(21px, 2.4vw, 33px)',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 16px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Meet the AI That Runs Your Front Desk, Not Just Your Inbox
        </h2>
        <p
          style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)',
            color: '#94a3b8',
            maxWidth: '750px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          From checking schedules to closing a reservation, Luevora handles the full conversation and hands off to your team only when a real decision is needed
        </p>
      </div>

      {/* 2270 x 1344 Image Container / Placeholder */}
      <div
        className="lp-sim-image-container"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(30px)',
          transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
        }}
      >
        <div className="lp-sim-image-wrap">
          {!imgError ? (
            <img
              src={DASHBOARD_IMAGE_SRC}
              alt="Meet the AI That Runs Your Front Desk"
              className="lp-sim-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 20px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 50%, #f1f5f9 100%)',
                border: '2px dashed #cbd5e1',
                borderRadius: '20px',
                boxSizing: 'border-box',
              }}
            >
              {/* Placeholder Icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6366f1',
                  marginBottom: '16px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>

              {/* Badges */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#6366f1',
                    background: '#eef2ff',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #c7d2fe',
                  }}
                >
                  2270 × 1344 px
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                  Front Desk AI Dashboard Image
                </span>
              </div>

              <p
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: '0 0 16px',
                  maxWidth: '520px',
                  lineHeight: 1.6,
                }}
              >
                Simpan file gambar dengan ukuran <strong>2270 × 1344</strong> di{' '}
                <code
                  style={{
                    backgroundColor: '#e2e8f0',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  public/assets/dashboard-preview.png
                </code>{' '}
                untuk menampilkannya di sini.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Aspect Ratio 2270 : 1344 (~1.69 : 1)
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DashboardSimulationSection;
