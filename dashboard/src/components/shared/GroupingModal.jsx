import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import Icon from '@/components/shared/Icon';
import api from '@/services/api';

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:3001';
const getFileUrl = (p) => {
  if (!p) return null;
  return p.startsWith('http') ? p : `${BASE_URL}/${p.replace(/^\//, '')}`;
};
const getFileIcon = (t) => {
  if (t === 'image') return 'Image';
  if (t === 'pdf') return 'FileText';
  if (t === 'docx') return 'FileType';
  if (t === 'excel') return 'Table';
  return 'File';
};

// ─── Draggable File Chip ──────────────────────────────────────────────────────
const FileChip = ({ fileEntry, groupId }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: fileEntry.dragId,
    data: { fileEntry, groupId },
  });

  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.25 : 1,
  };

  const isNew = fileEntry.kind === 'new';
  const name = isNew
    ? (fileEntry.originalName || fileEntry.subTitle || fileEntry.tempId)
    : (fileEntry.ai_title || fileEntry.file_name);
  const desc = isNew ? fileEntry.subSummary : fileEntry.ai_description;
  const icon = isNew ? 'FileText' : getFileIcon(fileEntry.file_type);
  const fileUrl = !isNew ? getFileUrl(fileEntry.file_path) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all ${
        isNew
          ? 'bg-violet-50 border-violet-200 hover:border-violet-400 hover:shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Color dot indicator */}
      <div className={`shrink-0 w-1.5 h-1.5 rounded-full mt-2 ${isNew ? 'bg-violet-400' : 'bg-slate-300'}`} />

      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isNew ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
        <Icon name={icon} size={13} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-800 truncate leading-snug">{name}</p>
        {desc && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>}
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-700 font-medium"
          >
            <Icon name="ExternalLink" size={9} /> Buka
          </a>
        )}
      </div>

      <div className="shrink-0 self-center opacity-30 group-hover:opacity-60 transition-opacity">
        <Icon name="GripVertical" size={12} className="text-slate-400" />
      </div>
    </div>
  );
};

// ─── Drag Overlay ─────────────────────────────────────────────────────────────
const FileChipOverlay = ({ fileEntry }) => {
  const name = fileEntry.kind === 'new'
    ? (fileEntry.originalName || fileEntry.subTitle || 'File')
    : (fileEntry.ai_title || fileEntry.file_name);
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-indigo-400 rounded-lg shadow-2xl w-64 rotate-1">
      <Icon name="FileText" size={14} className="text-indigo-500 shrink-0" />
      <p className="text-[12px] font-semibold text-slate-800 truncate flex-1">{name}</p>
    </div>
  );
};

// ─── Group Column ─────────────────────────────────────────────────────────────
const GroupColumn = ({ group, groupIndex, isRegenerating, onRemoveGroup }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `group-${groupIndex}` });
  const isNew = group.isNew;
  const hasNewFiles = group.files.some(f => f.kind === 'new');

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 transition-all min-w-[260px] max-w-[320px] w-full ${
        isOver
          ? 'border-indigo-400 bg-indigo-50/40 shadow-lg'
          : isNew
            ? 'border-emerald-200 bg-emerald-50/30'
            : 'border-slate-200 bg-white'
      }`}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          {isNew ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wide rounded-full">
              <Icon name="Plus" size={9} /> Grup Baru
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wide rounded-full">
              <Icon name="FolderOpen" size={9} /> Grup Tersimpan
            </span>
          )}
          {isNew && group.files.length === 0 && (
            <button
              onClick={() => onRemoveGroup(groupIndex)}
              className="p-1 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
            >
              <Icon name="X" size={11} />
            </button>
          )}
          {isRegenerating && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-500">
              <div className="animate-spin w-3 h-3 border-[1.5px] border-indigo-400 border-t-transparent rounded-full" />
              <span>AI update...</span>
            </div>
          )}
        </div>

        <h6 className="font-bold text-slate-800 text-[13px] leading-snug">
          {group.mainTitle || group.context_label || 'Tanpa Judul'}
        </h6>
        {(group.mainSummary || group.ai_summary) && (
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {group.mainSummary || group.ai_summary}
          </p>
        )}

        {/* File count badge */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-400 font-medium">{group.files.length} file</span>
          {hasNewFiles && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-[9px] font-bold rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              {group.files.filter(f => f.kind === 'new').length} baru
            </span>
          )}
        </div>
      </div>

      {/* Files */}
      <div className="flex-1 p-2.5 space-y-1.5 min-h-[80px]">
        {group.files.length === 0 && (
          <div className={`flex items-center justify-center h-16 border-2 border-dashed rounded-lg text-[11px] transition-colors ${
            isOver ? 'border-indigo-300 text-indigo-500 bg-indigo-50/50' : 'border-slate-200 text-slate-300'
          }`}>
            Seret file ke sini
          </div>
        )}
        {group.files.map(fileEntry => (
          <FileChip
            key={fileEntry.dragId}
            fileEntry={fileEntry}
            groupId={groupIndex}
          />
        ))}
      </div>
    </div>
  );
};

// ─── New Group Drop Zone ───────────────────────────────────────────────────────
const NewGroupZone = () => {
  const { isOver, setNodeRef } = useDroppable({ id: 'new-group' });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center min-w-[200px] max-w-[240px] w-full rounded-xl border-2 border-dashed transition-all min-h-[180px] ${
        isOver ? 'border-emerald-400 bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${isOver ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
        <Icon name="Plus" size={20} />
      </div>
      <p className={`text-xs font-semibold transition-colors ${isOver ? 'text-emerald-700' : 'text-slate-400'}`}>
        {isOver ? 'Buat grup baru' : 'Grup Baru'}
      </p>
      <p className="text-[10px] text-slate-300 mt-0.5">Seret file ke sini</p>
    </div>
  );
};

// ─── Legend ───────────────────────────────────────────────────────────────────
const Legend = () => (
  <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
      File baru (belum tersimpan)
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
      File sudah tersimpan
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-600 font-bold uppercase rounded-full" style={{ fontSize: 8 }}>
        <Icon name="Plus" size={7} /> Grup Baru
      </span>
      = grup baru akan dibuat
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 font-bold uppercase rounded-full" style={{ fontSize: 8 }}>
        <Icon name="FolderOpen" size={7} /> Grup Tersimpan
      </span>
      = grup yang sudah ada
    </span>
  </div>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
const GroupingModal = ({
  isOpen, proposal, internalFiles, existingContexts,
  isManageMode, regenerateTitleEndpoint, onCommit, onClose
}) => {
  const [groups, setGroups] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [regeneratingGroups, setRegeneratingGroups] = useState(new Set());
  const [isCommitting, setIsCommitting] = useState(false);
  const debounceTimers = useRef({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // ── Build group list ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!proposal) return;

    // Start with existing context groups (always show)
    const groupMap = new Map(); // contextId → group object
    (existingContexts || []).forEach(ctx => {
      groupMap.set(ctx.id, {
        isNew: false,
        existingContextId: ctx.id,
        context_label: ctx.context_label,
        ai_summary: ctx.ai_summary,
        mainTitle: ctx.context_label,
        mainSummary: ctx.ai_summary,
        action: 'move_to_existing',
        _id: `ctx-${ctx.id}`,
        files: (ctx.files || []).map(f => ({
          kind: 'existing',
          dragId: `existing-${f.id}`,
          existingFileId: f.id,
          existingContextId: ctx.id,
          file_name: f.file_name,
          file_path: f.file_path,
          file_type: f.file_type,
          ai_title: f.ai_title,
          ai_description: f.ai_description,
        })),
      });
    });

    const allGroups = [...groupMap.values()];

    // Place new files from AI proposal:
    // - move_to_existing → inject into matching existing group
    // - create_new → create new group
    (proposal.groups || []).forEach((g, i) => {
      const newFiles = (g.files || []).map(f => ({
        kind: 'new',
        dragId: f.tempId,
        tempId: f.tempId,
        originalName: (internalFiles || []).find(inf => inf.tempId === f.tempId)?.originalName,
        subTitle: f.subTitle,
        subSummary: f.subSummary,
      }));

      if (g.action === 'move_to_existing' && g.existingContextId) {
        // Drop new files into existing group
        const existingGroup = allGroups.find(gr => gr.existingContextId === g.existingContextId || gr.existingContextId === Number(g.existingContextId));
        if (existingGroup) {
          existingGroup.files.push(...newFiles);
        } else {
          // Fallback: create as new group
          allGroups.push({
            isNew: true, action: 'create_new',
            mainTitle: g.mainTitle || 'Grup Baru',
            mainSummary: g.mainSummary || '',
            _id: `proposed-${i}-${Date.now()}`,
            files: newFiles,
          });
        }
      } else {
        // create_new
        allGroups.push({
          isNew: true, action: 'create_new',
          mainTitle: g.mainTitle || 'Grup Baru',
          mainSummary: g.mainSummary || '',
          _id: `proposed-${i}-${Date.now()}`,
          files: newFiles,
        });
      }
    });

    setGroups(allGroups);
  }, [proposal, existingContexts, internalFiles]);

  // ── AI regenerate title (debounced) ──────────────────────────────────────
  const triggerRegenerate = useCallback((groupIndex) => {
    const key = `g-${groupIndex}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      const group = groups[groupIndex];
      if (!group || group.files.length === 0) return;
      const newFiles = group.files.filter(f => f.kind === 'new');
      if (newFiles.length === 0) return;

      setRegeneratingGroups(prev => new Set(prev).add(groupIndex));
      try {
        const res = await api.post(regenerateTitleEndpoint || '/smart-grouping/regenerate-title', {
          files: newFiles.map(f => ({ tempId: f.tempId, subTitle: f.subTitle, subSummary: f.subSummary })),
          internalFiles: internalFiles || [],
          existingContextLabel: group.mainTitle || null,
        });
        if (res.data.status) {
          setGroups(prev => {
            const updated = [...prev];
            if (updated[groupIndex]) {
              updated[groupIndex] = { ...updated[groupIndex], mainTitle: res.data.data.mainTitle, mainSummary: res.data.data.mainSummary, isNew: true, action: 'create_new' };
            }
            return updated;
          });
        }
      } catch (e) {
        console.error('[GroupingModal] Regenerate failed:', e);
      } finally {
        setRegeneratingGroups(prev => { const n = new Set(prev); n.delete(groupIndex); return n; });
      }
    }, 1800);
  }, [groups, internalFiles, regenerateTitleEndpoint]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => setActiveFile(active.data.current.fileEntry);

  const handleDragEnd = ({ active, over }) => {
    setActiveFile(null);
    if (!over) return;

    const srcIdx = active.data.current.groupId;
    const fileToMove = active.data.current.fileEntry;
    const target = over.id;

    let destIdx = null;
    let makeNew = false;

    if (target === 'new-group') makeNew = true;
    else if (typeof target === 'string' && target.startsWith('group-')) destIdx = parseInt(target.replace('group-', ''));

    if (!makeNew && destIdx === srcIdx) return;

    setGroups(prev => {
      const updated = prev.map(g => ({ ...g, files: [...g.files] }));
      // Remove from source
      updated[srcIdx].files = updated[srcIdx].files.filter(f => f.dragId !== fileToMove.dragId);

      if (makeNew) {
        updated.push({
          isNew: true, action: 'create_new',
          mainTitle: fileToMove.subTitle || fileToMove.ai_title || 'Grup Baru',
          mainSummary: fileToMove.subSummary || fileToMove.ai_description || '',
          _id: `new-${Date.now()}`,
          files: [fileToMove],
        });
      } else {
        updated[destIdx].files.push(fileToMove);
      }
      return updated;
    });

    setTimeout(() => {
      setGroups(curr => {
        if (makeNew) {
          const ni = curr.length - 1;
          if (ni >= 0 && curr[ni]?.isNew) triggerRegenerate(ni);
        } else if (destIdx !== null && curr[destIdx]?.isNew) {
          triggerRegenerate(destIdx);
        }
        if (srcIdx < curr.length && curr[srcIdx]?.isNew && curr[srcIdx].files.length > 0) {
          triggerRegenerate(srcIdx);
        }
        return curr;
      });
    }, 60);
  };

  const handleRemoveGroup = idx => setGroups(prev => prev.filter((_, i) => i !== idx));

  // ── Commit ────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      if (isManageMode) {
        // Rearrange existing files
        await onCommit(groups);
      } else {
        // New upload: only groups with new files matter for commit
        const newFileGroups = [];
        for (const group of groups) {
          const newFiles = group.files.filter(f => f.kind === 'new');
          if (newFiles.length === 0) continue;
          newFileGroups.push({
            action: group.isNew ? 'create_new' : 'move_to_existing',
            mainTitle: group.mainTitle,
            mainSummary: group.mainSummary,
            existingContextId: group.existingContextId,
            files: newFiles.map(f => ({ tempId: f.tempId, subTitle: f.subTitle, subSummary: f.subSummary })),
          });
        }
        await onCommit({ groups: newFileGroups }, internalFiles || []);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  if (!isOpen) return null;

  const totalNew = groups.reduce((s, g) => s + g.files.filter(f => f.kind === 'new').length, 0);
  const totalAll = groups.reduce((s, g) => s + g.files.length, 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[96vw] max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-modal-card">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Icon name={isManageMode ? 'Settings2' : 'Sparkles'} size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isManageMode ? 'Atur Ulang Pengelompokan' : 'Konfirmasi Pengelompokan File'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isManageMode
                  ? `${totalAll} file dalam ${groups.length} grup — seret untuk mengatur ulang`
                  : `${totalNew} file baru akan dikelompokkan ke dalam ${groups.length} grup`
                }
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* ── Legend + Instruction ── */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
          <Legend />
        </div>

        {/* ── Kanban ── */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 items-start min-h-full pb-4">
              {groups.map((group, index) => (
                <GroupColumn
                  key={group._id || `g-${index}`}
                  group={group}
                  groupIndex={index}
                  isRegenerating={regeneratingGroups.has(index)}
                  onRemoveGroup={handleRemoveGroup}
                />
              ))}
              <NewGroupZone />
            </div>

            <DragOverlay dropAnimation={null}>
              {activeFile && <FileChipOverlay fileEntry={activeFile} />}
            </DragOverlay>
          </DndContext>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="text-xs text-slate-400">
            {regeneratingGroups.size > 0 && (
              <span className="flex items-center gap-1.5 text-indigo-500 font-medium">
                <div className="animate-spin w-3 h-3 border-[1.5px] border-indigo-400 border-t-transparent rounded-full" />
                AI sedang membuat judul grup...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isCommitting}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCommit}
              disabled={isCommitting || (!isManageMode && totalNew === 0) || regeneratingGroups.size > 0}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCommitting
                ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Menyimpan...</>
                : isManageMode
                  ? <><Icon name="Check" size={16} /> Simpan Perubahan</>
                  : <><Icon name="Check" size={16} /> Simpan ({totalNew} file)</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GroupingModal;
