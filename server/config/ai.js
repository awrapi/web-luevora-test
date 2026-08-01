/**
 * ================================================================
 * AI Provider Config
 * ================================================================
 * Configuration for OpenAI/OpenRouter providers used by AI Agent.
 * ================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

export const AI_CONFIG = {
  apiKey: process.env.AI_API_KEY || '',
  baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  defaultModel: process.env.AI_MODEL || 'gpt-4o',
  temperature: 0.7,
  maxTokens: 1000,
};

export default AI_CONFIG;
