import React, { useState, useEffect } from 'react';
import api from '@/services/api';

const CustomerDetailModal = ({ phone, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/course/customers/${phone}`);
        if (res.data.status) {
          setData(res.data.data);
        }
      } catch (err) {
        alert('Gagal memuat detail: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };
    if (phone) fetchDetail();
  }, [phone]);

  if (!phone) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center py-6">
      <div className="bg-white rounded-2xl w-full max-w-[640px] shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="shrink-0 bg-gradient-to-b from-purple-50 to-white px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-[15px] shrink-0 border border-purple-200">
              <i className="fas fa-user-circle"></i>
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold text-slate-900 m-0">Detail Customer</h3>
              <p className="text-[12px] text-slate-500 m-0 font-medium">Informasi lengkap data registrasi</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-slate-500">
              <i className="fas fa-spinner fa-spin mr-2"></i> Memuat detail...
            </div>
          ) : data ? (
            <div className="space-y-6">
              
              {/* Data Pribadi */}
              <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i className="fas fa-address-card text-purple-500"></i> Data Pribadi
                </h4>
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Nama Lengkap</span><strong className="text-slate-800">{data.nama_lengkap || data.saved_name || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Nomor HP / WA</span><strong className="text-slate-800">{data.phone || data.no_hp || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Jenis Kelamin</span><strong className="text-slate-800">{data.jenis_kelamin || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Agama</span><strong className="text-slate-800">{data.agama || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Tempat, Tgl Lahir</span><strong className="text-slate-800">{data.tempat_lahir || '-'}, {data.tanggal_lahir || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Kebangsaan</span><strong className="text-slate-800">{data.kebangsaan || '-'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Alamat Lengkap</span><strong className="text-slate-800">{data.alamat || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Kota</span><strong className="text-slate-800">{data.kota || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Provinsi</span><strong className="text-slate-800">{data.propinsi || '-'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Email</span><strong className="text-slate-800">{data.email || '-'}</strong></div>
                </div>
              </section>

              {/* Data Pendidikan */}
              <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i className="fas fa-graduation-cap text-blue-500"></i> Pendidikan Terakhir
                </h4>
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Jenjang</span><strong className="text-slate-800">{data.pendidikan_jenjang || '-'}</strong></div>
                  <div><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Nama Sekolah / Univ</span><strong className="text-slate-800">{data.pendidikan_nama_sekolah || '-'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-0.5">Alamat Sekolah</span><strong className="text-slate-800">{data.pendidikan_alamat || '-'}</strong></div>
                </div>
              </section>

              {/* Data Orang Tua */}
              <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h4 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i className="fas fa-users text-green-500"></i> Data Orang Tua
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-[13px]">
                  <div>
                    <span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-2 font-bold border-b pb-1">Data Ayah</span>
                    <div className="space-y-2">
                      <div><span className="text-slate-500 block text-[10px]">Nama</span><strong className="text-slate-800">{data.ortu_nama_ayah || '-'}</strong></div>
                      <div><span className="text-slate-500 block text-[10px]">Pekerjaan</span><strong className="text-slate-800">{data.ortu_pekerjaan_ayah || '-'}</strong></div>
                      <div><span className="text-slate-500 block text-[10px]">No. HP</span><strong className="text-slate-800">{data.ortu_hp_ayah || '-'}</strong></div>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] uppercase tracking-wider mb-2 font-bold border-b pb-1">Data Ibu</span>
                    <div className="space-y-2">
                      <div><span className="text-slate-500 block text-[10px]">Nama</span><strong className="text-slate-800">{data.ortu_nama_ibu || '-'}</strong></div>
                      <div><span className="text-slate-500 block text-[10px]">Pekerjaan</span><strong className="text-slate-800">{data.ortu_pekerjaan_ibu || '-'}</strong></div>
                      <div><span className="text-slate-500 block text-[10px]">No. HP</span><strong className="text-slate-800">{data.ortu_hp_ibu || '-'}</strong></div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">Data tidak ditemukan</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;
