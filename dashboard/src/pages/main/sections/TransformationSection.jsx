import React, { useState, useEffect, useRef } from 'react';

const TransformationSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tasks = [
    {
      label: 'Handle customer inquiries',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      label: 'Manage reservations & bookings',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      label: 'Customer follow-ups',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    },
    {
      label: 'Lead closing',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    },
    {
      label: 'Invoice generation',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      label: 'Operational reports & management summaries',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    },
  ];

  const metrics = [
    { value: 'Jauh Lebih Hemat', label: 'Dibanding hire tim CS penuh' },
    { value: '24/7', label: 'Tidak pernah tutup, tidak pernah libur' },
    { value: 'Tak Terbatas', label: 'Kapasitas handling ribuan chat' },
    { value: '1 Admin', label: 'Kamu tetap boss â€” Luevora eksekusi' },
  ];

  return (
    <section
      className="lp-comparison-section"
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .lp-comparison-section {
          padding: 96px 0 80px;
        }
        .lp-comparison-grid {
          display: grid;
          grid-template-columns: 1fr 56px 1fr;
          align-items: start;
        }
        .lp-comparison-arrow {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 68px;
          gap: 8px;
        }
        .lp-comparison-arrow .line-vertical {
          width: 1px;
          height: 44px;
          background: linear-gradient(to bottom, transparent, #c7d2fe);
        }
        .lp-comparison-arrow .line-vertical-second {
          width: 1px;
          height: 44px;
          background: linear-gradient(to top, transparent, #c7d2fe);
        }
        .lp-comparison-arrow .arrow-svg {
          transform: rotate(0deg);
          transition: transform 0.3s;
        }
        @keyframes tf2-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tf2-check {
          0%   { opacity: 0; transform: scale(0.3); }
          70%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tf2-arrow {
          0%, 100% { transform: translateX(0); }
          50%       { transform: translateX(4px); }
        }
        @media (max-width: 900px) {
          .lp-comparison-section {
            padding: 120px 20px 60px;
          }
          .lp-comparison-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .lp-comparison-arrow {
            padding-top: 0;
            padding: 12px 0;
            flex-direction: row;
            justify-content: center;
          }
          .lp-comparison-arrow .line-vertical {
            width: 44px;
            height: 1px;
            background: linear-gradient(to right, transparent, #c7d2fe);
          }
          .lp-comparison-arrow .line-vertical-second {
            width: 44px;
            height: 1px;
            background: linear-gradient(to left, transparent, #c7d2fe);
          }
          .lp-comparison-arrow .arrow-svg {
            transform: rotate(90deg);
          }
        }
      `}</style>

      <div style={{
        position: 'relative', zIndex: 2,
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 40px',
      }}>

        {/* Header */}
        <div style={{
          textAlign: 'center', marginBottom: '60px',
          opacity: isVisible ? 1 : 0,
          animation: isVisible ? 'tf2-up 0.55s ease 0.05s both' : 'none',
        }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6366f1', marginBottom: '14px',
          }}>Operational Transformation</p>
          <h2 style={{
            fontSize: 'clamp(26px, 3vw, 42px)', fontWeight: 800,
            color: '#0f172a', margin: '0 0 16px',
            lineHeight: 1.2, letterSpacing: '-0.025em',
          }}>
            From an Overloaded Team<br />to Automated Operations
          </h2>
          <p style={{
            fontSize: 'clamp(14px, 1.1vw, 16px)', color: '#64748b',
            maxWidth: '460px', margin: '0 auto', lineHeight: 1.7,
          }}>
            What once required 3 customer service staff and an admin can now be fully handled by Luevora AI, with a single admin focused on oversight and decisions.
          </p>
        </div>

        <div className="lp-comparison-grid">

          {/* BEFORE */}
          <div style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible ? 'tf2-up 0.55s ease 0.15s both' : 'none',
          }}>
            <div style={{
              border: '1px solid #fecaca', borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(239,68,68,0.06)',
            }}>
              <div style={{
                padding: '22px 26px 18px',
                borderBottom: '1px solid #fee2e2',
                backgroundColor: '#fff8f8',
              }}>
                <div style={{
                  display: 'inline-block', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#dc2626', backgroundColor: '#fee2e2',
                  padding: '3px 10px', borderRadius: '4px', marginBottom: '10px',
                }}>Before</div>
                <h3 style={{
                  fontSize: '18px', fontWeight: 700, color: '#111827',
                  margin: '0 0 5px', letterSpacing: '-0.01em',
                }}>3 CS Staff + 1 Admin</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                  Limited hours &middot; Prone to fatigue &middot; Human error risk
                </p>
              </div>

              {/* Staff avatars */}
              <div style={{
                padding: '16px 26px',
                borderBottom: '1px solid #fef2f2',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                {['CS 1', 'CS 2', 'CS 3', 'Admin'].map((role, i) => (
                  <div key={i} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    opacity: isVisible ? 1 : 0,
                    animation: isVisible ? `tf2-up 0.4s ease ${0.22 + i * 0.05}s both` : 'none',
                  }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      backgroundColor: i < 3 ? '#fee2e2' : '#f3f4f6',
                      border: i < 3 ? '1px solid #fca5a5' : '1px solid #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={i < 3 ? '#dc2626' : '#6b7280'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>{role}</span>
                  </div>
                ))}
              </div>

              {/* Tasks */}
              <div style={{ padding: '12px 26px 20px' }}>
                {tasks.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0',
                    borderBottom: i < tasks.length - 1 ? '1px solid #fdf2f2' : 'none',
                    opacity: isVisible ? 1 : 0,
                    animation: isVisible ? `tf2-up 0.4s ease ${0.28 + i * 0.05}s both` : 'none',
                  }}>
                    <span style={{ color: '#fca5a5', flexShrink: 0 }}>{t.icon}</span>
                    <span style={{
                      fontSize: '13px', color: '#9ca3af', flex: 1,
                      textDecoration: 'line-through',
                      textDecorationColor: '#fca5a5',
                      textDecorationThickness: '1.5px',
                    }}>{t.label}</span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, color: '#fca5a5',
                      letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0,
                    }}>Manual</span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '14px 26px',
                borderTop: '1px solid #fee2e2',
                backgroundColor: '#fff8f8',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Daily chat capacity</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>~150 - 300</span>
              </div>
            </div>
          </div>

          {/* CENTER */}
          <div
            className="lp-comparison-arrow"
            style={{
              opacity: isVisible ? 1 : 0,
              animation: isVisible ? 'tf2-up 0.5s ease 0.32s both' : 'none',
            }}
          >
            <div className="line-vertical" />
            <div style={{ animation: isVisible ? 'tf2-arrow 2s ease-in-out infinite' : 'none' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: '#eef2ff',
                border: '1px solid #c7d2fe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg className="arrow-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
            <div className="line-vertical-second" />
          </div>

          {/* AFTER */}
          <div style={{
            opacity: isVisible ? 1 : 0,
            animation: isVisible ? 'tf2-up 0.55s ease 0.22s both' : 'none',
          }}>
            <div style={{
              border: '1px solid #c7d2fe', borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(99,102,241,0.10)',
            }}>
              <div style={{
                padding: '22px 26px 18px',
                borderBottom: '1px solid #e0e7ff',
                backgroundColor: '#f8f7ff',
              }}>
                <div style={{
                  display: 'inline-block', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#4f46e5', backgroundColor: '#e0e7ff',
                  padding: '3px 10px', borderRadius: '4px', marginBottom: '10px',
                }}>With Luevora</div>
                <h3 style={{
                  fontSize: '18px', fontWeight: 700, color: '#111827',
                  margin: '0 0 5px', letterSpacing: '-0.01em',
                }}>Luevora AI + 1 Admin</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Always on 24/7 &middot; Never fatigued &middot; Zero human error
                </p>
              </div>

              {/* Staff avatars */}
              <div style={{
                padding: '16px 26px',
                borderBottom: '1px solid #eef2ff',
                display: 'flex', gap: '10px', alignItems: 'center',
              }}>
                {/* AI */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible ? 'tf2-up 0.4s ease 0.32s both' : 'none',
                }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    backgroundColor: '#e0e7ff',
                    border: '1.5px solid #6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 3px rgba(99,102,241,0.10)',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <path d="M8 21h8M12 17v4"/>
                      <circle cx="12" cy="10" r="2.5"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 700 }}>Luevora AI</span>
                </div>
                {/* Admin */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  opacity: isVisible ? 1 : 0,
                  animation: isVisible ? 'tf2-up 0.4s ease 0.38s both' : 'none',
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>Admin</span>
                </div>
              </div>

              {/* Tasks */}
              <div style={{ padding: '12px 26px 20px' }}>
                {tasks.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0',
                    borderBottom: i < tasks.length - 1 ? '1px solid #f0f1ff' : 'none',
                    opacity: isVisible ? 1 : 0,
                    animation: isVisible ? `tf2-up 0.4s ease ${0.38 + i * 0.05}s both` : 'none',
                  }}>
                    <span style={{ color: '#6366f1', flexShrink: 0 }}>{t.icon}</span>
                    <span style={{ fontSize: '13px', color: '#374151', flex: 1, fontWeight: 500 }}>{t.label}</span>
                    <div style={{
                      width: '17px', height: '17px', borderRadius: '50%',
                      backgroundColor: '#6366f1', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isVisible ? 1 : 0,
                      animation: isVisible ? `tf2-check 0.35s cubic-bezier(0.34,1.56,0.64,1) ${0.62 + i * 0.07}s both` : 'none',
                    }}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '14px 26px',
                borderTop: '1px solid #e0e7ff',
                backgroundColor: '#f8f7ff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Daily chat capacity</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#4f46e5' }}>Unlimited</span>
              </div>
            </div>
          </div>

        </div>

        {/* Metrics row */}
        <div style={{
          marginTop: '52px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden',
          opacity: isVisible ? 1 : 0,
          animation: isVisible ? 'tf2-up 0.55s ease 0.65s both' : 'none',
        }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              backgroundColor: '#fff',
              borderRight: i < metrics.length - 1 ? '1px solid #e5e7eb' : 'none',
              padding: '28px 20px', textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(26px, 2.8vw, 36px)', fontWeight: 800,
                color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '8px',
              }}>{m.value}</div>
              <div style={{
                fontSize: '12px', color: '#94a3b8', lineHeight: 1.5,
                maxWidth: '130px', margin: '0 auto',
              }}>{m.label}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default TransformationSection;
