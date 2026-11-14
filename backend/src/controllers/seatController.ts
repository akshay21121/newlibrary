import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getSeatMatrix(req: AuthenticatedRequest, res: Response): Promise<void> {
  const floorId = req.query.floorId as string | undefined;
  const roomId = req.query.roomId as string | undefined;
  const search = req.query.search as string | undefined;

  const now = new Date();

  // 1. Fetch active shifts
  const shifts = await prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  // 2. Fetch seats
  const seatWhere: any = { isActive: true };
  if (floorId) seatWhere.floorId = floorId;
  if (roomId) seatWhere.roomId = roomId;
  if (search) seatWhere.seatNumber = { contains: search };

  const seats = await prisma.seat.findMany({
    where: seatWhere,
    include: {
      floor: { select: { id: true, name: true } },
      room: { select: { id: true, name: true } },
      bookings: {
        where: {
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNumber: true,
              phone: true,
              email: true,
              photoUrl: true,
              status: true,
            },
          },
          shift: {
            select: {
              id: true,
              code: true,
              name: true,
              startTime: true,
              endTime: true,
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
      },
    },
    orderBy: { seatNumber: 'asc' },
  });

  let fullyAvailableCount = 0;
  let partiallyOccupiedCount = 0;
  let fullDayOccupiedCount = 0;
  let totalOccupiedSlots = 0;

  // Transform each seat to represent the 3 independent shifts + Full Day detection
  const matrix = seats.map((seat) => {
    const shiftStatuses = shifts.map((shift) => {
      const activeBooking = seat.bookings.find((b) => b.shiftId === shift.id);
      if (activeBooking) {
        totalOccupiedSlots++;
      }

      return {
        shiftId: shift.id,
        shiftCode: shift.code,
        shiftName: shift.name,
        timing: `${shift.startTime} - ${shift.endTime}`,
        isBooked: !!activeBooking,
        statusColor: activeBooking ? 'GREEN' : 'RED', // Green = Booked, Red = Available
        booking: activeBooking
          ? {
              bookingId: activeBooking.id,
              bookingGroupId: activeBooking.bookingGroupId,
              studentId: activeBooking.student.id,
              studentName: activeBooking.student.fullName,
              admissionNumber: activeBooking.student.admissionNumber,
              phone: activeBooking.student.phone,
              email: activeBooking.student.email,
              photoUrl: activeBooking.student.photoUrl,
              startDate: activeBooking.startDate,
              endDate: activeBooking.endDate,
              membershipCategory: activeBooking.membershipCategory,
              accessType: activeBooking.accessType,
              planName: activeBooking.feePlan?.name || 'Standard Plan',
            }
          : null,
      };
    });

    const isAllShiftsBooked = shiftStatuses.every((s) => s.isBooked);
    const isAnyShiftBooked = shiftStatuses.some((s) => s.isBooked);
    const isFullyAvailable = shiftStatuses.every((s) => !s.isBooked);

    // Check if booked under a full-day plan by same student or group
    const firstStudentId = shiftStatuses[0]?.booking?.studentId;
    const isFullDayDedicated =
      isAllShiftsBooked &&
      shiftStatuses.every(
        (s) =>
          s.booking?.studentId === firstStudentId ||
          s.booking?.membershipCategory === 'FULL_DAY'
      );

    if (isFullyAvailable) {
      fullyAvailableCount++;
    } else if (isFullDayDedicated || isAllShiftsBooked) {
      fullDayOccupiedCount++;
    } else if (isAnyShiftBooked) {
      partiallyOccupiedCount++;
    }

    const summaryStatus = isFullDayDedicated
      ? 'FULL_DAY_OCCUPIED'
      : isAllShiftsBooked
      ? 'FULLY_BOOKED'
      : isAnyShiftBooked
      ? 'PARTIALLY_BOOKED'
      : 'AVAILABLE';

    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      floorId: seat.floorId,
      floorName: seat.floor.name,
      roomId: seat.roomId,
      roomName: seat.room.name,
      x: seat.x,
      y: seat.y,
      width: seat.width,
      height: seat.height,
      rotation: seat.rotation,
      type: seat.type,
      isActive: seat.isActive,
      shifts: shiftStatuses,
      isFullDayOccupied: isFullDayDedicated,
      fullDayStudent: isFullDayDedicated ? shiftStatuses[0]?.booking : null,
      summaryStatus,
    };
  });

  res.json({
    shifts,
    totalSeats: seats.length,
    stats: {
      totalSeats: seats.length,
      fullyAvailableSeats: fullyAvailableCount,
      partiallyOccupiedSeats: partiallyOccupiedCount,
      fullDayOccupiedSeats: fullDayOccupiedCount,
      totalOccupiedShiftSlots: totalOccupiedSlots,
      totalShiftSlots: seats.length * shifts.length,
    },
    matrix,
  });
}

export async function getSeatDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const seat = await prisma.seat.findUnique({
    where: { id },
    include: {
      floor: true,
      room: true,
      bookings: {
        where: { status: 'ACTIVE' },
        include: {
          student: true,
          shift: true,
          feePlan: true,
        },
      },
      bookingHistories: {
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { fullName: true, admissionNumber: true } },
          shift: { select: { name: true } },
        },
      },
    },
  });

  if (!seat) {
    res.status(404).json({ error: 'Seat not found' });
    return;
  }

  res.json({ seat });
}
