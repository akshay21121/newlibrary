import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { generateInvoiceNumber, generateReceiptNumber } from '../utils/sequences.js';

const createBookingSchema = z.object({
  studentId: z.string(),
  seatId: z.string(),
  shiftId: z.string(),
  feePlanId: z.string().optional().nullable(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  monthlyPrice: z.number().default(0),
  createInvoice: z.boolean().default(true),
  initialPaymentAmount: z.number().default(0),
  paymentMethod: z.string().default('CASH'),
  notes: z.string().optional().nullable(),
});

const transferSeatSchema = z.object({
  targetSeatId: z.string(),
  targetShiftId: z.string().optional(),
  reason: z.string().min(2),
});

const releaseSeatSchema = z.object({
  reason: z.string().optional().nullable(),
});

export async function createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = createBookingSchema.parse(req.body);

  const startDate = new Date(data.startDate);
  let endDate: Date;

  if (data.endDate) {
    endDate = new Date(data.endDate);
  } else if (data.feePlanId) {
    const plan = await prisma.feePlan.findUnique({ where: { id: data.feePlanId } });
    const days = plan?.durationDays || 30;
    endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  } else {
    endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Conflict Check: No overlapping active booking for the same seat and shift
  const conflict = await prisma.seatBooking.findFirst({
    where: {
      seatId: data.seatId,
      shiftId: data.shiftId,
      status: 'ACTIVE',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      student: { select: { fullName: true, admissionNumber: true } },
    },
  });

  if (conflict) {
    res.status(409).json({
      error: `Seat is already booked for this shift by ${conflict.student.fullName} (${conflict.student.admissionNumber}) until ${conflict.endDate.toLocaleDateString()}.`,
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create booking
    const booking = await tx.seatBooking.create({
      data: {
        studentId: data.studentId,
        seatId: data.seatId,
        shiftId: data.shiftId,
        feePlanId: data.feePlanId || null,
        startDate,
        endDate,
        monthlyPrice: data.monthlyPrice,
        notes: data.notes || null,
        status: 'ACTIVE',
      },
      include: {
        seat: true,
        shift: true,
        student: true,
      },
    });

    // 2. Log History
    await tx.seatBookingHistory.create({
      data: {
        bookingId: booking.id,
        studentId: data.studentId,
        seatId: data.seatId,
        shiftId: data.shiftId,
        actionType: 'BOOKED',
        remarks: data.notes || 'Seat booked successfully',
        createdBy: req.admin?.name || 'Admin',
      },
    });

    let invoice = null;
    let payment = null;

    // 3. Optional invoice generation
    if (data.createInvoice && data.monthlyPrice > 0) {
      const invoiceNumber = await generateInvoiceNumber();
      const totalAmount = data.monthlyPrice;
      const initialPaid = Math.min(data.initialPaymentAmount, totalAmount);
      const balanceAmount = Math.max(0, totalAmount - initialPaid);
      const invoiceStatus = balanceAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          studentId: data.studentId,
          bookingId: booking.id,
          feePlanId: data.feePlanId || null,
          dueDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          subtotal: totalAmount,
          totalAmount,
          paidAmount: initialPaid,
          balanceAmount,
          status: invoiceStatus,
        },
      });

      if (initialPaid > 0) {
        const receiptNumber = await generateReceiptNumber();
        payment = await tx.payment.create({
          data: {
            receiptNumber,
            invoiceId: invoice.id,
            studentId: data.studentId,
            amount: initialPaid,
            paymentMethod: data.paymentMethod,
            remarks: 'Booking payment',
            status: 'SUCCESS',
          },
        });

        await tx.paymentAuditLog.create({
          data: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            action: 'PAYMENT_RECEIVED',
            previousState: JSON.stringify({ balanceAmount: totalAmount, status: 'UNPAID' }),
            newState: JSON.stringify({ balanceAmount, status: invoiceStatus }),
            reason: 'Booking settlement',
          },
        });
      }
    }

    return { booking, invoice, payment };
  });

  await logAuditEvent('BOOKING', 'CREATE', result.booking.id, {
    studentId: data.studentId,
    seatId: data.seatId,
    shiftId: data.shiftId,
  }, req);

  res.status(201).json({
    message: 'Seat booked successfully',
    ...result,
  });
}

export async function transferSeat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { targetSeatId, targetShiftId, reason } = transferSeatSchema.parse(req.body);

  const booking = await prisma.seatBooking.findUnique({
    where: { id },
    include: {
      seat: true,
      shift: true,
      student: true,
    },
  });

  if (!booking || booking.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Active booking not found' });
    return;
  }

  const newShiftId = targetShiftId || booking.shiftId;

  // Conflict check on target seat & shift
  const conflict = await prisma.seatBooking.findFirst({
    where: {
      seatId: targetSeatId,
      shiftId: newShiftId,
      status: 'ACTIVE',
      id: { not: booking.id },
      startDate: { lte: booking.endDate },
      endDate: { gte: booking.startDate },
    },
    include: { student: { select: { fullName: true } } },
  });

  if (conflict) {
    res.status(409).json({
      error: `Target seat is already occupied by ${conflict.student.fullName} for this shift.`,
    });
    return;
  }

  const previousSeatId = booking.seatId;

  await prisma.$transaction(async (tx) => {
    // Update booking
    await tx.seatBooking.update({
      where: { id },
      data: {
        seatId: targetSeatId,
        shiftId: newShiftId,
      },
    });

    // Record transfer in history
    await tx.seatBookingHistory.create({
      data: {
        bookingId: booking.id,
        studentId: booking.studentId,
        seatId: targetSeatId,
        shiftId: newShiftId,
        actionType: 'TRANSFERRED',
        previousSeatId,
        newSeatId: targetSeatId,
        remarks: reason,
        createdBy: req.admin?.name || 'Admin',
      },
    });
  });

  await logAuditEvent('BOOKING', 'TRANSFER', id, {
    studentId: booking.studentId,
    fromSeat: previousSeatId,
    toSeat: targetSeatId,
    reason,
  }, req);

  res.json({ message: 'Seat transferred successfully' });
}

export async function releaseSeat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = releaseSeatSchema.parse(req.body);

  const booking = await prisma.seatBooking.findUnique({
    where: { id },
  });

  if (!booking || booking.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Active booking not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.seatBooking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
      },
    });

    await tx.seatBookingHistory.create({
      data: {
        bookingId: booking.id,
        studentId: booking.studentId,
        seatId: booking.seatId,
        shiftId: booking.shiftId,
        actionType: 'RELEASED',
        remarks: reason || 'Seat released by admin',
        createdBy: req.admin?.name || 'Admin',
      },
    });
  });

  await logAuditEvent('BOOKING', 'RELEASE', id, { reason }, req);

  res.json({ message: 'Seat released successfully' });
}

export async function getBookingHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '25', 10);
  const studentId = req.query.studentId as string | undefined;
  const seatId = req.query.seatId as string | undefined;

  const skip = (page - 1) * limit;
  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (seatId) where.seatId = seatId;

  const [histories, total] = await Promise.all([
    prisma.seatBookingHistory.findMany({
      where,
      include: {
        student: { select: { fullName: true, admissionNumber: true, phone: true } },
        seat: { select: { seatNumber: true } },
        shift: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.seatBookingHistory.count({ where }),
  ]);

  res.json({
    histories,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

