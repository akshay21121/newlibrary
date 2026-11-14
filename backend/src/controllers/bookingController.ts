import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { generateInvoiceNumber, generateReceiptNumber } from '../utils/sequences.js';

const createBookingSchema = z.object({
  studentId: z.string(),
  seatId: z.string(),
  shiftId: z.string().optional().nullable(),
  feePlanId: z.string().optional().nullable(),
  membershipCategory: z.string().optional().default('SHIFT_BASED'),
  accessType: z.string().optional().default('SHIFT'),
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

  const isFullDay = data.membershipCategory === 'FULL_DAY' || data.accessType === 'FULL_DAY_DEDICATED';
  const shiftsToBook = isFullDay
    ? await prisma.shift.findMany({ where: { isActive: true } })
    : data.shiftId
    ? await prisma.shift.findMany({ where: { id: data.shiftId } })
    : [];

  if (shiftsToBook.length === 0) {
    res.status(400).json({ error: 'Please select a valid shift or full-day plan' });
    return;
  }

  // Conflict Check: No overlapping active booking for the seat and shifts
  for (const sh of shiftsToBook) {
    const conflict = await prisma.seatBooking.findFirst({
      where: {
        seatId: data.seatId,
        shiftId: sh.id,
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
        error: `Seat is already booked for ${sh.name} shift by ${conflict.student.fullName} (${conflict.student.admissionNumber}) until ${conflict.endDate.toLocaleDateString()}.`,
      });
      return;
    }
  }

  const bookingGroupId = isFullDay ? randomUUID() : null;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create bookings for each shift in the group
    const createdBookings = [];
    for (const sh of shiftsToBook) {
      const booking = await tx.seatBooking.create({
        data: {
          studentId: data.studentId,
          seatId: data.seatId,
          shiftId: sh.id,
          feePlanId: data.feePlanId || null,
          bookingGroupId,
          membershipCategory: data.membershipCategory,
          accessType: data.accessType,
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

      await tx.seatBookingHistory.create({
        data: {
          bookingId: booking.id,
          studentId: data.studentId,
          seatId: data.seatId,
          shiftId: sh.id,
          bookingGroupId,
          membershipCategory: data.membershipCategory,
          actionType: 'BOOKED',
          remarks: data.notes || (isFullDay ? 'Full-Day seat booked' : 'Seat booked successfully'),
          createdBy: req.admin?.name || 'Admin',
        },
      });

      createdBookings.push(booking);
    }

    const primaryBooking = createdBookings[0];
    let invoice = null;
    let payment = null;

    // 2. Optional invoice generation (one invoice for the entire booking)
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
          bookingId: primaryBooking.id,
          bookingGroupId,
          membershipCategory: data.membershipCategory,
          accessType: data.accessType,
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

    return { booking: primaryBooking, bookings: createdBookings, invoice, payment };
  });

  await logAuditEvent('BOOKING', 'CREATE', result.booking.id, {
    studentId: data.studentId,
    seatId: data.seatId,
    bookingGroupId,
    membershipCategory: data.membershipCategory,
  }, req);

  res.status(201).json({
    message: isFullDay ? 'Full-Day seat booked successfully' : 'Seat booked successfully',
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

  // If this booking belongs to a group (e.g. Full-Day), we transfer all active bookings in that group
  const bookingsToTransfer = booking.bookingGroupId
    ? await prisma.seatBooking.findMany({
        where: { bookingGroupId: booking.bookingGroupId, status: 'ACTIVE' },
        include: { shift: true },
      })
    : [booking];

  // Conflict check for all shifts to transfer
  for (const b of bookingsToTransfer) {
    const shiftToCheck = booking.bookingGroupId ? b.shiftId : (targetShiftId || b.shiftId);
    const conflict = await prisma.seatBooking.findFirst({
      where: {
        seatId: targetSeatId,
        shiftId: shiftToCheck,
        status: 'ACTIVE',
        id: { notIn: bookingsToTransfer.map((x) => x.id) },
        startDate: { lte: b.endDate },
        endDate: { gte: b.startDate },
      },
      include: { student: { select: { fullName: true } } },
    });

    if (conflict) {
      res.status(409).json({
        error: `Target seat is already occupied by ${conflict.student.fullName} for ${b.shift?.name || 'this'} shift.`,
      });
      return;
    }
  }

  const previousSeatId = booking.seatId;

  await prisma.$transaction(async (tx) => {
    for (const b of bookingsToTransfer) {
      const newShiftId = booking.bookingGroupId ? b.shiftId : (targetShiftId || b.shiftId);
      await tx.seatBooking.update({
        where: { id: b.id },
        data: {
          seatId: targetSeatId,
          shiftId: newShiftId,
        },
      });

      await tx.seatBookingHistory.create({
        data: {
          bookingId: b.id,
          studentId: b.studentId,
          seatId: targetSeatId,
          shiftId: newShiftId,
          bookingGroupId: b.bookingGroupId,
          membershipCategory: b.membershipCategory,
          actionType: 'TRANSFERRED',
          previousSeatId,
          newSeatId: targetSeatId,
          remarks: reason,
          createdBy: req.admin?.name || 'Admin',
        },
      });
    }
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

  // If this booking belongs to a group (e.g. Full-Day), release all active bookings in the group
  const bookingsToRelease = booking.bookingGroupId
    ? await prisma.seatBooking.findMany({
        where: { bookingGroupId: booking.bookingGroupId, status: 'ACTIVE' },
      })
    : [booking];

  await prisma.$transaction(async (tx) => {
    for (const b of bookingsToRelease) {
      await tx.seatBooking.update({
        where: { id: b.id },
        data: {
          status: 'COMPLETED',
        },
      });

      await tx.seatBookingHistory.create({
        data: {
          bookingId: b.id,
          studentId: b.studentId,
          seatId: b.seatId,
          shiftId: b.shiftId,
          bookingGroupId: b.bookingGroupId,
          membershipCategory: b.membershipCategory,
          actionType: 'RELEASED',
          remarks: reason || 'Seat released by admin',
          createdBy: req.admin?.name || 'Admin',
        },
      });
    }
  });

  await logAuditEvent('BOOKING', 'RELEASE', id, { reason, releasedCount: bookingsToRelease.length }, req);

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

