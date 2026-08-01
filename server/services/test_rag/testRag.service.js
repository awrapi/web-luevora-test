/**
 * ================================================================
 * TEST RAG PLAYGROUND — Backend Service
 * ================================================================
 * 
 * Standalone testing service for:
 * - Document upload + AI Summary + Vector Embedding
 * - Chat with RAG (Deep RAG Engine)
 * - Smart intent detection (need doc or not)
 * - Rolling memory (5-message window + compressed summary)
 * - Real-time activity logging
 * ================================================================
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { executeFastJsonAI } from '../ai_agent/logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import deepRagEngine from '../deep_rag_engine/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

// ============================================================
// IN-MEMORY STATE (per session, no DB needed for testing)
// ============================================================

const sessions = new Map(); // sessionId -> { document, messages, summary, logs }

const getSession = (sessionId) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      document: null,      // { fileName, extractedText, summary, embeddingStatus, fileId }
      messages: [],         // [{ role: 'user'|'assistant', content, timestamp }]
      summary: '',          // Rolling summary of conversation
      logs: [],             // [{ timestamp, level, source, message }]
    });
  }
  return sessions.get(sessionId);
};

const addLog = (sessionId, level, source, message) => {
  const session = getSession(sessionId);
  const log = {
    timestamp: new Date().toISOString(),
    level, // 'info' | 'warn' | 'error' | 'success' | 'ai'
    source, // 'System' | 'Upload' | 'Embedding' | 'RAG' | 'AI' | 'Memory'
    message,
  };
  session.logs.push(log);
  console.log(`[TestRAG][${source}] ${message}`);
  return log;
};

// ============================================================
// TEXT EXTRACTION
// ============================================================

const extractTextFromFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } else if (ext === '.docx') {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result.value;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath);
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += xlsx.utils.sheet_to_csv(sheet) + '\n\n';
      });
      return fullText;
    } else if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    throw new Error(`Gagal extract text: ${err.message}`);
  }
  return null;
};

// ============================================================
// TENANT ID (use 1 for testing)
// ============================================================
const TEST_TENANT_ID = 11;

// ============================================================
// PUBLIC API
// ============================================================

export const testRagService = {

  /**
   * Upload document → Extract text → AI Summary + Embedding (parallel)
   */
  uploadDocument: async (sessionId, file) => {
    const session = getSession(sessionId);
    const startTime = Date.now();

    addLog(sessionId, 'info', 'Upload', `📄 File diterima: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);

    // Step 1: Extract text
    addLog(sessionId, 'info', 'Upload', `🔍 Extracting text dari ${path.extname(file.originalname)}...`);
    const extractedText = await extractTextFromFile(file.path);

    if (!extractedText || extractedText.trim().length < 10) {
      addLog(sessionId, 'error', 'Upload', `❌ Gagal extract text — file mungkin berupa gambar atau kosong`);
      return { success: false, error: 'Gagal extract text dari dokumen' };
    }

    const wordCount = extractedText.split(/\s+/).length;
    addLog(sessionId, 'success', 'Upload', `✅ Text extracted: ${wordCount} kata, ${extractedText.length} karakter`);

    // Generate a unique source ID for this upload session
    const sourceId = Date.now();

    // Step 2: AI Summary + Embedding (PARALLEL)
    addLog(sessionId, 'info', 'AI', `🧠 Memulai AI Summary + Vector Embedding secara paralel...`);
    addLog(sessionId, 'ai', 'AI', `📡 Model Summary: ${process.env.EDENAI_MODEL || 'gpt-4o-mini'}`);
    addLog(sessionId, 'ai', 'Embedding', `📡 Model Embedding: ${process.env.EMBEDDING_MODEL || 'nomic-embed-text'} @ ${process.env.EMBEDDING_API_URL || 'localhost:11434'}`);

    const [summaryResult, embeddingResult] = await Promise.allSettled([
      // AI Summary
      (async () => {
        const sumStart = Date.now();
        addLog(sessionId, 'info', 'AI', `📝 Generating summary...`);
        
        const shortened = extractedText.length > 4000 
          ? extractedText.substring(0, 2000) + '\n\n...[DIPOTONG]...\n\n' + extractedText.substring(extractedText.length - 2000)
          : extractedText;

        const result = await executeFastJsonAI(TEST_TENANT_ID,
          `Kamu adalah asisten analisis dokumen. Baca isi dokumen berikut dan buat ringkasan padat (3-5 kalimat) dalam Bahasa Indonesia. Jelaskan apa isi utama dokumen, topik-topik kunci, dan informasi penting. Output HARUS murni JSON: { "summary": "..." }`,
          `Nama File: ${file.originalname}\n\nIsi Dokumen:\n${shortened}`
        );
        
        const duration = Date.now() - sumStart;
        addLog(sessionId, 'success', 'AI', `✅ Summary selesai (${duration}ms)`);
        return result?.summary || 'Dokumen berisi informasi yang perlu dibaca lebih lanjut.';
      })(),

      // Vector Embedding
      (async () => {
        const embStart = Date.now();
        addLog(sessionId, 'info', 'Embedding', `🔗 Chunking & embedding ${wordCount} kata...`);
        await embeddingService.chunkAndEmbed(TEST_TENANT_ID, 'test_rag', sourceId, extractedText);
        const duration = Date.now() - embStart;
        
        // Count chunks created
        const chunkCount = await prisma.document_chunks.count({
          where: { tenant_id: TEST_TENANT_ID, source_type: 'test_rag', source_id: sourceId }
        });
        
        addLog(sessionId, 'success', 'Embedding', `✅ Embedding selesai: ${chunkCount} chunks (${duration}ms)`);
        return { chunkCount, duration };
      })()
    ]);

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : 'Gagal membuat summary';
    const embedding = embeddingResult.status === 'fulfilled' ? embeddingResult.value : null;

    if (summaryResult.status === 'rejected') {
      addLog(sessionId, 'error', 'AI', `❌ Summary gagal: ${summaryResult.reason?.message}`);
    }
    if (embeddingResult.status === 'rejected') {
      addLog(sessionId, 'error', 'Embedding', `❌ Embedding gagal: ${embeddingResult.reason?.message}`);
    }

    // Save to session
    session.document = {
      fileName: file.originalname,
      extractedText,
      summary,
      embeddingStatus: embedding ? `${embedding.chunkCount} chunks` : 'failed',
      sourceId,
      wordCount,
    };

    const totalDuration = Date.now() - startTime;
    addLog(sessionId, 'success', 'System', `🎉 Upload selesai dalam ${totalDuration}ms`);

    return {
      success: true,
      fileName: file.originalname,
      wordCount,
      charCount: extractedText.length,
      summary,
      embeddingChunks: embedding?.chunkCount || 0,
      totalDuration,
    };
  },

  /**
   * Chat with RAG — Smart intent detection + rolling memory
   */
  chat: async (sessionId, userMessage) => {
    const session = getSession(sessionId);
    const startTime = Date.now();

    // Add user message
    session.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
    addLog(sessionId, 'info', 'System', `💬 User: "${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}"`);

    // Step 1: Build memory context (last 5 messages + rolling summary)
    const recentMessages = session.messages.slice(-10); // last 5 pairs
    let memoryContext = '';
    if (session.summary) {
      memoryContext += `[RINGKASAN PERCAKAPAN SEBELUMNYA]:\n${session.summary}\n\n`;
    }
    memoryContext += `[PERCAKAPAN TERAKHIR]:\n`;
    recentMessages.forEach(m => {
      memoryContext += `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}\n`;
    });

    addLog(sessionId, 'info', 'Memory', `📋 Context: ${session.summary ? 'Summary + ' : ''}${recentMessages.length} pesan terakhir`);

    // Step 2: Decide if we need to read document (RAG intent)
    let needsDocument = false;
    let ragAnswer = null;

    if (session.document) {
      addLog(sessionId, 'ai', 'RAG', `🤔 Reasoning: Apakah perlu baca dokumen "${session.document.fileName}"?`);
      addLog(sessionId, 'ai', 'RAG', `📡 Model: ${process.env.EDENAI_MODEL || 'gpt-4o-mini'}`);

      const intentResult = await executeFastJsonAI(TEST_TENANT_ID,
        `Kamu adalah router cerdas. Tentukan apakah pertanyaan user membutuhkan informasi dari dokumen "${session.document.fileName}" atau bisa dijawab langsung (chitchat, salam, pertanyaan umum).

Ringkasan dokumen: "${session.document.summary}"

Pertanyaan: "${userMessage}"

Output JSON: { "needsDocument": true/false, "reason": "alasan singkat" }`,
        `Konteks percakapan:\n${memoryContext}\n\nPertanyaan terbaru: "${userMessage}"`
      );

      needsDocument = intentResult?.needsDocument === true;
      addLog(sessionId, needsDocument ? 'warn' : 'info', 'RAG', 
        needsDocument 
          ? `📖 PERLU baca dokumen — ${intentResult?.reason || 'relevan dengan isi dokumen'}`
          : `💬 TIDAK perlu baca dokumen — ${intentResult?.reason || 'chitchat / pertanyaan umum'}`
      );

      // Step 3: If needed, search document via Deep RAG Engine
      if (needsDocument) {
        addLog(sessionId, 'info', 'RAG', `🔍 Starting Deep RAG search...`);
        const searchStart = Date.now();

        const searchResult = await deepRagEngine.search(
          TEST_TENANT_ID, userMessage, session.document.extractedText,
          { 
            title: session.document.fileName, 
            summary: session.document.summary,
            sourceType: 'test_rag',
            sourceId: session.document.sourceId,
          }
        );

        const searchDuration = Date.now() - searchStart;

        if (searchResult.found) {
          ragAnswer = searchResult.answer;
          addLog(sessionId, 'success', 'RAG', `✅ Jawaban ditemukan dari dokumen (${searchDuration}ms)`);
        } else {
          addLog(sessionId, 'warn', 'RAG', `⚠️ Tidak ditemukan jawaban spesifik di dokumen (${searchDuration}ms)`);
        }
      }
    } else {
      addLog(sessionId, 'info', 'RAG', `📭 Tidak ada dokumen di-upload — mode chitchat`);
    }

    // Step 4: Generate final response
    addLog(sessionId, 'ai', 'AI', `🧠 Generating response...`);
    addLog(sessionId, 'ai', 'AI', `📡 Model: ${process.env.EDENAI_MODEL || 'gpt-4o-mini'}`);

    let systemPrompt = `Kamu adalah asisten AI yang cerdas, ramah, dan membantu. Jawab dalam Bahasa Indonesia yang natural dan informatif.`;
    
    if (session.document) {
      systemPrompt += `\n\nKamu memiliki akses ke dokumen "${session.document.fileName}".`;
      systemPrompt += `\nRingkasan dokumen: ${session.document.summary}`;
    }

    if (ragAnswer) {
      systemPrompt += `\n\n[INFORMASI DARI DOKUMEN — GUNAKAN INI UNTUK MENJAWAB]:\n${ragAnswer}`;
    }

    if (session.summary) {
      systemPrompt += `\n\n[RINGKASAN PERCAKAPAN SEBELUMNYA]:\n${session.summary}`;
    }

    systemPrompt += `\n\nJANGAN kembalikan JSON. Jawab secara natural dalam teks biasa.`;

    // Use EdenAI chat completion directly
    const useEdenAI = process.env.USE_EDENAI === 'true';
    let aiResponse = '';

    try {
      if (useEdenAI) {
        const edenAiApiKey = process.env.EDENAI_API_KEY;
        const model = process.env.EDENAI_MODEL || 'openai/gpt-4o-mini';
        const apiUrl = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';

        const chatMessages = [
          { role: 'system', content: systemPrompt },
        ];

        // Add recent messages for context
        recentMessages.forEach(m => {
          chatMessages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content });
        });

        // Add current message
        chatMessages.push({ role: 'user', content: userMessage });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${edenAiApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: chatMessages, temperature: 0.7, max_tokens: 2000 })
        });

        const data = await res.json();
        aiResponse = data?.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa menjawab saat ini.';
      } else {
        // OpenAI fallback
        const { ChatOpenAI } = await import('@langchain/openai');
        const chatModel = new ChatOpenAI({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
        });
        const messages = [['system', systemPrompt]];
        recentMessages.forEach(m => {
          messages.push([m.role === 'user' ? 'human' : 'ai', m.content]);
        });
        messages.push(['human', userMessage]);
        const response = await chatModel.invoke(messages);
        aiResponse = response.content;
      }
    } catch (err) {
      addLog(sessionId, 'error', 'AI', `❌ AI Error: ${err.message}`);
      aiResponse = 'Maaf, terjadi error saat memproses respons.';
    }

    const totalDuration = Date.now() - startTime;
    addLog(sessionId, 'success', 'AI', `✅ Response generated (${totalDuration}ms, ${aiResponse.length} chars)`);

    // Save assistant message
    session.messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    // Step 5: Rolling memory — every 5 message pairs, compress summary
    const msgCount = session.messages.filter(m => m.role === 'user').length;
    if (msgCount > 0 && msgCount % 5 === 0) {
      addLog(sessionId, 'info', 'Memory', `🔄 Compressing memory (${msgCount} user messages)...`);

      try {
        const last10 = session.messages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
        const prevSummary = session.summary || '(belum ada)';

        const memResult = await executeFastJsonAI(TEST_TENANT_ID,
          `Kamu adalah memory manager. Buat ringkasan padat dari percakapan di bawah ini. Gabungkan dengan ringkasan sebelumnya. Fokus pada topik-topik penting, pertanyaan user, dan informasi yang sudah diberikan. Max 150 kata. Output JSON: { "summary": "..." }`,
          `Ringkasan sebelumnya: ${prevSummary}\n\nPercakapan terbaru:\n${last10}`
        );

        if (memResult?.summary) {
          session.summary = memResult.summary;
          addLog(sessionId, 'success', 'Memory', `✅ Memory diperbarui: "${session.summary.substring(0, 100)}..."`);
        }
      } catch (err) {
        addLog(sessionId, 'error', 'Memory', `❌ Memory compression error: ${err.message}`);
      }
    }

    return {
      response: aiResponse,
      usedDocument: needsDocument,
      ragAnswer: ragAnswer ? true : false,
      duration: totalDuration,
      messageCount: session.messages.length,
    };
  },

  /**
   * Get logs for a session
   */
  getLogs: (sessionId) => {
    const session = getSession(sessionId);
    return session.logs;
  },

  /**
   * Get session info
   */
  getSession: (sessionId) => {
    const session = getSession(sessionId);
    return {
      hasDocument: !!session.document,
      document: session.document ? {
        fileName: session.document.fileName,
        summary: session.document.summary,
        wordCount: session.document.wordCount,
        embeddingStatus: session.document.embeddingStatus,
      } : null,
      messageCount: session.messages.length,
      hasSummary: !!session.summary,
      summary: session.summary,
    };
  },

  /**
   * Reset session
   */
  resetSession: async (sessionId) => {
    const session = getSession(sessionId);
    
    // Clean up embeddings if exists
    if (session.document?.sourceId) {
      await embeddingService.deleteChunks(TEST_TENANT_ID, 'test_rag', session.document.sourceId)
        .catch(e => console.error('Cleanup error:', e.message));
    }

    sessions.delete(sessionId);
    return { success: true };
  }
};
