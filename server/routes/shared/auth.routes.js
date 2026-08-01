import express from 'express';

const router = express.Router();

import { login, getMe } from '../../controllers/shared/auth.controller.js';
import { register } from '../../controllers/shared/register.controller.js';
import { verifyEmail } from '../../controllers/shared/verifyEmail.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

router.post('/login', login);
router.post('/register', register);
router.post('/verify-otp', verifyEmail);
router.get('/me', authMiddleware, getMe);

export default router;
