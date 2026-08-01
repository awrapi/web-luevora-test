import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const Offers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [adminOfferPrice, setAdminOfferPrice] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [allowRerequest, setAllowRerequest] = useState(false);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/offers');
      if (res.data.success) {
        setOffers(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch offers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    // Listen for SSE updates if applicable
    const handleNewOffer = () => { fetchOffers(); };
    window.addEventListener('sse_new_offer', handleNewOffer);
    return () => window.removeEventListener('sse_new_offer', handleNewOffer);
  }, []);

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin MENYETUJUI tawaran ini? Pelanggan akan diberitahu secara otomatis.')) return;
    try {
      setActionLoading(id);
      await api.post(`/offers/${id}/approve`);
      fetchOffers();
    } catch (error) {
      console.error('Failed to approve offer', error);
      alert('Gagal menyetujui tawaran');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (offer) => {
    setSelectedOffer(offer);
    setAdminOfferPrice('');
    setAdminNote('');
    setAllowRerequest(false);
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedOffer) return;
    try {
      setActionLoading(selectedOffer.id);
      await api.post(`/offers/${selectedOffer.id}/reject`, {
        admin_offer: adminOfferPrice || null,
        admin_note: adminNote.trim() || null,
        allow_rerequest: allowRerequest
      });
      setRejectModalOpen(false);
      fetchOffers();
    } catch (error) {
      console.error('Failed to reject offer', error);
      alert('Gagal menolak tawaran');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-text-heading tracking-tight mb-1 sm:mb-2">Penawaran Harga</h1>
          <p className="text-text-muted text-sm hidden sm:block">Kelola penawaran (bargain) dari pelanggan yang ditangkap oleh AI.</p>
        </div>
        <button 
          onClick={fetchOffers}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border-base rounded-xl text-sm font-bold text-text-body hover:bg-bg-subtle transition-all shadow-xs shrink-0"
        >
          <Icon name="RefreshCw" size={16} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border-base shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Memuat data penawaran...</div>
        ) : offers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-bg-subtle rounded-full flex items-center justify-center mb-3 sm:mb-4 text-text-muted">
              <Icon name="Inbox" size={28} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-text-heading mb-1">Belum Ada Penawaran</h3>
            <p className="text-text-muted text-sm">Jika AI mendeteksi pelanggan menawar harga, datanya akan muncul di sini.</p>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-subtle border-b border-border-base text-text-muted uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Paket/Produk</th>
                <th className="px-6 py-4">Harga Asli</th>
                <th className="px-6 py-4">Harga Tawaran</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {offers.map(offer => (
                <tr key={offer.id} className="hover:bg-bg-subtle/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-text-muted">
                    {new Date(offer.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-text-heading">{offer.customer_name || 'Tanpa Nama'}</div>
                    <div className="text-xs text-text-muted">{offer.phone}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-text-body">{offer.package_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-text-muted line-through">
                    {formatRupiah(offer.original_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-green-600">
                    {formatRupiah(offer.offered_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      offer.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                      offer.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                      'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {offer.status}
                    </span>
                    {offer.status === 'rejected' && (
                      <div className="text-[10px] text-text-muted mt-1 space-y-0.5">
                        {offer.admin_offer && <div>Counter: {formatRupiah(offer.admin_offer)}</div>}
                        {offer.admin_note && <div className="italic text-red-500">📝 {offer.admin_note.substring(0, 60)}{offer.admin_note.length > 60 ? '...' : ''}</div>}
                        {offer.allow_rerequest && <div className="text-blue-500">🔄 Re-request diizinkan</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {offer.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(offer.id)}
                          disabled={actionLoading === offer.id}
                          className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {actionLoading === offer.id ? '...' : 'Setujui'}
                        </button>
                        <button
                          onClick={() => openRejectModal(offer)}
                          disabled={actionLoading === offer.id}
                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-border-base">
            {offers.map(offer => (
              <div key={offer.id} className="p-4 hover:bg-bg-subtle/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    offer.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                    offer.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                    'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {offer.status}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {new Date(offer.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="font-bold text-text-heading text-sm">{offer.customer_name || 'Tanpa Nama'}</div>
                  <div className="text-[11px] text-text-muted">{offer.phone}</div>
                </div>
                <div className="text-xs text-text-body font-medium mb-3 bg-bg-subtle rounded-lg px-3 py-2">{offer.package_name}</div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Harga Asli</div>
                    <div className="text-sm text-text-muted line-through">{formatRupiah(offer.original_price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-green-600 uppercase tracking-wider font-bold">Tawaran</div>
                    <div className="text-sm font-bold text-green-600">{formatRupiah(offer.offered_price)}</div>
                  </div>
                </div>
                {offer.status === 'rejected' && (
                  <div className="text-[11px] text-text-muted mb-3 space-y-0.5 bg-red-50 rounded-lg p-3">
                    {offer.admin_offer && <div>Counter: {formatRupiah(offer.admin_offer)}</div>}
                    {offer.admin_note && <div className="italic text-red-500">{offer.admin_note.substring(0, 80)}{offer.admin_note.length > 80 ? '...' : ''}</div>}
                    {offer.allow_rerequest && <div className="text-blue-500">Re-request diizinkan</div>}
                  </div>
                )}
                {offer.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(offer.id)}
                      disabled={actionLoading === offer.id}
                      className="flex-1 px-3 py-2.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                    >
                      {actionLoading === offer.id ? '...' : 'Setujui'}
                    </button>
                    <button
                      onClick={() => openRejectModal(offer)}
                      disabled={actionLoading === offer.id}
                      className="flex-1 px-3 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-xl border border-border-base overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-border-base flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base sm:text-lg text-text-heading">Tolak Penawaran</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-text-muted hover:text-text-heading">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <p className="text-sm text-text-muted">
                Anda akan menolak tawaran <strong>{formatRupiah(selectedOffer?.offered_price)}</strong> untuk <strong>{selectedOffer?.package_name}</strong>.
              </p>
              <div>
                <label className="block text-xs font-bold text-text-heading uppercase tracking-wider mb-2">
                  Harga Counter-Offer (Opsional)
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 1400000"
                  value={adminOfferPrice}
                  onChange={(e) => setAdminOfferPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-border-base rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-base/20 focus:border-indigo-base transition-all"
                />
                <p className="text-xs text-text-muted mt-2">
                  Kosongkan jika Anda ingin menolak tawaran secara penuh (kembali ke harga asli). Jika diisi, pelanggan masih bisa menawar.
                </p>
              </div>

              {/* Admin Context / Alasan Penolakan */}
              <div>
                <label className="block text-xs font-bold text-text-heading uppercase tracking-wider mb-2">
                  Konteks / Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  autoFocus
                  placeholder="Contoh: Harga ini sudah harga mati dari vendor, tidak bisa turun. Atau: Bisa turun tapi minimal 10 pax."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-border-base rounded-xl text-sm text-text-heading placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                />
                <p className="text-xs text-text-muted mt-1.5">
                  Konteks ini akan dibaca oleh AI. AI akan menggunakannya untuk mempertahankan posisi saat customer memaksa menawar ulang.
                </p>
              </div>

              {/* Allow Re-request Toggle */}
              <div className="bg-bg-subtle rounded-xl p-4 border border-border-base">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={allowRerequest}
                      onChange={(e) => setAllowRerequest(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-heading">Izinkan AI kirim request ulang</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {allowRerequest
                        ? '✅ AI BOLEH mengirim ulang penawaran jika customer memaksa dengan alasan baru.'
                        : '🚫 AI akan TEGAS menolak jika customer memaksa menawar ulang (kecuali ada kondisi khusus di konteks).'}
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 bg-bg-subtle border-t border-border-base flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-heading"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === selectedOffer?.id || !adminNote.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedOffer?.id ? 'Memproses...' : 'Tolak Penawaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Offers;
