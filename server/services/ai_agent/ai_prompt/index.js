/**
 * ================================================================
 * PROMPT ASSEMBLER — Modular Prompt Assembly System
 * ================================================================
 * Combines core prompt with selected conditional modules into
 * a complete system prompt template for LangChain.
 */

import { getCorePrompt } from './core.js';
import { prompt as modSoftSelling } from './mod_soft_selling.js';
import { prompt as modInvoice } from './mod_invoice.js';
import { prompt as modPaymentProof } from './mod_payment_proof.js';
import { prompt as modNegotiation } from './mod_negotiation.js';
import { prompt as modBrochure } from './mod_brochure.js';
import { prompt as modPackageRules } from './mod_package_rules.js';
import { prompt as modCustomerRequest } from './mod_customer_request.js';
import { prompt as modCancellation } from './mod_cancellation.js';
import { prompt as modSeriousIntent } from './mod_serious_intent.js';
import { prompt as modBasicDate } from './mod_basic_date.js';
import { prompt as modModifyInvoice } from './mod_modify_invoice.js';
import { prompt as modRevision } from './mod_revision.js';
import { prompt as modAdminResponse } from './mod_admin_response.js';

/**
 * All available conditional module IDs.
 */
export const PROMPT_MODULE_IDS = [
  'mod_soft_selling',
  'mod_invoice',
  'mod_payment_proof',
  'mod_negotiation',
  'mod_brochure',
  'mod_package_rules',
  'mod_customer_request',
  'mod_cancellation',
  'mod_serious_intent',
  'mod_basic_date',
  'mod_modify_invoice',
  'mod_revision',
  'mod_admin_response',
];

/**
 * Module registry — maps module IDs to their prompt text.
 */
const MODULE_REGISTRY = {
  mod_soft_selling:     modSoftSelling,
  mod_invoice:          modInvoice,
  mod_payment_proof:    modPaymentProof,
  mod_negotiation:      modNegotiation,
  mod_brochure:         modBrochure,
  mod_package_rules:    modPackageRules,
  mod_customer_request: modCustomerRequest,
  mod_cancellation:     modCancellation,
  mod_serious_intent:   modSeriousIntent,
  mod_basic_date:       modBasicDate,
  mod_modify_invoice:   modModifyInvoice,
  mod_revision:         modRevision,
  mod_admin_response:   modAdminResponse,
};

/**
 * Assemble a system prompt from core + selected modules.
 *
 * @param {string} dynamicStyleRules - WA or Email style rules string
 * @param {string[]} selectedModuleIds - Array of module IDs to include
 * @returns {string} Complete system prompt template with {variables}
 */
export const assemblePrompt = (dynamicStyleRules, selectedModuleIds) => {
  let prompt = getCorePrompt(dynamicStyleRules);

  const loadedModules = [];
  for (const moduleId of selectedModuleIds) {
    const moduleText = MODULE_REGISTRY[moduleId];
    if (moduleText) {
      prompt += '\n' + moduleText;
      loadedModules.push(moduleId);
    } else {
      console.warn(`[PromptAssembler] ⚠️ Unknown module ID: "${moduleId}" — skipped`);
    }
  }

  console.log(`[PromptAssembler] ✅ Assembled prompt: core + ${loadedModules.length} modules → [${loadedModules.join(', ')}]`);
  
  // Log approximate character count for monitoring
  const charCount = prompt.length;
  const estimatedTokens = Math.round(charCount / 4);
  console.log(`[PromptAssembler] 📊 Prompt size: ~${charCount} chars (~${estimatedTokens} tokens estimated)`);

  return prompt;
};

/**
 * Assemble full prompt with ALL modules (fallback / backward-compatible).
 *
 * @param {string} dynamicStyleRules - WA or Email style rules string
 * @returns {string} Complete system prompt with all modules
 */
export const assembleFullPrompt = (dynamicStyleRules) => {
  console.log(`[PromptAssembler] ❌ FALLBACK: Router unavailable — loading ALL modules (full prompt). This should be rare.`);
  return assemblePrompt(dynamicStyleRules, PROMPT_MODULE_IDS);
};

export default { assemblePrompt, assembleFullPrompt, PROMPT_MODULE_IDS };
