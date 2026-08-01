import prisma from '../../config/database.js';

/**
 * Central Info Request Service
 * 
 * Manages AI knowledge gap requests — when the AI encounters questions it cannot
 * answer from its knowledge base, it creates a record here so admin can provide
 * instructions or take over the conversation.
 * 
 * Multiple unknown questions from the same customer are consolidated into ONE record.
 */

/**
 * Create a new request or append questions to an existing pending/instructed record.
 * Consolidation: if a pending/instructed record already exists for this tenant+phone,
 * the new question is APPENDED to the existing `questions` field.
 * 
 * @param {number} tenantId
 * @param {string} phone
 * @param {string|null} customerName
 * @param {string} questionSummary - Summary of what the customer asked that AI couldn't answer
 * @param {string|null} conversationContext - Recent chat context for admin reference
 */
export const createOrUpdateRequest = async (tenantId, phone, customerName, questionSummary, conversationContext, aiNotes = null, requiredInfo = null) => {
  try {
    // Look for existing pending or instructed record
    const existing = await prisma.centralInfoRequest.findFirst({
      where: {
        tenant_id: tenantId,
        phone: phone,
        status: { in: ['pending', 'instructed'] }
      },
      orderBy: { created_at: 'desc' }
    });

    // If no customer name provided, try to look it up from Lead
    if (!customerName) {
      try {
        const lead = await prisma.lead.findFirst({
          where: { tenant_id: tenantId, phone },
          select: { saved_name: true, first_name: true, last_name: true, push_name: true }
        });
        if (lead) {
          customerName = lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null;
        }
      } catch {}
    }

    if (existing) {
      // FIX: Overwrite `questions` (Laporan AI) with the latest report — NOT append.
      // Appending caused double-report in the UI. The latest AI summary is always
      // the most accurate, so we replace the old one.
      // We DO keep appending conversation_context and ai_notes for history.
      const updatedContext = conversationContext
        ? (existing.conversation_context || '') + '\n\n[UPDATE KONTEKS TERAKHIR]\n' + conversationContext
        : existing.conversation_context;

      // Merge ai_notes: append new notes to existing
      const updatedNotes = aiNotes
        ? (existing.ai_notes ? existing.ai_notes + '\n' + aiNotes : aiNotes)
        : existing.ai_notes;

      // If status was 'instructed', reset to 'pending' since there's a new question
      const newStatus = existing.status === 'instructed' ? 'pending' : existing.status;

      await prisma.centralInfoRequest.update({
        where: { id: existing.id },
        data: {
          questions: questionSummary,   // ← overwrite, not append
          conversation_context: updatedContext,
          customer_name: customerName || existing.customer_name,
          ai_notes: updatedNotes,
          status: newStatus,
          updated_at: new Date()
        }
      });

      console.log(`[CentralInfo] Updated (overwrite) questions for request #${existing.id} for ${phone}. New status: ${newStatus}`);
      return { id: existing.id, consolidated: true };
    } else {
      // Create new record
      const newRequest = await prisma.centralInfoRequest.create({
        data: {
          tenant_id: tenantId,
          phone: phone,
          customer_name: customerName,
          questions: questionSummary || '(Pertanyaan tidak terdeteksi secara otomatis)',
          conversation_context: conversationContext,
          ai_notes: aiNotes,
          required_info: requiredInfo || null,
          status: 'pending'
        }
      });

      console.log(`[CentralInfo] Created new request #${newRequest.id} for ${phone}`);
      return { id: newRequest.id, consolidated: false };
    }
  } catch (error) {
    console.error('[CentralInfo] createOrUpdateRequest error:', error.message);
    return null;
  }
};

/**
 * Get all requests for a tenant, optionally filtered by status.
 * @param {number} tenantId
 * @param {string|null} status - 'pending', 'instructed', 'taken_over', 'resolved', or null for all
 */
export const getRequests = async (tenantId, status = null) => {
  try {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;

    const requests = await prisma.centralInfoRequest.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });

    return requests;
  } catch (error) {
    console.error('[CentralInfo] getRequests error:', error.message);
    return [];
  }
};

/**
 * Admin provides an instruction for AI to answer the customer's question.
 * Status changes to 'instructed'.
 * 
 * @param {number} requestId
 * @param {number} tenantId
 * @param {string} instruction - What admin wants AI to say to the customer
 * @param {string|null} adminName - Name of the admin who gave the instruction
 */
export const setAdminInstruction = async (requestId, tenantId, instruction, adminName = null) => {
  try {
    const updated = await prisma.centralInfoRequest.update({
      where: { id: requestId, tenant_id: tenantId },
      data: {
        admin_instruction: instruction,
        status: 'instructed',
        handled_by: adminName,
        updated_at: new Date()
      }
    });

    console.log(`[CentralInfo] Admin instruction set for request #${requestId} by ${adminName || 'admin'}`);
    return updated;
  } catch (error) {
    console.error('[CentralInfo] setAdminInstruction error:', error.message);
    return null;
  }
};

/**
 * Admin takes over the conversation manually.
 * Status changes to 'taken_over'.
 * 
 * @param {number} requestId
 * @param {number} tenantId
 * @param {string|null} adminName
 */
export const markTakenOver = async (requestId, tenantId, adminName = null) => {
  try {
    const updated = await prisma.centralInfoRequest.update({
      where: { id: requestId, tenant_id: tenantId },
      data: {
        status: 'taken_over',
        handled_by: adminName,
        updated_at: new Date()
      }
    });

    console.log(`[CentralInfo] Request #${requestId} taken over by ${adminName || 'admin'}`);
    return updated;
  } catch (error) {
    console.error('[CentralInfo] markTakenOver error:', error.message);
    return null;
  }
};

/**
 * Mark a request as resolved (admin instruction was delivered to customer successfully).
 * 
 * @param {number} requestId
 * @param {number} tenantId
 */
export const markResolved = async (requestId, tenantId) => {
  try {
    const updated = await prisma.centralInfoRequest.update({
      where: { id: requestId, tenant_id: tenantId },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`[CentralInfo] Request #${requestId} resolved`);
    return updated;
  } catch (error) {
    console.error('[CentralInfo] markResolved error:', error.message);
    return null;
  }
};

/**
 * Check if there's a pending instruction (status='instructed') for this customer.
 * Returns the admin_instruction text if found, null otherwise.
 * 
 * @param {number} tenantId
 * @param {string} phone
 * @returns {Promise<{instruction: string, requestId: number}|null>}
 */
export const getPendingInstructionForCustomer = async (tenantId, phone) => {
  try {
    const request = await prisma.centralInfoRequest.findFirst({
      where: {
        tenant_id: tenantId,
        phone: phone,
        status: 'instructed',
        admin_instruction: { not: null }
      },
      orderBy: { updated_at: 'desc' }
    });

    if (request && request.admin_instruction) {
      return {
        instruction: request.admin_instruction,
        requestId: request.id,
        questions: request.questions
      };
    }
    return null;
  } catch (error) {
    console.error('[CentralInfo] getPendingInstructionForCustomer error:', error.message);
    return null;
  }
};
