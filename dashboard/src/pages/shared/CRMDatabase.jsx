import React, { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';
import CrmHistoryModal from '@/components/shared/CrmHistoryModal';
import { getContactDisplay } from '@/utils/contactDisplay';

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (v, fallback = '-') => (v && v !== '' ? v : fallback);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtCurrency = (n) => n ? `Rp ${Number(n).toLocaleString('id-ID')}` : '-';

const safeJson = (v) => {
  if (!v) return {};
  try { return JSON.parse(v); } catch { return {}; }
};

const pipelineColors = {
  new_prospect: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-100 text-blue-700',
  evaluation: 'bg-yellow-100 text-yellow-700',
  closing: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const commPrefLabels = { whatsapp: 'WhatsApp', email: 'Email', phone: 'Telepon' };
const genderLabels = { male: 'Laki-laki', female: 'Perempuan', other: 'Lainnya' };

// ── Section: Field Row ──────────────────────────────────────────────
const Field = ({ label, value, className = '' }) => (
  <div className={className}>
    <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-semibold block mb-1">{label}</span>
    <span className="text-[13px] text-slate-700">{fmt(value)}</span>
  </div>
);

// ── Tab: Profil (Identity + Profiling) ──────────────────────────────
const TabProfil = ({ lead }) => {
  const social = safeJson(lead.social_media);
  return (
    <div className="space-y-0 divide-y divide-slate-100">
      {/* Platform Identity */}
      <section className="pb-5 pt-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
          <Icon name="Link2" size={11} /> Channel Platform
        </p>
        <div className="flex flex-wrap gap-2">
          {lead.whatsapp_phone && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
                <Icon name="Phone" size={11} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">WhatsApp</div>
                <div className="text-xs font-mono text-slate-700 font-medium">{lead.whatsapp_phone}</div>
              </div>
            </div>
          )}
          {lead.telegram_id && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center shrink-0">
                <Icon name="Send" size={11} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">Telegram</div>
                <div className="text-xs font-mono text-slate-700 font-medium">{lead.telegram_id}</div>
              </div>
            </div>
          )}
          {lead.instagram_username && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="w-6 h-6 rounded-md bg-pink-600 flex items-center justify-center shrink-0">
                <Icon name="Instagram" size={11} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">Instagram</div>
                <div className="text-xs font-mono text-slate-700 font-medium">@{lead.instagram_username}</div>
              </div>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
                <Icon name="Mail" size={11} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">Email</div>
                <div className="text-xs font-mono text-slate-700 font-medium">{lead.email}</div>
              </div>
            </div>
          )}
          {!lead.whatsapp_phone && !lead.telegram_id && !lead.instagram_username && !lead.email && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <div className="w-6 h-6 rounded-md bg-slate-400 flex items-center justify-center shrink-0">
                <Icon name="Phone" size={11} className="text-white" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">ID Sistem</div>
                <div className="text-xs font-mono text-slate-700 font-medium">{lead.phone}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 1: Identity & Contact */}
      <section className="py-5">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
          <Icon name="User" size={11} /> Identitas & Kontak
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Nama Depan" value={lead.first_name} />
          <Field label="Nama Belakang" value={lead.last_name} />
          <Field label="Nama Tersimpan" value={lead.saved_name || '(belum ada nama)'} />
          <Field label="No. Telepon" value={lead.phone} />
          <Field label="Jabatan / Posisi" value={lead.position_title} />
          <Field label="Kota" value={lead.city} />
          <Field label="Negara" value={lead.country} />
          <Field label="Alamat" value={lead.full_address} className="col-span-2" />
          <Field label="LinkedIn" value={lead.linkedin_url} className="col-span-2" />
          {Object.keys(social).length > 0 && (
            <div className="col-span-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-semibold block mb-1.5">Media Sosial</span>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(social).map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline font-medium capitalize">{k}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Profiling */}
      <section className="py-5">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
          <Icon name="BarChart3" size={11} /> Profiling
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Jenis Kelamin" value={genderLabels[lead.gender] || lead.gender} />
          <Field label="Tanggal Lahir" value={fmtDate(lead.birth_date)} />
          <Field label="Nama Perusahaan" value={lead.company_name} />
          <Field label="Industri" value={lead.industry} />
          <Field label="Ukuran Perusahaan" value={lead.company_size} />
          <Field label="Estimasi Pendapatan" value={lead.annual_revenue} />
          <Field label="Sumber Prospek" value={lead.lead_source} className="col-span-2" />
        </div>
      </section>
    </div>
  );
};

// ── Tab: Transaksi ──────────────────────────────────────────────────
const TabTransaksi = ({ lead }) => (
  <div className="space-y-0 divide-y divide-slate-100">
    {/* Pipeline */}
    <section className="pb-5 pt-1">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="GitBranch" size={11} /> Status Pipeline
      </p>
      <div className="flex items-center gap-3">
        <span className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${pipelineColors[lead.pipeline_status] || 'bg-slate-100 text-slate-500'}`}>
          {(lead.pipeline_status || 'Belum ditentukan').replace(/_/g, ' ')}
        </span>
      </div>
    </section>

    {/* Transaction Summary */}
    <section className="py-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="Wallet" size={11} /> Ringkasan Transaksi
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <Field label="Total Transaksi" value={fmtCurrency(lead.computed_total_spent || lead.total_spent)} />
        <Field label="Jumlah Pembelian" value={lead.computed_purchase_count > 0 ? `${lead.computed_purchase_count} kali` : '-'} />
        <Field label="Pembelian Pertama" value={fmtDate(lead.computed_first_purchase_at || lead.first_purchase_at)} />
        <Field label="Transaksi Terakhir" value={fmtDate(lead.computed_last_purchase_at || lead.last_purchase_at)} />
        <Field label="Perpanjangan Kontrak" value={fmtDate(lead.contract_renewal_at)} className="col-span-2" />
      </div>
    </section>

    {/* Travel Bookings */}
    {lead.travel_bookings && lead.travel_bookings.length > 0 && (
      <section className="py-5">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
          <Icon name="PlaneTakeoff" size={11} /> Riwayat Perjalanan
        </p>
        <div className="space-y-2">
          {lead.travel_bookings.map((b, i) => (
            <div key={i} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center">
              <div>
                <div className="font-semibold text-slate-700 text-[13px]">{b.package_name || 'Custom Trip'}</div>
                <div className="text-slate-500 text-xs mt-0.5">{fmtDate(b.departure_date)}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600">{b.status}</span>
            </div>
          ))}
        </div>
      </section>
    )}
  </div>
);

// ── Tab: Interaksi ──────────────────────────────────────────────────
const TabInteraksi = ({ phone }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ interaction_type: 'call', subject: '', detail: '', channel: 'whatsapp' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers/${encodeURIComponent(phone)}/interactions`);
      if (res.data.status) setLogs(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [phone]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/customers/${encodeURIComponent(phone)}/interactions`, form);
      setForm({ interaction_type: 'call', subject: '', detail: '', channel: 'whatsapp' });
      setShowForm(false);
      fetchLogs();
    } catch (err) {
      alert('Gagal menyimpan: ' + (err.response?.data?.message || err.message));
    }
  };

  const typeIcons = { call: 'Phone', meeting: 'Calendar', email: 'Mail', complaint: 'AlertTriangle', marketing_touch: 'Megaphone' };
  const typeColors = { call: 'text-blue-500', meeting: 'text-purple-500', email: 'text-green-500', complaint: 'text-red-500', marketing_touch: 'text-amber-500' };

  return (
    <div className="space-y-0 divide-y divide-slate-100">
      <section className="pb-5 pt-1">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 flex items-center gap-1.5">
            <Icon name="MessageSquare" size={11} /> Log Komunikasi
          </p>
          <button onClick={() => setShowForm(!showForm)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <Icon name="Plus" size={12} /> Tambah Log
          </button>
        </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tipe Interaksi</label>
              <select value={form.interaction_type} onChange={e => setForm({ ...form, interaction_type: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                <option value="call">Telepon</option>
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="complaint">Keluhan</option>
                <option value="marketing_touch">Marketing</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Channel</label>
              <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="phone">Telepon</option>
                <option value="in_person">Tatap Muka</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Subjek</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" placeholder="Topik pembicaraan..." />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Detail</label>
            <textarea value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" placeholder="Catatan interaksi..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Simpan</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm"><Icon name="Loader2" className="animate-spin mr-2" size={18} /> Memuat log...</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon name="Inbox" size={32} className="text-slate-200 mb-3" />
          <p className="text-[13px] text-slate-400">Belum ada log interaksi</p>
        </div>
      ) : (
        <div className="relative border-l border-slate-200 ml-3 py-2 mt-4">
          {logs.map((log, i) => (
            <div key={log.id || i} className="mb-4 ml-6 relative">
              <span className={`absolute -left-[31px] top-2 w-3.5 h-3.5 rounded-full bg-white border-2 ${typeColors[log.interaction_type] ? 'border-current' : 'border-slate-300'}`} />
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${typeColors[log.interaction_type] || 'text-slate-500'}`}>
                    <Icon name={typeIcons[log.interaction_type] || 'Circle'} size={11} />
                    {log.interaction_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{new Date(log.created_at).toLocaleString('id-ID')}</span>
                </div>
                {log.subject && <p className="text-[13px] font-semibold text-slate-800 mb-0.5">{log.subject}</p>}
                {log.detail && <p className="text-xs text-slate-600 leading-relaxed">{log.detail}</p>}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                  <span className="capitalize">{log.channel}</span>
                  {log.logged_by && <span>• {log.logged_by}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>
    </div>
  );
};

const TabPreferensi = ({ lead }) => (
  <div className="space-y-0 divide-y divide-slate-100">
    <section className="pb-5 pt-1">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="Settings" size={11} /> Preferensi Komunikasi
      </p>
      <Field label="Channel Preferensi" value={commPrefLabels[lead.communication_preference] || lead.communication_preference} />
    </section>

    <section className="py-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="StickyNote" size={11} /> Catatan Personal
      </p>
      {lead.personal_notes ? (
        <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{lead.personal_notes}</p>
      ) : (
        <p className="text-[13px] text-slate-400 italic">Belum ada catatan personal</p>
      )}
    </section>

    <section className="py-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="Star" size={11} /> Tingkat Kepuasan (NPS)
      </p>
      {lead.nps_score !== null && lead.nps_score !== undefined ? (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-sm ${lead.nps_score >= 9 ? 'bg-emerald-500' : lead.nps_score >= 7 ? 'bg-amber-500' : 'bg-rose-500'}`}>
            {lead.nps_score}
          </div>
          <span className="text-[13px] text-slate-700 font-medium">
            {lead.nps_score >= 9 ? 'Promotor' : lead.nps_score >= 7 ? 'Pasif' : 'Detraktor'}
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-slate-400 italic">Belum ada skor NPS</p>
      )}
    </section>

    <section className="py-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="Heart" size={11} /> Minat / Preferensi AI
      </p>
      {lead.preferences ? (
        <ul className="list-disc pl-4 text-[13px] text-slate-700 space-y-1.5 marker:text-slate-300">
          {lead.preferences.split('\n').filter(l => l.trim()).map((line, i) => (
            <li key={i} className="leading-snug">{line.replace(/^- /, '')}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-slate-400 italic">Belum ada data preferensi</p>
      )}
    </section>

    <section className="py-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
        <Icon name="FileText" size={11} /> Keterangan (Chat Summary)
      </p>
      {lead.chat_summary ? (
        <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{lead.chat_summary}</p>
      ) : (
        <p className="text-[13px] text-slate-400 italic">Belum ada ringkasan</p>
      )}
    </section>
  </div>
);

// ── Detail Modal ────────────────────────────────────────────────────
const CRMDetailModal = ({ lead, onClose, onOpenHistory, onEdit }) => {
  const [activeTab, setActiveTab] = useState('profil');
  if (!lead) return null;

  const { primary: contactPrimary, secondary: contactSecondary } = getContactDisplay(lead);
  const name = contactPrimary;
  const tabs = [
    { key: 'profil', label: 'Profil', icon: 'User' },
    { key: 'transaksi', label: 'Transaksi', icon: 'Wallet' },
    { key: 'interaksi', label: 'Interaksi', icon: 'MessageSquare' },
    { key: 'preferensi', label: 'Preferensi', icon: 'Settings' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-base shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">{name}</h2>
              {contactSecondary && (
                <p className="text-[11px] text-slate-400 mt-0.5">{contactSecondary}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lead.pipeline_status && (
              <span className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${pipelineColors[lead.pipeline_status] || 'bg-slate-100 text-slate-500'}`}>
                {lead.pipeline_status.replace(/_/g, ' ')}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide ${lead.label === 'customer' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              {lead.label === 'customer' ? 'Customer' : lead.status || 'Baru'}
            </span>
            <button onClick={onClose} className="ml-1 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 shrink-0 bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-medium border-b-2 transition-colors mr-1 ${
                activeTab === t.key
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {activeTab === 'profil' && <TabProfil lead={lead} />}
          {activeTab === 'transaksi' && <TabTransaksi lead={lead} />}
          {activeTab === 'interaksi' && <TabInteraksi phone={lead.phone} />}
          {activeTab === 'preferensi' && <TabPreferensi lead={lead} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => { onClose(); onOpenHistory(lead.phone); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-medium text-[12px] rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Icon name="History" size={13} /> Lihat CRM History
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit && onEdit(lead)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 font-medium text-[12px] rounded-lg hover:bg-slate-50 transition-colors">
              <Icon name="Pencil" size={13} /> Edit
            </button>
            <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── CRM Form Modal (Add / Edit) ──────────────────────────────────────
const CRMFormModal = ({ lead, onClose, onSave }) => {
  const isEdit = !!lead;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    phone: lead?.phone || '',
    saved_name: lead?.saved_name || '',
    first_name: lead?.first_name || '',
    last_name: lead?.last_name || '',
    position_title: lead?.position_title || '',
    gender: lead?.gender || '',
    birth_date: lead?.birth_date ? lead.birth_date.slice(0, 10) : '',
    city: lead?.city || '',
    country: lead?.country || '',
    full_address: lead?.full_address || '',
    linkedin_url: lead?.linkedin_url || '',
    company_name: lead?.company_name || '',
    industry: lead?.industry || '',
    company_size: lead?.company_size || '',
    annual_revenue: lead?.annual_revenue || '',
    lead_source: lead?.lead_source || 'manual',
    pipeline_status: lead?.pipeline_status || 'new_prospect',
    contract_renewal_at: lead?.contract_renewal_at ? lead.contract_renewal_at.slice(0, 10) : '',
    communication_preference: lead?.communication_preference || '',
    nps_score: lead?.nps_score ?? '',
    personal_notes: lead?.personal_notes || '',
    preferences: lead?.preferences || '',
    chat_summary: lead?.chat_summary || '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.post('/leads/crm/update', form);
      } else {
        await api.post('/leads/crm/create', form);
      }
      onSave();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white';
  const lbl = 'text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 block mb-1';
  const sec = 'text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 mb-3';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{isEdit ? 'Edit Profil Kontak' : 'Tambah Kontak Baru'}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? `Mengedit ${lead.phone}` : 'Masukkan data kontak secara manual'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"><Icon name="X" size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-0 divide-y divide-slate-100">
          {/* Identitas */}
          <div className="pb-5 space-y-3">
            <p className={sec}>Identitas & Kontak</p>
            <div><label className={lbl}>Nomor Telepon *</label><input required value={form.phone} onChange={set('phone')} disabled={isEdit} className={`${inp} ${isEdit ? 'bg-slate-50 text-slate-400' : ''}`} placeholder="6281234567890" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Nama Depan</label><input value={form.first_name} onChange={set('first_name')} className={inp} placeholder="Budi" /></div>
              <div><label className={lbl}>Nama Belakang</label><input value={form.last_name} onChange={set('last_name')} className={inp} placeholder="Santoso" /></div>
            </div>
            <div><label className={lbl}>Nama Tersimpan / Label</label><input value={form.saved_name} onChange={set('saved_name')} className={inp} placeholder="Budi Travel" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Jabatan</label><input value={form.position_title} onChange={set('position_title')} className={inp} placeholder="Manager" /></div>
              <div>
                <label className={lbl}>Jenis Kelamin</label>
                <select value={form.gender} onChange={set('gender')} className={inp}>
                  <option value="">— Pilih —</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>
            <div><label className={lbl}>Tanggal Lahir</label><input type="date" value={form.birth_date} onChange={set('birth_date')} className={inp} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Kota</label><input value={form.city} onChange={set('city')} className={inp} placeholder="Jakarta" /></div>
              <div><label className={lbl}>Negara</label><input value={form.country} onChange={set('country')} className={inp} placeholder="Indonesia" /></div>
            </div>
            <div><label className={lbl}>Alamat Lengkap</label><textarea rows={2} value={form.full_address} onChange={set('full_address')} className={inp} placeholder="Jl. Contoh No. 1, Jakarta..." /></div>
            <div><label className={lbl}>LinkedIn URL</label><input value={form.linkedin_url} onChange={set('linkedin_url')} className={inp} placeholder="https://linkedin.com/in/username" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Sumber Kontak</label>
                <select value={form.lead_source} onChange={set('lead_source')} className={inp}>
                  <option value="manual">Manual</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="referral">Referral</option>
                  <option value="instagram">Instagram</option>
                  <option value="website">Website</option>
                </select>
              </div>
            </div>
          </div>

          {/* Profiling */}
          <div className="py-5 space-y-3">
            <p className={sec}>Profiling Perusahaan</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Nama Perusahaan</label><input value={form.company_name} onChange={set('company_name')} className={inp} placeholder="PT. Contoh" /></div>
              <div><label className={lbl}>Industri</label><input value={form.industry} onChange={set('industry')} className={inp} placeholder="Pariwisata" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Ukuran Perusahaan</label><input value={form.company_size} onChange={set('company_size')} className={inp} placeholder="1-10, 50-200" /></div>
              <div><label className={lbl}>Estimasi Pendapatan</label><input value={form.annual_revenue} onChange={set('annual_revenue')} className={inp} placeholder="Rp 500jt/tahun" /></div>
            </div>
          </div>

          {/* Pipeline */}

          <div className="py-5 space-y-3">
            <p className={sec}>Pipeline & Transaksi</p>
            <div>
              <label className={lbl}>Status Pipeline</label>
              <select value={form.pipeline_status} onChange={set('pipeline_status')} className={inp}>
                <option value="new_prospect">New Prospect</option>
                <option value="contacted">Contacted</option>
                <option value="evaluation">Evaluation</option>
                <option value="closing">Closing</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Perpanjangan Kontrak</label>
              <input type="date" value={form.contract_renewal_at} onChange={set('contract_renewal_at')} className={inp} />
            </div>
          </div>
          {/* Preferensi */}
          <div className="py-5 space-y-3">
            <p className={sec}>Preferensi & Catatan</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Channel Preferensi</label>
                <select value={form.communication_preference} onChange={set('communication_preference')} className={inp}>
                  <option value="">— Pilih —</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="phone">Telepon</option>
                </select>
              </div>
              <div>
                <label className={lbl}>NPS Score (0–10)</label>
                <input type="number" min="0" max="10" value={form.nps_score} onChange={set('nps_score')} className={inp} placeholder="8" />
              </div>
            </div>
            <div><label className={lbl}>Catatan Personal</label><textarea rows={3} value={form.personal_notes} onChange={set('personal_notes')} className={inp} placeholder="Catatan tentang klien ini..." /></div>
            <div><label className={lbl}>Minat / Preferensi AI</label><textarea rows={3} value={form.preferences} onChange={set('preferences')} className={inp} placeholder={"- Suka paket honeymoon\n- Budget menengah"} /></div>
            <div><label className={lbl}>Keterangan (Chat Summary)</label><textarea rows={3} value={form.chat_summary} onChange={set('chat_summary')} className={inp} placeholder="Ringkasan percakapan..." /></div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Batal</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white font-medium text-[12px] rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {saving ? <><Icon name="Loader2" size={13} className="animate-spin" /> Menyimpan...</> : <><Icon name="Check" size={13} /> {isEdit ? 'Simpan Perubahan' : 'Tambah Kontak'}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────
const CRMDatabase = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPipeline, setFilterPipeline] = useState('all');
  const [selectedHistoryPhone, setSelectedHistoryPhone] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/leads/list?filter=terbaru');
      if (res.data.status) setLeads(res.data.data);
    } catch {
      setError('Gagal memuat data CRM. Periksa koneksi atau coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/leads/crm/suggestions');
      if (res.data.status) setSuggestions(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLeads(); fetchSuggestions(); }, [fetchLeads, fetchSuggestions]);

  const filteredLeads = leads.filter(l => {
    const matchSearch = (l.saved_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.push_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.phone || '').includes(searchTerm);
    const matchPipeline = filterPipeline === 'all' || l.pipeline_status === filterPipeline;
    return matchSearch && matchPipeline;
  });

  const getStatusBadge = (lead) => {
    if (lead.label === 'customer') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">Customer</span>;
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">{lead.status || 'Baru'}</span>;
  };

  const previewText = (text, max = 60) => {
    if (!text) return <span className="text-slate-400 italic text-xs">-</span>;
    const clean = text.replace(/\n/g, ' • ').replace(/- /g, '').trim();
    return <span className="text-xs text-slate-600">{clean.length > max ? clean.slice(0, max) + '...' : clean}</span>;
  };


  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">CRM Database</h1>
          <p className="text-slate-500 text-sm mt-1">Data prospek dan pelanggan yang dicatat otomatis oleh AI dari interaksi chat.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Cari nama atau nomor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56" />
          </div>
          <select value={filterPipeline} onChange={e => setFilterPipeline(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">Semua Pipeline</option>
            <option value="new_prospect">New Prospect</option>
            <option value="contacted">Contacted</option>
            <option value="evaluation">Evaluation</option>
            <option value="closing">Closing</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
          <button onClick={fetchLeads} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600" title="Refresh">
            <Icon name="RefreshCw" size={16} />
          </button>
          {suggestions.length > 0 && (
            <button onClick={() => setShowSuggestions(s => !s)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[12px] font-semibold hover:bg-amber-100 transition-colors">
              <Icon name="UserPlus" size={14} /> {suggestions.length} Saran
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-medium hover:bg-slate-700 transition-colors">
            <Icon name="Plus" size={14} /> Tambah Kontak
          </button>
        </div>
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 flex items-center gap-1.5"><Icon name="UserPlus" size={12} /> Kontak yang Pernah Chat (Belum di CRM)</p>
            <button onClick={() => setShowSuggestions(false)} className="text-amber-400 hover:text-amber-600"><Icon name="X" size={14} /></button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map(s => (
              <div key={s.phone} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2">
                <div>
                  <div className="text-[12px] font-semibold text-slate-700 font-mono">{s.phone}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{Number(s.message_count)} pesan • {fmtDate(s.last_seen)}</div>
                </div>
                <button
                  onClick={() => { setShowAddModal(true); setShowSuggestions(false); }}
                  className="ml-3 flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  <Icon name="Plus" size={10} /> Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-4 w-[18%]">Kontak</th>
                <th className="p-4 w-[16%]">Identitas</th>
                <th className="p-4 w-[16%]">Profil / Segment</th>
                <th className="p-4 w-[12%]">Pipeline</th>
                <th className="p-4 w-[12%]">Transaksi</th>
                <th className="p-4 w-[10%]">Status</th>
                <th className="p-4 w-[8%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400"><Icon name="Loader2" className="animate-spin mx-auto mb-2" size={24} /> Memuat data CRM...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white shadow-lg"><Icon name="AlertCircle" size={22} /></div>
                    <div><h4 className="font-bold text-slate-800 mb-1">Gagal Memuat Data</h4><p className="text-sm text-slate-400 mb-3">{error}</p>
                      <button onClick={fetchLeads} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 border border-red-200"><Icon name="RefreshCw" size={13} className="inline mr-1.5" /> Coba Lagi</button>
                    </div>
                  </div>
                </td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Tidak ada data ditemukan.</td></tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Kontak */}
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const { primary: lp, secondary: ls } = getContactDisplay(lead);
                          return (
                            <>
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                                {(lp || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 text-sm truncate">{lp}</div>
                                {ls && <div className="text-slate-400 text-xs truncate">{ls}</div>}
                              </div>
                            </>
                          );
                        })()}
                          {/* Platform badges */}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {lead.whatsapp_phone && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 text-[9px] font-bold rounded border border-green-200">
                                <Icon name="Phone" size={8} /> WA
                              </span>
                            )}
                            {lead.telegram_id && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded border border-blue-200">
                                <Icon name="Send" size={8} /> TG
                              </span>
                            )}
                            {lead.instagram_username && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-50 text-pink-700 text-[9px] font-bold rounded border border-pink-200">
                                <Icon name="Instagram" size={8} /> IG
                              </span>
                            )}
                            {lead.email && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded border border-amber-200">
                                <Icon name="Mail" size={8} /> EM
                              </span>
                            )}
                          </div>
                        </div>
                    </td>
                    {/* Identitas */}
                    <td className="p-4 align-middle">
                      <div className="text-xs text-slate-700">{lead.position_title || '-'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{[lead.city, lead.country].filter(Boolean).join(', ') || '-'}</div>
                    </td>
                    {/* Profil/Segment */}
                    <td className="p-4 align-middle">
                      <div className="text-xs text-slate-700">{lead.company_name || '-'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{lead.industry || (lead.gender ? (genderLabels[lead.gender] || lead.gender) : '-')}</div>
                      {lead.lead_source && <div className="text-[10px] text-amber-600 font-bold mt-0.5 capitalize">{lead.lead_source.replace(/_/g, ' ')}</div>}
                    </td>
                    {/* Pipeline */}
                    <td className="p-4 align-middle">
                      {lead.pipeline_status ? (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${pipelineColors[lead.pipeline_status] || 'bg-gray-100 text-gray-600'}`}>
                          {lead.pipeline_status.replace(/_/g, ' ')}
                        </span>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                    {/* Transaksi */}
                    <td className="p-4 align-middle">
                      <div className="text-xs font-bold text-slate-700">{fmtCurrency(lead.computed_total_spent || lead.total_spent)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{lead.computed_purchase_count > 0 ? `${lead.computed_purchase_count} pembelian` : '-'}</div>
                    </td>
                    {/* Status */}
                    <td className="p-4 align-middle">{getStatusBadge(lead)}</td>
                    {/* Aksi */}
                    <td className="p-4 align-middle text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setSelectedDetail(lead)} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 border border-indigo-100" title="Detail">
                          <Icon name="Eye" size={12} /> Detail
                        </button>
                        <button onClick={() => setEditLead(lead)} className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 border border-slate-200" title="Edit">
                          <Icon name="Pencil" size={13} />
                        </button>
                        <button onClick={() => setSelectedHistoryPhone(lead.phone)} className="p-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 border border-slate-200" title="CRM History">
                          <Icon name="History" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDetail && (
        <CRMDetailModal
          lead={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onOpenHistory={phone => setSelectedHistoryPhone(phone)}
          onEdit={lead => { setSelectedDetail(null); setEditLead(lead); }}
        />
      )}

      {selectedHistoryPhone && (
        <CrmHistoryModal phone={selectedHistoryPhone} onClose={() => setSelectedHistoryPhone(null)} />
      )}

      {showAddModal && (
        <CRMFormModal onClose={() => setShowAddModal(false)} onSave={() => { fetchLeads(); fetchSuggestions(); }} />
      )}

      {editLead && (
        <CRMFormModal lead={editLead} onClose={() => setEditLead(null)} onSave={() => { fetchLeads(); setEditLead(null); }} />
      )}
    </div>
  );
};

export default CRMDatabase;
