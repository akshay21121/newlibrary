import { Router } from 'express';
import {
  getStudents,
  createStudent,
  getStudentById,
  updateStudent,
  deleteStudent,
  renewStudentMembership,
} from '../controllers/studentController.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);

router.get('/', getStudents);
router.post(
  '/',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idProofDocument', maxCount: 1 },
  ]),
  createStudent
);
router.get('/:id', getStudentById);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);
router.post('/:id/renew', renewStudentMembership);

export default router;

