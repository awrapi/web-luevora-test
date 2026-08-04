import React, { useState, useEffect } from 'react';

const WhatsAppWidget = () => {
  const [showTooltip, setShowTooltip] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const phone = '6285693441047';
  const defaultMessage = encodeURIComponent('Halo Luevora AI, saya ada informasi yang membingungkan dan ingin bertanya lebih lanjut.');
  const waUrl = `https://wa.me/${phone}?text=${defaultMessage}`;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
        fontFamily: "'Satoshi', 'Inter', sans-serif",
        pointerEvents: 'auto',
      }}
    >
      {/* Tooltip / Popup Message */}
      {showTooltip && (
        <div
          style={{
            position: 'relative',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '14px 18px',
            borderRadius: '16px',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(37, 211, 102, 0.3)',
            maxWidth: '280px',
            animation: 'wa-pop-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
              borderRadius: '50%',
              lineHeight: 1,
            }}
            title="Tutup"
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#25D366',
              boxShadow: '0 0 8px #25D366',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#16a34a' }}>
              Customer Support Online
            </span>
          </div>

          <p style={{ fontSize: '13px', margin: 0, color: '#334155', lineHeight: '1.45', fontWeight: 500 }}>
            Ada informasi yang membingungkan? Butuh bantuan lebih lanjut? Chat CS kami via WhatsApp!
          </p>

          {/* Little arrow at bottom right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '24px',
              width: '12px',
              height: '12px',
              backgroundColor: '#ffffff',
              borderRight: '1px solid rgba(37, 211, 102, 0.3)',
              borderBottom: '1px solid rgba(37, 211, 102, 0.3)',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      )}

      {/* Main WhatsApp Floating Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px 12px 14px',
          borderRadius: '999px',
          boxShadow: isHovered
            ? '0 12px 32px rgba(37, 211, 102, 0.45), 0 4px 16px rgba(15, 23, 42, 0.3)'
            : '0 8px 24px rgba(0, 0, 0, 0.25)',
          textDecoration: 'none',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isHovered ? 'translateY(-3px) scale(1.03)' : 'translateY(0) scale(1)',
          border: '1px solid rgba(37, 211, 102, 0.4)',
        }}
      >
        {/* WhatsApp Icon Circle */}
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: '#25D366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(37, 211, 102, 0.5)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
        </div>

        {/* Text Container */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Customer Service
          </span>
          <span style={{ fontSize: '11px', color: '#86efac', fontWeight: 600 }}>
            Chat Via WhatsApp →
          </span>
        </div>
      </a>

      {/* Animation Style */}
      <style>{`
        @keyframes wa-pop-in {
          0% { opacity: 0; transform: translateY(10px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default WhatsAppWidget;
