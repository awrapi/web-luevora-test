/**
 * ================================================================
 * WhatsApp Session Config
 * ================================================================
 * Defines session constants for WhatsApp integration.
 * Legacy equivalent: session_config.php
 * ================================================================
 */

export const WA_SESSION_CONFIG = {
  defaultSessionId: 'sesi_template_1',
  sessionDir: './sessions',
  reconnectInterval: 5000,
  maxRetries: 10,
};

export default WA_SESSION_CONFIG;
