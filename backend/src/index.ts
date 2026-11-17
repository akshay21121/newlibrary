import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import floorRoutes from './routes/floorRoutes.js';
import seatRoutes from './routes/seatRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import feeRoutes from './routes/feeRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

const app = express();

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS
app.use(
  cors({
    origin: true, // Allow frontend dev server and production origin
    credentials: true,
  })
);

// Logging
if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure canonical upload directory exists
if (!fs.existsSync(ENV.UPLOAD_DIR)) {
  fs.mkdirSync(ENV.UPLOAD_DIR, { recursive: true });
}

// Synchronize files between candidate upload locations (e.g. root uploads vs backend/uploads)
const candidateUploadDirs = [
  ENV.UPLOAD_DIR,
  path.resolve(process.cwd(), 'backend', 'uploads'),
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), '..', 'uploads'),
  path.resolve(process.cwd(), '..', 'backend', 'uploads'),
];

for (const altDir of candidateUploadDirs) {
  if (fs.existsSync(altDir) && altDir !== ENV.UPLOAD_DIR) {
    try {
      const files = fs.readdirSync(altDir);
      for (const file of files) {
        const src = path.join(altDir, file);
        const dest = path.join(ENV.UPLOAD_DIR, file);
        if (fs.statSync(src).isFile() && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    } catch {
      // Ignore copy error during directory scan
    }
  }
}

// Static files for uploaded photos, logos, and documents
app.use('/uploads', express.static(ENV.UPLOAD_DIR));
for (const dir of candidateUploadDirs) {
  if (fs.existsSync(dir) && dir !== ENV.UPLOAD_DIR) {
    app.use('/uploads', express.static(dir));
  }
}

// Apply API rate limiter to all API endpoints
app.use('/api', apiLimiter);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Serve frontend static build if present (for single-port production or reverse proxy)
const candidatePaths = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../dist'),
];
const frontendDistPath = candidatePaths.find((p) => fs.existsSync(p));
if (frontendDistPath) {
  console.log(`📦 Serving frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Central Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, () => {
    console.log(`🚀 Library Management Backend running on http://localhost:${ENV.PORT}`);
    console.log(`📁 Uploads served from: ${ENV.UPLOAD_DIR}`);
    console.log(`🔧 Mode: ${ENV.NODE_ENV} | Simulation: ${ENV.SIMULATION_MODE}`);
  });
}

export default app;

