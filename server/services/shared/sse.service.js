/**
 * SSE (Server-Sent Events) Service
 * Allows the backend to push real-time notifications to connected dashboard clients.
 */

// Store connected SSE clients per tenant
const clients = new Map(); // Map<tenantId, Set<response>>

/**
 * Register a new SSE client connection.
 */
export const addClient = (tenantId, res) => {
  if (!clients.has(tenantId)) {
    clients.set(tenantId, new Set());
  }
  clients.get(tenantId).add(res);
  console.log(`[SSE] Client connected for tenant ${tenantId} (total: ${clients.get(tenantId).size})`);
};

/**
 * Remove a disconnected SSE client.
 */
export const removeClient = (tenantId, res) => {
  const tenantClients = clients.get(tenantId);
  if (tenantClients) {
    tenantClients.delete(res);
    console.log(`[SSE] Client disconnected for tenant ${tenantId} (remaining: ${tenantClients.size})`);
    if (tenantClients.size === 0) {
      clients.delete(tenantId);
    }
  }
};

/**
 * Broadcast an event to all connected clients of a specific tenant.
 * @param {number} tenantId
 * @param {string} eventType - e.g. 'new_message', 'lead_updated'
 * @param {object} data - payload to send
 */
export const broadcast = (tenantId, eventType, data = {}) => {
  const tenantClients = clients.get(tenantId);
  if (!tenantClients || tenantClients.size === 0) return;

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  
  for (const client of tenantClients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error('[SSE] Failed to send to client:', err.message);
      tenantClients.delete(client);
    }
  }

  console.log(`[SSE] Broadcasted '${eventType}' to ${tenantClients.size} client(s) for tenant ${tenantId}`);
};
