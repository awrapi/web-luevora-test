/**
 * ================================================================
 * TAG PROCESSOR: Date Request Tags
 * ================================================================
 * Handles date-related tags from AI response:
 *   [BASIC_DATE_REQUEST: TANGGAL | PAKET | DATA]  — new date request
 *   [BASIC_DATE_CHANGED: TANGGAL_BARU | ALASAN]   — date change
 *
 * Creates/updates CustomerManagement records and broadcasts SSE.
 *
 * Extracted from stage7.postProcessor.js for maintainability.
 */

import prisma from '../../../../config/database.js';
import { broadcast } from '../../../shared/sse.service.js';
import { addRequestItem } from '../../cmCopilot.service.js';

/**
 * Parse Indonesian date string to Date object.
 * Handles: "25 Juli 2025", "2025-07-25", "Sabtu, 25 Juli 2025"
 */
const parseIndoDate = (str) => {
  const monthMap = {
    januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
    juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
  };
  const cleaned = str.replace(/^[\w]+,\s*/i, '').trim();
  const parts = cleaned.split(/[\s,]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const month = monthMap[parts[1].toLowerCase()];
    const year = parseInt(parts[2]);
    // Use UTC to avoid timezone offset causing off-by-one day when saved to MySQL DATE
    if (!isNaN(day) && month !== undefined && !isNaN(year)) return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  // For ISO format strings, also force noon UTC to avoid date shift
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
  }
  return null;
};

/**
 * Process [BASIC_DATE_REQUEST] and [BASIC_DATE_CHANGED] tags.
 *
 * @param {string} finalReply - Current AI reply text
 * @param {Object} ctx - Pipeline context
 * @param {Function} stripTag - Helper to strip tags
 */
export const processDateTags = async (finalReply, ctx, stripTag) => {
  const { tenantId, userPhone, lead } = ctx;

  // ── [BASIC_DATE_REQUEST: TANGGAL | PAKET | DATA] ────────────
  const basicDateMatch = finalReply.match(/\[BASIC_DATE_REQUEST:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]/i)
    || finalReply.match(/\[BASIC_DATE_REQUEST:\s*(.+?)\s*\|\s*(.+?)\s*\]/i);

  if (basicDateMatch) {
    const dateStr = basicDateMatch[1].trim();
    const pkgName = basicDateMatch[2] ? basicDateMatch[2].trim() : null;
    const extraDataRaw = basicDateMatch[3] ? basicDateMatch[3].trim() : null;

    const parsedDate = parseIndoDate(dateStr);

    // ── Name validation gate ──────────────────────────────────
    const cName = lead?.saved_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || 'Pelanggan';
    const genericNames = ['pelanggan', 'kosong', 'whatsapp user', 'user', 'telegram user', ''];
    const isGenericName = genericNames.includes(cName.toLowerCase().trim());

    if (isGenericName) {
      console.warn(`[Stage7:Date] ⛔ BLOCKED BASIC_DATE_REQUEST — customer name is generic: "${cName}". AI must ask for full name first.`);
      stripTag(/\[BASIC_DATE_REQUEST:\s*[^\]]+\]/gi);
      return; // Block — don't create CM record with "Pelanggan"
    }

    let collectedDataObj = {};
    if (extraDataRaw) {
      extraDataRaw.split('|').forEach(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          collectedDataObj[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
        }
      });
    }

    try {
      const timestamp = new Date().toLocaleString('id-ID');

      const existingCm = await prisma.customerManagement.findFirst({
        where: { tenant_id: tenantId, phone: userPhone, date_status: 'pending_approval' },
        orderBy: { updated_at: 'desc' }
      });

      if (existingCm) {
        let existingData = {};
        try { existingData = JSON.parse(existingCm.collected_data || '{}'); } catch (e) {}
        const mergedData = { ...existingData, ...collectedDataObj };

        await prisma.customerManagement.update({
          where: { id: existingCm.id },
          data: {
            customer_name: cName !== 'Pelanggan' ? cName : existingCm.customer_name,
            package_name: pkgName || existingCm.package_name,
            requested_date: parsedDate || existingCm.requested_date,
            date_status: 'pending_approval',
            collected_data: JSON.stringify(mergedData),
            admin_note: existingCm.admin_note
              ? existingCm.admin_note + `\n- [${timestamp}] Tanggal request diperbarui: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`
              : `- [${timestamp}] Tanggal request: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`,
            updated_at: new Date()
          }
        });
        console.log(`[Stage7:Date] BASIC_DATE_REQUEST updated CM#${existingCm.id} for ${cName}: ${parsedDate || dateStr}`);
      } else {
        await prisma.customerManagement.create({
          data: {
            tenant_id: tenantId,
            phone: userPhone,
            customer_name: cName,
            package_name: pkgName,
            requested_date: parsedDate,
            date_status: 'pending_approval',
            status: 'waiting_date',
            collected_data: Object.keys(collectedDataObj).length > 0 ? JSON.stringify(collectedDataObj) : null,
            admin_note: `- [${timestamp}] Tanggal request: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`,
          }
        });
        console.log(`[Stage7:Date] BASIC_DATE_REQUEST created CM for ${cName}: ${parsedDate || dateStr}`);
      }

      broadcast(tenantId, 'customer_management_updated', { phone: userPhone, date_status: 'pending_approval' });

      // ── Also write to unified CmRequestItem ──
      try {
        const dateLabel = parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr;
        await addRequestItem(
          tenantId,
          userPhone,
          'date_request',
          `Tanggal: ${dateLabel}${pkgName ? ` untuk ${pkgName}` : ''}`,
          extraDataRaw || null,
          {
            requested_date: dateLabel,
            package_name: pkgName || null,
            collected_data: collectedDataObj
          },
          cName,
          pkgName
        );
      } catch (cmItemErr) {
        console.warn('[Stage7:Date] Failed to create CmRequestItem:', cmItemErr.message);
      }
    } catch (err) {
      console.error('[Stage7:Date] Failed to process BASIC_DATE_REQUEST:', err.message);
    }
  }
  stripTag(/\[BASIC_DATE_REQUEST:\s*[^\]]+\]/gi);

  // ── [BASIC_DATE_CHANGED: TANGGAL_BARU | ALASAN] ────────────
  const basicDateChangedMatch = finalReply.match(/\[BASIC_DATE_CHANGED:\s*(.+?)\s*\|\s*(.+?)\s*\]/i);
  if (basicDateChangedMatch) {
    const newDateStr = basicDateChangedMatch[1].trim();
    const changeReason = basicDateChangedMatch[2].trim();
    const newParsedDate = parseIndoDate(newDateStr);

    try {
      const existingCm = await prisma.customerManagement.findFirst({
        where: { tenant_id: tenantId, phone: userPhone, date_status: { in: ['pending_approval', 'rejected'] } },
        orderBy: { updated_at: 'desc' }
      });

      const timestamp = new Date().toLocaleString('id-ID');

      if (existingCm) {
        const oldDate = existingCm.requested_date ? existingCm.requested_date.toISOString().split('T')[0] : 'unknown';
        await prisma.customerManagement.update({
          where: { id: existingCm.id },
          data: {
            requested_date: newParsedDate || existingCm.requested_date,
            date_status: 'pending_approval',
            date_reject_reason: null,
            date_suggested: null,
            admin_note: (existingCm.admin_note || '') + `\n- [${timestamp}] Customer ubah tanggal dari ${oldDate} ke ${newParsedDate ? newParsedDate.toISOString().split('T')[0] : newDateStr}. Alasan: ${changeReason}`,
            updated_at: new Date()
          }
        });
        console.log(`[Stage7:Date] BASIC_DATE_CHANGED: CM#${existingCm.id} date changed from ${oldDate} to ${newParsedDate || newDateStr}`);
        broadcast(tenantId, 'customer_management_updated', { phone: userPhone, date_status: 'pending_approval', changed: true });
      }
    } catch (err) {
      console.error('[Stage7:Date] Failed to process BASIC_DATE_CHANGED:', err.message);
    }
  }
  stripTag(/\[BASIC_DATE_CHANGED:\s*[^\]]+\]/gi);
};
