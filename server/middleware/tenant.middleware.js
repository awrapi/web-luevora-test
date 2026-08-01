/**
 * Tenant Middleware
 * Resolves tenant identity and attaches it to the request object.
 * In a Single Database Multi-Tenant architecture, we just pass the ID.
 */
export const tenantMiddleware = async (req, res, next) => {
  const rawTenantId = req.user?.tenantId || req.headers['x-tenant-id'];
  
  if (!rawTenantId) {
    return res.status(400).json({ message: 'Tenant identity required (x-tenant-id)' });
  }

  const tenantId = parseInt(rawTenantId, 10);
  if (isNaN(tenantId)) {
    return res.status(400).json({ message: 'Invalid Tenant ID format' });
  }

  try {
    req.tenant = { id: tenantId };
    // req.db is intentionally removed. Use the Service layer to access Prisma.
    next();
  } catch (err) {
    res.status(500).json({ message: 'Failed to resolve tenant' });
  }
};
