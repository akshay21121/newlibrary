import { Router } from 'express';
import {
  getAuthStatus,
  setupAdmin,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
  updateAdminProfile,
  changePassword,
  uploadAdminAvatar,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.get('/status', getAuthStatus);
router.post('/setup', authLimiter, setupAdmin);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateAdminProfile);
router.put('/change-password', requireAuth, changePassword);
router.post('/avatar', requireAuth, upload.single('avatar'), uploadAdminAvatar);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/logout', requireAuth, logout);

export default router;

