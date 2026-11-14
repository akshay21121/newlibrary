import { Router } from 'express';
import {
  getAuditLogs,
  createBackup,
  listBackups,
  restoreBackup,
} from '../controllers/systemController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/audit-logs', getAuditLogs);
router.post('/backup', createBackup);
router.get('/backups', listBackups);
router.post('/restore', restoreBackup);

export default router;

