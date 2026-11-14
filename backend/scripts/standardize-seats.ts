import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting Library Seat Standardization & Cleanup...');

  // 1. Identify and remove any duplicate floors with zero bookings
  const allFloors = await prisma.floor.findMany({
    include: {
      rooms: {
        include: {
          seats: {
            include: {
              _count: { select: { bookings: true } },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${allFloors.length} floor records.`);

  for (const floor of allFloors) {
    const totalBookings = floor.rooms.reduce(
      (sum, r) => sum + r.seats.reduce((s2, seat) => s2 + seat._count.bookings, 0),
      0
    );

    // If floor has zero bookings and there are multiple duplicate floors, safely remove
    if (totalBookings === 0 && allFloors.length > 1) {
      console.log(`🗑️ Removing empty duplicate floor ${floor.id} ("${floor.name}")`);
      for (const room of floor.rooms) {
        await prisma.floorElement.deleteMany({ where: { roomId: room.id } });
        await prisma.seat.deleteMany({ where: { roomId: room.id } });
        await prisma.room.delete({ where: { id: room.id } });
      }
      await prisma.floor.delete({ where: { id: floor.id } });
    }
  }

  // 2. Renumber ALL remaining seats in the library to strictly sequential numeric numbers (1, 2, 3...)
  const activeRooms = await prisma.room.findMany({
    include: {
      seats: true,
      floor: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let libraryGlobalCounter = 1;

  for (const room of activeRooms) {
    console.log(`📍 Processing Room: "${room.name}" in Floor: "${room.floor.name}" (${room.seats.length} seats)`);

    // Sort seats by position: top-to-bottom (Y), then left-to-right (X)
    const sortedSeats = [...room.seats].sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff > 40) return a.y - b.y;
      return a.x - b.x;
    });

    // Step A: Assign temporary unique prefixes to avoid SQLite unique constraint collisions during rename
    for (const seat of sortedSeats) {
      await prisma.seat.update({
        where: { id: seat.id },
        data: { seatNumber: `temp-${seat.id}` },
      });
    }

    // Step B: Assign clean sequential numeric labels: 1, 2, 3...
    for (const seat of sortedSeats) {
      const numLabel = libraryGlobalCounter.toString();
      await prisma.seat.update({
        where: { id: seat.id },
        data: {
          seatNumber: numLabel,
          width: 72,
          height: 68,
          properties: JSON.stringify({
            fontSize: 13,
            shiftFontSize: 8,
            studentFontSize: 8,
            indicatorHeight: 12,
            borderRadius: 12,
            bgColor: '#ffffff',
            borderColor: '#cbd5e1',
            borderWidth: 1,
            textColor: '#0f172a',
          }),
        },
      });
      console.log(`  -> Seat [${seat.id.slice(0, 8)}...] renumbered to "${numLabel}"`);
      libraryGlobalCounter++;
    }
  }

  console.log(`✅ Successfully standardized ${libraryGlobalCounter - 1} seats to pure sequential numbers 1..${libraryGlobalCounter - 1}.`);
}

main()
  .catch((e) => {
    console.error('Error standardizing seats:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
