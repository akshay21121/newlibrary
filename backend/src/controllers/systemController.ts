import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '30', 10);
  const entityType = req.query.entityType as string | undefined;

  const skip = (page - 1) * limit;
  const where: any = {};
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs: logs.map((l) => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function createBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!fs.existsSync(ENV.BACKUP_DIR)) {
    fs.mkdirSync(ENV.BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.json`;
  const backupFilePath = path.join(ENV.BACKUP_DIR, backupFileName);

  // Fetch full data snapshot
  const [
    admin,
    profile,
    shifts,
    floors,
    rooms,
    seats,
    elements,
    feePlans,
    students,
    bookings,
    bookingHistories,
    invoices,
    payments,
    paymentAuditLogs,
    reminderLogs,
    reminderSettings,
  ] = await Promise.all([
    prisma.admin.findMany(),
    prisma.libraryProfile.findMany(),
    prisma.shift.findMany(),
    prisma.floor.findMany(),
    prisma.room.findMany(),
    prisma.seat.findMany(),
    prisma.floorElement.findMany(),
    prisma.feePlan.findMany(),
    prisma.student.findMany(),
    prisma.seatBooking.findMany(),
    prisma.seatBookingHistory.findMany(),
    prisma.invoice.findMany(),
    prisma.payment.findMany(),
    prisma.paymentAuditLog.findMany(),
    prisma.reminderLog.findMany(),
    prisma.reminderSetting.findMany(),
  ]);

  const snapshot = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    stats: {
      studentsCount: students.length,
      seatsCount: seats.length,
      bookingsCount: bookings.length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
    },
    data: {
      admin,
      profile,
      shifts,
      floors,
      rooms,
      seats,
      elements,
      feePlans,
      students,
      bookings,
      bookingHistories,
      invoices,
      payments,
      paymentAuditLogs,
      reminderLogs,
      reminderSettings,
    },
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Also copy raw SQLite file if it exists
  let sqliteDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(sqliteDbPath)) {
    sqliteDbPath = path.resolve(process.cwd(), 'dev.db');
  }
  if (fs.existsSync(sqliteDbPath)) {
    const rawSqliteBackupPath = path.join(ENV.BACKUP_DIR, `backup-${timestamp}.db`);
    fs.copyFileSync(sqliteDbPath, rawSqliteBackupPath);
  }

  await logAuditEvent('SYSTEM', 'BACKUP_CREATED', null, { backupFileName }, req);

  res.status(201).json({
    message: 'System backup snapshot created successfully',
    fileName: backupFileName,
    stats: snapshot.stats,
  });
}

export async function listBackups(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!fs.existsSync(ENV.BACKUP_DIR)) {
    res.json({ backups: [] });
    return;
  }

  const files = fs.readdirSync(ENV.BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((filename) => {
      const filePath = path.join(ENV.BACKUP_DIR, filename);
      const stats = fs.statSync(filePath);
      return {
        fileName: filename,
        sizeBytes: stats.size,
        createdAt: stats.birthtime,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ backups: files });
}

export async function restoreBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { fileName } = req.body;
  if (!fileName) {
    res.status(400).json({ error: 'Missing fileName in request' });
    return;
  }

  const filePath = path.join(ENV.BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Backup file not found' });
    return;
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const data = content.data;

  // Restore transaction
  await prisma.$transaction(async (tx) => {
    // Clear dependent tables first
    await tx.reminderLog.deleteMany();
    await tx.paymentAuditLog.deleteMany();
    await tx.payment.deleteMany();
    await tx.invoice.deleteMany();
    await tx.seatBookingHistory.deleteMany();
    await tx.seatBooking.deleteMany();
    await tx.student.deleteMany();
    await tx.floorElement.deleteMany();
    await tx.seat.deleteMany();
    await tx.room.deleteMany();
    await tx.floor.deleteMany();
    await tx.feePlan.deleteMany();
    await tx.shift.deleteMany();

    // Reinsert entities
    if (data.shifts?.length) await tx.shift.createMany({ data: data.shifts });
    if (data.feePlans?.length) await tx.feePlan.createMany({ data: data.feePlans });
    if (data.floors?.length) await tx.floor.createMany({ data: data.floors });
    if (data.rooms?.length) await tx.room.createMany({ data: data.rooms });
    if (data.seats?.length) await tx.seat.createMany({ data: data.seats });
    if (data.elements?.length) await tx.floorElement.createMany({ data: data.elements });
    if (data.students?.length) await tx.student.createMany({ data: data.students });
    if (data.bookings?.length) await tx.seatBooking.createMany({ data: data.bookings });
    if (data.bookingHistories?.length) await tx.seatBookingHistory.createMany({ data: data.bookingHistories });
    if (data.invoices?.length) await tx.invoice.createMany({ data: data.invoices });
    if (data.payments?.length) await tx.payment.createMany({ data: data.payments });
    if (data.paymentAuditLogs?.length) await tx.paymentAuditLog.createMany({ data: data.paymentAuditLogs });
    if (data.reminderLogs?.length) await tx.reminderLog.createMany({ data: data.reminderLogs });
  });

  await logAuditEvent('SYSTEM', 'RESTORE_COMPLETED', null, { restoredFrom: fileName }, req);

  res.json({ message: 'Database successfully restored from backup snapshot', fileName });
}
