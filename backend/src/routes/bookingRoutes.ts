import { Router } from 'express';
import {
  createBooking,
  transferSeat,
  releaseSeat,
  getBookingHistory,
} from '../controllers/bookingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/', createBooking);
router.post('/:id/transfer', transferSeat);
router.post('/:id/release', releaseSeat);
router.get('/history', getBookingHistory);

export default router;

