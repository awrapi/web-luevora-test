/**
 * ContextMediaManager — Refactored to use central SmartGrouping API
 * 
 * Props:
 *   scope      : 'package' | 'kb'
 *   entityId   : number — ID of the parent entity (packageId, kbId)
 *   title      : optional string — section title override
 *   readOnly   : optional bool
 * 
 * All smart analyze/commit calls go through:
 *   POST /smart-grouping/:scope/:entityId/analyze
 *   POST /smart-grouping/:scope/:entityId/commit
 *   POST /smart-grouping/regenerate-title
 */
import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';
import GroupingModal from '@/components/shared/GroupingModal';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:3001';

const getFileUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  return `${BASE_URL}/${filePath.replace(/^\//, '')}`;
};

const getFileIcon = (fileType) => {
  switch (fileType) {
    case 'image': return 'Image';
    case 'pdf': return 'FileText';
    case 'docx': return 'FileType';
    case 'excel': return 'Table';
    default: return 'File';
  }
};

/**
 * Derive the correct download filename, ensuring it has the right extension.
 * Cloudinary URLs sometimes strip extensions from raw files.
 */
const getDownloadFilename = (file) => {
  const name = file.file_name || 'file';
  // If name already has an extension, use it as-is
  if (/\.[a-zA-Z0-9]+$/.test(name)) return name;
  // Otherwise, infer from file_type
  const extMap = { pdf: '.pdf', docx: '.docx', excel: '.xlsx', image: '' };
  return name + (extMap[file.file_type] || '');
};

/**
 * Download a file via fetch+Blob to bypass cross-origin `download` attribute restriction.
 * This ensures Cloudinary-hosted files (PDF, DOCX, XLSX) download with correct format.
 */
const downloadFile = async (fileUrl, filename, setDownloading) => {
  if (!fileUrl) return;
  setDownloading(true);
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Gagal mengunduh file');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch (err) {
    console.error('[FileCard] download error:', err);
    // Fallback: open in new tab
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  } finally {
    setDownloading(false);
  }
};

const FileCard = ({ file, onDelete }) => {
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileUrl = getFileUrl(file.file_path);
  const isImage = file.file_type === 'image';
  const downloadFilename = getDownloadFilename(file);

  return (
    <div className="relative group bg-white border border-border-base rounded-xl overflow-hidden hover:border-indigo-base/50 hover:shadow-md transition-all">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block" title={`Buka: ${file.file_name}`}>
        {isImage && !imgError ? (
          <div className="w-full h-28 bg-gray-100 overflow-hidden">
            <img src={fileUrl} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgError(true)} />
          </div>
        ) : (
          <div className="w-full h-20 bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-base">
              <Icon name={getFileIcon(file.file_type)} size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase text-indigo-base/70 tracking-wider">{file.file_type}</span>
          </div>
        )}
      </a>
      <div className="p-2.5">
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block group/link" title={file.file_name}>
          <p className="text-xs font-bold text-text-heading truncate group-hover/link:text-indigo-base transition-colors">{file.ai_title || file.file_name}</p>
          {file.ai_title && <p className="text-[10px] text-text-muted truncate mt-0.5">{file.file_name}</p>}
          {file.ai_description && <p className="text-[10px] text-text-muted mt-1 line-clamp-2 leading-relaxed">{file.ai_description}</p>}
        </a>
        <div className="mt-2 flex items-center gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-indigo-base/70 hover:text-indigo-base font-semibold transition-colors"
          >
            <Icon name="ExternalLink" size={10} />
            Buka
          </a>
          {/* Download via fetch+Blob agar cross-origin file (Cloudinary) tetap dapat di-download dengan format benar */}
          {!isImage && (
            <button
              onClick={() => downloadFile(fileUrl, downloadFilename, setDownloading)}
              disabled={downloading}
              className="flex items-center gap-1 text-[10px] text-green-600/80 hover:text-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              <Icon name={downloading ? 'Loader' : 'Download'} size={10} className={downloading ? 'animate-spin' : ''} />
              {downloading ? 'Mengunduh...' : 'Unduh'}
            </button>
          )}
        </div>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(file.id)} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-600 hover:scale-110" title="Hapus File">
          <Icon name="X" size={10} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

/**
 * Fetch existing contexts/files based on scope.
 * For context-based scopes (package, kb) → returns contexts with files array.
 */
const fetchMediaForScope = async (scope, entityId) => {
  try {
    if (scope === 'package') {
      const res = await api.get(`/travel/packages/${entityId}/media-contexts`);
      return res.data.status ? res.data.data : [];
    }
    if (scope === 'kb') {
      const res = await api.get(`/knowledge-base/packages/${entityId}/media-contexts`);
      return res.data.status ? res.data.data : [];
    }
  } catch (err) {
    console.error('[ContextMediaManager] fetchMediaForScope error:', err);
  }
  return [];
};

const deleteContextForScope = async (scope, entityId, contextId) => {
  if (scope === 'package') await api.delete(`/travel/packages/${entityId}/media-contexts/${contextId}`);
  else if (scope === 'kb') await api.delete(`/knowledge-base/packages/${entityId}/media-contexts/${contextId}`);
  // For flat scopes: no concept of context deletion — not applicable here
};

const deleteFileForScope = async (scope, fileId) => {
  if (scope === 'package') await api.delete(`/travel/packages/0/media-files/${fileId}`); // fileId used, entityId unused
  else if (scope === 'kb') await api.delete(`/knowledge-base/packages/0/media-files/${fileId}`);
};

// Section titles per scope
const SCOPE_TITLES = {
  'package': 'Konteks Media Pendukung',
  'kb': 'Konteks Media Knowledge Base',
};

const SCOPE_DESCRIPTIONS = {
  'package': 'Unggah file pendukung. AI akan menganalisis dan Anda bisa mengatur pengelompokan secara interaktif.',
  'kb': 'Unggah dokumen ke knowledge base. AI akan mengelompokkan dan mengindeks untuk pencarian RAG.',
};

const ContextMediaManager = ({ scope = 'package', entityId, readOnly = false }) => {
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingContextId, setDeletingContextId] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Grouping Modal state — used for both "new upload" and "manage existing" flows
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [modalProposal, setModalProposal] = useState(null);
  const [modalInternalFiles, setModalInternalFiles] = useState(null);
  const [isManageMode, setIsManageMode] = useState(false); // true = rearrange existing

  const fetchContexts = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await fetchMediaForScope(scope, entityId);
      setContexts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContexts(); }, [entityId, scope]);

  const handleDeleteContext = async (contextId) => {
    if (!window.confirm('Yakin ingin menghapus grup ini beserta semua filenya?')) return;
    setDeletingContextId(contextId);
    try {
      await deleteContextForScope(scope, entityId, contextId);
      fetchContexts();
    } catch (err) {
      alert('Gagal menghapus grup');
    } finally {
      setDeletingContextId(null);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Hapus file ini?')) return;
    try {
      await deleteFileForScope(scope, fileId);
      fetchContexts();
    } catch (err) {
      alert('Gagal menghapus file');
    }
  };

  const handleSmartUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    setIsAnalyzing(true);
    try {
      const res = await api.post(`/smart-grouping/${scope}/${entityId}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      });
      if (res.data.status) {
        setModalProposal(res.data.data.proposal);
        setModalInternalFiles(res.data.data.internalFiles);
        setIsManageMode(false);
        setShowGroupingModal(true);
      }
    } catch (err) {
      alert('Gagal menganalisis file: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsAnalyzing(false);
      e.target.value = null;
    }
  };

  // Open manage mode: show all existing files in kanban for rearranging
  const handleOpenManageGrouping = () => {
    if (contexts.length === 0) return;
    setModalProposal({ groups: [] }); // No new upload groups — all from existingContexts
    setModalInternalFiles([]);
    setIsManageMode(true);
    setShowGroupingModal(true);
  };

  // Commit for new upload flow
  const handleModalCommit = async (finalProposal, internalFiles) => {
    try {
      const res = await api.post(`/smart-grouping/${scope}/${entityId}/commit`, {
        proposal: finalProposal,
        internalFiles,
      });
      if (res.data.status) {
        setShowGroupingModal(false);
        setModalProposal(null);
        setModalInternalFiles(null);
        setIsManageMode(false);
        fetchContexts();
      }
    } catch (err) {
      alert('Gagal menyimpan file: ' + (err.response?.data?.message || err.message));
    }
  };

  // Commit for rearrange (existing files) flow
  const handleRearrangeCommit = async (finalGroups) => {
    try {
      const res = await api.post(`/smart-grouping/${scope}/${entityId}/rearrange`, {
        groups: finalGroups,
      });
      if (res.data.status) {
        setShowGroupingModal(false);
        setModalProposal(null);
        setModalInternalFiles(null);
        setIsManageMode(false);
        fetchContexts();
      }
    } catch (err) {
      alert('Gagal menyimpan pengelompokan: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleModalClose = () => {
    if (window.confirm('Yakin ingin membatalkan?')) {
      setShowGroupingModal(false);
      setModalProposal(null);
      setModalInternalFiles(null);
      setIsManageMode(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 pt-6 border-t border-border-base flex items-center justify-center gap-2 py-8 text-text-muted text-sm">
        <div className="animate-spin w-4 h-4 border-2 border-indigo-base border-t-transparent rounded-full" />
        Memuat media...
      </div>
    );
  }

  const title = SCOPE_TITLES[scope] || 'Konteks Media';
  const description = SCOPE_DESCRIPTIONS[scope] || 'Unggah file media pendukung.';
  // For context-based scopes, we know context IDs. For flat scopes, no per-group delete.
  const canDeleteContext = ['package', 'kb'].includes(scope);

  return (
    <div className="mt-6 border-t border-border-base pt-6">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-bold text-text-heading flex items-center gap-2">
            <Icon name="Database" size={16} className="text-indigo-base" />
            {title}
          </h4>
          <p className="text-xs text-text-muted mt-1">{description}</p>
        </div>
        {/* Manage Grouping Button — only show if there are existing contexts */}
        {!readOnly && contexts.length > 0 && ['package', 'kb'].includes(scope) && (
          <button
            onClick={handleOpenManageGrouping}
            disabled={showGroupingModal}
            title="Atur ulang pengelompokan file yang sudah ada"
            className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-all disabled:opacity-50"
          >
            <Icon name="Settings2" size={14} />
            Atur Grouping
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!readOnly && (
        <div className="relative mb-6 mt-4">
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.xls"
            onChange={handleSmartUpload}
            disabled={isAnalyzing || showGroupingModal}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className={`w-full py-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-sm transition-colors ${
            isAnalyzing ? 'border-indigo-base bg-indigo-50 text-indigo-700' :
            'border-border-base bg-bg-page text-text-muted hover:border-indigo-base hover:bg-indigo-50/30'
          }`}>
            {isAnalyzing ? (
              <>
                <div className="animate-spin w-6 h-6 border-2 border-indigo-700 border-t-transparent rounded-full mb-1" />
                <span className="font-bold">AI Sedang Menganalisis File...</span>
                <span className="text-xs font-normal opacity-80">Mohon tunggu beberapa detik.</span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-1">
                  <Icon name="UploadCloud" size={20} />
                </div>
                <span className="font-bold text-text-heading">Klik atau Seret File Ke Sini</span>
                <span className="text-xs">Bisa pilih banyak file (Maks 10 file per upload)</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* GroupingModal — handles both "new upload" and "rearrange existing" mode */}
      <GroupingModal
        isOpen={showGroupingModal}
        proposal={modalProposal}
        internalFiles={modalInternalFiles || []}
        existingContexts={contexts}
        isManageMode={isManageMode}
        regenerateTitleEndpoint="/smart-grouping/regenerate-title"
        onCommit={isManageMode ? handleRearrangeCommit : handleModalCommit}
        onClose={handleModalClose}
      />

      {/* Existing Media Groups */}
      <div className="space-y-5">
        {contexts.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border-base rounded-xl text-sm text-text-muted">
            Belum ada media. Upload file di atas untuk memulai.
          </div>
        )}
        {contexts.map((ctx, ctxIdx) => (
          <div key={ctx.id ?? ctxIdx} className="border border-border-base bg-bg-page rounded-xl overflow-hidden">
            <div className="flex items-start justify-between px-4 pt-4 pb-3">
              <div className="flex-1 min-w-0 pr-3">
                {ctx.files && ctx.files.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-base bg-indigo-50 px-2 py-0.5 rounded mb-1">
                    <Icon name="Layers" size={10} /> Grup
                  </span>
                )}
                <h5 className="font-bold text-text-heading text-sm">{ctx.context_label}</h5>
                {ctx.ai_summary && (
                  <p className="text-xs text-indigo-700 mt-2 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 leading-relaxed">
                    <span className="font-bold">Ringkasan AI:</span> {ctx.ai_summary}
                  </p>
                )}
              </div>
              {canDeleteContext && !readOnly && (
                <button
                  onClick={() => handleDeleteContext(ctx.id)}
                  disabled={deletingContextId === ctx.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 border border-red-100 bg-red-50 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-50"
                  title="Hapus Grup"
                >
                  {deletingContextId === ctx.id ? (
                    <div className="animate-spin w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full" />
                  ) : (
                    <Icon name="Trash2" size={13} />
                  )}
                  Hapus
                </button>
              )}
            </div>

            {ctx.files && ctx.files.length > 0 ? (
              <div className="px-4 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">{ctx.files.length} File</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ctx.files.map(file => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onDelete={!readOnly ? handleDeleteFile : null}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4">
                <div className="text-center py-4 border-2 border-dashed border-border-base rounded-lg text-[11px] text-text-muted">
                  Belum ada file di grup ini.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextMediaManager;
