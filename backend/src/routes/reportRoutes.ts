import { Router } from 'express';
import {
  getDailyCollections,
  getMonthlyCollections,
  getPaymentModeBreakdown,
  getDefaulters,
  getOccupancyReport,
  exportReportCsv,
} from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/daily-collections', getDailyCollections);
router.get('/monthly-collections', getMonthlyCollections);
router.get('/payment-modes', getPaymentModeBreakdown);
router.get('/defaulters', getDefaulters);
router.get('/occupancy', getOccupancyReport);
router.get('/export/:type', exportReportCsv);

export default router;

