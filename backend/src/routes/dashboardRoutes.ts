import { Router } from 'express';
import {
  getDashboardMetrics,
  getUpcomingExpirations,
  getRecentActivity,
  getPendingDuesDrillDown,
  getShiftOccupancyDrillDown,
  getTodayCollectionsDrillDown,
  getExpirationsDrillDown,
  getRecentAdmissionsDrillDown,
  getRecentCollectionsDrillDown,
} from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/metrics', getDashboardMetrics);
router.get('/expirations', getUpcomingExpirations);
router.get('/recent', getRecentActivity);

// Drill-Down Endpoints
router.get('/drilldown/pending-dues', getPendingDuesDrillDown);
router.get('/drilldown/shift-occupancy/:shiftId', getShiftOccupancyDrillDown);
router.get('/drilldown/today-collections', getTodayCollectionsDrillDown);
router.get('/drilldown/expirations', getExpirationsDrillDown);
router.get('/drilldown/recent-admissions', getRecentAdmissionsDrillDown);
router.get('/drilldown/recent-collections', getRecentCollectionsDrillDown);

export default router;

