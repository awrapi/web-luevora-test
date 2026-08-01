import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from './useThrottledMouseMove';

const ChatOpsPhoneMockup = () => {
  const phoneRef = useRef(null);
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

  const _chatopsMove = useCallback((e) => {
    if (!phoneRef.current) return;
    const rect = phoneRef.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setTilt({ x: dy * -12, y: dx * 12 });
  }, []);
  const handleMouseMove = useThrottledMouseMove(_chatopsMove);

  const handleMouseLeave = () => { setTilt({ x: 0, y: 0 }); setIsHovered(false); };

  return (
    <>
      <style>{`
        @keyframes chatops-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes chatops-reveal { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div
        ref={phoneRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="lp-chatops-phone-wrap"
        style={{ position: 'relative', width: '100%', maxWidth: '560px', margin: '0 auto',
          perspective: '1000px', cursor: 'default', minHeight: '680px',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Skeleton */}
        {!imgLoaded && (
          <div style={{ width: '320px', height: '640px', borderRadius: '36px',
            background: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(168,85,247,0.08) 100%)',
            border: '1px solid rgba(236,72,153,0.2)', overflow: 'hidden',
            animation: 'skeleton-pulse 1.8s ease-in-out infinite', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(236,72,153,0.12) 50%, transparent 100%)',
              animation: 'shimmer-sweep 1.6s ease-in-out infinite' }} />
          </div>
        )}
        {/* Glow aura */}
        <div style={{ position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', width: '420px', height: '420px',
          borderRadius: '50%',
          background: isHovered
            ? 'radial-gradient(circle, rgba(236,72,153,0.20) 0%, rgba(168,85,247,0.06) 55%, transparent 70%)'
            : 'transparent',
          transition: 'background 0.5s ease', filter: 'blur(40px)', pointerEvents: 'none' }} />
        {/* Outer: fade + shadow */}
        <div style={{ opacity: imgLoaded ? 1 : 0,
          animation: imgLoaded ? 'chatops-reveal 0.9s ease forwards' : 'none',
          position: 'relative', zIndex: 2, width: '100%',
          filter: isHovered
            ? 'drop-shadow(0 28px 52px rgba(236,72,153,0.40)) drop-shadow(0 6px 18px rgba(0,0,0,0.5))'
            : 'drop-shadow(0 10px 32px rgba(0,0,0,0.55))',
          transition: 'filter 0.4s ease' }}>
          {/* Inner: tilt only */}
          <div style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.04 : 1})`,
            transition: isHovered ? 'transform 0.08s linear' : 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
            transformStyle: 'preserve-3d', willChange: 'transform',
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <img
              src="/assets/chatops-phone.png"
              alt="ChatOps Assistant Phone"
              ref={actualImgRef}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
              style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block',
                animation: isHovered ? 'none' : 'chatops-float 6s ease-in-out infinite' }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatOpsPhoneMockup;
