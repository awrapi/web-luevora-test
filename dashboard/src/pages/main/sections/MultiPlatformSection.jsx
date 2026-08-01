import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from '../shared/useThrottledMouseMove';

const MultiPlatformSection = () => {
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

  const _mpImgMove = useCallback((e) => {
    if (!imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width  - 0.5;
    const ny = (e.clientY - rect.top)  / rect.height - 0.5;
    setTilt({ x: ny * -10, y: nx * 8 });
  }, []);
  const handleImgMouseMove = useThrottledMouseMove(_mpImgMove);
  const handleImgMouseEnter = () => setImgHovered(true);
  const handleImgMouseLeave = () => { setImgHovered(false); setTilt({ x: 0, y: 0 }); };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(section);
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
        @keyframes mp-img-float {
          0%, 100% { transform: translateY(0px); }
          35%       { transform: translateY(-12px); }
          68%       { transform: translateY(-6px); }
        }
      `}</style>

      <div className="lp-mp-grid" style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 40px',
        display: 'grid',
        gridTemplateColumns: '45% 55%',
        alignItems: 'center',
        gap: '60px',
      }}>

        {/* LEFT: Text */}
        <div
          className="lp-mp-text"
          style={{
            display: 'flex', flexDirection: 'column', gap: '20px',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateX(-24px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6366f1', margin: 0,
          }}>Multi-Platform Agent</p>
          <h2 style={{
            fontSize: 'clamp(26px, 2.8vw, 40px)', fontWeight: 800,
            color: '#0f172a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em',
          }}>Omnichannel Support<br />with Perfect Memory</h2>
          <p style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
            lineHeight: 1.8, margin: 0,
          }}>
            Stop losing track of customer chats spread across different apps. Luevora seamlessly
            connects to WhatsApp, LINE, Instagram, Facebook, Telegram, and Email.
          </p>
          <p style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
            lineHeight: 1.8, margin: 0,
          }}>
            The best part? It features an{' '}
            <strong style={{ color: '#0f172a', fontWeight: 700 }}>"all-in-one memory"</strong>.
            The AI remembers your customers across every platform, meaning no more asking them to repeat
            themselves.
          </p>
        </div>

        {/* RIGHT: Image */}
        <div
          className="lp-mp-img-wrap"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateX(24px)',
            transition: 'opacity 0.7s ease 0.18s, transform 0.7s ease 0.18s',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'relative',
          }}
        >
          {!imgLoaded && (
            <div
              style={{
                position: 'absolute',
                width: '80%',
                height: '380px',
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
          <div
            ref={imgWrapRef}
            onMouseEnter={handleImgMouseEnter}
            onMouseLeave={handleImgMouseLeave}
            onMouseMove={handleImgMouseMove}
            style={{
              width: '80%',
              transformOrigin: 'center center',
              animation: imgHovered ? 'none' : 'mp-img-float 7s ease-in-out infinite',
              transform: imgHovered
                ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
                : undefined,
              transition: imgHovered ? 'transform 0.08s linear' : 'transform 0.7s ease',
              filter: imgHovered
                ? 'drop-shadow(0 24px 60px rgba(99,102,241,0.20))'
                : 'drop-shadow(0 12px 32px rgba(99,102,241,0.10))',
              cursor: 'none',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          >
            <img
              id="mp-main-img"
              src="/assets/multiplatform.png"
              alt="Multi-Platform Agent"
              ref={actualImgRef}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block',
                pointerEvents: 'none', userSelect: 'none' }}
            />
          </div>
        </div>

      </div>
    </section>
  );
};

export default MultiPlatformSection;
