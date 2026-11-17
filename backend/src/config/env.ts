import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const resolveUploadDir = (): string => {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  // If running from project root where backend folder exists, store in backend/uploads
  const rootBackend = path.resolve(process.cwd(), 'backend');
  if (fs.existsSync(rootBackend)) {
    const rootBackendUploads = path.resolve(rootBackend, 'uploads');
    if (!fs.existsSync(rootBackendUploads)) {
      fs.mkdirSync(rootBackendUploads, { recursive: true });
    }
    return rootBackendUploads;
  }
  // If running directly inside backend/ directory
  const localUploads = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(localUploads)) {
    fs.mkdirSync(localUploads, { recursive: true });
  }
  return localUploads;
};

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'single_admin_library_secret_key_change_in_production_2026_xyz',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  UPLOAD_DIR: resolveUploadDir(),
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Library Admin <noreply@library.local>',
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  SIMULATION_MODE: process.env.SIMULATION_MODE !== 'false', // Default true unless explicitly false
};

