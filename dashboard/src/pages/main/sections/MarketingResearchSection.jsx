import React, { useState, useEffect, useRef } from 'react';

const MarketingResearchSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  return (
    <section
      id="marketing-research"
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        padding: '0 24px 100px',
        fontFamily: "'Satoshi', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        position: 'absolute', top: '15%', right: '5%',
        width: '420px', height: '420px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div
        className="lp-mktres-grid"
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '60px',
          alignItems: 'center',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(32px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        <style>{`
          @media (max-width: 960px) {
            .lp-mktres-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          }
        `}</style>

        {/* LEFT: Image */}
        <div style={{
          width: '100%',
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px -15px rgba(15,23,42,0.08)',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {!imgError ? (
            <img
              src="/assets/landingpage/resultresearch1.webp"
              alt="Marketing Research Result"
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              aspectRatio: '1271 / 1344',
              background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
              borderRadius: '16px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '12px', padding: '32px', boxSizing: 'border-box',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: 'rgba(99,102,241,0.5)', letterSpacing: '0.06em' }}>1271 × 1344 px</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>resultresearch1.png</span>
            </div>
          )}
        </div>

        {/* RIGHT: Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <p style={{ fontSize: 'clamp(14px, 1.0vw, 15.5px)', color: '#475569', lineHeight: 1.8, margin: 0 }}>
            Luevora AI's Marketing Space transforms customer interaction history, CRM data, and market trends into fully executed growth campaigns using deep, adaptive reasoning. Rather than just offering concepts, the AI conducts comprehensive market research, builds strategic walkthroughs, and directly generates finished assets — including ready-to-post Instagram content, UGC videos, complete Meta and Google Ads, WA/email broadcasts, and ad video files. It serves as an end-to-end creative and strategy engine that turns raw business data into market-ready assets in seconds.
          </p>

          <p style={{ fontSize: 'clamp(14px, 1.0vw, 15.5px)', color: '#475569', lineHeight: 1.8, margin: 0 }}>
            Once your assets and strategic research are ready, execution requires zero manual effort. With a single click, Luevora AI automatically triggers the entire workflow: scheduling and publishing Instagram posts, launching targeted Meta and Google ad campaigns, and sending out automated broadcast messages. It effectively bridges the gap between deep strategic analysis and instant multi-channel execution, running your entire marketing engine completely hands-free.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {['Instagram Content', 'Meta & Google Ads', 'WA/Email Broadcast', 'UGC Videos', 'LinkedIn Ads', 'TikTok Ads', 'YouTube Ads', 'Twitter/X Ads', 'One-Click Execution'].map((tag) => (
              <span key={tag} style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: '12px', fontWeight: 600, color: '#4f46e5',
                background: '#eef2ff', border: '1px solid #c7d2fe',
                borderRadius: '999px', padding: '5px 14px',
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketingResearchSection;
