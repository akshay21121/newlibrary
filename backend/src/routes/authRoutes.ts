import { Router } from 'express';
import {
  getAuthStatus,
  setupAdmin,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get('/status', getAuthStatus);
router.post('/setup', authLimiter, setupAdmin);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/logout', requireAuth, logout);

export default router;

