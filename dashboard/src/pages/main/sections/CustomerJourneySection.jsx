import React, { useState, useEffect } from 'react';

const CustomerJourneySection = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Smooth progress bar & auto-switch timer (6 seconds per step)
  useEffect(() => {
    if (!isAutoPlaying) {
      setProgress(100);
      return;
    }
    setProgress(0);
    const startTime = Date.now();
    const duration = 6000;

    const animFrame = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (elapsed >= duration) {
        setActiveStep((prev) => (prev + 1) % 3);
      }
    }, 50);

    return () => clearInterval(animFrame);
  }, [activeStep, isAutoPlaying]);

  const stepsData = [
    {
      step: '01',
      title: 'Lead Generation & Marketing Engine',
      subtitle: 'Analisis Prediktif & Eksekusi Iklan Terpadu',
      desc: 'Menganalisis histori transaksi dan perilaku audiens untuk merancang serta mengeksekusi kampanye Meta & Google Ads berkinerja tinggi secara presisi.',
      metric: 'ROAS 5.1x',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
      ),
    },
    {
      step: '02',
      title: 'Autonomous Consultation & Sales Routing',
      subtitle: 'Respon Real-Time & Memori Terintegrasi',
      desc: 'Melayani komunikasi pelanggan 24/7 di WhatsApp, Instagram, Telegram, dan Email dengan integrasi memori CRM konteks tinggi dan perutean cabang otomatis.',
      metric: '< 0.2s Respon',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      step: '03',
      title: 'Automated Settlement & Operations Matrix',
      subtitle: 'Rekonsiliasi Keuangan & Otomatisasi Stok',
      desc: 'Menerbitkan tautan pembayaran Midtrans, membuat faktur PDF, memperbarui pembukuan stok ERP, dan mengirimkan laporan eksekutif ke Telegram.',
      metric: '100% Otomatis',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="customer-journey"
      style={{
        position: 'relative',
        width: '100%',
        padding: '110px 24px 130px',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        borderBottom: '1px solid #e5e7eb',
        fontFamily: "'Satoshi', sans-serif",
      }}
    >
      <style>{`
        .cj-pipeline-panel {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 28px;
          padding: 16px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .cj-step-item {
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          border-radius: 20px;
          padding: 20px 24px;
          position: relative;
          background: transparent;
          border: 1px solid transparent;
        }
        .cj-step-item:hover {
          background: rgba(241, 245, 249, 0.7);
        }
        .cj-step-item.active {
          background: #ffffff;
          border-color: #c7d2fe;
          box-shadow: 0 12px 32px -8px rgba(79, 70, 229, 0.14), 0 0 0 1px rgba(199, 210, 254, 0.6) inset;
        }
        @keyframes cj-pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes cj-slide-up {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cj-view-anim {
          animation: cj-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '1240px',
          margin: '0 auto',
        }}
      >
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 72px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#eef2ff',
              border: '1px solid #c7d2fe',
              padding: '6px 16px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#4f46e5',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#4f46e5',
                boxShadow: '0 0 8px #4f46e5',
              }}
            />
            Enterprise Automation Engine
          </div>

          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              margin: '0 0 18px',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            End-to-End Customer Journey Engine
          </h2>
          <p
            style={{
              fontSize: '17px',
              color: '#64748b',
              lineHeight: 1.65,
              margin: 0,
              fontWeight: 500,
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            Sistem terintegrasi yang mengelola seluruh siklus operasional bisnis Anda—mulai dari akuisisi prospek, konsultasi responsif, hingga otomatisasi transaksi.
          </p>
        </div>

        {/* Content Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          {/* Left Column: $1,000,000 USD Class Pipeline Selector */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <div className="cj-pipeline-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
              {stepsData.map((item, idx) => {
                const isActive = activeStep === idx;
                return (
                  <div
                    key={item.step}
                    className={`cj-step-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveStep(idx);
                      setIsAutoPlaying(false);
                    }}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      {/* Vector Icon Badge */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: isActive ? '#4f46e5' : '#f1f5f9',
                          color: isActive ? '#ffffff' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isActive ? '0 6px 18px rgba(79, 70, 229, 0.35)' : 'none',
                        }}
                      >
                        {item.icon}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <h3
                            style={{
                              fontSize: '18px',
                              fontWeight: 800,
                              color: isActive ? '#4f46e5' : '#0f172a',
                              margin: 0,
                              lineHeight: 1.3,
                              letterSpacing: '-0.01em',
                              fontFamily: "'Satoshi', sans-serif",
                              transition: 'color 0.3s ease',
                            }}
                          >
                            {item.title}
                          </h3>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isActive ? '#4f46e5' : '#64748b',
                              backgroundColor: isActive ? '#eef2ff' : '#f1f5f9',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: isActive ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                              fontFamily: "'Satoshi', sans-serif",
                            }}
                          >
                            {item.metric}
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: '13.5px',
                            color: '#64748b',
                            lineHeight: 1.55,
                            margin: 0,
                            fontWeight: 450,
                            fontFamily: "'Satoshi', sans-serif",
                          }}
                        >
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    {/* Integrated Micro Active Progress Line */}
                    {isActive && (
                      <div
                        style={{
                          marginTop: '14px',
                          height: '3px',
                          width: '100%',
                          backgroundColor: '#e0e7ff',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${progress}%`,
                            backgroundColor: '#4f46e5',
                            borderRadius: '999px',
                            transition: 'width 0.05s linear',
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ paddingLeft: '4px' }}>
              <button
                className="solid-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '16px 36px',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Satoshi', sans-serif",
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                }}
                onClick={() => (window.location.href = '/register')}
              >
                Start Free Trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Column: $1,000,000 USD Grade Interactive UI Display (NO EMOJIS, NO IMAGES) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {/* Outer Ambient Backdrop Glow */}
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '-20px',
                right: '-20px',
                bottom: '-20px',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(79, 70, 229, 0.05) 60%, transparent 80%)',
                filter: 'blur(30px)',
                borderRadius: '40px',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                width: '100%',
                maxWidth: '540px',
                minHeight: '520px',
                borderRadius: '32px',
                background: 'linear-gradient(145deg, #3730a3 0%, #4338ca 35%, #4f46e5 70%, #6366f1 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '32px',
                boxShadow: '0 30px 70px -15px rgba(67, 56, 202, 0.45), 0 0 1px 1px rgba(255, 255, 255, 0.4) inset',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#ffffff',
                overflow: 'hidden',
                position: 'relative',
                backdropFilter: 'blur(20px)',
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              {/* DYNAMIC $100M UI VIEWS (VERTICALLY CENTERED) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

                {/* VIEW 01: High-Performance Ad Analytics & Execution */}
                {activeStep === 0 && (
                  <div key="view-0" className="cj-view-anim" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                        Analisis & Eksekusi Iklan Presisi
                      </span>
                      <span style={{ fontSize: '11px', color: '#064e3b', background: '#a7f3d0', padding: '4px 12px', borderRadius: '999px', fontWeight: 800 }}>
                        99.4% Target Accuracy
                      </span>
                    </div>

                    {/* SVG Performance Growth Chart */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '18px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 600 }}>METRIK KINERJA TERKINI</div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>128,450 <span style={{ fontSize: '12px', color: '#a7f3d0', fontWeight: 700 }}>+38.4%</span></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 600 }}>ROAS</div>
                          <div style={{ fontSize: '20px', fontWeight: 900, color: '#fef08a' }}>5.1x Return</div>
                        </div>
                      </div>

                      {/* Smooth SVG Trend Line */}
                      <svg width="100%" height="56" viewBox="0 0 300 56" fill="none" style={{ overflow: 'visible' }}>
                        <path
                          d="M0 45 C 50 40, 70 20, 120 28 C 170 35, 200 10, 250 14 C 270 16, 285 5, 300 2"
                          stroke="#ffffff"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <path
                          d="M0 45 C 50 40, 70 20, 120 28 C 170 35, 200 10, 250 14 C 270 16, 285 5, 300 2 L 300 56 L 0 56 Z"
                          fill="url(#chartGrad)"
                          opacity="0.35"
                        />
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    {/* Multi-Channel Distribution Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '14px', color: '#0f172a', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Meta Ads Campaign</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>82,400 Impresi</div>
                        <div style={{ marginTop: '8px', height: '4px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: '68%', height: '100%', background: '#4f46e5' }} />
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '14px', color: '#0f172a', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Google Search Ads</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>46,050 Impresi</div>
                        <div style={{ marginTop: '8px', height: '4px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: '42%', height: '100%', background: '#0284c7' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 02: Omnichannel Enterprise Sales Consultation */}
                {activeStep === 1 && (
                  <div key="view-1" className="cj-view-anim" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                        Layanan Sales & Konsultasi 24/7
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '10px', background: '#ffffff', color: '#166534', padding: '3px 10px', borderRadius: '999px', fontWeight: 800 }}>WhatsApp</span>
                        <span style={{ fontSize: '10px', background: '#ffffff', color: '#991b1b', padding: '3px 10px', borderRadius: '999px', fontWeight: 800 }}>Instagram</span>
                        <span style={{ fontSize: '10px', background: '#ffffff', color: '#075985', padding: '3px 10px', borderRadius: '999px', fontWeight: 800 }}>Telegram</span>
                      </div>
                    </div>

                    {/* Customer CRM Context Bar */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)', borderRadius: '14px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                      <span style={{ color: '#e0e7ff', fontWeight: 600 }}>CRM ID: #CUST-8842</span>
                      <span style={{ color: '#ffffff', fontWeight: 800, background: 'rgba(0,0,0,0.25)', padding: '2px 10px', borderRadius: '6px' }}>Kategori: Pelanggan Prioritas</span>
                    </div>

                    {/* Dialogue Stream Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#ffffff', padding: '18px', borderRadius: '20px', color: '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                      {/* Customer Speech Bubble */}
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#f1f5f9', color: '#1e293b', padding: '12px 16px', borderRadius: '16px 16px 16px 2px', fontSize: '13px', lineHeight: 1.5, fontWeight: 500 }}>
                        Selamat siang, saya ingin mengonfirmasi ketersediaan unit Executive Suite untuk tanggal 12 bulan depan di cabang Jakarta.
                      </div>

                      {/* AI Response Bubble */}
                      <div style={{ alignSelf: 'flex-end', maxWidth: '88%', background: '#0f172a', color: '#ffffff', padding: '12px 16px', borderRadius: '16px 16px 2px 16px', fontSize: '13px', lineHeight: 1.5, fontWeight: 500 }}>
                        Selamat siang. Unit Executive Suite cabang Jakarta tersedia. Tautan pembayaran resmi telah diterbitkan di bawah ini.
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                        <span>Waktu Respon: 0.18 Detik</span>
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>Tingkat Akurasi: 99.8%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 03: Automated Settlement & Operations Matrix */}
                {activeStep === 2 && (
                  <div key="view-2" className="cj-view-anim" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                        Matriks Transaksi & Operasional
                      </span>
                      <span style={{ fontSize: '11px', color: '#064e3b', background: '#a7f3d0', padding: '4px 12px', borderRadius: '999px', fontWeight: 800 }}>
                        Midtrans Direct Settlement
                      </span>
                    </div>

                    {/* Invoice Card */}
                    <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', color: '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>NOMOR FAKTUR</div>
                          <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>#INV-2026-89412</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>STATUS</div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '3px 10px', borderRadius: '6px', display: 'inline-block' }}>
                            BERHASIL DITERIMA
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', padding: '12px 0', margin: '12px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                          <span>1x Reservasi Executive Suite</span>
                          <span>Rp 14.850.000</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                          <span>Gateway: Midtrans QRIS / Virtual Account</span>
                          <span>Rekonsiliasi Bank: Otomatis</span>
                        </div>
                      </div>

                      {/* Automation Workflow Execution List */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '10px', fontSize: '11.5px', color: '#1e293b', fontWeight: 700 }}>
                          Faktur PDF Terbit & Terkirim
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '10px', fontSize: '11.5px', color: '#1e293b', fontWeight: 700 }}>
                          Stok ERP Diperbarui (-1)
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '10px', fontSize: '11.5px', color: '#1e293b', fontWeight: 700 }}>
                          Laporan Excel Tersinkronisasi
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '10px', fontSize: '11.5px', color: '#1e293b', fontWeight: 700 }}>
                          Notifikasi Eksekutif Telegram
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Step Switcher Indicators */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '10px',
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.22)',
                  marginTop: '16px',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveStep(i);
                      setIsAutoPlaying(false);
                    }}
                    style={{
                      height: '6px',
                      width: activeStep === i ? '32px' : '10px',
                      borderRadius: '999px',
                      backgroundColor: activeStep === i ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    title={`Fase ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomerJourneySection;
