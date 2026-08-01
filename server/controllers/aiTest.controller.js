import { executePlainAI, summarizeImage, executeFastJsonAI } from '../services/ai_agent/logic.service.js';
import { deepRagEngine } from '../services/deep_rag_engine/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /api/ai-test/chat
 * Body: { message, image? (base64 data URI), document? (text), chatHistory? (array of {role, content}) }
 */
export const chat = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { message, image, document, chatHistory = [] } = req.body;

    if (!message && !image && !document) {
      return res.status(400).json({ success: false, message: 'Pesan, gambar, atau dokumen wajib diisi.' });
    }

    const startTime = Date.now();
    let mode = 'text';
    let aiReply = '';
    let meta = {};

    // ── Build chat memory (last 5 + summary of older) ──
    const buildMemoryBlock = (history) => {
      if (!history || history.length === 0) return '';
      const recent = history.slice(-5);
      const older = history.slice(0, -5);
      let block = '';
      if (older.length > 0) {
        block += `[RINGKASAN ${older.length} PESAN SEBELUMNYA]\n`;
        block += older.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
        block += '\n\n';
      }
      block += `[${recent.length} PESAN TERAKHIR]\n`;
      block += recent.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
      return block;
    };

    const memoryBlock = buildMemoryBlock(chatHistory);

    // ── MODE 1: Image Analysis ──
    if (image) {
      mode = 'image';
      const imgData = parseBase64Image(image);
      if (!imgData) {
        return res.status(400).json({ success: false, message: 'Format gambar tidak valid. Gunakan base64 data URI.' });
      }

      // Use vision AI to analyze
      const systemPrompt = `Anda adalah AI asisten yang menganalisis gambar. Berikan deskripsi detail tentang isi gambar, identifikasi objek, teks yang terlihat, dan konteksnya. Jawab dalam bahasa Indonesia.`;
      const userPrompt = message || 'Analisis gambar ini secara detail.';

      const images = [{ mimeType: imgData.mimeType, base64: imgData.base64 }];
      aiReply = await executePlainAI(tenantId, systemPrompt, userPrompt, images);

      // If user also asked a question about the image, do a second pass
      if (message && message.trim().length > 10) {
        meta.imageDescription = aiReply;
        const followUp = `Berdasarkan analisis gambar berikut:\n"${aiReply}"\n\nJawab pertanyaan user tentang gambar ini: "${message}"`;
        aiReply = await executePlainAI(tenantId, systemPrompt, followUp, images);
      }
    }

    // ── MODE 2: Document Q&A ──
    else if (document) {
      mode = 'document';
      const docText = typeof document === 'string' ? document : document.text || '';
      const docTitle = document.title || 'Dokumen';

      if (!docText || docText.trim().length < 10) {
        return res.status(400).json({ success: false, message: 'Dokumen terlalu pendek atau kosong.' });
      }

      meta.documentLength = docText.length;
      meta.documentWords = docText.split(/\s+/).length;

      // Use Deep RAG Engine for smart search
      const result = await deepRagEngine.search(
        tenantId,
        message || 'Jelaskan isi dokumen ini secara ringkas',
        docText,
        { title: docTitle, summary: null }
      );

      if (result.found && result.answer) {
        aiReply = result.answer;
        meta.ragMethod = result.method || 'search';
      } else {
        // Fallback: ask AI to summarize the document directly
        const sysPrompt = `Anda adalah AI asisten yang membaca dan menjelaskan dokumen. Berdasarkan dokumen yang diberikan, jawab pertanyaan user dengan akurat. Jika jawaban tidak ditemukan di dokumen, katakan dengan jujur. Jawab dalam bahasa Indonesia.`;
        const userPrompt = `${memoryBlock ? memoryBlock + '\n\n' : ''}[DOKUMEN: ${docTitle}]\n${docText.substring(0, 8000)}\n\nPertanyaan: ${message || 'Jelaskan isi dokumen ini secara ringkas dan poin-poin pentingnya.'}`;
        aiReply = await executePlainAI(tenantId, sysPrompt, userPrompt);
        meta.ragMethod = 'fallback-summarize';
      }
    }

    // ── MODE 3: Plain Text Chat (with memory) ──
    else {
      mode = 'text';
      const systemPrompt = `Anda adalah AI asisten yang cerdas dan ramah. Jawab pertanyaan user secara akurat, ringkas, dan helpful. Jawab dalam bahasa Indonesia.
${memoryBlock ? '\n\n[RIWAYAT PERCAKAPAN]\n' + memoryBlock : ''}`;

      aiReply = await executePlainAI(tenantId, systemPrompt, message);
    }

    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        reply: aiReply,
        mode,
        elapsed_ms: elapsed,
        model: process.env.EDENAI_MODEL || process.env.OPENAI_MODEL || 'unknown',
        meta,
      }
    });
  } catch (error) {
    console.error('[AI Test] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/ai-test/summarize
 * Body: { chatHistory: [{role, content}] }
 */
export const summarizeChat = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { chatHistory } = req.body;

    if (!chatHistory || chatHistory.length < 3) {
      return res.status(400).json({ success: false, message: 'Minimal 3 pesan untuk diringkas.' });
    }

    const transcript = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');

    const systemPrompt = `Buatlah ringkasan singkat dari percakapan berikut. Fokus pada topik utama, pertanyaan yang diajukan, dan jawaban yang diberikan. Maksimal 2-3 paragraf. Output dalam bahasa Indonesia.`;

    const summary = await executePlainAI(tenantId, systemPrompt, transcript);

    res.json({ success: true, data: { summary } });
  } catch (error) {
    console.error('[AI Test Summarize] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/ai-test/config
 * Returns current AI model configuration (safe - no secrets)
 */
export const getConfig = async (req, res) => {
  const model = process.env.EDENAI_MODEL || process.env.OPENAI_MODEL || 'unknown';
  const provider = process.env.USE_EDENAI === 'true' ? 'EdenAI' : 'OpenAI';
  const embeddingModel = process.env.EMBEDDING_MODEL || 'unknown';

  res.json({
    success: true,
    data: { model, provider, embeddingModel }
  });
};

// ── Helper ──
const parseBase64Image = (dataUri) => {
  if (!dataUri) return null;
  // Handle data:image/png;base64,xxxxx format
  const match = dataUri.match(/^data:(image\/[\w+]+);base64,(.+)$/i);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  // Handle raw base64
  if (/^[A-Za-z0-9+/=]+$/.test(dataUri)) {
    return { mimeType: 'image/jpeg', base64: dataUri };
  }
  return null;
};
