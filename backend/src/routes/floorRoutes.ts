import { Router } from 'express';
import {
  getFloors,
  createFloor,
  createRoom,
  getRoomLayout,
  saveRoomLayout,
  runLayoutWizard,
  deleteSeat,
  renumberSeats,
  getRoomNumberingStatus,
  autoHealRoomNumbers,
} from '../controllers/floorController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getFloors);
router.post('/', createFloor);
router.post('/:floorId/rooms', createRoom);
router.get('/rooms/:roomId/layout', getRoomLayout);
router.put('/rooms/:roomId/layout', saveRoomLayout);
router.get('/rooms/:roomId/numbering-status', getRoomNumberingStatus);
router.post('/rooms/:roomId/auto-heal-numbers', autoHealRoomNumbers);
router.post('/rooms/:roomId/wizard', runLayoutWizard);
router.post('/rooms/:roomId/renumber', renumberSeats);
router.delete('/seats/:seatId', deleteSeat);

export default router;

