import { useState, useEffect } from 'react';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

/**
 * Bank Settings Component
 * Manages bank accounts for payment verification.
 * Extracted from Banking.jsx to be embedded in Configuration.jsx
 */
const BankSettings = () => {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_holder: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/banking');
      if (data.success) {
        setBanks(data.data);
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      alert('Gagal mengambil data rekening bank.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.bank_name.trim() || !form.account_number.trim() || !form.account_holder.trim()) {
      alert('Mohon lengkapi semua data rekening.');
      return;
    }
    
    try {
      setSaving(true);
      const { data } = await api.post('/banking', form);
      if (data.success) {
        setBanks((prev) => [data.data, ...prev]);
        setForm({ bank_name: '', account_number: '', account_holder: '' });
      }
    } catch (error) {
      console.error('Error saving bank:', error);
      alert('Gagal menyimpan rekening bank. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { data } = await api.delete(`/banking/${id}`);
      if (data.success) {
        setBanks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (error) {
      console.error('Error deleting bank:', error);
      alert('Gagal menghapus rekening bank. Coba lagi.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="w-full">
      {/* ── Add Bank Account Card ── */}
      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-bg-subtle">
          <h6 className="font-display font-bold text-sm text-text-heading flex items-center gap-2">
            <Icon name="Landmark" size={16} className="text-indigo-base" strokeWidth={2.5} />
            Pengaturan Rekening Bank
          </h6>
          <p className="text-text-muted text-xs mt-1">Kelola rekening bank untuk verifikasi pembayaran pelanggan.</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end mb-6">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Bank Name</label>
              <input
                type="text"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                placeholder="BCA, BNI, Mandiri..."
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Account Number</label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all font-mono"
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-text-muted font-bold mb-1.5">Holder Name</label>
              <input
                type="text"
                value={form.account_holder}
                onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                placeholder="Nama pemilik rekening"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className={`h-[38px] px-6 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${saving ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-base hover:bg-indigo-mid active:scale-95'}`}
            >
              {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Plus" size={14} strokeWidth={3} />}
              {saving ? 'Menyimpan...' : 'Add'}
            </button>
          </div>

          <div className="border border-border-base rounded-xl overflow-hidden">
            <div className="bg-bg-subtle px-4 py-2 border-b border-border-base">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Active Accounts</span>
            </div>
            <div className="divide-y divide-bg-subtle">
              {loading ? (
                <div className="py-8 text-center">
                  <Icon name="Loader2" size={20} className="animate-spin text-indigo-base mx-auto mb-2" />
                  <p className="text-text-muted text-xs font-medium">Memuat rekening bank...</p>
                </div>
              ) : banks.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 bg-indigo-soft rounded-full flex items-center justify-center mx-auto mb-2">
                    <Icon name="Landmark" size={18} className="text-indigo-base" />
                  </div>
                  <p className="text-text-muted text-xs font-medium">No accounts added yet.</p>
                </div>
              ) : (
                banks.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg-page/50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-indigo-soft border border-indigo-border/50 flex items-center justify-center flex-shrink-0">
                      <Icon name="Landmark" size={14} className="text-indigo-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-text-heading">{b.bank_name}</div>
                      <div className="font-mono text-[11px] text-indigo-base font-semibold">{b.account_number}</div>
                      <div className="text-[10px] text-text-muted">{b.account_holder}</div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(b.id)}
                      className="w-7 h-7 rounded-md border border-border-base bg-bg-surface hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-all text-text-muted opacity-0 group-hover:opacity-100"
                    >
                      <Icon name="Trash2" size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-bg-surface rounded-2xl shadow-lg border border-border-base p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-red-500" />
            </div>
            <h3 className="text-center font-display font-bold text-text-heading text-lg mb-2">Delete Account?</h3>
            <p className="text-center text-text-muted text-xs mb-6">Rekening ini akan dihapus dari daftar pembayaran.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-border-base text-text-body text-xs font-bold hover:bg-bg-subtle transition-all">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all active:scale-95">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankSettings;
