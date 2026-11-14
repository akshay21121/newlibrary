import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getDailyCollections(req: AuthenticatedRequest, res: Response): Promise<void> {
  const days = parseInt((req.query.days as string) || '30', 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESS',
      paymentDate: { gte: startDate },
    },
    include: {
      student: { select: { fullName: true, admissionNumber: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { paymentDate: 'desc' },
  });

  // Group by date
  const grouped: Record<string, { date: string; totalAmount: number; count: number; byMethod: Record<string, number> }> = {};

  for (const p of payments) {
    const dateStr = p.paymentDate.toISOString().split('T')[0];
    if (!grouped[dateStr]) {
      grouped[dateStr] = { date: dateStr, totalAmount: 0, count: 0, byMethod: {} };
    }
    grouped[dateStr].totalAmount += p.amount;
    grouped[dateStr].count += 1;
    grouped[dateStr].byMethod[p.paymentMethod] = (grouped[dateStr].byMethod[p.paymentMethod] || 0) + p.amount;
  }

  const collections = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

  res.json({ collections, rawPayments: payments });
}

export async function getMonthlyCollections(req: AuthenticatedRequest, res: Response): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCESS' },
    orderBy: { paymentDate: 'desc' },
  });

  const grouped: Record<string, { month: string; totalAmount: number; count: number }> = {};

  for (const p of payments) {
    const d = new Date(p.paymentDate);
    const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!grouped[monthKey]) {
      grouped[monthKey] = { month: monthKey, totalAmount: 0, count: 0 };
    }
    grouped[monthKey].totalAmount += p.amount;
    grouped[monthKey].count += 1;
  }

  const monthly = Object.values(grouped).sort((a, b) => b.month.localeCompare(a.month));

  res.json({ monthly });
}

export async function getPaymentModeBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const breakdown = await prisma.payment.groupBy({
    by: ['paymentMethod'],
    where: { status: 'SUCCESS' },
    _sum: { amount: true },
    _count: { id: true },
  });

  const formatted = breakdown.map((b) => ({
    method: b.paymentMethod,
    totalAmount: b._sum.amount || 0,
    count: b._count.id,
  }));

  res.json({ breakdown: formatted });
}

export async function getDefaulters(req: AuthenticatedRequest, res: Response): Promise<void> {
  const now = new Date();

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      balanceAmount: { gt: 0 },
      dueDate: { lt: now },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          phone: true,
          email: true,
          status: true,
        },
      },
      feePlan: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const defaulters = overdueInvoices.map((inv) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.student.id,
      studentName: inv.student.fullName,
      admissionNumber: inv.student.admissionNumber,
      phone: inv.student.phone,
      email: inv.student.email,
      studentStatus: inv.student.status,
      planName: inv.feePlan?.name || 'Standard',
      dueDate: inv.dueDate,
      daysOverdue,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balanceAmount: inv.balanceAmount,
    };
  });

  res.json({ defaulters });
}

export async function getOccupancyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const now = new Date();
  const totalSeats = await prisma.seat.count({ where: { isActive: true } });

  const shifts = await prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const shiftOccupancy = await Promise.all(
    shifts.map(async (s) => {
      const booked = await prisma.seatBooking.count({
        where: {
          shiftId: s.id,
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });

      return {
        shiftId: s.id,
        shiftName: s.name,
        code: s.code,
        timing: `${s.startTime} - ${s.endTime}`,
        totalSeats,
        bookedSeats: booked,
        availableSeats: Math.max(0, totalSeats - booked),
        occupancyPercentage: totalSeats > 0 ? ((booked / totalSeats) * 100).toFixed(1) : '0',
      };
    })
  );

  res.json({
    totalSeats,
    shiftOccupancy,
  });
}

export async function exportReportCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type } = req.params;

  let filename = `report-${type}-${Date.now()}.csv`;
  let csvContent = '';

  if (type === 'collections') {
    const payments = await prisma.payment.findMany({
      where: { status: 'SUCCESS' },
      include: {
        student: { select: { fullName: true, admissionNumber: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    csvContent = 'Receipt Number,Invoice Number,Student Name,Admission No,Amount,Payment Method,Transaction Ref,Date\n';
    payments.forEach((p) => {
      const dateStr = p.paymentDate.toISOString().replace('T', ' ').substring(0, 19);
      csvContent += `"${p.receiptNumber}","${p.invoice?.invoiceNumber || ''}","${p.student.fullName}","${p.student.admissionNumber}",${p.amount},"${p.paymentMethod}","${p.transactionRef || ''}","${dateStr}"\n`;
    });
  } else if (type === 'defaulters') {
    const now = new Date();
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceAmount: { gt: 0 },
        dueDate: { lt: now },
      },
      include: {
        student: { select: { fullName: true, admissionNumber: true, phone: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    csvContent = 'Invoice Number,Student Name,Admission No,Phone,Due Date,Total Amount,Paid Amount,Balance Due,Days Overdue\n';
    invoices.forEach((inv) => {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const dueStr = new Date(inv.dueDate).toISOString().split('T')[0];
      csvContent += `"${inv.invoiceNumber}","${inv.student.fullName}","${inv.student.admissionNumber}","${inv.student.phone}","${dueStr}",${inv.totalAmount},${inv.paidAmount},${inv.balanceAmount},${daysOverdue}\n`;
    });
  } else if (type === 'students') {
    const students = await prisma.student.findMany({
      orderBy: { admissionDate: 'desc' },
    });

    csvContent = 'Admission Number,Full Name,Phone,Email,Status,Admission Date,Target Exam\n';
    students.forEach((s) => {
      const dateStr = s.admissionDate.toISOString().split('T')[0];
      csvContent += `"${s.admissionNumber}","${s.fullName}","${s.phone}","${s.email || ''}","${s.status}","${dateStr}","${s.targetExam || ''}"\n`;
    });
  } else {
    res.status(400).json({ error: 'Unsupported export type' });
    return;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}

