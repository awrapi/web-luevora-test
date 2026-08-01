import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from '../shared/useThrottledMouseMove';

const DataMigrationSection = () => {
  const sectionRef = useRef(null);
  const imgWrapRef = useRef(null);
  const [isVisible,  setIsVisible]  = useState(false);
  const [imgHovered, setImgHovered] = useState(false);
  const [tilt,       setTilt]       = useState({ x: 0, y: 0 });
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const actualImgRef = useRef(null);

  useEffect(() => {
    const checkImg = () => {
      if (actualImgRef.current && actualImgRef.current.complete && actualImgRef.current.naturalHeight !== 0) {
        setImgLoaded(true);
      }
    };
    checkImg();
    const interval = setInterval(checkImg, 100);
    return () => clearInterval(interval);
  }, []);

  const _dmImgMove = useCallback((e) => {
    if (!imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width  - 0.5;
    const ny = (e.clientY - rect.top)  / rect.height - 0.5;
    setTilt({ x: ny * -10, y: nx * 8 });
  }, []);
  const handleImgMouseMove = useThrottledMouseMove(_dmImgMove);
  const handleImgMouseEnter = () => setImgHovered(true);
  const handleImgMouseLeave = () => { setImgHovered(false); setTilt({ x: 0, y: 0 }); };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        overflow: 'hidden',
        padding: '72px 0',
      }}
    >
      <style>{`
        @keyframes dm-img-float {
          0%, 100% { transform: translateY(0px); }
          35%       { transform: translateY(-12px); }
          68%       { transform: translateY(-6px); }
        }
      `}</style>

      <div className="lp-dm-grid" style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 40px',
        display: 'grid',
        gridTemplateColumns: '55% 45%',
        alignItems: 'center',
        gap: '60px',
      }}>

        {/* LEFT: Image */}
        <div
          className="lp-dm-img-wrap"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateX(-24px)',
            transition: 'opacity 0.75s ease, transform 0.75s ease',
            position: 'relative',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
        >
          {!imgLoaded && (
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '340px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                overflow: 'hidden',
                animation: 'skeleton-pulse 1.8s ease-in-out infinite',
                zIndex: 3,
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)',
                animation: 'shimmer-sweep 1.6s ease-in-out infinite',
              }} />
            </div>
          )}
          <div style={{
            filter: imgHovered
              ? 'drop-shadow(0 24px 60px rgba(99,102,241,0.20))'
              : 'drop-shadow(0 12px 32px rgba(99,102,241,0.10))',
            transition: 'filter 0.3s ease',
            width: '100%',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}>
            <div style={{ perspective: '900px' }}>
              <div
                ref={imgWrapRef}
                onMouseEnter={handleImgMouseEnter}
                onMouseLeave={handleImgMouseLeave}
                onMouseMove={handleImgMouseMove}
                style={{
                  transformOrigin: 'center center',
                  animation: imgHovered ? 'none' : 'dm-img-float 7s ease-in-out infinite',
                  transform: imgHovered
                    ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
                    : undefined,
                  transition: imgHovered ? 'transform 0.08s linear' : 'transform 0.7s ease',
                  cursor: 'none',
                }}
              >
                <img
                  id="dm-main-img"
                  src="/assets/data-migration.png"
                  alt="Data Migration Dashboard"
                  ref={actualImgRef}
                  onLoad={() => setImgLoaded(true)}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto', display: 'block',
                    pointerEvents: 'none', userSelect: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Text */}
        <div
          className="lp-dm-text"
          style={{
            display: 'flex', flexDirection: 'column', gap: '20px',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateX(24px)',
            transition: 'opacity 0.75s ease 0.18s, transform 0.75s ease 0.18s',
          }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6366f1', margin: 0,
          }}>Data Migration</p>
          <h2 style={{
            fontSize: 'clamp(26px, 2.8vw, 40px)', fontWeight: 800,
            color: '#0f172a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em',
          }}>Bring Your<br />Old Data Along</h2>
          <p style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
            lineHeight: 1.8, margin: 0,
          }}>
            Starting fresh doesn't mean starting from zero. During onboarding, simply upload
            your old inventory, transactions, CRM, and customer history data.
          </p>
          <p style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
            lineHeight: 1.8, margin: 0,
          }}>
            Luevora AI reads, filters, and maps your legacy data automatically, populating
            your dashboard so you're ready to serve customers from day one.
          </p>
        </div>
      </div>
    </section>
  );
};

export default DataMigrationSection;
