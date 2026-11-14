import { Router } from 'express';
import {
  getDashboardMetrics,
  getUpcomingExpirations,
  getRecentActivity,
} from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/metrics', getDashboardMetrics);
router.get('/expirations', getUpcomingExpirations);
router.get('/recent', getRecentActivity);

export default router;

