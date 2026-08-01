import prisma from '../../config/database.js';

/**
 * ================================================================
 * Course Service Label (Daftar Kursus)
 * ================================================================
 */

export const getServiceLabels = async (tenantId) => {
  return await prisma.serviceLabel.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: 'desc' }
  });
};

export const createServiceLabel = async (tenantId, payload) => {
  const { label_name, color } = payload;
  if (!label_name) throw new Error('Nama layanan wajib diisi');

  const slug = label_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Check unique slug
  const existing = await prisma.serviceLabel.findFirst({
    where: { tenant_id: tenantId, label_slug: slug }
  });

  if (existing) {
    throw new Error('Layanan dengan nama tersebut sudah ada');
  }

  return await prisma.serviceLabel.create({
    data: {
      tenant_id: tenantId,
      label_name: label_name.trim(),
      label_slug: slug,
      color: color || '#6366f1'
    }
  });
};

export const updateServiceLabel = async (tenantId, id, payload) => {
  const { label_name, color } = payload;
  
  // Verify ownership
  const existing = await prisma.serviceLabel.findFirst({
    where: { id: parseInt(id), tenant_id: tenantId }
  });
  if (!existing) throw new Error('Layanan tidak ditemukan');

  const data = {};
  if (label_name) {
    data.label_name = label_name.trim();
    data.label_slug = label_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (color) {
    data.color = color;
  }

  return await prisma.serviceLabel.update({
    where: { id: parseInt(id) },
    data
  });
};

export const deleteServiceLabel = async (tenantId, id) => {
  // Verify ownership
  const existing = await prisma.serviceLabel.findFirst({
    where: { id: parseInt(id), tenant_id: tenantId }
  });
  if (!existing) throw new Error('Layanan tidak ditemukan');

  await prisma.serviceLabel.delete({
    where: { id: parseInt(id) }
  });
  return { status: true, message: 'Layanan berhasil dihapus' };
};

export default {
  getServiceLabels,
  createServiceLabel,
  updateServiceLabel,
  deleteServiceLabel
};
