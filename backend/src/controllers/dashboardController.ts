import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getDashboardMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  // 1. Student Counts
  const [totalStudents, activeStudents, inactiveStudents] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.student.count({ where: { status: { in: ['INACTIVE', 'SUSPENDED', 'ARCHIVED'] } } }),
  ]);

  // 2. Seat Counts
  const totalSeats = await prisma.seat.count({ where: { isActive: true } });

  // 3. Shift-wise Booked & Available Seats
  const shifts = await prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      startTime: true,
      endTime: true,
    },
  });

  const shiftStats = await Promise.all(
    shifts.map(async (shift) => {
      const bookedCount = await prisma.seatBooking.count({
        where: {
          shiftId: shift.id,
          status: 'ACTIVE',
          endDate: { gte: now },
        },
      });

      return {
        shiftId: shift.id,
        shiftName: shift.name,
        shiftCode: shift.code,
        timing: `${shift.startTime} - ${shift.endTime}`,
        totalSeats,
        bookedSeats: bookedCount,
        availableSeats: Math.max(0, totalSeats - bookedCount),
        occupancyRate: totalSeats > 0 ? Math.round((bookedCount / totalSeats) * 100) : 0,
      };
    })
  );

  // 4. Financials (Today's Collections, Monthly Collections, Pending Fees)
  const todayPayments = await prisma.payment.aggregate({
    where: {
      paymentDate: { gte: startOfToday },
      status: 'SUCCESS',
    },
    _sum: { amount: true },
    _count: true,
  });

  const monthPayments = await prisma.payment.aggregate({
    where: {
      paymentDate: { gte: startOfMonth },
      status: 'SUCCESS',
    },
    _sum: { amount: true },
    _count: true,
  });

  const pendingInvoices = await prisma.invoice.aggregate({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    _sum: { balanceAmount: true },
    _count: true,
  });

  // 5. Upcoming Expirations Count (next 15 days)
  const upcomingExpirationsCount = await prisma.seatBooking.count({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: next15Days,
      },
    },
  });

  // 6. Reminder Statistics
  const reminderStats = await prisma.reminderLog.groupBy({
    by: ['channel', 'status'],
    _count: { id: true },
  });

  res.json({
    students: {
      total: totalStudents,
      active: activeStudents,
      inactive: inactiveStudents,
    },
    seats: {
      total: totalSeats,
      shiftWise: shiftStats,
    },
    financials: {
      todayCollections: todayPayments._sum.amount || 0,
      todayPaymentsCount: todayPayments._count,
      monthlyCollections: monthPayments._sum.amount || 0,
      monthlyPaymentsCount: monthPayments._count,
      pendingFees: pendingInvoices._sum.balanceAmount || 0,
      pendingInvoicesCount: pendingInvoices._count,
    },
    upcomingExpirationsCount,
    reminderStats,
  });
}

export async function getUpcomingExpirations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const days = parseInt((req.query.days as string) || '15', 10);
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const bookings = await prisma.seatBooking.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
        },
      },
      seat: {
        select: {
          seatNumber: true,
        },
      },
      shift: {
        select: {
          name: true,
        },
      },
      feePlan: {
        select: {
          name: true,
          price: true,
        },
      },
    },
    orderBy: {
      endDate: 'asc',
    },
    take: 50,
  });

  res.json({ expirations: bookings });
}

export async function getRecentActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
  const [recentAdmissions, recentPayments, recentReminders] = await Promise.all([
    prisma.student.findMany({
      orderBy: { admissionDate: 'desc' },
      take: 5,
      select: {
        id: true,
        admissionNumber: true,
        fullName: true,
        phone: true,
        admissionDate: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      orderBy: { paymentDate: 'desc' },
      take: 5,
      include: {
        student: {
          select: {
            fullName: true,
            admissionNumber: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
    }),
    prisma.reminderLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 5,
      include: {
        student: {
          select: {
            fullName: true,
            admissionNumber: true,
          },
        },
      },
    }),
  ]);

  res.json({
    recentAdmissions,
    recentPayments,
    recentReminders,
  });
}

export async function getPendingDuesDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      balanceAmount: { gt: 0 },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
          status: true,
          bookings: {
            where: { status: 'ACTIVE' },
            select: {
              seat: { select: { seatNumber: true } },
              shift: { select: { name: true } },
              feePlan: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
      booking: {
        select: {
          seat: { select: { seatNumber: true } },
          shift: { select: { name: true } },
          feePlan: { select: { name: true } },
        },
      },
      feePlan: {
        select: {
          id: true,
          name: true,
          category: true,
          accessType: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  const totalPendingAmount = invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
  const uniqueStudents = new Set(invoices.map((inv) => inv.studentId)).size;

  const records = invoices.map((inv) => {
    const seatNumber = inv.booking?.seat?.seatNumber || inv.student.bookings[0]?.seat?.seatNumber || 'N/A';
    const planName = inv.feePlan?.name || inv.booking?.feePlan?.name || inv.student.bookings[0]?.feePlan?.name || 'Standard Plan';

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.student.id,
      admissionNumber: inv.student.admissionNumber,
      studentName: inv.student.fullName,
      phone: inv.student.phone,
      seatNumber,
      planName,
      totalFee: inv.totalAmount,
      paidAmount: inv.paidAmount,
      pendingAmount: inv.balanceAmount,
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
      status: inv.status,
    };
  });

  res.json({
    totalPendingAmount,
    totalInvoices: invoices.length,
    totalStudents: uniqueStudents,
    records,
  });
}

export async function getShiftOccupancyDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { shiftId } = req.params;
  const { type } = req.query; // 'BOOKED' or 'AVAILABLE'
  const now = new Date();

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
  });

  if (!shift) {
    res.status(404).json({ error: 'Shift not found' });
    return;
  }

  if (type === 'AVAILABLE') {
    const bookedSeats = await prisma.seatBooking.findMany({
      where: {
        shiftId,
        status: 'ACTIVE',
        endDate: { gte: now },
      },
      select: { seatId: true },
    });
    const bookedSeatIds = new Set(bookedSeats.map((b) => b.seatId));

    const availableSeats = await prisma.seat.findMany({
      where: {
        isActive: true,
        id: { notIn: Array.from(bookedSeatIds) },
      },
      include: {
        room: { select: { name: true } },
        floor: { select: { name: true } },
      },
      orderBy: { seatNumber: 'asc' },
    });

    res.json({
      shift,
      type: 'AVAILABLE',
      totalAvailable: availableSeats.length,
      records: availableSeats.map((s) => ({
        seatId: s.id,
        seatNumber: s.seatNumber,
        roomName: s.room.name,
        floorName: s.floor.name,
        type: s.type,
        status: 'AVAILABLE',
      })),
    });
    return;
  }

  // Default: BOOKED
  const bookings = await prisma.seatBooking.findMany({
    where: {
      shiftId,
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
          admissionDate: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              balanceAmount: true,
              totalAmount: true,
              paidAmount: true,
            },
          },
        },
      },
      seat: {
        select: {
          id: true,
          seatNumber: true,
          room: { select: { name: true } },
        },
      },
      feePlan: {
        select: {
          id: true,
          name: true,
          category: true,
          accessType: true,
          durationMonths: true,
        },
      },
    },
    orderBy: {
      seat: { seatNumber: 'asc' },
    },
  });

  const uniqueStudentIds = new Set(bookings.map((b) => b.studentId));

  const records = bookings.map((b) => {
    const latestInvoice = b.student.invoices[0];
    const paymentStatus = latestInvoice?.status || 'PAID';
    const pendingAmount = latestInvoice?.balanceAmount || 0;

    return {
      bookingId: b.id,
      studentId: b.student.id,
      studentName: b.student.fullName,
      admissionNumber: b.student.admissionNumber,
      phone: b.student.phone,
      seatNumber: b.seat.seatNumber,
      roomName: b.seat.room.name,
      planName: b.feePlan?.name || (b.membershipCategory === 'FULL_DAY' ? 'Full-Day Plan' : 'Shift Plan'),
      membershipCategory: b.membershipCategory,
      accessType: b.accessType,
      isFullDay: b.membershipCategory === 'FULL_DAY',
      admissionDate: b.student.admissionDate,
      startDate: b.startDate,
      endDate: b.endDate,
      paymentStatus,
      pendingAmount,
    };
  });

  res.json({
    shift,
    type: 'BOOKED',
    totalBooked: bookings.length,
    uniqueStudentsCount: uniqueStudentIds.size,
    records,
  });
}

export async function getTodayCollectionsDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: startOfToday },
      status: 'SUCCESS',
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    totalAmount,
    totalCount: payments.length,
    records: payments.map((p) => ({
      paymentId: p.id,
      receiptNumber: p.receiptNumber,
      invoiceNumber: p.invoice.invoiceNumber,
      studentId: p.student.id,
      studentName: p.student.fullName,
      admissionNumber: p.student.admissionNumber,
      phone: p.student.phone,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      transactionRef: p.transactionRef,
      remarks: p.remarks,
    })),
  });
}

export async function getExpirationsDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const days = parseInt((req.query.days as string) || '15', 10);
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const bookings = await prisma.seatBooking.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              balanceAmount: true,
            },
          },
        },
      },
      seat: {
        select: {
          seatNumber: true,
        },
      },
      shift: {
        select: {
          name: true,
          startTime: true,
          endTime: true,
        },
      },
      feePlan: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      endDate: 'asc',
    },
  });

  res.json({
    days,
    totalCount: bookings.length,
    records: bookings.map((b) => ({
      bookingId: b.id,
      studentId: b.student.id,
      studentName: b.student.fullName,
      admissionNumber: b.student.admissionNumber,
      phone: b.student.phone,
      seatNumber: b.seat.seatNumber,
      shiftName: b.shift.name,
      planName: b.feePlan?.name || (b.membershipCategory === 'FULL_DAY' ? 'Full-Day' : 'Shift Plan'),
      startDate: b.startDate,
      endDate: b.endDate,
      daysLeft: Math.ceil((new Date(b.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      paymentStatus: b.student.invoices[0]?.status || 'PAID',
      pendingAmount: b.student.invoices[0]?.balanceAmount || 0,
    })),
  });
}

export async function getRecentAdmissionsDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const students = await prisma.student.findMany({
    orderBy: { admissionDate: 'desc' },
    include: {
      bookings: {
        where: { status: 'ACTIVE' },
        include: {
          seat: { select: { seatNumber: true } },
          shift: { select: { name: true } },
          feePlan: { select: { name: true } },
        },
        take: 1,
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
          balanceAmount: true,
          totalAmount: true,
        },
      },
    },
  });

  res.json({
    totalCount: students.length,
    records: students.map((s) => ({
      studentId: s.id,
      admissionNumber: s.admissionNumber,
      fullName: s.fullName,
      phone: s.phone,
      email: s.email,
      targetExam: s.targetExam,
      status: s.status,
      admissionDate: s.admissionDate,
      seatNumber: s.bookings[0]?.seat?.seatNumber || 'N/A',
      shiftName: s.bookings[0]?.shift?.name || 'N/A',
      planName: s.bookings[0]?.feePlan?.name || 'N/A',
      paymentStatus: s.invoices[0]?.status || 'PAID',
      pendingAmount: s.invoices[0]?.balanceAmount || 0,
    })),
  });
}

export async function getRecentCollectionsDrillDown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESS',
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
    take: 100,
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    totalAmount,
    totalCount: payments.length,
    records: payments.map((p) => ({
      paymentId: p.id,
      receiptNumber: p.receiptNumber,
      invoiceNumber: p.invoice.invoiceNumber,
      studentId: p.student.id,
      studentName: p.student.fullName,
      admissionNumber: p.student.admissionNumber,
      phone: p.student.phone,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      transactionRef: p.transactionRef,
      remarks: p.remarks,
    })),
  });
}

