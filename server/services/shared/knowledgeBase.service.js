/**
 * ================================================================
 * Knowledge Base Service
 * ================================================================
 * Handles DB operations for AI Knowledge Base (topics/custom_info).
 */

import prisma from '../../config/database.js';
import { upsertDocument, deleteDocument } from '../ai_agent/vector.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';

/**
 * Fetch all Knowledge Base topics for a specific tenant.
 * We filter by type='custom_info' to separate from products.
 */
export const getTopics = async (tenantId) => {
  return await prisma.knowledgeBase.findMany({
    where: {
      tenant_id: tenantId,
      type: 'custom_info',
    },
    orderBy: {
      id: 'desc',
    },
  });
};

/**
 * Create a new Knowledge Base topic.
 */
export const createTopic = async (tenantId, data) => {
  const { title, content_text, ai_context, allow_send_media, media_path } = data;
  
  const result = await prisma.knowledgeBase.create({
    data: {
      tenant_id: tenantId,
      type: 'custom_info',
      title,
      content_text,
      ai_context,
      allow_send_media: allow_send_media ? 1 : 0,
      media_path,
    },
  });

  // Trigger Redis Vector Sync
  const textRepresentation = `Judul: ${result.title}\nTipe: ${result.type}\nKonten: ${result.content_text}\nKonteks Tambahan: ${result.ai_context || ''}\nInfo Promo: ${result.promo_context || ''}`;
  upsertDocument(tenantId, 'KnowledgeBase', result.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

  // Embed KB text as kb_direct for deep read vector search
  const kbEmbedText = `[KB Topic: ${result.title}]\n\nKonten:\n${result.content_text || '-'}\n\nKonteks AI:\n${result.ai_context || '-'}`;
  embeddingService.chunkAndEmbed(tenantId, 'kb_direct', result.id, kbEmbedText).catch(err => console.error('[KB] kb_direct embed error:', err.message));

  return result;
};

/**
 * Update an existing Knowledge Base topic.
 */
export const updateTopic = async (tenantId, topicId, data) => {
  const { title, content_text, ai_context, allow_send_media, media_path } = data;
  
  // Verify ownership first
  const existing = await prisma.knowledgeBase.findFirst({
    where: { id: parseInt(topicId), tenant_id: tenantId }
  });
  
  if (!existing) {
    throw new Error('Topic not found or unauthorized');
  }

  const result = await prisma.knowledgeBase.update({
    where: { id: parseInt(topicId) },
    data: {
      title,
      content_text,
      ai_context,
      allow_send_media: allow_send_media ? 1 : 0,
      media_path,
      updated_at: new Date()
    },
  });

  // Trigger Redis Vector Sync
  const textRepresentation = `Judul: ${result.title}\nTipe: ${result.type}\nKonten: ${result.content_text}\nKonteks Tambahan: ${result.ai_context || ''}\nInfo Promo: ${result.promo_context || ''}`;
  upsertDocument(tenantId, 'KnowledgeBase', result.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

  // Re-embed KB text as kb_direct (chunkAndEmbed auto-deletes old chunks first)
  const kbEmbedText = `[KB Topic: ${result.title}]\n\nKonten:\n${result.content_text || '-'}\n\nKonteks AI:\n${result.ai_context || '-'}`;
  embeddingService.chunkAndEmbed(tenantId, 'kb_direct', result.id, kbEmbedText).catch(err => console.error('[KB] kb_direct re-embed error:', err.message));

  return result;
};

/**
 * Delete a Knowledge Base topic.
 */
export const deleteTopic = async (tenantId, topicId) => {
  // Verify ownership first
  const existing = await prisma.knowledgeBase.findFirst({
    where: { id: parseInt(topicId), tenant_id: tenantId }
  });
  
  if (!existing) {
    throw new Error('Topic not found or unauthorized');
  }

  const result = await prisma.knowledgeBase.delete({
    where: { id: parseInt(topicId) },
  });

  // Trigger Vector Delete
  deleteDocument(tenantId, 'KnowledgeBase', result.id).catch(err => console.error('Vector Delete Error:', err.message));

  // Delete kb_direct embedding chunks
  embeddingService.deleteChunks(tenantId, 'kb_direct', result.id).catch(err => console.error('[KB] kb_direct delete error:', err.message));

  return result;
};
