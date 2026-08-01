/**
 * MediaLibraryModal.jsx
 * Modal untuk memilih media dari library sistem (Knowledge Base, paket travel, inventory).
 * Tampil sebagai drawer dari bawah (bottom sheet) dengan grouping per kategori.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import Icon from '@/components/shared/Icon';

const TYPE_ICONS = { image: 'Image', document: 'FileText', video: 'Film' };

const MediaLibraryModal = ({ isOpen, onClose, onSend, disabled }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(null); // itemId being sent
  const [caption, setCaption] = useState('');
  const [selected, setSelected] = useState(null); // selected item for caption

  const [error, setError] = useState(null);

  const fetchLibrary = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/leads/library');
      console.log('[Library] API response:', res.data);
      const data = res.data.data || [];
      console.log('[Library] Groups count:', data.length, data.map(g => `${g.label}(${g.items?.length})`));
      setGroups(data);
    } catch (err) {
      console.error('[Library] Failed to load:', err.response?.status, err.response?.data || err.message);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // Filter items by search
  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.context.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  const handleSendItem = async (item) => {
    setSending(item.id);
    try {
      await onSend({ mediaUrl: item.url, filename: item.name, caption: caption || '' });
      setCaption('');
      setSelected(null);
      onClose();
    } catch (err) {
      console.error('[Library] Send failed:', err.message);
    } finally {
      setSending(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col"
        style={{
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          animation: 'fadeInUp 0.2s cubic-bezier(0.16,1,0.3,1)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">Library Media</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">File yang tersedia di sistem</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-all">
            <Icon name="X" size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Icon name="Search" size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Cari nama file atau kategori..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Caption input (shown when item selected) */}
        {selected && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-blue-50/50 shrink-0">
            <p className="text-[10px] font-semibold text-blue-600 mb-1.5">
              Kirim: <span className="font-medium text-gray-700">{selected.name}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambahkan caption (opsional)..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="flex-1 text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-white"
              />
              <button
                onClick={() => handleSendItem(selected)}
                disabled={sending === selected.id}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[12px] font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 shrink-0"
              >
                {sending === selected.id ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Kirim'}
              </button>
              <button
                onClick={() => { setSelected(null); setCaption(''); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-all"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-[11px] text-gray-400">Memuat library...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Icon name="AlertCircle" size={20} className="text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-gray-700">Gagal memuat library</p>
                <p className="text-[11px] text-red-400 mt-1 max-w-xs">{error}</p>
              </div>
              <button
                onClick={fetchLibrary}
                className="px-4 py-2 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700 transition-all"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="FolderOpen" size={28} className="text-gray-300" />
              <p className="text-[12px] text-gray-400 font-medium">
                {search ? 'Tidak ada hasil untuk pencarian ini' : 'Belum ada media di library'}
              </p>
              {!search && (
                <button
                  onClick={fetchLibrary}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-[11px] rounded-lg hover:bg-gray-50 transition-all"
                >
                  <Icon name="RefreshCw" size={11} />
                  Muat Ulang
                </button>
              )}
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.id} className="border-b border-gray-50 last:border-b-0">
                {/* Group header */}
                <div className="px-4 py-2.5 bg-gray-50 flex items-center gap-2 sticky top-0 z-10">
                  <Icon name={group.icon} size={12} className="text-gray-500" />
                  <span className="text-[10.5px] font-semibold text-gray-600 uppercase tracking-wide">{group.label}</span>
                  <span className="ml-auto text-[10px] text-gray-400">{group.items.length} item</span>
                </div>

                {/* Items grid — images as thumbnails, docs as list */}
                <div className={`px-4 py-2 ${
                  group.items.some(i => i.type === 'image') ? 'grid grid-cols-4 gap-2' : 'space-y-1'
                }`}>
                  {group.items.map(item => (
                    item.type === 'image' ? (
                      /* Image card */
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        disabled={disabled}
                        className={`relative rounded-lg overflow-hidden border-2 aspect-square group transition-all ${
                          selected?.id === item.id ? 'border-blue-500' : 'border-transparent hover:border-blue-300'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end p-1">
                          <p className="text-[9px] text-white font-medium leading-tight opacity-0 group-hover:opacity-100 line-clamp-2 transition-all">
                            {item.name}
                          </p>
                        </div>
                        {selected?.id === item.id && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <Icon name="Check" size={9} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ) : (
                      /* Document row */
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          selected?.id === item.id
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                          <Icon name={TYPE_ICONS[item.type] || 'File'} size={14} className="text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11.5px] font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{item.context}</p>
                        </div>
                        {selected?.id === item.id ? (
                          <Icon name="CheckCircle" size={14} className="text-blue-500 shrink-0" />
                        ) : (
                          <Icon name="Send" size={12} className="text-gray-300 shrink-0" />
                        )}
                      </button>
                    )
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default MediaLibraryModal;
