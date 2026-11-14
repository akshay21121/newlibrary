import { Router } from 'express';
import {
  getFeePlans,
  createFeePlan,
  updateFeePlan,
  deleteFeePlan,
  getInvoices,
  createInvoice,
  getInvoiceById,
  recordPayment,
  reversePayment,
  getReceiptData,
} from '../controllers/feeController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Plans
router.get('/plans', getFeePlans);
router.post('/plans', createFeePlan);
router.put('/plans/:id', updateFeePlan);
router.delete('/plans/:id', deleteFeePlan);

// Invoices
router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.get('/invoices/:id', getInvoiceById);

// Payments & Receipts
router.post('/payments', recordPayment);
router.post('/payments/:id/reverse', reversePayment);
router.get('/payments/receipt/:id', getReceiptData);

export default router;

