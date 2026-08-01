import { zodToJsonSchema } from "zod-to-json-schema";
import { activeAITools } from './tools.service.js';
import { HumanMessage, ToolMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Helper untuk mengeksekusi Tool Calling loop untuk LangChain
 * Ini memungkinkan AI memanggil tools berkali-kali hingga ia selesai berpikir.
 */
export async function executeLangchainWithTools(chatModel, initialMessages, context = {}) {
  // Bind tools ke model (hanya disupport oleh model yang kompatibel dengan function calling)
  let chatModelWithTools;
  try {
    chatModelWithTools = chatModel.bindTools(activeAITools);
  } catch (e) {
    console.warn('[Warning] Model ini mungkin tidak mensupport tool binding secara native. Fallback tanpa tools.', e.message);
    return await chatModel.invoke(initialMessages);
  }

  let messages = [...initialMessages];
  let finalResponse = null;

  // Batasi maksimal 5 iterasi tool calling untuk mencegah infinite loop
  for (let i = 0; i < 5; i++) {
    const response = await chatModelWithTools.invoke(messages);
    
    // Jika AI tidak memanggil tool apapun, berarti ini jawaban final
    if (!response.tool_calls || response.tool_calls.length === 0) {
      finalResponse = response;
      break;
    }

    // Jika AI memanggil tool, tambahkan pesan AI ke history
    messages.push(response);

    // Eksekusi setiap tool yang diminta
    for (const toolCall of response.tool_calls) {
      console.log(`[AI Tool Executing] ${toolCall.name} with args:`, toolCall.args);
      const selectedTool = activeAITools.find(t => t.name === toolCall.name);
      
      let toolResult = '';
      if (selectedTool) {
        try {
          toolResult = await selectedTool.func(toolCall.args, context);
        } catch (err) {
          toolResult = JSON.stringify({ error: err.message });
        }
      } else {
        toolResult = JSON.stringify({ error: "Tool not found" });
      }

      console.log(`[AI Tool Result]`, toolResult);
      
      // Tambahkan hasil eksekusi tool ke history
      messages.push(new ToolMessage({
        content: toolResult,
        name: toolCall.name,
        tool_call_id: toolCall.id
      }));
    }
  }

  return finalResponse;
}

/**
 * Format raw JSON Schema untuk EdenAI (OpenAI-compatible)
 */
export const edenAiToolsSchema = activeAITools.map(t => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: zodToJsonSchema(t.schema)
  }
}));
