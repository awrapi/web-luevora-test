import * as KnowledgeBaseService from '../../services/shared/knowledgeBase.service.js';
import { uploadBufferToStorage } from '../../services/shared/storage.service.js';
import { embeddingService } from '../../services/deep_rag_engine/embedding.service.js';
import { executeFastJsonAI } from '../../services/ai_agent/logic.service.js';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Get all Knowledge Base topics for the current tenant.
 */
export const getTopics = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const topics = await KnowledgeBaseService.getTopics(tenantId);
    
    // Map integer booleans to standard booleans for frontend
    const formattedTopics = topics.map(t => ({
      ...t,
      allow_send_media: t.allow_send_media === 1
    }));
    
    res.json({ success: true, data: formattedTopics });
  } catch (error) {
    console.error('[KnowledgeBaseController] Error fetching topics:', error);
    res.status(500).json({ success: false, message: 'Server error fetching topics.' });
  }
};

/**
 * Create a new Knowledge Base topic.
 */
export const createTopic = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const data = req.body;
    
    if (!data.title || !data.ai_context) {
      return res.status(400).json({ success: false, message: 'Title and AI context are required.' });
    }

    const newTopic = await KnowledgeBaseService.createTopic(tenantId, data);
    
    res.status(201).json({ 
      success: true, 
      data: { ...newTopic, allow_send_media: newTopic.allow_send_media === 1 } 
    });
  } catch (error) {
    console.error('[KnowledgeBaseController] Error creating topic:', error);
    res.status(500).json({ success: false, message: 'Server error creating topic.' });
  }
};

/**
 * Update an existing Knowledge Base topic.
 */
export const updateTopic = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const data = req.body;
    
    if (!data.title || !data.ai_context) {
      return res.status(400).json({ success: false, message: 'Title and AI context are required.' });
    }

    const updatedTopic = await KnowledgeBaseService.updateTopic(tenantId, id, data);
    
    res.json({ 
      success: true, 
      data: { ...updatedTopic, allow_send_media: updatedTopic.allow_send_media === 1 } 
    });
  } catch (error) {
    console.error('[KnowledgeBaseController] Error updating topic:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ success: false, message: 'Server error updating topic.' });
  }
};

/**
 * Delete a Knowledge Base topic.
 */
export const deleteTopic = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    
    await KnowledgeBaseService.deleteTopic(tenantId, id);
    
    res.json({ success: true, message: 'Topic deleted successfully.' });
  } catch (error) {
    console.error('[KnowledgeBaseController] Error deleting topic:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ success: false, message: 'Server error deleting topic.' });
  }
};/**
 * Extract text from an uploaded file buffer (PDF, DOCX, Excel).
 * Returns null for images or unsupported types.
 */
const extractTextFromBuffer = async (buffer, originalname) => {
  try {
    const ext = path.extname(originalname).toLowerCase();
    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text || null;
    } else if (ext === '.docx') {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const xlsx = (await import('xlsx')).default;
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += xlsx.utils.sheet_to_csv(sheet) + '\n\n';
      });
      return fullText || null;
    }
  } catch (err) {
    console.error(`[KbUpload] Text extraction failed for ${originalname}:`, err.message);
  }
  return null;
};

/**
 * Upload a media file for a Knowledge Base topic.
 * Also extracts text and starts async embedding for RAG search.
 */
export const uploadKbMedia = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const kbId = parseInt(req.query.kb_id) || null; // Optional: scope embedding to specific topic

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

    // 1. Upload file to storage (cloud/local)
    const fileUrl = await uploadBufferToStorage(buffer, originalname, mimetype, tenantId);

    // 2. Extract text from document files
    let extractedText = null;
    if (!isImage) {
      extractedText = await extractTextFromBuffer(buffer, originalname);
      if (extractedText) {
        console.log(`[KbUpload] Extracted ${extractedText.length} chars from "${originalname}"`);
      }
    }

    // 3. Fire-and-forget: chunk + embed text for vector search
    //    source_type = 'kb_direct', source_id = kbId (or a hash of fileUrl)
    if (extractedText && extractedText.trim().length > 50) {
      const sourceId = kbId || Math.abs(fileUrl.split('').reduce((a, c) => a + c.charCodeAt(0), 0)); // fallback to url hash
      const textToEmbed = `[File: ${originalname}]\n\n${extractedText}`;
      embeddingService.chunkAndEmbed(tenantId, 'kb_direct', sourceId, textToEmbed)
        .then(() => console.log(`[KbUpload] ✅ Embedding done for kb_direct:${sourceId}`))
        .catch(e => console.error(`[KbUpload] Embedding error:`, e.message));
    }

    res.json({
      success: true,
      file_path: fileUrl,
      has_text: !!extractedText,
      extracted_length: extractedText?.length || 0
    });
  } catch (error) {
    console.error('[KnowledgeBaseController] Error uploading media:', error);
    res.status(500).json({ success: false, message: 'Server error uploading file.' });
  }
};
