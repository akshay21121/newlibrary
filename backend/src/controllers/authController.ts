import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../utils/audit.js';
import { sendEmail } from '../services/emailService.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(6),
});

export async function getAuthStatus(req: Request, res: Response): Promise<void> {
  const adminCount = await prisma.admin.count();
  res.json({
    isConfigured: adminCount > 0,
    message: adminCount > 0 ? 'Admin account is configured' : 'Setup required: No admin account found',
  });
}

export async function setupAdmin(req: Request, res: Response): Promise<void> {
  const count = await prisma.admin.count();
  if (count > 0) {
    res.status(403).json({ error: 'System setup is already completed. Initial admin already exists.' });
    return;
  }

  const { name, email, password, phone } = setupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      phone,
    },
  });

  await logAuditEvent('AUTH', 'SETUP', admin.id, { email: admin.email, name: admin.name }, req);

  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    message: 'Admin account created successfully',
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const normalizedEmail = email.toLowerCase().trim();

  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isPasswordValid) {
    await logAuditEvent('AUTH', 'LOGIN_FAILED', admin.id, { email: normalizedEmail, reason: 'Invalid password' }, req);
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Update last login
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  });

  await logAuditEvent('AUTH', 'LOGIN_SUCCESS', admin.id, { email: admin.email }, req);

  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      avatarUrl: admin.avatarUrl,
    },
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.admin) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  if (!admin) {
    res.status(404).json({ error: 'Admin account not found' });
    return;
  }

  res.json({ admin });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Always return success response for security
  if (!admin) {
    res.json({ message: 'If an account exists with that email, a password reset link has been dispatched.' });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.admin.update({
    where: { id: admin.id },
    data: { resetToken, resetTokenExpiry },
  });

  const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const emailContent = `
    <h2>Password Reset Request</h2>
    <p>Hello ${admin.name},</p>
    <p>A password reset was requested for your Library Management Admin account.</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
    <p>Or paste this link into your browser: <br/><code>${resetLink}</code></p>
    <p>This link is valid for 1 hour. If you did not make this request, please ignore this email.</p>
  `;

  await sendEmail({
    to: admin.email,
    subject: 'Password Reset Request - Library Management System',
    html: emailContent,
  });

  await logAuditEvent('AUTH', 'FORGOT_PASSWORD_REQUESTED', admin.id, { email: admin.email }, req);

  res.json({
    message: 'If an account exists with that email, a password reset link has been dispatched.',
    // In simulation mode, provide the token to simplify testing
    ...(ENV.SIMULATION_MODE ? { simulationResetLink: resetLink, resetToken } : {}),
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);

  const admin = await prisma.admin.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!admin) {
    res.status(400).json({ error: 'Invalid or expired password reset token' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  await logAuditEvent('AUTH', 'PASSWORD_RESET_SUCCESS', admin.id, { email: admin.email }, req);

  res.json({ message: 'Password has been reset successfully. You may now log in.' });
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.admin) {
    await logAuditEvent('AUTH', 'LOGOUT', req.admin.id, { email: req.admin.email }, req);
  }
  res.json({ message: 'Logged out successfully' });
}

