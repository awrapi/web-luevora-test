import React, { useState, useEffect } from 'react';
import Icon from '@/components/shared/Icon';

const ContextSuggestionModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialContexts, 
  title = "Saran Pengelompokan Konteks AI" 
}) => {
  const [contexts, setContexts] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (isOpen && initialContexts) {
      setContexts(JSON.parse(JSON.stringify(initialContexts)));
    }
  }, [isOpen, initialContexts]);

  if (!isOpen) return null;

  const handleDragStart = (e, ctxIndex, fileIndex) => {
    setDraggedItem({ ctxIndex, fileIndex });
    // setTimeout to make sure the original item doesn't disappear immediately
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e, targetCtxIndex) => {
    e.preventDefault();
    if (!draggedItem) return;

    const { ctxIndex: sourceCtxIndex, fileIndex: sourceFileIndex } = draggedItem;

    if (sourceCtxIndex === targetCtxIndex) return; // Dropped in the same context

    const newContexts = [...contexts];
    const itemToMove = newContexts[sourceCtxIndex].files[sourceFileIndex];

    // Remove from source
    newContexts[sourceCtxIndex].files.splice(sourceFileIndex, 1);
    
    // Add to target
    newContexts[targetCtxIndex].files.push(itemToMove);

    setContexts(newContexts);
  };

  const handleContextChange = (index, field, value) => {
    const newContexts = [...contexts];
    newContexts[index][field] = value;
    setContexts(newContexts);
  };

  const handleFileChange = (ctxIndex, fileIndex, field, value) => {
    const newContexts = [...contexts];
    newContexts[ctxIndex].files[fileIndex][field] = value;
    setContexts(newContexts);
  };

  const addContext = () => {
    setContexts([...contexts, { contextLabel: 'Grup Baru', aiSummary: '', files: [] }]);
  };

  const removeContext = (index) => {
    if (contexts.length === 1) return alert("Minimal harus ada satu grup konteks.");
    if (contexts[index].files.length > 0) return alert("Kosongkan file di grup ini terlebih dahulu sebelum menghapus.");
    const newContexts = [...contexts];
    newContexts.splice(index, 1);
    setContexts(newContexts);
  };

  const handleSave = () => {
    // Validate empty contexts
    const emptyContexts = contexts.filter(c => c.files.length === 0);
    if (emptyContexts.length > 0) {
      if (!window.confirm("Ada grup yang tidak memiliki file. Grup kosong ini akan dihapus. Lanjutkan?")) return;
    }
    const cleanContexts = contexts.filter(c => c.files.length > 0);
    onSave(cleanContexts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Icon name="BrainCircuit" size={20} className="text-indigo-600" />
              {title}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              AI telah mengelompokkan file Anda berdasarkan kemiripan konteks. Anda dapat menarik dan melepas (Drag & Drop) file untuk memindahkannya antar grup.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
          >
            <Icon name="X" size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          <div className="flex flex-col gap-6">
            {contexts.map((ctx, ctxIndex) => (
              <div 
                key={ctxIndex} 
                className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, ctxIndex)}
              >
                <div className="p-4 bg-indigo-50/30 border-b border-indigo-50 flex gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nama Grup (Konteks)</label>
                      <input 
                        type="text" 
                        value={ctx.contextLabel || ''} 
                        onChange={(e) => handleContextChange(ctxIndex, 'contextLabel', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Contoh: Brosur & Transportasi"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ringkasan Grup (AI Summary)</label>
                      <textarea 
                        value={ctx.aiSummary || ''} 
                        onChange={(e) => handleContextChange(ctxIndex, 'aiSummary', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none h-16"
                        placeholder="Ringkasan tentang apa isi grup ini..."
                      />
                    </div>
                  </div>
                  <div className="flex items-start">
                    <button 
                      onClick={() => removeContext(ctxIndex)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Hapus Grup"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                </div>

                <div 
                  className={`p-4 min-h-[100px] ${ctx.files.length === 0 ? 'flex items-center justify-center border-2 border-dashed border-gray-200 m-4 rounded-lg bg-gray-50' : ''}`}
                >
                  {ctx.files.length === 0 ? (
                    <span className="text-sm text-gray-400">Tarik file ke sini</span>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ctx.files.map((file, fileIndex) => (
                        <div 
                          key={file.tempId || file.originalName || fileIndex}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ctxIndex, fileIndex)}
                          onDragEnd={handleDragEnd}
                          className="flex items-start gap-3 p-3 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all rounded-lg cursor-grab active:cursor-grabbing"
                        >
                          <div className="w-10 h-10 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                            <Icon name="FileText" size={18} className="text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate mb-1" title={file.originalName}>
                              {file.originalName}
                            </p>
                            <input 
                              type="text" 
                              value={file.subTitle || ''} 
                              onChange={(e) => handleFileChange(ctxIndex, fileIndex, 'subTitle', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-indigo-400 mb-1"
                              placeholder="Judul File"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <textarea 
                              value={file.subSummary || ''} 
                              onChange={(e) => handleFileChange(ctxIndex, fileIndex, 'subSummary', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-indigo-400 resize-none h-12"
                              placeholder="Deskripsi File..."
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="shrink-0 flex items-center h-full text-gray-300">
                            <Icon name="GripVertical" size={16} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={addContext}
            className="mt-6 w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <Icon name="Plus" size={16} />
            Tambah Grup Konteks Baru
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Icon name="Check" size={16} />
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextSuggestionModal;
