import { Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
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

  // Plan & Seat Assignment
  membershipCategory: z.enum(['SHIFT_BASED', 'FULL_DAY']).optional(),
  accessType: z.enum(['FULL_DAY_DEDICATED', 'FULL_DAY_FLEXIBLE', 'SHIFT']).optional().nullable(),
  seatId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
  feePlanId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  customDiscountAmount: z.union([z.number(), z.string()]).optional().nullable(),
  customDiscountReason: z.string().optional().nullable(),
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
            feePlan: { select: { name: true, category: true, accessType: true } },
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

  // Compute pending balance & active plan details helper
  const studentsWithBalance = students.map((s) => {
    const totalPending = s.invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
    const activeBooking = s.bookings[0] || null;
    const isFullDay = activeBooking?.membershipCategory === 'FULL_DAY';

    return {
      ...s,
      pendingBalance: totalPending,
      currentSeat: activeBooking?.seat?.seatNumber || null,
      currentShift: isFullDay
        ? `Full-Day (${activeBooking?.accessType === 'FULL_DAY_DEDICATED' ? 'Dedicated' : 'Flexible'})`
        : activeBooking?.shift?.name || null,
      currentPlan: activeBooking?.feePlan?.name || null,
      isFullDay,
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
  if (bodyData.customDiscountAmount !== undefined && bodyData.customDiscountAmount !== null && bodyData.customDiscountAmount !== '') {
    bodyData.customDiscountAmount = parseFloat(bodyData.customDiscountAmount);
  }

  const validated = studentCreateSchema.parse(bodyData);
  const admissionNumber = await generateAdmissionNumber();

  const photoUrl = photoFile ? `/uploads/${photoFile.filename}` : null;
  const idProofDocumentUrl = kycFile ? `/uploads/${kycFile.filename}` : null;

  // Transaction to create student, bookings, invoice & payment
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

    let primaryBooking = null;
    let invoice = null;
    let payment = null;

    // Check if membership plan & seat assignment requested
    if (validated.feePlanId) {
      const plan = await tx.feePlan.findUnique({
        where: { id: validated.feePlanId },
        include: { shift: true },
      });

      if (!plan) {
        throw new Error('Selected membership fee plan not found.');
      }

      const startDate = validated.startDate ? new Date(validated.startDate) : new Date();
      const durationDays = plan.durationDays || (plan.durationMonths * 30);
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const isFullDay = plan.category === 'FULL_DAY';
      const bookingGroupId = isFullDay ? crypto.randomUUID() : null;

      // Seat Assignment check
      if (validated.seatId) {
        if (isFullDay) {
          // Full-Day: Check that NONE of the active shifts on this seat are occupied
          const allActiveShifts = await tx.shift.findMany({ where: { isActive: true } });

          const conflictingShiftBooking = await tx.seatBooking.findFirst({
            where: {
              seatId: validated.seatId,
              status: 'ACTIVE',
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
            include: {
              student: { select: { fullName: true } },
              shift: { select: { name: true } },
            },
          });

          if (conflictingShiftBooking) {
            throw new Error(
              `Cannot assign Full-Day Dedicated on this seat: Shift '${conflictingShiftBooking.shift.name}' is already booked by ${conflictingShiftBooking.student.fullName} for this duration.`
            );
          }

          // Reserve all 3 shifts for Full-Day
          for (const sh of allActiveShifts) {
            const b = await tx.seatBooking.create({
              data: {
                bookingGroupId,
                studentId: student.id,
                seatId: validated.seatId,
                shiftId: sh.id,
                feePlanId: plan.id,
                membershipCategory: 'FULL_DAY',
                accessType: plan.accessType || 'FULL_DAY_DEDICATED',
                startDate,
                endDate,
                monthlyPrice: plan.price,
                status: 'ACTIVE',
              },
            });

            await tx.seatBookingHistory.create({
              data: {
                bookingId: b.id,
                bookingGroupId,
                studentId: student.id,
                seatId: validated.seatId,
                shiftId: sh.id,
                membershipCategory: 'FULL_DAY',
                actionType: 'BOOKED',
                remarks: `Full-Day Dedicated admission on Shift: ${sh.name}`,
                createdBy: req.admin?.name || 'Admin',
              },
            });

            if (!primaryBooking) primaryBooking = b;
          }
        } else {
          // Shift-Based: Single shift booking
          const targetShiftId = validated.shiftId || plan.shiftId;
          if (!targetShiftId) {
            throw new Error('Please select a shift for the shift-based membership plan.');
          }

          const conflictingBooking = await tx.seatBooking.findFirst({
            where: {
              seatId: validated.seatId,
              shiftId: targetShiftId,
              status: 'ACTIVE',
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
            include: {
              student: { select: { fullName: true } },
            },
          });

          if (conflictingBooking) {
            throw new Error(
              `This seat is already booked for this shift by ${conflictingBooking.student.fullName}.`
            );
          }

          primaryBooking = await tx.seatBooking.create({
            data: {
              studentId: student.id,
              seatId: validated.seatId,
              shiftId: targetShiftId,
              feePlanId: plan.id,
              membershipCategory: 'SHIFT_BASED',
              accessType: 'SHIFT',
              startDate,
              endDate,
              monthlyPrice: plan.price,
              status: 'ACTIVE',
            },
          });

          await tx.seatBookingHistory.create({
            data: {
              bookingId: primaryBooking.id,
              studentId: student.id,
              seatId: validated.seatId,
              shiftId: targetShiftId,
              membershipCategory: 'SHIFT_BASED',
              actionType: 'BOOKED',
              remarks: 'Shift-based admission booking',
              createdBy: req.admin?.name || 'Admin',
            },
          });
        }
      }

      // Backend Verified Pricing & Discounts
      const originalFee = plan.originalPrice || plan.price;
      const planDiscount = (plan.originalPrice && plan.originalPrice > plan.price)
        ? (plan.originalPrice - plan.price)
        : 0;
      const customDiscount = Math.max(0, Number(validated.customDiscountAmount) || 0);
      const admissionFee = plan.admissionFee;
      const subtotal = originalFee + admissionFee;
      const totalDiscount = planDiscount + customDiscount;
      const totalAmount = Math.max(0, (plan.price + admissionFee) - customDiscount);

      const initialPay = Number(validated.initialPaymentAmount) || 0;
      const initialPaid = Math.min(initialPay, totalAmount);
      const balanceAmount = Math.max(0, totalAmount - initialPaid);
      const invoiceStatus = balanceAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      const planSnapshot = JSON.stringify({
        planId: plan.id,
        planName: plan.name,
        category: plan.category,
        accessType: plan.accessType,
        durationMonths: plan.durationMonths,
        durationDays: plan.durationDays,
        originalPrice: originalFee,
        planDiscount,
        customDiscount,
        customDiscountReason: validated.customDiscountReason || null,
        finalPrice: plan.price,
        admissionFee,
        totalPayable: totalAmount,
      });

      const invoiceNumber = await generateInvoiceNumber();

      invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          studentId: student.id,
          bookingId: primaryBooking?.id || null,
          bookingGroupId,
          feePlanId: plan.id,
          membershipCategory: plan.category,
          accessType: plan.accessType,
          durationMonths: plan.durationMonths,
          durationDays,
          planSnapshot,
          originalFee,
          planDiscount,
          customDiscount,
          customDiscountReason: validated.customDiscountReason || null,
          admissionFee,
          dueDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          subtotal,
          discount: totalDiscount,
          totalAmount,
          paidAmount: initialPaid,
          balanceAmount,
          status: invoiceStatus,
          notes: `Admission invoice for ${plan.name}`,
        },
      });

      // Record initial payment if settled
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
            remarks: 'Admission settlement',
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
            reason: 'Admission fee payment',
          },
        });
      }
    }

    return { student, booking: primaryBooking, invoice, payment };
  });

  await logAuditEvent('STUDENT', 'ADMISSION', result.student.id, {
    admissionNumber,
    name: result.student.fullName,
    membershipCategory: validated.membershipCategory,
  }, req);

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
          shift: { select: { name: true, startTime: true, endTime: true, code: true } },
          feePlan: {
            select: {
              name: true,
              price: true,
              originalPrice: true,
              category: true,
              accessType: true,
              durationMonths: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        include: {
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
          feePlan: { select: { name: true, category: true, accessType: true } },
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

  // Safe financial record retention:
  // If student has financial records, archive instead of delete
  if (student._count.invoices > 0 || student._count.payments > 0) {
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

  await prisma.student.delete({ where: { id } });
  await logAuditEvent('STUDENT', 'DELETED', id, { admissionNumber: student.admissionNumber }, req);

  res.json({ message: 'Student deleted successfully', archived: false });
}

export async function renewStudentMembership(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const schema = z.object({
    feePlanId: z.string(),
    seatId: z.string(),
    shiftId: z.string().optional().nullable(),
    startDate: z.string().optional(),
    customDiscountAmount: z.number().default(0),
    customDiscountReason: z.string().optional().nullable(),
    amountPaid: z.number().default(0),
    paymentMethod: z.string().default('CASH'),
    transactionRef: z.string().optional().nullable(),
  });

  const {
    feePlanId,
    seatId,
    shiftId,
    startDate: reqStartDate,
    customDiscountAmount,
    customDiscountReason,
    amountPaid,
    paymentMethod,
    transactionRef,
  } = schema.parse(req.body);

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const feePlan = await prisma.feePlan.findUnique({ where: { id: feePlanId } });
  if (!feePlan) {
    res.status(404).json({ error: 'Membership fee plan not found' });
    return;
  }

  const startDate = reqStartDate ? new Date(reqStartDate) : new Date();
  const durationDays = feePlan.durationDays || (feePlan.durationMonths * 30);
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const isFullDay = feePlan.category === 'FULL_DAY';
  const bookingGroupId = isFullDay ? crypto.randomUUID() : null;

  // Conflict Checking
  if (isFullDay) {
    const conflict = await prisma.seatBooking.findFirst({
      where: {
        seatId,
        status: 'ACTIVE',
        studentId: { not: id },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { student: { select: { fullName: true } }, shift: { select: { name: true } } },
    });

    if (conflict) {
      res.status(409).json({
        error: `Cannot renew with Full-Day plan on this seat: Shift '${conflict.shift.name}' is already occupied by ${conflict.student.fullName}.`,
      });
      return;
    }
  } else {
    const targetShiftId = shiftId || feePlan.shiftId;
    if (!targetShiftId) {
      res.status(400).json({ error: 'Shift ID is required for shift-based renewal' });
      return;
    }

    const conflict = await prisma.seatBooking.findFirst({
      where: {
        seatId,
        shiftId: targetShiftId,
        status: 'ACTIVE',
        studentId: { not: id },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { student: { select: { fullName: true } } },
    });

    if (conflict) {
      res.status(409).json({
        error: `Seat is already occupied for this shift by ${conflict.student.fullName}.`,
      });
      return;
    }
  }

  // Deactivate prior active bookings for this student
  await prisma.seatBooking.updateMany({
    where: { studentId: id, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  });

  let primaryBooking = null;

  if (isFullDay) {
    const allActiveShifts = await prisma.shift.findMany({ where: { isActive: true } });
    for (const sh of allActiveShifts) {
      const b = await prisma.seatBooking.create({
        data: {
          bookingGroupId,
          studentId: id,
          seatId,
          shiftId: sh.id,
          feePlanId: feePlan.id,
          membershipCategory: 'FULL_DAY',
          accessType: feePlan.accessType || 'FULL_DAY_DEDICATED',
          startDate,
          endDate,
          monthlyPrice: feePlan.price,
          status: 'ACTIVE',
        },
      });

      await prisma.seatBookingHistory.create({
        data: {
          bookingId: b.id,
          bookingGroupId,
          studentId: id,
          seatId,
          shiftId: sh.id,
          membershipCategory: 'FULL_DAY',
          actionType: 'EXTENDED',
          remarks: `Membership renewed with plan: ${feePlan.name} on ${sh.name}`,
          createdBy: req.admin?.name || 'Admin',
        },
      });

      if (!primaryBooking) primaryBooking = b;
    }
  } else {
    const targetShiftId = shiftId || feePlan.shiftId!;
    primaryBooking = await prisma.seatBooking.create({
      data: {
        studentId: id,
        seatId,
        shiftId: targetShiftId,
        feePlanId: feePlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
        startDate,
        endDate,
        monthlyPrice: feePlan.price,
        status: 'ACTIVE',
      },
    });

    await prisma.seatBookingHistory.create({
      data: {
        bookingId: primaryBooking.id,
        studentId: id,
        seatId,
        shiftId: targetShiftId,
        membershipCategory: 'SHIFT_BASED',
        actionType: 'EXTENDED',
        remarks: `Membership renewed with plan: ${feePlan.name}`,
        createdBy: req.admin?.name || 'Admin',
      },
    });
  }

  // Pricing calculations
  const originalFee = feePlan.originalPrice || feePlan.price;
  const planDiscount = (feePlan.originalPrice && feePlan.originalPrice > feePlan.price)
    ? (feePlan.originalPrice - feePlan.price)
    : 0;
  const customDiscount = Math.max(0, customDiscountAmount || 0);
  const totalAmount = Math.max(0, feePlan.price - customDiscount);
  const initialPaid = Math.min(amountPaid, totalAmount);
  const balanceAmount = Math.max(0, totalAmount - initialPaid);
  const invoiceStatus = balanceAmount === 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  const planSnapshot = JSON.stringify({
    planId: feePlan.id,
    planName: feePlan.name,
    category: feePlan.category,
    accessType: feePlan.accessType,
    durationMonths: feePlan.durationMonths,
    durationDays,
    originalPrice: originalFee,
    planDiscount,
    customDiscount,
    customDiscountReason,
    finalPrice: feePlan.price,
    totalPayable: totalAmount,
  });

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      studentId: id,
      bookingId: primaryBooking?.id || null,
      bookingGroupId,
      feePlanId: feePlan.id,
      membershipCategory: feePlan.category,
      accessType: feePlan.accessType,
      durationMonths: feePlan.durationMonths,
      durationDays,
      planSnapshot,
      originalFee,
      planDiscount,
      customDiscount,
      customDiscountReason,
      admissionFee: 0, // Renewal does not charge admission fee
      dueDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      subtotal: originalFee,
      discount: planDiscount + customDiscount,
      totalAmount,
      paidAmount: initialPaid,
      balanceAmount,
      status: invoiceStatus,
      notes: `Membership renewal for ${feePlan.name}`,
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

  await prisma.student.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });

  await logAuditEvent('STUDENT', 'RENEWAL', id, { bookingId: primaryBooking?.id, invoiceNumber }, req);

  res.json({
    message: 'Membership renewed successfully',
    booking: primaryBooking,
    invoice,
    payment,
  });
}
