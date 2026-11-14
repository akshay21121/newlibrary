import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Initial Shifts (Three Independent Shifts)
  const morningShift = await prisma.shift.upsert({
    where: { code: 'MORNING' },
    update: {
      name: 'Morning Shift',
      startTime: '06:00',
      endTime: '12:00',
      sortOrder: 1,
    },
    create: {
      name: 'Morning Shift',
      code: 'MORNING',
      startTime: '06:00',
      endTime: '12:00',
      sortOrder: 1,
    },
  });

  const afternoonShift = await prisma.shift.upsert({
    where: { code: 'AFTERNOON' },
    update: {
      name: 'Afternoon Shift',
      startTime: '12:00',
      endTime: '18:00',
      sortOrder: 2,
    },
    create: {
      name: 'Afternoon Shift',
      code: 'AFTERNOON',
      startTime: '12:00',
      endTime: '18:00',
      sortOrder: 2,
    },
  });

  const eveningShift = await prisma.shift.upsert({
    where: { code: 'EVENING' },
    update: {
      name: 'Evening Shift',
      startTime: '18:00',
      endTime: '23:30',
      sortOrder: 3,
    },
    create: {
      name: 'Evening Shift',
      code: 'EVENING',
      startTime: '18:00',
      endTime: '23:30',
      sortOrder: 3,
    },
  });

  console.log('✅ 3 Shifts created/updated.');

  // 2. Default Library Profile
  await prisma.libraryProfile.upsert({
    where: { id: 'default-library' },
    update: {},
    create: {
      id: 'default-library',
      name: 'Apex Study Library & Reading Hall',
      tagline: 'Quiet, Disciplined & Comfortable Learning Atmosphere',
      adminName: 'Chief Administrator',
      email: 'admin@apexlibrary.com',
      phone: '+91 98765 43210',
      altPhone: '+91 98765 43211',
      address: 'Plot 42, 2nd Floor, Knowledge Park Road, Sector 62',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201309',
      openingTime: '06:00',
      closingTime: '23:30',
      weeklyHolidays: JSON.stringify([]),
      facilities: JSON.stringify([
        'Ultra-fast Optical Fiber Wi-Fi (300 Mbps)',
        'Ergonomic High-Back Mesh Chairs',
        'Fully Air Conditioned Soundproof Halls',
        'Individual Power Outlets & USB Charging',
        'RO Purified Hot & Cold Drinking Water',
        '24x7 HD CCTV Surveillance & Secure Access',
        'Personal Dedicated Lockers',
        'Daily Newspaper & Competitive Magazines',
      ]),
      receiptHeader: 'APEX STUDY LIBRARY\nPlot 42, Sector 62, Noida, UP\nGSTIN: 07AAAAA0000A1Z5 | Phone: +91 98765 43210',
      receiptFooter: '1. Please keep your receipt safe. Fees once paid are strictly non-refundable.\n2. Please carry your Library ID card at all times.\n3. Mobile phones must be kept on silent mode inside the reading hall.',
      currency: 'INR',
      currencySymbol: '₹',
      timezone: 'Asia/Kolkata',
      gstin: '07AAAAA0000A1Z5',
    },
  });

  console.log('✅ Library Profile created.');

  // 3. Default Reminder Settings
  await prisma.reminderSetting.upsert({
    where: { id: 'default-reminders' },
    update: {},
    create: {
      id: 'default-reminders',
      autoRemindersEnabled: true,
      daysBeforeDue: JSON.stringify([3, 1]),
      daysAfterDue: JSON.stringify([1, 3, 7]),
      sendWhatsApp: true,
      sendEmail: true,
      simulatedMode: true,
    },
  });

  console.log('✅ Reminder Settings created.');

  // 4. Default Admin Account
  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@apexlibrary.com' },
    update: {},
    create: {
      name: 'Library Admin',
      email: 'admin@apexlibrary.com',
      passwordHash,
      phone: '+91 98765 43210',
    },
  });

  console.log(`✅ Default Admin user created: ${admin.email} (Password: Admin@123456)`);

  // 5. Sample Floor & Room
  const floor1 = await prisma.floor.create({
    data: {
      name: 'Ground Floor - Silent Zone',
      floorNumber: 0,
      description: 'Main silent study zone with 40 ergonomic desks',
      rooms: {
        create: {
          name: 'Main Reading Hall A',
          description: 'Spacious hall with central AC and personal cubicles',
          width: 1400,
          height: 900,
        },
      },
    },
    include: { rooms: true },
  });

  const roomA = floor1.rooms[0];

  // 6. Fee Plans
  const morningPlan = await prisma.feePlan.create({
    data: {
      name: 'Morning Shift Plan (1 Month)',
      planType: 'SHIFT_BASED',
      durationDays: 30,
      shiftId: morningShift.id,
      price: 900,
      admissionFee: 200,
      description: 'Morning session 06:00 to 12:00 with dedicated desk and high speed internet.',
    },
  });

  const afternoonPlan = await prisma.feePlan.create({
    data: {
      name: 'Afternoon Shift Plan (1 Month)',
      planType: 'SHIFT_BASED',
      durationDays: 30,
      shiftId: afternoonShift.id,
      price: 1000,
      admissionFee: 200,
      description: 'Afternoon session 12:00 to 18:00 with quiet reading environment.',
    },
  });

  const eveningPlan = await prisma.feePlan.create({
    data: {
      name: 'Evening Shift Plan (1 Month)',
      planType: 'SHIFT_BASED',
      durationDays: 30,
      shiftId: eveningShift.id,
      price: 1100,
      admissionFee: 200,
      description: 'Evening session 18:00 to 23:30 with personal desk lamp.',
    },
  });

  const fullDayPlan = await prisma.feePlan.create({
    data: {
      name: 'Full Day Dedicated Desk (1 Month)',
      planType: 'DURATION_BASED',
      durationDays: 30,
      price: 2400,
      admissionFee: 200,
      description: 'All 3 shifts access (06:00 to 23:30) with 24/7 dedicated reserved desk.',
    },
  });

  console.log('✅ Fee plans created.');

  // 7. Generate a grid of 24 Seats in Room A
  const seatList = [];
  const rows = 4;
  const cols = 6;
  const startX = 100;
  const startY = 120;
  const spacingX = 180;
  const spacingY = 160;

  for (let r = 0; r < rows; r++) {
    const rowChar = String.fromCharCode(65 + r); // A, B, C, D
    for (let c = 1; c <= cols; c++) {
      const seatNum = `${rowChar}-${c < 10 ? '0' + c : c}`;
      const seat = await prisma.seat.create({
        data: {
          floorId: floor1.id,
          roomId: roomA.id,
          seatNumber: seatNum,
          x: startX + (c - 1) * spacingX,
          y: startY + r * spacingY,
          width: 70,
          height: 65,
          type: (r === 0 && c === 1) ? 'PREMIUM' : 'STANDARD',
        },
      });
      seatList.push(seat);
    }
  }

  // Also add some visual floor elements (Reception Desk, Partitions)
  await prisma.floorElement.createMany({
    data: [
      {
        floorId: floor1.id,
        roomId: roomA.id,
        type: 'TABLE',
        label: 'Admin / Reception Desk',
        x: 100,
        y: 30,
        width: 320,
        height: 50,
      },
      {
        floorId: floor1.id,
        roomId: roomA.id,
        type: 'WALL',
        label: 'Acoustic Glass Partition',
        x: 500,
        y: 30,
        width: 400,
        height: 15,
      },
      {
        floorId: floor1.id,
        roomId: roomA.id,
        type: 'DOOR',
        label: 'Entrance Door',
        x: 40,
        y: 40,
        width: 40,
        height: 40,
      },
    ],
  });

  console.log(`✅ Created ${seatList.length} seats and floor elements in Hall A.`);

  // 8. Sample Students
  const today = new Date();
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const student1 = await prisma.student.create({
    data: {
      admissionNumber: 'LIB-2026-0001',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      phone: '+91 98111 22334',
      alternatePhone: '+91 98111 55667',
      gender: 'MALE',
      address: 'House 14, Block C, Sector 15, Noida',
      idProofType: 'AADHAAR',
      idProofNumber: '4532 9876 1234',
      emergencyContactName: 'Rajesh Sharma',
      emergencyContactRelation: 'Father',
      emergencyContactPhone: '+91 98111 00001',
      bloodGroup: 'B+',
      targetExam: 'UPSC Civil Services 2026',
      notes: 'Prefers morning quiet hours near window.',
      status: 'ACTIVE',
    },
  });

  const student2 = await prisma.student.create({
    data: {
      admissionNumber: 'LIB-2026-0002',
      fullName: 'Priya Verma',
      email: 'priya.verma@example.com',
      phone: '+91 98222 33445',
      gender: 'FEMALE',
      address: 'Flat 302, Green Valley Apartments, Noida',
      idProofType: 'COLLEGE_ID',
      idProofNumber: 'DU-2024-8841',
      emergencyContactName: 'Sunita Verma',
      emergencyContactRelation: 'Mother',
      emergencyContactPhone: '+91 98222 00002',
      bloodGroup: 'O+',
      targetExam: 'CA Final',
      notes: 'Evening shift regular candidate.',
      status: 'ACTIVE',
    },
  });

  const student3 = await prisma.student.create({
    data: {
      admissionNumber: 'LIB-2026-0003',
      fullName: 'Rohan Gupta',
      email: 'rohan.gupta@example.com',
      phone: '+91 98333 44556',
      gender: 'MALE',
      address: 'Tower 4, Sector 78, Noida',
      idProofType: 'PAN',
      idProofNumber: 'ABCDE1234F',
      emergencyContactName: 'Vikram Gupta',
      emergencyContactRelation: 'Brother',
      emergencyContactPhone: '+91 98333 00003',
      bloodGroup: 'A+',
      targetExam: 'NEET PG 2026',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Sample Students created.');

  // 9. Bookings for Seat A-01 (Morning Shift: Aarav, Evening Shift: Priya)
  const seatA01 = seatList[0];
  const seatA02 = seatList[1];

  // Booking 1: Aarav -> Seat A-01, Morning Shift
  const booking1 = await prisma.seatBooking.create({
    data: {
      studentId: student1.id,
      seatId: seatA01.id,
      shiftId: morningShift.id,
      feePlanId: morningPlan.id,
      startDate: today,
      endDate: nextMonth,
      monthlyPrice: 900,
      status: 'ACTIVE',
    },
  });

  await prisma.seatBookingHistory.create({
    data: {
      bookingId: booking1.id,
      studentId: student1.id,
      seatId: seatA01.id,
      shiftId: morningShift.id,
      actionType: 'BOOKED',
      remarks: 'Initial admission booking for Morning Shift',
    },
  });

  // Invoice 1 for Aarav (Fully Paid)
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-0001',
      studentId: student1.id,
      bookingId: booking1.id,
      feePlanId: morningPlan.id,
      dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      subtotal: 1100, // 900 + 200 admission
      totalAmount: 1100,
      paidAmount: 1100,
      balanceAmount: 0,
      status: 'PAID',
    },
  });

  const payment1 = await prisma.payment.create({
    data: {
      receiptNumber: 'REC-2026-0001',
      invoiceId: invoice1.id,
      studentId: student1.id,
      amount: 1100,
      paymentMethod: 'UPI',
      transactionRef: 'UPI-REF-902198231',
      remarks: 'Admission fee + 1 Month Morning shift paid via Google Pay UPI',
      status: 'SUCCESS',
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: payment1.id,
      invoiceId: invoice1.id,
      action: 'PAYMENT_RECEIVED',
      previousState: JSON.stringify({ balanceAmount: 1100, status: 'UNPAID' }),
      newState: JSON.stringify({ balanceAmount: 0, status: 'PAID', paymentMethod: 'UPI' }),
      reason: 'Full settlement at counter via UPI',
    },
  });

  // Booking 2: Priya -> Seat A-01, Evening Shift
  const booking2 = await prisma.seatBooking.create({
    data: {
      studentId: student2.id,
      seatId: seatA01.id,
      shiftId: eveningShift.id,
      feePlanId: eveningPlan.id,
      startDate: today,
      endDate: nextMonth,
      monthlyPrice: 1100,
      status: 'ACTIVE',
    },
  });

  await prisma.seatBookingHistory.create({
    data: {
      bookingId: booking2.id,
      studentId: student2.id,
      seatId: seatA01.id,
      shiftId: eveningShift.id,
      actionType: 'BOOKED',
      remarks: 'Evening Shift booked on Seat A-01',
    },
  });

  // Invoice 2 for Priya (Partially Paid: Balance 500)
  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-0002',
      studentId: student2.id,
      bookingId: booking2.id,
      feePlanId: eveningPlan.id,
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      subtotal: 1300,
      totalAmount: 1300,
      paidAmount: 800,
      balanceAmount: 500,
      status: 'PARTIALLY_PAID',
    },
  });

  const payment2 = await prisma.payment.create({
    data: {
      receiptNumber: 'REC-2026-0002',
      invoiceId: invoice2.id,
      studentId: student2.id,
      amount: 800,
      paymentMethod: 'CASH',
      remarks: 'Partial cash deposit at counter',
      status: 'SUCCESS',
    },
  });

  await prisma.paymentAuditLog.create({
    data: {
      paymentId: payment2.id,
      invoiceId: invoice2.id,
      action: 'PAYMENT_RECEIVED',
      previousState: JSON.stringify({ balanceAmount: 1300, status: 'UNPAID' }),
      newState: JSON.stringify({ balanceAmount: 500, status: 'PARTIALLY_PAID' }),
      reason: 'Partial payment received',
    },
  });

  // Booking 3: Rohan -> Seat A-02, Afternoon Shift (Unpaid Invoice for testing reminders!)
  const booking3 = await prisma.seatBooking.create({
    data: {
      studentId: student3.id,
      seatId: seatA02.id,
      shiftId: afternoonShift.id,
      feePlanId: afternoonPlan.id,
      startDate: today,
      endDate: nextMonth,
      monthlyPrice: 1000,
      status: 'ACTIVE',
    },
  });

  await prisma.seatBookingHistory.create({
    data: {
      bookingId: booking3.id,
      studentId: student3.id,
      seatId: seatA02.id,
      shiftId: afternoonShift.id,
      actionType: 'BOOKED',
      remarks: 'Seat A-02 Afternoon Shift admission',
    },
  });

  const invoice3 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-0003',
      studentId: student3.id,
      bookingId: booking3.id,
      feePlanId: afternoonPlan.id,
      dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      subtotal: 1200,
      totalAmount: 1200,
      paidAmount: 0,
      balanceAmount: 1200,
      status: 'UNPAID',
    },
  });

  console.log('✅ Sample Bookings, Invoices, and Payments seeded.');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

