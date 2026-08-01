/**
 * ================================================================
 * PIPELINE CONTEXT — Shared state object carried through all stages
 * ================================================================
 *
 * This is the single source of truth for a conversation pipeline run.
 * Each stage reads from and writes to this context object.
 *
 * Decision Protocol:
 *   continue  — proceed to next stage (default)
 *   hold      — stop pipeline, return holdResponse to customer
 *   rollback  — re-run from a specific stage index
 *   abort     — stop pipeline, throw/return error
 */

/**
 * All valid conversation states.
 * Computed deterministally from CRM data in Stage 3.
 *
 * States are grouped into logical phases for module selection:
 *   DISCOVERY  — pre-order states (browsing, discussing, returning)
 *   ORDERING   — order workflow states (form, date, confirmed)
 *   TRANSACTION — active invoice / payment states
 *   ESCALATION — admin/request handling states
 */
export const CONVERSATION_STATES = {
  // ── DISCOVERY group ────────────────────────────────────────────
  EXPLORATION:    'EXPLORATION',     // New / undecided customer, general inquiry
  PACKAGE_DISCUSS:'PACKAGE_DISCUSS', // Asking about a specific package detail
  CONSIDERING:    'CONSIDERING',     // Customer is thinking / weighing options
  GHOSTED:        'GHOSTED',         // Customer returned after showing serious engagement
  CANCELLED:      'CANCELLED',       // Customer previously cancelled (treat as re-exploration)
  COMPLETED:      'COMPLETED',       // Transaction completed/done

  // ── NEGOTIATION ────────────────────────────────────────────────
  NEGOTIATION:    'NEGOTIATION',     // Price bargaining / discount request

  // ── ORDERING group ─────────────────────────────────────────────
  ORDER_FORM:     'ORDER_FORM',      // Filling out order form (collecting data)
  WAITING_DATE:   'WAITING_DATE',    // Date requested, waiting admin approval
  DATE_CONFIRMED: 'DATE_CONFIRMED',  // Date approved by admin, proceed to invoice

  // ── TRANSACTION group ──────────────────────────────────────────
  INVOICE_PENDING:'INVOICE_PENDING', // Active transaction (unpaid invoice exists)
  PAYMENT_PROOF:  'PAYMENT_PROOF',   // Customer sent a payment proof image

  // ── ESCALATION group ───────────────────────────────────────────
  REQUEST_STUCK:  'REQUEST_STUCK',   // Customer has unresolved custom request
  ADMIN_PENDING:  'ADMIN_PENDING',   // Waiting for admin to provide info
};

/**
 * State groups — used for consolidated module selection in Stage 5.
 * Each group shares a base set of prompt modules.
 */
export const STATE_GROUPS = {
  DISCOVERY:    ['EXPLORATION', 'PACKAGE_DISCUSS', 'CONSIDERING', 'GHOSTED', 'CANCELLED', 'COMPLETED'],
  NEGOTIATION:  ['NEGOTIATION'],
  ORDERING:     ['ORDER_FORM', 'WAITING_DATE', 'DATE_CONFIRMED'],
  TRANSACTION:  ['INVOICE_PENDING'],
  PAYMENT:      ['PAYMENT_PROOF'],
  ESCALATION:   ['REQUEST_STUCK', 'ADMIN_PENDING'],
};

/** Helper: get the group name for a given state */
export const getStateGroup = (state) => {
  for (const [group, states] of Object.entries(STATE_GROUPS)) {
    if (states.includes(state)) return group;
  }
  return 'DISCOVERY'; // fallback
};

/**
 * Pipeline stage indices — used for rollback targeting.
 */
export const STAGE_INDEX = {
  PRE_VALIDATION:    1,
  CONTEXT_LOADER:    2,
  STATE_RESOLVER:    3,
  RAG_PIPELINE:      4,
  PROMPT_ASSEMBLER:  5,
  AI_EXECUTION:      6,
  POST_PROCESSOR:    7,
  RESPONSE_EMITTER:  8,
};

/**
 * Create a fresh pipeline context from incoming params.
 *
 * @param {Object} params
 * @param {number}  params.tenantId
 * @param {string}  params.userPhone
 * @param {string}  params.userMessage
 * @param {string}  [params.mediaUrl]
 * @param {string}  [params.chatType='sales']
 * @returns {PipelineContext}
 */
export const createPipelineContext = ({ tenantId, userPhone, userMessage, mediaUrl, chatType = 'sales' }) => ({
  // ── Input ──────────────────────────────────────────────────────
  tenantId,
  userPhone,
  userMessage,
  mediaUrl:  mediaUrl || null,
  chatType,

  // ── Pipeline control ───────────────────────────────────────────
  currentStageIndex:  STAGE_INDEX.PRE_VALIDATION,
  decision:           'continue',  // 'continue' | 'hold' | 'rollback' | 'abort'
  rollbackToStage:    null,        // stage index to rollback to (used when decision='rollback')
  holdResponse:       null,        // message to return to customer on hold
  abortError:         null,        // error object/message on abort
  rollbackCount:      0,           // guard against infinite rollback loops

  // ── Stage 1: Validated tenant ──────────────────────────────────
  tenant:             null,
  creditStatus:       null,

  // ── Stage 2: Loaded context ────────────────────────────────────
  lead:               null,
  chatHistory:        [],
  longTermMemory:     '',
  chatHistorySnippet: '',
  personaText:        '',
  customerHistoryText:'',
  mediaSendHistory:   [],
  currentMediaData:   null,        // parsed JSON from image (vision AI result)
  currentMediaSummary:null,
  sentMediaHistoryText:'',
  isDpEnabled:        false,
  dpPercent:          50,

  // ── CRM data (populated in stage 2) ────────────────────────────
  crmData: {
    schedules:          [],
    requests:           [],
    offers:             [],
    crmLabels:          [],
    activeTransactions: [],
    activeOrder:        null,
    pendingCentralInfo: null,
    pendingGuiderRequests: [],  // CentralInfoRequest with status 'pending' (waiting admin)
    refundRequests:     [],
    rescheduleRequests: [],
  },

  // ── Stage 3: Conversation state ────────────────────────────────
  conversationState:  CONVERSATION_STATES.EXPLORATION,
  previousGhostStatus: null,  // Set by Stage 2 if customer returned from idle/ghosted

  /**
   * pendingItems: list of things that MUST be resolved before advancing
   * to a downstream phase (e.g., INVOICE_PENDING).
   *
   * Each item:
   *   { type: 'date_approval' | 'custom_request' | 'offer_decision', id, label, resolved: false }
   *
   * AI is injected with awareness of this list and must resolve each one.
   * The pipeline won't skip to INVOICE until all pendingItems are resolved.
   */
  pendingItems: [],

  // ── Router signals (for prompt router) ────────────────────────
  routerSignals: {
    hasActiveTransaction:  false,
    hasOfferHistory:       false,
    hasMedia:              false,
    hasBrochures:          false,
    hasPackageContext:     false,
    hasRequests:           false,
    hasCentralInfoPending: false,
    hasActiveOrder:        false,
    isBasicPackage:        false,
  },

  // ── Stage 4: RAG results ───────────────────────────────────────
  intent:            null,
  kbContext:         '',
  fullKbContextForVerify: '',
  bankInfo:          '',
  packages:          [],
  kbs:               [],
  advStructuredData: [],
  promotedPackageId:    null,
  promotedPackageTitle: null,
  promotedPackageType:  null,
  promoInstruction:     '',
  docMediaUrls:         [],
  docMediaMeta:         [],
  availableBrochures:   {},

  // ── Stage 5: Prompt assembly ───────────────────────────────────
  selectedModuleIds: null,  // null = router failed, load all

  // ── Stage 6: AI execution ──────────────────────────────────────
  finalUserMessage:      '',        // may differ from userMessage after vision gate
  finalMediaUrlToVision: null,
  aiResponseRaw:         '',

  // ── Stage 7: Post-processing ───────────────────────────────────
  aiResponseContent: '',
  pendingCentralInfoInstruction: null,

  // ── Stage 8: Final output ──────────────────────────────────────
  finalReply: '',
  bubbles:    [],

  // ── Timing ────────────────────────────────────────────────────
  startTime: Date.now(),
});
