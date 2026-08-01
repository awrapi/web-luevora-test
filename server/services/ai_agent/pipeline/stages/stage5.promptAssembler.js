/**
 * ================================================================
 * STAGE 5 — Prompt Assembler (Deterministic, Group-Based)
 * ================================================================
 * Selects prompt modules based on conversation state GROUP + CRM signals.
 *
 * Module selection is driven by:
 *   1. GROUP_MODULES — base modules per state group (DISCOVERY, ORDERING, etc.)
 *   2. STATE_EXTRA_MODULES — per-state overrides within a group
 *   3. SIGNAL_MODULES — additional modules from CRM/context signals
 *   4. Keyword supplements — cheap regex on user message
 */

import { PROMPT_MODULE_IDS } from '../../ai_prompt/index.js';
import { CONVERSATION_STATES, getStateGroup } from '../pipeline.context.js';

/**
 * Group → base modules. Each group shares common modules.
 * This replaces 15+ individual state entries with 6 group entries.
 */
const GROUP_MODULES = {
  DISCOVERY:    ['mod_soft_selling'],
  NEGOTIATION:  ['mod_negotiation', 'mod_package_rules'],
  ORDERING:     ['mod_basic_date', 'mod_package_rules'],
  TRANSACTION:  ['mod_invoice', 'mod_modify_invoice', 'mod_cancellation'],
  PAYMENT:      ['mod_payment_proof'],
  ESCALATION:   ['mod_customer_request', 'mod_revision'],
};

/**
 * Per-state extras WITHIN a group — only the differences from group base.
 * This handles the nuance that PACKAGE_DISCUSS needs more modules than EXPLORATION.
 */
const STATE_EXTRA_MODULES = {
  [CONVERSATION_STATES.PACKAGE_DISCUSS]: ['mod_package_rules', 'mod_serious_intent'],
  [CONVERSATION_STATES.DATE_CONFIRMED]:  ['mod_invoice', 'mod_serious_intent'],
  [CONVERSATION_STATES.ADMIN_PENDING]:   ['mod_admin_response'],
};

export const runStage5PromptAssembler = async (ctx) => {
  const { routerSignals, conversationState, userMessage } = ctx;
  const signals = routerSignals || {};

  // ── Step 1: Group-based modules ───────────────────────────────
  const group = getStateGroup(conversationState);
  const groupModules = GROUP_MODULES[group] || ['mod_soft_selling'];
  const moduleSet = new Set(groupModules);

  // ── Step 2: State-specific extras ─────────────────────────────
  const extras = STATE_EXTRA_MODULES[conversationState] || [];
  extras.forEach(m => moduleSet.add(m));

  // ── Step 3: Signal-driven modules (deterministic) ─────────────
  if (signals.hasPackageContext) {
    moduleSet.add('mod_package_rules');
    moduleSet.add('mod_soft_selling');
    moduleSet.add('mod_serious_intent');
  }
  if (signals.hasActiveTransaction) {
    moduleSet.add('mod_invoice');
    moduleSet.add('mod_modify_invoice');
    moduleSet.add('mod_cancellation');
  }
  if (signals.hasOfferHistory) {
    moduleSet.add('mod_negotiation');
  }
  if (signals.hasMedia) {
    moduleSet.add('mod_payment_proof');
  }
  if (signals.hasBrochures) {
    moduleSet.add('mod_brochure');
  }
  if (signals.hasRequests) {
    moduleSet.add('mod_customer_request');
    moduleSet.add('mod_revision');
  }
  if (signals.hasCentralInfoPending) {
    moduleSet.add('mod_admin_response');
  }
  if (signals.hasActiveOrder || signals.isBasicPackage) {
    moduleSet.add('mod_basic_date');
  }

  // ── Step 4: Keyword-based supplements (cheap, no LLM) ────────
  if (userMessage) {
    const msgLower = userMessage.toLowerCase();
    if (/batal|cancel|refund/.test(msgLower)) moduleSet.add('mod_cancellation');
    if (/diskon|nego|kurang|murah|tawaran|bisa.*(kurang|murah)/.test(msgLower)) moduleSet.add('mod_negotiation');
    if (/invoice|tagihan|bayar|transfer/.test(msgLower)) moduleSet.add('mod_invoice');
    if (/brosur|katalog|gambar|poster/.test(msgLower)) moduleSet.add('mod_brochure');
    if (/tanggal|kapan|jadwal|berangkat/.test(msgLower)) moduleSet.add('mod_basic_date');
  }

  // ── Validate module IDs exist ─────────────────────────────────
  ctx.selectedModuleIds = [...moduleSet].filter(id => PROMPT_MODULE_IDS.includes(id));

  const totalAvailable = PROMPT_MODULE_IDS.length;
  const totalSelected = ctx.selectedModuleIds.length;
  const reduction = Math.round((1 - totalSelected / totalAvailable) * 100);

  console.log(`[Stage5] State=${conversationState} → Group=${group}`);
  console.log(`[Stage5] Group base: [${groupModules.join(', ')}], Extras: [${extras.join(', ')}]`);
  console.log(`[Stage5] Final (${totalSelected}/${totalAvailable}, ${reduction}% reduction): [${ctx.selectedModuleIds.join(', ')}]`);
};
