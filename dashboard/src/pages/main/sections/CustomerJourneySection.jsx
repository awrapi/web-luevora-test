import React from 'react';

const CustomerJourneySection = () => {
  return (
    <section
      id="customer-journey"
      style={{
        position: 'relative',
        width: '100%',
        padding: '100px 24px 120px',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 64px' }}>
          <h2
            style={{
              fontSize: 'clamp(28px, 3.8vw, 48px)',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: '0 0 16px',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            End-to-End Customer Journey Engine
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: '#64748b',
              lineHeight: 1.6,
              margin: 0,
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            From initial lead generation to automated closing, invoicing, and long-term retention.
          </p>
        </div>

        {/* Content Layout: Left Numbered Steps + Right Empty Placeholder Box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '56px',
            alignItems: 'center',
          }}
        >
          {/* Left Column: Numbered List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[
              {
                step: '01',
                title: 'Lead Generation & Marketing Space',
                desc: 'Deep thinking AI reads internal data, customer behavior, and market trends to auto-generate targeted Meta & Google Ads campaigns with 1-click execution.',
              },
              {
                step: '02',
                title: 'Autonomous Consultation & Multi-Branch Sales',
                desc: 'Handles inquiries 24/7 across WhatsApp, Instagram, Telegram, and Email with multi-branch routing and long-term cross-platform memory.',
              },
              {
                step: '03',
                title: 'Automated Closing, Invoicing & Operations',
                desc: 'Generates Midtrans payment links, creates PDF invoices, updates inventory slots, syncs custom Excel sheets, and routes approvals to Telegram.',
              },
            ].map((item) => (
              <div key={item.step} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontWeight: 800,
                    fontSize: '13px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    flexShrink: 0,
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 8px',
                      fontFamily: "'Satoshi', sans-serif",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#64748b',
                      lineHeight: 1.65,
                      margin: 0,
                      fontFamily: "'Satoshi', sans-serif",
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                className="solid-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Satoshi', sans-serif",
                  height: 'auto',
                  maxHeight: '52px',
                  width: 'fit-content',
                  boxSizing: 'border-box',
                }}
                onClick={() => window.location.href = '/register'}
              >
                Start Free Trial
              </button>
            </div>
          </div>

          {/* Right Column: Clean Empty Photo Placeholder Container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                height: '460px',
                borderRadius: '24px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomerJourneySection;
