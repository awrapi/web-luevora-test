import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const TAG_PRESETS = [
  { label: 'Nama Lengkap', key: 'nama', type: 'text', placeholder: 'Nama lengkap customer' },
  { label: 'Email', key: 'email', type: 'email', placeholder: 'Alamat email customer' },
  { label: 'No. Telepon', key: 'no_telp', type: 'phone', placeholder: 'Nomor WhatsApp/HP' },
  { label: 'Jumlah Orang', key: 'jumlah_orang', type: 'text', placeholder: 'Berapa peserta' },
  { label: 'Tanggal Keberangkatan', key: 'tanggal', type: 'text', placeholder: 'Tanggal trip' },
  { label: 'Request Khusus', key: 'request', type: 'textarea', placeholder: 'Permintaan/catatan khusus', required: false },
  { label: 'Catatan', key: 'catatan', type: 'textarea', placeholder: 'Catatan tambahan', required: false },
];

const PackageFormEditor = ({ packageId, initialFields = [], onFieldsChange }) => {
  const idKey = 'travel_package_id';

  const [formFields, setFormFields] = useState(initialFields);
  const [formFieldsLoading, setFormFieldsLoading] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    field_label: '', field_key: '', field_type: 'text', is_required: 1, placeholder: ''
  });

  useEffect(() => {
    if (packageId) {
      fetchFormFields();
    } else {
      setFormFields(initialFields);
    }
  }, [packageId]);

  const updateFields = (newFields) => {
    setFormFields(newFields);
    if (onFieldsChange) onFieldsChange(newFields);
  };

  const fetchFormFields = async () => {
    if (!packageId) return;
    setFormFieldsLoading(true);
    try {
      const res = await api.get(`/travel/order-form/config?${idKey}=${packageId}`);
      if (res.data.success) {
        updateFields(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching form fields:', err);
    } finally {
      setFormFieldsLoading(false);
    }
  };

  const handleAddTagPreset = (preset) => {
    const alreadyExists = formFields.some(f => f.field_key === preset.key);
    if (alreadyExists) return;
    
    const newField = {
      id: 'temp_' + Date.now(),
      field_key: preset.key,
      field_label: preset.label,
      field_type: preset.type,
      is_required: preset.required !== false ? 1 : 0,
      placeholder: preset.placeholder || '',
      sort_order: formFields.length,
    };
    updateFields([...formFields, newField]);
  };

  const handleDeleteField = (id) => {
    if (!window.confirm('Hapus field ini?')) return;
    updateFields(formFields.filter(f => f.id !== id));
  };

  const handleSaveField = () => {
    if (editingField) {
      updateFields(formFields.map(f => f.id === editingField.id ? { ...f, ...fieldForm } : f));
    } else {
      const newField = { 
        ...fieldForm, 
        id: 'temp_' + Date.now(),
        sort_order: formFields.length 
      };
      updateFields([...formFields, newField]);
    }
    setShowFieldModal(false);
    setEditingField(null);
    setFieldForm({ field_label: '', field_key: '', field_type: 'text', is_required: 1, placeholder: '' });
  };

  const handleMoveField = (idx, dir) => {
    const newFields = [...formFields];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newFields.length) return;
    [newFields[idx], newFields[targetIdx]] = [newFields[targetIdx], newFields[idx]];
    
    // Update sort_order
    const reordered = newFields.map((f, i) => ({ ...f, sort_order: i }));
    updateFields(reordered);
  };

  const openNewFieldModal = () => {
    setEditingField(null);
    setFieldForm({ field_label: '', field_key: '', field_type: 'text', is_required: 1, placeholder: '' });
    setShowAdvanced(false);
    setShowPlaceholder(false);
    setShowFieldModal(true);
  };

  const openEditField = (field) => {
    setEditingField(field);
    setFieldForm({
      field_label: field.field_label,
      field_key: field.field_key,
      field_type: field.field_type,
      is_required: field.is_required,
      placeholder: field.placeholder || '',
    });
    setShowAdvanced(false);
    setShowPlaceholder(!!field.placeholder);
    setShowFieldModal(true);
  };

  const unusedPresets = TAG_PRESETS.filter(p => !formFields.some(f => f.field_key === p.key));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm min-h-[500px] flex flex-col">
      {/* Header Section */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-sm border border-violet-200">
            <Icon name="ListChecks" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Form Pesanan AI</h3>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Atur data pelanggan yang wajib ditanyakan oleh AI.</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-violet-50 text-violet-700 font-bold text-xs rounded-lg border border-violet-100 shadow-sm">
          {formFields.length} Field
        </div>
      </div>

      <div className="p-5 bg-gray-50/30">
        {/* Field list or Empty State */}
        {formFieldsLoading ? (
          <div className="flex justify-center py-10">
            <Icon name="Loader2" size={28} className="animate-spin text-violet-500" />
          </div>
        ) : formFields.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border-2 border-dashed border-gray-200 shadow-sm">
            <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3 text-violet-500">
              <Icon name="PlusCircle" size={24} />
            </div>
            <h4 className="font-bold text-gray-700 text-sm mb-1">Mulai Buat Form Baru</h4>
            <p className="text-xs text-gray-500 max-w-[250px] mx-auto mb-5 leading-relaxed">
              Tentukan data apa saja yang perlu ditanyakan AI kepada pelanggan saat memesan paket ini.
            </p>
            <button
              type="button"
              onClick={openNewFieldModal}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs shadow-md shadow-violet-200 transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <Icon name="Plus" size={14} /> Buat Field Kustom
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {formFields.map((field, idx) => (
              <div key={field.id} className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-violet-300 hover:shadow-md transition-all relative">
                {/* Drag Handles */}
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => handleMoveField(idx, -1)} disabled={idx === 0}
                    className="p-0.5 rounded text-gray-300 hover:text-violet-600 disabled:opacity-20 transition-colors">
                    <Icon name="ChevronUp" size={14} />
                  </button>
                  <button type="button" onClick={() => handleMoveField(idx, 1)} disabled={idx === formFields.length - 1}
                    className="p-0.5 rounded text-gray-300 hover:text-violet-600 disabled:opacity-20 transition-colors">
                    <Icon name="ChevronDown" size={14} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 ml-1">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800 text-[13px]">{field.field_label}</span>
                      {field.is_required === 1 ? (
                        <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-md border border-red-100 uppercase tracking-wider">Wajib</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-md border border-gray-200 uppercase tracking-wider">Opsional</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                      <span className="flex items-center gap-1"><Icon name="Key" size={10} /> {field.field_key}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                      <span className="flex items-center gap-1 uppercase"><Icon name="Type" size={10} /> {field.field_type}</span>
                    </div>
                  </div>
                  
                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-1/2 -translate-y-1/2">
                    <button type="button" onClick={() => openEditField(field)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                      title="Edit Field">
                      <Icon name="Edit3" size={14} />
                    </button>
                    <button type="button" onClick={() => handleDeleteField(field.id)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                      title="Hapus Field">
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={openNewFieldModal}
              className="w-full py-3 mt-1 border-2 border-dashed border-gray-200 hover:border-violet-400 hover:bg-violet-50/50 text-gray-500 hover:text-violet-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Icon name="Plus" size={16} /> Tambah Field Kustom
            </button>
          </div>
        )}

        {/* Quick Suggestions - separated neatly at the bottom */}
        {unusedPresets.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-200 border-dashed">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="Zap" size={12} className="text-yellow-500" /> Rekomendasi Field
            </p>
            <div className="flex flex-wrap gap-2">
              {unusedPresets.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleAddTagPreset(preset)}
                  className="px-3 py-1.5 bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="Plus" size={12} className="text-gray-400 group-hover:text-violet-500" /> {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FIELD MODAL - Rendered via Portal to appear outside parent modals */}
      {showFieldModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowFieldModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center border border-violet-200 shadow-sm">
                  <Icon name="Settings" size={14} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{editingField ? 'Edit Field' : 'Tambah Field Kustom'}</h3>
                  <p className="text-[10px] text-gray-500">Atur properti pertanyaan AI</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowFieldModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5">Label (Pertanyaan) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={fieldForm.field_label}
                  onChange={e => {
                    const label = e.target.value;
                    let key = fieldForm.field_key;
                    if (!editingField) key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    setFieldForm({ ...fieldForm, field_label: label, field_key: key });
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 shadow-sm transition-all"
                  placeholder="Contoh: Titik Penjemputan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1.5">Tipe Input</label>
                  <select
                    value={fieldForm.field_type}
                    onChange={e => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 shadow-sm"
                  >
                    <option value="text">Teks Pendek</option>
                    <option value="textarea">Teks Panjang</option>
                    <option value="number">Angka</option>
                    <option value="email">Email</option>
                    <option value="phone">No. Telp</option>
                    <option value="date">Tanggal</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-50 hover:border-violet-200 transition-colors shadow-sm">
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${fieldForm.is_required === 1 ? 'bg-violet-600 border-violet-600' : 'bg-gray-100 border-gray-300'}`}>
                      {fieldForm.is_required === 1 && <Icon name="Check" size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-[11px] font-bold text-gray-700">Wajib Diisi</span>
                    <input
                      type="checkbox"
                      checked={fieldForm.is_required === 1}
                      onChange={e => setFieldForm({ ...fieldForm, is_required: e.target.checked ? 1 : 0 })}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Placeholder Toggle */}
              {!showPlaceholder ? (
                <div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowPlaceholder(true);
                      if (!fieldForm.placeholder && fieldForm.field_label) {
                        setFieldForm({ ...fieldForm, placeholder: `Contoh: Masukkan ${fieldForm.field_label.toLowerCase()}` });
                      }
                    }}
                    className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Icon name="PlusCircle" size={14} /> Tambahkan contoh pengisian (opsional)
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-gray-700">Placeholder / Hint <span className="text-gray-400 font-normal">(Opsional)</span></label>
                    <button type="button" onClick={() => { setShowPlaceholder(false); setFieldForm({ ...fieldForm, placeholder: '' }); }} className="text-[10px] text-red-500 hover:text-red-600 font-bold">Hapus</button>
                  </div>
                  <input
                    type="text"
                    value={fieldForm.placeholder}
                    onChange={e => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 shadow-sm transition-all"
                    placeholder="Contoh: Masukkan stasiun / bandara"
                    autoFocus
                  />
                  <p className="text-[9px] text-gray-400 mt-1.5 leading-relaxed">Hint akan dibaca AI sebagai referensi/contoh pengisian dari pelanggan.</p>
                </div>
              )}

              {/* Advanced Settings Toggle */}
              <div className="pt-2 border-t border-gray-100 border-dashed">
                <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-[11px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5"><Icon name="Settings" size={12} /> Pengaturan Lanjutan</span>
                  <Icon name={showAdvanced ? "ChevronUp" : "ChevronDown"} size={14} />
                </button>
                
                {showAdvanced && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="flex items-center justify-between block text-[11px] font-bold text-gray-700 mb-1.5">
                      <span>Field Key <span className="text-red-500">*</span></span>
                      <span className="text-[9px] text-gray-400 font-normal">Identitas Unik AI</span>
                    </label>
                    <input
                      type="text"
                      value={fieldForm.field_key}
                      onChange={e => setFieldForm({ ...fieldForm, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 font-mono text-gray-600 shadow-sm transition-all"
                      placeholder="contoh: titik_jemput"
                      disabled={!!editingField}
                    />
                    <p className="text-[9px] text-gray-500 mt-1.5 leading-relaxed">Otomatis terisi dari label. Hanya ubah jika Anda paham kebutuhan integrasi.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFieldModal(false)}
                className="px-4 py-2 font-bold text-xs text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                disabled={!fieldForm.field_label.trim() || !fieldForm.field_key.trim()}
                className="px-5 py-2 font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md shadow-violet-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Icon name="Save" size={14} /> Simpan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PackageFormEditor;
