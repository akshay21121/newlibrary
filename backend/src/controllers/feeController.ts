import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { generateInvoiceNumber, generateReceiptNumber } from '../utils/sequences.js';

const feePlanSchema = z.object({
  name: z.string().min(2),
  planType: z.enum(['SHIFT_BASED', 'DURATION_BASED', 'ADMISSION_FEE']).default('SHIFT_BASED'),
  durationDays: z.number().min(1).default(30),
  shiftId: z.string().optional().nullable(),
  price: z.number().min(0),
  admissionFee: z.number().min(0).default(0),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const createInvoiceSchema = z.object({
  studentId: z.string(),
  bookingId: z.string().optional().nullable(),
  feePlanId: z.string().optional().nullable(),
  dueDate: z.string(),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().min(1),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'NET_BANKING', 'CHEQUE', 'OTHER']).default('CASH'),
  transactionRef: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const reversePaymentSchema = z.object({
  reason: z.string().min(3),
});

// Fee Plans
export async function getFeePlans(req: AuthenticatedRequest, res: Response): Promise<void> {
  const plans = await prisma.feePlan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      shift: { select: { id: true, name: true, code: true } },
      _count: { select: { bookings: true, invoices: true } },
    },
  });

  res.json({ plans });
}

export async function createFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = feePlanSchema.parse(req.body);

  const plan = await prisma.feePlan.create({
    data: {
      name: data.name,
      planType: data.planType,
      durationDays: data.durationDays,
      shiftId: data.shiftId || null,
      price: data.price,
      admissionFee: data.admissionFee,
      description: data.description || null,
      isActive: data.isActive,
    },
  });

  await logAuditEvent('FEE_PLAN', 'CREATE', plan.id, data, req);

  res.status(201).json({ message: 'Fee plan created successfully', plan });
}

export async function updateFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = feePlanSchema.partial().parse(req.body);

  const plan = await prisma.feePlan.update({
    where: { id },
    data,
  });

  await logAuditEvent('FEE_PLAN', 'UPDATE', id, data, req);

  res.json({ message: 'Fee plan updated successfully', plan });
}

export async function deleteFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Soft delete / deactivate
  const plan = await prisma.feePlan.update({
    where: { id },
    data: { isActive: false },
  });

  await logAuditEvent('FEE_PLAN', 'DEACTIVATE', id, null, req);

  res.json({ message: 'Fee plan deactivated successfully', plan });
}

// Invoices
export async function getInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const status = req.query.status as string | undefined;
  const studentId = req.query.studentId as string | undefined;
  const search = req.query.search as string | undefined;

  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) {
    where.status = status;
  }
  if (studentId) {
    where.studentId = studentId;
  }
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { student: { fullName: { contains: search } } },
      { student: { admissionNumber: { contains: search } } },
      { student: { phone: { contains: search } } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, admissionNumber: true, phone: true } },
        feePlan: { select: { name: true } },
        payments: {
          where: { status: 'SUCCESS' },
          select: { id: true, receiptNumber: true, amount: true, paymentDate: true, paymentMethod: true },
        },
      },
      orderBy: { issueDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = createInvoiceSchema.parse(req.body);

  const totalAmount = data.subtotal - data.discount + data.tax;
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      studentId: data.studentId,
      bookingId: data.bookingId || null,
      feePlanId: data.feePlanId || null,
      dueDate: new Date(data.dueDate),
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      totalAmount,
      paidAmount: 0,
      balanceAmount: totalAmount,
      status: 'UNPAID',
      notes: data.notes || null,
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      invoiceId: invoice.id,
      action: 'INVOICE_CREATED',
      newState: JSON.stringify(invoice),
      reason: 'Manual invoice generation',
      changedBy: req.admin?.name || 'Admin',
    },
  });

  await logAuditEvent('INVOICE', 'CREATE', invoice.id, { invoiceNumber, totalAmount }, req);

  res.status(201).json({ message: 'Invoice generated successfully', invoice });
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      student: true,
      booking: {
        include: {
          seat: true,
          shift: true,
        },
      },
      feePlan: true,
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  res.json({ invoice });
}

// Payments & Receipts
export async function recordPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = recordPaymentSchema.parse(req.body);

  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (invoice.balanceAmount <= 0) {
    res.status(400).json({ error: 'This invoice is already fully paid' });
    return;
  }

  if (data.amount > invoice.balanceAmount) {
    res.status(400).json({
      error: `Payment amount (₹${data.amount}) cannot exceed current outstanding balance (₹${invoice.balanceAmount})`,
    });
    return;
  }

  const receiptNumber = await generateReceiptNumber();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Payment
    const payment = await tx.payment.create({
      data: {
        receiptNumber,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionRef: data.transactionRef || null,
        remarks: data.remarks || null,
        status: 'SUCCESS',
      },
    });

    // 2. Update Invoice
    const newPaidAmount = invoice.paidAmount + data.amount;
    const newBalanceAmount = invoice.totalAmount - newPaidAmount;
    const newStatus = newBalanceAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
      },
    });

    // 3. Record Financial Audit Log
    await tx.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        action: 'PAYMENT_RECEIVED',
        previousState: JSON.stringify({
          paidAmount: invoice.paidAmount,
          balanceAmount: invoice.balanceAmount,
          status: invoice.status,
        }),
        newState: JSON.stringify({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
          paymentMethod: data.paymentMethod,
          receiptNumber,
        }),
        reason: data.remarks || 'Payment settled at counter',
        changedBy: req.admin?.name || 'Admin',
      },
    });

    return { payment, updatedInvoice };
  });

  await logAuditEvent('PAYMENT', 'RECORD', result.payment.id, {
    receiptNumber,
    amount: data.amount,
    invoiceId: invoice.id,
  }, req);

  res.status(201).json({
    message: 'Payment recorded and receipt generated successfully',
    ...result,
  });
}

export async function reversePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = reversePaymentSchema.parse(req.body);

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { invoice: true },
  });

  if (!payment) {
    res.status(404).json({ error: 'Payment record not found' });
    return;
  }

  if (payment.status === 'REVERSED') {
    res.status(400).json({ error: 'This payment has already been reversed' });
    return;
  }

  const invoice = payment.invoice;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark Payment as Reversed
    const updatedPayment = await tx.payment.update({
      where: { id },
      data: {
        status: 'REVERSED',
        reversalReason: reason,
        reversedAt: new Date(),
        reversedBy: req.admin?.name || 'Admin',
      },
    });

    // 2. Adjust Invoice Balance
    const newPaidAmount = Math.max(0, invoice.paidAmount - payment.amount);
    const newBalanceAmount = invoice.totalAmount - newPaidAmount;
    const newStatus = newPaidAmount === 0 ? 'UNPAID' : 'PARTIALLY_PAID';

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
      },
    });

    // 3. Record Audit Log
    await tx.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        action: 'PAYMENT_REVERSED',
        previousState: JSON.stringify({
          paidAmount: invoice.paidAmount,
          balanceAmount: invoice.balanceAmount,
          status: invoice.status,
        }),
        newState: JSON.stringify({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
          reversalReason: reason,
        }),
        reason,
        changedBy: req.admin?.name || 'Admin',
      },
    });

    return { updatedPayment, updatedInvoice };
  });

  await logAuditEvent('PAYMENT', 'REVERSE', id, { receiptNumber: payment.receiptNumber, reason }, req);

  res.json({
    message: 'Payment reversed successfully and invoice balance recalculated.',
    ...result,
  });
}

export async function getReceiptData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      student: true,
      invoice: {
        include: {
          feePlan: true,
          booking: {
            include: {
              seat: true,
              shift: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    res.status(404).json({ error: 'Receipt not found' });
    return;
  }

  const library = await prisma.libraryProfile.findFirst();

  res.json({
    payment,
    library,
  });
}

