import redisClient from '../../config/redis.js';

// Memastikan Index RediSearch ada
export const initVectorIndex = async () => {
  try {
    // Mengecek apakah index sudah ada
    const info = await redisClient.call('FT.INFO', 'luevora_idx');

    // Parse schema fields secara benar dari FT.INFO response
    // FT.INFO returns a flat array: [..., 'attributes', [ [...fieldDef], [...fieldDef] ], ...]
    let hasPhone = false;
    try {
      const infoArr = Array.isArray(info) ? info : [];
      const attrIndex = infoArr.findIndex(item => item === 'attributes');
      if (attrIndex !== -1 && Array.isArray(infoArr[attrIndex + 1])) {
        const attributes = infoArr[attrIndex + 1];
        // Setiap attribute adalah sub-array, cari yang mengandung 'identifier' = 'phone'
        hasPhone = attributes.some(attr => {
          if (!Array.isArray(attr)) return false;
          const idIdx = attr.findIndex(x => x === 'identifier');
          return idIdx !== -1 && attr[idIdx + 1] === 'phone';
        });
      }
    } catch (parseErr) {
      // Jika parse gagal, coba FT.ALTER dan tangani error duplikat
      hasPhone = false;
    }

    if (!hasPhone) {
      console.log('[Vector Service] Menambahkan field phone ke Redis Vector Index...');
      try {
        await redisClient.call('FT.ALTER', 'luevora_idx', 'SCHEMA', 'ADD', 'phone', 'TAG');
        console.log('[Vector Service] Field phone berhasil ditambahkan ke index.');
      } catch (alterErr) {
        // Jika field sudah ada (duplicate), abaikan — ini bukan error fatal
        if (alterErr.message && (alterErr.message.includes('Duplicate') || alterErr.message.includes('duplicate'))) {
          console.log('[Vector Service] Field phone sudah ada di schema, skip.');
        } else {
          console.error('[Vector Service] Error menambahkan field phone:', alterErr.message);
        }
      }
    }
    indexReady = true;
  } catch (error) {
    if (error.message.toLowerCase().includes('unknown index name')) {
      console.log('[Vector Service] Membuat Redis Vector Index: luevora_idx...');
      await redisClient.call(
        'FT.CREATE', 'luevora_idx',
        'ON', 'HASH',
        'PREFIX', '1', 'doc:',
        'SCHEMA',
        'tenant_id', 'NUMERIC',
        'type', 'TAG',
        'mysql_id', 'TAG',
        'phone', 'TAG',
        'embedding', 'VECTOR', 'HNSW', '6', 'TYPE', 'FLOAT32', 'DIM', '768', 'DISTANCE_METRIC', 'COSINE'
      );
      console.log('[Vector Service] Redis Vector Index berhasil dibuat.');
      indexReady = true;
    } else {
      console.error('[Vector Service] Error mengecek Redis Index:', error.message);
    }
  }
};


// Panggil inisialisasi index saat module di-load
initVectorIndex().catch(console.error);

/**
 * Memanggil Ollama lokal untuk mendapatkan vektor embedding dari teks
 */
export const generateEmbedding = async (text) => {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  
  if (!text || typeof text !== 'string') return [];

  try {
    // Membatasi panjang teks agar tidak memberatkan model (maksimal ~8000 karakter)
    const cleanText = text.replace(/\n+/g, ' ').trim().slice(0, 8000);

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: cleanText })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gagal memanggil Ollama: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    if (!data.embedding) console.log('[Vector Service] Ollama response missing embedding:', data);
    return data.embedding || [];
  } catch (error) {
    console.error('[Vector Service] Error generateEmbedding:', error.message);
    return [];
  }
};

/**
 * Menyimpan data ke Redis
 * @param {number} tenantId 
 * @param {string} type ('TravelPackage', 'AdvancedTravelPackage', 'KnowledgeBase')
 * @param {number|string} id MySQL ID
 * @param {string} text Teks representasi dari data tersebut (misal: gabungan title + description)
 * @param {Object} [extraMetadata={}] Metadata tambahan (misalnya { phone: '628...' })
 */
export const upsertDocument = async (tenantId, type, id, text, extraMetadata = {}) => {
  try {
    const vector = await generateEmbedding(text);
    if (!vector || vector.length === 0) {
      console.warn(`[Vector Service] Gagal generate embedding untuk ${type}_${id}`);
      return;
    }

    const vectorId = `doc:${type}_${tenantId}_${id}`;
    const buffer = Buffer.from(new Float32Array(vector).buffer);
    
    // Simpan ke Hash Redis
    await redisClient.hset(vectorId, {
      tenant_id: tenantId,
      type: type,
      mysql_id: String(id),
      embedding: buffer,
      ...extraMetadata
    });

    console.log(`[Vector Service] Berhasil upsert dokumen ke Redis: ${vectorId}`);
  } catch (error) {
    console.error(`[Vector Service] Gagal upsert dokumen ${type}_${id}:`, error.message);
  }
};

/**
 * Mencari data terdekat di Redis berdasarkan pertanyaan pengguna
 * @param {number} tenantId 
 * @param {string} query Pertanyaan/keyword semantic
 * @param {string|string[]} filterTypes (opsional) Filter berdasarkan tipe ('TravelPackage', 'KnowledgeBase', dll)
 * @param {number} topK Jumlah maksimal hasil (default: 5)
 * @param {Object} [extraFilters={}] Filter metadata tambahan (belum didukung penuh di contoh ini tanpa mapping spesifik)
 * @returns {Array<string>} Mengembalikan array ID MySQL yang cocok berupa string
 */
// Track whether the vector index has been initialized
let indexReady = false;

export const searchSemantic = async (tenantId, query, filterTypes = null, topK = 5, extraFilters = {}) => {
  try {
    // If index not ready, try to initialize it first (once)
    if (!indexReady) {
      try { await initVectorIndex(); indexReady = true; } catch (e) { /* will be caught below */ }
    }

    const queryVector = await generateEmbedding(query);
    if (!queryVector || queryVector.length === 0) return [];

    const buffer = Buffer.from(new Float32Array(queryVector).buffer);
    
    // Bangun query filter string
    let filterParts = [`@tenant_id:[${tenantId} ${tenantId}]`];
    if (filterTypes) {
      if (Array.isArray(filterTypes)) {
        filterParts.push(`@type:{${filterTypes.join('|')}}`);
      } else {
        filterParts.push(`@type:{${filterTypes}}`);
      }
    }
    
    // Support extraFilters (e.g. phone)
    if (extraFilters && Object.keys(extraFilters).length > 0) {
      for (const [key, valObj] of Object.entries(extraFilters)) {
        if (valObj && valObj.$eq) {
          // Escape semua karakter spesial RediSearch TAG: , . < > { } [ ] " ' : ; ! @ # $ % ^ & * ( ) - + = ~ |
          const escapedVal = String(valObj.$eq).replace(/[,.<>{}[\]"':;!@#$%^&*()\-+=~|]/g, '\\$&');
          filterParts.push(`@${key}:{${escapedVal}}`);
        }
      }
    }
    
    // KNN Vector Search (DIALECT 2) — format: (filter)=>[KNN topK @field $param AS alias]
    const filterStr = filterParts.length > 0 ? `(${filterParts.join(' ')})` : '*';
    const queryStr = `${filterStr}=>[KNN ${topK} @embedding $vec AS score]`;

    const args = [
      'luevora_idx',
      queryStr,
      'PARAMS', '2', 'vec', buffer,
      'DIALECT', '2',
      'RETURN', '2', 'mysql_id', 'score'
    ];

    const result = await redisClient.call('FT.SEARCH', ...args);
    
    // Hasil Redis: [totalCount, key1, [field1, val1, field2, val2...], key2, [...]]
    if (result && result.length > 1) {
      const validMatches = [];
      const totalResults = result[0];
      
      for (let i = 1; i < result.length; i += 2) {
        const fields = result[i + 1];
        let mysqlId = null;
        let score = null;
        
        for (let j = 0; j < fields.length; j += 2) {
          if (fields[j] === 'mysql_id') mysqlId = fields[j + 1];
          // Cosine distance di Redis: makin kecil makin mirip.
          // Kemiripan pinecone > 0.3 setara dengan distance Redis < 0.7
          if (fields[j] === 'score') score = parseFloat(fields[j + 1]);
        }
        
        if (mysqlId && score !== null && score < 0.7) {
          validMatches.push(mysqlId);
        }
      }
      
      console.log(`[Vector Service] Semantic Search "${query}" menemukan ${validMatches.length} dokumen valid.`);
      return validMatches;
    }
    
    return [];
  } catch (error) {
    console.error(`[Vector Service] Gagal searchSemantic:`, error.message);
    return [];
  }
};

/**
 * Menghapus vektor dari Redis jika data di MySQL dihapus
 */
export const deleteDocument = async (tenantId, type, id) => {
  try {
    const vectorId = `doc:${type}_${tenantId}_${id}`;
    await redisClient.del(vectorId);
    console.log(`[Vector Service] Berhasil menghapus vektor dari Redis: ${vectorId}`);
  } catch (error) {
    console.error(`[Vector Service] Gagal menghapus vektor ${type}_${id}:`, error.message);
  }
};
