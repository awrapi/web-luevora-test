import React, { useEffect, useRef, useState } from 'react';

const AboutUsSection = () => {
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
    transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
  });

  return (
    <section
      ref={sectionRef}
      id="about-us"
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '96px 20px',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 900, width: '100%' }}>

        {/* Header */}
        <div style={{ ...fadeUp(0), textAlign: 'left', marginBottom: 48 }}>
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
            marginBottom: 16,
          }}>
            About Us
          </span>
          <h2 style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 12px',
            fontFamily: "'Satoshi', sans-serif",
            letterSpacing: '-0.025em',
          }}>
            Built to run your business, end-to-end.
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', margin: 0, lineHeight: 1.6, maxWidth: 600 }}>
            The full story behind Luevora AI and why we built it.
          </p>
        </div>

        {/* Content card */}
        <div style={{
          ...fadeUp(150),
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(15,23,42,0.03)',
          padding: 'clamp(24px, 4vw, 40px)',
          marginBottom: 32,
        }}>
          <p style={{
            fontSize: 'clamp(15px, 1.5vw, 16px)',
            color: '#334155',
            lineHeight: 1.85,
            margin: '0 0 24px',
            fontFamily: "'Inter', sans-serif",
          }}>
            We are a technology company developing <strong style={{ color: '#0f172a' }}>Luevora AI</strong>, a full virtual AI team that runs business operations
            end-to-end, every day. Starting from generating leads, serving and closing customers, updating daily data and
            operational statuses, to actively reaching out to staff, managers, or anyone on the internal team to request
            decisions, deliver information, forward instructions, and execute operational workflows.
          </p>

          <div style={{
            width: 40, height: 2,
            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
            borderRadius: 2,
            margin: '0 0 24px',
          }} />

          <p style={{
            fontSize: 'clamp(15px, 1.5vw, 16px)',
            color: '#334155',
            lineHeight: 1.85,
            margin: 0,
            fontFamily: "'Inter', sans-serif",
          }}>
            Founded in 2025, we started from a simple observation: most AI customer service tools are stuck in
            &ldquo;replying to customer chats, managing closings, and updating CRM.&rdquo; Real AI should go further,
            communicating in two directions: to customers on one side and internal teams on the other, bridging both sides
            in real-time. Like an operational coordinator working 24 hours a day and a smart agent that helps businesses
            grow by drafting strategies and creating content to attract potential new customers.{' '}
            <strong style={{ color: '#0f172a' }}>That&apos;s what we built with Luevora AI.</strong>
          </p>
        </div>

        {/* Stats row */}
        <div style={{
          ...fadeUp(300),
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          {[
            { value: '2025', label: 'Year Founded' },
            { value: '24 / 7', label: 'Always Operating' },
            { value: '360°', label: 'End-to-End Automation' },
          ].map(({ value, label }) => (
            <div key={label} style={{
              flex: '1 1 160px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '20px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(20px, 2.5vw, 28px)',
                fontWeight: 800,
                color: '#6366f1',
                fontFamily: "'Satoshi', sans-serif",
                marginBottom: 4,
              }}>{value}</div>
              <div style={{
                fontSize: 13,
                color: '#64748b',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
              }}>{label}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default AboutUsSection;
