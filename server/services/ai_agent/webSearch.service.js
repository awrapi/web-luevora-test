/**
 * ================================================================
 * Web Search Service — Pencarian Internet untuk Admin Copilot
 * ================================================================
 * Strategi multi-source:
 * 1. API Spesialis: Kurs (exchangerate.host), Cuaca (wttr.in)
 * 2. EdenAI + Gemini dengan Google Search grounding (main engine)
 * 3. Wikipedia REST API sebagai fallback pengetahuan umum
 * ================================================================
 */

const EDENAI_API_KEY = process.env.EDENAI_API_KEY;
const EDENAI_API_URL = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';
const EDENAI_MODEL = process.env.EDENAI_MODEL || 'google/gemini-2.5-flash';

/**
 * Deteksi apakah query terkait kurs mata uang
 */
const isCurrencyQuery = (query) => {
  return /dollar|dolar|usd|eur|gbp|jpy|sgd|myr|kurs|nilai tukar|exchange rate|mata uang|rupiah|idr/i.test(query);
};

/**
 * Deteksi apakah query terkait cuaca
 */
const isWeatherQuery = (query) => {
  return /cuaca|weather|suhu|temperatur|hujan|panas|dingin|forecast/i.test(query);
};

/**
 * Ambil kurs mata uang real-time dari Open Exchange Rates (gratis, tanpa API key)
 */
const fetchCurrencyData = async (query) => {
  try {
    // Deteksi mata uang yang dicari
    const currencyMap = {
      'dollar|dolar|usd': 'USD',
      'euro|eur': 'EUR',
      'pound|gbp': 'GBP',
      'yen|jpy': 'JPY',
      'sgd|singapura': 'SGD',
      'myr|ringgit|malaysia': 'MYR',
      'aud|australia': 'AUD',
      'cny|yuan|china': 'CNY',
      'hkd|hongkong': 'HKD',
      'thb|baht|thailand': 'THB',
    };

    let targetCurrencies = ['USD', 'EUR', 'SGD', 'MYR']; // default
    for (const [pattern, code] of Object.entries(currencyMap)) {
      if (new RegExp(pattern, 'i').test(query)) {
        if (!targetCurrencies.includes(code)) targetCurrencies.unshift(code);
      }
    }

    // Gunakan exchangerate-api.com (free, no key needed via open.er-api.com)
    const res = await fetch('https://open.er-api.com/v6/latest/IDR', {
      signal: AbortSignal.timeout(6000),
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error(`Currency API error: ${res.status}`);
    const data = await res.json();

    if (!data.rates) throw new Error('Tidak ada data rates');

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });

    // IDR/USD = 1/rates.USD (dari IDR base)
    const usdToIdr = data.rates['USD'] ? Math.round(1 / data.rates['USD']) : null;
    const eurToIdr = data.rates['EUR'] ? Math.round(1 / data.rates['EUR']) : null;
    const sgdToIdr = data.rates['SGD'] ? Math.round(1 / data.rates['SGD']) : null;
    const myrToIdr = data.rates['MYR'] ? Math.round(1 / data.rates['MYR']) : null;
    const audToIdr = data.rates['AUD'] ? Math.round(1 / data.rates['AUD']) : null;

    let result = `📊 **Kurs Mata Uang Real-Time** (${dateStr}, sumber: Open Exchange Rates)\n`;
    if (usdToIdr) result += `• 1 USD = Rp ${usdToIdr.toLocaleString('id-ID')}\n`;
    if (eurToIdr) result += `• 1 EUR = Rp ${eurToIdr.toLocaleString('id-ID')}\n`;
    if (sgdToIdr) result += `• 1 SGD = Rp ${sgdToIdr.toLocaleString('id-ID')}\n`;
    if (myrToIdr) result += `• 1 MYR = Rp ${myrToIdr.toLocaleString('id-ID')}\n`;
    if (audToIdr) result += `• 1 AUD = Rp ${audToIdr.toLocaleString('id-ID')}\n`;

    console.log(`[WebSearch] Kurs real-time berhasil diambil. USD: Rp ${usdToIdr}`);
    return result.trim();
  } catch (err) {
    console.warn(`[WebSearch] Currency API gagal: ${err.message}`);
    return null;
  }
};

/**
 * Gunakan EdenAI (Gemini) dengan kemampuan search Google bawaan
 * Gemini 2.5 Flash mendukung Google Search grounding secara native
 */
const searchWithGemini = async (query) => {
  try {
    console.log(`[WebSearch] Menggunakan Gemini Search untuk: "${query}"`);

    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });

    const res = await fetch(EDENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EDENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: EDENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `Kamu adalah asisten riset cerdas. Hari ini ${today}. 
Tugas kamu: cari dan rangkum informasi terkini yang AKURAT dan SPESIFIK tentang pertanyaan user.
WAJIB: Berikan angka, fakta, dan data konkret yang terbaru. Sebutkan sumber informasi jika bisa.
Jika tidak ada data pasti, katakan dengan jelas bahwa data tidak tersedia.
Format: ringkas, padat, langsung ke inti informasi. Maksimal 200 kata.`
          },
          {
            role: 'user', 
            content: `Cari informasi terkini tentang: ${query}\n\nBerikan informasi yang spesifik dan terbaru, termasuk angka/data jika relevan.`
          }
        ],
        max_tokens: 400,
        temperature: 0.1,
        // Enable Google Search grounding untuk Gemini
        tool_choice: 'auto',
        tools: [{
          type: 'function',
          function: {
            name: 'google_search',
            description: 'Search Google for real-time information'
          }
        }]
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`EdenAI error: ${res.status} - ${errText.substring(0, 100)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (content && content.trim()) {
      console.log(`[WebSearch] Gemini Search berhasil: ${content.length} chars`);
      return content.trim();
    }

    throw new Error('Gemini returned empty content');
  } catch (err) {
    console.warn(`[WebSearch] Gemini Search gagal: ${err.message}`);
    return null;
  }
};

/**
 * Fallback: Wikipedia REST API untuk pengetahuan umum
 */
const searchWikipedia = async (query) => {
  try {
    // Coba Wikipedia Bahasa Indonesia dulu
    const searchRes = await fetch(
      `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) 
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.extract && data.extract.length > 50) {
        return `📖 **Wikipedia**: ${data.extract.substring(0, 300)}...`;
      }
    }

    // Fallback ke Wikipedia Bahasa Inggris
    const enRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) 
      }
    );

    if (enRes.ok) {
      const data = await enRes.json();
      if (data.extract && data.extract.length > 50) {
        return `📖 **Wikipedia (EN)**: ${data.extract.substring(0, 300)}...`;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
};

/**
 * Fungsi utama: cari informasi dari internet menggunakan strategi multi-source.
 * @param {string} query - Query pencarian
 * @returns {Promise<{results: Array, abstract: string, answer: string}>}
 */
export const searchWeb = async (query) => {
  console.log(`[WebSearch] Mencari: "${query}"`);

  const results = [];
  let instantAnswer = '';
  let abstract = '';

  try {
    // === STRATEGI 1: API Spesialis (sangat akurat untuk topik spesifik) ===
    
    if (isCurrencyQuery(query)) {
      const currencyResult = await fetchCurrencyData(query);
      if (currencyResult) {
        instantAnswer = currencyResult;
        console.log(`[WebSearch] ✓ Currency data berhasil`);
      }
    }

    // === STRATEGI 2: Gemini Search (untuk semua query, terutama jika spesialis gagal) ===
    if (!instantAnswer || instantAnswer.length < 50) {
      const geminiResult = await searchWithGemini(query);
      if (geminiResult && geminiResult.length > 30) {
        abstract = geminiResult;
        console.log(`[WebSearch] ✓ Gemini Search berhasil`);
      }
    }

    // === STRATEGI 3: Wikipedia sebagai fallback pengetahuan umum ===
    if (!instantAnswer && !abstract) {
      const wikiResult = await searchWikipedia(query);
      if (wikiResult) {
        abstract = wikiResult;
        console.log(`[WebSearch] ✓ Wikipedia fallback berhasil`);
      }
    }

    const hasResult = instantAnswer || abstract || results.length > 0;
    console.log(`[WebSearch] Selesai. Ada hasil: ${hasResult ? 'Ya' : 'Tidak'}`);
    
    return { instantAnswer, abstract, results };

  } catch (err) {
    console.error(`[WebSearch] Error fatal: ${err.message}`);
    return { instantAnswer: '', abstract: '', results: [] };
  }
};

/**
 * Format hasil pencarian web menjadi teks ringkas untuk konteks AI.
 */
export const formatSearchResults = (searchResult, query) => {
  const { instantAnswer, abstract, results } = searchResult;
  
  if (!instantAnswer && !abstract && results.length === 0) {
    return `[Pencarian Web: "${query}"] Tidak ditemukan informasi yang relevan. Mohon admin verifikasi langsung ke sumber terpercaya.`;
  }

  let text = `[Hasil Pencarian Internet Real-Time untuk: "${query}"]\n`;
  
  if (instantAnswer) {
    text += `\n${instantAnswer}\n`;
  }
  
  if (abstract) {
    text += `\n${abstract}\n`;
  }
  
  if (results.length > 0) {
    text += `\n🔍 Sumber Terkait:\n`;
    results.slice(0, 3).forEach((r, i) => {
      text += `${i + 1}. **${r.title}**: ${r.snippet}\n`;
    });
  }
  
  return text.trim();
};

export default { searchWeb, formatSearchResults };
