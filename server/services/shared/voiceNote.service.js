/**
 * ================================================================
 * Voice Note Service — Speech-to-Text Transcription
 * ================================================================
 * Menangani download dan transkripsi voice note (VN) dari pelanggan.
 * Mendukung audio dari URL (Remote media URL).
 *
 * Menggunakan format API OpenAI Whisper-compatible:
 *   POST /v1/audio/transcriptions
 *   Content-Type: multipart/form-data
 *
 * Provider yang didukung:
 *   - OpenAI Whisper
 *   - Groq (whisper-large-v3)
 *   - Local Whisper (via Docker)
 *   - Apapun yang compatible dengan format OpenAI
 *
 * Konfigurasi via .env:
 *   STT_API_URL, STT_API_KEY, STT_MODEL, STT_LANGUAGE
 * ================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory for VN audio exists
const vnUploadsDir = path.join(__dirname, '../../uploads/wa_media');
if (!fs.existsSync(vnUploadsDir)) {
  fs.mkdirSync(vnUploadsDir, { recursive: true });
}

/**
 * Transcribe audio buffer menggunakan STT API (OpenAI Whisper-compatible).
 *
 * @param {Buffer} audioBuffer - Audio data sebagai Buffer
 * @param {string} mimeType - MIME type audio (e.g. 'audio/ogg', 'audio/mpeg', 'video/ogg')
 * @param {string} [filename='audio.ogg'] - Nama file untuk multipart upload
 * @returns {Promise<string>} Transcript text, atau fallback message jika gagal
 */
export const transcribeAudio = async (audioBuffer, mimeType = 'audio/ogg', filename = 'audio.ogg') => {
  const sttUrl = process.env.STT_API_URL;
  const sttKey = process.env.STT_API_KEY;
  const sttModel = process.env.STT_MODEL || 'whisper-large-v3';
  const sttLanguage = process.env.STT_LANGUAGE || 'auto';

  if (!sttUrl) {
    console.warn('[VoiceNote] STT_API_URL belum dikonfigurasi di .env — VN tidak bisa ditranskrip');
    return '[Voice note diterima, tapi transkripsi belum dikonfigurasi]';
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    console.warn('[VoiceNote] Audio buffer kosong');
    return '[Voice note kosong]';
  }

  // Max file size check (25MB — Whisper API limit)
  const maxSize = 25 * 1024 * 1024;
  if (audioBuffer.length > maxSize) {
    console.warn(`[VoiceNote] Audio terlalu besar (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB > 25MB)`);
    return '[Voice note terlalu besar untuk ditranskrip]';
  }

  try {
    console.log(`[VoiceNote] Transcribing audio (${(audioBuffer.length / 1024).toFixed(1)}KB, ${mimeType})...`);

    // Detect API mode based on URL
    const isChatCompletions = sttUrl.includes('/chat/completions');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const headers = {};
    if (sttKey) {
      headers['Authorization'] = `Bearer ${sttKey}`;
    }

    let res;

    if (isChatCompletions) {
      // ── Mode: EdenAI / Multimodal Chat Completions ──
      // Kirim audio sebagai base64 dalam format messages
      console.log(`[VoiceNote] Using Chat Completions mode (EdenAI/multimodal)`);

      const audioBase64 = audioBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${audioBase64}`;

      const langInstruction = sttLanguage && sttLanguage !== 'auto'
        ? ` The audio is in ${sttLanguage} language.`
        : '';

      const payload = {
        model: sttModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  file_data: dataUri,
                },
              },
              {
                type: 'text',
                text: `Transcribe this audio EXACTLY as spoken — word for word, no paraphrasing.${langInstruction} Return ONLY the transcription text without any prefix, label, or explanation. If the audio is silent or unclear, return an empty string.`,
              },
            ],
          },
        ],
        temperature: 0,
      };

      headers['Content-Type'] = 'application/json';

      res = await fetch(sttUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        console.error(`[VoiceNote] STT API error (${res.status}):`, errorBody);
        return '[Voice note tidak dapat ditranskrip — error API]';
      }

      const data = await res.json();
      // Chat completions response format: { choices: [{ message: { content: "..." } }] }
      const transcript = data?.choices?.[0]?.message?.content?.trim();

      if (!transcript) {
        console.warn('[VoiceNote] Chat API returned empty transcript');
        return '[Voice note tanpa suara yang terdeteksi]';
      }

      console.log(`[VoiceNote] ✅ Transcript (${transcript.length} chars): "${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"`);
      return transcript;

    } else {
      // ── Mode: Whisper-compatible (OpenAI, Groq, Local) ──
      // Kirim audio sebagai multipart/form-data
      console.log(`[VoiceNote] Using Whisper API mode`);

      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', audioBlob, filename);
      formData.append('model', sttModel);

      if (sttLanguage && sttLanguage !== 'auto') {
        formData.append('language', sttLanguage);
      }

      res = await fetch(sttUrl, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        console.error(`[VoiceNote] STT API error (${res.status}):`, errorBody);
        return '[Voice note tidak dapat ditranskrip — error API]';
      }

      const data = await res.json();
      const transcript = data?.text?.trim();

      if (!transcript) {
        console.warn('[VoiceNote] Whisper API returned empty transcript');
        return '[Voice note tanpa suara yang terdeteksi]';
      }

      console.log(`[VoiceNote] ✅ Transcript (${transcript.length} chars): "${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"`);
      return transcript;
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[VoiceNote] STT API timeout (60s)');
      return '[Voice note tidak dapat ditranskrip — timeout]';
    }
    console.error('[VoiceNote] Transcription error:', err.message);
    return '[Voice note tidak dapat ditranskrip]';
  }
};

/**
 * Download audio dari URL lalu transcribe.
 *
 * @param {string} audioUrl - URL audio
 * @returns {Promise<{transcript: string, audioPath: string|null}>}
 */
export const transcribeFromUrl = async (audioUrl) => {
  if (!audioUrl) {
    return { transcript: '[Tidak ada URL audio]', audioPath: null };
  }

  try {
    console.log(`[VoiceNote] Downloading audio from URL: ${audioUrl}`);

    const headers = {};



    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(audioUrl, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[VoiceNote] Failed to download audio (${res.status}): ${audioUrl}`);
      return { transcript: '[Voice note tidak dapat diunduh]', audioPath: null };
    }

    const contentType = res.headers.get('content-type') || 'audio/ogg';
    const mimeType = contentType.split(';')[0].trim();
    const buffer = Buffer.from(await res.arrayBuffer());

    // Upload to Cloudinary for persistent storage
    let audioPath = null;
    try {
      const { uploadFromBuffer } = await import('./cloudinary.service.js');
      const cloudResult = await uploadFromBuffer(buffer, {
        folder: 'wa-media',
        resourceType: 'video', // Cloudinary uses 'video' for audio
      });
      audioPath = cloudResult.url;
      console.log(`[VoiceNote] Uploaded audio to Cloudinary: ${audioPath} (${(buffer.length / 1024).toFixed(1)}KB)`);
    } catch (cloudErr) {
      // Fallback: save locally
      const ext = mimeType.includes('ogg') ? 'ogg' 
                : mimeType.includes('mpeg') ? 'mp3' 
                : mimeType.includes('mp4') ? 'm4a'
                : mimeType.split('/')[1] || 'ogg';
      const filename = `vn_remote_${Date.now()}.${ext}`;
      const filePath = path.join(vnUploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
      audioPath = `/uploads/wa_media/${filename}`;
      console.warn(`[VoiceNote] Cloudinary upload failed, saved locally: ${audioPath}`);
    }

    // Transcribe
    const ext = mimeType.includes('ogg') ? 'ogg' 
              : mimeType.includes('mpeg') ? 'mp3' 
              : mimeType.includes('mp4') ? 'm4a'
              : mimeType.split('/')[1] || 'ogg';
    const filename = `vn_remote_${Date.now()}.${ext}`;
    const transcript = await transcribeAudio(buffer, mimeType, filename);

    return { transcript, audioPath };

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[VoiceNote] Audio download timeout (30s)');
      return { transcript: '[Voice note tidak dapat diunduh — timeout]', audioPath: null };
    }
    console.error('[VoiceNote] transcribeFromUrl error:', err.message);
    return { transcript: '[Voice note tidak dapat diproses]', audioPath: null };
  }
};

/**
 * Transcribe audio dari file lokal (WA Web saved audio).
 *
 * @param {string} filePath - Absolute path ke file audio
 * @returns {Promise<string>} Transcript text
 */
export const transcribeFromFile = async (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`[VoiceNote] File not found: ${filePath}`);
    return '[Voice note file tidak ditemukan]';
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).substring(1) || 'ogg';
    const mimeMap = {
      'ogg': 'audio/ogg',
      'opus': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'mpeg': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
    };
    const mimeType = mimeMap[ext] || 'audio/ogg';
    const filename = path.basename(filePath);

    return await transcribeAudio(buffer, mimeType, filename);

  } catch (err) {
    console.error('[VoiceNote] transcribeFromFile error:', err.message);
    return '[Voice note tidak dapat ditranskrip]';
  }
};

/**
 * Cek apakah sebuah MIME type adalah audio/voice note.
 *
 * @param {string} mimeType - MIME type string
 * @returns {boolean}
 */
export const isAudioMime = (mimeType) => {
  if (!mimeType) return false;
  return mimeType.startsWith('audio/') || mimeType === 'video/ogg';
};

export default {
  transcribeAudio,
  transcribeFromUrl,
  transcribeFromFile,
  isAudioMime,
};
