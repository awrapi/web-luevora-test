import React, { useState } from 'react';

// ══════════════════════════════════════════════════════════════════
// CONVERSATION PHASE DEFINITIONS — Business Journey
// ══════════════════════════════════════════════════════════════════

const CONVERSATION_PHASES = [
  {
    id: 'EXPLORATION',
    label: 'Eksplorasi',
    icon: 'compass',
    color: '#10b981',
    lightBg: '#ecfdf5',
    lightBorder: '#a7f3d0',
    desc: 'Customer baru, mencari informasi umum',
  },
  {
    id: 'PACKAGE_DISCUSS',
    label: 'Diskusi Paket',
    icon: 'package',
    color: '#3b82f6',
    lightBg: '#eff6ff',
    lightBorder: '#bfdbfe',
    desc: 'Membahas detail paket wisata tertentu',
  },
  {
    id: 'NEGOTIATION',
    label: 'Negosiasi',
    icon: 'handshake',
    color: '#f59e0b',
    lightBg: '#fffbeb',
    lightBorder: '#fde68a',
    desc: 'Tawar-menawar harga / diskon',
  },
  {
    id: 'ORDER_FORM',
    label: 'Registrasi Order',
    icon: 'clipboard',
    color: '#8b5cf6',
    lightBg: '#f5f3ff',
    lightBorder: '#c4b5fd',
    desc: 'Pendataan informasi pesanan customer',
  },
  {
    // This is a DYNAMIC gate — not a single state but a merge of multiple waiting states
    id: '_APPROVAL_GATE',
    label: 'Menunggu Persetujuan',
    icon: 'shield-check',
    color: '#6366f1',
    lightBg: '#eef2ff',
    lightBorder: '#a5b4fc',
    desc: 'Menunggu semua persyaratan terpenuhi',
    // Maps these backend states into this visual gate
    backendStates: ['WAITING_DATE', 'DATE_CONFIRMED', 'REQUEST_STUCK', 'ADMIN_PENDING'],
  },
  {
    id: 'INVOICE_PENDING',
    label: 'Invoice Aktif',
    icon: 'receipt',
    color: '#f97316',
    lightBg: '#fff7ed',
    lightBorder: '#fed7aa',
    desc: 'Invoice terbit, menunggu pembayaran',
  },
  {
    id: 'PAYMENT_PROOF',
    label: 'Bukti Bayar',
    icon: 'credit-card',
    color: '#22c55e',
    lightBg: '#f0fdf4',
    lightBorder: '#86efac',
    desc: 'Customer mengirim bukti pembayaran',
  },
  {
    id: 'COMPLETED',
    label: 'Selesai',
    icon: 'check-circle',
    color: '#14b8a6',
    lightBg: '#f0fdfa',
    lightBorder: '#5eead4',
    desc: 'Transaksi selesai',
  },
  // ── Non-linear states (appear only when active) ──
  {
    id: 'CONSIDERING',
    label: 'Mempertimbangkan',
    icon: 'clock',
    color: '#a855f7',
    lightBg: '#faf5ff',
    lightBorder: '#d8b4fe',
    desc: 'Customer sedang mempertimbangkan keputusan',
    isNonLinear: true,
  },
  {
    id: 'GHOSTED',
    label: 'Ghosted',
    icon: 'ghost',
    color: '#ef4444',
    lightBg: '#fef2f2',
    lightBorder: '#fecaca',
    desc: 'Customer menghilang setelah menunjukkan ketertarikan',
    isNonLinear: true,
  },
  {
    id: 'IDLE',
    label: 'Idle',
    icon: 'moon',
    color: '#6b7280',
    lightBg: '#f9fafb',
    lightBorder: '#d1d5db',
    desc: 'Customer pergi tanpa membalas — belum menunjukkan minat serius',
    isNonLinear: true,
  },
  {
    id: 'CANCELLED',
    label: 'Dibatalkan',
    icon: 'alert-triangle',
    color: '#ef4444',
    lightBg: '#fef2f2',
    lightBorder: '#fecaca',
    desc: 'Customer membatalkan pesanan',
    isNonLinear: true,
  },
];

// Sub-items that appear inside the Approval Gate (and also on Invoice/later phases)
const GATE_ITEM_CONFIG = {
  // From pendingItems types — pre-invoice gate
  date_approval:     { label: 'Konfirmasi Tanggal',        icon: 'calendar',       color: '#6366f1' },
  custom_request:    { label: 'Request Khusus',             icon: 'alert-triangle', color: '#ef4444' },
  offer_decision:    { label: 'Keputusan Offer/Harga',      icon: 'tag',            color: '#f59e0b' },
  admin_info:        { label: 'Info dari Admin',             icon: 'inbox',          color: '#64748b' },

  // Edge case types — post-invoice events
  order_revision:    { label: 'Revisi Pesanan',             icon: 'clipboard',      color: '#8b5cf6' },
  invoice_revision:  { label: 'Perubahan Rincian Invoice',  icon: 'receipt',        color: '#f97316' },
  refund_request:    { label: 'Permintaan Refund',          icon: 'alert-triangle', color: '#ef4444' },
  reschedule_request:{ label: 'Permintaan Reschedule',      icon: 'calendar',       color: '#6366f1' },

  // From backend states (auto-generated when no pendingItems)
  WAITING_DATE:      { label: 'Menunggu konfirmasi tanggal', icon: 'clock',          color: '#6366f1' },
  DATE_CONFIRMED:    { label: 'Tanggal dikonfirmasi ✓',     icon: 'calendar-check', color: '#10b981' },
  REQUEST_STUCK:     { label: 'Request butuh eskalasi',      icon: 'alert-triangle', color: '#ef4444' },
  ADMIN_PENDING:     { label: 'Menunggu respon admin',       icon: 'inbox',          color: '#64748b' },
};

// ══════════════════════════════════════════════════════════════════
// SVG ICON COMPONENT
// ══════════════════════════════════════════════════════════════════

const PhaseIcon = ({ icon, size = 16, color = '#374151' }) => {
  const icons = {
    'compass': (
      <g><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></g>
    ),
    'package': (
      <g><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></g>
    ),
    'handshake': (
      <g><path d="M11 17a1 1 0 0 1-1 1H6l-4-4 6.75-6.77a1 1 0 0 1 1.42 0L14 11"/><path d="M13 7a1 1 0 0 1 1-1h4l4 4-6.77 6.77a1 1 0 0 1-1.42 0L10 13"/></g>
    ),
    'clipboard': (
      <g><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></g>
    ),
    'clock': (
      <g><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></g>
    ),
    'calendar': (
      <g><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>
    ),
    'calendar-check': (
      <g><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></g>
    ),
    'shield-check': (
      <g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></g>
    ),
    'receipt': (
      <g><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></g>
    ),
    'credit-card': (
      <g><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></g>
    ),
    'check-circle': (
      <g><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></g>
    ),
    'alert-triangle': (
      <g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>
    ),
    'inbox': (
      <g><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></g>
    ),
    'tag': (
      <g><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></g>
    ),
    'activity': (
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    ),
    'info': (
      <g><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></g>
    ),
    'ghost': (
      <g><path d="M12 2C6.48 2 2 6.48 2 12v8a2 2 0 0 0 2 2h1.5c.83 0 1.5-.67 1.5-1.5S7.33 19 8.17 19H10c.83 0 1.5.67 1.5 1.5S12.17 22 13 22h2.83c.83 0 1.5-.67 1.5-1.5S17.67 19 18.5 19H20a2 2 0 0 0 2-2v-8c0-5.52-4.48-10-10-10z"/><circle cx="9" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.5" fill="currentColor" stroke="none"/></g>
    ),
    'moon': (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon] || icons['info']}
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════
// PHASE NODE
// ══════════════════════════════════════════════════════════════════

const PhaseNode = ({ phase, status, isCurrent }) => {
  const bgMap = {
    completed: phase.lightBg || '#f0fdf4',
    current:   phase.lightBg || '#eff6ff',
    upcoming:  '#fafafa',
  };
  const borderMap = {
    completed: phase.lightBorder || '#a7f3d0',
    current:   phase.color,
    upcoming:  '#f0f0f0',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 10,
      background: bgMap[status] || bgMap.upcoming,
      border: `1.5px solid ${borderMap[status] || borderMap.upcoming}`,
      transition: 'all 0.3s ease',
      ...(isCurrent ? { boxShadow: `0 2px 12px ${phase.color}25` } : {}),
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: status === 'upcoming' ? '#f3f4f6' : phase.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isCurrent ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhaseIcon icon={phase.icon} size={14} color="white" />
            <div style={{
              position: 'absolute', inset: -5,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'rgba(255,255,255,0.7)',
              animation: 'spin 1.5s linear infinite',
            }} />
          </div>
        ) : status === 'completed' ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <PhaseIcon icon={phase.icon} size={13} color="#d1d5db" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: status === 'upcoming' ? '#d1d5db' : '#1f2937',
        }}>
          {phase.label}
        </div>
        <div style={{
          fontSize: 9, lineHeight: 1.4,
          color: status === 'upcoming' ? '#e5e7eb' : '#9ca3af',
        }}>
          {phase.desc}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {isCurrent ? (
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: phase.color,
            padding: '2px 7px',
            borderRadius: 20,
            background: `${phase.color}15`,
            border: `1px solid ${phase.color}30`,
          }}>Aktif</span>
        ) : status === 'completed' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={phase.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.45 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// APPROVAL GATE NODE — Dynamic waiting items
// ══════════════════════════════════════════════════════════════════

const ApprovalGateNode = ({ phase, status, isCurrent, gateItems, conversationState }) => {
  const bgMap = {
    completed: '#ecfdf5',
    current:   phase.lightBg,
    upcoming:  '#fafafa',
  };
  const borderMap = {
    completed: '#a7f3d0',
    current:   phase.color,
    upcoming:  '#f0f0f0',
  };

  const allResolved = gateItems.length > 0 && gateItems.every(i => i.resolved);
  const resolvedCount = gateItems.filter(i => i.resolved).length;

  // Dynamic label based on what's happening
  let dynamicLabel = phase.label;
  let dynamicDesc = phase.desc;
  if (isCurrent && gateItems.length > 0) {
    const unresolvedCount = gateItems.length - resolvedCount;
    dynamicLabel = unresolvedCount > 0 ? `Menunggu ${unresolvedCount} Persetujuan` : 'Semua Disetujui ✓';
    dynamicDesc = unresolvedCount > 0 ? 'AI tidak akan lanjut sampai semua item terpenuhi' : 'Siap lanjut ke tahap berikutnya';
  } else if (isCurrent && gateItems.length === 0) {
    // Use the conversation state to give a hint
    const stateHint = GATE_ITEM_CONFIG[conversationState];
    if (stateHint) {
      dynamicLabel = stateHint.label;
    }
  }

  return (
    <div style={{
      borderRadius: 10,
      background: bgMap[status] || bgMap.upcoming,
      border: `1.5px solid ${borderMap[status] || borderMap.upcoming}`,
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      ...(isCurrent ? { boxShadow: `0 2px 12px ${phase.color}25` } : {}),
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: status === 'upcoming' ? '#f3f4f6' : allResolved && status === 'current' ? '#10b981' : phase.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isCurrent ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhaseIcon icon={allResolved ? 'check-circle' : phase.icon} size={14} color="white" />
              {!allResolved && (
                <div style={{
                  position: 'absolute', inset: -5,
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: 'rgba(255,255,255,0.7)',
                  animation: 'spin 1.5s linear infinite',
                }} />
              )}
            </div>
          ) : status === 'completed' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <PhaseIcon icon={phase.icon} size={13} color="#d1d5db" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: status === 'upcoming' ? '#d1d5db' : '#1f2937',
          }}>
            {dynamicLabel}
          </div>
          <div style={{
            fontSize: 9, lineHeight: 1.4,
            color: status === 'upcoming' ? '#e5e7eb' : '#9ca3af',
          }}>
            {dynamicDesc}
          </div>
        </div>

        {isCurrent && gateItems.length > 0 && (
          <span style={{
            fontSize: 8, fontWeight: 700,
            color: allResolved ? '#10b981' : '#f59e0b',
            padding: '2px 7px', borderRadius: 20,
            background: allResolved ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${allResolved ? '#a7f3d0' : '#fde68a'}`,
          }}>
            {resolvedCount}/{gateItems.length}
          </span>
        )}

        {!isCurrent && status === 'completed' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.45 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Gate items (only when current and has items) */}
      {isCurrent && gateItems.length > 0 && (
        <div style={{
          padding: '0 10px 8px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {gateItems.map((item, i) => {
            const cfg = GATE_ITEM_CONFIG[item.type] || { label: item.type, icon: 'info', color: '#64748b' };
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 8px',
                borderRadius: 7,
                background: item.resolved ? '#f0fdf4' : 'white',
                border: `1px solid ${item.resolved ? '#a7f3d0' : cfg.color + '25'}`,
                borderLeft: `3px solid ${item.resolved ? '#10b981' : cfg.color}`,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: item.resolved ? '#ecfdf5' : `${cfg.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {item.resolved ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <PhaseIcon icon={cfg.icon} size={10} color={cfg.color} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 600,
                    color: item.resolved ? '#10b981' : '#374151',
                    textDecoration: item.resolved ? 'line-through' : 'none',
                  }}>
                    {item.label || cfg.label}
                  </div>
                </div>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: item.resolved ? '#10b981' : cfg.color,
                  flexShrink: 0,
                  animation: item.resolved ? 'none' : 'pulse 1.5s ease-in-out infinite',
                }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// CONNECTOR
// ══════════════════════════════════════════════════════════════════

const PhaseConnector = ({ fromColor, toColor, isCompleted }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '1px 0' }}>
    <div style={{
      width: 2, height: 12, borderRadius: 1,
      background: isCompleted
        ? `linear-gradient(180deg, ${fromColor}, ${toColor})`
        : '#f0f0f0',
      transition: 'background 0.4s ease',
    }} />
  </div>
);

// ══════════════════════════════════════════════════════════════════
// MINI TECH STAGE ROW
// ══════════════════════════════════════════════════════════════════

const TECH_STAGES = [
  { id: 'pre_validation', label: 'Validasi' },
  { id: 'context_loader', label: 'Konteks' },
  { id: 'state_resolver', label: 'State' },
  { id: 'rag_pipeline',   label: 'RAG' },
  { id: 'prompt_assembler', label: 'Prompt' },
  { id: 'ai_execution',   label: 'AI' },
  { id: 'post_processor', label: 'Post' },
  { id: 'response_emitter', label: 'Emit' },
];

const TechStageRow = ({ stages }) => {
  if (!stages || stages.length === 0) return null;
  const stageMap = {};
  stages.forEach(s => { stageMap[s.id] = s; });
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {TECH_STAGES.map(ts => {
        const data = stageMap[ts.id];
        const status = data?.status || 'pending';
        const colors = {
          done:    { bg: '#ecfdf5', text: '#10b981', border: '#a7f3d0' },
          running: { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
          error:   { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
          hold:    { bg: '#fffbeb', text: '#f59e0b', border: '#fde68a' },
          pending: { bg: '#f9fafb', text: '#d1d5db', border: '#f0f0f0' },
        };
        const c = colors[status] || colors.pending;
        return (
          <div key={ts.id} style={{
            fontSize: 8, fontWeight: 600,
            padding: '2px 7px', borderRadius: 20,
            background: c.bg, color: c.text,
            border: `1px solid ${c.border}`,
            whiteSpace: 'nowrap',
          }}>
            {ts.label}
            {data?.elapsed != null && <span style={{ opacity: 0.6, marginLeft: 3 }}>{data.elapsed}ms</span>}
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// HELPER: Determine phase status
// ══════════════════════════════════════════════════════════════════

function resolvePhaseStatuses(conversationState) {
  // Map backend state → which visual phase it belongs to
  const GATE_STATES = new Set(['WAITING_DATE', 'DATE_CONFIRMED', 'REQUEST_STUCK', 'ADMIN_PENDING']);
  const isGateState = GATE_STATES.has(conversationState);
  const NON_LINEAR_STATES = new Set(['CONSIDERING', 'GHOSTED', 'IDLE', 'CANCELLED']);
  const isNonLinear = NON_LINEAR_STATES.has(conversationState);

  // Build ordered list of visual phase IDs (linear only)
  const linearPhases = CONVERSATION_PHASES.filter(p => !p.isNonLinear);
  const linearPhaseIds = linearPhases.map(p => p.id);

  // All phase IDs
  const allPhaseIds = CONVERSATION_PHASES.map(p => p.id);

  // Determine which phase is "current"
  let currentVisualId;
  if (isGateState) {
    currentVisualId = '_APPROVAL_GATE';
  } else if (isNonLinear) {
    currentVisualId = conversationState;
  } else {
    currentVisualId = conversationState; // direct match
  }

  const statuses = {};

  if (isNonLinear) {
    // Non-linear state: mark all linear phases as completed (customer had engagement),
    // mark the non-linear phase as current, hide other non-linear phases.
    // Show prior linear phases as "completed" up to the gate, since the customer
    // had to have been through at least exploration.
    const gateLevelIdx = linearPhaseIds.indexOf('_APPROVAL_GATE');
    linearPhaseIds.forEach((pid, i) => {
      statuses[pid] = i <= Math.min(gateLevelIdx, linearPhaseIds.length - 1) ? 'completed' : 'upcoming';
    });
    // Mark all non-linear phases
    CONVERSATION_PHASES.filter(p => p.isNonLinear).forEach(p => {
      statuses[p.id] = p.id === conversationState ? 'current' : 'upcoming';
    });
  } else {
    // Linear state: use index-based completion
    const currentIndex = linearPhaseIds.indexOf(currentVisualId);
    linearPhaseIds.forEach((pid, i) => {
      if (currentIndex < 0) {
        statuses[pid] = 'upcoming';
      } else if (i < currentIndex) {
        statuses[pid] = 'completed';
      } else if (i === currentIndex) {
        statuses[pid] = 'current';
      } else {
        statuses[pid] = 'upcoming';
      }
    });
    // Hide all non-linear phases when in linear flow
    CONVERSATION_PHASES.filter(p => p.isNonLinear).forEach(p => {
      statuses[p.id] = 'upcoming';
    });
  }

  return statuses;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PIPELINE VIEWER PANEL
// ══════════════════════════════════════════════════════════════════

const PipelineViewer = ({ isOpen, onClose, pipelineData = null, isRunning = false }) => {
  const [showTech, setShowTech] = useState(false);

  const conversationState = pipelineData?.conversationState;
  const pendingItems = pipelineData?.pendingItems || [];
  const totalMs = pipelineData?.totalMs ?? null;
  const decision = pipelineData?.decision;

  const phaseStatuses = conversationState ? resolvePhaseStatuses(conversationState) : {};

  // Build gate items from pendingItems + auto-detect from state
  let gateItems = [...pendingItems];
  // If no pending items but state is a gate state, auto-generate one
  const GATE_STATES_SET = new Set(['WAITING_DATE', 'DATE_CONFIRMED', 'REQUEST_STUCK', 'ADMIN_PENDING']);
  if (gateItems.length === 0 && GATE_STATES_SET.has(conversationState)) {
    const auto = GATE_ITEM_CONFIG[conversationState];
    if (auto) {
      gateItems.push({
        type: conversationState === 'WAITING_DATE' ? 'date_approval' :
              conversationState === 'REQUEST_STUCK' ? 'custom_request' :
              conversationState === 'ADMIN_PENDING' ? 'admin_info' :
              'date_approval',
        label: auto.label,
        resolved: conversationState === 'DATE_CONFIRMED',
      });
    }
  }

  // Determine header subtitle
  let headerSubtitle = 'Menunggu pesan...';
  if (isRunning) {
    headerSubtitle = '⚡ Memproses pesan...';
  } else if (conversationState) {
    const currentPhase = CONVERSATION_PHASES.find(p => {
      if (p.id === '_APPROVAL_GATE') return p.backendStates?.includes(conversationState);
      return p.id === conversationState;
    });
    headerSubtitle = `Fase: ${currentPhase?.label || conversationState}`;
  }

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: '1px solid #e5e7eb',
        background: '#fafbfc',
        overflow: 'hidden',
        animation: 'fadeIn 0.25s ease-out',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '12px 14px 10px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex', alignItems: 'center', gap: 9,
          flexShrink: 0, background: 'white',
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PhaseIcon icon="activity" size={14} color="white" />
            </div>
            {isRunning && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 8, height: 8, borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                animation: 'pulse 1.2s ease-in-out infinite',
                border: '1.5px solid white',
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>Status Percakapan</div>
            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>{headerSubtitle}</div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9ca3af',
              transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Decision Badge ── */}
        {decision && decision !== 'continue' && (
          <div style={{ padding: '8px 14px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 10px', borderRadius: 8,
              background: decision === 'hold' ? '#fffbeb' : decision === 'rollback' ? '#f5f3ff' : '#fef2f2',
              border: `1px solid ${decision === 'hold' ? '#fde68a' : decision === 'rollback' ? '#c4b5fd' : '#fecaca'}`,
            }}>
              <PhaseIcon icon={decision === 'hold' ? 'clock' : 'alert-triangle'} size={13}
                color={decision === 'hold' ? '#f59e0b' : decision === 'rollback' ? '#8b5cf6' : '#ef4444'} />
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: decision === 'hold' ? '#d97706' : decision === 'rollback' ? '#7c3aed' : '#dc2626',
              }}>
                {decision === 'hold' ? 'Pipeline Ditahan' :
                 decision === 'rollback' ? 'Pipeline Rollback' : 'Pipeline Error'}
              </span>
            </div>
          </div>
        )}

        {/* ── Journey Timeline ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 10px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#d1d5db',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 8, paddingLeft: 2,
          }}>
            Alur Percakapan
          </div>

          {CONVERSATION_PHASES.map((phase, i) => {
            const status = phaseStatuses[phase.id] || 'upcoming';
            const isCurrent = status === 'current';
            const isGate = phase.id === '_APPROVAL_GATE';

            // Hide phases that haven't happened yet
            if (status === 'upcoming') return null;

            // Post-invoice phases can also show edge case items
            const POST_INVOICE_IDS = new Set(['INVOICE_PENDING', 'PAYMENT_PROOF', 'COMPLETED']);
            const isPostInvoice = POST_INVOICE_IDS.has(phase.id);
            const POST_INVOICE_TYPES = new Set(['order_revision', 'invoice_revision', 'refund_request', 'reschedule_request']);
            const postInvoiceItems = isCurrent && isPostInvoice
              ? gateItems.filter(item => POST_INVOICE_TYPES.has(item.type))
              : [];
            const hasPostInvoiceEdgeCases = postInvoiceItems.length > 0;

            // Find the next visible phase for connector color
            const nextVisiblePhase = CONVERSATION_PHASES.slice(i + 1).find(p => {
              const s = phaseStatuses[p.id] || 'upcoming';
              return s !== 'upcoming';
            });

            return (
              <React.Fragment key={phase.id}>
                {isGate ? (
                  <ApprovalGateNode
                    phase={phase}
                    status={status}
                    isCurrent={isCurrent}
                    gateItems={gateItems}
                    conversationState={conversationState}
                  />
                ) : hasPostInvoiceEdgeCases ? (
                  <ApprovalGateNode
                    phase={phase}
                    status={status}
                    isCurrent={isCurrent}
                    gateItems={postInvoiceItems}
                    conversationState={conversationState}
                  />
                ) : (
                  <PhaseNode phase={phase} status={status} isCurrent={isCurrent} />
                )}
                {nextVisiblePhase && (
                  <PhaseConnector
                    fromColor={phase.color}
                    toColor={nextVisiblePhase.color}
                    isCompleted={status === 'completed'}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Empty state */}
          {!pipelineData && (
            <div style={{
              marginTop: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.5,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PhaseIcon icon="activity" size={18} color="#d1d5db" />
              </div>
              <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
                Pipeline akan aktif<br />setelah pesan masuk
              </p>
            </div>
          )}
        </div>

        {/* ── Tech Footer ── */}
        <div style={{
          borderTop: '1px solid #f0f0f0',
          flexShrink: 0, background: 'white',
        }}>
          <button
            onClick={() => setShowTech(p => !p)}
            style={{
              width: '100%', padding: '7px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{
              fontSize: 8, fontWeight: 700, color: '#d1d5db',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Detail Teknis {totalMs ? `(${totalMs}ms)` : ''}
            </span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showTech ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showTech && (
            <div style={{ padding: '0 14px 10px' }}>
              <TechStageRow stages={pipelineData?.stages} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
};

export default PipelineViewer;
