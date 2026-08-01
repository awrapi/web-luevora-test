import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from './useThrottledMouseMove';

const PhoneMockup = () => {
  const phoneRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [shine, setShine] = useState({ x: 50, y: 50 });
  const [imgLoaded, setImgLoaded] = useState(false);
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

  const _phoneMove = useCallback((e) => {
    if (!phoneRef.current) return;
    const rect = phoneRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -14, y: dx * 14 });
    setShine({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);
  const handleMouseMove = useThrottledMouseMove(_phoneMove);

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <>
      <style>{`
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes phone-reveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div
        ref={phoneRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="lp-phone-mockup-wrap"
        style={{
          position: 'relative',
          width: '100%',
          height: '520px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          zIndex: 2,
          perspective: '1000px',
          cursor: 'default',
        }}
      >
        {/* â”€â”€ SKELETON (visible while image loads) â”€â”€ */}
        {!imgLoaded && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: '100%',
              maxWidth: '560px',
              height: '480px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '16px',
              animation: 'skeleton-pulse 1.8s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            {/* Left phone skeleton */}
            <div
              style={{
                position: 'relative',
                width: '180px',
                height: '360px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #e8eef8 0%, #dce6f5 100%)',
                overflow: 'hidden',
                flexShrink: 0,
                alignSelf: 'flex-end',
                marginBottom: '20px',
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                animation: 'shimmer-sweep 1.6s ease-in-out infinite',
              }} />
            </div>
            {/* Right phone skeleton */}
            <div
              style={{
                position: 'relative',
                width: '200px',
                height: '420px',
                borderRadius: '32px',
                background: 'linear-gradient(135deg, #dce6f5 0%, #cdd9f0 100%)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                animation: 'shimmer-sweep 1.6s ease-in-out infinite 0.3s',
              }} />
            </div>
          </div>
        )}

        {/* Glow aura â€” perfectly circular so no hard rectangular edges show */}
        <div
          style={{
            position: 'absolute',
            right: '10%',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: isHovered
              ? 'radial-gradient(circle, rgba(59,130,246,0.20) 0%, rgba(96,165,250,0.06) 55%, transparent 70%)'
              : 'transparent',
            transition: 'background 0.5s ease',
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* OUTER: fade-in reveal + drop-shadow (no 3D transform here = no blur) */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '560px',
            marginLeft: 'auto',
            opacity: imgLoaded ? 1 : 0,
            animation: imgLoaded ? 'phone-reveal 0.9s ease forwards' : 'none',
            filter: isHovered
              ? 'drop-shadow(0 32px 52px rgba(59,130,246,0.38)) drop-shadow(0 8px 18px rgba(0,0,0,0.18))'
              : 'drop-shadow(0 10px 24px rgba(0,0,0,0.10))',
            transition: 'filter 0.4s ease',
          }}
        >
          {/* INNER: 3D tilt only â€” no filter here prevents blur on GPU compositing */}
          <div
            style={{
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.045 : 1})`,
              transition: isHovered
                ? 'transform 0.08s linear'
                : 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            <img
              src="/assets/phones.png?v=3"
              alt="Luevora App Mockup"
              ref={actualImgRef}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                imageRendering: 'auto',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneMockup;
