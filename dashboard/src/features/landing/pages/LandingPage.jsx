import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/shared/Icon';

/* ────────────────────────────────────────────
   Animated counter hook
   ──────────────────────────────────────────── */
const useCounter = (end, duration = 2000) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return [count, () => setStarted(true)];
};

/* ────────────────────────────────────────────
   Intersection Observer hook for scroll reveal
   ──────────────────────────────────────────── */
const useReveal = (threshold = 0.15) => {
  const [ref, setRef] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(ref);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return [setRef, visible];
};

/* ────────────────────────────────────────────
   Data
   ──────────────────────────────────────────── */
const features = [
  { icon: 'MessageSquare', title: 'WhatsApp CRM', desc: 'Kelola semua percakapan pelanggan langsung dari satu dashboard terintegrasi.' },
  { icon: 'Brain', title: 'AI Integration', desc: 'Asisten AI yang membantu follow-up otomatis dan menjawab pertanyaan pelanggan.' },
  { icon: 'BarChart3', title: 'Analytics Real-time', desc: 'Pantau performa penjualan, leads, dan konversi secara real-time.' },
  { icon: 'Users', title: 'Leads Management', desc: 'Kelola leads dari berbagai sumber dengan pipeline yang terstruktur.' },
  { icon: 'Calendar', title: 'Scheduling', desc: 'Atur jadwal, reschedule, dan kelola booking pelanggan dengan mudah.' },
  { icon: 'Shield', title: 'Multi-tenant', desc: 'Satu platform untuk berbagai jenis bisnis dengan isolasi data yang aman.' },
];

const businessTypes = [
  { icon: 'GraduationCap', name: 'Course & Les', desc: 'Kelola kursus, jadwal, dan siswa.', color: 'from-violet-500 to-indigo-600' },
  { icon: 'Car', name: 'Rental & Sewa', desc: 'Manajemen aset dan pemesanan.', color: 'from-emerald-500 to-teal-600' },
  { icon: 'ShoppingBag', name: 'Retail & Toko', desc: 'Inventaris dan order management.', color: 'from-amber-500 to-orange-600' },
  { icon: 'Plane', name: 'Travel & Wisata', desc: 'Paket wisata dan reservasi.', color: 'from-sky-500 to-blue-600' },
];

const stats = [
  { label: 'Bisnis Aktif', value: 500 , suffix: '+' },
  { label: 'Pesan Terkirim', value: 2, suffix: 'M+' },
  { label: 'Leads Dikelola', value: 150, suffix: 'K+' },
  { label: 'Uptime', value: 99.9, suffix: '%', decimal: true },
];

const testimonials = [
  { name: 'Rina Sari', role: 'Owner, BimbelPro', text: 'Luevora mengubah cara kami mengelola siswa. Follow-up otomatis lewat WA sangat membantu!', avatar: 'R' },
  { name: 'Budi Hartono', role: 'Manager, RentCar ID', text: 'Scheduling dan manajemen aset jadi jauh lebih efisien. Recommended!', avatar: 'B' },
  { name: 'Dewi Anggraini', role: 'CEO, TravelKita', text: 'AI-nya luar biasa. Bisa handle pertanyaan pelanggan 24/7.', avatar: 'D' },
];

/* ────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────── */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-lg border-b border-border-base' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-display font-black text-xl text-indigo-base tracking-tighter">Luevora CRM</h1>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-semibold text-text-muted hover:text-indigo-base transition-colors">Fitur</a>
          <a href="#business" className="text-sm font-semibold text-text-muted hover:text-indigo-base transition-colors">Bisnis</a>
          <a href="#testimonials" className="text-sm font-semibold text-text-muted hover:text-indigo-base transition-colors">Testimoni</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-indigo-base hover:bg-indigo-soft rounded-xl transition-all">Masuk</Link>
          <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50 hover:-translate-y-0.5 transition-all">Mulai Gratis</Link>
        </div>
      </div>
    </nav>
  );
};

const StatItem = ({ label, value, suffix, decimal }) => {
  const [count, start] = useCounter(decimal ? Math.floor(value) : value);
  const [ref, visible] = useReveal();

  useEffect(() => { if (visible) start(); }, [visible]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-display font-black text-white mb-1">
        {decimal ? `${count}.9` : count}{suffix}
      </div>
      <div className="text-sm text-indigo-200 font-medium">{label}</div>
    </div>
  );
};

/* ────────────────────────────────────────────
   Main Landing Page
   ──────────────────────────────────────────── */
const LandingPage = () => {
  const [featRef, featVis] = useReveal();
  const [bizRef, bizVis] = useReveal();
  const [testRef, testVis] = useReveal();

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <Navbar />

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
{/* Pure white hero — no gradient blobs */}

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-indigo-600">Platform CRM #1 untuk UMKM Indonesia</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-black text-text-heading leading-[1.1] tracking-tight mb-6">
            Kelola Bisnis Anda{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 bg-clip-text text-transparent">Lebih Cerdas</span>
          </h1>

          <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            CRM all-in-one dengan integrasi WhatsApp dan AI Integration. Otomatisasi follow-up, kelola leads, dan tingkatkan konversi bisnis Anda.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="group px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl shadow-xl shadow-indigo-200/60 hover:shadow-2xl hover:shadow-indigo-300/60 hover:-translate-y-1 transition-all flex items-center gap-2">
              Coba Sekarang — Gratis
              <Icon name="ArrowRight" size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#features" className="px-8 py-4 text-base font-bold text-text-body bg-white border border-border-base rounded-2xl hover:border-indigo-base hover:text-indigo-base transition-all shadow-sm">
              Lihat Fitur
            </a>
          </div>

          {/* Mini dashboard mockup */}
          <div className="mt-16 relative">
            <div className="bg-white rounded-2xl border border-border-base shadow-2xl shadow-indigo-100/40 p-1.5 max-w-3xl mx-auto">
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 h-6 bg-white/80 rounded-lg border border-border-base" />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {['Leads Baru', 'Konversi', 'Revenue'].map((t, i) => (
                    <div key={t} className="bg-white rounded-xl p-4 border border-border-base shadow-xs">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">{t}</div>
                      <div className="text-2xl font-display font-black text-text-heading">{['247', '68%', '42.5M'][i]}</div>
                      <div className="text-[10px] font-bold text-emerald-500 mt-1">↑ {['+12%', '+5%', '+18%'][i]}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 bg-white/60 rounded-lg border border-border-base" />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 inset-x-12 h-16 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section className="py-16 relative overflow-hidden" style={{ background: "url('/assets/Wave (1).svg') center/cover no-repeat, #1B103A" }}>
        <div className="absolute inset-0" style={{ background: 'rgba(27,16,58,0.3)' }} />
        <div className="relative z-10 max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => <StatItem key={s.label} {...s} />)}
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" ref={featRef} className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4 border border-indigo-100">Fitur Unggulan</span>
            <h2 className="text-3xl md:text-5xl font-display font-black text-text-heading tracking-tight mb-4">Semua yang Anda Butuhkan</h2>
            <p className="text-text-muted max-w-xl mx-auto">Satu platform lengkap untuk mengelola seluruh aspek bisnis Anda.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={f.title} className={`group bg-white rounded-2xl p-8 border border-border-base hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1 transition-all duration-500 ${featVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-200/50 group-hover:scale-110 transition-transform">
                  <Icon name={f.icon} size={22} className="text-white" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-display font-black text-text-heading mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BUSINESS TYPES ═══════ */}
      <section id="business" ref={bizRef} className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold uppercase tracking-widest mb-4 border border-violet-100">Multi-Bisnis</span>
            <h2 className="text-3xl md:text-5xl font-display font-black text-text-heading tracking-tight mb-4">Satu Platform, Berbagai Bisnis</h2>
            <p className="text-text-muted max-w-xl mx-auto">Luevora dirancang untuk mendukung berbagai jenis bisnis dengan fitur yang disesuaikan.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {businessTypes.map((b, i) => (
              <div key={b.name} className={`group relative rounded-2xl p-8 border border-border-base bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden ${bizVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${b.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${b.color} flex items-center justify-center mb-5 shadow-lg group-hover:bg-white/20 group-hover:shadow-none transition-all`}>
                    <Icon name={b.icon} size={26} className="text-white" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-lg font-display font-black text-text-heading group-hover:text-white mb-2 transition-colors">{b.name}</h3>
                  <p className="text-sm text-text-muted group-hover:text-white/80 transition-colors">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section id="testimonials" ref={testRef} className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-widest mb-4 border border-emerald-100">Testimoni</span>
            <h2 className="text-3xl md:text-5xl font-display font-black text-text-heading tracking-tight">Dipercaya Ratusan Bisnis</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={t.name} className={`bg-white rounded-2xl p-8 border border-border-base shadow-sm hover:shadow-lg transition-all duration-500 ${testVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: `${i * 120}ms` }}>
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <Icon key={s} name="Star" size={16} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-sm text-text-body leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">{t.avatar}</div>
                  <div>
                    <div className="text-sm font-bold text-text-heading">{t.name}</div>
                    <div className="text-xs text-text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: "url('/assets/Simple Shiny.svg') center/cover no-repeat, #1B103A" }}
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-display font-black text-white tracking-tight mb-6">Siap Tingkatkan Bisnis Anda?</h2>
          <p className="text-lg text-indigo-100 mb-10 max-w-xl mx-auto">Bergabung dengan ratusan bisnis yang sudah menggunakan Luevora CRM. Mulai gratis, tanpa kartu kredit.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="group px-8 py-4 text-base font-bold text-indigo-600 bg-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-2">
              Mulai Sekarang
              <Icon name="ArrowRight" size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#features" className="px-8 py-4 text-base font-bold text-white border-2 border-white/30 rounded-2xl hover:bg-white/10 transition-all">Pelajari Lebih Lanjut</a>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-12 px-6 text-white" style={{ background: "url('/assets/Cloudy.svg') center/cover no-repeat, #1B103A" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Icon name="Zap" size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-display font-black text-lg text-white tracking-tighter">Luevora</span>
            </div>
            <p className="text-sm">&copy; 2026 Luevora CRM Infrastructure. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
