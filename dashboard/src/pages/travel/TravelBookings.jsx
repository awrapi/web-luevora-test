import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';
import InvoiceTemplateEditor from '@/components/travel/InvoiceTemplateEditor';
import ReceiptTemplateEditor from '@/components/travel/ReceiptTemplateEditor';
import ContextMediaManager from '@/components/shared/ContextMediaManager';
import PackageFormEditor from '@/components/travel/PackageFormEditor';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:3001';
const getFileUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  return `${BASE_URL}/${filePath.replace(/^\//, '')}`;
};

const TravelBookings = () => {
  const [activeTab, setActiveTab] = useState('packages');
  const [bookings, setBookings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [dateRequests, setDateRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [basicActiveTab, setBasicActiveTab] = useState('detail');
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [invoiceTemplate, setInvoiceTemplate] = useState(null);
  const [invoiceTemplates, setInvoiceTemplates] = useState([]);

  const [showReceiptEditor, setShowReceiptEditor] = useState(false);
  const [receiptTemplate, setReceiptTemplate] = useState(null);
  const [receiptTemplates, setReceiptTemplates] = useState([]);

  const [editingId, setEditingId] = useState(null); // null = create, number = edit
  const [formData, setFormData] = useState({ package_name: '', description: '', transaction_mode: 'auto', order_form_fields: [] });
  const [submitting, setSubmitting] = useState(false);
  const [basicContextFiles, setBasicContextFiles] = useState([]);
  const [basicMediaProposal, setBasicMediaProposal] = useState(null);
  const [basicMediaInternalFiles, setBasicMediaInternalFiles] = useState(null);
  const [basicMediaAnalyzing, setBasicMediaAnalyzing] = useState(false);
  const [showMediaSection, setShowMediaSection] = useState(false);
  const [showCreateMediaSection, setShowCreateMediaSection] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  const resetBasicMediaDraft = () => {
    setBasicContextFiles([]);
    setBasicMediaProposal(null);
    setBasicMediaInternalFiles(null);
    setBasicMediaAnalyzing(false);
  };

  const renderAiContextTitle = (title, loading = false) => (
    <div className="mb-3 border border-indigo-100 bg-indigo-50/60 rounded-xl px-3 py-2.5 flex items-start gap-2">
      <Icon name={loading ? 'Loader' : 'Sparkles'} size={15} className={`mt-0.5 shrink-0 text-indigo-600${loading ? ' animate-spin' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase text-indigo-600 leading-none mb-1">Judul AI</p>
        <p className={`text-sm font-bold ${title || loading ? 'text-text-heading' : 'text-text-muted'} truncate`}>
          {loading ? 'Menganalisis file...' : (title || 'Belum ada judul AI')}
        </p>
      </div>
    </div>
  );

  // Date Request Action State
  const [actionReq, setActionReq] = useState(null); // { id, action: 'approve' | 'reject' }
  const [actionReason, setActionReason] = useState('');
  const [actionSuggestDate, setActionSuggestDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'bookings') {
        const res = await api.get('/travel/bookings');
        if (res.data.status) {
          setBookings(res.data.data);
        }
      } else if (activeTab === 'packages') {
        const res = await api.get('/travel/bookings/packages');
        if (res.data.status) {
          setPackages(res.data.data);
        }
      } else if (activeTab === 'invoices') {
        const resInvoice = await api.get('/travel/invoices/template/invoice');
        if (resInvoice.data.status) {
          setInvoiceTemplates(resInvoice.data.data);
        }
        const resReceipt = await api.get('/travel/invoices/template/receipt');
        if (resReceipt.data.status) {
          setReceiptTemplates(resReceipt.data.data);
        }
      } else if (activeTab === 'daterequests') {
        const res = await api.get('/travel/customer-requests?type=date_confirmation&status=pending');
        if (res.data.success) {
          setDateRequests(res.data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching travel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleActionRequest = async () => {
    if (!actionReq) return;
    setActionLoading(true);
    try {
      if (actionReq.action === 'approve') {
        await api.post(`/travel/customer-requests/${actionReq.id}/approve`, {
          with_terms: false
        });
      } else {
        await api.post(`/travel/customer-requests/${actionReq.id}/reject`, {
          reason: actionReason,
          suggested_date: actionSuggestDate
        });
      }
      setActionReq(null);
      setActionReason('');
      setActionSuggestDate('');
      fetchData();
    } catch (err) {
      console.error('Action failed:', err);
      alert(err.response?.data?.message || 'Gagal memproses request');
    } finally {
      setActionLoading(false);
    }
  };

  // === Modal handlers ===
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ package_name: '', description: '', order_form_fields: [] });
    resetBasicMediaDraft();
    setShowCreateMediaSection(false);
    setShowModal(true);
  };

  const handleOpenEdit = (pkg) => {
    resetBasicMediaDraft();
    setEditingId(pkg.id);
    setFormData({
      order_form_fields: [],
      package_name: pkg.package_name || '',
      description: pkg.description || '',
      transaction_mode: pkg.transaction_mode || 'auto'
    });
    setShowMediaSection(false);
    setShowCreateMediaSection(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ package_name: '', description: '', order_form_fields: [] });
    resetBasicMediaDraft();
    setShowMediaSection(false);
    setShowCreateMediaSection(false);
  };

  const analyzeBasicContextFiles = async (files = basicContextFiles) => {
    const filesToAnalyze = (files || []).filter(cf => cf.file);
    if (filesToAnalyze.length === 0) return;

    setBasicMediaAnalyzing(true);
    setBasicMediaProposal(null);
    setBasicMediaInternalFiles(null);
    try {
      const formDataUpload = new FormData();
      filesToAnalyze.forEach(cf => formDataUpload.append('files', cf.file));
      const res = await api.post('/travel/packages/draft/smart-analyze', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      });
      if (res.data?.status && res.data?.data) {
        setBasicMediaProposal(res.data.data.proposal);
        setBasicMediaInternalFiles(res.data.data.internalFiles);
      }
    } catch (e) {
      alert('Gagal menganalisis file: ' + (e.response?.data?.message || e.message));
    } finally {
      setBasicMediaAnalyzing(false);
    }
  };

  const handleMoveBasicFile = (fileTempId, fromGroupIdx, toGroupIdxStr) => {
    const toGroupIdx = parseInt(toGroupIdxStr, 10);
    if (fromGroupIdx === toGroupIdx || isNaN(toGroupIdx)) return;
    setBasicMediaProposal(prev => {
      if (!prev || !prev.groups) return prev;
      const newGroups = JSON.parse(JSON.stringify(prev.groups));
      const fileIndex = newGroups[fromGroupIdx].files.findIndex(f => f.tempId === fileTempId);
      if (fileIndex !== -1) {
        const [fileObj] = newGroups[fromGroupIdx].files.splice(fileIndex, 1);
        if (!newGroups[toGroupIdx].files) newGroups[toGroupIdx].files = [];
        newGroups[toGroupIdx].files.push(fileObj);
      }
      return { ...prev, groups: newGroups };
    });
  };

  const handleBasicContextFileSelection = (fileList) => {
    const newFiles = Array.from(fileList || []).map(f => ({ name: f.name, size: f.size, type: f.type, file: f }));
    if (newFiles.length === 0) return;

    const combinedFiles = [...basicContextFiles, ...newFiles];
    setBasicContextFiles(combinedFiles);
    analyzeBasicContextFiles(combinedFiles);
  };

  const handleRemoveBasicContextFile = (fileIndex) => {
    setBasicContextFiles(prev => prev.filter((_, idx) => idx !== fileIndex));
    setBasicMediaProposal(null);
    setBasicMediaInternalFiles(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.package_name.trim()) return;
    if (!editingId && basicMediaAnalyzing) {
      alert('Tunggu analisis AI selesai terlebih dahulu.');
      return;
    }
    if (!editingId && basicContextFiles.length > 0 && (!basicMediaProposal || !basicMediaInternalFiles)) {
      alert('File konteks harus dianalisis AI terlebih dahulu agar judul konteks dibuat otomatis.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        // Update existing
        const res = await api.put(`/travel/bookings/packages/${editingId}`, {
          package_name: formData.package_name.trim(),
          description: formData.description.trim(),
          order_form_fields: formData.order_form_fields,
        });
        if (res.data.status) {
          handleCloseModal();
          fetchData();
        }
      } else {
        // Create new
        const res = await api.post('/travel/bookings/packages', {
          package_name: formData.package_name.trim(),
          description: formData.description.trim(),
          order_form_fields: formData.order_form_fields,
        });
        if (res.data.status) {
          const packageId = res.data.data?.id;
          if (packageId && basicMediaProposal && basicMediaInternalFiles) {
            await api.post(`/travel/packages/${packageId}/smart-commit`, {
              proposal: basicMediaProposal,
              internalFiles: basicMediaInternalFiles,
            });
          }
          handleCloseModal();
          if (activeTab === 'packages') {
            fetchData();
          } else {
            setActiveTab('packages');
          }
        }
      }
    } catch (err) {
      console.error('Error saving package:', err);
      alert('Gagal menyimpan paket. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewInvoiceModel = () => {
    setInvoiceTemplate(null);
    setShowInvoiceEditor(true);
  };

  const handleEditInvoiceModel = (template) => {
    const templateData = { ...template };
    if (templateData.design_data) {
      const parsed = JSON.parse(templateData.design_data);
      templateData.items = parsed.items || [];
      templateData.canvasColor = parsed.canvasColor || '#ffffff';
    }
    setInvoiceTemplate(templateData);
    setShowInvoiceEditor(true);
  };

  const handleSetActiveTemplate = async (id) => {
    try {
      await api.put(`/travel/invoices/template/invoice/${id}/active`);
      fetchData();
    } catch (err) {
      console.error('Error setting active template:', err);
      alert('Gagal mengaktifkan model invoice.');
    }
  };

  const handleSaveInvoiceTemplate = async (templateData) => {
    try {
      const res = await api.post('/travel/invoices/template/invoice', {
        id: invoiceTemplate?.id,
        name: templateData.name,
        design_data: templateData
      });
      if (res.data.status) {
        setShowInvoiceEditor(false);
        fetchData();
        alert('Model Invoice berhasil disimpan!');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Gagal menyimpan model invoice.');
    }
  };

  const handleCreateNewReceiptModel = () => {
    setReceiptTemplate(null);
    setShowReceiptEditor(true);
  };

  const handleEditReceiptModel = (template) => {
    const templateData = { ...template };
    if (templateData.design_data) {
      const parsed = JSON.parse(templateData.design_data);
      templateData.items = parsed.items || [];
      templateData.canvasColor = parsed.canvasColor || '#ffffff';
    }
    setReceiptTemplate(templateData);
    setShowReceiptEditor(true);
  };

  const handleSetActiveReceiptTemplate = async (id) => {
    try {
      await api.put(`/travel/invoices/template/receipt/${id}/active`);
      fetchData();
    } catch (err) {
      console.error('Error setting active receipt template:', err);
      alert('Gagal mengaktifkan model receipt.');
    }
  };

  const handleSaveReceiptTemplate = async (templateData) => {
    try {
      const res = await api.post('/travel/invoices/template/receipt', {
        id: receiptTemplate?.id,
        name: templateData.name,
        design_data: templateData
      });
      if (res.data.status) {
        setShowReceiptEditor(false);
        fetchData();
        alert('Model Receipt berhasil disimpan!');
      }
    } catch (err) {
      console.error('Error saving receipt template:', err);
      alert('Gagal menyimpan model receipt.');
    }
  };

  const confirmDelete = (pkgId) => {
    setDeleteId(pkgId);
  };

  const handleDeletePackage = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/travel/bookings/packages/${deleteId}`);
      setDeleteId(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting package:', err);
      alert('Gagal menghapus inventory.');
      setDeleteId(null);
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto">
      {/* ── Premium Header ── */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2 animate-inventory-header">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200/40">
              <Icon name="Package" size={18} className="text-white" />
            </div>
            <h2 className="text-[26px] font-display font-bold text-text-heading tracking-tight">Inventory</h2>
          </div>
          <p className="text-text-muted text-sm ml-[52px] animate-inventory-subtitle">Kelola inventory dan daftar produk travel Anda.</p>
        </div>
      </div>

      {/* ── Tab Pill ── */}
      <div className="animate-inventory-tabpill mb-6">
        <div className="inline-flex bg-bg-surface border border-border-base shadow-sm p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('packages')}
            className="relative px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-200/50 transition-all duration-300"
            style={{ animation: 'inventoryPillGlow 3s ease-in-out infinite' }}
          >
            <span className="flex items-center gap-2">
              <Icon name="Layers" size={14} />
              Inventory
            </span>
          </button>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="bg-bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4 p-5 rounded-2xl border border-border-base/50">
                <div className="inventory-skeleton w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="inventory-skeleton h-4 w-2/5" />
                  <div className="inventory-skeleton h-3 w-4/5" />
                </div>
                <div className="inventory-skeleton h-6 w-16 rounded-lg shrink-0" />
                <div className="flex gap-2 shrink-0">
                  <div className="inventory-skeleton w-8 h-8 rounded-lg" />
                  <div className="inventory-skeleton w-8 h-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'packages' ? (
          /* ===== PACKAGES TAB — Premium Card Layout ===== */
          <div className="flex flex-col">
            {/* Toolbar */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border-base/60 bg-gradient-to-r from-bg-page/50 to-transparent flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:flex-none">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    placeholder="Cari inventory..."
                    className="input-modern w-full sm:w-56 pl-9 pr-4 py-2 bg-white border border-border-base/60 rounded-xl text-xs text-text-body placeholder:text-gray-300 focus:outline-none shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-text-muted font-medium bg-bg-subtle px-2.5 py-1 rounded-lg tabular-nums whitespace-nowrap">
                  {packages.length} item{packages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={handleOpenCreate}
                className="inventory-fab bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Icon name="Plus" size={16} className="inventory-fab-icon" />
                <span className="whitespace-nowrap">Tambah Inventory Baru</span>
              </button>
            </div>
          
            {/* Package Cards */}
            <div className="p-3 sm:p-6">
              {packages.length === 0 ? (
                /* ── Premium Empty State ── */
                <div className="flex flex-col items-center justify-center py-16 animate-inventory-card">
                  <div className="inventory-empty-icon w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 flex items-center justify-center mb-5">
                    <Icon name="PackageOpen" size={32} className="text-indigo-300" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-text-heading mb-1.5">Belum ada inventory</h3>
                  <p className="text-sm text-text-muted mb-6 max-w-sm text-center">Mulai tambahkan paket wisata atau produk travel Anda agar AI bisa menawarkannya ke pelanggan.</p>
                  <button
                    onClick={handleOpenCreate}
                    className="inventory-fab bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-200/40"
                  >
                    <Icon name="Plus" size={16} className="inventory-fab-icon" />
                    Tambah Inventory Pertama
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {packages.map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      className={`inventory-row group relative flex items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-border-base/70 bg-white hover:border-indigo-200/80 animate-inventory-card animate-inventory-card-${Math.min(idx + 1, 5)}`}
                    >
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full transition-all duration-300 ${
                        pkg.status === 'active' ? 'bg-gradient-to-b from-emerald-400 to-emerald-500' : 'bg-gray-200'
                      }`} />

                      {/* Icon */}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                        pkg.status === 'active'
                          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-500 group-hover:shadow-md group-hover:shadow-indigo-100/50'
                          : 'bg-gray-50 text-gray-400'
                      }`}>
                        <Icon name="MapPin" size={16} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-display font-bold text-text-heading text-sm leading-snug mb-1 group-hover:text-indigo-600 transition-colors duration-200">
                          {pkg.package_name}
                        </h4>
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                          {pkg.description || 'Belum ada deskripsi'}
                        </p>
                        {/* Status Badge - shown below text on mobile */}
                        <div className="sm:hidden mt-2">
                          {pkg.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                              <span className="inventory-status-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/60 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                              {pkg.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge - hidden on mobile, shown on desktop */}
                      <div className="hidden sm:block shrink-0">
                        {pkg.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            <span className="inventory-status-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200/60 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                            {pkg.status}
                          </span>
                        )}
                      </div>

                      {/* Actions — always visible on mobile, hover on desktop */}
                      <div className="flex items-center gap-1.5 shrink-0 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleOpenEdit(pkg)}
                          className="inventory-action-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                          title="Edit"
                        >
                          <Icon name="Pencil" size={15} />
                        </button>
                        <button
                          onClick={() => confirmDelete(pkg.id)}
                          className="inventory-action-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-red-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100"
                          title="Hapus"
                        >
                          <Icon name="Trash2" size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'invoices' ? (
          /* ===== INVOICE & RECEIPT TAB ===== */
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Card Invoice */}
              <div className="flex-1 bg-bg-page border border-border-base p-6 rounded-2xl flex flex-col hover:border-indigo-base/30 transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-text-heading flex items-center gap-2">
                      <Icon name="FileText" size={24} className="text-indigo-base" />
                      Model Invoice
                    </h3>
                    <p className="text-sm text-text-muted mt-1">
                      Pilih satu template aktif yang akan digunakan AI untuk membuat invoice.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewInvoiceModel}
                    className="bg-indigo-base hover:bg-indigo-mid text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0"
                  >
                    <Icon name="Plus" size={16} />
                    Buat Baru
                  </button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {invoiceTemplates.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-text-muted border-2 border-dashed border-border-base rounded-xl">
                      Belum ada model invoice. Silakan buat baru.
                    </div>
                  ) : invoiceTemplates.map(tpl => (
                    <div 
                      key={tpl.id} 
                      className={`relative p-5 rounded-xl border-2 transition-all ${tpl.is_active ? 'border-indigo-base bg-indigo-50/30' : 'border-border-base bg-white hover:border-indigo-200'}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleSetActiveTemplate(tpl.id)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${tpl.is_active ? 'border-indigo-base bg-indigo-base text-white' : 'border-gray-300 hover:border-indigo-base'}`}
                          >
                            {tpl.is_active && <Icon name="Check" size={12} strokeWidth={4} />}
                          </button>
                          <div>
                            <h4 className="font-bold text-text-heading">{tpl.name}</h4>
                            <p className="text-xs text-text-muted mt-0.5">Dibuat: {new Date(tpl.created_at).toLocaleDateString('id-ID')}</p>
                          </div>
                        </div>
                        {tpl.is_active && (
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Aktif</span>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border-base/50 flex justify-end">
                        <button
                          onClick={() => handleEditInvoiceModel(tpl)}
                          className="text-indigo-base hover:text-indigo-700 text-sm font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Icon name="Edit3" size={14} /> Edit Desain
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Receipt */}
              <div className="flex-1 bg-bg-page border border-border-base p-6 rounded-2xl flex flex-col hover:border-green-500/30 transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-text-heading flex items-center gap-2">
                      <Icon name="Receipt" size={24} className="text-green-600" />
                      Model Receipt
                    </h3>
                    <p className="text-sm text-text-muted mt-1">
                      Template kuitansi (lunas) yang dikirim otomatis.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewReceiptModel}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0"
                  >
                    <Icon name="Plus" size={16} />
                    Buat Baru
                  </button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {receiptTemplates.length === 0 ? (
                    <div className="py-8 text-center text-text-muted border-2 border-dashed border-border-base rounded-xl">
                      Belum ada model receipt.
                    </div>
                  ) : receiptTemplates.map(tpl => (
                    <div 
                      key={tpl.id} 
                      className={`relative p-5 rounded-xl border-2 transition-all ${tpl.is_active ? 'border-green-500 bg-green-50/30' : 'border-border-base bg-white hover:border-green-200'}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleSetActiveReceiptTemplate(tpl.id)}
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${tpl.is_active ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}
                          >
                            {tpl.is_active && <Icon name="Check" size={12} strokeWidth={4} />}
                          </button>
                          <div>
                            <h4 className="font-bold text-text-heading">{tpl.name}</h4>
                            <p className="text-xs text-text-muted mt-0.5">Dibuat: {new Date(tpl.created_at).toLocaleDateString('id-ID')}</p>
                          </div>
                        </div>
                        {tpl.is_active && (
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Aktif</span>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border-base/50 flex justify-end">
                        <button
                          onClick={() => handleEditReceiptModel(tpl)}
                          className="text-green-600 hover:text-green-800 text-sm font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Icon name="Edit3" size={14} /> Edit Desain
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'daterequests' ? (
          /* ===== DATE REQUESTS TAB ===== */
          <div className="flex flex-col">
            <div className="p-4 border-b border-border-base bg-bg-page/30 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-text-heading">Request Tanggal (Konfirmasi Sistem)</h3>
                <p className="text-xs text-text-muted mt-0.5">Daftar permintaan konfirmasi ketersediaan tanggal dari kustomer via AI.</p>
              </div>
              <button onClick={fetchData} className="p-2 bg-white border border-border-base rounded-xl text-text-muted hover:text-indigo-base transition-all shadow-sm">
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-page/50 border-b border-bg-subtle text-xs uppercase text-text-muted tracking-wider">
                    <th className="p-4 font-bold">Waktu</th>
                    <th className="p-4 font-bold">Kustomer</th>
                    <th className="p-4 font-bold">Detail Request</th>
                    <th className="p-4 font-bold text-center">Status</th>
                    <th className="p-4 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-subtle">
                  {dateRequests.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-text-muted">Tidak ada request konfirmasi tanggal yang pending.</td>
                    </tr>
                  ) : dateRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-bg-page/50 transition-colors">
                      <td className="p-4 text-xs text-text-body">
                        {new Date(req.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-text-heading text-sm">{req.customer_name}</div>
                        <div className="text-xs text-text-muted">{req.phone}</div>
                      </td>
                      <td className="p-4 text-sm text-text-body max-w-sm">
                        <p className="line-clamp-2">{req.request_detail}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setActionReq({ id: req.id, action: 'approve' })} className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg text-xs font-bold transition-all border border-green-200">
                            Approve
                          </button>
                          <button onClick={() => setActionReq({ id: req.id, action: 'reject' })} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition-all border border-red-200">
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-bg-surface border border-border-base sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-sm sm:mx-4 p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Icon name="AlertTriangle" size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-heading mb-2">Hapus Inventory?</h3>
            <p className="text-sm text-text-muted mb-6">
              Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus inventory ini?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-heading rounded-xl hover:bg-bg-page transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleDeletePackage}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Inventory */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center p-0 sm:p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-indigo-950/30 animate-modal-backdrop" onClick={handleCloseModal} />

          {/* Modal Card — full-screen on mobile, popup on desktop */}
          <div className="relative bg-white sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden animate-modal-card sm:ring-1 sm:ring-white/20
            fixed inset-0 sm:static sm:inset-auto">
            {/* Gradient accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 animate-gradient-shift shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 pb-0">
              <div className="flex items-center gap-3 sm:gap-4 animate-content-reveal animate-content-reveal-1">
                {/* Icon badge */}
                <div className="relative">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
                    <Icon name={isEditing ? 'Edit3' : 'PlusCircle'} size={18} className="text-white" />
                  </div>
                  {isEditing && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white animate-badge-pop flex items-center justify-center">
                      <Icon name="Pencil" size={7} className="text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-text-heading tracking-tight">
                    {isEditing ? 'Edit Inventory' : 'Tambah Inventory'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                    {isEditing ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>Mode Edit — memperbarui paket yang sudah ada</>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>Buat inventory baru untuk pelanggan</>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="modal-close-btn w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all duration-300 group">
                <Icon name="X" size={20} className="transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-0 animate-content-reveal animate-content-reveal-2">
              <div className="flex gap-1 bg-gray-50/80 p-1 rounded-2xl border border-gray-100 w-full sm:w-fit overflow-x-auto">
                {[
                  { key: 'detail', label: 'Detail Dasar', icon: 'FileText' },
                  { key: 'order_form', label: 'Form Pesanan AI', icon: 'ListChecks' },
                  { key: 'invoicing', label: 'Invoicing', icon: 'Receipt' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBasicActiveTab(tab.key)}
                    className={`relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-[13px] font-semibold transition-all duration-300 whitespace-nowrap flex-1 sm:flex-none ${
                      basicActiveTab === tab.key
                        ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50 ring-1 ring-indigo-100'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    <Icon name={tab.icon} size={13} className={basicActiveTab === tab.key ? 'text-indigo-500' : ''} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mx-4 sm:mx-8 mt-3 sm:mt-4" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 scrollbar-thin">

                {/* ── Detail Tab ── */}
                <div className={basicActiveTab === 'detail' ? 'block animate-content-reveal animate-content-reveal-1' : 'hidden'}>
                  <div className="space-y-6">
                    <div className="animate-content-reveal animate-content-reveal-2">
                      <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                        <Icon name="Package" size={14} className="text-indigo-400" />
                        Judul Paket <span className="text-red-400">*</span>
                      </label>
                      <div className="animate-focus-ring rounded-xl">
                        <input
                          type="text"
                          value={formData.package_name}
                          onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                          placeholder="contoh: Paket Bali 3H2M"
                          className="input-modern w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none shadow-sm"
                          autoFocus
                          required
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5 ml-1 flex items-center gap-1">
                        <Icon name="Info" size={10} />
                        Gunakan nama yang menarik dan mudah diingat pelanggan
                      </p>
                    </div>

                    <div className="animate-content-reveal animate-content-reveal-3">
                      <label className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                          <Icon name="AlignLeft" size={14} className="text-indigo-400" />
                          Deskripsi
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                          {formData.description.length > 0 && `${formData.description.length} karakter`}
                        </span>
                      </label>
                      <div className="animate-focus-ring rounded-xl">
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Deskripsi singkat tentang inventory ini...\n\nContoh: Paket 3 hari 2 malam termasuk hotel, transportasi, dan makan 2x sehari."
                          rows={10}
                          className="textarea-modern w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none leading-relaxed shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Context for AI */}
                    {!isEditing && (
                      <div className="animate-content-reveal animate-content-reveal-4">
                        <button
                          type="button"
                          onClick={() => setShowCreateMediaSection(!showCreateMediaSection)}
                          className="w-full flex items-center justify-between py-1 group/cmedia"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <Icon name="Database" size={13} className="text-indigo-500" />
                            </div>
                            <span className="text-[13px] font-semibold text-gray-700">Konteks Media Pendukung</span>
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              {showCreateMediaSection ? 'Ditampilkan' : 'Disembunyikan'}
                            </span>
                          </div>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${showCreateMediaSection ? 'bg-indigo-100 text-indigo-500 rotate-180' : 'bg-gray-100 text-gray-400 group-hover/cmedia:bg-indigo-50 group-hover/cmedia:text-indigo-400'}`}>
                            <Icon name="ChevronDown" size={16} />
                          </div>
                        </button>
                        <div className={`overflow-hidden transition-all duration-400 ease-in-out ${showCreateMediaSection ? 'max-h-[3000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                        <p className="text-xs text-gray-400 mb-3 ml-9">Unggah file (PDF/Word/Excel/Gambar) agar AI otomatis mengelompokkan dan membuat judul konteks.</p>

                        <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/30">
                          {renderAiContextTitle(
                            basicMediaProposal?.groups?.length > 1
                              ? `${basicMediaProposal.groups.length} judul konteks AI siap disimpan`
                              : basicMediaProposal?.groups?.[0]?.mainTitle,
                            basicMediaAnalyzing
                          )}

                          {basicMediaProposal?.groups?.length > 0 ? (
                            <div className="space-y-3">
                              {basicMediaProposal.groups.map((group, idx) => (
                                <div key={idx} className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 transition-all hover:shadow-sm">
                                  <p className="text-xs font-semibold text-indigo-900 mb-1">{group.mainTitle}</p>
                                  {group.mainSummary && <p className="text-[11px] text-indigo-600 mb-2 line-clamp-2">{group.mainSummary}</p>}
                                  <div className="space-y-1">
                                    {group.files?.map((gf, gfi) => {
                                      const internalMatch = basicMediaInternalFiles?.find(f => f.tempId === gf.tempId);
                                      const cfIndex = internalMatch ? basicContextFiles.findIndex(cf => cf.name === internalMatch.originalName) : -1;
                                      const cf = cfIndex !== -1 ? basicContextFiles[cfIndex] : null;
                                      return (
                                        <div key={gfi} className="flex items-center gap-2.5 bg-white border border-indigo-100/60 rounded-xl px-3 py-2 transition-all hover:shadow-sm">
                                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                            <Icon name={internalMatch?.fileType === 'image' ? 'Image' : 'FileText'} size={13} className="text-gray-400" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-700 truncate">{internalMatch?.originalName || gf.tempId}</p>
                                            <div className="text-[10px] text-indigo-500 mt-0.5 flex items-start gap-1">
                                              <Icon name="Sparkles" size={9} className="shrink-0 mt-0.5" />
                                              <span><span className="font-semibold">{gf.subTitle}</span> — {gf.subSummary}</span>
                                            </div>
                                          </div>
                                          {basicMediaProposal.groups.length > 1 && (
                                            <select
                                              value={idx}
                                              onChange={(e) => handleMoveBasicFile(gf.tempId, idx, e.target.value)}
                                              className="text-[10px] bg-indigo-50 border border-indigo-100 rounded-lg px-1.5 py-1 text-indigo-600 font-medium focus:outline-none max-w-[110px] truncate"
                                            >
                                              {basicMediaProposal.groups.map((g, gIdx) => (
                                                <option key={gIdx} value={gIdx}>{g.mainTitle}</option>
                                              ))}
                                            </select>
                                          )}
                                          {cfIndex !== -1 && (
                                            <button type="button" onClick={() => handleRemoveBasicContextFile(cfIndex)} disabled={basicMediaAnalyzing} className="text-red-300 hover:text-red-500 p-1 disabled:opacity-40 transition-colors">
                                              <Icon name="Trash2" size={13} />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            basicContextFiles.length > 0 && (
                              <div className="space-y-1.5">
                                {basicContextFiles.map((cf, fi) => (
                                  <div key={fi} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                      <Icon name={cf.type?.startsWith('image') ? 'Image' : 'FileText'} size={13} className="text-gray-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-700 truncate">{cf.name}</p>
                                      <p className="text-[10px] text-gray-400 uppercase">New File</p>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveBasicContextFile(fi)} disabled={basicMediaAnalyzing} className="text-red-300 hover:text-red-500 p-1 disabled:opacity-40 transition-colors">
                                      <Icon name="Trash2" size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )
                          )}

                          <div className="relative group">
                            <input
                              type="file"
                              multiple
                              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.xls"
                              onChange={(e) => { handleBasicContextFileSelection(e.target.files); e.target.value = null; }}
                              disabled={basicMediaAnalyzing}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                            />
                            <div className={`w-full py-4 border-2 border-dashed rounded-2xl flex items-center justify-center gap-2 text-xs font-medium transition-all duration-300 ${basicMediaAnalyzing ? 'border-indigo-300 bg-indigo-50 text-indigo-500' : 'border-gray-200 bg-white text-gray-400 group-hover:border-indigo-400 group-hover:text-indigo-500 group-hover:bg-indigo-50/50 group-hover:shadow-sm'}`}>
                              {basicMediaAnalyzing ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="UploadCloud" size={15} className="transition-transform duration-300 group-hover:-translate-y-0.5" />}
                              {basicMediaAnalyzing ? 'AI sedang menganalisis...' : 'Upload dokumen pendukung'}
                            </div>
                          </div>

                          {basicContextFiles.length > 0 && !basicMediaProposal && !basicMediaAnalyzing && (
                            <button type="button" onClick={() => analyzeBasicContextFiles()} className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-500 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all hover:shadow-sm">
                              <Icon name="Cpu" size={14} /> Generate Judul AI
                            </button>
                          )}
                        </div>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <div className="animate-content-reveal animate-content-reveal-4">
                        <button
                          type="button"
                          onClick={() => setShowMediaSection(!showMediaSection)}
                          className="w-full flex items-center justify-between py-1 group/media"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <Icon name="Database" size={13} className="text-indigo-500" />
                            </div>
                            <span className="text-[13px] font-semibold text-gray-700">Media & Konteks AI</span>
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                              {showMediaSection ? 'Ditampilkan' : 'Disembunyikan'}
                            </span>
                          </div>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${showMediaSection ? 'bg-indigo-100 text-indigo-500 rotate-180' : 'bg-gray-100 text-gray-400 group-hover/media:bg-indigo-50 group-hover/media:text-indigo-400'}`}>
                            <Icon name="ChevronDown" size={16} />
                          </div>
                        </button>
                        <div className={`overflow-hidden transition-all duration-400 ease-in-out ${showMediaSection ? 'max-h-[3000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/30">
                            <ContextMediaManager scope="package" entityId={editingId} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Invoicing Tab ── */}
                <div className={basicActiveTab === 'invoicing' ? 'block animate-content-reveal animate-content-reveal-1' : 'hidden'}>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 animate-content-reveal animate-content-reveal-2">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-500 flex items-center justify-center shadow-sm border border-indigo-100">
                        <Icon name="Receipt" size={18} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-800">Mode Invoicing & Transaksi</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Pilih bagaimana sistem menangani transaksi dari pelanggan</p>
                      </div>
                    </div>
                    <div className="animate-content-reveal animate-content-reveal-3">
                      <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                        <Icon name="Settings" size={14} className="text-indigo-400" />
                        Metode Pemrosesan
                      </label>
                      <select value={formData.transaction_mode} onChange={(e) => setFormData({ ...formData, transaction_mode: e.target.value })} className="input-modern w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none shadow-sm transition-all">
                        <option value="auto">Otomatis — AI Buat Invoice Langsung</option>
                        <option value="manual">Manual — Kumpulkan Data, Tunggu Konfirmasi</option>
                      </select>
                    </div>
                    {formData.transaction_mode === 'manual' && (
                      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl animate-content-reveal animate-content-reveal-4">
                        <p className="text-sm text-amber-700 flex items-start gap-2">
                          <Icon name="AlertCircle" size={15} className="shrink-0 mt-0.5" />
                          <span>Pesanan masuk sebagai <strong>Menunggu Konfirmasi</strong>. Admin menerbitkan invoice secara manual.</span>
                        </p>
                      </div>
                    )}
                    {formData.transaction_mode === 'auto' && (
                      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50 rounded-2xl animate-content-reveal animate-content-reveal-4">
                        <p className="text-sm text-indigo-600 flex items-start gap-2">
                          <Icon name="Info" size={15} className="shrink-0 mt-0.5" />
                          <span>AI memproses harga dan langsung memberikan link invoice setelah form disubmit.</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Order Form Tab ── */}
                <div className={basicActiveTab === 'order_form' ? 'block animate-content-reveal animate-content-reveal-1' : 'hidden'}>
                  <PackageFormEditor packageId={editingId} initialFields={formData.order_form_fields} onFieldsChange={(f) => setFormData({ ...formData, order_form_fields: f })} />
                </div>

              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                  {isEditing ? (
                    <><Icon name="Shield" size={12} className="text-emerald-400" /> <span>Perubahan akan langsung aktif</span></>
                  ) : (
                    <><Icon name="Shield" size={12} className="text-emerald-400" /> <span>Inventory baru akan langsung tersedia</span></>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || basicMediaAnalyzing || !formData.package_name.trim()}
                    className="btn-save-modern flex-1 sm:flex-none px-7 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-200/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 animate-btn-glow"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{animation: 'spinRing 0.7s linear infinite'}} />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Icon name="Check" size={15} strokeWidth={3} />
                        {isEditing ? 'Simpan Perubahan' : 'Simpan Inventory'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Template Editor Modal */}
      {showInvoiceEditor && (
        <InvoiceTemplateEditor
          initialData={invoiceTemplate}
          onSave={handleSaveInvoiceTemplate}
          onClose={() => setShowInvoiceEditor(false)}
        />
      )}

      {/* Receipt Template Editor Modal */}
      {showReceiptEditor && (
        <ReceiptTemplateEditor
          initialData={receiptTemplate}
          onSave={handleSaveReceiptTemplate}
          onClose={() => setShowReceiptEditor(false)}
        />
      )}


      {/* Date Request Action Modal */}
      {actionReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!actionLoading) { setActionReq(null); setActionReason(''); setActionSuggestDate(''); } }} />
          <div className="relative bg-bg-surface border border-border-base rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col">
            <div className={`p-4 border-b border-bg-subtle flex items-center justify-between ${actionReq.action === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <Icon name={actionReq.action === 'approve' ? 'CheckCircle' : 'XCircle'} size={20} className={actionReq.action === 'approve' ? 'text-green-600' : 'text-red-600'} />
                <h3 className={`font-bold ${actionReq.action === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
                  {actionReq.action === 'approve' ? 'Setujui Request Tanggal' : 'Tolak Request Tanggal'}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {actionReq.action === 'approve' ? (
                <p className="text-sm text-text-body">
                  Anda akan menyetujui request tanggal keberangkatan ini. Kustomer akan segera diinfokan oleh AI untuk melanjutkan proses pemesanan/pembayaran.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-text-heading mb-1.5">
                      Alasan Penolakan <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Contoh: Tanggal tersebut sudah full booked."
                      rows={3}
                      className="w-full px-4 py-2 bg-bg-page border border-border-base rounded-xl text-sm focus:outline-none focus:border-red-500 transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-heading mb-1.5">
                      Saran Tanggal Alternatif <span className="text-text-muted font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="date"
                      value={actionSuggestDate}
                      onChange={(e) => setActionSuggestDate(e.target.value)}
                      className="w-full px-4 py-2 bg-bg-page border border-border-base rounded-xl text-sm focus:outline-none focus:border-indigo-base transition-all"
                    />
                    <p className="text-[10px] text-text-muted mt-1.5">Jika diisi, AI akan menawarkan tanggal ini kepada kustomer.</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-bg-page/50 border-t border-border-base flex justify-end gap-3">
              <button
                onClick={() => { setActionReq(null); setActionReason(''); setActionSuggestDate(''); }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-heading rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleActionRequest}
                disabled={actionLoading || (actionReq.action === 'reject' && !actionReason.trim())}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2 ${
                  actionReq.action === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400' 
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                }`}
              >
                {actionLoading && <Icon name="Loader" size={14} className="animate-spin" />}
                {actionReq.action === 'approve' ? 'Ya, Setujui' : 'Tolak Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TravelBookings;
