import React, { useState, useEffect, useRef } from 'react';

const PricingSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [isYearly, setIsYearly] = useState(false);

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

  const tiersMonthly = [
    { name: 'Lite', price: '799K', creditLabel: '15,000 Credits', features: ['WhatsApp Platform', 'AI Agent Talk Session (basic)', 'Bring Your Old Data (basic)', 'Flash Lite Model'], hl: false },
    { name: 'Starter', price: '1.75M', creditLabel: '50,000 Credits', features: ['Flash Model', 'AI Copilot', 'Automation Workflow', 'Higher Data Import Limit', 'Higher AI Talk Session Limit'], hl: true },
    { name: 'Growth', price: '3.5M', creditLabel: '125,000 Credits', features: ['Medium AI (Claude Sonnet)', 'AI Copilot', 'AI Telegram Routing', 'Higher Data Import Limit', 'Higher AI Talk Session Limit'], hl: false },
    { name: 'Scale', price: '6.25M', creditLabel: '200,000 Credits', features: ['Everything in Growth', 'Highest Usage Limits', 'Premium AI (Claude Opus)'], hl: false },
  ];

  const tiersYearly = [
    { name: 'Lite', price: '6.65M', creditLabel: 'per year', features: ['WhatsApp Platform', 'AI Agent Talk Session (basic)', 'Bring Your Old Data (basic)', 'Flash Lite Model'], hl: false },
    { name: 'Starter', price: '14.6M', creditLabel: 'per year', features: ['Flash Model', 'AI Copilot', 'Automation Workflow', 'Higher Data Import Limit', 'Higher AI Talk Session Limit'], hl: true },
    { name: 'Growth', price: '29.2M', creditLabel: 'per year', features: ['Medium AI (Claude Sonnet)', 'AI Copilot', 'AI Telegram Routing', 'Higher Data Import Limit', 'Higher AI Talk Session Limit'], hl: false },
    { name: 'Scale', price: '52.1M', creditLabel: 'per year', features: ['Everything in Growth', 'Highest Usage Limits', 'Premium AI (Claude Opus)'], hl: false },
  ];

  const tiers = isYearly ? tiersYearly : tiersMonthly;

  const creditPackages = [
    { credits: '4,000', price: 'Rp50K' },
    { credits: '12,000', price: 'Rp150K' },
    { credits: '25,000', price: 'Rp300K' },
    { credits: '42,000', price: 'Rp500K' },
  ];

  return (
    <section ref={sectionRef} style={{
      width: '100%', backgroundColor: '#ffffff', padding: '60px 16px 40px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <style>{`
        .lp-price-card { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .lp-price-card:hover { transform: translateY(-6px); }
        .lp-price-card:hover .lp-price-btn-outline { background: #f1f5f9; border-color: #6366f1; }
        .lp-price-card:hover .lp-price-btn-primary { box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
        .lp-pricing-toggle { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 999px; padding: 4px; display: inline-flex !important; flex-direction: row !important; align-items: center !important; height: 48px !important; max-height: 48px !important; box-sizing: border-box; }
        .lp-pricing-toggle-btn { border: none; background: transparent; padding: 8px 24px !important; border-radius: 999px !important; font-size: 14px; font-weight: 700; font-family: 'Satoshi', sans-serif; cursor: pointer; color: #64748b; transition: all 0.2s ease; height: 40px !important; max-height: 40px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; box-sizing: border-box; }
        .lp-pricing-toggle-btn.active { background: #6366f1; color: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.25); }
        @media (max-width: 768px) {
          .lp-pricing-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1260, width: '100%' }}>
        {/* Free Trial Banner */}
        <div style={{
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          maxWidth: 620, margin: '0 auto 56px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 14, padding: '18px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', marginBottom: 6, fontFamily: "'Satoshi', sans-serif" }}>
            Start for free.
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            Every new workspace includes free Bring Your Old Data trial (limited pages) and one free AI Agent Talk Session before upgrading.
          </div>
        </div>

        {/* Header */}
        <div style={{
          textAlign: 'center', maxWidth: 640, margin: '0 auto 40px',
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.7s ease 0.08s, transform 0.7s ease 0.08s',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6366f1', display: 'inline-block', marginBottom: 14, fontFamily: "'Satoshi', sans-serif" }}>
            Pricing
          </span>
          <h2 style={{ fontSize: 'clamp(30px, 3.5vw, 46px)', fontWeight: 800, color: '#0f172a', margin: '0 0 12px', fontFamily: "'Satoshi', sans-serif", letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Choose the Perfect Plan
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
            Scale your AI workforce with the plan that fits your company.
          </p>
        </div>

        {/* Monthly / Yearly Toggle */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: 48,
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(12px)',
          transition: 'opacity 0.7s ease 0.12s, transform 0.7s ease 0.12s',
        }}>
          <div className="lp-pricing-toggle">
            <button
              className={`lp-pricing-toggle-btn${!isYearly ? ' active' : ''}`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button
              className={`lp-pricing-toggle-btn${isYearly ? ' active' : ''}`}
              onClick={() => setIsYearly(true)}
              style={{ position: 'relative' }}
            >
              Yearly
              {isYearly && (
                <span style={{
                  position: 'absolute', top: -10, right: -20,
                  background: '#10b981', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  whiteSpace: 'nowrap',
                }}>Save 17%</span>
              )}
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="lp-pricing-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, alignItems: 'start',
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.7s ease 0.16s, transform 0.7s ease 0.16s',
        }}>
          {tiers.map((tier, i) => (
            <div key={tier.name} className="lp-price-card"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                background: '#fff',
                border: tier.hl ? '2px solid #818cf8' : '1px solid #e2e8f0',
                borderRadius: 20,
                padding: tier.hl ? '40px 30px' : '36px 28px',
                boxShadow: tier.hl
                  ? '0 4px 24px rgba(99,102,241,0.10), 0 1px 4px rgba(0,0,0,0.04)'
                  : '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative',
                display: 'flex', flexDirection: 'column',
                ...(tier.hl && { marginTop: -8, paddingBottom: 48 }),
              }}
            >
              {tier.hl && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: '#6366f1', color: '#fff', padding: '5px 18px',
                  borderRadius: 999, fontSize: 11, fontWeight: 700,
                  fontFamily: "'Satoshi', sans-serif", letterSpacing: '0.03em',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                }}>MOST POPULAR</div>
              )}
              {/* Plan Name */}
              <div style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: tier.hl ? '#6366f1' : '#94a3b8',
                fontFamily: "'Satoshi', sans-serif", marginBottom: 16,
                marginTop: tier.hl ? 8 : 0,
              }}>{tier.name}</div>
              {/* Price */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 44, fontWeight: 900, color: '#0f172a', fontFamily: "'Satoshi', sans-serif", lineHeight: 1 }}>
                  Rp{tier.price}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>/{isYearly ? 'year' : 'month'}</span>
              </div>
              {/* Credit badge */}
              <div style={{
                display: 'inline-flex', alignSelf: 'flex-start',
                fontSize: 12, fontWeight: 600, color: '#6366f1',
                background: '#EEF2FF', borderRadius: 7,
                padding: '4px 10px', marginBottom: 28, marginTop: 12,
              }}>
                {tier.creditLabel}
              </div>
              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32, flex: 1 }}>
                {tier.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: '#334155', lineHeight: 1.45 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
              {/* Button */}
              {tier.hl ? (
                <a href="/register" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 50, borderRadius: 14, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  fontFamily: "'Satoshi', sans-serif",
                }} className="lp-price-btn-primary">
                  Get Started
                </a>
              ) : (
                <a href="/register" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 50, borderRadius: 14, fontSize: 15, fontWeight: 700,
                  background: '#fff', color: '#0f172a',
                  border: '1px solid #e2e8f0', textDecoration: 'none',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  fontFamily: "'Satoshi', sans-serif",
                }} className="lp-price-btn-outline">
                  Choose Plan
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p style={{
          fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 32,
          opacity: isVisible ? 1 : 0, transition: 'opacity 0.6s ease 0.4s',
        }}>
          All plans include 14-day free trial. No credit card required. Cancel anytime.
        </p>

        {/* Emergency Credits Box */}
        <div style={{
          marginTop: 56, background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 16, padding: '32px 36px',
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(12px)',
          transition: 'opacity 0.7s ease 0.32s, transform 0.7s ease 0.32s',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: "'Satoshi', sans-serif" }}>
              Need More AI Credits?
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 480 }}>
              Emergency AI Credits are available anytime if your monthly credits run out.
            </p>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14, maxWidth: 760, margin: '0 auto',
          }}>
            {creditPackages.map((pkg, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '16px 18px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontFamily: "'Satoshi', sans-serif", marginBottom: 2 }}>
                  {pkg.credits}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>Credits &mdash; {pkg.price}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '16px 0 0' }}>
          Each AI interaction typically consumes around 15-90 credits depending on the model and complexity.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
