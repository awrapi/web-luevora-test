import express from 'express';
import ProductController from '../../controllers/shared/product.controller.js';

const router = express.Router();

// GET /api/products
router.get('/', ProductController.getProducts);

// POST /api/products
router.post('/', ProductController.createProduct);

// PUT /api/products/:id
router.put('/:id', ProductController.updateProduct);

// DELETE /api/products/:id
router.delete('/:id', ProductController.deleteProduct);

export default router;
