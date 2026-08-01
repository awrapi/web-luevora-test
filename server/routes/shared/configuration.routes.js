import express from 'express';
import * as configurationController from '../../controllers/shared/configuration.controller.js';

const router = express.Router();

// Get all configurations
router.get('/', configurationController.getConfigurations);

// Update configurations
router.post('/', configurationController.updateConfigurations);

// Clear chat history
router.delete('/chat-history', configurationController.clearChatHistory);

export default router;
