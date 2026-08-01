import { executeFastJsonAI } from './logic.service.js';

/**
 * Menganalisis sekumpulan pesan (multi-bubble) yang masuk secara bersamaan
 * dan menentukan apakah pesan-pesan tersebut membahas 1 topik/konteks yang sama
 * atau 2+ konteks yang berbeda.
 * 
 * @param {number} tenantId 
 * @param {Array<{text: string, mediaUrl: string, timestamp: Date}>} messages 
 * @returns {Promise<Array<{context: string, combinedText: string, mediaUrl: string|null}>>}
 */
export const analyzeContextGroups = async (tenantId, messages) => {
  if (!messages || messages.length === 0) return [];
  if (messages.length === 1) {
    return [{
      context: 'General',
      combinedText: messages[0].text,
      mediaUrl: messages[0].mediaUrl || null
    }];
  }

  // ── Fast-path: If ALL messages are short (≤10 words each), it's almost
  //    certainly greetings / small talk / one-liners that all belong to the
  //    SAME context. Skip AI analysis entirely and combine into 1 group.
  const allShort = messages.every(m => (m.text || '').trim().split(/\s+/).length <= 10);
  if (allShort) {
    console.log(`[Context Analyzer] All messages are short — fast-path: 1 group (no AI call needed)`);
    return [{
      context: 'General',
      combinedText: messages.map(m => m.text).join('\n'),
      mediaUrl: messages.find(m => m.mediaUrl)?.mediaUrl || null,
      hasVoiceNote: messages.some(m => m.isVoiceNote) || false,
    }];
  }

  const systemPrompt = `You are an AI assistant that analyzes multiple incoming WhatsApp messages sent by a customer in rapid succession.
Your job is to determine if these messages all talk about the SAME TOPIC/CONTEXT, or if the customer is asking about MULTIPLE COMPLETELY DIFFERENT TOPICS that require entirely separate explanations.

CRITICAL RULE: You must be VERY CONSERVATIVE about splitting. Almost always the answer is 1 group.
ONLY split into multiple groups if messages are asking about COMPLETELY UNRELATED topics (e.g. Bali package price AND Japan package — two separate destinations with no connection).

NEVER split for:
- Greetings / small talk (e.g. "halo kak" + "selamat sore/malam" = ALWAYS 1 group)
- Continuations of the same thought (e.g. "saya mau tanya" + "soal paket bali" = 1 group)
- Follow-up questions about the same topic
- Multiple short messages expressing the same intent

ONLY split for:
- Clearly unrelated questions (e.g. "berapa harga paket Bali?" + "oh iya, ada paket ke Jepang gak?" = 2 groups)

Return a JSON object with a 'groups' array. Each group must contain the 'combinedText' of the messages that belong to that context.

Output format:
{
  "groups": [
    {
      "context": "Short description of the topic",
      "combinedText": "Exact text of the messages combined"
    }
  ]
}

Examples:
Messages:
1. "halo kak"
2. "selamat sore"
Output:
{ "groups": [{ "context": "Sapaan", "combinedText": "halo kak\nselamat sore" }] }

Messages:
1. "wah seru kak"
2. "boleh deh kak"
Output:
{ "groups": [{ "context": "Persetujuan", "combinedText": "wah seru kak\nboleh deh kak" }] }

Messages:
1. "paket bali harganya berapa?"
2. "sama aku mau tanya sekalian, kalau ke lombok ada gak?"
Output:
{ "groups": [
  { "context": "Tanya harga paket Bali", "combinedText": "paket bali harganya berapa?" },
  { "context": "Tanya paket Lombok", "combinedText": "sama aku mau tanya sekalian, kalau ke lombok ada gak?" }
] }
`;

  const prompt = `Messages:\n${messages.map((m, i) => {
    const vnTag = m.isVoiceNote ? ' [Voice Note]' : '';
    return `${i + 1}. "${m.text}"${vnTag}`;
  }).join('\n')}`;

  try {
    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt);
    
    if (result && result.groups && Array.isArray(result.groups) && result.groups.length > 0) {
      console.log(`[Context Analyzer] Split ${messages.length} messages into ${result.groups.length} context groups.`);
      
      // Preserve the media URL for the first group that might need it
      const firstMediaUrl = messages.find(m => m.mediaUrl)?.mediaUrl || null;
      
      return result.groups.map((g, index) => ({
        context: g.context,
        combinedText: g.combinedText,
        mediaUrl: index === 0 ? firstMediaUrl : null, // attach media only to the first context
        hasVoiceNote: messages.some(m => m.isVoiceNote) || false,
      }));
    }
  } catch (err) {
    console.error('[Context Analyzer] Error analyzing context:', err.message);
  }

  // Fallback: assume 1 context
  return [{
    context: 'General',
    combinedText: messages.map(m => m.text).join('\n'),
    mediaUrl: messages.find(m => m.mediaUrl)?.mediaUrl || null,
    hasVoiceNote: messages.some(m => m.isVoiceNote) || false,
  }];
};
