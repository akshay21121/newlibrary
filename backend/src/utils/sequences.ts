import { prisma } from '../config/prisma.js';

export async function generateAdmissionNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `LIB-${currentYear}-`;

  const latestStudent = await prisma.student.findFirst({
    where: {
      admissionNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      admissionNumber: 'desc',
    },
    select: {
      admissionNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestStudent && latestStudent.admissionNumber) {
    const parts = latestStudent.admissionNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
    select: {
      invoiceNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
}

export async function generateReceiptNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REC-${currentYear}-`;

  const latestPayment = await prisma.payment.findFirst({
    where: {
      receiptNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      receiptNumber: 'desc',
    },
    select: {
      receiptNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestPayment && latestPayment.receiptNumber) {
    const parts = latestPayment.receiptNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
}

