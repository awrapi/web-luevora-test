/**
 * ================================================================
 * Subscription-Based AI Model Configuration
 * ================================================================
 * Returns model identifiers for each AI role based on the tenant's
 * active subscription plan.
 *
 * Priority per model (GLOBAL FALLBACK DIHAPUS — murni per tier):
 *   1. env  AI_<ROLE>_MODEL_<TIER>   (tier-specific override via env)
 *   2. env  AI_MODEL_<TIER>          (main model tier, dipakai semua role jika tidak ada override)
 *   3. hardcoded default per tier    (last resort, tidak pakai EDENAI_MODEL)
 *
 * Tier values: development | lite | starter | growth | scale
 * ================================================================
 */

/** Default model per tier jika env tidak di-set */
const TIER_DEFAULTS = {
  development: 'google/gemini-2.5-flash-lite',
  lite:        'google/gemini-2.5-flash-lite',
  starter:     'openai/gpt-4.1-nano',
  growth:      'google/gemini-3-flash-preview',
  scale:       'google/gemini-3.1-pro-preview',
};

/**
 * Get AI model identifiers for a given subscription plan.
 *
 * @param {string} plan - Tenant's subscription_plan (e.g. 'lite', 'growth')
 * @returns {{
 *   mainModel:       string,  // Main chat / response model
 *   toolModel:       string,  // Function calling / tool-use model
 *   routerModel:     string,  // Prompt router (lightweight classifier)
 *   gatekeeperModel: string,  // Gatekeeper agent (pending msg eval)
 *   formModel:       string,  // Form assistant model
 * }}
 */
export const getModelsForPlan = (plan) => {
  const tier = (plan || 'lite').toLowerCase();
  const TIER = tier.toUpperCase(); // e.g. "GROWTH"

  // Model utama untuk tier ini — dipakai sebagai fallback semua role
  const tierDefault = (
    process.env[`AI_MODEL_${TIER}`] ||
    TIER_DEFAULTS[tier] ||
    'google/gemini-2.5-flash-lite'
  );

  return {
    mainModel: tierDefault,

    toolModel: (
      process.env[`AI_TOOL_MODEL_${TIER}`] ||
      process.env[`TOOL_CALL_AI_MODEL_${TIER}`] ||
      tierDefault
    ),

    routerModel: (
      process.env[`AI_ROUTER_MODEL_${TIER}`] ||
      process.env[`ROUTER_AI_MODEL_${TIER}`] ||
      tierDefault
    ),

    gatekeeperModel: (
      process.env[`AI_GATEKEEPER_MODEL_${TIER}`] ||
      process.env[`GATEKEEPER_MODEL_${TIER}`] ||
      tierDefault
    ),

    formModel: (
      process.env[`AI_FORM_MODEL_${TIER}`] ||
      process.env[`FORM_ASSISTANT_MODEL_${TIER}`] ||
      tierDefault
    ),
  };
};

export default { getModelsForPlan };

