import React, { useState, useEffect } from 'react';
import api from '@/services/api';

const CourseList = () => {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // 'ADD' or 'EDIT'
  const [currentService, setCurrentService] = useState(null);
  
  const [formData, setFormData] = useState({ label_name: '', color: '#6366f1' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/course/services');
      if (res.data.status) {
        setServices(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ label_name: '', color: '#6366f1' });
    setModalMode('ADD');
  };

  const handleOpenEdit = (svc) => {
    setCurrentService(svc);
    setFormData({ label_name: svc.label_name, color: svc.color || '#6366f1' });
    setModalMode('EDIT');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus layanan ini?')) return;
    try {
      const res = await api.delete(`/course/services/${id}`);
      if (res.data.status) {
        fetchServices();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.label_name) return alert('Nama layanan wajib diisi');

    setIsSubmitting(true);
    try {
      if (modalMode === 'ADD') {
        await api.post('/course/services', formData);
      } else {
        await api.put(`/course/services/${currentService.id}`, formData);
      }
      setModalMode(null);
      fetchServices();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="relative z-10 px-6 h-[64px] bg-white border-b border-slate-200 flex items-center shadow-sm justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col justify-center">
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-snug">Daftar Kursus / Layanan</h1>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Kelola daftar kursus dan layanan yang tersedia
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleOpenAdd}
          className="px-6 h-11 rounded-xl text-[13px] font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-[1px]"
        >
          <i className="fas fa-plus"></i> Tambah Kursus
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-[50px_1fr_150px_150px] px-6 py-4 border-b border-slate-200 bg-slate-50/50 gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <span>#</span>
            <span>Nama Kursus / Layanan</span>
            <span>Kode Warna</span>
            <span>Aksi</span>
          </div>
          
          <div>
            {isLoading ? (
              <div className="text-center py-12 text-slate-500 text-[13px] font-medium">
                <i className="fas fa-spinner fa-spin mr-2"></i> Memuat layanan...
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <i className="fas fa-box-open text-3xl mb-3 text-slate-300"></i>
                <p className="text-[13px] font-medium">Belum ada daftar kursus</p>
              </div>
            ) : (
              services.map((svc, i) => (
                <div key={svc.id} className="grid grid-cols-[50px_1fr_150px_150px] px-6 py-4 border-b border-slate-100 items-center gap-4 hover:bg-slate-50/50 transition-colors last:border-b-0 bg-white">
                  <span className="text-[14px] font-bold text-slate-300">{i + 1}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded shadow-sm border border-slate-200" style={{ backgroundColor: svc.color || '#6366f1' }}></div>
                    <span className="text-[14px] font-bold text-slate-800">{svc.label_name}</span>
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-mono font-bold border border-slate-200">
                      {svc.color || '#6366f1'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenEdit(svc)}
                      className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors"
                    >
                      <i className="fas fa-edit text-[11px]"></i>
                    </button>
                    <button 
                      onClick={() => handleDelete(svc.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center hover:bg-red-100 transition-colors"
                    >
                      <i className="fas fa-trash-alt text-[11px]"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center">
          <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-gradient-to-b from-blue-50 to-white px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-[16px] font-extrabold text-slate-900">
                {modalMode === 'ADD' ? 'Tambah Kursus Baru' : 'Edit Kursus'}
              </h3>
              <button onClick={() => setModalMode(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Nama Kursus / Layanan <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.label_name} 
                  onChange={(e) => setFormData({...formData, label_name: e.target.value})}
                  placeholder="Contoh: Matematika SD" 
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors" 
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">Kode Warna (Hex)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="w-10 h-10 rounded border-none cursor-pointer p-0" 
                  />
                  <input 
                    type="text" 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-blue-500 transition-colors font-mono" 
                  />
                </div>
              </div>

              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseList;
