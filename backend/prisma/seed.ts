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

  // 5. Sample Floor & Room (Deterministic Upsert to prevent duplicate floors)
  const floor1 = await prisma.floor.upsert({
    where: { id: 'floor-ground-0' },
    update: {
      name: 'Ground Floor - Silent Zone',
      floorNumber: 0,
      description: 'Main silent study zone with 40 ergonomic desks',
    },
    create: {
      id: 'floor-ground-0',
      name: 'Ground Floor - Silent Zone',
      floorNumber: 0,
      description: 'Main silent study zone with 40 ergonomic desks',
    },
  });

  const roomA = await prisma.room.upsert({
    where: { id: 'room-reading-hall-a' },
    update: {
      name: 'Main Reading Hall A',
      description: 'Spacious hall with central AC and personal cubicles',
      width: 1400,
      height: 900,
    },
    create: {
      id: 'room-reading-hall-a',
      floorId: floor1.id,
      name: 'Main Reading Hall A',
      description: 'Spacious hall with central AC and personal cubicles',
      width: 1400,
      height: 900,
    },
  });

  // 6. Comprehensive Fee Plans (Shift-Based & Full-Day across 1, 3, 4, 6 Months)
  // Delete existing fee plans cleanly if resetting
  await prisma.feePlan.deleteMany();

  const feePlanDefinitions = [
    // Morning Shift Plans (06:00 - 12:00)
    {
      name: 'Morning Shift – 1 Month',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: morningShift.id,
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 1000,
      price: 900,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      description: 'Morning session 06:00 to 12:00 with dedicated desk and high speed internet.',
    },
    {
      name: 'Morning Shift – 3 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: morningShift.id,
      durationMonths: 3,
      durationDays: 90,
      originalPrice: 2700,
      price: 2500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 200,
      description: 'Morning session 06:00 to 12:00 for 3 months (Save ₹200).',
    },
    {
      name: 'Morning Shift – 4 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: morningShift.id,
      durationMonths: 4,
      durationDays: 120,
      originalPrice: 3600,
      price: 3200,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 400,
      description: 'Morning session 06:00 to 12:00 for 4 months (Save ₹400).',
    },
    {
      name: 'Morning Shift – 6 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: morningShift.id,
      durationMonths: 6,
      durationDays: 180,
      originalPrice: 5400,
      price: 4500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 900,
      description: 'Morning session 06:00 to 12:00 for 6 months (Save ₹900).',
    },

    // Afternoon Shift Plans (12:00 - 18:00)
    {
      name: 'Afternoon Shift – 1 Month',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: afternoonShift.id,
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 1100,
      price: 1000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 100,
      description: 'Afternoon session 12:00 to 18:00 with quiet reading environment.',
    },
    {
      name: 'Afternoon Shift – 3 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: afternoonShift.id,
      durationMonths: 3,
      durationDays: 90,
      originalPrice: 3000,
      price: 2700,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 300,
      description: 'Afternoon session 12:00 to 18:00 for 3 months (Save ₹300).',
    },
    {
      name: 'Afternoon Shift – 4 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: afternoonShift.id,
      durationMonths: 4,
      durationDays: 120,
      originalPrice: 4000,
      price: 3500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 500,
      description: 'Afternoon session 12:00 to 18:00 for 4 months (Save ₹500).',
    },
    {
      name: 'Afternoon Shift – 6 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: afternoonShift.id,
      durationMonths: 6,
      durationDays: 180,
      originalPrice: 6000,
      price: 5000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 1000,
      description: 'Afternoon session 12:00 to 18:00 for 6 months (Save ₹1000).',
    },

    // Evening Shift Plans (18:00 - 23:30)
    {
      name: 'Evening Shift – 1 Month',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: eveningShift.id,
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 1200,
      price: 1100,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 100,
      description: 'Evening session 18:00 to 23:30 with personal desk lamp.',
    },
    {
      name: 'Evening Shift – 3 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: eveningShift.id,
      durationMonths: 3,
      durationDays: 90,
      originalPrice: 3300,
      price: 3000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 300,
      description: 'Evening session 18:00 to 23:30 for 3 months (Save ₹300).',
    },
    {
      name: 'Evening Shift – 4 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: eveningShift.id,
      durationMonths: 4,
      durationDays: 120,
      originalPrice: 4400,
      price: 3900,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 500,
      description: 'Evening session 18:00 to 23:30 for 4 months (Save ₹500).',
    },
    {
      name: 'Evening Shift – 6 Months',
      category: 'SHIFT_BASED',
      planType: 'SHIFT_BASED',
      accessType: 'SHIFT',
      shiftId: eveningShift.id,
      durationMonths: 6,
      durationDays: 180,
      originalPrice: 6600,
      price: 5500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 1100,
      description: 'Evening session 18:00 to 23:30 for 6 months (Save ₹1100).',
    },

    // Full-Day Dedicated Desk Plans (Same reserved seat across Morning, Afternoon & Evening)
    {
      name: 'Full-Day Dedicated – 1 Month',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_DEDICATED',
      shiftId: null,
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 2700,
      price: 2400,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 300,
      description: 'Reserved personal dedicated desk across all 3 shifts (06:00 to 23:30).',
    },
    {
      name: 'Full-Day Dedicated – 3 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_DEDICATED',
      shiftId: null,
      durationMonths: 3,
      durationDays: 90,
      originalPrice: 7200,
      price: 6500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 700,
      description: 'Reserved dedicated desk across all 3 shifts for 3 months (Save ₹700).',
    },
    {
      name: 'Full-Day Dedicated – 4 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_DEDICATED',
      shiftId: null,
      durationMonths: 4,
      durationDays: 120,
      originalPrice: 9600,
      price: 8000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 1600,
      description: 'Reserved dedicated desk across all 3 shifts for 4 months (Save ₹1600).',
    },
    {
      name: 'Full-Day Dedicated – 6 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_DEDICATED',
      shiftId: null,
      durationMonths: 6,
      durationDays: 180,
      originalPrice: 14400,
      price: 11000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 3400,
      description: 'Reserved dedicated desk across all 3 shifts for 6 months (Save ₹3400).',
    },

    // Full-Day Flexible Seat Plans (Access across all 3 shifts)
    {
      name: 'Full-Day Flexible – 1 Month',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_FLEXIBLE',
      shiftId: null,
      durationMonths: 1,
      durationDays: 30,
      originalPrice: 2200,
      price: 2000,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 200,
      description: 'Full-day access across all three shifts with flexible seating.',
    },
    {
      name: 'Full-Day Flexible – 3 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_FLEXIBLE',
      shiftId: null,
      durationMonths: 3,
      durationDays: 90,
      originalPrice: 6000,
      price: 5400,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 600,
      description: 'Full-day access across all three shifts for 3 months (Save ₹600).',
    },
    {
      name: 'Full-Day Flexible – 4 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_FLEXIBLE',
      shiftId: null,
      durationMonths: 4,
      durationDays: 120,
      originalPrice: 8000,
      price: 6800,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 1200,
      description: 'Full-day access across all three shifts for 4 months (Save ₹1200).',
    },
    {
      name: 'Full-Day Flexible – 6 Months',
      category: 'FULL_DAY',
      planType: 'DURATION_BASED',
      accessType: 'FULL_DAY_FLEXIBLE',
      shiftId: null,
      durationMonths: 6,
      durationDays: 180,
      originalPrice: 12000,
      price: 9500,
      admissionFee: 200,
      hasDiscount: true,
      discountType: 'FIXED',
      discountValue: 2500,
      description: 'Full-day access across all three shifts for 6 months (Save ₹2500).',
    },
  ];

  const createdPlans: any[] = [];
  for (const planDef of feePlanDefinitions) {
    const created = await prisma.feePlan.create({ data: planDef });
    createdPlans.push(created);
  }

  const morningPlan = createdPlans[0];
  const afternoonPlan = createdPlans[4];
  const eveningPlan = createdPlans[8];
  const fullDayPlan = createdPlans[12];

  console.log(`✅ ${createdPlans.length} Membership Fee Plans created (Shift-Based & Full-Day across 1, 3, 4, 6 months).`);

  // 7. Generate a grid of 24 Seats in Room A with simple numeric numbering: 1, 2, 3, 4, 5...
  const seatList = [];
  const rows = 4;
  const cols = 6;
  const startX = 100;
  const startY = 120;
  const spacingX = 180;
  const spacingY = 160;

  // Clear any existing seats if re-seeding
  await prisma.seat.deleteMany({ where: { roomId: roomA.id } });

  let seatCounter = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const seatNum = `${seatCounter}`;
      const seat = await prisma.seat.create({
        data: {
          floorId: floor1.id,
          roomId: roomA.id,
          seatNumber: seatNum,
          x: startX + (c - 1) * spacingX,
          y: startY + r * spacingY,
          width: 70,
          height: 65,
          type: seatCounter === 1 ? 'PREMIUM' : 'STANDARD',
          properties: JSON.stringify({
            fontSize: 14,
            shiftFontSize: 8,
            studentFontSize: 8,
            indicatorHeight: 12,
            borderRadius: 12,
          }),
        },
      });
      seatList.push(seat);
      seatCounter++;
    }
  }

  // Also add some visual floor elements (Reception Desk, Partitions)
  await prisma.floorElement.deleteMany({ where: { roomId: roomA.id } });
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
        isHidden: false,
        properties: JSON.stringify({
          fontSize: 12,
          fontWeight: 'bold',
          textAlign: 'center',
          bgColor: '#fef3c7',
          borderColor: '#f59e0b',
          borderWidth: 2,
          textColor: '#78350f',
          borderRadius: 8,
        }),
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
        isHidden: false,
        properties: JSON.stringify({
          fontSize: 10,
          fontWeight: 'normal',
          textAlign: 'center',
          bgColor: '#334155',
          borderColor: '#0f172a',
          borderWidth: 1,
          textColor: '#f8fafc',
          borderRadius: 4,
        }),
      },
      {
        floorId: floor1.id,
        roomId: roomA.id,
        type: 'DOOR',
        label: 'Entrance Door',
        x: 40,
        y: 40,
        width: 45,
        height: 45,
        isHidden: false,
        properties: JSON.stringify({
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'center',
          bgColor: '#dbeafe',
          borderColor: '#3b82f6',
          borderWidth: 2,
          textColor: '#1e40af',
          borderRadius: 6,
        }),
      },
    ],
  });

  console.log(`✅ Created ${seatList.length} numeric seats (1 to ${seatList.length}) and floor elements in Hall A.`);

  // 8. Sample Students (using upsert)
  const today = new Date();
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const student1 = await prisma.student.upsert({
    where: { admissionNumber: 'LIB-2026-0001' },
    update: {},
    create: {
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

  const student2 = await prisma.student.upsert({
    where: { admissionNumber: 'LIB-2026-0002' },
    update: {},
    create: {
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

  const student3 = await prisma.student.upsert({
    where: { admissionNumber: 'LIB-2026-0003' },
    update: {},
    create: {
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

  const student4 = await prisma.student.upsert({
    where: { admissionNumber: 'LIB-2026-0004' },
    update: {},
    create: {
      admissionNumber: 'LIB-2026-0004',
      fullName: 'Vikram Malhotra',
      email: 'vikram.malhotra@example.com',
      phone: '+91 98444 55667',
      gender: 'MALE',
      address: 'Villa 12, Golf City, Noida',
      idProofType: 'AADHAAR',
      idProofNumber: '9876 5432 1098',
      emergencyContactName: 'Sanjay Malhotra',
      emergencyContactRelation: 'Father',
      emergencyContactPhone: '+91 98444 00004',
      bloodGroup: 'AB+',
      targetExam: 'UPSC CSE 2026 (Dedicated Desk)',
      notes: 'Full-Day dedicated desk occupant.',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Sample Students created/upserted.');

  // Clean prior sample bookings/invoices if re-seeding to ensure clean matrix
  await prisma.paymentAuditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.seatBookingHistory.deleteMany();
  await prisma.seatBooking.deleteMany();

  // 9. Bookings for Seat 1, Seat 2, and Seat 3 (Numeric Seats)
  const seat1 = await prisma.seat.findFirst({ where: { seatNumber: '1' } });
  const seat2 = await prisma.seat.findFirst({ where: { seatNumber: '2' } });
  const seat3 = await prisma.seat.findFirst({ where: { seatNumber: '3' } });

  if (seat1 && seat2 && seat3) {
    // Booking 1: Aarav -> Seat 1, Morning Shift
    const booking1 = await prisma.seatBooking.create({
      data: {
        studentId: student1.id,
        seatId: seat1.id,
        shiftId: morningShift.id,
        feePlanId: morningPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
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
        seatId: seat1.id,
        shiftId: morningShift.id,
        membershipCategory: 'SHIFT_BASED',
        actionType: 'BOOKED',
        remarks: 'Morning Shift admission booking on Seat 1',
      },
    });

    const invoice1 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-0001',
        studentId: student1.id,
        bookingId: booking1.id,
        feePlanId: morningPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
        durationMonths: 1,
        durationDays: 30,
        originalFee: 1000,
        planDiscount: 100,
        admissionFee: 200,
        subtotal: 1200,
        discount: 100,
        totalAmount: 1100,
        paidAmount: 1100,
        balanceAmount: 0,
        dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
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
        remarks: 'Admission fee + 1 Month Morning shift paid via UPI',
        status: 'SUCCESS',
      },
    });

    // Booking 2: Priya -> Seat 1, Evening Shift
    const booking2 = await prisma.seatBooking.create({
      data: {
        studentId: student2.id,
        seatId: seat1.id,
        shiftId: eveningShift.id,
        feePlanId: eveningPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
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
        seatId: seat1.id,
        shiftId: eveningShift.id,
        membershipCategory: 'SHIFT_BASED',
        actionType: 'BOOKED',
        remarks: 'Evening Shift booked on Seat 1',
      },
    });

    const invoice2 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-0002',
        studentId: student2.id,
        bookingId: booking2.id,
        feePlanId: eveningPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
        durationMonths: 1,
        durationDays: 30,
        originalFee: 1200,
        planDiscount: 100,
        admissionFee: 200,
        subtotal: 1400,
        discount: 100,
        totalAmount: 1300,
        paidAmount: 800,
        balanceAmount: 500,
        dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        status: 'PARTIALLY_PAID',
      },
    });

    await prisma.payment.create({
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

    // Booking 3: Rohan -> Seat 2, Afternoon Shift
    const booking3 = await prisma.seatBooking.create({
      data: {
        studentId: student3.id,
        seatId: seat2.id,
        shiftId: afternoonShift.id,
        feePlanId: afternoonPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
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
        seatId: seat2.id,
        shiftId: afternoonShift.id,
        membershipCategory: 'SHIFT_BASED',
        actionType: 'BOOKED',
        remarks: 'Seat 2 Afternoon Shift admission',
      },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-0003',
        studentId: student3.id,
        bookingId: booking3.id,
        feePlanId: afternoonPlan.id,
        membershipCategory: 'SHIFT_BASED',
        accessType: 'SHIFT',
        durationMonths: 1,
        durationDays: 30,
        originalFee: 1100,
        planDiscount: 100,
        admissionFee: 200,
        subtotal: 1300,
        discount: 100,
        totalAmount: 1200,
        paidAmount: 0,
        balanceAmount: 1200,
        dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        status: 'UNPAID',
      },
    });

    // Booking 4: Vikram Malhotra -> Seat 3, FULL-DAY DEDICATED (All 3 Shifts Reserved!)
    const fullDayBookingGroupId = 'full-day-booking-group-seat3';
    const shiftsToBook = [morningShift, afternoonShift, eveningShift];

    for (const sh of shiftsToBook) {
      const fullDayBooking = await prisma.seatBooking.create({
        data: {
          bookingGroupId: fullDayBookingGroupId,
          studentId: student4.id,
          seatId: seat3.id,
          shiftId: sh.id,
          feePlanId: fullDayPlan.id,
          membershipCategory: 'FULL_DAY',
          accessType: 'FULL_DAY_DEDICATED',
          startDate: today,
          endDate: nextMonth,
          monthlyPrice: 2400,
          status: 'ACTIVE',
        },
      });

      await prisma.seatBookingHistory.create({
        data: {
          bookingId: fullDayBooking.id,
          bookingGroupId: fullDayBookingGroupId,
          studentId: student4.id,
          seatId: seat3.id,
          shiftId: sh.id,
          membershipCategory: 'FULL_DAY',
          actionType: 'BOOKED',
          remarks: `Full-Day Dedicated Desk booking on Shift: ${sh.name}`,
        },
      });
    }

    const invoice4 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-2026-0004',
        studentId: student4.id,
        bookingGroupId: fullDayBookingGroupId,
        feePlanId: fullDayPlan.id,
        membershipCategory: 'FULL_DAY',
        accessType: 'FULL_DAY_DEDICATED',
        durationMonths: 1,
        durationDays: 30,
        originalFee: 2700,
        planDiscount: 300,
        admissionFee: 200,
        subtotal: 2900,
        discount: 300,
        totalAmount: 2600,
        paidAmount: 2600,
        balanceAmount: 0,
        dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: 'PAID',
        notes: 'Full-Day Dedicated Desk membership (All 3 Shifts reserved for Seat 3)',
      },
    });

    await prisma.payment.create({
      data: {
        receiptNumber: 'REC-2026-0003',
        invoiceId: invoice4.id,
        studentId: student4.id,
        amount: 2600,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-REF-FULLDAY-8921',
        remarks: 'Full settlement for Full-Day Dedicated Desk via UPI',
        status: 'SUCCESS',
      },
    });

    console.log('✅ Created Full-Day Dedicated booking on Seat 3 for Vikram Malhotra.');
  }

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

