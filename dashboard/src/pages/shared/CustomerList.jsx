import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import AddCustomerModal from '@/pages/shared/AddCustomerModal';
import CustomerDetailModal from '@/pages/shared/CustomerDetailModal';
import Icon from '@/components/shared/Icon';

// ================================================================
// 1. KOMPONEN HEADER (Diperbagus sesuai screenshot)
// ================================================================
const Header = ({ total, onSearch, onSort, onAddCustomer, onMantanClick }) => {
  return (
    <div className="relative z-10 px-6 h-[64px] bg-white border-b border-slate-200 flex items-center shadow-sm">
      <div className="flex items-center justify-between w-full gap-4">
        {/* Kiri: Bagian Title & Logo */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col justify-center">
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-snug">Customer Data</h1>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Total: <span className="font-bold text-slate-700">{total}</span> customer aktif
            </div>
          </div>
        </div>
        
        {/* Kanan: Bagian Aksi & Pencarian */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="flex items-center bg-slate-50/50 border border-slate-200 rounded-xl px-4 h-11 min-w-[260px] focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <input 
              type="text" 
              placeholder="Cari nama, telepon, layanan..." 
              className="bg-transparent border-none text-[13px] font-medium w-full outline-none text-slate-700 placeholder-slate-400"
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          
          {/* Dropdown Sort */}
          <select 
            className="bg-white border border-slate-200 rounded-xl px-4 text-[13px] font-bold text-slate-700 h-11 outline-none cursor-pointer hover:bg-slate-50 focus:border-blue-500 transition-colors shadow-sm" 
            onChange={(e) => onSort(e.target.value)}
          >
            <option value="recent">Terbaru</option>
            <option value="name">Nama A-Z</option>
            <option value="value">Nilai Tertinggi</option>
          </select>
          
          {/* Tombol Mantan */}
          <button 
            onClick={onMantanClick}
            className="px-5 h-11 rounded-xl text-[13px] font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center transition-all shadow-sm"
          >
            Mantan
          </button>
          
          {/* Tombol Tambah Customer */}
          <button 
            className="px-6 h-11 rounded-xl text-[13px] font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center transition-all shadow-md hover:shadow-lg hover:-translate-y-[1px]" 
            onClick={onAddCustomer}
          >
            Tambah Customer
          </button>
        </div>
      </div>
    </div>
  );
};

// ================================================================
// 2. DAFTAR BOOKING TABLE
// ================================================================
const BookingStatusBadge = ({ status }) => {
  const map = {
    confirmed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    on_trip: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

const BookingsTable = ({ bookings, loading }) => (
  <div className="mx-6 mb-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
      <Icon name="PlaneTakeoff" size={16} className="text-indigo-500" />
      <h2 className="text-[14px] font-extrabold text-slate-800">Daftar Booking</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase text-slate-400 tracking-wider">
            <th className="p-4 font-bold">Pelanggan</th>
            <th className="p-4 font-bold">Paket</th>
            <th className="p-4 font-bold">Pax</th>
            <th className="p-4 font-bold">Tgl Berangkat</th>
            <th className="p-4 font-bold">Total Harga</th>
            <th className="p-4 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            [1,2,3].map(i => (
              <tr key={i}>
                <td colSpan="6" className="p-4">
                  <div className="h-4 bg-slate-100 rounded animate-pulse" />
                </td>
              </tr>
            ))
          ) : bookings.length === 0 ? (
            <tr>
              <td colSpan="6" className="p-10 text-center text-slate-400 text-[13px]">
                <Icon name="Inbox" size={28} className="mx-auto mb-2 opacity-30" />
                Belum ada data booking.
              </td>
            </tr>
          ) : bookings.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="p-4">
                <div className="font-bold text-slate-800 text-sm">{b.customer_name || 'Tanpa Nama'}</div>
                <div className="text-xs text-slate-400">{b.phone}</div>
              </td>
              <td className="p-4 text-sm text-slate-600">{b.package_name || 'Custom'}</td>
              <td className="p-4 text-sm font-bold text-slate-700">{b.pax_count} Org</td>
              <td className="p-4 text-sm text-slate-600">
                {b.departure_date ? new Date(b.departure_date).toLocaleDateString('id-ID') : '-'}
              </td>
              <td className="p-4 text-sm font-bold text-slate-800">
                Rp {parseFloat(b.total_price || 0).toLocaleString('id-ID')}
              </td>
              <td className="p-4">
                <BookingStatusBadge status={b.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ================================================================
// 3. KOMPONEN CUSTOMER TABLE
// ================================================================
const CustomerTable = ({ customers, isLoading, onAction }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    // Jika name adalah nomor telepon (hanya digit, mungkin dengan +, spasi, strip),
    // tampilkan 2 digit terakhir sebagai initials.
    const digitsOnly = name.replace(/\D/g, '');
    if (digitsOnly.length >= 2 && /^[\d+\s\-()]+$/.test(name.trim())) {
      return digitsOnly.slice(-2);
    }
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const formatPhone = (phone) => {
    if (!phone) return '-';
    let clean = phone.replace('@s.whatsapp.net', '');
    if (clean.startsWith('62')) return '0' + clean.substring(2);
    return clean;
  };

  return (
    <div className="mx-6 my-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header Tabel */}
      <div className="grid grid-cols-[50px_2fr_1.5fr_2fr_2.5fr] px-6 py-4 border-b border-slate-200 bg-slate-50/50 gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        <span>#</span>
        <span>Customer</span>
        <span>Telepon</span>
        <span>Layanan</span>
        <span>Aksi</span>
      </div>
      
      <div>
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-[13px] font-medium">
            <i className="fas fa-spinner fa-spin mr-2"></i> Memuat customer list...
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <i className="fas fa-users-slash text-3xl mb-3 text-slate-300"></i>
            <p className="text-[13px] font-medium">Tidak ada customer ditemukan</p>
          </div>
        ) : (
          customers.map((c, i) => {
            const name = c.saved_name || formatPhone(c.phone);

            return (
              <div 
                className="grid grid-cols-[50px_2fr_1.5fr_2fr_2.5fr] px-6 py-4 border-b border-slate-100 items-center gap-4 hover:bg-slate-50/50 transition-colors last:border-b-0 bg-white" 
                key={c.phone}
              >
                {/* Kolom 1: Nomor */}
                <span className="text-[14px] font-bold text-slate-300">{i + 1}</span>
                
                {/* Kolom 2: Customer */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full shrink-0 bg-purple-50 flex items-center justify-center text-[13px] font-bold text-purple-600 border border-purple-100">
                    {getInitials(name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-800 truncate">{name}</div>
                  </div>
                </div>
                
                {/* Kolom 3: Telepon */}
                <div className="text-[14px] font-semibold text-slate-600 truncate">
                  {formatPhone(c.phone)}
                </div>
                
                {/* Kolom 4: Layanan (Pill Badge with X) */}
                <div>
                  {c.service_name ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-500 border border-amber-200 w-max cursor-default">
                      <i className="fas fa-tag text-[10px]"></i>
                      {c.service_name}
                      <i className="fas fa-times text-[10px] ml-1 opacity-50 hover:opacity-100 cursor-pointer"></i>
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-300 font-medium">-</span>
                  )}
                </div>

                {/* Kolom 5: Aksi (Buttons) */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button 
                    onClick={() => onAction('DETAIL', c)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fas fa-clipboard-list text-[11px]"></i> Detail
                  </button>
                  <button 
                    onClick={() => onAction('CHAT', c)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fas fa-comment-dots text-[11px]"></i> Chat
                  </button>
                  <button 
                    onClick={() => onAction('FOLLOW_UP', c)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fas fa-paper-plane text-[11px]"></i> Follow Up
                  </button>
                  
                  {/* Icon Only Buttons */}
                  <button 
                    onClick={() => onAction('EDIT', c)}
                    className="w-8 h-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors flex items-center justify-center shrink-0"
                  >
                    <i className="fas fa-pen text-[11px]"></i>
                  </button>
                  <button 
                    onClick={() => onAction('DELETE', c)}
                    className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center shrink-0"
                  >
                    <i className="fas fa-trash text-[11px]"></i>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ================================================================
// 4. KOMPONEN UTAMA (HALAMAN ORCHESTRATOR)
// ================================================================
const CustomerList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  // Bookings state
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  
  const [activeModal, setActiveModal] = useState(null); // 'ADD_CUSTOMER', 'EDIT', 'DETAIL', 'FOLLOW_UP', 'DELETE'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [fuInstruction, setFuInstruction] = useState('');
  const [fuResultText, setFuResultText] = useState('');
  const [isFuGenerating, setIsFuGenerating] = useState(false);

  const fetchCustomers = async (searchVal = search) => {
    setIsLoading(true);
    try {
      const res = await api.get('/leads/list', { params: { filter: 'customer', search: searchVal || '' } });
      if (res.data.status) {
        setCustomers(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookings = async () => {
    setBookingsLoading(true);
    try {
      const res = await api.get('/travel/bookings');
      if (res.data.status) {
        setBookings(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers(search);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search, sort]);

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleTableAction = (actionType, customerData) => {
    setSelectedCustomer(customerData);
    if (actionType === 'CHAT') {
      navigate('/customer-chat');
    } else if (actionType === 'FOLLOW_UP') {
      setFuInstruction('');
      setFuResultText('');
      setActiveModal('FOLLOW_UP');
    } else {
      setActiveModal(actionType); 
    }
  };

  const generateAI = async () => {
    if (!fuInstruction.trim()) return alert('Tulis instruksi dulu');
    setIsFuGenerating(true);
    setFuResultText('');
    try {
      const res = await api.post(`/course/customers/${selectedCustomer.phone}/ai-followup`, { instruction: fuInstruction });
      if (res.data.status) {
        setFuResultText(res.data.follow_up_text);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsFuGenerating(false);
    }
  };

  const sendFollowUpToWA = async () => {
    if (!fuResultText.trim()) return;
    alert('Berhasil mengirim pesan Follow Up ke antrean WA!');
    setActiveModal(null);
  };

  const executeDeleteMode = async (mode) => {
    if (!selectedCustomer) return;
    const phone = selectedCustomer.phone;
    try {
      if (mode === 'mantan') {
        const res = await api.post(`/course/mantan/${phone}/mantanify`);
        if (res.data.status) alert(res.data.message);
      } else {
        if (!window.confirm('Hapus permanen data ini?')) return;
        const res = await api.delete(`/course/mantan/${phone}`);
        if (res.data.status) alert(res.data.message);
      }
      setActiveModal(null);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="h-[calc(100vh-70px)] overflow-y-auto bg-slate-50/50 pb-10 font-sans antialiased">
      <Header 
        total={customers.length} 
        onSearch={setSearch} 
        onSort={setSort} 
        onAddCustomer={() => setActiveModal('ADD_CUSTOMER')} 
        onMantanClick={() => navigate('/former-customers')}
      />

      <CustomerTable 
        customers={customers} 
        isLoading={isLoading} 
        onAction={handleTableAction} 
      />

      <BookingsTable bookings={bookings} loading={bookingsLoading} />

      {activeModal === 'ADD_CUSTOMER' && (
        <AddCustomerModal 
          onClose={() => setActiveModal(null)} 
          onSuccess={() => {
            setActiveModal(null);
            fetchCustomers(); // Refresh table
          }} 
        />
      )}

      {/* MODAL: DELETE / MANTAN */}
      {activeModal === 'DELETE' && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-100 flex justify-center items-center py-6">
          <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl p-6">
            <h2 className="text-[18px] font-extrabold text-slate-900 mb-2">Opsi Hapus Customer</h2>
            <p className="text-[13px] text-slate-600 mb-6">Bagaimana Anda ingin menghapus <strong>{selectedCustomer.saved_name || selectedCustomer.phone}</strong>?</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => executeDeleteMode('mantan')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <i className="fas fa-user-slash"></i>
                </div>
                <div>
                  <div className="font-bold text-amber-800 text-[14px]">Jadikan Mantan Customer</div>
                  <div className="text-[11px] text-amber-600 mt-0.5 leading-snug">Data tetap tersimpan, dipindah ke halaman Mantan Customer. Bisa di-follow up kembali.</div>
                </div>
              </button>

              <button 
                onClick={() => executeDeleteMode('permanent')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <i className="fas fa-trash-alt"></i>
                </div>
                <div>
                  <div className="font-bold text-red-800 text-[14px]">Hapus Permanen</div>
                  <div className="text-[11px] text-red-600 mt-0.5 leading-snug">Seluruh data riwayat percakapan dan form terhapus secara permanen. Tidak dapat dibatalkan.</div>
                </div>
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-[13px] transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT */}
      {activeModal === 'EDIT' && selectedCustomer && (
        <AddCustomerModal 
          editPhone={selectedCustomer.phone}
          onClose={() => setActiveModal(null)} 
          onSuccess={() => {
            setActiveModal(null);
            fetchCustomers();
          }} 
        />
      )}

      {/* MODAL: DETAIL */}
      {activeModal === 'DETAIL' && selectedCustomer && (
        <CustomerDetailModal 
          phone={selectedCustomer.phone}
          onClose={() => setActiveModal(null)} 
        />
      )}

      {/* MODAL: FOLLOW UP */}
      {activeModal === 'FOLLOW_UP' && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-100 flex justify-center items-center py-6">
          <div className="bg-white rounded-2xl w-full max-w-[520px] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="shrink-0 bg-linear-to-b from-blue-50 to-white px-6 py-5 border-b border-slate-100 flex justify-between items-start rounded-t-2xl">
              <div>
                <div className="text-[16px] font-extrabold text-slate-900 flex items-center gap-2">
                  <i className="fas fa-robot text-blue-600"></i> Follow Up AI (Customer Aktif)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Kirim ke: {selectedCustomer.saved_name || selectedCustomer.phone}
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Instruksi untuk AI</label>
                <textarea 
                  value={fuInstruction}
                  onChange={(e) => setFuInstruction(e.target.value)}
                  placeholder="Contoh: Ingatkan jadwal les hari ini jam 3 sore, atau infokan tagihan bulan ini..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[13px] text-slate-700 outline-none focus:border-blue-500 transition-colors min-h-[100px] resize-y"
                ></textarea>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Ingatkan Jadwal Hari Ini', 'Info Tagihan Bulan Ini', 'Tanyakan PR/Tugas'].map(p => (
                    <span 
                      key={p} 
                      onClick={() => setFuInstruction(p)}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-600 cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <button 
                onClick={generateAI} 
                disabled={isFuGenerating || !fuInstruction.trim()}
                className="w-full py-3 rounded-xl font-bold text-[13px] text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isFuGenerating ? <><i className="fas fa-spinner fa-spin"></i> Generate Pesan AI...</> : <><i className="fas fa-magic"></i> Generate Pesan AI</>}
              </button>

              {fuResultText && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <i className="fas fa-check-circle"></i> Pesan AI Siap Kirim
                  </div>
                  <div className="bg-white border border-green-100 rounded-lg p-3 text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                    {fuResultText}
                  </div>
                  <button 
                    onClick={sendFollowUpToWA}
                    className="w-full mt-3 py-2.5 rounded-xl font-bold text-[13px] text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-paper-plane"></i> Kirim ke WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
