import express from 'express';

const router = express.Router();

// Inventory management
router.get('/', (req, res) => res.json({ status: true, inventory: [] }));
router.put('/:id', (req, res) => res.json({ status: true, message: 'Inventory updated' }));

export default router;
