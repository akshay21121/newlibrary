import { Router } from 'express';
import {
  getUnpaidStudents,
  sendManualReminders,
  triggerAutoReminders,
  getReminderLogs,
} from '../controllers/reminderController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/unpaid', getUnpaidStudents);
router.post('/send', sendManualReminders);
router.post('/trigger-auto', triggerAutoReminders);
router.get('/logs', getReminderLogs);

export default router;

