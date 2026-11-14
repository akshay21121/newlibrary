import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { generateInvoiceNumber, generateReceiptNumber } from '../utils/sequences.js';

const feePlanSchema = z.object({
  name: z.string().min(2),
  category: z.enum(['SHIFT_BASED', 'FULL_DAY']).default('SHIFT_BASED'),
  planType: z.string().default('SHIFT_BASED'),
  accessType: z.enum(['FULL_DAY_DEDICATED', 'FULL_DAY_FLEXIBLE', 'SHIFT']).optional().nullable(),
  shiftId: z.string().optional().nullable(),
  durationMonths: z.number().min(1).default(1),
  durationDays: z.number().min(1).default(30),
  originalPrice: z.number().min(0).optional().nullable(),
  price: z.number().min(0), // final discounted membership price
  admissionFee: z.number().min(0).default(0),
  hasDiscount: z.boolean().default(false),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional().nullable(),
  discountValue: z.number().min(0).optional().nullable(),
  discountValidUntil: z.string().optional().nullable(),
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
  const category = req.query.category as string | undefined;
  const shiftId = req.query.shiftId as string | undefined;
  const accessType = req.query.accessType as string | undefined;
  const durationMonths = req.query.durationMonths ? parseInt(req.query.durationMonths as string, 10) : undefined;
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

  const where: any = {};
  if (category) where.category = category;
  if (shiftId) where.shiftId = shiftId;
  if (accessType) where.accessType = accessType;
  if (durationMonths) where.durationMonths = durationMonths;
  if (isActive !== undefined) where.isActive = isActive;

  const plans = await prisma.feePlan.findMany({
    where,
    orderBy: [
      { category: 'asc' },
      { durationMonths: 'asc' },
      { price: 'asc' },
    ],
    include: {
      shift: { select: { id: true, name: true, code: true, startTime: true, endTime: true } },
      _count: { select: { bookings: true, invoices: true } },
    },
  });

  // Calculate dynamic savings breakdown for display
  const plansWithCalculations = plans.map((p) => {
    let discountAmount = 0;
    let discountPercent = 0;

    if (p.originalPrice && p.originalPrice > p.price) {
      discountAmount = Math.round(p.originalPrice - p.price);
      discountPercent = Math.round((discountAmount / p.originalPrice) * 100);
    } else if (p.hasDiscount && p.discountValue) {
      if (p.discountType === 'PERCENTAGE') {
        discountPercent = Math.round(p.discountValue);
        discountAmount = p.originalPrice ? Math.round((p.originalPrice * discountPercent) / 100) : 0;
      } else {
        discountAmount = Math.round(p.discountValue);
        discountPercent = p.originalPrice ? Math.round((discountAmount / p.originalPrice) * 100) : 0;
      }
    }

    const totalPayable = p.price + p.admissionFee;

    return {
      ...p,
      calculatedDiscountAmount: discountAmount,
      calculatedDiscountPercent: discountPercent,
      totalPayable,
    };
  });

  res.json({ plans: plansWithCalculations });
}

export async function createFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = feePlanSchema.parse(req.body);

  // Auto-calculate duration days if standard months passed
  let durationDays = data.durationDays;
  if (data.durationMonths && (!data.durationDays || data.durationDays === 30)) {
    durationDays = data.durationMonths * 30;
  }

  // Calculate final price if discount entered
  let price = data.price;
  let originalPrice = data.originalPrice;

  if (data.hasDiscount && data.discountValue && originalPrice) {
    if (data.discountType === 'PERCENTAGE') {
      price = Math.round(originalPrice - (originalPrice * data.discountValue) / 100);
    } else if (data.discountType === 'FIXED') {
      price = Math.max(0, originalPrice - data.discountValue);
    }
  }

  const plan = await prisma.feePlan.create({
    data: {
      name: data.name,
      category: data.category,
      planType: data.planType,
      accessType: data.accessType || (data.category === 'SHIFT_BASED' ? 'SHIFT' : 'FULL_DAY_DEDICATED'),
      shiftId: data.category === 'SHIFT_BASED' ? data.shiftId || null : null,
      durationMonths: data.durationMonths,
      durationDays,
      originalPrice,
      price,
      admissionFee: data.admissionFee,
      hasDiscount: data.hasDiscount,
      discountType: data.discountType || null,
      discountValue: data.discountValue || null,
      discountValidUntil: data.discountValidUntil ? new Date(data.discountValidUntil) : null,
      description: data.description || null,
      isActive: data.isActive,
    },
    include: {
      shift: true,
    },
  });

  await logAuditEvent('FEE_PLAN', 'CREATE', plan.id, data, req);

  res.status(201).json({ message: 'Fee plan created successfully', plan });
}

export async function updateFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = feePlanSchema.partial().parse(req.body);

  const updateData: any = { ...data };
  if (data.discountValidUntil) {
    updateData.discountValidUntil = new Date(data.discountValidUntil);
  }

  const plan = await prisma.feePlan.update({
    where: { id },
    data: updateData,
    include: {
      shift: true,
    },
  });

  await logAuditEvent('FEE_PLAN', 'UPDATE', id, data, req);

  res.json({ message: 'Fee plan updated successfully', plan });
}

export async function deleteFeePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const plan = await prisma.feePlan.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          bookings: true,
          invoices: true,
        },
      },
    },
  });

  if (!plan) {
    res.status(404).json({ error: 'Fee plan not found' });
    return;
  }

  // Safe deletion check:
  // If linked to historical bookings or invoices, do not delete; deactivate instead!
  if (plan._count.bookings > 0 || plan._count.invoices > 0) {
    await prisma.feePlan.update({
      where: { id },
      data: { isActive: false },
    });

    await logAuditEvent('FEE_PLAN', 'DEACTIVATE', id, { reason: 'Plan is linked to active admissions/invoices' }, req);

    res.json({
      message: 'Plan has existing admissions and invoices. It has been safely deactivated instead of deleted to protect historical financial records.',
      deactivated: true,
    });
    return;
  }

  // Safe to hard delete
  await prisma.feePlan.delete({ where: { id } });
  await logAuditEvent('FEE_PLAN', 'DELETE', id, null, req);

  res.json({ message: 'Fee plan deleted successfully', deactivated: false });
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
        feePlan: { select: { name: true, category: true, accessType: true } },
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
