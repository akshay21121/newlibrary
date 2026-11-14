import { Router } from 'express';
import {
  getLibraryProfile,
  updateLibraryProfile,
  getShifts,
  updateShift,
  getReminderSettings,
  updateReminderSettings,
} from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/profile', getLibraryProfile);
router.put('/profile', updateLibraryProfile);

router.get('/shifts', getShifts);
router.put('/shifts/:id', updateShift);

router.get('/reminders', getReminderSettings);
router.put('/reminders', updateReminderSettings);

export default router;

