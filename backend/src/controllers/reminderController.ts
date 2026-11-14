import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { sendEmail, renderTemplate } from '../services/emailService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';

const sendReminderSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL', 'BOTH']).default('BOTH'),
  customMessage: z.string().optional().nullable(),
  customSubject: z.string().optional().nullable(),
});

export async function getUnpaidStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      balanceAmount: { gt: 0 },
    },
    include: {
      student: {
        include: {
          bookings: {
            where: { status: 'ACTIVE' },
            include: {
              seat: { select: { seatNumber: true } },
              shift: { select: { name: true } },
            },
          },
        },
      },
      feePlan: { select: { name: true } },
      reminderLogs: {
        orderBy: { sentAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  const unpaidList = invoices.map((inv) => {
    const activeBooking = inv.student.bookings[0];
    const lastReminder = inv.reminderLogs[0];
    const isOverdue = new Date(inv.dueDate) < new Date();

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.student.id,
      studentName: inv.student.fullName,
      admissionNumber: inv.student.admissionNumber,
      phone: inv.student.phone,
      email: inv.student.email,
      seatNumber: activeBooking?.seat?.seatNumber || 'N/A',
      shiftName: activeBooking?.shift?.name || 'N/A',
      feePlanName: inv.feePlan?.name || 'Standard Plan',
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balanceAmount: inv.balanceAmount,
      dueDate: inv.dueDate,
      isOverdue,
      lastReminderSentAt: lastReminder?.sentAt || null,
      lastReminderStatus: lastReminder?.status || null,
    };
  });

  res.json({ unpaidList });
}

export async function sendManualReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { studentIds, channel, customMessage, customSubject } = sendReminderSchema.parse(req.body);

  const library = await prisma.libraryProfile.findFirst();
  const settings = await prisma.reminderSetting.findFirst();

  const libraryName = library?.name || 'Apex Study Library';

  const results: any[] = [];

  for (const studentId of studentIds) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        invoices: {
          where: {
            status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
            balanceAmount: { gt: 0 },
          },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
        bookings: {
          where: { status: 'ACTIVE' },
          include: { seat: true },
          take: 1,
        },
      },
    });

    if (!student || student.invoices.length === 0) {
      continue;
    }

    const invoice = student.invoices[0];
    const seatNumber = student.bookings[0]?.seat?.seatNumber || 'N/A';
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const templateVariables = {
      student_name: student.fullName,
      amount_due: invoice.balanceAmount,
      due_date: dueDateStr,
      library_name: libraryName,
      seat_number: seatNumber,
      invoice_number: invoice.invoiceNumber,
    };

    // 1. WhatsApp Dispatch
    if ((channel === 'WHATSAPP' || channel === 'BOTH') && student.phone) {
      const template = customMessage || settings?.whatsappTemplate ||
        'Dear {student_name}, this is a reminder from {library_name}. Your library fee of ₹{amount_due} is due on {due_date}. Please pay to continue your reserved seat ({seat_number}).';

      const renderedBody = renderTemplate(template, templateVariables);
      const waRes = await sendWhatsAppMessage({
        toPhone: student.phone,
        messageText: renderedBody,
      });

      const log = await prisma.reminderLog.create({
        data: {
          studentId: student.id,
          invoiceId: invoice.id,
          channel: 'WHATSAPP',
          recipientContact: student.phone,
          templateName: 'MANUAL_WHATSAPP',
          messageContent: renderedBody,
          status: waRes.simulated ? 'SIMULATED' : waRes.success ? 'SENT' : 'FAILED',
          simulated: waRes.simulated,
          deliveryMetadata: JSON.stringify(waRes),
          error: waRes.error || null,
        },
      });

      results.push({
        studentId: student.id,
        channel: 'WHATSAPP',
        logId: log.id,
        status: log.status,
        simulated: log.simulated,
      });
    }

    // 2. Email Dispatch
    if ((channel === 'EMAIL' || channel === 'BOTH') && student.email) {
      const emailSubject = customSubject || settings?.emailSubjectTemplate ||
        `Library Membership Fee Reminder - ${libraryName}`;
      const renderedSubject = renderTemplate(emailSubject, templateVariables);

      const emailBody = customMessage
        ? `<p>${customMessage.replace(/\n/g, '<br/>')}</p>`
        : (settings?.emailBodyTemplate || `<p>Dear {student_name}, your fee of ₹{amount_due} is due on {due_date}.</p>`);

      const renderedBody = renderTemplate(emailBody, templateVariables);

      const emailRes = await sendEmail({
        to: student.email,
        subject: renderedSubject,
        html: renderedBody,
      });

      const log = await prisma.reminderLog.create({
        data: {
          studentId: student.id,
          invoiceId: invoice.id,
          channel: 'EMAIL',
          recipientContact: student.email,
          templateName: 'MANUAL_EMAIL',
          messageContent: renderedBody,
          status: emailRes.simulated ? 'SIMULATED' : emailRes.success ? 'SENT' : 'FAILED',
          simulated: emailRes.simulated,
          deliveryMetadata: JSON.stringify(emailRes),
          error: emailRes.error || null,
        },
      });

      results.push({
        studentId: student.id,
        channel: 'EMAIL',
        logId: log.id,
        status: log.status,
        simulated: log.simulated,
      });
    }
  }

  await logAuditEvent('REMINDER', 'MANUAL_DISPATCH', null, { count: results.length, channel }, req);

  res.json({
    message: `Dispatched ${results.length} reminder message(s).`,
    dispatchedCount: results.length,
    results,
  });
}

export async function triggerAutoReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const library = await prisma.libraryProfile.findFirst();
  const settings = await prisma.reminderSetting.findFirst();

  if (!settings || !settings.autoRemindersEnabled) {
    res.json({
      message: 'Automatic reminders are currently disabled in settings.',
      dispatchedCount: 0,
    });
    return;
  }

  const daysBefore: number[] = JSON.parse(settings.daysBeforeDue || '[]');
  const daysAfter: number[] = JSON.parse(settings.daysAfterDue || '[]');

  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find all unpaid invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      balanceAmount: { gt: 0 },
    },
    include: {
      student: {
        include: {
          bookings: {
            where: { status: 'ACTIVE' },
            include: { seat: true },
          },
        },
      },
      reminderLogs: {
        where: {
          sentAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // cooldown: 24h
          },
        },
      },
    },
  });

  const libraryName = library?.name || 'Apex Study Library';
  const dispatched: any[] = [];

  for (const inv of unpaidInvoices) {
    // If a reminder was already dispatched in the last 24 hours, skip to prevent spamming
    if (inv.reminderLogs.length > 0) {
      continue;
    }

    const dueDate = new Date(inv.dueDate);
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffDays = Math.round((dueDateOnly.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    // Check if diffDays matches any target day
    // diffDays > 0: N days before due
    // diffDays === 0: Due today
    // diffDays < 0: N days overdue
    let shouldSend = false;
    if (diffDays > 0 && daysBefore.includes(diffDays)) shouldSend = true;
    if (diffDays === 0) shouldSend = true;
    if (diffDays < 0 && daysAfter.includes(Math.abs(diffDays))) shouldSend = true;

    if (!shouldSend) continue;

    const student = inv.student;
    const seatNumber = student.bookings[0]?.seat?.seatNumber || 'N/A';
    const dueDateStr = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const vars = {
      student_name: student.fullName,
      amount_due: inv.balanceAmount,
      due_date: dueDateStr,
      library_name: libraryName,
      seat_number: seatNumber,
      invoice_number: inv.invoiceNumber,
    };

    // Auto WhatsApp
    if (settings.sendWhatsApp && student.phone) {
      const msg = renderTemplate(settings.whatsappTemplate, vars);
      const resWA = await sendWhatsAppMessage({ toPhone: student.phone, messageText: msg });

      await prisma.reminderLog.create({
        data: {
          studentId: student.id,
          invoiceId: inv.id,
          channel: 'WHATSAPP',
          recipientContact: student.phone,
          templateName: 'AUTO_WHATSAPP',
          messageContent: msg,
          status: resWA.simulated ? 'SIMULATED' : resWA.success ? 'SENT' : 'FAILED',
          simulated: resWA.simulated,
          deliveryMetadata: JSON.stringify(resWA),
        },
      });

      dispatched.push({ student: student.fullName, channel: 'WHATSAPP' });
    }

    // Auto Email
    if (settings.sendEmail && student.email) {
      const subject = renderTemplate(settings.emailSubjectTemplate, vars);
      const body = renderTemplate(settings.emailBodyTemplate, vars);
      const resEmail = await sendEmail({ to: student.email, subject, html: body });

      await prisma.reminderLog.create({
        data: {
          studentId: student.id,
          invoiceId: inv.id,
          channel: 'EMAIL',
          recipientContact: student.email,
          templateName: 'AUTO_EMAIL',
          messageContent: body,
          status: resEmail.simulated ? 'SIMULATED' : resEmail.success ? 'SENT' : 'FAILED',
          simulated: resEmail.simulated,
          deliveryMetadata: JSON.stringify(resEmail),
        },
      });

      dispatched.push({ student: student.fullName, channel: 'EMAIL' });
    }
  }

  res.json({
    message: `Auto-reminder job completed. Evaluated ${unpaidInvoices.length} invoices, sent ${dispatched.length} messages.`,
    dispatchedCount: dispatched.length,
    dispatched,
  });
}

export async function getReminderLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '25', 10);
  const channel = req.query.channel as string | undefined;
  const status = req.query.status as string | undefined;

  const skip = (page - 1) * limit;
  const where: any = {};
  if (channel) where.channel = channel;
  if (status) where.status = status;

  const [logs, total] = await Promise.all([
    prisma.reminderLog.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
            balanceAmount: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.reminderLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

