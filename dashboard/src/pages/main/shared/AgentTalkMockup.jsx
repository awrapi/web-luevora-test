import React, { useState, useEffect, useRef, useCallback } from 'react';
import useThrottledMouseMove from './useThrottledMouseMove';

const AgentTalkMockup = () => {
  const imgRef = useRef(null);
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

  const _agentMove = useCallback((e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -8, y: dx * 8 });
  }, []);
  const handleMouseMove = useThrottledMouseMove(_agentMove);

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <>
      <style>{`
        @keyframes agent-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes agent-reveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes corner-glow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div
        ref={imgRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="lp-agent-mockup-wrap"
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          perspective: '1000px',
          cursor: 'default',
        }}
      >
        {/* Skeleton while loading */}
        {!imgLoaded && (
          <div style={{
            width: '100%',
            maxWidth: '600px',
            height: '420px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            overflow: 'hidden',
            animation: 'skeleton-pulse 1.8s ease-in-out infinite',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.15) 50%, transparent 100%)',
              animation: 'shimmer-sweep 1.6s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Purple glow aura â€” blooms on hover */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: isHovered
            ? 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(99,102,241,0.08) 50%, transparent 70%)'
            : 'transparent',
          transition: 'background 0.5s ease',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Decorative corner brackets that light up on hover */}
        {isHovered && [
          { top: -8, left: -8, borderTop: '2px solid', borderLeft: '2px solid', borderRadius: '4px 0 0 0' },
          { top: -8, right: -8, borderTop: '2px solid', borderRight: '2px solid', borderRadius: '0 4px 0 0' },
          { bottom: -8, left: -8, borderBottom: '2px solid', borderLeft: '2px solid', borderRadius: '0 0 0 4px' },
          { bottom: -8, right: -8, borderBottom: '2px solid', borderRight: '2px solid', borderRadius: '0 0 4px 0' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: '28px',
            height: '28px',
            borderColor: 'rgba(168,85,247,0.9)',
            animation: 'corner-glow 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
            pointerEvents: 'none',
            zIndex: 4,
            ...s,
          }} />
        ))}

        {/* OUTER: fade-in + drop-shadow (no 3D here = no blur) */}
        <div style={{
          opacity: imgLoaded ? 1 : 0,
          animation: imgLoaded ? 'agent-reveal 0.9s ease forwards' : 'none',
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '600px',
          filter: isHovered
            ? 'drop-shadow(0 24px 50px rgba(139,92,246,0.45)) drop-shadow(0 6px 20px rgba(0,0,0,0.4))'
            : 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))',
          transition: 'filter 0.4s ease',
        }}>
          {/* INNER: 3D tilt only, no filter */}
          <div style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.035 : 1})`,
            transition: isHovered
              ? 'transform 0.08s linear'
              : 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
            <img
              src="/assets/agent-talk.png"
              alt="Agent Talk Session Illustration"
              ref={actualImgRef}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                borderRadius: '16px',
                animation: isHovered ? 'none' : 'agent-float 6s ease-in-out infinite',
              }}
            />

            {/* Shine glare overlay on hover */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: isHovered
                ? 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(139,92,246,0.06) 100%)'
                : 'transparent',
              pointerEvents: 'none',
              transition: 'background 0.4s ease',
              borderRadius: '16px',
            }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentTalkMockup;
