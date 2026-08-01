import React, { useEffect, useRef } from 'react';
import ChatOpsPhoneMockup from '../shared/ChatOpsPhoneMockup';

const ChatOpsSection = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  /* Canvas dot-wave animation â€” replaces 392 DOM divs */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const COLS = 28, ROWS = 14, CELL = 28;
    const W = COLS * CELL, H = ROWS * CELL;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const dots = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        dots.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, delay: ((c * 0.055) + (r * 0.08)) % 2.0 });

    const DUR = 2.2, cx = W / 2, cy = H / 2, rx = W * 0.70, ry = H * 0.75;
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const start = performance.now() / 1000;

    const draw = () => {
      const now = performance.now() / 1000 - start;
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const p = (((now - d.delay) % DUR) + DUR) % DUR / DUR;
        const wave = p < 0.5 ? ease(p * 2) : ease((1 - p) * 2);
        const radius = 3 * (0.75 + 0.4 * wave);
        /* elliptical mask matching CSS radial-gradient(ellipse 70% 75% ... black 30%, transparent 80%) */
        const nd = Math.sqrt(((d.x - cx) / rx) ** 2 + ((d.y - cy) / ry) ** 2);
        const mask = nd <= 0.30 ? 1 : nd >= 0.80 ? 0 : 1 - (nd - 0.30) / 0.50;
        if (mask <= 0) continue;
        ctx.globalAlpha = (0.12 + 0.88 * wave) * 0.9 * mask;
        ctx.fillStyle = 'rgb(236, 72, 153)';
        ctx.beginPath(); ctx.arc(d.x, d.y, radius, 0, Math.PI * 2); ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        overflow: 'hidden',
        padding: '72px 0',
      }}
    >
      <div className="lp-chatops-grid" style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 40px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: '72px',
      }}>

        {/* LEFT: Phone mockup */}
        <ChatOpsPhoneMockup />

        {/* RIGHT: Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#6366f1', margin: 0,
          }}>ChatOps Assistant</p>
          <h2 style={{
            fontSize: 'clamp(26px, 2.8vw, 40px)', fontWeight: 800,
            color: '#0f172a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em',
          }}>Pantau dari HP.<br />Di Mana Saja.</h2>
          <p style={{
            fontSize: 'clamp(14px, 1.05vw, 16px)', color: '#475569',
            lineHeight: 1.8, margin: 0, maxWidth: '500px',
          }}>
            Imagine having a proactive manager right in your pocket.
            With our Agent Management Router, your AI doesn't just wait for instructions;
            it actively keeps you in the loop. The AI proactively sends you important updates
            directly, alerting you to reservations, leads, and special customer requests.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ChatOpsSection;
