import React, { useState, useRef, useEffect } from 'react';
import Feature3DPreview from './Feature3DPreview';

const EcosystemFeatureMatrixSection = () => {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const marqueeRef1 = useRef(null);
  const marqueeRef2 = useRef(null);
  const rafRef = useRef(null);

  const features = [
    { id: 1, title: 'Multi Branch System', category: 'Operations', image: '/assets/features/feat_multi_branch.png', desc: 'Separation of AI into Sales, Support, and CS Branch Agents connected for seamless cross-departmental coordination.', details: ['Branch Sales Agent', 'Branch Support Agent', 'Branch CS Agent', 'Cross-branch Coordination', 'Unified CRM View'] },
    { id: 2, title: 'Long Memory & Cross-Platform', category: 'Sales', image: '/assets/features/feat_cross_platform.png', desc: 'Remembers customer details across platforms (WhatsApp, Instagram, Facebook, TikTok, Email) for deeply personalized service.', details: ['WhatsApp History Sync', 'Instagram DM Memory', 'Facebook Messenger Log', 'Email Thread Tracking', 'Unified Customer Timeline'] },
    { id: 3, title: 'Integrated CRM Engine', category: 'Sales', image: '/assets/features/feat_crm_engine.png', desc: 'Automatically logs customer data from conversations, last message history, and key operational notes.', details: ['Auto Contact Creation', 'Conversation History', 'Smart Contact Tags', 'Custom Notes', 'Broadcast Messaging', 'Follow-up Scheduling'] },
    { id: 4, title: 'Automated Follow-Up & Tagging', category: 'Sales', image: '/assets/features/feat_auto_followup.png', desc: 'Automated lead tagging (Potential, Warm, Cold) & scheduled auto follow-ups to increase conversion rates.', details: ['Auto Lead Scoring', 'Warm/Cold Tagging', 'Scheduled Follow-ups', 'Smart Reminders', 'Conversion Analytics'] },
    { id: 5, title: 'Support Ticketing System', category: 'Operations', image: '/assets/features/feat_support_ticket.png', desc: 'Dedicated support queue ticket creation whenever customers have specific issues requiring team attention.', details: ['Auto Ticket Creation', 'Priority Queue', 'Agent Assignment', 'Resolution Tracking', 'Customer Feedback Loop'] },
    { id: 6, title: 'Invoicing & Receipt Generator', category: 'Finance', image: '/assets/features/feat_invoice_gen.png', desc: 'Canvas editor for invoice & receipt templates generated automatically by AI upon successful transactions.', details: ['Auto Invoice Generation', 'Custom Templates', 'PDF Export', 'Payment Link Embed', 'Tax Calculation'] },
    { id: 7, title: 'Midtrans Payment Integration', category: 'Finance', image: '/assets/features/feat_midtrans_pay.png', desc: 'Midtrans payment gateway integration to generate payment links and verify transactions automatically.', details: ['Payment Link Generator', 'Auto Verification', 'Refund Processing', 'Multi-payment Methods', 'Settlement Reports'] },
    { id: 8, title: 'Multi-Model Inventory Engine', category: 'Operations', image: '/assets/features/feat_inventory_eng.png', desc: 'Supports diverse business models: schedule slots, product stock, table reservations, and rental/travel units.', details: ['Slot-based Inventory', 'Stock Management', 'Reservation System', 'Rental Unit Tracking', 'Real-time Availability'] },
    { id: 9, title: 'Smart Scheduling & Reminders', category: 'Operations', image: '/assets/features/feat_scheduling.png', desc: 'Tracks trip dates, deposit/installment schedules, and triggers auto follow-ups right on target dates.', details: ['Trip Scheduling', 'Payment Reminders', 'Auto Follow-up', 'Calendar Integration', 'Overdue Alerts'] },
    { id: 10, title: 'Flexible Persona & SOP', category: 'Sales', image: '/assets/features/feat_persona_sop.png', desc: 'Customize service personas, tone of voice, and business SOPs according to company rules.', details: ['Custom Persona Builder', 'Language Style Tuning', 'SOP Template Library', 'Rule-based Routing', 'Behavior Presets'] },
    { id: 11, title: 'Real-Time Excel Sheet Sync', category: 'Integrations', image: '/assets/features/feat_excel_sync.png', desc: 'Bidirectional sync for business Excel & Google Sheet files updated by AI in real time during customer interactions.', details: ['Bidirectional Sync', 'Real-time Updates', 'Google Sheets Support', 'Custom Mapping', 'Conflict Resolution'] },
    { id: 12, title: 'Smart Pipeline Indicator', category: 'Sales', image: '/assets/features/feat_pipeline_ind.png', desc: 'Visual pipeline indicator tracking customer position (exploration stage to prospective closing).', details: ['Visual Pipeline View', 'Stage Auto-detection', 'Progress Tracking', 'Bottleneck Alerts', 'Conversion Forecasting'] },
    { id: 13, title: 'AI Agent Talk Session', category: 'Operations', image: '/assets/features/feat_talk_session.png', desc: 'Interactive text & voice call interview onboarding to populate your business Knowledge Base & SOPs.', details: ['Voice Interview Mode', 'Text Interview Mode', 'Auto KB Population', 'SOP Extraction', 'Quick Onboarding Flow'] },
    { id: 14, title: 'Bring Your Old Data (PDF/Excel)', category: 'Integrations', image: '/assets/features/feat_bring_old_data.png?v=6', desc: 'Upload legacy PDF/Excel files -> AI extracts and maps them automatically into CRM, Inventory, & Sheets.', details: ['PDF Data Extraction', 'Excel Import', 'Auto Field Mapping', 'Duplicate Detection', 'Bulk Import Support'] },
    { id: 15, title: 'Interactive Business Copilot', category: 'Integrations', image: '/assets/features/feat_copilot_cmd.png?v=6', desc: 'Natural language copilot commands for business owners ("How many leads today?", "Follow up John", "Update item Y").', details: ['Natural Language Commands', 'Quick Actions', 'Data Lookup', 'Task Execution', 'Report Generation'] },
    { id: 16, title: 'Human in the Loop (HITL)', category: 'Operations', image: '/assets/features/feat_human_loop.png?v=6', desc: 'Interactive approval dashboard whenever AI encounters edge-case requests outside standard SOPs.', details: ['Approval Dashboard', 'Smart Escalation', 'Context Preservation', 'Manual Override', 'Audit Trail'] },
    { id: 17, title: 'Telegram Smart Routing', category: 'Integrations', image: '/assets/features/feat_telegram_route.png?v=6', desc: 'Intelligent routing for transaction notifications & approvals sent separately to owners, managers, or admins.', details: ['Multi-role Routing', 'Approval Notifications', 'Transaction Alerts', 'Status Updates', 'Command Responses'] },
  ];

  const renderCardPreview = (f) => {
    if (!f.image) {
      return null;
    }
    return (
      <div style={{ height: 160, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#475569', zIndex: 2, background: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', backdropFilter: 'blur(4px)' }}>
          {String(f.id).padStart(2, '0')}
        </div>
        <img src={f.image} alt={f.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  };

  // Split into two rows for marquee (interleave)
  const row1 = features.filter((_, i) => i % 2 === 0);
  const row2 = features.filter((_, i) => i % 2 === 1);

  // Smooth CSS-based infinite marquee
  useEffect(() => {
    const el1 = marqueeRef1.current;
    const el2 = marqueeRef2.current;
    if (!el1 || !el2) return;

    let pos1 = 0, pos2 = 0;
    const SPEED = 0.4;
    let lastTime = performance.now();

    const halfW1 = el1.scrollWidth / 2;
    const halfW2 = el2.scrollWidth / 2;

    const animate = (time) => {
      const dt = Math.min(time - lastTime, 33);
      lastTime = time;
      const step = SPEED * (dt / 16.67);

      // Row 1: scroll LEFT - content slides left
      pos1 += step;
      if (pos1 >= halfW1) pos1 -= halfW1;
      el1.style.transform = `translate3d(${-pos1}px, 0, 0)`;

      // Row 2: scroll RIGHT - content slides right
      pos2 += step;
      if (pos2 >= halfW2) pos2 -= halfW2;
      el2.style.transform = `translate3d(${-halfW2 + pos2}px, 0, 0)`;

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes marqueeFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modalBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .marquee-row {
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .marquee-card {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .marquee-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04);
          border-color: #c7d2fe !important;
        }
        @media (max-width: 768px) {
          .marquee-row--mobile-hide { display: none !important; }
        }
      `}</style>

      <section id="features" style={{
        position: 'relative', width: '100%',
        padding: '100px 0 96px', backgroundColor: '#ffffff',
        overflow: 'hidden', borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 24px', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(28px, 3.8vw, 48px)', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 14px', fontFamily: "'Satoshi', sans-serif" }}>
            One Employee.<br />Hundreds of Capabilities.
          </h2>
          <p style={{ fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#64748b', lineHeight: 1.6, margin: '0 auto', maxWidth: 520, fontFamily: "'Satoshi', sans-serif" }}>
            17 core features. Infinite possibilities. Scroll, explore, discover what Luevora can do for your business.
          </p>
        </div>

        {/* Row 1 — scroll left */}
        <div style={{ position: 'relative', zIndex: 2, marginBottom: 20, overflow: 'hidden' }}>
          <div ref={marqueeRef1} className="marquee-row" style={{ display: 'flex', gap: 16, width: 'fit-content', padding: '0 24px' }}>
            {[...row1, ...row1].map((f, i) => (
              <div key={`r1-${i}`} className="marquee-card" onClick={() => setSelectedFeature(f)} style={{
                flexShrink: 0, width: 240, minHeight: 320,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
                overflow: 'hidden', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}>
                {/* Preview Area (UPGRADED UI GRAPHIC ONLY) */}
                {renderCardPreview(f)}

                <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 8, fontFamily: "'Satoshi', sans-serif" }}>{f.category}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.3, fontFamily: "'Satoshi', sans-serif" }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{f.desc.length > 80 ? f.desc.slice(0, 80) + '...' : f.desc}</p>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#6366f1', fontFamily: "'Satoshi', sans-serif" }}>
                    Show More <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 — scroll right */}
        <div className="marquee-row--mobile-hide" style={{ position: 'relative', zIndex: 2, overflow: 'hidden' }}>
          <div ref={marqueeRef2} className="marquee-row" style={{ display: 'flex', gap: 16, width: 'fit-content', padding: '0 24px' }}>
            {[...row2, ...row2].map((f, i) => (
              <div key={`r2-${i}`} className="marquee-card" onClick={() => setSelectedFeature(f)} style={{
                flexShrink: 0, width: 240, minHeight: 320,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
                overflow: 'hidden', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}>
                {/* Preview Area (UPGRADED UI GRAPHIC ONLY) */}
                {renderCardPreview(f)}

                <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 8, fontFamily: "'Satoshi', sans-serif" }}>{f.category}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.3, fontFamily: "'Satoshi', sans-serif" }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{f.desc.length > 80 ? f.desc.slice(0, 80) + '...' : f.desc}</p>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#6366f1', fontFamily: "'Satoshi', sans-serif" }}>
                    Show More <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Details Modal */}
      {selectedFeature && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={() => setSelectedFeature(null)} style={{
            position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)',
            animation: 'modalBackdropIn 0.25s ease forwards',
          }} />

            <div style={{
              position: 'relative', zIndex: 1, width: '100%', maxWidth: 520,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 60px -15px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0', overflow: 'hidden',
              animation: 'modalCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}>
              {selectedFeature.image && (
                <div style={{ width: '100%', height: 200, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
                  <img src={selectedFeature.image} alt={selectedFeature.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#475569', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                    FEATURE #{String(selectedFeature.id).padStart(2, '0')}
                  </div>
                </div>
              )}
              <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6366f1', background: '#e0e7ff', padding: '4px 12px', borderRadius: 999, fontFamily: "'Satoshi', sans-serif" }}>
                    {selectedFeature.category}
                  </span>
                  <button onClick={() => setSelectedFeature(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', fontFamily: "'Satoshi', sans-serif", letterSpacing: '-0.02em' }}>
                  {selectedFeature.title}
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                  {selectedFeature.desc}
                </p>
              </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedFeature.details.map((d, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: '#f8fafc',
                    borderRadius: 12, border: '1px solid #e2e8f0',
                    fontSize: 14, color: '#334155', fontWeight: 500,
                    fontFamily: "'Satoshi', sans-serif",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '16px 28px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setSelectedFeature(null)} style={{
                padding: '10px 22px', fontSize: 14, fontWeight: 700, borderRadius: 999,
                background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569',
                cursor: 'pointer', fontFamily: "'Satoshi', sans-serif",
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EcosystemFeatureMatrixSection;
