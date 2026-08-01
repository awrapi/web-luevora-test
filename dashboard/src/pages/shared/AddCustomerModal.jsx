import React, { useState, useEffect } from 'react';
import api from '@/services/api';

const AddCustomerModal = ({ onClose, onSuccess, editPhone = null }) => {
  const [formData, setFormData] = useState({
    // Pribadi
    nama_lengkap: '', phone: '', jenis_kelamin: '', agama: '',
    tempat_lahir: '', tanggal_lahir: '', kebangsaan: 'Indonesia',
    email: '', alamat: '', kota: '', propinsi: '',
    nomer_telepon: '', link_sosmed: '',
    // Pendidikan
    jenjang: '', sekolah: '', pend_alamat: '', pend_kota: '', pend_telepon: '',
    // Ortu
    ortu_nama_ayah: '', ortu_hp_ayah: '', ortu_pekerjaan_ayah: '', ortu_email_ayah: '',
    ortu_nama_ibu: '', ortu_hp_ibu: '', ortu_pekerjaan_ibu: '', ortu_email_ibu: '',
    // Lainnya
    catatan: '',
    label_ids: []
  });

  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState([]); 
  const [customLabel, setCustomLabel] = useState('');
  const [newLabels, setNewLabels] = useState([]);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await api.get('/course/services');
        if (res.data.status) {
          setLabels(res.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching service labels:', error);
      }
    };
    const fetchCustomer = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/course/customers/${editPhone}`);
        if (res.data.status && res.data.data) {
          const d = res.data.data;
          setFormData({
            nama_lengkap: d.saved_name || d.nama_lengkap || '',
            phone: d.phone || d.no_hp || '',
            jenis_kelamin: d.jenis_kelamin || '',
            agama: d.agama || '',
            tempat_lahir: d.tempat_lahir || '',
            tanggal_lahir: d.tanggal_lahir || '',
            kebangsaan: d.kebangsaan || 'Indonesia',
            email: d.email || '',
            alamat: d.alamat || '',
            kota: d.kota || '',
            propinsi: d.propinsi || '',
            nomer_telepon: d.nomer_telepon || '',
            link_sosmed: d.link_sosmed || '',
            jenjang: d.pendidikan_jenjang || '',
            sekolah: d.pendidikan_nama_sekolah || '',
            pend_alamat: d.pendidikan_alamat || '',
            pend_kota: d.pendidikan_kota || '',
            pend_telepon: d.pendidikan_telepon || '',
            ortu_nama_ayah: d.ortu_nama_ayah || '',
            ortu_hp_ayah: d.ortu_hp_ayah || '',
            ortu_pekerjaan_ayah: d.ortu_pekerjaan_ayah || '',
            ortu_email_ayah: d.ortu_email_ayah || '',
            ortu_nama_ibu: d.ortu_nama_ibu || '',
            ortu_hp_ibu: d.ortu_hp_ibu || '',
            ortu_pekerjaan_ibu: d.ortu_pekerjaan_ibu || '',
            ortu_email_ibu: d.ortu_email_ibu || '',
            catatan: d.catatan || '',
            label_ids: d.label_ids || []
          });
        }
      } catch (e) {
        console.error(e);
        alert('Gagal mengambil data customer');
      } finally {
        setLoading(false);
      }
    };

    fetchLabels();
    if (editPhone) fetchCustomer();
  }, [editPhone]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLabelToggle = (id) => {
    setFormData(prev => {
      const current = prev.label_ids;
      if (current.includes(id)) {
        return { ...prev, label_ids: current.filter(l => l !== id) };
      } else {
        return { ...prev, label_ids: [...current, id] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.nama_lengkap) return alert('Nama Lengkap wajib diisi');
    if (!formData.phone) return alert('Nomor HP wajib diisi');

    setLoading(true);
    try {
      const payload = {
        ...formData,
        new_labels: newLabels
      };
      
      let res;
      if (editPhone) {
        res = await api.put(`/course/customers/${editPhone}`, payload);
      } else {
        res = await api.post('/course/customers/add', payload);
      }
      
      if (res.data.status) {
        onSuccess();
      } else {
        alert(res.data.message || 'Gagal menyimpan customer');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomLabel = () => {
    const val = customLabel.trim();
    if (!val) return;
    
    // Check if it already exists in mock labels
    if (labels.some(l => l.label_name.toLowerCase() === val.toLowerCase())) {
      setCustomLabel('');
      return;
    }
    if (newLabels.some(l => l.toLowerCase() === val.toLowerCase())) {
      setCustomLabel('');
      return;
    }

    setNewLabels(prev => [...prev, val]);
    setCustomLabel('');
  };

  const handleCustomLabelToggle = (labelStr) => {
    setNewLabels(prev => prev.filter(l => l !== labelStr));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center py-6">
      <div className="bg-white rounded-2xl w-full max-w-[640px] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header - Fixed */}
        <div className="shrink-0 bg-gradient-to-b from-blue-50 to-white px-6 py-5 border-b border-slate-100 rounded-t-2xl z-10 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-lg shadow-sm">
              <i className="fas fa-user-plus"></i>
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold text-slate-900 m-0">{editPhone ? 'Edit Customer' : 'Tambah Customer Manual'}</h3>
              <p className="text-[12px] text-slate-500 m-0 font-medium">{editPhone ? 'Ubah kelengkapan data customer' : 'Isi data customer baru secara lengkap'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 flex flex-col gap-8 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* SEKSI 1: Pribadi */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-4">
              <i className="fas fa-user"></i> Data Pribadi
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
                <input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleChange} placeholder="Contoh: Khaira" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Nomor HP / WA <span className="text-red-500">*</span></label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Contoh: 08123456789" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Jenis Kelamin</label>
                <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors bg-white">
                  <option value="">— Pilih —</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Agama</label>
                <input type="text" name="agama" value={formData.agama} onChange={handleChange} placeholder="Contoh: Islam" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Tempat Lahir</label>
                <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleChange} placeholder="Contoh: Jakarta" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Tanggal Lahir</label>
                <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Kebangsaan</label>
                <input type="text" name="kebangsaan" value={formData.kebangsaan} onChange={handleChange} placeholder="Contoh: Indonesia" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Contoh: nama@email.com" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Alamat</label>
              <input type="text" name="alamat" value={formData.alamat} onChange={handleChange} placeholder="Contoh: Jl. Pahlawan No.12" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Kota</label>
                <input type="text" name="kota" value={formData.kota} onChange={handleChange} placeholder="Contoh: Bogor Kabupaten" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Propinsi</label>
                <input type="text" name="propinsi" value={formData.propinsi} onChange={handleChange} placeholder="Contoh: Jawa Barat" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Telepon Rumah/Lainnya</label>
                <input type="tel" name="nomer_telepon" value={formData.nomer_telepon} onChange={handleChange} placeholder="Opsional" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Link Sosmed</label>
                <input type="text" name="link_sosmed" value={formData.link_sosmed} onChange={handleChange} placeholder="@instagram" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SEKSI 2: Pendidikan */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 uppercase tracking-wider mb-4">
              <i className="fas fa-school"></i> Pendidikan
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Jenjang</label>
                <select name="jenjang" value={formData.jenjang} onChange={handleChange} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors bg-white">
                  <option value="">— Pilih —</option>
                  <option value="TK">TK</option>
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA/SMK">SMA / SMK</option>
                  <option value="Kuliah">Kuliah</option>
                  <option value="Umum">Umum / Dewasa</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Nama Sekolah / Kampus</label>
                <input type="text" name="sekolah" value={formData.sekolah} onChange={handleChange} placeholder="Contoh: SMPN 5 Bogor" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Alamat Sekolah</label>
                <input type="text" name="pend_alamat" value={formData.pend_alamat} onChange={handleChange} placeholder="Opsional" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Kota Sekolah</label>
                <input type="text" name="pend_kota" value={formData.pend_kota} onChange={handleChange} placeholder="Opsional" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SEKSI 3: Ortu */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-4">
              <i className="fas fa-users"></i> Data Orang Tua
            </div>

            <div className="mb-6">
              <h4 className="text-[11px] font-bold text-slate-400 mb-3">AYAH</h4>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <input type="text" name="ortu_nama_ayah" value={formData.ortu_nama_ayah} onChange={handleChange} placeholder="Nama Ayah" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
                <input type="tel" name="ortu_hp_ayah" value={formData.ortu_hp_ayah} onChange={handleChange} placeholder="No HP Ayah" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" name="ortu_pekerjaan_ayah" value={formData.ortu_pekerjaan_ayah} onChange={handleChange} placeholder="Pekerjaan Ayah" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
                <input type="email" name="ortu_email_ayah" value={formData.ortu_email_ayah} onChange={handleChange} placeholder="Email Ayah" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 mb-3">IBU</h4>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <input type="text" name="ortu_nama_ibu" value={formData.ortu_nama_ibu} onChange={handleChange} placeholder="Nama Ibu" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
                <input type="tel" name="ortu_hp_ibu" value={formData.ortu_hp_ibu} onChange={handleChange} placeholder="No HP Ibu" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" name="ortu_pekerjaan_ibu" value={formData.ortu_pekerjaan_ibu} onChange={handleChange} placeholder="Pekerjaan Ibu" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
                <input type="email" name="ortu_email_ibu" value={formData.ortu_email_ibu} onChange={handleChange} placeholder="Email Ibu" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SEKSI 4: Labels */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-4">
              <i className="fas fa-tags"></i> Les / Layanan yang Diambil
            </div>
            
            <div className="flex flex-wrap gap-2">
              {labels.map(l => (
                <label key={l.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors select-none ${formData.label_ids.includes(l.id) ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <input type="checkbox" className="hidden" checked={formData.label_ids.includes(l.id)} onChange={() => handleLabelToggle(l.id)} />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.label_ids.includes(l.id) ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {formData.label_ids.includes(l.id) && <i className="fas fa-check text-[10px]"></i>}
                  </div>
                  {l.label_name}
                </label>
              ))}
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* SEKSI 5: Catatan */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-4">
              <i className="fas fa-sticky-note"></i> Catatan Tambahan
            </div>
            
            <textarea 
              name="catatan" 
              value={formData.catatan} 
              onChange={handleChange} 
              rows={3} 
              placeholder="Misal: customer referral dari X, perlu follow-up tiap Senin, dll." 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors resize-y leading-relaxed"
            ></textarea>
          </section>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 rounded-b-2xl">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            {editPhone ? 'Simpan Perubahan' : 'Simpan Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerModal;
