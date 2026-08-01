import React, { useState } from 'react';
import Icon from '@/components/shared/Icon';

const todayStr = () => new Date().toISOString().slice(0, 10);

const CreateScheduleModal = ({ open, onClose, onSave, labels = [], onSearchCustomers }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('08:00');
  const [desc, setDesc] = useState('');
  const [followup, setFollowup] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [manualSelected, setManualSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleLabel = (id) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    const results = await onSearchCustomers?.(q);
    setSearchResults(results || []);
  };

  const toggleManual = (c) => {
    setManualSelected((prev) =>
      prev.some((x) => x.phone === c.phone)
        ? prev.filter((x) => x.phone !== c.phone)
        : [...prev, c]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave?.({
      title: title.trim(),
      schedule_date: date,
      schedule_time: time,
      description: desc.trim(),
      label_ids: selectedLabels,
      manual_phones: manualSelected.map((x) => x.phone),
      send_followup: followup,
    });
    setSaving(false);
    onClose();
  };

  const previewContacts = [...manualSelected];

  return (
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-bg-surface border border-border-base rounded-2xl w-[92%] max-w-[600px] max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-base bg-gradient-to-b from-amber-50/50 to-transparent flex items-center justify-between">
          <div>
            <h3 className="text-sm font-display font-bold text-text-heading">Buat Jadwal Baru</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Isi detail jadwal dan pilih kontak</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
          >
            <Icon name="X" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto max-h-[60vh] space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-text-body mb-1 block">Judul Jadwal</label>
            <input 
              className="w-full bg-bg-subtle border border-border-base rounded-lg px-3 py-2 text-[13px] text-text-heading outline-none focus:border-indigo-base focus:ring-2 focus:ring-indigo-base/10 transition-all" 
              placeholder="Contoh: Jadwal Les Piano Kelas A..." 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-text-body mb-1 block">Tanggal</label>
              <input 
                type="date" 
                className="w-full bg-bg-subtle border border-border-base rounded-lg px-3 py-2 text-[13px] text-text-heading outline-none focus:border-indigo-base transition-all" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-text-body mb-1 block">Waktu</label>
              <input 
                type="time" 
                className="w-full bg-bg-subtle border border-border-base rounded-lg px-3 py-2 text-[13px] text-text-heading outline-none focus:border-indigo-base transition-all" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-body mb-1 block">Deskripsi / Keterangan</label>
            <textarea 
              className="w-full bg-bg-subtle border border-border-base rounded-lg px-3 py-2 text-[13px] text-text-heading outline-none focus:border-indigo-base transition-all min-h-[70px] resize-y" 
              placeholder="Keterangan tambahan..." 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
            />
          </div>

          {/* Label Picker */}
          {labels.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-text-body mb-1 block">Pilih berdasarkan Label</label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                      selectedLabels.includes(l.id)
                        ? 'bg-indigo-soft text-indigo-base border-indigo-border shadow-sm'
                        : 'bg-bg-subtle text-text-body border-border-base hover:border-indigo-border'
                    }`}
                    style={
                      selectedLabels.includes(l.id) && l.color 
                        ? { backgroundColor: l.color + '20', color: l.color, borderColor: l.color + '40' } 
                        : {}
                    }
                  >
                    {l.label_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Search */}
          <div>
            <label className="text-[11px] font-semibold text-text-body mb-1 block">Tambah Kontak Manual</label>
            <div className="relative">
              <Icon name="Search" size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                className="w-full bg-bg-subtle border border-border-base rounded-lg pl-8 pr-3 py-2 text-[13px] text-text-heading outline-none focus:border-indigo-base transition-all" 
                placeholder="Cari nama / nomor..." 
                value={searchQuery} 
                onChange={(e) => handleSearch(e.target.value)} 
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-1.5 max-h-[140px] overflow-y-auto border border-border-base rounded-lg bg-bg-surface">
                {searchResults.slice(0, 20).map((c) => {
                  const isSel = manualSelected.some((x) => x.phone === c.phone);
                  return (
                    <div 
                      key={c.phone} 
                      onClick={() => toggleManual(c)} 
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-border-base last:border-b-0 transition-all ${isSel ? 'bg-indigo-soft' : 'hover:bg-bg-subtle'}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${isSel ? 'bg-indigo-base border-indigo-base text-white' : 'border-border-base'}`}>
                        {isSel && '✓'}
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-text-heading">{c.name}</div>
                        <div className="text-[10px] text-text-muted">{c.phone}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          {previewContacts.length > 0 && (
            <div className="bg-bg-subtle rounded-lg px-3 py-2 border border-border-base">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted font-semibold">PREVIEW KONTAK</span>
                <span className="text-[11px] font-bold text-indigo-base">{previewContacts.length} kontak</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {previewContacts.slice(0, 12).map((c) => (
                  <span key={c.phone} className="px-2 py-0.5 rounded text-[10px] bg-indigo-soft border border-indigo-border text-indigo-base font-semibold">
                    {c.name || c.phone}
                  </span>
                ))}
                {previewContacts.length > 12 && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-base text-white font-semibold">
                    +{previewContacts.length - 12}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Follow-Up Toggle */}
          <div className="flex items-center justify-between bg-bg-subtle rounded-lg px-3 py-3 border border-border-base">
            <div>
              <h4 className="text-[12px] font-semibold text-text-heading flex items-center gap-1.5">
                <Icon name="Bot" size={14} /> Auto Follow-Up WA
              </h4>
              <p className="text-[10px] text-text-muted mt-0.5">AI kirim notifikasi ke WhatsApp semua kontak</p>
            </div>
            <button
              onClick={() => setFollowup(!followup)}
              className={`relative w-10 h-5 rounded-full transition-colors ${followup ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${followup ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-base bg-bg-subtle/50 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg text-[12px] font-bold bg-bg-subtle border border-border-base text-text-body hover:bg-bg-surface transition-all"
          >
            Batal
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || !title.trim()} 
            className="px-4 py-2 rounded-lg text-[12px] font-bold bg-indigo-base text-white border border-indigo-base hover:bg-indigo-mid disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            {saving ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> : <Icon name="Save" size={13} />}
            Simpan Jadwal
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateScheduleModal;