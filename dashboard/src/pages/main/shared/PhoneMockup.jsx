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
        @keyframes phone-reveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (max-width: 640px) {
          .lp-phone-mockup-wrap {
            height: clamp(280px, 75vw, 420px) !important;
            justify-content: center !important;
          }
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
