import React, { useEffect, useState } from 'react';
import Icon from '@/components/shared/Icon';

/**
 * DocumentPreview
 * Renders a preview of a local File object inside the lightbox.
 * - PDF  → iframe with blob URL
 * - DOCX → mammoth converts to HTML, shown in sandboxed div
 * - XLSX/XLS → SheetJS parses to HTML table
 * - TXT  → plain text in <pre>
 * - Others → info card with download button
 */
const DocumentPreview = ({ file }) => {
  const [state, setState] = useState({ status: 'loading', content: null, error: null });

  const ext = file.name.split('.').pop().toLowerCase();
  const sizeMb = (file.size / 1024 / 1024).toFixed(2);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: 'loading', content: null, error: null });

      try {
        // ── PDF ─────────────────────────────────────────────
        if (ext === 'pdf') {
          const url = URL.createObjectURL(file);
          if (!cancelled) setState({ status: 'pdf', content: url, error: null });
          return;
        }

        // ── TXT ─────────────────────────────────────────────
        if (ext === 'txt') {
          const text = await file.text();
          if (!cancelled) setState({ status: 'txt', content: text, error: null });
          return;
        }

        // ── DOCX / DOC ──────────────────────────────────────
        if (ext === 'docx' || ext === 'doc') {
          const mammoth = (await import('mammoth')).default;
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) setState({ status: 'html', content: result.value, error: null });
          return;
        }

        // ── XLSX / XLS ──────────────────────────────────────
        if (ext === 'xlsx' || ext === 'xls') {
          const XLSX = await import('xlsx');
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          // Use first sheet
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const html = XLSX.utils.sheet_to_html(firstSheet, {
            id: 'xlsx-table',
            editable: false,
          });
          if (!cancelled) setState({ status: 'html', content: html, error: null });
          return;
        }

        // ── PPT/ZIP/etc — info card ─────────────────────────
        if (!cancelled) setState({ status: 'unsupported', content: null, error: null });

      } catch (err) {
        console.error('[DocumentPreview]', err);
        if (!cancelled) setState({ status: 'error', content: err.message, error: err.message });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [file, ext]);

  // ── Loading spinner ──────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 text-white/60">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-[12px]">Memuat preview…</span>
      </div>
    );
  }

  // ── PDF ──────────────────────────────────────────────────────
  if (state.status === 'pdf') {
    return (
      <iframe
        src={state.content}
        title={file.name}
        className="rounded-xl shadow-2xl bg-white"
        style={{ width: 'min(800px, 88vw)', height: 'min(85vh, 600px)', border: 'none' }}
      />
    );
  }

  // ── Plain text ───────────────────────────────────────────────
  if (state.status === 'txt') {
    return (
      <div
        className="bg-gray-900 rounded-xl shadow-2xl overflow-auto"
        style={{ width: 'min(760px, 88vw)', maxHeight: 'min(80vh, 560px)' }}
      >
        <pre className="p-5 text-[12px] text-gray-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
          {state.content}
        </pre>
      </div>
    );
  }

  // ── HTML content (Word or Excel) ─────────────────────────────
  if (state.status === 'html') {
    const isExcel = ext === 'xlsx' || ext === 'xls';
    return (
      <div
        className="bg-white rounded-xl shadow-2xl overflow-auto"
        style={{ width: 'min(900px, 92vw)', maxHeight: 'min(82vh, 600px)' }}
      >
        {/* Sheet name header for Excel */}
        {isExcel && (
          <div className="px-4 py-2.5 border-b border-gray-200 flex items-center gap-2 sticky top-0 bg-white z-10">
            <Icon name="FileSpreadsheet" size={14} className="text-green-600" />
            <span className="text-[12px] font-semibold text-gray-700">{file.name}</span>
          </div>
        )}
        <div
          className={`doc-preview-content ${isExcel ? 'excel-preview' : 'word-preview'}`}
          style={{ padding: isExcel ? 0 : '24px 32px' }}
          dangerouslySetInnerHTML={{ __html: state.content }}
        />
        <style>{`
          .word-preview { font-family: 'Georgia', serif; font-size: 13px; color: #1a1a1a; line-height: 1.7; }
          .word-preview h1,.word-preview h2,.word-preview h3 { margin: 12px 0 6px; font-weight: 700; }
          .word-preview p { margin: 6px 0; }
          .word-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; }
          .word-preview td,.word-preview th { border: 1px solid #d1d5db; padding: 5px 8px; font-size: 12px; }
          .word-preview th { background: #f3f4f6; font-weight: 600; }
          .excel-preview table#xlsx-table { border-collapse: collapse; width: 100%; font-size: 11.5px; }
          .excel-preview td,.excel-preview th { border: 1px solid #e5e7eb; padding: 5px 10px; white-space: nowrap; }
          .excel-preview tr:first-child td,.excel-preview tr:first-child th { background: #f0fdf4; font-weight: 700; color: #166534; position: sticky; top: ${isExcel ? '41px' : '0'}; z-index: 1; }
          .excel-preview tr:nth-child(even) td { background: #f9fafb; }
          .excel-preview tr:hover td { background: #f0fdf4; }
        `}</style>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <InfoCard file={file} ext={ext.toUpperCase()} sizeMb={sizeMb} message={`Gagal memuat: ${state.content}`} color="#ef4444" iconName="AlertTriangle" />
    );
  }

  // ── Unsupported — info card with download ────────────────────
  const colorMap = { PPT: '#ea580c', PPTX: '#ea580c', ZIP: '#7c3aed', RAR: '#7c3aed' };
  const iconMap  = { PPT: 'Presentation', PPTX: 'Presentation', ZIP: 'Archive', RAR: 'Archive' };
  const color    = colorMap[ext.toUpperCase()] || '#64748b';
  const iconName = iconMap[ext.toUpperCase()] || 'FileText';

  return (
    <InfoCard
      file={file}
      ext={ext.toUpperCase()}
      sizeMb={sizeMb}
      message="Preview tidak tersedia untuk format ini"
      color={color}
      iconName={iconName}
    />
  );
};

/** Generic info card shown for unsupported / error states */
const InfoCard = ({ file, ext, sizeMb, message, color, iconName }) => {
  const fileUrl = URL.createObjectURL(file);
  return (
    <div
      className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
      style={{ animation: 'fadeInUp 0.2s ease-out', minWidth: 240 }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: color + '22', border: `2px solid ${color}44` }}
      >
        <Icon name={iconName} size={32} style={{ color }} />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-[15px] break-all max-w-[260px]">{file.name}</p>
        <p className="text-white/50 text-[12px] mt-1">{ext} · {sizeMb} MB</p>
      </div>
      <p className="text-white/40 text-[11px] text-center">{message}</p>
      <a
        href={fileUrl}
        download={file.name}
        onClick={e => e.stopPropagation()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90 active:scale-95"
        style={{ background: color }}
      >
        <Icon name="Download" size={14} />
        Unduh File
      </a>
    </div>
  );
};

export default DocumentPreview;
