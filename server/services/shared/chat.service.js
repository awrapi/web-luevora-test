/**
 * ================================================================
 * Chat Service — Chat History Management
 * ================================================================
 * Ported from: api_leads.php (fetch_chat, send_manual_msg history parts)
 * 
 * Manages chat_history table for all business types.
 * ================================================================
 */

/**
 * Fetch full chat history for a phone number.
 * 
 * @param {import('@prisma/client').PrismaClient} db - Tenant database connection
 * @param {string} phone - User phone number
 * @returns {Promise<Array>} Chat messages
 */
export const getChatHistory = async (db, phone, tenantId) => {
  console.log(`[Chat] Fetching chat history for ${phone}`);
  return await db.chatHistory.findMany({
    where: { tenant_id: tenantId, user_phone: phone },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
  });
};

export const saveMessage = async (db, phone, role, message, tenantId, mediaUrl = null, mediaSummary = null, providerMsgId = null, sentAt = null) => {
  console.log(`[Chat] Saving ${role} message for ${phone}${mediaUrl ? ' [+media]' : ''}`);
  return await db.chatHistory.create({
    data: {
      tenant_id: tenantId,
      user_phone: phone,
      role: role,
      message: message,
      ...(sentAt ? { created_at: new Date(sentAt) } : {}),
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      ...(mediaSummary ? { media_summary: mediaSummary } : {}),
      ...(providerMsgId ? { provider_msg_id: providerMsgId } : {})
    }
  });
};

export const updateEditedMessage = async (db, providerMsgId, newMessageText) => {
  console.log(`[Chat] Updating edited message ${providerMsgId}`);
  try {
    const existing = await db.chatHistory.findFirst({
      where: { provider_msg_id: providerMsgId }
    });
    
    if (existing) {
      return await db.chatHistory.update({
        where: { id: existing.id },
        data: {
          message: newMessageText,
          is_edited: 1
        }
      });
    }
    return null;
  } catch (err) {
    console.error(`[Chat] Failed to update edited message:`, err);
    return null;
  }
};

export const getRecentChat = async (db, phone, limit = 10, tenantId) => {
  console.log(`[Chat] Fetching last ${limit} messages for ${phone}`);
  const rows = await db.chatHistory.findMany({
    where: { tenant_id: tenantId, user_phone: phone },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit,
    select: { role: true, message: true }
  });
  return rows.reverse();
};

/**
 * Build conversation text string for AI prompts.
 * 
 * @param {Array} chatHistory - Array of {role, message}
 * @returns {string} Formatted conversation text
 */
export const buildConversationText = (chatHistory) => {
  return chatHistory
    .map(h => {
      const roleLabel = h.role === 'user' ? 'PELANGGAN' : 'CS';
      const truncated = (h.message || '').substring(0, 300);
      return `${roleLabel}: ${truncated}`;
    })
    .join('\n');
};

export default { getChatHistory, saveMessage, getRecentChat, buildConversationText };
