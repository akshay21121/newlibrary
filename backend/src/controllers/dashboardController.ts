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

