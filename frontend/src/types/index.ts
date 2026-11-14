export interface Admin {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
}

export interface LibraryProfile {
  id: string;
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  adminName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingTime: string;
  closingTime: string;
  weeklyHolidays: string[];
  specialClosures: Array<{ date: string; reason: string }>;
  facilities: string[];
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  currency: string;
  currencySymbol: string;
  timezone: string;
  gstin?: string | null;
  termsAndConditions?: string | null;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Floor {
  id: string;
  name: string;
  floorNumber: number;
  description?: string | null;
  rooms: Room[];
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  description?: string | null;
  width: number;
  height: number;
  floor?: Floor;
}

export interface Seat {
  id: string;
  floorId: string;
  roomId: string;
  seatNumber: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  type: 'STANDARD' | 'PREMIUM' | 'CORNER' | 'CABIN';
  isActive: boolean;
  shifts?: SeatShiftStatus[];
  summaryStatus?: 'FULLY_BOOKED' | 'PARTIALLY_BOOKED' | 'AVAILABLE';
  isFullDayOccupied?: boolean;
  fullDayStudent?: {
    fullName: string;
    admissionNumber: string;
    phone?: string;
    photoUrl?: string | null;
  } | null;
  properties?: {
    fontSize?: number;
    shiftFontSize?: number;
    studentFontSize?: number;
    indicatorHeight?: number;
    borderRadius?: number;
    bgColor?: string;
    borderColor?: string;
    borderWidth?: number;
    textColor?: string;
  };
  floorName?: string;
  roomName?: string;
}

export interface SeatShiftStatus {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  timing: string;
  isBooked: boolean;
  statusColor: 'GREEN' | 'RED';
  booking?: {
    bookingId: string;
    studentId: string;
    studentName: string;
    admissionNumber: string;
    phone: string;
    photoUrl?: string | null;
    startDate: string;
    endDate: string;
    membershipCategory?: string;
    accessType?: string;
  } | null;
}

export interface FloorElement {
  id: string;
  floorId: string;
  roomId: string;
  type: 'TABLE' | 'WALL' | 'DOOR' | 'PILLAR' | 'PARTITION' | 'RECEPTION' | 'CUSTOM';
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isHidden?: boolean;
  properties?: {
    fontSize?: number;
    fontWeight?: string;
    textAlign?: string;
    bgColor?: string;
    borderColor?: string;
    borderWidth?: number;
    textColor?: string;
    borderRadius?: number;
  };
}

export interface Student {
  id: string;
  admissionNumber: string;
  fullName: string;
  email?: string | null;
  phone: string;
  alternatePhone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  idProofDocumentUrl?: string | null;
  photoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  targetExam?: string | null;
  notes?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  admissionDate: string;
  pendingBalance?: number;
  currentSeat?: string | null;
  currentShift?: string | null;
  bookings?: SeatBooking[];
  invoices?: Invoice[];
  payments?: Payment[];
  bookingHistories?: SeatBookingHistory[];
  reminderLogs?: ReminderLog[];
}

export interface FeePlan {
  id: string;
  name: string;
  planType: 'SHIFT_BASED' | 'DURATION_BASED' | 'ADMISSION_FEE';
  category: 'SHIFT_BASED' | 'FULL_DAY';
  accessType: 'SHIFT' | 'FULL_DAY_DEDICATED' | 'FULL_DAY_FLEXIBLE';
  durationMonths: number;
  durationDays: number;
  shiftId?: string | null;
  shift?: Shift | null;
  price: number;
  originalPrice?: number | null;
  hasDiscount: boolean;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  discountValidUntil?: string | null;
  admissionFee: number;
  calculatedDiscountAmount?: number;
  calculatedDiscountPercent?: number;
  totalPayable?: number;
  description?: string | null;
  isActive: boolean;
}

export interface SeatBooking {
  id: string;
  studentId: string;
  seatId: string;
  shiftId: string;
  feePlanId?: string | null;
  bookingGroupId?: string | null;
  membershipCategory?: string | null;
  accessType?: string | null;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'TRANSFERRED';
  monthlyPrice: number;
  notes?: string | null;
  seat?: Seat;
  shift?: Shift;
  student?: Student;
  feePlan?: FeePlan;
}

export interface SeatBookingHistory {
  id: string;
  bookingId: string;
  studentId: string;
  seatId: string;
  shiftId: string;
  bookingGroupId?: string | null;
  membershipCategory?: string | null;
  actionType: 'BOOKED' | 'TRANSFERRED' | 'RELEASED' | 'EXTENDED' | 'CANCELLED';
  previousSeatId?: string | null;
  newSeatId?: string | null;
  remarks?: string | null;
  createdBy?: string;
  createdAt: string;
  seat?: { seatNumber: string };
  shift?: { name: string };
  student?: { fullName: string; admissionNumber: string };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  bookingId?: string | null;
  bookingGroupId?: string | null;
  membershipCategory?: string | null;
  accessType?: string | null;
  durationMonths?: number | null;
  durationDays?: number | null;
  originalFee?: number | null;
  planDiscount?: number | null;
  customDiscount?: number | null;
  customDiscountReason?: string | null;
  admissionFee?: number | null;
  planSnapshot?: string | null;
  feePlanId?: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';
  notes?: string | null;
  student?: Student;
  booking?: SeatBooking;
  feePlan?: FeePlan;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'NET_BANKING' | 'CHEQUE' | 'OTHER';
  transactionRef?: string | null;
  remarks?: string | null;
  status: 'SUCCESS' | 'REVERSED';
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  invoice?: Invoice;
  student?: Student;
}

export interface ReminderLog {
  id: string;
  studentId: string;
  invoiceId?: string | null;
  channel: 'WHATSAPP' | 'EMAIL';
  recipientContact: string;
  templateName?: string | null;
  messageContent: string;
  status: 'SENT' | 'FAILED' | 'SIMULATED';
  simulated: boolean;
  error?: string | null;
  sentAt: string;
  student?: { fullName: string; admissionNumber: string };
  invoice?: { invoiceNumber: string; balanceAmount: number };
}

export interface ReminderSetting {
  id: string;
  autoRemindersEnabled: boolean;
  daysBeforeDue: number[];
  daysAfterDue: number[];
  sendWhatsApp: boolean;
  sendEmail: boolean;
  whatsappTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  simulatedMode: boolean;
}

