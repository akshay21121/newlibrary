import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateAdmissionNumber, generateInvoiceNumber, generateReceiptNumber } from '../utils/sequences.js';
import { logAuditEvent } from '../utils/audit.js';

const studentCreateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(8),
  alternatePhone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  targetExam: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Optional direct booking at admission
  seatId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
  feePlanId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  initialPaymentAmount: z.union([z.number(), z.string()]).optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  transactionRef: z.string().optional().nullable(),
});

const studentUpdateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().min(8).optional(),
  alternatePhone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  targetExam: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
});

export async function getStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const shiftId = (req.query.shiftId as string) || '';

  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (status) {
    whereClause.status = status;
  }

  if (search) {
    whereClause.OR = [
      { fullName: { contains: search } },
      { admissionNumber: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (shiftId) {
    whereClause.bookings = {
      some: {
        shiftId,
        status: 'ACTIVE',
      },
    };
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where: whereClause,
      include: {
        bookings: {
          where: { status: 'ACTIVE' },
          include: {
            seat: { select: { seatNumber: true } },
            shift: { select: { name: true, code: true } },
          },
        },
        invoices: {
          where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { balanceAmount: true },
        },
      },
      orderBy: { admissionDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.student.count({ where: whereClause }),
  ]);

  // Compute pending balance helper
  const studentsWithBalance = students.map((s) => {
    const totalPending = s.invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
    const activeBooking = s.bookings[0] || null;
    return {
      ...s,
      pendingBalance: totalPending,
      currentSeat: activeBooking?.seat?.seatNumber || null,
      currentShift: activeBooking?.shift?.name || null,
    };
  });

  res.json({
    students: studentsWithBalance,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function createStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const photoFile = files?.photo?.[0];
  const kycFile = files?.idProofDocument?.[0];

  const bodyData = { ...req.body };
  if (bodyData.initialPaymentAmount !== undefined && bodyData.initialPaymentAmount !== null && bodyData.initialPaymentAmount !== '') {
    bodyData.initialPaymentAmount = parseFloat(bodyData.initialPaymentAmount);
  }

  const validated = studentCreateSchema.parse(bodyData);
  const admissionNumber = await generateAdmissionNumber();

  const photoUrl = photoFile ? `/uploads/${photoFile.filename}` : null;
  const idProofDocumentUrl = kycFile ? `/uploads/${kycFile.filename}` : null;

  // Transaction to create student, optional booking, invoice & payment
  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        admissionNumber,
        fullName: validated.fullName,
        email: validated.email || null,
        phone: validated.phone,
        alternatePhone: validated.alternatePhone || null,
        dateOfBirth: validated.dateOfBirth || null,
        gender: validated.gender || null,
        address: validated.address || null,
        idProofType: validated.idProofType || null,
        idProofNumber: validated.idProofNumber || null,
        idProofDocumentUrl,
        photoUrl,
        emergencyContactName: validated.emergencyContactName || null,
        emergencyContactRelation: validated.emergencyContactRelation || null,
        emergencyContactPhone: validated.emergencyContactPhone || null,
        bloodGroup: validated.bloodGroup || null,
        targetExam: validated.targetExam || null,
        notes: validated.notes || null,
        status: 'ACTIVE',
      },
    });

    let booking = null;
    let invoice = null;
    let payment = null;

    // Check if immediate seat booking requested
    if (validated.seatId && validated.shiftId) {
      const startDate = validated.startDate ? new Date(validated.startDate) : new Date();
      let durationDays = 30;
      let monthlyPrice = 0;
      let admissionFee = 0;

      if (validated.feePlanId) {
        const plan = await tx.feePlan.findUnique({ where: { id: validated.feePlanId } });
        if (plan) {
          durationDays = plan.durationDays;
          monthlyPrice = plan.price;
          admissionFee = plan.admissionFee;
        }
      }

      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Check conflict
      const conflictingBooking = await tx.seatBooking.findFirst({
        where: {
          seatId: validated.seatId,
          shiftId: validated.shiftId,
          status: 'ACTIVE',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });

      if (conflictingBooking) {
        throw new Error('Selected seat and shift is already booked for this date range.');
      }

      booking = await tx.seatBooking.create({
        data: {
          studentId: student.id,
          seatId: validated.seatId,
          shiftId: validated.shiftId,
          feePlanId: validated.feePlanId || null,
          startDate,
          endDate,
          monthlyPrice,
          status: 'ACTIVE',
        },
      });

      await tx.seatBookingHistory.create({
        data: {
          bookingId: booking.id,
          studentId: student.id,
          seatId: validated.seatId,
          shiftId: validated.shiftId,
          actionType: 'BOOKED',
          remarks: 'Admission booking',
        },
      });

      // Generate invoice
      const totalAmount = monthlyPrice + admissionFee;
      const invoiceNumber = await generateInvoiceNumber();

      const initialPay = Number(validated.initialPaymentAmount) || 0;
      const initialPaid = Math.min(initialPay, totalAmount);
      const balanceAmount = Math.max(0, totalAmount - initialPaid);
      const invoiceStatus = balanceAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          studentId: student.id,
          bookingId: booking.id,
          feePlanId: validated.feePlanId || null,
          dueDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          subtotal: totalAmount,
          totalAmount,
          paidAmount: initialPaid,
          balanceAmount,
          status: invoiceStatus,
        },
      });

      // Record initial payment if paid
      if (initialPaid > 0) {
        const receiptNumber = await generateReceiptNumber();
        payment = await tx.payment.create({
          data: {
            receiptNumber,
            invoiceId: invoice.id,
            studentId: student.id,
            amount: initialPaid,
            paymentMethod: validated.paymentMethod || 'CASH',
            transactionRef: validated.transactionRef || null,
            remarks: 'Admission payment',
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
            reason: 'Admission settlement',
          },
        });
      }
    }

    return { student, booking, invoice, payment };
  });

  await logAuditEvent('STUDENT', 'ADMISSION', result.student.id, { admissionNumber, name: result.student.fullName }, req);

  res.status(201).json({
    message: 'Student admitted successfully',
    ...result,
  });
}

export async function getStudentById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          seat: {
            select: {
              seatNumber: true,
              floor: { select: { name: true } },
              room: { select: { name: true } },
            },
          },
          shift: { select: { name: true, startTime: true, endTime: true } },
          feePlan: { select: { name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        include: {
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
          feePlan: { select: { name: true } },
        },
        orderBy: { issueDate: 'desc' },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: { select: { invoiceNumber: true } },
        },
      },
      bookingHistories: {
        include: {
          seat: { select: { seatNumber: true } },
          shift: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      reminderLogs: {
        orderBy: { sentAt: 'desc' },
      },
    },
  });

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  res.json({ student });
}

export async function updateStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = studentUpdateSchema.parse(req.body);

  const student = await prisma.student.update({
    where: { id },
    data,
  });

  await logAuditEvent('STUDENT', 'UPDATE', id, data, req);

  res.json({ message: 'Student details updated successfully', student });
}

export async function deleteStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          invoices: true,
          payments: true,
          bookings: true,
        },
      },
    },
  });

  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  // Proper financial record retention check:
  // If the student has invoices or payments, archiving is performed to preserve audit trail
  if (student._count.invoices > 0 || student._count.payments > 0) {
    // Release any active bookings
    await prisma.seatBooking.updateMany({
      where: { studentId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    const updated = await prisma.student.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await logAuditEvent('STUDENT', 'ARCHIVED', id, {
      reason: 'Archived with financial records preserved for compliance',
      invoicesCount: student._count.invoices,
      paymentsCount: student._count.payments,
    }, req);

    res.json({
      message: 'Student archived. Financial records and receipts are preserved for legal and audit compliance.',
      student: updated,
      archived: true,
    });
    return;
  }

  // No financial records exist, hard delete safely
  await prisma.student.delete({ where: { id } });
  await logAuditEvent('STUDENT', 'DELETED', id, { admissionNumber: student.admissionNumber }, req);

  res.json({ message: 'Student deleted successfully', archived: false });
}

export async function renewStudentMembership(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const schema = z.object({
    seatId: z.string(),
    shiftId: z.string(),
    feePlanId: z.string(),
    startDate: z.string().optional(),
    amountPaid: z.number().default(0),
    paymentMethod: z.string().default('CASH'),
    transactionRef: z.string().optional(),
  });

  const { seatId, shiftId, feePlanId, startDate: reqStartDate, amountPaid, paymentMethod, transactionRef } = schema.parse(req.body);

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const feePlan = await prisma.feePlan.findUnique({ where: { id: feePlanId } });
  if (!feePlan) {
    res.status(404).json({ error: 'Fee plan not found' });
    return;
  }

  const startDate = reqStartDate ? new Date(reqStartDate) : new Date();
  const endDate = new Date(startDate.getTime() + feePlan.durationDays * 24 * 60 * 60 * 1000);

  // Check conflicts
  const conflict = await prisma.seatBooking.findFirst({
    where: {
      seatId,
      shiftId,
      status: 'ACTIVE',
      studentId: { not: id },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (conflict) {
    res.status(409).json({ error: 'The selected seat is already reserved for this shift and timeframe.' });
    return;
  }

  // Deactivate prior active bookings for this student
  await prisma.seatBooking.updateMany({
    where: { studentId: id, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  });

  const booking = await prisma.seatBooking.create({
    data: {
      studentId: id,
      seatId,
      shiftId,
      feePlanId,
      startDate,
      endDate,
      monthlyPrice: feePlan.price,
      status: 'ACTIVE',
    },
  });

  await prisma.seatBookingHistory.create({
    data: {
      bookingId: booking.id,
      studentId: id,
      seatId,
      shiftId,
      actionType: 'EXTENDED',
      remarks: `Membership renewed with plan: ${feePlan.name}`,
    },
  });

  // Generate Renewal Invoice
  const invoiceNumber = await generateInvoiceNumber();
  const totalAmount = feePlan.price;
  const initialPaid = Math.min(amountPaid, totalAmount);
  const balanceAmount = Math.max(0, totalAmount - initialPaid);
  const invoiceStatus = balanceAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      studentId: id,
      bookingId: booking.id,
      feePlanId,
      dueDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      subtotal: totalAmount,
      totalAmount,
      paidAmount: initialPaid,
      balanceAmount,
      status: invoiceStatus,
      notes: `Renewal membership for ${feePlan.name}`,
    },
  });

  let payment = null;
  if (initialPaid > 0) {
    const receiptNumber = await generateReceiptNumber();
    payment = await prisma.payment.create({
      data: {
        receiptNumber,
        invoiceId: invoice.id,
        studentId: id,
        amount: initialPaid,
        paymentMethod,
        transactionRef: transactionRef || null,
        remarks: 'Renewal fee settlement',
        status: 'SUCCESS',
      },
    });

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        action: 'PAYMENT_RECEIVED',
        previousState: JSON.stringify({ balanceAmount: totalAmount, status: 'UNPAID' }),
        newState: JSON.stringify({ balanceAmount, status: invoiceStatus }),
        reason: 'Membership renewal payment',
      },
    });
  }

  // Ensure student is active
  await prisma.student.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });

  await logAuditEvent('STUDENT', 'RENEWAL', id, { bookingId: booking.id, invoiceNumber }, req);

  res.json({
    message: 'Membership renewed successfully',
    booking,
    invoice,
    payment,
  });
}

