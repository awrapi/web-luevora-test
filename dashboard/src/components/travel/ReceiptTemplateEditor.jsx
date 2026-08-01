import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { ChromePicker } from 'react-color';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const SNAP_THRESHOLD = 20;

const CANVAS_SIZES = [
  { id: 'a4', label: 'A4 (794 x 1123)', width: 794, height: 1123 },
  { id: 'a5', label: 'A5 (559 x 794)', width: 559, height: 794 },
  { id: 'letter', label: 'Letter (816 x 1056)', width: 816, height: 1056 },
  { id: 'legal', label: 'Legal (816 x 1344)', width: 816, height: 1344 },
  { id: 'thermal_80', label: 'Thermal 80mm (302 x 800)', width: 302, height: 800 },
];

// Default elements for Receipt
const defaultElements = [
  { id: 'doc_title', type: 'text', text: 'KUITANSI (RECEIPT)', x: 50, y: 50, width: 350, height: 50, color: '#1a1a1a', fontSize: 36, fontWeight: 'bold', editable: true, align: 'left' },
  { id: 'receipt_no', type: 'dynamic', text: 'No: {{NOMOR_INVOICE}}', x: 494, y: 50, width: 250, height: 30, color: '#333333', fontSize: 14, fontWeight: 'bold', editable: false, align: 'right' },
  { id: 'seller_id', type: 'text', text: 'Nama Bisnis Anda\nAlamat\nTelepon', x: 50, y: 120, width: 300, height: 80, color: '#666666', fontSize: 14, fontWeight: 'normal', editable: true, align: 'left' },
  { id: 'dates', type: 'dynamic', text: 'Tanggal Lunas: {{TANGGAL_TERBIT}}', x: 494, y: 120, width: 250, height: 30, color: '#666666', fontSize: 14, fontWeight: 'normal', editable: false, align: 'right' },
  { id: 'buyer_id', type: 'dynamic', text: 'Telah Terima Dari:\n{{NAMA_PEMBELI}}\n{{NO_HP_PEMBELI}}', x: 50, y: 220, width: 300, height: 80, color: '#333333', fontSize: 14, fontWeight: 'normal', editable: false, align: 'left' },
  { id: 'packages', type: 'dynamic', text: 'Untuk Pembayaran:\n{{RINCIAN_PAKET}}', x: 50, y: 340, width: 694, height: 100, color: '#333333', fontSize: 14, fontWeight: 'normal', editable: false, align: 'left' },
  { id: 'costs', type: 'dynamic', text: 'Sejumlah: {{TOTAL_BIAYA}}', x: 50, y: 460, width: 694, height: 50, color: '#1a1a1a', fontSize: 18, fontWeight: 'bold', editable: false, align: 'right' },
  { id: 'stamp_paid', type: 'text', text: 'LUNAS / PAID', x: 50, y: 460, width: 250, height: 50, color: '#16a34a', fontSize: 28, fontWeight: 'bold', editable: true, align: 'center', rotation: -15, opacity: 80, borderRadius: 10, backgroundColor: '#dcfce7' },
];

const ReceiptTemplateEditor = ({ initialData, onSave, onClose }) => {
  const [elements, setElements] = useState([]);
  const [canvasColor, setCanvasColor] = useState('#ffffff');
  const [canvasWidth, setCanvasWidth] = useState(794);
  const [canvasHeight, setCanvasHeight] = useState(1123);
  const [customW, setCustomW] = useState(794);
  const [customH, setCustomH] = useState(1123);
  const [modelName, setModelName] = useState('Receipt Default');
  const [selectedId, setSelectedId] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewElements, setPreviewElements] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const headerFileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

  useEffect(() => {
    if (initialData && initialData.items && initialData.items.length > 0) {
      setElements(initialData.items);
      setCanvasColor(initialData.canvasColor || '#ffffff');
      setModelName(initialData.name || 'Receipt Default');
      setCanvasWidth(initialData.canvasWidth || 794);
      setCanvasHeight(initialData.canvasHeight || 1123);
    } else {
      setElements(defaultElements);
      setCanvasColor('#ffffff');
      setModelName('Receipt Default');
      setCanvasWidth(794);
      setCanvasHeight(1123);
    }
  }, [initialData]);

  useEffect(() => {
    setCustomW(canvasWidth);
    setCustomH(canvasHeight);
  }, [canvasWidth, canvasHeight]);

  const handleSizeChange = (newWidth, newHeight) => {
    if (!newWidth || !newHeight || newWidth < 100 || newHeight < 100) {
      alert("Ukuran minimal adalah 100x100");
      return;
    }
    
    const scaleX = newWidth / canvasWidth;
    const scaleY = newHeight / canvasHeight;

    setElements(elements.map(el => ({
      ...el,
      x: el.x * scaleX,
      y: el.y * scaleY,
      width: Math.max(20, el.width * scaleX),
      height: Math.max(20, el.height * scaleY),
      fontSize: el.fontSize ? Math.max(8, Math.round(el.fontSize * Math.min(scaleX, scaleY))) : undefined
    })));
    
    setCanvasWidth(newWidth);
    setCanvasHeight(newHeight);
  };

  // Load uploaded images on mount
  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await api.get('/travel/invoices/uploads');
      if (res.data.status) setUploadedImages(res.data.data);
    } catch (err) { console.error('Failed to fetch images', err); }
  };

  const handleImageUpload = async (file, addToCanvas = false) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/travel/invoices/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.status) {
        await fetchImages();
        if (addToCanvas) addImageToCanvas(res.data.data.url);
      }
    } catch (err) {
      alert('Gagal upload gambar: ' + (err.response?.data?.message || err.message));
    } finally { setIsUploading(false); }
  };

  const handleDeleteImage = async (filename) => {
    if (!window.confirm('Hapus gambar ini dari server?')) return;
    try {
      await api.delete(`/travel/invoices/uploads/${filename}`);
      setUploadedImages(prev => prev.filter(img => img.filename !== filename));
      // Also remove from canvas if used
      setElements(prev => prev.filter(el => !(el.type === 'image' && el.imageUrl?.includes(filename))));
    } catch (err) { alert('Gagal menghapus gambar'); }
  };

  const addImageToCanvas = (imageUrl) => {
    const newEl = {
      id: `image_${Date.now()}`,
      type: 'image',
      imageUrl: imageUrl,
      x: canvasWidth / 2 - 100,
      y: canvasHeight / 2 - 75,
      width: 200,
      height: 150,
      objectFit: 'cover',
      borderRadius: 0,
      rotation: 0,
      opacity: 100,
      zIndex: 1,
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  const handleDragStop = (id, d) => {
    let newX = d.x;
    const el = elements.find(e => e.id === id);
    const w = el.width;

    // Magnetic Snapping Logic
    const leftSnap = 0;
    const centerSnap = (canvasWidth / 2) - (w / 2);
    const rightSnap = canvasWidth - w;

    if (Math.abs(newX - leftSnap) < SNAP_THRESHOLD) newX = leftSnap;
    else if (Math.abs(newX - centerSnap) < SNAP_THRESHOLD) newX = centerSnap;
    else if (Math.abs(newX - rightSnap) < SNAP_THRESHOLD) newX = rightSnap;

    setElements(elements.map(e => e.id === id ? { ...e, x: newX, y: d.y } : e));
  };

  const handleReset = () => {
    if (window.confirm("Yakin ingin mengembalikan ke desain bawaan (default)? Desain Anda saat ini akan hilang.")) {
      setElements(defaultElements);
      setCanvasColor('#ffffff');
    }
  };

  const handleAddElement = (type) => {
    const isShape = type === 'shape_rect' || type === 'shape_circle';
    const isAi = type === 'ai_space';
    
    const newEl = {
      id: `${type}_${Date.now()}`,
      type: type,
      text: type === 'text' ? 'Teks Baru' : isAi ? 'Area khusus AI' : '',
      x: canvasWidth / 2 - 75,
      y: canvasHeight / 2 - 25,
      width: type === 'shape_circle' ? 100 : 150,
      height: type === 'shape_circle' ? 100 : 50,
      color: isShape ? 'transparent' : '#333333',
      backgroundColor: isShape ? '#e5e7eb' : 'transparent',
      fontSize: 14,
      fontWeight: 'normal',
      editable: type === 'text',
      align: 'center',
      rotation: 0,
      opacity: 100,
      aiPrompt: isAi ? 'Isi dengan rincian singkat' : ''
    };
    
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleResizeStop = (id, ref, position) => {
    setElements(elements.map(e => e.id === id ? { 
      ...e, 
      width: parseInt(ref.style.width), 
      height: parseInt(ref.style.height),
      x: position.x,
      y: position.y
    } : e));
  };

  const updateSelected = (key, value) => {
    if (!selectedId) return;
    setElements(elements.map(e => e.id === selectedId ? { ...e, [key]: value } : e));
  };

  const handleZIndex = (action) => {
    if (!selectedId) return;
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const allZIndexes = elements.map(e => e.zIndex || 1);
    const maxZ = Math.max(...allZIndexes, 1);
    const minZ = Math.min(...allZIndexes, 1);
    const currentZ = el.zIndex || 1;
    let newZ = currentZ;

    if (action === 'front') newZ = maxZ + 1;
    else if (action === 'back') newZ = minZ - 1;
    else if (action === 'forward') newZ = currentZ + 1;
    else if (action === 'backward') newZ = currentZ - 1;

    updateSelected('zIndex', newZ);
  };

  const handleTogglePreview = async () => {
    if (isPreviewMode) {
      setIsPreviewMode(false);
      return;
    }

    setIsLoadingPreview(true);
    try {
      const response = await api.post('/travel/invoices/preview', { items: elements, canvasColor, canvasWidth, canvasHeight });

      if (response.data.status) {
        setPreviewElements(response.data.data);
        setIsPreviewMode(true);
        setSelectedId(null);
      } else {
        alert('Gagal memuat preview: ' + response.data.message);
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat memuat preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const selectedElement = elements.find(e => e.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 bg-bg-page flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-border-base bg-bg-surface flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-bg-page rounded-xl text-text-muted transition-colors">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div>
            <input 
              type="text" 
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="font-bold text-text-heading text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-base focus:outline-none transition-colors px-1"
              placeholder="Nama Model Receipt"
            />
            <p className="text-xs text-text-muted px-1 mt-0.5">Desain posisi dan warna elemen kuitansi Anda.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={isPreviewMode} onClick={() => handleAddElement('text')} className="disabled:opacity-50 bg-bg-page hover:bg-gray-100 border border-border-base text-text-heading px-3 py-2 rounded-lg text-xs font-medium transition-all" title="Tambah Teks">+ Teks</button>
          <button disabled={isPreviewMode} onClick={() => handleAddElement('shape_rect')} className="disabled:opacity-50 bg-bg-page hover:bg-gray-100 border border-border-base text-text-heading px-3 py-2 rounded-lg text-xs font-medium transition-all" title="Tambah Kotak">+ Kotak</button>
          <button disabled={isPreviewMode} onClick={() => handleAddElement('shape_circle')} className="disabled:opacity-50 bg-bg-page hover:bg-gray-100 border border-border-base text-text-heading px-3 py-2 rounded-lg text-xs font-medium transition-all" title="Tambah Lingkaran">+ Lingkaran</button>
          <button disabled={isPreviewMode} onClick={() => handleAddElement('ai_space')} className="disabled:opacity-50 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="Tambah Ruang Dinamis AI">
            <Icon name="Sparkles" size={14} /> AI Space
          </button>
          <button disabled={isPreviewMode || isUploading} onClick={() => headerFileInputRef.current?.click()} className="disabled:opacity-50 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1" title="Upload & Tambah Gambar">
            <Icon name={isUploading ? "Loader2" : "ImagePlus"} size={14} className={isUploading ? "animate-spin" : ""} /> {isUploading ? 'Uploading...' : '+ Gambar'}
          </button>
          <input ref={headerFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) { handleImageUpload(e.target.files[0], true); e.target.value=''; } }} />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleTogglePreview}
            disabled={isLoadingPreview}
            className={`${isPreviewMode ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-text-heading border-border-base'} hover:bg-gray-50 border px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2`}
          >
            {isLoadingPreview ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name={isPreviewMode ? 'X' : 'Eye'} size={16} />}
            {isPreviewMode ? 'Tutup Preview' : 'Preview Mode'}
          </button>
          {!isPreviewMode && (
            <button 
              onClick={handleReset}
              className="bg-white hover:bg-gray-50 border border-border-base text-text-heading px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              Reset Default
            </button>
          )}
          <button 
            onClick={() => onSave({ name: modelName, items: elements, canvasColor, canvasWidth, canvasHeight })}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <Icon name="Save" size={16} />
            Simpan Model
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 bg-bg-page/50 overflow-auto p-8 flex justify-center items-start" onClick={() => setSelectedId(null)}>
          {/* Canvas Container */}
          <div className="shrink-0" style={{ width: `${canvasWidth * 0.8}px`, height: `${canvasHeight * 0.8}px` }}>
            <div 
              ref={canvasRef}
              className="relative shadow-xl origin-top-left overflow-hidden"
              style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: 'scale(0.8)', backgroundColor: canvasColor }}
              onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}
            >
              {/* Center Guide Line for debugging/visual */}
              {!isPreviewMode && <div className="absolute top-0 bottom-0 left-1/2 w-px bg-blue-100 border-dashed border-l-2 opacity-50 pointer-events-none"></div>}

            {(isPreviewMode ? previewElements : elements).map((el) => (
              <Rnd
                key={el.id}
                size={{ width: el.width, height: el.height }}
                position={{ x: el.x, y: el.y }}
                onDragStop={(e, d) => handleDragStop(el.id, d)}
                onResizeStop={(e, direction, ref, delta, position) => handleResizeStop(el.id, ref, position)}
                bounds="parent"
                disableDragging={isPreviewMode}
                enableResizing={!isPreviewMode}
                onClick={(e) => { e.stopPropagation(); if(!isPreviewMode) setSelectedId(el.id); }}
                className={`${!isPreviewMode ? 'border-2' : ''} ${selectedId === el.id ? 'border-green-500' : 'border-transparent hover:border-gray-200'} transition-colors ${!isPreviewMode ? 'cursor-move' : ''} flex flex-col justify-center`}
                style={{ zIndex: el.zIndex || 1 }}
                scale={0.8}
              >
                <div 
                  style={{ 
                    color: el.color, 
                    backgroundColor: el.type === 'image' ? 'transparent' : (el.backgroundColor || 'transparent'),
                    fontSize: `${el.fontSize}px`, 
                    fontWeight: el.fontWeight,
                    textAlign: el.align,
                    whiteSpace: 'pre-wrap',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: el.type === 'image' ? 'center' : 'flex-start',
                    alignItems: el.type === 'image' ? 'center' : undefined,
                    transform: `rotate(${el.rotation || 0}deg)`,
                    borderRadius: el.type === 'shape_circle' ? '50%' : (el.type === 'image' ? `${el.borderRadius || 0}px` : '0'),
                    border: (el.type === 'ai_space' && !isPreviewMode) ? '2px dashed #8b5cf6' : 'none',
                    opacity: (el.type === 'ai_space' && !isPreviewMode) ? 0.8 : ((el.opacity ?? 100) / 100),
                    overflow: 'hidden',
                  }}
                  className={`w-full h-full ${el.type === 'image' ? '' : 'p-2'} outline-none overflow-hidden relative ${el.type === 'ai_space' && isPreviewMode ? 'bg-transparent text-text-heading' : ''}`}
                >
                  {el.type === 'ai_space' && !isPreviewMode && <span className="absolute top-1 left-1 text-[10px] font-bold text-purple-600 bg-white/80 px-1 rounded shadow-sm z-10 pointer-events-none">AI Space</span>}
                  {el.type === 'image' ? (
                    <img 
                      src={`${API_BASE}${el.imageUrl}`} 
                      alt="" 
                      draggable={false}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: el.objectFit || 'cover',
                        borderRadius: `${el.borderRadius || 0}px`,
                        pointerEvents: 'none',
                      }} 
                    />
                  ) : (
                    el.type !== 'shape_rect' && el.type !== 'shape_circle' && (isPreviewMode && el.type === 'dynamic' ? <span dangerouslySetInnerHTML={{ __html: el.text }}></span> : el.text)
                  )}
                </div>
              </Rnd>
            ))}
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="w-80 border-l border-border-base bg-bg-surface shrink-0 overflow-y-auto p-6 relative">
          {isPreviewMode && (
            <div className="absolute inset-0 bg-bg-surface/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
              <Icon name="Eye" size={32} className="text-green-600 mb-4" />
              <h3 className="font-bold text-lg text-text-heading mb-2">Mode Preview Aktif</h3>
              <p className="text-sm text-text-muted">Desain dikunci dan AI sedang mengisi data. Tutup preview untuk kembali mengedit.</p>
            </div>
          )}
          
          <h3 className="font-bold text-text-heading mb-6 border-b border-border-base pb-4">Pengaturan Elemen</h3>
          
          {selectedElement ? (
            <div className="space-y-6">
              <div className="p-3 bg-green-50/50 rounded-xl border border-green-100">
                <span className="text-xs font-bold text-green-700 uppercase tracking-wider block mb-1">Terpilih:</span>
                <span className="text-sm font-medium text-text-heading">{selectedElement.id.replace('_', ' ').toUpperCase()}</span>
                {selectedElement.type === 'dynamic' && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Dynamic AI</span>
                )}
              </div>

              {(selectedElement.type === 'text' || selectedElement.type === 'ai_space') && selectedElement.editable && (
                <div>
                  <label className="block text-sm font-bold text-text-heading mb-2">Teks</label>
                  <textarea 
                    value={selectedElement.text}
                    onChange={(e) => updateSelected('text', e.target.value)}
                    className="w-full p-3 bg-bg-page border border-border-base rounded-xl text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 outline-none resize-none"
                    rows={2}
                  />
                </div>
              )}

              {selectedElement.type === 'ai_space' && (
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <label className="block text-sm font-bold text-purple-800 mb-2">Prompt Instruksi AI</label>
                  <textarea 
                    value={selectedElement.aiPrompt || ''}
                    onChange={(e) => updateSelected('aiPrompt', e.target.value)}
                    placeholder="Contoh: Buatkan ucapan terima kasih singkat."
                    className="w-full p-3 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none resize-none"
                    rows={3}
                  />
                  <p className="text-[10px] text-purple-600 mt-2 font-medium">
                    Estimasi ruang: ±{Math.floor((selectedElement.width * selectedElement.height) / (selectedElement.fontSize * selectedElement.fontSize * 0.5))} karakter. Jika teks AI terlalu panjang, teks akan terpotong (clipped).
                  </p>
                </div>
              )}

              {selectedElement.type === 'image' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-text-heading mb-2">Mode Gambar (Object Fit)</label>
                    <select
                      value={selectedElement.objectFit || 'cover'}
                      onChange={(e) => updateSelected('objectFit', e.target.value)}
                      className="w-full p-2.5 bg-bg-page border border-border-base rounded-xl text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                    >
                      <option value="cover">Cover (Isi Penuh)</option>
                      <option value="contain">Contain (Muat Semua)</option>
                      <option value="fill">Fill (Regangkan)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-heading mb-2 flex justify-between">
                      <span>Border Radius</span>
                      <span className="text-green-600">{selectedElement.borderRadius || 0}px</span>
                    </label>
                    <input
                      type="range" min="0" max="100"
                      value={selectedElement.borderRadius || 0}
                      onChange={(e) => updateSelected('borderRadius', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {selectedElement.type !== 'image' && (
              <div>
                <label className="block text-sm font-bold text-text-heading mb-2">
                  {(selectedElement.type === 'shape_rect' || selectedElement.type === 'shape_circle') ? 'Warna Bentuk (Fill)' : 'Warna Teks'}
                </label>
                <div className="mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-border-base" style={{ backgroundColor: selectedElement.type.startsWith('shape') ? selectedElement.backgroundColor : selectedElement.color }}></div>
                  <span className="text-sm font-mono text-text-muted">{selectedElement.type.startsWith('shape') ? selectedElement.backgroundColor : selectedElement.color}</span>
                </div>
                <div className="custom-color-picker w-full flex justify-center">
                   <ChromePicker 
                    color={selectedElement.type.startsWith('shape') ? (selectedElement.backgroundColor || '#000000') : selectedElement.color}
                    onChange={(color) => updateSelected(selectedElement.type.startsWith('shape') ? 'backgroundColor' : 'color', color.hex)}
                    disableAlpha={true}
                    width="100%"
                  />
                </div>
              </div>
              )}

              <div>
                <label className="block text-sm font-bold text-text-heading mb-2 flex justify-between">
                  <span>Rotasi Sudut</span>
                  <span className="text-green-600">{selectedElement.rotation || 0}°</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={selectedElement.rotation || 0}
                  onChange={(e) => updateSelected('rotation', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text-heading mb-2 flex justify-between">
                  <span>Transparansi (Opacity)</span>
                  <span className="text-green-600">{selectedElement.opacity ?? 100}%</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={selectedElement.opacity ?? 100}
                  onChange={(e) => updateSelected('opacity', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text-heading mb-2">Tumpukan (Z-Index)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleZIndex('backward')} className="bg-bg-page hover:bg-gray-50 border border-border-base text-xs font-medium py-2 rounded-lg transition-colors">
                    Mundurkan
                  </button>
                  <button onClick={() => handleZIndex('forward')} className="bg-bg-page hover:bg-gray-50 border border-border-base text-xs font-medium py-2 rounded-lg transition-colors">
                    Majukan
                  </button>
                  <button onClick={() => handleZIndex('back')} className="bg-bg-page hover:bg-gray-50 border border-border-base text-xs font-medium py-2 rounded-lg transition-colors">
                    Paling Belakang
                  </button>
                  <button onClick={() => handleZIndex('front')} className="bg-bg-page hover:bg-gray-50 border border-border-base text-xs font-medium py-2 rounded-lg transition-colors">
                    Paling Depan
                  </button>
                </div>
              </div>

              {!selectedElement.type.startsWith('shape') && selectedElement.type !== 'image' && (
                <>
                  <div>
                <label className="block text-sm font-bold text-text-heading mb-2">Ukuran Font: {selectedElement.fontSize}px</label>
                <input 
                  type="range" 
                  min="10" 
                  max="64" 
                  value={selectedElement.fontSize}
                  onChange={(e) => updateSelected('fontSize', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text-heading mb-2">Ketebalan Font</label>
                <select 
                  value={selectedElement.fontWeight}
                  onChange={(e) => updateSelected('fontWeight', e.target.value)}
                  className="w-full p-2.5 bg-bg-page border border-border-base rounded-xl text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-text-heading mb-2">Perataan Teks (Alignment)</label>
                <div className="flex gap-2">
                  {['left', 'center', 'right'].map(align => (
                    <button
                      key={align}
                      onClick={() => updateSelected('align', align)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${selectedElement.align === align ? 'bg-green-50 text-green-700 border-green-200' : 'bg-bg-page text-text-muted border-border-base hover:bg-gray-50'}`}
                    >
                      {align.charAt(0).toUpperCase() + align.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              </>
              )}

              {!['doc_title', 'receipt_no', 'seller_id', 'dates', 'buyer_id', 'packages', 'costs', 'stamp_paid'].includes(selectedElement.id) && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border-base">
                  <button
                    onClick={() => setElements(elements.filter(e => e.id !== selectedId))}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-colors"
                  >
                    Hapus Elemen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center text-center text-text-muted bg-bg-page rounded-xl border border-dashed border-border-base p-6">
                <Icon name="MousePointerClick" size={32} className="mb-3 opacity-50" />
                <p className="text-sm">Klik elemen pada kanvas di sebelah kiri untuk mengubah pengaturannya.</p>
              </div>

              <div className="pt-4 border-t border-border-base">
                <label className="block text-sm font-bold text-text-heading mb-2">Ukuran Kanvas</label>
                <select
                  value={CANVAS_SIZES.find(s => s.width === canvasWidth && s.height === canvasHeight) ? `${canvasWidth}x${canvasHeight}` : "custom"}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      const [w, h] = e.target.value.split('x').map(Number);
                      handleSizeChange(w, h);
                    }
                  }}
                  className="w-full p-2.5 bg-bg-page border border-border-base rounded-xl text-sm focus:ring-2 focus:ring-green-500/30 outline-none mb-3"
                >
                  {CANVAS_SIZES.map(size => (
                    <option key={size.id} value={`${size.width}x${size.height}`}>
                      {size.label}
                    </option>
                  ))}
                  <option value="custom">Ukuran Custom...</option>
                </select>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Lebar (px)</label>
                    <input 
                      type="number" 
                      value={customW} 
                      onChange={(e) => setCustomW(parseInt(e.target.value) || 100)}
                      className="w-full p-2 bg-bg-page border border-border-base rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Tinggi (px)</label>
                    <input 
                      type="number" 
                      value={customH} 
                      onChange={(e) => setCustomH(parseInt(e.target.value) || 100)}
                      className="w-full p-2 bg-bg-page border border-border-base rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                    />
                  </div>
                </div>
                {(customW !== canvasWidth || customH !== canvasHeight) && (
                  <button 
                    onClick={() => handleSizeChange(customW, customH)}
                    className="mt-3 w-full py-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    Terapkan & Sesuaikan Elemen
                  </button>
                )}
              </div>
              
              <div className="pt-4 border-t border-border-base">
                <label className="block text-sm font-bold text-text-heading mb-2">Warna Kanvas (Background)</label>
                <div className="mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-border-base shadow-sm" style={{ backgroundColor: canvasColor }}></div>
                  <span className="text-sm font-mono text-text-muted">{canvasColor}</span>
                </div>
                <div className="custom-color-picker w-full flex justify-center">
                   <ChromePicker 
                    color={canvasColor}
                    onChange={(color) => setCanvasColor(color.hex)}
                    disableAlpha={true}
                    width="100%"
                  />
                </div>
              </div>

              {/* Gambar Saya - Uploads Gallery */}
              <div className="pt-4 border-t border-border-base">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-text-heading flex items-center gap-2">
                    <Icon name="Images" size={16} /> Gambar Saya
                  </label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                  >
                    <Icon name={isUploading ? 'Loader2' : 'Upload'} size={12} className={isUploading ? 'animate-spin' : ''} />
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files[0]) { handleImageUpload(e.target.files[0], false); e.target.value=''; } }} />
                </div>

                {uploadedImages.length === 0 ? (
                  <div className="text-center text-text-muted bg-bg-page rounded-xl border border-dashed border-border-base p-4">
                    <Icon name="ImagePlus" size={24} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Belum ada gambar. Upload gambar untuk digunakan di receipt.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map(img => (
                      <div key={img.filename} className="group relative aspect-square rounded-lg overflow-hidden border border-border-base hover:border-green-500 transition-all cursor-pointer bg-bg-page">
                        <img
                          src={`${API_BASE}${img.url}`}
                          alt={img.filename}
                          className="w-full h-full object-cover"
                          onClick={() => addImageToCanvas(img.url)}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); addImageToCanvas(img.url); }}
                            className="bg-white/90 text-green-700 p-1.5 rounded-lg mr-1 hover:bg-white transition-colors shadow-sm" title="Tambah ke canvas"
                          >
                            <Icon name="Plus" size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.filename); }}
                            className="bg-white/90 text-red-600 p-1.5 rounded-lg hover:bg-white transition-colors shadow-sm" title="Hapus gambar"
                          >
                            <Icon name="Trash2" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptTemplateEditor;
