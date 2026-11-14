import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';

const floorCreateSchema = z.object({
  name: z.string().min(1),
  floorNumber: z.number().default(0),
  description: z.string().optional().nullable(),
});

const roomCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  width: z.number().default(1200),
  height: z.number().default(800),
});

const seatUpdateSchema = z.object({
  id: z.string().optional(),
  seatNumber: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().default(70),
  height: z.number().default(65),
  rotation: z.number().default(0),
  type: z.string().default('STANDARD'),
  isActive: z.boolean().default(true),
  properties: z.any().optional(),
});

const elementUpdateSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  label: z.string().optional().nullable(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  isHidden: z.boolean().default(false),
  properties: z.any().optional(),
});

const saveLayoutSchema = z.object({
  seats: z.array(seatUpdateSchema),
  elements: z.array(elementUpdateSchema),
  roomDimensions: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const wizardSchema = z.object({
  rows: z.number().min(1).max(25),
  columns: z.number().min(1).max(25),
  startNumber: z.number().default(1),
  prefix: z.string().default(''), // Optional prefix (default empty for pure simple numeric: 1, 2, 3...)
  numberingPattern: z.enum(['NUMERIC', 'ALPHA_ROW']).default('NUMERIC'),
  startX: z.number().default(100),
  startY: z.number().default(100),
  spacingX: z.number().default(150),
  spacingY: z.number().default(130),
  seatWidth: z.number().default(70),
  seatHeight: z.number().default(65),
  seatType: z.string().default('STANDARD'),
  clearExistingSeats: z.boolean().default(false),
});

export async function getFloors(req: AuthenticatedRequest, res: Response): Promise<void> {
  const floors = await prisma.floor.findMany({
    orderBy: { floorNumber: 'asc' },
    include: {
      rooms: {
        include: {
          _count: {
            select: {
              seats: true,
              elements: true,
            },
          },
        },
      },
      _count: {
        select: {
          seats: true,
        },
      },
    },
  });

  res.json({ floors });
}

export async function createFloor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = floorCreateSchema.parse(req.body);

  const floor = await prisma.floor.create({
    data: {
      name: data.name,
      floorNumber: data.floorNumber,
      description: data.description,
      rooms: {
        create: {
          name: 'Main Hall',
          width: 1200,
          height: 800,
        },
      },
    },
    include: { rooms: true },
  });

  await logAuditEvent('FLOOR', 'CREATE', floor.id, data, req);

  res.status(201).json({ message: 'Floor created successfully', floor });
}

export async function createRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { floorId } = req.params;
  const data = roomCreateSchema.parse(req.body);

  const room = await prisma.room.create({
    data: {
      floorId,
      name: data.name,
      description: data.description,
      width: data.width,
      height: data.height,
    },
  });

  await logAuditEvent('ROOM', 'CREATE', room.id, data, req);

  res.status(201).json({ message: 'Room created successfully', room });
}

export async function getRoomLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.params;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      floor: true,
      seats: {
        where: { isActive: true },
        include: {
          bookings: {
            where: { status: 'ACTIVE' },
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  admissionNumber: true,
                  phone: true,
                  photoUrl: true,
                },
              },
              shift: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          },
        },
      },
      elements: true,
    },
  });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  // Parse properties for elements and seats
  const elements = room.elements.map((el) => ({
    ...el,
    properties: JSON.parse(el.properties || '{}'),
  }));

  const seats = room.seats.map((seat) => ({
    ...seat,
    properties: JSON.parse(seat.properties || '{}'),
  }));

  res.json({
    room: {
      id: room.id,
      name: room.name,
      width: room.width,
      height: room.height,
      floor: room.floor,
    },
    seats,
    elements,
  });
}

export async function saveRoomLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.params;
  const { seats, elements, roomDimensions } = saveLayoutSchema.parse(req.body);

  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update room dimensions if provided
    if (roomDimensions) {
      await tx.room.update({
        where: { id: roomId },
        data: {
          width: roomDimensions.width,
          height: roomDimensions.height,
        },
      });
    }

    // 2. Remove seats that were deleted in the builder (if no active bookings)
    const incomingIds = new Set(seats.filter((s) => s.id && !s.id.startsWith('temp-')).map((s) => s.id));
    const existingSeats = await tx.seat.findMany({
      where: { roomId },
      include: { bookings: { where: { status: 'ACTIVE' } } },
    });

    for (const exSeat of existingSeats) {
      if (!incomingIds.has(exSeat.id)) {
        if (exSeat.bookings.length === 0) {
          await tx.seat.delete({ where: { id: exSeat.id } });
        } else {
          await tx.seat.update({ where: { id: exSeat.id }, data: { isActive: false } });
        }
      }
    }

    // 3. Upsert seats with properties
    for (const seatData of seats) {
      const propertiesStr = JSON.stringify(seatData.properties || {});
      if (seatData.id && !seatData.id.startsWith('temp-')) {
        await tx.seat.update({
          where: { id: seatData.id },
          data: {
            seatNumber: seatData.seatNumber,
            x: seatData.x,
            y: seatData.y,
            width: seatData.width,
            height: seatData.height,
            rotation: seatData.rotation,
            type: seatData.type,
            isActive: seatData.isActive ?? true,
            properties: propertiesStr,
          },
        });
      } else {
        await tx.seat.create({
          data: {
            floorId: room.floorId,
            roomId,
            seatNumber: seatData.seatNumber,
            x: seatData.x,
            y: seatData.y,
            width: seatData.width,
            height: seatData.height,
            rotation: seatData.rotation,
            type: seatData.type,
            isActive: seatData.isActive ?? true,
            properties: propertiesStr,
          },
        });
      }
    }

    // 4. Elements: Replace elements in this room (allows full deletion & customization)
    await tx.floorElement.deleteMany({
      where: { roomId },
    });

    if (elements.length > 0) {
      await tx.floorElement.createMany({
        data: elements.map((el) => ({
          floorId: room.floorId,
          roomId,
          type: el.type,
          label: el.label || null,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          isHidden: el.isHidden ?? false,
          properties: JSON.stringify(el.properties || {}),
        })),
      });
    }
  });

  await logAuditEvent('ROOM_LAYOUT', 'UPDATE', roomId, { seatsCount: seats.length, elementsCount: elements.length }, req);

  res.json({ message: 'Layout saved successfully' });
}

export async function runLayoutWizard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.params;
  const config = wizardSchema.parse(req.body);

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const generatedSeats: Array<{
    floorId: string;
    roomId: string;
    seatNumber: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    properties: string;
  }> = [];

  let count = 1;
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.columns; c++) {
      let seatNumber = '';
      if (config.numberingPattern === 'ALPHA_ROW') {
        const rowChar = String.fromCharCode(65 + (r % 26));
        const colNum = (c + 1).toString();
        seatNumber = config.prefix ? `${config.prefix}-${rowChar}${colNum}` : `${rowChar}${colNum}`;
      } else {
        // Pure simple numeric: 1, 2, 3, 4, 5...
        const currentNum = (config.startNumber || 1) + count - 1;
        seatNumber = config.prefix ? `${config.prefix}-${currentNum}` : `${currentNum}`;
      }

      generatedSeats.push({
        floorId: room.floorId,
        roomId,
        seatNumber,
        x: config.startX + c * config.spacingX,
        y: config.startY + r * config.spacingY,
        width: config.seatWidth,
        height: config.seatHeight,
        type: config.seatType,
        properties: JSON.stringify({
          fontSize: 14,
          shiftFontSize: 8,
          studentFontSize: 8,
          indicatorHeight: 12,
          borderRadius: 12,
        }),
      });

      count++;
    }
  }

  await prisma.$transaction(async (tx) => {
    if (config.clearExistingSeats) {
      const activeBookings = await tx.seatBooking.findFirst({
        where: {
          seat: { roomId },
          status: 'ACTIVE',
        },
      });

      if (activeBookings) {
        throw new Error('Cannot clear existing seats because active student bookings exist in this room. Please release or transfer them first.');
      }

      await tx.seat.deleteMany({ where: { roomId } });
    }

    for (const seat of generatedSeats) {
      await tx.seat.upsert({
        where: {
          roomId_seatNumber: {
            roomId: seat.roomId,
            seatNumber: seat.seatNumber,
          },
        },
        update: {
          x: seat.x,
          y: seat.y,
          width: seat.width,
          height: seat.height,
          type: seat.type,
          properties: seat.properties,
        },
        create: seat,
      });
    }
  });

  await logAuditEvent('WIZARD', 'GENERATE_SEATS', roomId, { generatedCount: generatedSeats.length }, req);

  res.json({
    message: `Generated ${generatedSeats.length} seats successfully via Quick Setup Wizard`,
    count: generatedSeats.length,
  });
}

export async function renumberSeats(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.params;
  const { startNumber = 1, sortMode = 'POSITION' } = req.body;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      seats: {
        where: { isActive: true },
      },
    },
  });

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  // Sort seats: row by row (Y then X), or by existing seatNumber
  const sortedSeats = [...room.seats].sort((a, b) => {
    if (sortMode === 'POSITION') {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff > 40) return a.y - b.y;
      return a.x - b.x;
    }
    const numA = parseInt(a.seatNumber.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.seatNumber.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  // Temporarily prefix to avoid unique constraint collisions during sequential rename
  await prisma.$transaction(async (tx) => {
    for (const seat of sortedSeats) {
      await tx.seat.update({
        where: { id: seat.id },
        data: { seatNumber: `temp-${seat.id}` },
      });
    }

    let current = Number(startNumber) || 1;
    for (const seat of sortedSeats) {
      await tx.seat.update({
        where: { id: seat.id },
        data: { seatNumber: current.toString() },
      });
      current++;
    }
  });

  await logAuditEvent('ROOM', 'RENUMBER_SEATS', roomId, { seatsCount: sortedSeats.length, startNumber }, req);

  res.json({ message: `Successfully renumbered ${sortedSeats.length} seats starting from ${startNumber}` });
}

export async function deleteSeat(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { seatId } = req.params;

  const activeBooking = await prisma.seatBooking.findFirst({
    where: { seatId, status: 'ACTIVE' },
  });

  if (activeBooking) {
    res.status(400).json({ error: 'Cannot delete seat: It currently has an active booking.' });
    return;
  }

  await prisma.seat.delete({ where: { id: seatId } });
  await logAuditEvent('SEAT', 'DELETE', seatId, null, req);

  res.json({ message: 'Seat deleted successfully' });
}

