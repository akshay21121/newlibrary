# Apex Study Library — Single-Library Management System

A completely new, independent, production-grade **Single-Library, Single-Admin Management System** built from scratch.

---

## 1. System Overview & Architecture

Apex Study Library is engineered specifically for a single library and single administrator. It features:

- **Single Library & Single Admin**: No SaaS multi-tenancy, no owner registration, and no tenant switching.
- **Three Independent Shifts Architecture**: Each seat independently tracks Morning (`06:00–12:00`), Afternoon (`12:00–18:00`), and Evening (`18:00–23:30`) bookings with customizable timings.
  - **Status Indicator**: Green = Booked (shows student name & admission ID), Red = Available (one-click booking modal).
- **Interactive Visual 2D Floor Plan Builder**:
  - Drag-and-drop visual canvas to reposition seats, desks, walls, doors, and partitions.
  - Quick Setup Wizard to generate `Rows × Columns` of seats with automatic sequencing (e.g. `A-01` to `D-06`).
  - Mobile-responsive Grid and List views for handheld tablets and phones.
- **Student Management**:
  - Auto-generated admission sequence: `LIB-YYYY-XXXX`.
  - Photo and KYC document file uploads (Aadhaar, PAN, Voter ID, Passport, Student ID).
  - Emergency contacts, target exams, address, and notes.
  - Safe Archival Protection: Deletion preserves all historical invoices and payment receipts for financial compliance.
- **Fee Management & Invoices**:
  - Auto-generated invoices (`INV-YYYY-XXXX`) and receipts (`REC-YYYY-XXXX`).
  - Payment modes: Cash, UPI, Card, Net Banking.
  - Payment Reversal with mandatory reason logging and immutable financial audit trail.
  - Printable Receipts: Pixel-perfect Standard A4 and Compact 80mm Thermal slip layouts.
- **WhatsApp & Email Reminders Engine**:
  - Manual bulk reminders with real-time template preview (`{student_name}`, `{amount_due}`, `{due_date}`, `{seat_number}`).
  - Automated background reminders based on configurable days before/after due date.
  - Stop reminders automatically once payment is settled; 24-hour spam cooldown protection.
  - Meta Cloud API for WhatsApp & Gmail SMTP via Nodemailer.
  - Realistic **Simulation Mode** toggle with simulation badges.
- **Reports & Analytics**:
  - Daily & Monthly revenue collections.
  - Overdue Defaulters register.
  - Shift-wise and Floor-wise occupancy rates.
  - One-click CSV exports for all reports.
- **Security & Backups**:
  - JWT authentication with bcrypt password hashing (12 rounds).
  - Login brute-force rate limiting and API rate limiting.
  - Standalone point-in-time database snapshot backup and restore CLI scripts.
  - Comprehensive administrative audit trail.

---

## 2. Technology Stack

- **Backend**: Node.js v20+, Express.js, TypeScript, Prisma ORM, SQLite
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Axios
- **File Uploads**: Multer with MIME-type and size security filters
- **Security**: Helmet, CORS, Express-Rate-Limit, Zod payload validation
- **Testing**: Vitest with Supertest

---

## 3. Directory Layout

```
c:\new library\
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   ├── seed.ts             # Default shifts, admin, seats, sample data
│   │   └── dev.db              # SQLite ACID database
│   ├── src/
│   │   ├── config/             # Prisma client & environment variables
│   │   ├── controllers/        # Business logic controllers
│   │   ├── middleware/         # Auth, error handling, rate limiting, upload
│   │   ├── routes/             # REST API routes
│   │   ├── services/           # Email & WhatsApp delivery services
│   │   ├── utils/              # Audit logger & sequence generators
│   │   └── index.ts            # Express server entry point
│   ├── scripts/
│   │   ├── backup.js           # CLI database backup script
│   │   └── restore.js          # CLI database restore script
│   ├── tests/
│   │   └── api.test.ts         # Automated integration tests
│   ├── uploads/                # Student photos and KYC files
│   ├── backups/                # Database snapshot files
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Layout & shared UI components
│   │   ├── context/            # AuthContext (JWT session state)
│   │   ├── pages/              # Dashboard, FloorPlan, Students, Fees, etc.
│   │   ├── services/           # Axios API client
│   │   ├── types/              # TypeScript interfaces
│   │   ├── App.tsx             # Route definitions
│   │   └── main.tsx            # React root mount
│   ├── dist/                   # Production build output
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
└── package.json                # Root monorepo scripts
```

---

## 4. Getting Started & Initial Setup

### 4.1 Prerequisites
- Node.js v18 or v20+
- npm v9+

### 4.2 Installation
In the project root directory:
```bash
# Install backend dependencies
cd backend
npm install

# Push database schema & seed initial data
npm run prisma:push
npm run prisma:seed

# Install frontend dependencies
cd ../frontend
npm install
```

### 4.3 Default Administrator Credentials
The database seed script sets up the single administrator account:
- **Email**: `admin@apexlibrary.com`
- **Password**: `Admin@123456`

*(If starting from a fresh database with no admin, the app automatically redirects to the initial setup wizard at `/setup`)*

---

## 5. Running the Application

### Development Mode:
Run backend and frontend concurrently or in two terminal windows:

**Terminal 1 (Backend API on http://localhost:5000):**
```bash
npm run dev:backend
```

**Terminal 2 (Frontend SPA on http://localhost:5173):**
```bash
npm run dev:frontend
```

Open your browser at **http://localhost:5173**.

---

## 6. Running Automated Tests

Run the backend integration test suite with Vitest:
```bash
npm test
# Or inside backend directory:
cd backend && npm run test
```

Tests verify:
- Server health endpoint
- Single Admin login authentication
- Rate limiting and credential protection
- 3-Shift seat matrix calculation
- Student directory querying
- Invoices generation and payment audit trail

---

## 7. Database Backup and Restore

### Create a Database Backup:
Run from the root or backend directory:
```bash
npm run backup
```
This saves an instant point-in-time copy of `dev.db` into `backend/backups/manual-backup-<timestamp>.db`.

### Restore a Database Backup:
```bash
npm run restore
# Or specify a particular backup file:
npm run restore backend/backups/manual-backup-2026-11-14T...db
```

Alternatively, perform backups and one-click restores visually in the **Settings &rarr; Database Backup & Restore** panel.

---

## 8. Production Deployment

### Build Both Backend & Frontend:
```bash
npm run build
```
This compiles the backend TypeScript and builds the frontend static assets into `frontend/dist`.

### Single-Port Production Run:
In production, Express automatically serves the built frontend from `frontend/dist` on port `5000`:
```bash
npm start
```
Access the complete application at `http://localhost:5000`.

---

## 9. Environment Variables (`backend/.env`)

```ini
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./dev.db"

JWT_SECRET=super_secure_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d

UPLOAD_DIR=./uploads
BACKUP_DIR=./backups
FRONTEND_URL=http://localhost:5173

# Email (Nodemailer Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="Apex Library <noreply@apexlibrary.com>"

# Meta WhatsApp Cloud API
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_access_token

# Simulation Mode (true = logs only; false = live external API delivery)
SIMULATION_MODE=true
```

