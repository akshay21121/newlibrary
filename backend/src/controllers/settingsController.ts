import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  adminName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  altPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  weeklyHolidays: z.union([z.string(), z.array(z.string())]).optional(),
  specialClosures: z.union([z.string(), z.array(z.any())]).optional(),
  facilities: z.union([z.string(), z.array(z.string())]).optional(),
  receiptHeader: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  timezone: z.string().optional(),
  gstin: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
});

const shiftUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().min(4).optional(),
  endTime: z.string().min(4).optional(),
  isActive: z.boolean().optional(),
});

const reminderSettingsSchema = z.object({
  autoRemindersEnabled: z.boolean().optional(),
  daysBeforeDue: z.union([z.string(), z.array(z.number())]).optional(),
  daysAfterDue: z.union([z.string(), z.array(z.number())]).optional(),
  sendWhatsApp: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
  whatsappTemplate: z.string().optional(),
  emailSubjectTemplate: z.string().optional(),
  emailBodyTemplate: z.string().optional(),
  simulatedMode: z.boolean().optional(),
});

export async function getLibraryProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  let profile = await prisma.libraryProfile.findFirst();
  if (!profile) {
    profile = await prisma.libraryProfile.create({
      data: { id: 'default-library' },
    });
  }

  // Parse JSON fields safely for response
  const responseData = {
    ...profile,
    weeklyHolidays: JSON.parse(profile.weeklyHolidays || '[]'),
    specialClosures: JSON.parse(profile.specialClosures || '[]'),
    facilities: JSON.parse(profile.facilities || '[]'),
  };

  res.json({ profile: responseData });
}

export async function updateLibraryProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = profileUpdateSchema.parse(req.body);

  const existing = await prisma.libraryProfile.findFirst();
  const id = existing?.id || 'default-library';

  const updateData: any = { ...data };
  if (Array.isArray(data.weeklyHolidays)) {
    updateData.weeklyHolidays = JSON.stringify(data.weeklyHolidays);
  }
  if (Array.isArray(data.specialClosures)) {
    updateData.specialClosures = JSON.stringify(data.specialClosures);
  }
  if (Array.isArray(data.facilities)) {
    updateData.facilities = JSON.stringify(data.facilities);
  }

  const updated = await prisma.libraryProfile.upsert({
    where: { id },
    update: updateData,
    create: { id, ...updateData },
  });

  await logAuditEvent('SETTING', 'UPDATE_PROFILE', id, { updatedFields: Object.keys(data) }, req);

  res.json({
    message: 'Library profile updated successfully',
    profile: {
      ...updated,
      weeklyHolidays: JSON.parse(updated.weeklyHolidays || '[]'),
      specialClosures: JSON.parse(updated.specialClosures || '[]'),
      facilities: JSON.parse(updated.facilities || '[]'),
    },
  });
}

export async function getShifts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const shifts = await prisma.shift.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          bookings: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  });

  res.json({ shifts });
}

export async function updateShift(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = shiftUpdateSchema.parse(req.body);

  const shift = await prisma.shift.update({
    where: { id },
    data,
  });

  await logAuditEvent('SETTING', 'UPDATE_SHIFT', id, data, req);

  res.json({ message: 'Shift updated successfully', shift });
}

export async function getReminderSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  let settings = await prisma.reminderSetting.findFirst();
  if (!settings) {
    settings = await prisma.reminderSetting.create({
      data: { id: 'default-reminders' },
    });
  }

  res.json({
    settings: {
      ...settings,
      daysBeforeDue: JSON.parse(settings.daysBeforeDue || '[]'),
      daysAfterDue: JSON.parse(settings.daysAfterDue || '[]'),
    },
  });
}

export async function updateReminderSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = reminderSettingsSchema.parse(req.body);

  const existing = await prisma.reminderSetting.findFirst();
  const id = existing?.id || 'default-reminders';

  const updateData: any = { ...data };
  if (Array.isArray(data.daysBeforeDue)) {
    updateData.daysBeforeDue = JSON.stringify(data.daysBeforeDue);
  }
  if (Array.isArray(data.daysAfterDue)) {
    updateData.daysAfterDue = JSON.stringify(data.daysAfterDue);
  }

  const updated = await prisma.reminderSetting.upsert({
    where: { id },
    update: updateData,
    create: { id, ...updateData },
  });

  await logAuditEvent('SETTING', 'UPDATE_REMINDER_SETTINGS', id, data, req);

  res.json({
    message: 'Reminder settings updated successfully',
    settings: {
      ...updated,
      daysBeforeDue: JSON.parse(updated.daysBeforeDue || '[]'),
      daysAfterDue: JSON.parse(updated.daysAfterDue || '[]'),
    },
  });
}

