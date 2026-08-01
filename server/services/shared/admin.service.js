/**
 * ================================================================
 * Admin Service — Knowledge Base & Store Configuration
 * ================================================================
 * Ported from: api_admin.php (sections 1-4, 7-8)
 * 
 * Manages knowledge_base CRUD, store_config, and WA session control.
 * Shared across all business types.
 * ================================================================
 */

/**
 * Save a new knowledge_base entry.
 * 
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} data
 */
export const saveKnowledge = async (db, data) => {
  const {
    type = 'product', title, content, ai_context = '',
    price = 0, original_price = 0, stock = 0,
    slot_unlimited = false, info_additional = '',
    is_promo = false, promo_context = '',
    allow_send_media = false, media_path = null, media_type = 'none',
  } = data;

  console.log(`[Admin] Saving knowledge: ${title} (type=${type})`);

  const finalStock = slot_unlimited ? 9999 : stock;

  await db.knowledgeBase.create({
    data: {
      type, title, content_text: content, ai_context, info_additional,
      price, original_price, stock: finalStock, 
      slot_unlimited: slot_unlimited ? 1 : 0,
      is_promo: is_promo ? 1 : 0, promo_context,
      media_path, media_type, allow_send_media: allow_send_media ? 1 : 0
    }
  });

  return { message: 'Data berhasil disimpan!' };
};

/**
 * Edit an existing knowledge_base entry.
 * 
 * @param {import('@prisma/client').PrismaClient} db
 * @param {number} id
 * @param {object} data
 */
export const editKnowledge = async (db, id, data) => {
  const {
    title, content, ai_context = '',
    price = 0, original_price = 0, stock = 0,
    slot_unlimited = false,
    is_promo = false, promo_context = '',
    allow_send_media = false, media_path, delete_media = false,
  } = data;

  console.log(`[Admin] Editing knowledge ID=${id}: ${title}`);

  const finalStock = slot_unlimited ? 9999 : stock;

  const updateData = {
    title, content_text: content, ai_context,
    price, original_price, stock: finalStock, 
    slot_unlimited: slot_unlimited ? 1 : 0,
    is_promo: is_promo ? 1 : 0, promo_context, 
    allow_send_media: allow_send_media ? 1 : 0
  };

  if (media_path) {
    updateData.media_path = media_path;
    updateData.media_type = 'image';
  } else if (delete_media) {
    updateData.media_path = null;
    updateData.media_type = 'none';
  }

  await db.knowledgeBase.update({
    where: { id },
    data: updateData
  });

  return { message: 'Data berhasil diupdate!' };
};

/**
 * Delete a knowledge_base entry.
 */
export const deleteKnowledge = async (db, id) => {
  console.log(`[Admin] Deleting knowledge ID=${id}`);
  await db.knowledgeBase.delete({ where: { id } });
  return { message: 'Data berhasil dihapus.' };
};

/**
 * Fetch knowledge_base entries, optionally filtered by type.
 */
export const fetchKnowledge = async (db, type = null) => {
  console.log(`[Admin] Fetching knowledge — type=${type || 'all'}`);
  return await db.knowledgeBase.findMany({
    where: type ? { type } : undefined,
    orderBy: { id: 'desc' }
  });
};

/**
 * Save/update store configuration.
 */
export const saveStoreConfig = async (db, config) => {
  const { biteship_token, biteship_origin, link_form_order, public_base_url = '' } = config;
  console.log('[Admin] Saving store config');

  const configData = JSON.stringify({
    api_key: biteship_token,
    origin_id: biteship_origin,
    form_url: link_form_order,
    public_base_url: public_base_url.replace(/\/+$/, ''),
  });

  const existing = await db.knowledgeBase.findFirst({
    where: { type: 'store_config' }
  });

  if (existing) {
    await db.knowledgeBase.update({
      where: { id: existing.id },
      data: { content_text: configData }
    });
  } else {
    await db.knowledgeBase.create({
      data: {
        type: 'store_config',
        title: 'Konfigurasi Toko',
        content_text: configData
      }
    });
  }

  return { message: 'Konfigurasi & Link Form Disimpan!' };
};

/**
 * Fetch store configuration.
 */
export const fetchStoreConfig = async (db) => {
  console.log('[Admin] Fetching store config');
  const existing = await db.knowledgeBase.findFirst({
    where: { type: 'store_config' }
  });

  if (!existing || !existing.content_text) return null;

  try {
    return JSON.parse(existing.content_text);
  } catch {
    return null;
  }
};

/**
 * Manage WhatsApp session.
 */
export const manageWaSession = async (db, action, sessionId) => {
  console.log(`[Admin] WA session action=${action}, session=${sessionId}`);

  switch (action) {
    case 'status': {
      const session = await db.sessionManager.findUnique({
        where: { session_id: sessionId }
      });
      if (session) {
        return { wa_status: session.status, qr_code: session.qr_code };
      }
      return { wa_status: 'OFFLINE' };
    }
    case 'start':
      await db.sessionManager.update({
        where: { session_id: sessionId },
        data: { command: 'start' }
      });
      return { message: 'Perintah START dikirim ke sistem.' };
    case 'logout':
      await db.sessionManager.update({
        where: { session_id: sessionId },
        data: { command: 'logout' }
      });
      return { message: 'Perintah RESET dikirim. Sistem akan restart sesi...' };
    default:
      throw new Error(`Unknown WA action: ${action}`);
  }
};

export default {
  saveKnowledge, editKnowledge, deleteKnowledge, fetchKnowledge,
  saveStoreConfig, fetchStoreConfig, manageWaSession,
};
