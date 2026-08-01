import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

/** Ordered plan tiers — index determines rank */
const PLAN_ORDER = ['free', 'lite', 'starter', 'growth', 'scale'];

const ALL_PLANS = [
  {
    id: 'lite',
    name: 'Lite',
    price: 799000,
    credits: 10000,
    features: ['1 Admin Account', '10.000 AI Credits', 'Basic CRM Database', 'Standard Support'],
    gradient: 'from-blue-500 to-cyan-500',
    border: 'border-blue-200 hover:border-blue-400',
    badge: null,
    buttonGradient: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 1749000,
    credits: 50000,
    features: ['3 Admin Accounts', '50.000 AI Credits', 'Advanced CRM Database', 'WhatsApp API Integration', 'Priority Support'],
    gradient: 'from-indigo-500 to-purple-600',
    border: 'border-indigo-300 hover:border-indigo-500',
    badge: 'Paling Populer',
    buttonGradient: 'from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700',
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 3499000,
    credits: 125000,
    features: ['10 Admin Accounts', '125.000 AI Credits', 'Full CRM Suite', 'Multiple WA Channels', 'Dedicated AM'],
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-200 hover:border-amber-400',
    badge: null,
    buttonGradient: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 6249000,
    credits: 200000,
    features: ['Unlimited Accounts', '200.000 AI Credits', 'Custom Integrations', 'White Label Options', '24/7 SLA Support'],
    gradient: 'from-purple-600 to-pink-600',
    border: 'border-purple-200 hover:border-purple-400',
    badge: 'Best Value',
    buttonGradient: 'from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
  }
];

const formatCredits = (n) => new Intl.NumberFormat('id-ID').format(n);

const Plans = () => {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loadingPlan, setLoadingPlan] = useState('');
  const [subscriptionData, setSubscriptionData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/subscription/status');
        if (res.data.status) {
          setCurrentPlan(res.data.data.subscription_plan || 'free');
          setSubscriptionData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch plan', err);
      }
    };
    fetchStatus();
  }, []);

  const handleSubscribe = async (planKey) => {
    setLoadingPlan(planKey);
    try {
      const res = await api.post('/subscription/transaction', { planKey });
      if (res.data.status && res.data.token) {
        window.snap.pay(res.data.token, {
          onSuccess: function () {
            alert('Pembayaran sukses! Paket Anda telah diperbarui.');
            navigate('/billing');
          },
          onPending: function () { alert('Menunggu pembayaran Anda.'); },
          onError: function () { alert('Pembayaran gagal.'); },
          onClose: function () { console.log('User menutup popup pembayaran'); }
        });
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Terjadi kesalahan saat memulai pembayaran.');
    } finally {
      setLoadingPlan('');
    }
  };

  const expiresAt = subscriptionData?.subscription_expires_at
    ? new Date(subscriptionData.subscription_expires_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const isHighestPlan = currentPlan === 'scale';
  const isSubscribed = currentPlan && currentPlan !== 'free';

  // Filter plans: only show plans ABOVE the current plan tier
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const availablePlans = ALL_PLANS.filter(plan => {
    const planIndex = PLAN_ORDER.indexOf(plan.id);
    return planIndex > currentPlanIndex;
  });

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Header */}
      <div className="text-center pt-12 pb-10 px-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-5">
          <Icon name="Zap" size={12} />
          {isSubscribed ? 'Upgrade Paket' : 'Pilih Paket AI Anda'}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          {isHighestPlan ? 'Anda di Paket Tertinggi' : 'Tingkatkan Kemampuan AI Anda'}
        </h1>
        <p className="text-slate-500 mt-3 text-[14px] max-w-xl mx-auto leading-relaxed">
          {isHighestPlan
            ? 'Anda sudah menggunakan paket Scale, paket tertinggi kami. Butuh lebih? Hubungi kami untuk paket Enterprise yang disesuaikan.'
            : 'Lebih banyak kredit AI = lebih banyak percakapan yang bisa diotomatisasi. Pilih paket yang tepat untuk bisnis Anda.'
          }
        </p>

        {/* Current plan badge */}
        <div className="mt-5 inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${currentPlan === 'free' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
          <span className="text-[12px] text-slate-600 font-medium">
            Paket aktif: <span className="font-bold text-slate-800 uppercase">{currentPlan}</span>
            {expiresAt && <span className="text-slate-400 font-normal ml-1">— aktif hingga {expiresAt}</span>}
          </span>
        </div>
      </div>

      {/* Free Plan Banner */}
      {currentPlan === 'free' && (
        <div className="max-w-5xl mx-auto px-4 mb-8">
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Icon name="AlertTriangle" size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-amber-800">Anda menggunakan Free Plan</p>
              <p className="text-[12px] text-amber-600 mt-0.5">
                Paket gratis hanya mendapat <span className="font-bold">700 kredit AI</span>. Upgrade sekarang untuk mendapatkan lebih banyak kredit dan fitur.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Highest Plan — Enterprise CTA */}
      {isHighestPlan && (
        <div className="max-w-2xl mx-auto px-4 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-500/20">
              <Icon name="Building2" size={28} className="text-white" />
            </div>
            <h2 className="text-[22px] font-black text-slate-900 mb-2">Butuh Lebih dari Scale?</h2>
            <p className="text-[13px] text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
              Dapatkan paket Enterprise dengan kredit tak terbatas, integrasi custom, dedicated infrastructure, dan SLA premium yang disesuaikan untuk kebutuhan bisnis Anda.
            </p>
            <a
              href="mailto:contact@luevora.com?subject=Enterprise%20Plan%20Request&body=Halo%20Tim%20Luevora%2C%0A%0ASaya%20tertarik%20dengan%20paket%20Enterprise.%20Mohon%20informasi%20lebih%20lanjut.%0A%0ATerima%20kasih."
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-[14px] text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 transition-all active:scale-95"
            >
              <Icon name="Mail" size={16} />
              Hubungi Tim Enterprise
            </a>
            <p className="text-[11px] text-slate-400 mt-3">
              atau email langsung ke <span className="font-semibold">contact@luevora.com</span>
            </p>
          </div>
        </div>
      )}

      {/* Plans Grid — only show plans above the current tier */}
      {availablePlans.length > 0 && (
        <div className={`max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 ${
          availablePlans.length === 1 ? 'lg:grid-cols-1 max-w-md' :
          availablePlans.length === 2 ? 'lg:grid-cols-2 max-w-2xl' :
          availablePlans.length === 3 ? 'lg:grid-cols-3 max-w-4xl' :
          'lg:grid-cols-4'
        } gap-5`}>
          {availablePlans.map((plan) => {
            const isActive = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col bg-white rounded-3xl border-2 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${plan.border} ${isActive ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.gradient} text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap`}>
                    {plan.badge}
                  </div>
                )}

                {/* Header */}
                <div className={`p-6 rounded-t-[22px] bg-gradient-to-br ${plan.gradient}`}>
                  <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-white text-[22px] font-black leading-none">
                      Rp {plan.price.toLocaleString('id-ID')}
                    </span>
                    <span className="text-white/60 text-[11px] font-semibold">/bln</span>
                  </div>
                  {/* Credits highlight */}
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5">
                    <Icon name="Zap" size={12} className="text-white" />
                    <span className="text-white text-[12px] font-bold">{formatCredits(plan.credits)} AI Credits</span>
                  </div>
                </div>

                {/* Features */}
                <div className="p-5 flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-slate-600">
                        <Icon name="CheckCircle2" size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-5 pt-0">
                  <button
                    onClick={() => !isActive && handleSubscribe(plan.id)}
                    disabled={loadingPlan === plan.id || isActive}
                    className={`w-full py-3 rounded-xl font-bold text-[13px] text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r ${plan.buttonGradient} shadow-md`}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Memproses...
                      </span>
                    ) : isActive ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon name="CheckCircle2" size={14} />
                        Paket Aktif
                      </span>
                    ) : isSubscribed ? 'Upgrade ke Paket Ini' : 'Pilih Paket'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Free Plan Info */}
      <div className="max-w-5xl mx-auto px-4 mt-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Icon name="Info" size={16} className="text-slate-500" />
          </div>
          <div>
            <p className="text-[12.5px] font-bold text-slate-700">Tanpa Berlangganan (Free)</p>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Akun tanpa paket aktif mendapatkan <span className="font-semibold text-slate-700">700 kredit AI</span> untuk mencoba layanan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plans;
