import prisma from '../../config/database.js';

export const orderFormConfigService = {
  // Get all form fields for a tenant, ordered by sort_order
  async getAll(tenantId, query = {}) {
    const where = { tenant_id: tenantId };
    if (query.advanced_package_id) {
      where.advanced_package_id = parseInt(query.advanced_package_id);
    } else if (query.travel_package_id) {
      where.travel_package_id = parseInt(query.travel_package_id);
    } else if (query.global === 'true') {
      where.advanced_package_id = null;
      where.travel_package_id = null;
    }
    
    return prisma.orderFormConfig.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });
  },

  // Create a new form field
  // Input: { field_key, field_label, field_type, is_required, sort_order, placeholder, options }
  async create(tenantId, data) {
    return prisma.orderFormConfig.create({
      data: {
        tenant_id: tenantId,
        field_key: data.field_key,
        field_label: data.field_label,
        field_type: data.field_type,
        is_required: data.is_required ?? false,
        sort_order: data.sort_order ?? 0,
        placeholder: data.placeholder || null,
        options: data.options || null,
        advanced_package_id: data.advanced_package_id || null,
        travel_package_id: data.travel_package_id || null,
      },
    });
  },

  // Update a form field by id
  async update(tenantId, id, data) {
    return prisma.orderFormConfig.update({
      where: { id, tenant_id: tenantId },
      data: {
        ...(data.field_key !== undefined && { field_key: data.field_key }),
        ...(data.field_label !== undefined && { field_label: data.field_label }),
        ...(data.field_type !== undefined && { field_type: data.field_type }),
        ...(data.is_required !== undefined && { is_required: data.is_required }),
        ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
        ...(data.placeholder !== undefined && { placeholder: data.placeholder }),
        ...(data.options !== undefined && { options: data.options }),
      },
    });
  },

  // Delete a form field by id
  async remove(tenantId, id) {
    return prisma.orderFormConfig.delete({
      where: { id, tenant_id: tenantId },
    });
  },

  // Reorder fields - input: [{ id, sort_order }, ...]
  async reorder(tenantId, items) {
    const updates = items.map((item) =>
      prisma.orderFormConfig.update({
        where: { id: item.id, tenant_id: tenantId },
        data: { sort_order: item.sort_order },
      })
    );
    return prisma.$transaction(updates);
  },

  // Bulk sync fields for a package (delete existing and insert new)
  async sync(tenantId, packageId, packageType, fields) {
    const isBasic = packageType === 'basic';
    const where = { tenant_id: tenantId };
    
    if (isBasic) {
      where.travel_package_id = parseInt(packageId);
    } else {
      where.advanced_package_id = parseInt(packageId);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Delete existing
      await tx.orderFormConfig.deleteMany({ where });

      // 2. Insert new
      if (fields && fields.length > 0) {
        const data = fields.map((f, i) => ({
          tenant_id: tenantId,
          field_key: f.field_key,
          field_label: f.field_label,
          field_type: f.field_type,
          is_required: f.is_required ?? false,
          sort_order: i,
          placeholder: f.placeholder || null,
          options: f.options || null,
          advanced_package_id: isBasic ? null : parseInt(packageId),
          travel_package_id: isBasic ? parseInt(packageId) : null,
        }));
        await tx.orderFormConfig.createMany({ data });
      }
      return { success: true };
    });
  },
};
