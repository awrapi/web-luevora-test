import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from './useThrottledMouseMove';

const LaptopMockup = () => {
  const laptopRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
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

  const _laptopMove = useCallback((e) => {
    if (!laptopRef.current) return;
    const rect = laptopRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -10, y: dx * 10 });
  }, []);
  const handleMouseMove = useThrottledMouseMove(_laptopMove);

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <>
      <style>{`
        @keyframes laptop-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes laptop-reveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div
        ref={laptopRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="lp-laptop-mockup-wrap"
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          cursor: 'default',
          perspective: '1000px',
        }}
      >
        {/* Skeleton shimmer while image loads */}
        {!imgLoaded && (
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              height: '420px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              animation: 'skeleton-pulse 1.8s ease-in-out infinite',
            }}
          >
            {/* Screen part */}
            <div
              style={{
                position: 'relative',
                width: '85%',
                height: '75%',
                borderRadius: '10px 10px 0 0',
                background: 'linear-gradient(135deg, #e0e8f8 0%, #ccd8f0 100%)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                animation: 'shimmer-sweep 1.6s ease-in-out infinite',
              }} />
            </div>
            {/* Base/keyboard part */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '25%',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #d0dcf0 0%, #bfcce8 100%)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                animation: 'shimmer-sweep 1.6s ease-in-out infinite 0.2s',
              }} />
            </div>
          </div>
        )}

        {/* Glow aura */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: isHovered
              ? 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(96,165,250,0.06) 55%, transparent 70%)'
              : 'transparent',
            transition: 'background 0.5s ease',
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* OUTER: fade-in + drop-shadow (no 3D transform = no blur) */}
        <div
          style={{
            opacity: imgLoaded ? 1 : 0,
            animation: imgLoaded ? 'laptop-reveal 0.9s ease forwards' : 'none',
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '650px',
            filter: isHovered
              ? 'drop-shadow(0 30px 50px rgba(59,130,246,0.32)) drop-shadow(0 8px 18px rgba(0,0,0,0.16))'
              : 'drop-shadow(0 8px 24px rgba(0,0,0,0.10))',
            transition: 'filter 0.4s ease',
          }}
        >
          {/* INNER: 3D tilt only â€” no filter to keep rendering crisp */}
          <div
            style={{
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.04 : 1})`,
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
              src="/assets/laptop.png"
              alt="Luevora on Laptop"
              ref={actualImgRef}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                /* Float animation only when NOT hovered */
                animation: isHovered ? 'none' : 'laptop-float 6s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default LaptopMockup;
