import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; email: string };

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true },
    });

    if (!admin) {
      res.status(401).json({ error: 'Unauthorized: Admin account not found or session revoked' });
      return;
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }
}

