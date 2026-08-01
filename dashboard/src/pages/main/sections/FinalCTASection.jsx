import React, { useState, useEffect, useRef } from 'react';

const FinalCTASection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} style={{
      width: '100%', backgroundColor: '#ffffff', padding: '88px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        maxWidth: 600,
        opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(24px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#0f172a', margin: '0 0 14px', fontFamily: "'Satoshi', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Ready for a 14 Day Free Trial?
        </h2>
        <p style={{ fontSize: 17, color: '#475569', margin: '0 0 36px', lineHeight: 1.6 }}>
          No credit card required. Cancel anytime.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/register" style={{
            display: 'inline-flex', padding: '16px 34px', fontSize: 16, fontWeight: 700,
            borderRadius: 999, background: '#6366f1', color: '#fff', textDecoration: 'none',
            fontFamily: "'Satoshi', sans-serif", transition: 'transform 0.2s',
          }}>Start Free</a>
          <a href="#simulation" style={{
            display: 'inline-flex', padding: '16px 34px', fontSize: 16, fontWeight: 700,
            borderRadius: 999, background: 'transparent', color: '#0f172a',
            border: '1px solid #e2e8f0', textDecoration: 'none',
            fontFamily: "'Satoshi', sans-serif", transition: 'transform 0.2s',
          }}>See Demo</a>
        </div>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: '24px 0 0' }}>
          Join 200+ Founding Members
        </p>
      </div>
    </section>
  );
};

export default FinalCTASection;
