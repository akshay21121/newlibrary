import { Router } from 'express';
import { getSeatMatrix, getSeatDetails } from '../controllers/seatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/matrix', getSeatMatrix);
router.get('/:id', getSeatDetails);

export default router;

