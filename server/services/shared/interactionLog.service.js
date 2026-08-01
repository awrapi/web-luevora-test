/**
 * ================================================================
 * Interaction Log Service — Customer Interaction Tracking
 * ================================================================
 * Logs all types of customer interactions (calls, meetings, emails,
 * complaints, marketing touches) for a unified communication history.
 */

import prisma from '../../config/database.js';

/**
 * Fetch all interaction logs for a customer, ordered by most recent first.
 * @param {number} tenantId
 * @param {string} phone
 * @param {{ limit?: number, type?: string }} opts
 */
export const fetchInteractionLogs = async (tenantId, phone, { limit = 100, type = null } = {}) => {
  const where = { tenant_id: tenantId, phone };
  if (type) where.interaction_type = type;

  const logs = await prisma.customerInteractionLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: Math.min(limit, 500)
  });

  return logs;
};

/**
 * Create a new interaction log entry.
 * @param {number} tenantId
 * @param {string} phone
 * @param {{ interaction_type: string, subject?: string, detail?: string, channel?: string, logged_by?: string }} payload
 */
export const createInteractionLog = async (tenantId, phone, payload = {}) => {
  const { interaction_type, subject, detail, channel, logged_by } = payload;

  if (!interaction_type) {
    throw new Error('interaction_type wajib diisi');
  }

  const log = await prisma.customerInteractionLog.create({
    data: {
      tenant_id: tenantId,
      phone,
      interaction_type,
      subject: subject || null,
      detail: detail || null,
      channel: channel || null,
      logged_by: logged_by || 'admin'
    }
  });

  return log;
};

/**
 * Bulk-create interaction logs (e.g. from AI auto-detection).
 * @param {number} tenantId
 * @param {Array<{phone: string, interaction_type: string, subject?: string, detail?: string, channel?: string, logged_by?: string}>} entries
 */
export const bulkCreateInteractionLogs = async (tenantId, entries = []) => {
  if (!entries.length) return [];

  const data = entries.map(e => ({
    tenant_id: tenantId,
    phone: e.phone,
    interaction_type: e.interaction_type,
    subject: e.subject || null,
    detail: e.detail || null,
    channel: e.channel || null,
    logged_by: e.logged_by || 'ai'
  }));

  await prisma.customerInteractionLog.createMany({ data, skipDuplicates: true });
  return data;
};

/**
 * Delete a single interaction log entry.
 * @param {number} tenantId
 * @param {number} logId
 */
export const deleteInteractionLog = async (tenantId, logId) => {
  await prisma.customerInteractionLog.delete({
    where: { id: logId, tenant_id: tenantId }
  });
  return { deleted: true };
};

export default {
  fetchInteractionLogs,
  createInteractionLog,
  bulkCreateInteractionLogs,
  deleteInteractionLog
};
