import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const PackageMediaManager = ({ packageId }) => {
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(null); // id of context being uploaded

  const fetchContexts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/travel/packages/${packageId}/media-contexts`);
      if (res.data.status) {
        setContexts(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch media contexts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (packageId) fetchContexts();
  }, [packageId]);

  const handleCreateContext = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await api.post(`/travel/packages/${packageId}/media-contexts`, {
        context_label: newLabel.trim()
      });
      if (res.data.status) {
        setNewLabel('');
        fetchContexts();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal membuat konteks baru');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteContext = async (contextId) => {
    if (!window.confirm('Yakin ingin menghapus konteks ini beserta semua filenya?')) return;
    try {
      await api.delete(`/travel/packages/${packageId}/media-contexts/${contextId}`);
      fetchContexts();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus konteks');
    }
  };

  const handleFileUpload = async (e, contextId) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));

    setUploading(contextId);
    try {
      await api.post(`/travel/packages/${packageId}/media-contexts/${contextId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchContexts();
    } catch (err) {
      console.error(err);
      alert('Gagal mengunggah file');
    } finally {
      setUploading(null);
      e.target.value = null; // reset input
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Hapus file ini?')) return;
    try {
      await api.delete(`/travel/packages/${packageId}/media-files/${fileId}`);
      fetchContexts();
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus file');
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-sm text-text-muted">Memuat konteks media...</div>;
  }

  return (
    <div className="mt-6 border-t border-border-base pt-6">
      <h4 className="text-sm font-bold text-text-heading mb-4 flex items-center gap-2">
        <Icon name="Database" size={16} className="text-indigo-base" />
        Konteks Media Pendukung
      </h4>
      <p className="text-xs text-text-muted mb-4">
        Unggah file (PDF/Excel/Word/Gambar) agar AI bisa membaca informasi detail saat pelanggan bertanya.
      </p>

      <div className="space-y-4">
        {contexts.map(ctx => (
          <div key={ctx.id} className="border border-border-base bg-bg-page rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h5 className="font-bold text-text-heading text-sm">{ctx.context_label}</h5>
                {ctx.ai_summary && (
                  <p className="text-xs text-indigo-600 mt-1 bg-indigo-50 p-2 rounded-lg border border-indigo-100 line-clamp-2">
                    <span className="font-bold">Summary AI:</span> {ctx.ai_summary}
                  </p>
                )}
              </div>
              <button 
                onClick={() => handleDeleteContext(ctx.id)}
                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                title="Hapus Konteks"
              >
                <Icon name="Trash2" size={14} />
              </button>
            </div>

            {/* File List */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {ctx.files?.map(file => (
                <div key={file.id} className="relative group bg-white border border-border-base rounded-lg p-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon name={file.file_type === 'image' ? 'Image' : 'FileText'} size={14} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-heading truncate" title={file.file_name}>{file.file_name}</p>
                    <p className="text-[10px] text-text-muted">{file.file_type.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Icon name="X" size={10} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            {/* Upload Area */}
            <div className="relative">
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.xls"
                onChange={(e) => handleFileUpload(e, ctx.id)}
                disabled={uploading === ctx.id}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm transition-colors ${uploading === ctx.id ? 'border-indigo-base bg-indigo-50 text-indigo-700' : 'border-border-base bg-white text-text-muted hover:border-indigo-base hover:text-indigo-base'}`}>
                {uploading === ctx.id ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-indigo-700 border-t-transparent rounded-full" /> Menganalisis File...</>
                ) : (
                  <><Icon name="UploadCloud" size={16} /> Klik atau Seret File Kesini (Maks 15MB)</>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add Context Form */}
        <form onSubmit={handleCreateContext} className="flex gap-2 items-center">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Judul Konteks Baru (misal: Itinerary Detail)"
            className="flex-1 px-3 py-2 text-sm bg-white border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-base/30"
          />
          <button 
            type="submit" 
            disabled={creating || !newLabel.trim()}
            className="px-4 py-2 bg-indigo-soft text-indigo-base hover:bg-indigo-base hover:text-white transition-colors rounded-xl text-sm font-bold flex items-center gap-1 shrink-0"
          >
            <Icon name="Plus" size={16} /> Konteks Baru
          </button>
        </form>
      </div>
    </div>
  );
};

export default PackageMediaManager;
