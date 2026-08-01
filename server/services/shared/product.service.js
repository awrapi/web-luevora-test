import prisma from '../../config/database.js';

const normalizePrice = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

export const getProducts = async (tenantId, { includeInactive = false } = {}) => {
  const where = {
    tenant_id: tenantId,
    ...(includeInactive ? {} : { is_active: 1 })
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }, { id: 'desc' }]
  });

  return products;
};

export const createProduct = async (tenantId, payload = {}) => {
  const name = (payload.name || '').trim();
  const description = (payload.description || '').trim();
  const price = normalizePrice(payload.price);

  if (!name) throw new Error('Nama produk wajib diisi');
  if (price === null || price < 0) throw new Error('Harga produk tidak valid');

  const created = await prisma.product.create({
    data: {
      tenant_id: tenantId,
      name,
      description: description || null,
      price,
      is_active: 1
    }
  });

  return created;
};

export const updateProduct = async (tenantId, productId, payload = {}) => {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!existing) throw new Error('Produk tidak ditemukan');

  const data = {};
  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('Nama produk wajib diisi');
    data.name = name;
  }
  if (payload.description !== undefined) {
    const description = String(payload.description || '').trim();
    data.description = description || null;
  }
  if (payload.price !== undefined) {
    const price = normalizePrice(payload.price);
    if (price === null || price < 0) throw new Error('Harga produk tidak valid');
    data.price = price;
  }
  if (payload.is_active !== undefined) {
    data.is_active = payload.is_active ? 1 : 0;
  }

  data.updated_at = new Date();

  const updated = await prisma.product.update({
    where: { id: productId },
    data
  });

  return updated;
};

export const deleteProduct = async (tenantId, productId, { hardDelete = false } = {}) => {
  const existing = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!existing) throw new Error('Produk tidak ditemukan');

  if (hardDelete) {
    await prisma.product.delete({ where: { id: productId } });
    return { message: 'Produk berhasil dihapus permanen' };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { is_active: 0, updated_at: new Date() }
  });

  return { message: 'Produk berhasil dinonaktifkan' };
};

export default {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
};
