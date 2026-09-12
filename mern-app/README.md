# Grievance Management System

A full-stack MERN application for anonymous community grievance reporting and staff-managed case resolution. Citizens can submit grievances anonymously, track them to resolution with a reference code, and staff can manage, assign, and resolve cases through a role-based admin dashboard.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Roles & Permissions](#roles--permissions)
- [Public API](#public-api)
- [Testing](#testing)
- [Design System](#design-system)

---

## Features

### Public (No Authentication)

- **Landing page** — hero, live stats, how-it-works, features, categories, FAQ, and CTA sections
- **Anonymous grievance submission** — rich text description (TipTap editor) with up to 5 file attachments (images, PDFs, documents)
- **Grievance tracking** — track status by reference code (e.g., `GRV-2026-XXXXXXXX`)
- **Public lookups** — browse active sub-counties, wards, and categories

### Staff & Admin (Authenticated)

- **Role-based access control** — `SUPER_ADMIN`, `ADMIN`, and `STAFF` roles with a permission hierarchy
- **Grievance management** — list, filter, search, view details, update status, assign to staff, add public updates
- **Dashboard analytics** — overview stats, status distribution, category/sub-county breakdowns, and trends
- **User management** — invite staff via email, manage users, activate/deactivate accounts
- **Configuration management** — manage sub-counties, wards, and grievance categories
- **Notifications** — in-app notification bell with real-time status updates
- **Audit logging** — full audit trail of actions across the system
- **CSV export** — export grievance data for reporting

### Security

- JWT access + refresh token authentication
- Password hashing with bcrypt
- Rate limiting (100 requests / 15 min per IP)
- Helmet security headers
- CORS restricted to configured origin
- Server-side HTML sanitization (sanitize-html) to prevent XSS
- File upload validation (type, size, count limits)
- Input validation with Zod

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router 7, TanStack Query 5, Tailwind CSS 3, TipTap 3, Lucide icons |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | MongoDB 8 (Mongoose 8) |
| **Validation** | Zod (shared between client and server) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **File Uploads** | Multer (memory storage, 10MB max, 5 files max) |
| **Testing** | Vitest, Supertest |
| **Tooling** | Vite, tsx, ESLint, Prettier, Docker Compose |

---

## Project Structure

This is an npm workspaces monorepo with three packages:

```
grievance-reporting-tool/
├── shared/                  # Shared types, enums, and validation schemas
│   └── src/
│       ├── types/           # User, grievance, API types
│       └── validation/      # Zod schemas shared across client & server
│
├── server/                  # Express API
│   └── src/
│       ├── config/          # Environment configuration
│       ├── middleware/      # Auth, authorize, validate, upload, error handling
│       ├── models/          # Mongoose models (13 models)
│       ├── modules/         # Feature modules (10 modules)
│       │   ├── auth/        # Login, refresh, password reset, invitations
│       │   ├── public/      # Public submission, tracking, lookups, stats
│       │   ├── grievances/  # CRUD, status, assignment, updates
│       │   ├── users/       # User management
│       │   ├── categories/  # Grievance categories
│       │   ├── locations/   # Sub-counties & wards
│       │   ├── analytics/   # Dashboard stats, breakdowns, trends, audit logs
│       │   ├── attachments/ # File upload/download
│       │   ├── notifications/ # In-app notifications
│       │   └── health/      # Health check
│       ├── services/        # Audit, notification, storage services
│       └── server.ts        # Entry point
│   └── test/                # Vitest integration tests
│
├── client/                  # React SPA
│   └── src/
│       ├── app/             # Router configuration
│       ├── components/      # UI primitives + feature components
│       │   └── ui/          # Button, card, input, select, textarea, badge, label
│       ├── layouts/         # PublicLayout, DashboardLayout
│       ├── pages/           # Public + authenticated pages
│       │   └── admin/       # Admin management pages
│       ├── services/        # API client functions
│       └── lib/             # Utilities (cn, sanitizeRichText, stripHtml)
│
└── docker-compose.yml       # MongoDB container
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (tested with 24)
- **npm** 9+
- **Docker** (for MongoDB) or a local MongoDB instance

### 1. Install Dependencies

```bash
npm install
```

> **Note:** This is an npm workspaces monorepo. Always run `npm install` from the **root** directory — packages are hoisted to the root `node_modules/`.

### 2. Configure Environment

Copy the example environment file and update the values:

```bash
cp .env.example server/.env
```

### 3. Start MongoDB

```bash
docker compose up -d
```

This starts MongoDB 8 on `localhost:27017` with the database `grievance_management`.

### 4. Start Development Servers

```bash
npm run dev
```

This runs both the server and client concurrently:

- **API Server:** http://localhost:5000
- **Health Check:** http://localhost:5000/api/health
- **Client:** http://localhost:5173

### 5. Seed Initial Data

The system requires at least one `SUPER_ADMIN` user and lookup data (sub-counties, wards, categories) to function. Seed these through the admin UI after logging in, or via the API.

---

## Environment Variables

Copy `.env.example` to `server/.env` and adjust as needed:

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | API server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/grievance_management` |
| `JWT_ACCESS_SECRET` | Secret for access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min 32 chars) | — |
| `JWT_ACCESS_EXPIRY` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime | `7d` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |
| `MAX_FILE_SIZE` | Max file size in bytes | `10485760` (10MB) |
| `MAX_FILES` | Max files per submission | `5` |
| `APP_URL` | Public API URL | `http://localhost:5000` |
| `CLIENT_URL` | Public client URL | `http://localhost:5173` |
| `LOG_LEVEL` | Pino log level | `info` |

---

## Scripts

### Root

| Command | Description |
|---|---|
| `npm run dev` | Start server + client concurrently |
| `npm run build` | Build shared, server, and client |
| `npm run build:shared` | Build the shared package |
| `npm run typecheck` | Typecheck server and client |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run docker:up` | Start MongoDB container |
| `npm run docker:down` | Stop MongoDB container |

### Server (`server/`)

| Command | Description |
|---|---|
| `npm run dev -w server` | Start server with hot reload (tsx watch) |
| `npm run build -w server` | Compile TypeScript to `dist/` |
| `npm run start -w server` | Run compiled server |
| `npm run test -w server` | Run Vitest integration tests |
| `npm run test:watch -w server` | Run tests in watch mode |

### Client (`client/`)

| Command | Description |
|---|---|
| `npm run dev -w client` | Start Vite dev server |
| `npm run build -w client` | Typecheck + build for production |
| `npm run preview -w client` | Preview production build |

---

## Roles & Permissions

The system uses three roles with a permission hierarchy:

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Full system access — user management, configuration, all grievance actions |
| `ADMIN` | Manage grievances, assignments, status updates, categories, locations |
| `STAFF` | View and work on assigned grievances, add updates |

Permission checks use `hasMinimumRole(userRole, requiredRole)` from the shared package. Higher roles inherit lower-role permissions.

### Route Protection

- **Public routes** — no auth required (`/api/public/*`, `/api/auth/login`, etc.)
- **Authenticated routes** — require a valid JWT access token
- **Admin routes** — require `ADMIN` or `SUPER_ADMIN` role
- **Super admin routes** — require `SUPER_ADMIN` role (user management, invitations)

---

## Public API

The public API requires no authentication and powers the landing page and citizen-facing features.

### Lookup Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/sub-counties` | List active sub-counties |
| `GET` | `/api/public/wards?subCountyId=...` | List wards for a sub-county |
| `GET` | `/api/public/categories` | List active grievance categories |
| `GET` | `/api/public/stats` | Public stats (total/resolved grievances, categories, sub-counties) |

### Grievance Submission

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/public/grievances` | Submit a grievance (multipart/form-data) |

**Fields:**
- `subCountyId` (required) — ObjectId of the sub-county
- `wardId` (required) — ObjectId of the ward
- `categoryId` (required) — ObjectId of the category
- `description` (required) — Rich text HTML, max 20,000 chars
- `files` (optional) — Up to 5 files (jpeg, png, gif, webp, pdf, doc, docx, txt), 10MB each

**Response:** `201` with `referenceCode`, `status`, and submission details.

### Grievance Tracking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/grievances/:referenceCode` | Track a grievance by reference code |

---

## Testing

The server uses **Vitest** with **Supertest** for integration testing against a local MongoDB test database.

```bash
# Run all server tests
npm run test -w server

# Run a single test file
npx vitest run test/public.test.ts -w server
```

### Test Configuration Notes

- Tests use a local MongoDB test database (`grievance_test`), not `mongodb-memory-server`
- `fileParallelism: false` is set to avoid test interference
- Each test file clears collections and seeds data in `beforeEach`
- Server typecheck excludes test files (`server/tsconfig.json` includes only `src/**/*`)

### Verification Commands

```bash
# Typecheck
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# Build
cd client && npm run build

# Run tests
cd server && npx vitest run
```

---

## Design System

The client uses a civic teal and amber design system built on Tailwind CSS with CSS custom properties:

- **Primary (teal):** `hsl(174 72% 24%)` — trust, governance, civic identity
- **Accent (amber):** `hsl(38 92% 50%)` — calls to action, highlights
- **Light ground:** clean, accessible light theme

### UI Components

Reusable primitives in `client/src/components/ui/`:
- `Button` — variants: default, outline, secondary, ghost, destructive, link
- `Card` — bordered container with optional hover effect
- `Input`, `Select`, `Textarea`, `Label` — form controls
- `Badge` — status and label indicators

### Rich Text Editor

The public submission form uses **TipTap** for rich text editing with:
- Bold, italic, strikethrough
- Heading 2
- Bullet and numbered lists
- Blockquotes
- Links
- Undo/redo

HTML is sanitized server-side with `sanitize-html` to strip dangerous content (e.g., `<script>` tags).

---

## License

Private project. All rights reserved.