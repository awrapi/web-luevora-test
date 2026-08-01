import { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import Icon from '@/components/shared/Icon';

const TERMS = {
  course: {
    title: 'Daftar Kursus',
    button: 'Tambah Kursus',
    tableHeader: 'Nama Kelas',
  },
  rent: {
    title: 'Daftar Kendaraan',
    button: 'Tambah Kendaraan',
    tableHeader: 'Unit',
  },
  travel: {
    title: 'Daftar Paket',
    button: 'Tambah Paket',
    tableHeader: 'Nama Paket',
  },
  default: {
    title: 'Daftar Produk',
    button: 'Tambah Produk',
    tableHeader: 'Nama Produk',
  },
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const emptyForm = { name: '', description: '', price: '' };

const Products = () => {
  const { businessType } = useAuth();
  const terms = useMemo(() => TERMS[businessType] || TERMS.default, [businessType]);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      if (res.data.status) {
        setProducts(res.data.data || []);
      }
    } catch (err) {
      console.error('Gagal memuat produk:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openCreate = () => {
    if (showForm && !editing) {
      closeForm();
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (product) => {
    if (showForm && editing?.id === product.id) {
      closeForm();
      return;
    }
    setEditing(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
    });
    setError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError('Harga tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, {
          name: form.name,
          description: form.description,
          price: Number(form.price),
        });
      } else {
        await api.post('/products', {
          name: form.name,
          description: form.description,
          price: Number(form.price),
        });
      }

      closeForm();
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (product) => {
    const ok = window.confirm(`Hapus ${terms.tableHeader.toLowerCase()} "${product.name}"?`);
    if (!ok) return;
    try {
      await api.delete(`/products/${product.id}`);
      await fetchProducts();
    } catch (err) {
      console.error('Gagal menghapus produk:', err.message);
    }
  };

  return (
    <div className="p-6 max-w-400 mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-heading mb-1">{terms.title}</h2>
          <p className="text-sm text-text-muted">Kelola item penawaran untuk tenant Anda.</p>
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 font-bold py-2.5 px-5 rounded-xl text-xs transition-all active:scale-95 border ${
            showForm && !editing ? 'bg-indigo-soft text-indigo-base border-indigo-border hover:bg-indigo-soft/80' : 'bg-indigo-base hover:bg-indigo-mid text-white border-indigo-base shadow-md'
          }`}>
          <Icon name="Plus" size={15} strokeWidth={3} />
          {showForm && !editing ? 'Tutup Form' : terms.button}
        </button>
      </div>

      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-xs overflow-hidden">
        {showForm && (
          <div className="border-b border-border-base bg-bg-page/50">
            <div className="px-5 py-4 border-b border-bg-subtle">
              <h6 className="font-display font-bold text-sm text-text-heading flex items-center gap-2">
                <Icon name={editing ? 'Pencil' : 'Plus'} size={14} className="text-indigo-base" strokeWidth={2.5} />
                {editing ? `Edit ${terms.tableHeader}` : terms.button}
              </h6>
            </div>
            <form onSubmit={onSubmit} className="p-5 space-y-4">
              {error && <div className="px-3 py-2 text-xs font-bold bg-red-50 border border-red-200 text-red-600">{error}</div>}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">{terms.tableHeader}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                  placeholder={`Masukkan ${terms.tableHeader.toLowerCase()}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all min-h-22.5"
                  placeholder="Deskripsi (opsional)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Harga</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs border border-border-base rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-base/30 focus:border-indigo-base transition-all"
                  placeholder="0"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeForm} className="px-5 py-2.5 rounded-xl border border-border-base text-text-body text-xs font-bold hover:bg-bg-subtle transition-all">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                    submitting ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-base hover:bg-indigo-mid active:scale-95'
                  }`}>
                  {submitting ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Check" size={14} strokeWidth={3} />}
                  {submitting ? 'Menyimpan...' : editing ? `Update ${terms.tableHeader}` : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle/70 border-b border-bg-subtle">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-text-muted uppercase text-xs">{terms.tableHeader}</th>
                <th className="text-left px-4 py-3 font-bold text-text-muted uppercase text-xs">Deskripsi</th>
                <th className="text-left px-4 py-3 font-bold text-text-muted uppercase text-xs">Harga</th>
                <th className="text-left px-4 py-3 font-bold text-text-muted uppercase text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-base"></div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-text-muted">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b border-bg-subtle hover:bg-bg-page/50 transition-colors group">
                    <td className="px-4 py-3 font-bold text-text-heading">{product.name}</td>
                    <td className="px-4 py-3 text-text-body text-xs">{product.description || '-'}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(product)}
                          className="w-8 h-8 rounded-lg border border-border-base bg-bg-surface hover:bg-indigo-soft hover:border-indigo-border hover:text-indigo-base flex items-center justify-center transition-all text-text-muted"
                          title="Edit">
                          <Icon name="Pencil" size={13} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="w-8 h-8 rounded-lg border border-border-base bg-bg-surface hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-all text-text-muted"
                          title="Hapus">
                          <Icon name="Trash2" size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && products.length > 0 && <div className="px-5 py-3 border-t border-bg-subtle bg-bg-page/50 text-[11px] text-text-muted font-medium">{products.length} item aktif</div>}
      </div>
    </div>
  );
};

export default Products;
