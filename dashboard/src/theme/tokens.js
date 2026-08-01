export const BRAND = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  purple: '#8b5cf6',
  purpleDark: '#1B103A',
  black: '#000000',
  white: '#ffffff',
}

export const TEXT = {
  heading: '#0f172a',
  headingLight: '#111111',
  body: '#475569',
  bodyLight: '#374151',
  muted: '#64748b',
  mutedLight: '#6B7280',
  placeholder: '#94a3b8',
  white: '#ffffff',
  whiteMuted: 'rgba(255,255,255,0.70)',
  whiteSubtle: 'rgba(255,255,255,0.55)',
}

export const SURFACE = {
  page: '#ffffff',
  alt: '#f8fafc',
  card: '#ffffff',
  cardHover: '#f8fafc',
  dark: '#1B103A',
}

export const BORDER = {
  default: '1px solid #e2e8f0',
  light: '1px solid #e5e7eb',
  dark: '1px solid rgba(255,255,255,0.15)',
  focus: '1px solid #c7d2fe',
  none: 'none',
}

export const SHADOW = {
  card: '0 1px 3px rgba(0,0,0,0.04)',
  elevated: '0 4px 12px rgba(0,0,0,0.08)',
  featured: '0 4px 24px rgba(99,102,241,0.10), 0 1px 4px rgba(0,0,0,0.04)',
  button: '0 4px 14px rgba(99,102,241,0.25)',
  navbar: '0 4px 20px rgba(0,0,0,0.25)',
}

export const RADIUS = {
  pill: '999px',
  card: 20,
  cardLg: 24,
  button: 14,
  badge: 999,
  input: 12,
  modal: 24,
}

export const SPACING = {
  section: '96px 20px',
  sectionNarrow: '72px 20px',
  container: '1200px',
  containerNarrow: 900,
  gap: 24,
  gapLarge: 48,
  gridGap: 72,
}

export const FONT = {
  family: "'Satoshi', sans-serif",
  size: {
    badge: 11,
    caption: 12,
    small: 13,
    body: 15,
    bodyLg: 16,
    subtitle: 17,
    h3: 'clamp(26px, 3vw, 38px)',
    h2: 'clamp(28px, 3.2vw, 44px)',
    h1: 'clamp(36px, 5.5vw, 68px)',
    price: 44,
    stat: 'clamp(36px, 5vw, 56px)',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  letterSpacing: {
    tight: '-0.03em',
    heading: '-0.025em',
    badge: '0.14em',
    wide: '0.08em',
  },
}

export const ANIMATION = {
  fadeUp: 'opacity 0.8s ease, transform 0.8s ease',
  stagger: (i, base = 0.1) => `opacity 0.6s ease ${i * base}s, transform 0.6s ease ${i * base}s`,
  hover: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
}

export const BREAKPOINTS = {
  desktop: 900,
  mobile: 600,
  tablet: 768,
}
