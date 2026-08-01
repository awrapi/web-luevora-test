import prisma from '../config/database.js';

/**
 * Business Type Guard
 * Restricts route access based on tenant business type.
 */
export const businessTypeGuard = (allowedTypes = []) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant identity required.' });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { business_type: true }
      });

      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      const tenantBusinessType = tenant.business_type;

      if (allowedTypes.length > 0 && !allowedTypes.includes(tenantBusinessType)) {
        return res.status(403).json({ message: 'Action not allowed for this business type.' });
      }

      // Attach business type to request for downstream use
      req.tenant.business_type = tenantBusinessType;
      next();
    } catch (error) {
      console.error('BusinessTypeGuard Error:', error.message);
      return res.status(500).json({ message: 'Failed to verify business type.' });
    }
  };
};
