import { Router } from 'express';
import {
  getLibraryProfile,
  updateLibraryProfile,
  uploadLibraryLogo,
  getShifts,
  updateShift,
  getReminderSettings,
  updateReminderSettings,
} from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Public profile endpoint for login page branding & headers
router.get('/profile', getLibraryProfile);

router.use(requireAuth);

router.put('/profile', updateLibraryProfile);
router.post('/logo', upload.single('logo'), uploadLibraryLogo);

router.get('/shifts', getShifts);
router.put('/shifts/:id', updateShift);

router.get('/reminders', getReminderSettings);
router.put('/reminders', updateReminderSettings);

export default router;

