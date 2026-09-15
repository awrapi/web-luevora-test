import React, { useEffect, useRef, useState } from 'react';

const CoordinatorSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fadeUp = (delay = 0) => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'none' : 'translateY(24px)',
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });

  const points = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: '90% Coordination Time Saved',
      desc: 'No more waiting for an admin to forward chats to the field team.',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      title: 'Zero Missed Dispatch',
      desc: 'Every assignment is recorded neatly in the log — nothing slips through.',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: 'Accurate & SOP-Compliant',
      desc: 'Every decision, permission, or schedule always passes company rules and the correct approval hierarchy.',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      title: 'Business Open 24/7',
      desc: 'Execution, scheduling, and internal coordination keep running even after the office closes.',
    },
  ];

  return (
    <section
      ref={sectionRef}
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '96px 20px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 1080, width: '100%' }}>

        {/* Label */}
        <div style={{ ...fadeUp(0), marginBottom: 16 }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 100,
            padding: '5px 16px',
            fontSize: 12,
            fontWeight: 600,
            color: '#6366f1',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: "'Satoshi', sans-serif",
          }}>
            Operational Coordination
          </span>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 56,
          alignItems: 'center',
        }}>

          {/* Left — text */}
          <div style={{ flex: '1 1 340px', minWidth: 280 }}>
            <h2 style={{
              ...fadeUp(80),
              fontSize: 'clamp(24px, 3vw, 38px)',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 36px',
              fontFamily: "'Satoshi', sans-serif",
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
            }}>
              Operations Run with Precision, No Manual "Control Center" Team Needed
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {points.map(({ icon, title, desc }, i) => (
                <div
                  key={i}
                  style={{
                    ...fadeUp(160 + i * 80),
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: "'Satoshi', sans-serif",
                      marginBottom: 4,
                    }}>{title}</div>
                    <div style={{
                      fontSize: 14,
                      color: '#64748b',
                      lineHeight: 1.65,
                      fontFamily: "'Inter', sans-serif",
                    }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — chat image */}
          <div style={{
            ...fadeUp(200),
            flex: '1 1 340px',
            minWidth: 280,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <img
              src="/assets/landingpage/coordinator.webp"
              alt="Luevora AI coordinator chat example"
              style={{
                width: '100%',
                maxWidth: 460,
                borderRadius: 20,
                boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
                border: '1px solid #e2e8f0',
                display: 'block',
              }}
            />
          </div>

        </div>
      </div>
    </section>
  );
};

export default CoordinatorSection;
