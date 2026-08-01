import express from 'express';
import * as bankingController from '../../controllers/shared/banking.controller.js';

const router = express.Router();

router.get('/', bankingController.getAll);
router.post('/', bankingController.create);
router.put('/:id', bankingController.update);
router.delete('/:id', bankingController.remove);

export default router;
