import React, { useState, useRef, useEffect } from 'react';

const EcosystemFeatureMatrixSection = () => {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const marqueeRef1 = useRef(null);
  const marqueeRef2 = useRef(null);
  const rafRef = useRef(null);

  const features = [
    { id: 1, title: 'Multi Branch System', category: 'Operations', desc: 'Pemisahan AI untuk Branch Sales, Support, dan CS yang terhubung 1 sama lain untuk koordinasi antar divisi.', details: ['Branch Sales Agent', 'Branch Support Agent', 'Branch CS Agent', 'Cross-branch Coordination', 'Unified CRM View'] },
    { id: 2, title: 'Long Memory & Cross-Platform', category: 'Sales', desc: 'Mengingat detail customer lintas platform (WA, IG, FB, TikTok, Email) untuk layanan yang sangat personal.', details: ['WhatsApp History Sync', 'Instagram DM Memory', 'Facebook Messenger Log', 'Email Thread Tracking', 'Unified Customer Timeline'] },
    { id: 3, title: 'Integrated CRM Engine', category: 'Sales', desc: 'Mencatat data customer otomatis dari percakapan, log pesan terakhir, dan catatan penting operasional.', details: ['Auto Contact Creation', 'Conversation History', 'Smart Contact Tags', 'Custom Notes', 'Broadcast Messaging', 'Follow-up Scheduling'] },
    { id: 4, title: 'Automated Follow-Up & Tagging', category: 'Sales', desc: 'Tagging otomatis (Potential, Warm, Cold) & auto follow-up berkala untuk menaikkan konversi closing.', details: ['Auto Lead Scoring', 'Warm/Cold Tagging', 'Scheduled Follow-ups', 'Smart Reminders', 'Conversion Analytics'] },
    { id: 5, title: 'Support Ticketing System', category: 'Operations', desc: 'Pembuatan tiket antrian khusus support jika ada keluhan spesifik customer yang butuh perhatian tim.', details: ['Auto Ticket Creation', 'Priority Queue', 'Agent Assignment', 'Resolution Tracking', 'Customer Feedback Loop'] },
    { id: 6, title: 'Invoicing & Receipt Generator', category: 'Finance', desc: 'Canvas editor template invoice & receipt yang di-generate otomatis oleh AI saat transaksi berhasil.', details: ['Auto Invoice Generation', 'Custom Templates', 'PDF Export', 'Payment Link Embed', 'Tax Calculation'] },
    { id: 7, title: 'Midtrans Payment Integration', category: 'Finance', desc: 'Integrasi payment gateway Midtrans untuk generate link pembayaran dan verifikasi otomatis.', details: ['Payment Link Generator', 'Auto Verification', 'Refund Processing', 'Multi-payment Methods', 'Settlement Reports'] },
    { id: 8, title: 'Multi-Model Inventory Engine', category: 'Operations', desc: 'Mendukung berbagai model bisnis: slot jadwal, stock barang, reservasi meja, dan unit rental/travel.', details: ['Slot-based Inventory', 'Stock Management', 'Reservation System', 'Rental Unit Tracking', 'Real-time Availability'] },
    { id: 9, title: 'Smart Scheduling & Reminders', category: 'Operations', desc: 'Pencatatan tanggal trip/unit, jadwal DP & pelunasan, serta auto follow-up tepat di tanggal target.', details: ['Trip Scheduling', 'Payment Reminders', 'Auto Follow-up', 'Calendar Integration', 'Overdue Alerts'] },
    { id: 10, title: 'Flexible Persona & SOP', category: 'Sales', desc: 'Kustomisasi persona melayani, gaya bahasa, serta SOP bisnis sesuai aturan spesifik perusahaan.', details: ['Custom Persona Builder', 'Language Style Tuning', 'SOP Template Library', 'Rule-based Routing', 'Behavior Presets'] },
    { id: 11, title: 'Real-Time Excel Sheet Sync', category: 'Integrations', desc: 'Sinkronisasi 2 arah file Excel bisnis yang di-update AI secara real-time saat berinteraksi dengan customer.', details: ['Bidirectional Sync', 'Real-time Updates', 'Google Sheets Support', 'Custom Mapping', 'Conflict Resolution'] },
    { id: 12, title: 'Smart Pipeline Indicator', category: 'Sales', desc: 'Indikator visual posisi customer dalam pipeline penjualan (tahap eksplorasi hingga calon closing).', details: ['Visual Pipeline View', 'Stage Auto-detection', 'Progress Tracking', 'Bottleneck Alerts', 'Conversion Forecasting'] },
    { id: 13, title: 'AI Agent Talk Session', category: 'Operations', desc: 'Onboarding wawancara mode teks & suara (voice call) untuk mengisi Knowledge Base & SOP bisnis.', details: ['Voice Interview Mode', 'Text Interview Mode', 'Auto KB Population', 'SOP Extraction', 'Quick Onboarding Flow'] },
    { id: 14, title: 'Bring Your Old Data (PDF/Excel)', category: 'Integrations', desc: 'Upload file PDF/Excel data lama â†’ AI membaca dan memetakan otomatis ke CRM, Inventory, & Sheet.', details: ['PDF Data Extraction', 'Excel Import', 'Auto Field Mapping', 'Duplicate Detection', 'Bulk Import Support'] },
    { id: 15, title: 'Interactive Business Copilot', category: 'Integrations', desc: 'Command agent untuk bisnis owner ("Berapa leads hari ini?", "Follow up Pak X", "Ubah data Y").', details: ['Natural Language Commands', 'Quick Actions', 'Data Lookup', 'Task Execution', 'Report Generation'] },
    { id: 16, title: 'Human in the Loop (HITL)', category: 'Operations', desc: 'Dashboard approval interaktif jika AI menemukan request khusus di luar data SOP yang ada.', details: ['Approval Dashboard', 'Smart Escalation', 'Context Preservation', 'Manual Override', 'Audit Trail'] },
    { id: 17, title: 'Telegram Smart Routing', category: 'Integrations', desc: 'Routing notifikasi & approval transaksi ke Telegram owner, manager, atau admin secara terpisah.', details: ['Multi-role Routing', 'Approval Notifications', 'Transaction Alerts', 'Status Updates', 'Command Responses'] },
  ];

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

      // Row 1: scroll LEFT â€” content slides â†
      pos1 += step;
      if (pos1 >= halfW1) pos1 -= halfW1;
      el1.style.transform = `translate3d(${-pos1}px, 0, 0)`;

      // Row 2: scroll RIGHT â€” content slides â†’
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

        {/* Row 1 â€” scroll left */}
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
                {/* Preview Area */}
                <div style={{ height: 160, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'relative', zIndex: 1, fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(99,102,241,0.15)', letterSpacing: '0.04em' }}>
                    {String(f.id).padStart(2, '0')}
                  </span>
                </div>
                {/* Content */}
                <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 8, fontFamily: "'Satoshi', sans-serif" }}>{f.category}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.3, fontFamily: "'Satoshi', sans-serif" }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{f.desc.length > 80 ? f.desc.slice(0, 80) + '...' : f.desc}</p>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#6366f1', fontFamily: "'Satoshi', sans-serif" }}>
                    Show More <span style={{ fontSize: 16, lineHeight: 1 }}>â†’</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 â€” scroll right (only on tablet+) */}
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
                <div style={{ height: 160, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'relative', zIndex: 1, fontSize: 36, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(139,92,246,0.15)', letterSpacing: '0.04em' }}>
                    {String(f.id).padStart(2, '0')}
                  </span>
                </div>
                <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 8, fontFamily: "'Satoshi', sans-serif" }}>{f.category}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.3, fontFamily: "'Satoshi', sans-serif" }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 }}>{f.desc.length > 80 ? f.desc.slice(0, 80) + '...' : f.desc}</p>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#6366f1', fontFamily: "'Satoshi', sans-serif" }}>
                    Show More <span style={{ fontSize: 16, lineHeight: 1 }}>â†’</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal / Drawer */}
      {selectedFeature && (
        <div onClick={() => setSelectedFeature(null)} style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, animation: 'modalBackdropIn 0.25s ease both',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 24, maxWidth: 560, width: '100%',
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
            animation: 'modalCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both',
          }}>
            {/* Modal Header */}
            <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 8, fontFamily: "'Satoshi', sans-serif" }}>{selectedFeature.category}</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', fontFamily: "'Satoshi', sans-serif", lineHeight: 1.3 }}>{selectedFeature.title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>{selectedFeature.desc}</p>
            </div>

            {/* Modal Detail List */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedFeature.details.map((d, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: '#f8fafc',
                    borderRadius: 12, border: '1px solid #e2e8f0',
                    fontSize: 14, color: '#334155', fontWeight: 500,
                    fontFamily: "'Satoshi', sans-serif",
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>âœ¦</span> {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
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
