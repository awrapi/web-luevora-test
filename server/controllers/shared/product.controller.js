import ProductService from '../../services/shared/product.service.js';

export const getProducts = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true';
    const products = await ProductService.getProducts(tenantId, { includeInactive });
    res.json({ status: true, data: products });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const product = await ProductService.createProduct(tenantId, req.body || {});
    res.status(201).json({ status: true, data: product, message: 'Produk berhasil ditambahkan' });
  } catch (err) {
    if (err.message?.includes('wajib') || err.message?.includes('tidak valid')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const productId = parseInt(req.params.id, 10);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ status: false, message: 'ID produk tidak valid' });
    }
    const product = await ProductService.updateProduct(tenantId, productId, req.body || {});
    res.json({ status: true, data: product, message: 'Produk berhasil diperbarui' });
  } catch (err) {
    if (err.message?.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    if (err.message?.includes('wajib') || err.message?.includes('tidak valid')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const productId = parseInt(req.params.id, 10);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ status: false, message: 'ID produk tidak valid' });
    }
    const hardDelete = req.query.hard_delete === '1' || req.query.hard_delete === 'true';
    const result = await ProductService.deleteProduct(tenantId, productId, { hardDelete });
    res.json({ status: true, ...result });
  } catch (err) {
    if (err.message?.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export default {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
};
