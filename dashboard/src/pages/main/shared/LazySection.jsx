import React, { useRef, useState, useEffect } from 'react';

const preloadAsset = (src) => new Promise((resolve) => {
  if (src.endsWith('.glb')) {
    fetch(src).then(r => r.ok ? r.arrayBuffer() : null).then(resolve).catch(resolve);
  } else {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  }
});

/* ─── Smart Lazy Section ───────────────────────────────────────────────── */
/* Dual IntersectionObserver strategy:
   - Observer 1 (2000px): starts downloading assets when section is ~2 screens away
   - Observer 2 (300px):  mounts the section
   - Result: Assets start downloading early. If user scrolls fast, section still mounts immediately (showing text/layout) while assets finish loading natively. */
const LazySection = ({ children, rootMargin = '300px', preloadMargin = '2000px', minHeight = '100vh', assets = [] }) => {
  const ref = useRef(null);
  const [closeToViewport, setCloseToViewport] = useState(false);

  /* Observer 1: preload assets when ~2000px away */
  useEffect(() => {
    if (assets.length === 0) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          assets.forEach(preloadAsset); // Fire and forget, don't wait for completion
          obs.disconnect();
        }
      },
      { rootMargin: preloadMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [assets, preloadMargin]);

  /* Observer 2: mount when 300px away */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setCloseToViewport(true); obs.disconnect(); } },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: closeToViewport ? undefined : minHeight }}>
      {closeToViewport ? children : null}
    </div>
  );
};

export default LazySection;
