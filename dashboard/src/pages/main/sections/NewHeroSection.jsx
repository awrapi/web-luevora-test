import React, { useState, useEffect, useRef } from 'react';
import PhoneMockup from '../shared/PhoneMockup';

const NewHeroSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <>
      <style>{`
        .solid-btn-primary {
          background: #000;
          color: #fff;
          border: none;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 700;
          border-radius: 999px;
          cursor: pointer;
          font-family: 'Satoshi', sans-serif !important;
          transition: background 0.2s, transform 0.2s;
        }
        .solid-btn-primary:hover {
          background: #222;
          transform: translateY(-2px);
        }
        .btn-secondary-light {
          background: #fff;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 700;
          border-radius: 999px;
          cursor: pointer;
          font-family: 'Satoshi', sans-serif !important;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .btn-secondary-light:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-2px);
        }
      `}</style>

      <section
        id="home"
        className="lp-new-hero-section"
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #4f46e5 0%, #6366f1 20%, #818cf8 45%, #c7d2fe 70%, #ffffff 90%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          textAlign: 'left',
          padding: '120px 24px 80px',
          overflow: 'hidden',
          zIndex: 1,
          borderBottom: '1px solid #e5e7eb',
        }}
      >

        <div
          style={{
            position: 'relative',
            zIndex: 5,
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '48px',
            alignItems: 'center',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateY(30px)',
            transition: 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
            <h1
              style={{
                fontSize: 'clamp(36px, 5.5vw, 68px)',
                fontWeight: 900,
                color: '#0f172a',
                lineHeight: 1.1,
                letterSpacing: '-0.035em',
                margin: '0 0 20px',
                textAlign: 'left',
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              Hire an AI Employee<br />
              That Runs Your Business.
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px, 1.25vw, 19px)',
                color: '#475569',
                lineHeight: 1.65,
                margin: '0 0 38px',
                maxWidth: '560px',
                textAlign: 'left',
                fontWeight: 500,
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              Customer support, sales, operations, and reporting, all handled by one AI Operational Employee that works 24/7, so your team can focus on growing the business.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                justifyContent: 'flex-start',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <a
                href="/register"
                className="solid-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Start Free Trial
              </a>
              <a
                href="#simulation"
                className="btn-secondary-light"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
              >
                See Demo
              </a>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PhoneMockup />
          </div>
        </div>
      </section>
    </>
  );
};

export default NewHeroSection;
