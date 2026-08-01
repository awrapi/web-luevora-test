import { Router } from 'express';
import {
  sendGuiderMessage,
  getGuiderHistory,
  executeTodoItem,
  executeAllTodos,
  executeNeedInfoItem,
} from '../../controllers/systemGuider.controller.js';

const router = Router();

// POST /api/v1/travel/system-guider/:requestId/chat
router.post('/:requestId/chat', sendGuiderMessage);

// GET /api/v1/travel/system-guider/:requestId/history
router.get('/:requestId/history', getGuiderHistory);

// POST /api/v1/travel/system-guider/:requestId/execute-todo/:todoId
router.post('/:requestId/execute-todo/:todoId', executeTodoItem);

// POST /api/v1/travel/system-guider/:requestId/execute-all
router.post('/:requestId/execute-all', executeAllTodos);

// POST /api/v1/travel/system-guider/:requestId/execute-need-info/:todoId
router.post('/:requestId/execute-need-info/:todoId', executeNeedInfoItem);

export default router;
