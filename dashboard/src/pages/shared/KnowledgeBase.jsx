import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';
import { EMPTY_TOPIC } from '@/lib/dummy/knowledgeBase';
import ContextMediaManager from '@/components/shared/ContextMediaManager';

const KnowledgeBase = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_TOPIC });
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef(null);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/knowledge-base');
      if (data.success) setTopics(data.data);
    } catch {
      alert('Gagal mengambil data Knowledge Base.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTopics(); }, []);

  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Pass kb_id saat edit agar embedding di-scope ke topik yang benar
      const url = editId ? `/knowledge-base/upload-media?kb_id=${editId}` : '/knowledge-base/upload-media';
      const { data } = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success && data.file_path) {
        updateForm('media_path', data.file_path);
        setUploadedFileName(file.name);
        if (data.has_text) {
          console.log(`[KbUpload] File berhasil diproses: ${data.extracted_length} karakter diekstrak untuk RAG search`);
        }
      } else {
        alert('Gagal upload file. Coba lagi.');
      }
    } catch {
      alert('Gagal upload file. Coba lagi.');
    } finally {
      setFileUploading(false);
    }
  };

  const handleAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_TOPIC });
    setUploadedFileName('');
    setShowForm(true);
  };

  const handleEdit = (topic) => {
    setEditId(topic.id);
    setForm({
      title: topic.title || '',
      content_text: topic.content_text || '',
      ai_context: topic.ai_context || '',
      allow_send_media: topic.allow_send_media || false,
      media_path: topic.media_path || null
    });
    setUploadedFileName(topic.media_path ? topic.media_path.split('/').pop() : '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.ai_context.trim()) {
      alert('Judul Topik dan AI Detailed Context wajib diisi.');
      return;
    }
    try {
      setSaving(true);
      if (editId) {
        const { data } = await api.put(`/knowledge-base/${editId}`, form);
        if (data.success) setTopics(prev => prev.map(t => t.id === editId ? data.data : t));
      } else {
        const { data } = await api.post('/knowledge-base', form);
        if (data.success) setTopics(prev => [data.data, ...prev]);
      }
      setShowForm(false);
      setForm({ ...EMPTY_TOPIC });
      setEditId(null);
    } catch {
      alert('Gagal menyimpan topik. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm({ ...EMPTY_TOPIC });
    setEditId(null);
  };

  const handleDelete = async (id) => {
    try {
      const { data } = await api.delete(`/knowledge-base/${id}`);
      if (data.success) setTopics(prev => prev.filter(t => t.id !== id));
    } catch {
      alert('Gagal menghapus topik. Coba lagi.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filtered = topics.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.content_text || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-display font-bold text-text-heading">Knowledge Base</h2>
          <p className="text-text-muted text-[11px] sm:text-xs mt-0.5">Informasi yang digunakan AI untuk menjawab pertanyaan pelanggan</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-1.5 bg-indigo-base hover:bg-indigo-mid text-white font-semibold py-2.5 px-5 rounded-lg text-xs shadow transition-all active:scale-95 w-full sm:w-auto"
        >
          <Icon name="Plus" size={13} strokeWidth={3} />
          Tambah Topik
        </button>
      </div>

      {/* ── Modal Popup Form ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleCancel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Card */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-base flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-soft flex items-center justify-center">
                  <Icon name={editId ? 'Pencil' : 'Plus'} size={13} className="text-indigo-base" strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-heading block">
                    {editId ? 'Edit Topik' : 'Topik Baru'}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {editId ? 'Ubah informasi knowledge base' : 'Tambahkan topik baru ke knowledge base'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-body hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Topic Title */}
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                  Judul Topik <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => updateForm('title', e.target.value)}
                  placeholder="Contoh: Kebijakan Refund, Jam Operasional, SOP Keterlambatan..."
                  className="w-full px-3.5 py-2.5 text-sm border border-border-base rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-base/25 focus:border-indigo-base transition-all"
                />
              </div>

              {/* Deskripsi + AI Context — grid 3:2 */}
              <div className="grid grid-cols-5 gap-4">
                {/* Deskripsi Umum — lebar 3/5 */}
                <div className="col-span-3">
                  <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">
                    Deskripsi Umum
                  </label>
                  <p className="text-[10px] text-text-muted/70 mb-1.5">Ditampilkan di dashboard sebagai ringkasan singkat</p>
                  <textarea
                    value={form.content_text}
                    onChange={e => updateForm('content_text', e.target.value)}
                    rows={8}
                    placeholder="Ringkasan singkat yang terlihat di daftar topik..."
                    className="w-full px-3.5 py-2.5 text-sm border border-border-base rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-base/25 focus:border-indigo-base transition-all resize-y"
                  />
                </div>

                {/* Konteks untuk AI — lebar 2/5 */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-indigo-base uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Icon name="Sparkles" size={11} strokeWidth={2.5} />
                    Konteks untuk AI <span className="text-red-400">*</span>
                  </label>
                  <p className="text-[10px] text-text-muted/70 mb-1.5">Instruksi detail untuk AI — tidak dilihat pelanggan</p>
                  <textarea
                    value={form.ai_context}
                    onChange={e => updateForm('ai_context', e.target.value)}
                    rows={8}
                    placeholder="Tulis instruksi atau informasi detail untuk AI di sini..."
                    className="w-full px-3.5 py-2.5 text-sm border border-indigo-base/30 rounded-lg bg-indigo-soft/20 focus:outline-none focus:ring-2 focus:ring-indigo-base/25 focus:border-indigo-base transition-all resize-y"
                  />
                </div>
              </div>

              {/* File Attachment */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 pt-1">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                    Lampiran File <span className="text-text-muted/50 font-normal normal-case">(opsional)</span>
                  </label>
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileUpload} />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all ${uploadedFileName ? 'border-green-300 bg-green-50/50' : 'border-border-base bg-bg-page/50 hover:border-indigo-base/40 hover:bg-indigo-soft/10'}`}
                  >
                    {fileUploading
                      ? <Icon name="Loader2" size={14} className="text-indigo-base animate-spin flex-shrink-0" />
                      : <Icon name={uploadedFileName ? 'CheckCircle' : 'Paperclip'} size={14} className={uploadedFileName ? 'text-green-500 flex-shrink-0' : 'text-text-muted/50 flex-shrink-0'} />
                    }
                    <span className="text-xs text-text-muted flex-1 truncate">
                      {fileUploading ? 'Mengupload...' : uploadedFileName || 'Klik untuk pilih file (gambar, PDF, dokumen)'}
                    </span>
                    {uploadedFileName && !fileUploading && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); updateForm('media_path', null); setUploadedFileName(''); }}
                        className="text-[11px] text-red-400 hover:text-red-600 font-semibold flex-shrink-0"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

                {/* Send Img Toggle */}
                <div className="flex-shrink-0 sm:pt-5">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">AI Kirim File</p>
                  <button
                    type="button"
                    onClick={() => updateForm('allow_send_media', !form.allow_send_media)}
                    className={`relative w-10 rounded-full transition-colors flex items-center ${form.allow_send_media ? 'bg-green-500' : 'bg-gray-200'}`}
                    style={{ height: '22px' }}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.allow_send_media ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <p className="text-[10px] text-text-muted/70 mt-1">{form.allow_send_media ? 'Aktif' : 'Nonaktif'}</p>
                </div>
              </div>

              {/* Media Manager — hanya saat Edit */}
              {editId && (
                <div className="border-t border-border-base pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="ImagePlus" size={14} className="text-indigo-base" />
                    <span className="font-semibold text-sm text-text-heading">Media & Konteks AI</span>
                    <span className="text-[10px] text-text-muted bg-bg-subtle px-2 py-0.5 rounded-full">untuk ContextMediaManager</span>
                  </div>
                  <ContextMediaManager scope="kb" entityId={editId} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2.5 px-5 py-4 border-t border-border-base flex-shrink-0">
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl border border-border-base text-text-body text-xs font-medium hover:bg-bg-subtle transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${saving ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-base hover:bg-indigo-mid active:scale-[0.98]'}`}
              >
                {saving ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Check" size={13} strokeWidth={2.5} />}
                {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Topik'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Search + List Card ── */}
      <div className="bg-white border border-border-base rounded-xl shadow-sm overflow-hidden">

        {/* Search Bar */}
        <div className="px-3 sm:px-4 py-3 border-b border-border-base flex items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari topik..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-border-base rounded-lg bg-bg-page focus:outline-none focus:ring-2 focus:ring-indigo-base/25 focus:border-indigo-base transition-all"
            />
          </div>
          {filtered.length > 0 && (
            <span className="text-[11px] text-text-muted ml-auto">
              {filtered.length} topik{search && ` dari ${topics.length}`}
            </span>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="py-16 text-center">
            <Icon name="Loader2" size={24} className="animate-spin text-indigo-base mx-auto mb-3" />
            <p className="text-text-muted text-xs">Memuat topik...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-soft flex items-center justify-center mx-auto mb-3">
              <Icon name="Brain" size={22} className="text-indigo-base" />
            </div>
            <p className="text-text-muted text-sm font-medium">
              {search ? 'Topik tidak ditemukan' : 'Belum ada topik'}
            </p>
            <p className="text-text-muted/60 text-xs mt-1">
              {search ? 'Coba kata kunci lain.' : 'Tambahkan topik agar AI bisa menjawab pelanggan.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-base/60">
            {filtered.map(t => {
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} className="group">
                  {/* Topic Row */}
                  <div className="flex items-start gap-3 sm:gap-3.5 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-bg-page/40 transition-colors">
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg bg-indigo-soft border border-indigo-border/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon name="FileText" size={14} className="text-indigo-base" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-[13px] sm:text-sm text-text-heading leading-snug">{t.title}</span>
                        {t.allow_send_media && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-50 border border-green-200 text-green-600 text-[10px] font-medium">
                            <Icon name="Paperclip" size={9} /> File
                          </span>
                        )}
                      </div>
                      {t.content_text && (
                        <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed line-clamp-2">{t.content_text}</p>
                      )}

                      {/* Expandable AI Context */}
                      {t.ai_context && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : t.id)}
                          className="flex items-center gap-1 mt-1.5 text-[11px] text-indigo-base hover:text-indigo-mid font-medium transition-colors"
                        >
                          <Icon name="Sparkles" size={10} strokeWidth={2.5} />
                          {isExpanded ? 'Sembunyikan' : 'Lihat'} konteks AI
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={11} />
                        </button>
                      )}
                      {isExpanded && t.ai_context && (
                        <div className="mt-2 px-3 py-2 bg-indigo-soft/40 border border-indigo-border/30 rounded-lg">
                          <p className="text-xs text-text-body leading-relaxed break-words">{t.ai_context}</p>
                        </div>
                      )}

                      {/* Action buttons — always visible on mobile, hover on desktop */}
                      <div className="flex gap-2 mt-2 sm:hidden">
                        <button
                          onClick={() => handleEdit(t)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-white text-indigo-600 text-[11px] font-semibold hover:bg-indigo-soft transition-all"
                        >
                          <Icon name="Pencil" size={11} strokeWidth={2.5} />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(t.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-base bg-white text-red-500 text-[11px] font-semibold hover:bg-red-50 transition-all"
                        >
                          <Icon name="Trash2" size={11} strokeWidth={2.5} />
                          Hapus
                        </button>
                      </div>
                    </div>

                    {/* Actions — desktop only (icon buttons, hover visible) */}
                    <div className="hidden sm:flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                      <button
                        onClick={() => handleEdit(t)}
                        title="Edit"
                        className="w-7 h-7 rounded-lg border border-border-base bg-white hover:bg-indigo-soft hover:border-indigo-border hover:text-indigo-base flex items-center justify-center transition-all text-text-muted"
                      >
                        <Icon name="Pencil" size={12} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        title="Hapus"
                        className="w-7 h-7 rounded-lg border border-border-base bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center transition-all text-text-muted"
                      >
                        <Icon name="Trash2" size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-black/40 backdrop-blur-sm absolute inset-0" />
          <div className="relative bg-white sm:rounded-xl rounded-t-2xl shadow-lg border border-border-base p-6 w-full sm:max-w-sm sm:mx-4 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Icon name="Trash2" size={18} className="text-red-500" />
            </div>
            <h3 className="text-center font-semibold text-text-heading text-base mb-1">Hapus Topik?</h3>
            <p className="text-center text-text-muted text-xs mb-5">AI tidak akan lagi menggunakan informasi ini untuk menjawab pelanggan.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-border-base text-text-body text-xs font-medium hover:bg-bg-subtle transition-all">Batal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all active:scale-95">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
