import React, { useState, useEffect, useRef } from 'react';

const FAQSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);

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

  const faqs = [
    { q: 'Is the setup difficult?', a: 'No. A 15 minute conversation in an Agent Talk Session, like interviewing a new employee. Luevora immediately understands your business SOP.' },
    { q: 'Is my data safe?', a: 'Yes. All data is encrypted end-to-end. Luevora only accesses data you authorize.' },
    { q: 'Can I integrate with legacy systems?', a: 'Yes. Upload PDF or Excel files. Luevora reads and maps them automatically into CRM and inventory.' },
    { q: 'How long until it is work ready?', a: '24-48 hours after the Agent Talk Session. Faster than onboarding a new employee.' },
    { q: 'What if Luevora cannot answer?', a: 'It instantly sends a notification to your Telegram with full conversation context. You decide, Luevora executes.' },
    { q: 'Can I cancel anytime?', a: 'Yes. No long term contracts. Cancel anytime without penalty.' },
    { q: 'Is there a setup fee?', a: 'No. Setup is free. You only pay after the 14 day trial is complete.' },
  ];

  return (
    <section ref={sectionRef} style={{
      width: '100%', backgroundColor: '#ffffff', padding: '96px 20px',
      borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: 900, width: '100%' }}>
        <div style={{
          textAlign: 'left', marginBottom: 48,
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(24px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, color: '#0f172a', margin: '0 0 12px', fontFamily: "'Satoshi', sans-serif", letterSpacing: '-0.025em' }}>
            Frequently Asked Questions
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', margin: 0, lineHeight: 1.6, maxWidth: 600 }}>
            Discover quick and comprehensive answers to common questions about our platform, services, and features.
          </p>
        </div>

        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(15,23,42,0.03)',
          padding: '8px 28px',
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
        }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              borderBottom: i < faqs.length - 1 ? '1px dotted #e2e8f0' : 'none',
            }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
                width: '100%', background: 'none', border: 'none', padding: '18px 0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#0f172a',
                fontFamily: "'Satoshi', sans-serif", textAlign: 'left',
              }}>
                {faq.q}
                <span style={{
                  fontSize: 13, transition: 'transform 0.25s ease',
                  transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: '#6366f1', fontWeight: 500,
                }}>â–¼</span>
              </button>
              <div style={{
                maxHeight: openIdx === i ? 200 : 0, overflow: 'hidden',
                transition: 'max-height 0.35s ease, padding 0.35s ease',
                padding: openIdx === i ? '0 0 16px' : '0',
              }}>
                <p style={{
                  fontSize: 15, color: '#475569', lineHeight: 1.7, margin: 0,
                  paddingRight: 40,
                }}>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: 14, color: '#64748b', marginTop: 24, textAlign: 'center',
          opacity: isVisible ? 1 : 0, transition: 'opacity 0.6s ease 0.3s',
        }}>
          Can't find what you are looking for? Contact our{' '}
          <a href="mailto:contact@luevora.com" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
            support team
          </a>
        </p>
      </div>
    </section>
  );
};

export default FAQSection;
