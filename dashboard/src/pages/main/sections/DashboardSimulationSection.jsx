import React, { useState, useEffect, useRef } from 'react';

const DashboardSimulationSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  return (
    <section
      id="simulation"
      ref={sectionRef}
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '80px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderTop: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <style>{`
        .lp-sim-container {
          display: flex;
          flex-direction: row;
          gap: 40px;
          width: 100%;
          max-width: 1300px;
          align-items: flex-start;
        }
        .lp-sim-tabs {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 220px;
          flex-shrink: 0;
        }
        .lp-sim-tab-btn {
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid #e2e8f0;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s ease;
        }
        .lp-sim-window-wrap {
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 900px) {
          .lp-sim-container {
            flex-direction: column;
            gap: 24px;
            align-items: stretch;
          }
          .lp-sim-tabs {
            flex-direction: row;
            flex-wrap: wrap;
            width: 100%;
            gap: 8px;
          }
          .lp-sim-tab-btn {
            justify-content: center;
            flex: 1 1 calc(50% - 4px);
            padding: 10px 14px;
            font-size: 13px;
            gap: 8px;
          }
          .lp-sim-tab-btn:last-child {
            flex: 1 1 100%;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: '1200px',
          width: '100%',
          textAlign: 'center',
          marginBottom: '40px',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(20px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#6366f1',
            display: 'inline-block',
            marginBottom: '12px',
          }}
        >
          SEE LUEVORA IN ACTION
        </span>
        <h2
          style={{
            fontSize: 'clamp(28px, 3.2vw, 44px)',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 16px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          Meet the AI That Runs Your Front Desk, Not Just Your Inbox
        </h2>
        <p
          style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)',
            color: '#475569',
            maxWidth: '750px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          From checking schedules to closing a reservation, Luevora handles the full conversation and hands off to your team only when a real decision is needed
        </p>
      </div>

      <div className="lp-sim-container">
        {/* Left Column: Tab switcher (stacked vertically) */}
        <div
          className="lp-sim-tabs"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s',
            zIndex: 10,
          }}
        >
          <button
            className="lp-sim-tab-btn"
            onClick={() => setActiveTab('overview')}
            style={{
              backgroundColor: activeTab === 'overview' ? '#6366f1' : '#f8fafc',
              color: activeTab === 'overview' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'overview' ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
            }}
          >
            {/* Dashboard Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9"/>
              <rect x="14" y="3" width="7" height="5"/>
              <rect x="14" y="12" width="7" height="9"/>
              <rect x="3" y="16" width="7" height="5"/>
            </svg>
            Overview
          </button>
          <button
            className="lp-sim-tab-btn"
            onClick={() => setActiveTab('leads')}
            style={{
              backgroundColor: activeTab === 'leads' ? '#6366f1' : '#f8fafc',
              color: activeTab === 'leads' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'leads' ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
            }}
          >
            {/* Inbox/Messages Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            Leads Inbox
          </button>
          <button
            className="lp-sim-tab-btn"
            onClick={() => setActiveTab('human')}
            style={{
              backgroundColor: activeTab === 'human' ? '#6366f1' : '#f8fafc',
              color: activeTab === 'human' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'human' ? '0 4px 12px rgba(99,102,241,0.25)' : 'none',
            }}
          >
            {/* Human/Routing Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Human Routing
          </button>
        </div>

        {/* Right Column: Browser Window Wrapper */}
        <div
          className="lp-sim-window-wrap"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'none' : 'translateY(40px)',
            transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
          }}
        >
          <div
            style={{
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
            }}
          >
            {/* Browser Titlebar */}
            <div
              style={{
                height: '40px',
                backgroundColor: '#edf2f7',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                position: 'relative',
              }}
            >
              {/* Windows Dots */}
              <div style={{ display: 'flex', gap: '8px', position: 'absolute', left: '16px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
              </div>

              {/* Browser Address Bar */}
              <div
                style={{
                  margin: '0 auto',
                  width: '60%',
                  maxWidth: '400px',
                  height: '24px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: '#718096',
                  fontWeight: 500,
                }}
              >
                {activeTab === 'overview' 
                  ? 'luevora-dashboard-simulator.local/overview' 
                  : activeTab === 'leads'
                    ? 'luevora-dashboard-simulator.local/leads'
                    : 'luevora-dashboard-simulator.local/human-routing'}
              </div>
            </div>

            {/* Browser Iframe content */}
            <iframe
              src={
                activeTab === 'overview' 
                  ? '/simulation.html' 
                  : activeTab === 'leads' 
                    ? '/simulation2.html' 
                    : '/simulation3.html'
              }
              title="Luevora Dashboard Simulator"
              style={{
                width: '100%',
                height: '700px',
                border: 'none',
                display: 'block',
                backgroundColor: '#ffffff',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardSimulationSection;
