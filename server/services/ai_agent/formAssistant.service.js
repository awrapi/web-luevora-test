import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

/**
 * Helper to parse JSON output robustly
 */
const parseJsonResponse = (content) => {
  if (!content) return {};
  if (typeof content === 'object') return content;
  const cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    console.error("Failed to parse JSON", cleaned);
    return {};
  }
};

/**
 * Call LLM using either custom REST API (like EdenAI/OpenAI) or fallback to LangChain
 */
const callLLM = async (systemPrompt, userMessages, jsonMode = true, formModelOverride = null) => {
  const apiUrl = process.env.FORM_ASSISTANT_API_URL;
  const apiKey = process.env.FORM_ASSISTANT_API_KEY;
  // Priority: per-tier override → FORM_ASSISTANT_MODEL env → fallback
  const model = formModelOverride || process.env.FORM_ASSISTANT_MODEL || process.env.FORM_ASSISTANT_AI_MODEL || 'gpt-4o-mini';

  if (apiUrl && apiKey) {
    const payload = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages.map(m => ({
          role: m._getType ? (m._getType() === 'human' ? 'user' : 'assistant') : m.role,
          content: m.content || m
        }))
      ],
      temperature: 0.1,
      max_tokens: 3000
    };

    if (jsonMode) {
      if (apiUrl.includes('edenai')) {
         payload.response_format = { type: 'json_object' };
      } else {
         payload.response_format = { type: 'json_object' };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) throw new Error(`API Error: ${res.status} - ${JSON.stringify(data)}`);
      return data?.choices?.[0]?.message?.content || (jsonMode ? '{}' : '');
    } catch (err) {
      console.error("[Form Assistant] API Call Error:", err.message);
      return jsonMode ? '{}' : 'Maaf, terjadi kesalahan pada layanan AI.';
    }
  }

  const chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY || 'dummy',
    modelName: model,
    temperature: 0.1,
    maxRetries: 1,
    modelKwargs: jsonMode ? { response_format: { type: 'json_object' } } : {},
    configuration: { baseURL: process.env.OPENAI_BASE_URL }
  });

  const langchainMessages = [new SystemMessage(systemPrompt), ...userMessages.map(m => 
    m._getType ? m : (m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content))
  )];

  const response = await chatModel.invoke(langchainMessages);
  return response.content;
};

/**
 * 1. Router Agent (Divide and Conquer)
 */
export const routeCategory = async (userMessage, chatHistory) => {
  const systemPrompt = `
Anda adalah AI Router. Tugas Anda adalah mengklasifikasikan pesan pengguna ke salah satu dari kategori berikut, berdasarkan niat (intent) pengguna terhadap pengisian form travel:

Kategori yang tersedia:
- BASIC_INFO: Jika pengguna membahas judul, deskripsi, harga mulai, status, durasi, min/max pax.
- SUB_PACKAGES: Jika pengguna membahas tentang sub-paket (menambah, mengubah, menghapus sub-paket atau detail di dalamnya).
- CALENDAR: Jika pengguna membahas tentang tanggal keberangkatan, ketersediaan, rentang waktu buka, libur.
- PRICING: Jika pengguna membahas tentang fasilitas tambahan (addon) atau harga khusus tanggal tertentu (custom prices).
- GENERAL: Jika pesan ambigu atau berkaitan dengan keseluruhan.

Output HARUS JSON dengan format:
{ "category": "NAMA_KATEGORI" }
`;
  try {
    const recentHistory = chatHistory.slice(-2);
    const resContent = await callLLM(systemPrompt, [...recentHistory, { role: 'user', content: userMessage }], true);
    const parsed = parseJsonResponse(resContent);
    return parsed.category || 'GENERAL';
  } catch (err) {
    return 'GENERAL';
  }
};

/**
 * 2. Prune State & Schema (State Compression)
 */
export const pruneContext = (category, currentFormState, schema) => {
  let relevantSchemaNames = [];
  switch (category) {
    case 'BASIC_INFO':
      relevantSchemaNames = ['title', 'description', 'price', 'status', 'min_pax', 'max_pax', 'validity_type'];
      break;
    case 'SUB_PACKAGES':
      relevantSchemaNames = ['has_sub_items', 'sub_items'];
      break;
    case 'CALENDAR':
      relevantSchemaNames = ['schedule_enabled', 'availability_type', 'availability_rules', 'slot_mode', 'slot_daily', 'slot_total', 'is_shared_availability', 'is_shared_slot'];
      break;
    case 'PRICING':
      relevantSchemaNames = ['addons', 'custom_prices', 'is_promo'];
      break;
    default:
      relevantSchemaNames = schema.map(s => s.name);
  }

  const prunedSchema = schema.filter(s => relevantSchemaNames.includes(s.name) || s.required);
  
  const prunedState = {};
  for (const key of relevantSchemaNames) {
    if (currentFormState[key] !== undefined) {
      if (Array.isArray(currentFormState[key]) && currentFormState[key].length > 15) {
        prunedState[key] = [
          ...currentFormState[key].slice(0, 5), 
          `... (${currentFormState[key].length - 10} item lainnya disembunyikan)`, 
          ...currentFormState[key].slice(-5)
        ];
      } else {
        prunedState[key] = currentFormState[key];
      }
    }
  }
  
  return { prunedSchema, prunedState };
};

/**
 * 3. Action-Oriented Intent Extraction
 */
export const extractActions = async (userMessage, prunedState, prunedSchema) => {
  const systemPrompt = `
Anda adalah AI pengubah state Form Travel berbasis ACTION (Perintah).
Alih-alih mengembalikan seluruh array atau objek, Anda harus mengembalikan perintah-perintah perubahan (actions) untuk mengubah data.

Schema Field yang Aktif:
${JSON.stringify(prunedSchema, null, 2)}

Data Saat Ini:
${JSON.stringify(prunedState, null, 2)}

Tugas Anda: Buat daftar aksi (actions) berdasarkan permintaan pengguna.
Tipe aksi yang didukung:
1. "SET_FIELD": Untuk mengubah nilai primitif (string, number, boolean) atau array sederhana.
   - Contoh: { "type": "SET_FIELD", "field": "title", "value": "Paket Baru" }
2. "ADD_ARRAY_ITEM": Untuk menambah 1 item baru ke dalam field bertipe array (seperti addons, sub_items, availability_rules).
   - Contoh: { "type": "ADD_ARRAY_ITEM", "field": "addons", "value": { "title": "Sepeda", "price": "50000" } }
3. "UPDATE_ARRAY_ITEM": Untuk mengubah field spesifik di dalam suatu item array. Gunakan 'match' (kriteria pencarian) untuk menemukan item.
   - Contoh: { "type": "UPDATE_ARRAY_ITEM", "field": "sub_items", "match": { "title": "VIP" }, "value": { "price": "2000000" } }
4. "REMOVE_ARRAY_ITEM": Untuk menghapus item dari array.
   - Contoh: { "type": "REMOVE_ARRAY_ITEM", "field": "availability_rules", "match": { "rule_value": "2026-06-30" } }

Aturan Penting:
1. Anda HANYA BOLEH merespons dalam format JSON.
2. Format angka (seperti harga) harus berupa string angka (contoh: "1500000").
3. Jika pengguna minta menambahkan beberapa tanggal, hasilkan beberapa aksi "ADD_ARRAY_ITEM".
4. Hanya gunakan field yang ada di Schema.

Format Output Wajib:
{
  "actions": [
    { "type": "SET_FIELD", "field": "description", "value": "Deskripsi baru..." }
  ],
  "reasoning": "Penjelasan singkat apa yang diubah"
}
`;

  try {
    const resContent = await callLLM(systemPrompt, [{ role: 'user', content: userMessage }], true);
    return parseJsonResponse(resContent);
  } catch (error) {
    console.error("[Form Assistant] Error in extractActions:", error);
    return { actions: [] };
  }
};

/**
 * 4. State Executor (Native JS)
 */
export const executeActions = (currentFormState, actions) => {
  const simulatedState = { ...currentFormState };
  const fieldsToUpdate = {};

  if (!actions || !Array.isArray(actions)) return { simulatedState, fieldsToUpdate };

  for (const action of actions) {
    const field = action.field;
    if (!field) continue;

    if (action.type === 'SET_FIELD') {
      simulatedState[field] = action.value;
      fieldsToUpdate[field] = action.value;
    } 
    else if (action.type === 'ADD_ARRAY_ITEM') {
      if (!Array.isArray(simulatedState[field])) simulatedState[field] = [];
      simulatedState[field] = [...simulatedState[field], action.value];
      fieldsToUpdate[field] = simulatedState[field];
    }
    else if (action.type === 'UPDATE_ARRAY_ITEM') {
      if (!Array.isArray(simulatedState[field])) continue;
      const match = action.match || {};
      const newArray = simulatedState[field].map(item => {
        let isMatch = true;
        for (const k in match) {
          if (item[k] !== match[k]) isMatch = false;
        }
        if (isMatch) return { ...item, ...action.value };
        return item;
      });
      simulatedState[field] = newArray;
      fieldsToUpdate[field] = newArray;
    }
    else if (action.type === 'REMOVE_ARRAY_ITEM') {
      if (!Array.isArray(simulatedState[field])) continue;
      const match = action.match;
      if (!match || Object.keys(match).length === 0) continue;
      const newArray = simulatedState[field].filter(item => {
        let isMatch = true;
        for (const k in match) {
          if (item[k] !== match[k]) isMatch = false;
        }
        return !isMatch; // filter out if it matches
      });
      simulatedState[field] = newArray;
      fieldsToUpdate[field] = newArray;
    }
  }

  return { simulatedState, fieldsToUpdate };
};

/**
 * 5. Formulate Next Question (Communicator)
 */
export const formulateNextQuestion = async (updatedFormState, schema, chatHistory, actionsReasoning = "") => {
  const missingFields = schema.filter(f => f.required && !updatedFormState[f.name]);
  
  const systemPrompt = `
Anda adalah Asisten AI Form yang berinteraksi dengan pengguna.
Tugas Anda adalah merespons perintah sebelumnya dan memandu pengguna untuk mengisi form secara bertahap.

Data Form Saat Ini:
${JSON.stringify(updatedFormState, null, 2)}

Aksi yang baru saja dilakukan oleh sistem:
${actionsReasoning ? actionsReasoning : "Tidak ada data yang diubah."}

Field Wajib yang MASIH KOSONG:
${JSON.stringify(missingFields.map(f => f.name), null, 2)}

ATURAN SANGAT PENTING:
1. Mulailah dengan mengonfirmasi secara singkat bahwa aksi telah dilakukan (berdasarkan "Aksi yang baru saja dilakukan oleh sistem").
2. Jika ada field wajib yang kosong, tanyakan SATU (1) field wajib yang masih kosong secara natural dan ramah.
3. Jika SEMUA field wajib sudah terisi, berikan apresiasi dan tanyakan apakah ada field opsional (seperti addon, limit slot) yang ingin ditambahkan.
4. Balaslah seperti manusia (asisten), bukan format JSON.
5. Perhatikan konteks dari riwayat percakapan sebelumnya agar tidak mengulang pertanyaan.
`;

  try {
    const recentHistory = chatHistory.slice(-4);
    const resContent = await callLLM(systemPrompt, recentHistory, false);
    return resContent;
  } catch (error) {
    console.error("[Form Assistant] Error in formulateNextQuestion:", error);
    return "Maaf, terjadi kesalahan saat merumuskan pertanyaan. Ada lagi yang bisa saya bantu?";
  }
};

/**
 * Step 3: Summarize History (Memori Management)
 */
export const summarizeHistory = async (chatHistory) => {
  const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const systemPrompt = `
Rangkumlah percakapan berikut ke dalam satu paragraf singkat yang menyimpan konteks penting (apa yang sedang dikerjakan, field apa yang sudah dibahas).
Percakapan:
${historyText}
`;

  try {
    const resContent = await callLLM(systemPrompt, [], false);
    return resContent;
  } catch (error) {
    console.error("[Form Assistant] Error in summarizeHistory:", error);
    return "Ringkasan percakapan tentang pengisian form paket.";
  }
};

/**
 * MAIN ORCHESTRATOR
 * Mengatur multi-step reasoning dengan Arsitektur V2 (Router, Pruner, Extractor, Executor, Communicator)
 */
export const processFormAssistantChat = async (userMessage, currentFormState, schema, chatHistory) => {
  // Step 1: Routing & Pruning (Token Saver)
  const category = await routeCategory(userMessage, chatHistory);
  const { prunedSchema, prunedState } = pruneContext(category, currentFormState, schema);

  // Step 2: Ekstraksi Data (Action-Oriented)
  const extractionResult = await extractActions(userMessage, prunedState, prunedSchema);
  const actions = extractionResult.actions || [];
  
  // Step 3: Eksekusi Action secara native (Javascript)
  const { simulatedState, fieldsToUpdate } = executeActions(currentFormState, actions);
  
  // Step 4: Formulate AI response (Tanya pertanyaan selanjutnya)
  const tempHistory = [...chatHistory, { role: 'user', content: userMessage }];
  const aiResponseText = await formulateNextQuestion(simulatedState, schema, tempHistory, extractionResult.reasoning);
  
  // Step 5: Handle Summarization jika history terlalu panjang
  let finalHistory = tempHistory;
  finalHistory.push({ role: 'assistant', content: aiResponseText, reasoning: extractionResult.reasoning });
  
  if (finalHistory.length > 10) {
    const summary = await summarizeHistory(finalHistory);
    finalHistory = [
      { role: 'assistant', content: `[System Summary: ${summary}]` },
      ...finalHistory.slice(-2)
    ];
  }

  return {
    fieldsToUpdate,
    aiMessage: aiResponseText,
    updatedHistory: finalHistory,
    reasoning: extractionResult.reasoning || "Menyesuaikan state."
  };
};
