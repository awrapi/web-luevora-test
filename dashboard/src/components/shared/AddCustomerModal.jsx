import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const initialForm = {
  personal: {
    name: '',
    nickname: '',
    phone: '',
    gender: '',
    religion: '',
    birth_place: '',
    birth_date: '',
    email: '',
    address: '',
  },
  education: {
    level: '',
    school_name: '',
    school_address: '',
  },
  parents: {
    father_name: '',
    father_phone: '',
    father_job: '',
    father_email: '',
    mother_name: '',
    mother_phone: '',
    mother_job: '',
    mother_email: '',
  },
  notes: '',
};

const AddCustomerModal = ({ open, onClose, onSuccess }) => {
  const [form, setForm] = useState(initialForm);
  const [labels, setLabels] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    return form.personal.name.trim() && form.personal.phone.trim();
  }, [form.personal.name, form.personal.phone]);

  useEffect(() => {
    if (!open) return;
    const fetchLabels = async () => {
      setLoadingLabels(true);
      try {
        const res = await api.get('/customers/labels');
        if (res.data.status) {
          setLabels(res.data.data || []);
        }
      } catch (err) {
        console.error('Gagal memuat labels:', err.message);
      } finally {
        setLoadingLabels(false);
      }
    };
    fetchLabels();
  }, [open]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setForm(initialForm);
        setSelectedLabels([]);
        setError('');
        setSubmitting(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const updateSection = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const toggleLabel = (labelId) => {
    setSelectedLabels((prev) => (prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!canSubmit) {
      setError('Nama dan nomor WhatsApp wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        personal: form.personal,
        education: form.education,
        parents: form.parents,
        notes: form.notes,
        label_ids: selectedLabels,
      };
      const res = await api.post('/customers', payload);
      if (res.data.status) {
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.data.message || 'Gagal menambahkan customer.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-bg-surface border border-border-base shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border-base flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-text-heading">Tambah Customer Manual</h3>
            <p className="text-xs text-text-muted">Lengkapi data customer sesuai kebutuhan operasional.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-subtle transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(90vh-68px)] overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && <div className="px-4 py-2 text-xs font-bold bg-red-50 border border-red-200 text-red-600">{error}</div>}

            <section className="space-y-3">
              <h4 className="text-xs font-black tracking-wide text-indigo-base">DATA PRIBADI</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nama Lengkap*"
                  value={form.personal.name}
                  onChange={(e) => updateSection('personal', 'name', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nama Panggilan"
                  value={form.personal.nickname}
                  onChange={(e) => updateSection('personal', 'nickname', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nomor WhatsApp*"
                  value={form.personal.phone}
                  onChange={(e) => updateSection('personal', 'phone', e.target.value)}
                />
                <select className="px-3 py-2 border border-border-base text-sm bg-white" value={form.personal.gender} onChange={(e) => updateSection('personal', 'gender', e.target.value)}>
                  <option value="">Pilih Gender</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Agama"
                  value={form.personal.religion}
                  onChange={(e) => updateSection('personal', 'religion', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Tempat Lahir"
                  value={form.personal.birth_place}
                  onChange={(e) => updateSection('personal', 'birth_place', e.target.value)}
                />
                <input type="date" className="px-3 py-2 border border-border-base text-sm" value={form.personal.birth_date} onChange={(e) => updateSection('personal', 'birth_date', e.target.value)} />
                <input className="px-3 py-2 border border-border-base text-sm" placeholder="Email" value={form.personal.email} onChange={(e) => updateSection('personal', 'email', e.target.value)} />
                <textarea
                  className="md:col-span-2 px-3 py-2 border border-border-base text-sm min-h-19.5"
                  placeholder="Alamat Lengkap"
                  value={form.personal.address}
                  onChange={(e) => updateSection('personal', 'address', e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-black tracking-wide text-indigo-base">PENDIDIKAN</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Jenjang Pendidikan"
                  value={form.education.level}
                  onChange={(e) => updateSection('education', 'level', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nama Sekolah / Kampus"
                  value={form.education.school_name}
                  onChange={(e) => updateSection('education', 'school_name', e.target.value)}
                />
                <textarea
                  className="md:col-span-2 px-3 py-2 border border-border-base text-sm min-h-17"
                  placeholder="Alamat Sekolah"
                  value={form.education.school_address}
                  onChange={(e) => updateSection('education', 'school_address', e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-black tracking-wide text-indigo-base">DATA ORANG TUA</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nama Ayah"
                  value={form.parents.father_name}
                  onChange={(e) => updateSection('parents', 'father_name', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="No HP Ayah"
                  value={form.parents.father_phone}
                  onChange={(e) => updateSection('parents', 'father_phone', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Pekerjaan Ayah"
                  value={form.parents.father_job}
                  onChange={(e) => updateSection('parents', 'father_job', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Email Ayah"
                  value={form.parents.father_email}
                  onChange={(e) => updateSection('parents', 'father_email', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Nama Ibu"
                  value={form.parents.mother_name}
                  onChange={(e) => updateSection('parents', 'mother_name', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="No HP Ibu"
                  value={form.parents.mother_phone}
                  onChange={(e) => updateSection('parents', 'mother_phone', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Pekerjaan Ibu"
                  value={form.parents.mother_job}
                  onChange={(e) => updateSection('parents', 'mother_job', e.target.value)}
                />
                <input
                  className="px-3 py-2 border border-border-base text-sm"
                  placeholder="Email Ibu"
                  value={form.parents.mother_email}
                  onChange={(e) => updateSection('parents', 'mother_email', e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-black tracking-wide text-indigo-base">LES / LAYANAN YANG DIAMBIL</h4>
              <div className="p-3 border border-border-base bg-bg-subtle min-h-18">
                {loadingLabels ? (
                  <div className="text-xs text-text-muted">Memuat layanan...</div>
                ) : labels.length === 0 ? (
                  <div className="text-xs text-text-muted">Belum ada label layanan.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => {
                      const active = selectedLabels.includes(label.id);
                      return (
                        <button
                          type="button"
                          key={label.id}
                          onClick={() => toggleLabel(label.id)}
                          className={`px-3 py-1.5 text-xs font-bold border transition-all ${
                            active ? 'bg-indigo-base text-white border-indigo-base' : 'bg-white text-text-body border-border-base hover:border-indigo-base'
                          }`}>
                          {label.label_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-black tracking-wide text-indigo-base">CATATAN TAMBAHAN</h4>
              <textarea
                className="w-full px-3 py-2 border border-border-base text-sm min-h-22.5"
                placeholder="Catatan internal admin..."
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </section>
          </div>

          <div className="px-6 py-4 border-t border-border-base bg-bg-subtle flex justify-end gap-2 sticky bottom-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border-base bg-white text-xs font-bold">
              Batal
            </button>
            <button type="submit" disabled={!canSubmit || submitting} className="px-4 py-2 bg-indigo-base text-white text-xs font-bold disabled:opacity-50">
              {submitting ? 'Menyimpan...' : 'Simpan Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomerModal;
