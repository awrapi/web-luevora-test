import express from 'express';
import DashboardController from '../../controllers/shared/dashboard.controller.js';

const router = express.Router();

router.get('/stats', DashboardController.getStats);

export default router;
