# ZOVO 🚗

**Share the ride. Share the journey.**

ZOVO is a production-ready ride-sharing platform where drivers going somewhere share empty seats with passengers heading the same way. Not a taxi app — true carpooling with real-time tracking, OTP-based ride starts, in-app chat, and a full verification pipeline.

![ZOVO](https://img.shields.io/badge/ZOVO-Ride--Sharing-0f766e?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=flat-square)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black?style=flat-square)
![Google Maps](https://img.shields.io/badge/Google%20Maps-Platform-blue?style=flat-square)

---

## ✨ Features

### Authentication & Roles
- **Email/Password** signup and login with **bcrypt** hashing
- **Google Sign-In** via Google Identity Services (verified server-side with `google-auth-library`)
- **JWT** in httpOnly cookies
- Role selection on first login: **Passenger** or **Driver** — switchable anytime
- Built-in **Admin** role with separate control panel

### Verification Pipeline (5 steps)
1. **Email** — real verification link via Gmail SMTP (Nodemailer)
2. **Phone** — auto-approved in dev (SMS gateway ready in code)
3. **KYC** — auto-approved in dev (admin review workflow wired)
4. **Driver** — license number, expiry, optional Aadhaar; auto-approved in dev
5. **Vehicle** — make/model/plate/seats/type; auto-approved in dev

Passengers can't book until Email + Phone + KYC verified.
Drivers can't offer rides until Driver + Vehicle verified.

### Driver Flow
- Offer ride with map-based pickup/destination autocomplete
- Set departure date/time, seats, price per seat
- Route distance & ETA auto-calculated
- Receive booking requests in real time
- Accept/Reject passengers
- Verify 6-digit OTP at pickup
- Start ride → Live GPS tracking → Complete ride
- View earnings (today/week/total), ride history, active ride

### Passenger Flow
- Search rides with map autocomplete (pickup + destination)
- Filter by date, seats, max price; sort by relevance/price/departure/distance
- Haversine-based proximity matching (within configurable radius)
- Send booking request → receive confirmation + OTP instantly
- View OTP to share with driver at pickup
- Live-track driver on map once ride starts
- Rate driver after completion
- Booking history with status badges

### Real-Time Features (Socket.IO)
- Booking request → driver (instant)
- Booking accepted/rejected → passenger (instant)
- OTP generated → passenger (instant)
- Driver location updates (live GPS, ~1s interval)
- Seat count updates (live)
- Ride started/completed broadcasts
- In-app chat with read receipts
- Real-time notifications with toast popups

### In-App Chat
- Opens automatically when booking is confirmed
- Instant messaging with optimistic UI
- Read receipts + timestamps
- Auto-archived when ride completes

### OTP Workflow
- 6-digit code generated on booking acceptance
- Shown only to passenger
- Driver enters code at pickup → ride can only start if correct
- Incorrect OTP blocks ride start

### Payments Architecture
- **Cash** payment (current default — records transaction at ride completion)
- **UPI / Razorpay / Stripe** — backend architecture ready, just add gateway keys
- Automatic platform fee (10%) and driver payout calculation
- Full payment ledger in admin panel

### Admin Panel
- Real-time stats: users, drivers, passengers, active/completed rides
- Platform earnings + total revenue + driver payouts
- 7-day revenue chart
- User management: search, ban/unban, make admin
- Ride management with status filters
- Pending verification review (approve/reject)
- Payment ledger with platform fees

### Security
- JWT auth, httpOnly cookies
- Role-based access control on every API
- Backend validation with Zod on every endpoint
- Password hashing with bcrypt (12 rounds)
- Secure file uploads (5MB limit, image/PDF only)
- Audit logs for admin actions

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript 5** (strict) |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (New York) |
| Database | **PostgreSQL** on **Neon** (or any hosted Postgres) |
| ORM | **Prisma 6** |
| Real-time | **Socket.IO** (standalone mini-service) |
| Maps | **Google Maps JS SDK** + `@react-google-maps/api` |
| Location | Google Places + Geocoding + Directions APIs (with OSM/OSRM fallback) |
| Auth | **NextAuth.js v4** available, custom JWT used |
| Google OAuth | **google-auth-library** (server-side ID token verification) |
| Email | **Nodemailer** + **Gmail SMTP** |
| State | **Zustand** (client) + **TanStack Query** available |
| Validation | **Zod** |
| Toasts | **Sonner** |
| Date | **date-fns** |
| Icons | **lucide-react** |

---

## 📂 Project Structure

```
zovo/
├── prisma/
│   └── schema.prisma                  # 14 normalized models
├── src/
│   ├── app/
│   │   ├── api/                       # 30+ API routes
│   │   │   ├── auth/                  # signup, login, google, logout, me, switch-role, socket-token
│   │   │   ├── verify/                # email-request, email-confirm, phone, kyc, driver, vehicle, status
│   │   │   ├── rides/                 # create, search, list, detail, cancel, start, complete
│   │   │   ├── bookings/              # request, list, detail, accept, reject, cancel, verify-otp, start, complete, rate
│   │   │   ├── chat/                  # messages, send, mark-read
│   │   │   ├── notifications/         # list, mark-read, unread-count
│   │   │   ├── location/              # autocomplete, geocode, route, update
│   │   │   ├── admin/                 # stats, users, rides, payments, verify/list, verify/review
│   │   │   └── upload/
│   │   ├── globals.css                # ZOVO brand (teal-green) + dark mode
│   │   ├── layout.tsx                 # Root layout with Google Identity Services
│   │   └── page.tsx                   # Single-route view orchestrator
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components
│   │   └── zovo/
│   │       ├── auth/                  # auth-screen, role-select-screen
│   │       ├── verification/          # verification-screen
│   │       ├── passenger/             # search, current, history, profile, support
│   │       ├── driver/                # dashboard, offer, requests, active, misc (upcoming/earnings/history/profile)
│   │       ├── admin/                 # admin-views (dashboard, users, rides, verifications, payments)
│   │       └── shared/                # logo, dashboard-shell, zovo-map, location-autocomplete, google-sign-in-button
│   └── lib/
│       ├── auth.ts                    # JWT, bcrypt, session, cookies
│       ├── db.ts                      # Prisma client
│       ├── mailer.ts                  # Nodemailer + Gmail SMTP
│       ├── notify.ts                  # Notification persistence + realtime push
│       ├── realtime-push.ts           # HTTP push to socket.io server
│       ├── verification.ts            # Verification gate helpers
│       ├── api-client.ts              # Typed frontend API client
│       └── stores/                    # Zustand stores (auth, realtime, ui)
├── mini-services/
│   └── zovo-realtime/                 # Standalone Socket.IO server (port 3003)
│       ├── index.ts
│       └── package.json
├── scripts/
│   └── bootstrap-admin.ts             # Creates admin user
├── prisma/schema.prisma
├── .env.example
├── next.config.ts
└── package.json
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+ or Bun
- PostgreSQL database (we recommend [Neon](https://neon.tech) — free tier)
- Google Cloud project with Maps APIs enabled
- Gmail account with App Password for SMTP

### 1. Clone & Install

```bash
git clone https://github.com/parthboricha933/zovo.git
cd zovo
bun install  # or npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — long random string
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key
- `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` — Google OAuth credentials
- `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` — same as above (client-readable)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Gmail SMTP
- `NEXT_PUBLIC_APP_URL` — your app URL (e.g. `http://localhost:3000`)
- `REALTIME_BASE_URL` — set in production only (URL of your realtime server)

### 3. Set Up Database

```bash
bun run db:push        # Create tables from schema.prisma
bun run bootstrap-admin # Create the admin user (admin@zovo.app / admin123)
```

### 4. Start the Realtime Service (separate terminal)

```bash
cd mini-services/zovo-realtime
bun install
bun run dev
# Runs on http://localhost:3003
```

### 5. Start the Next.js App

```bash
bun run dev
# Runs on http://localhost:3000
```

Open http://localhost:3000 and sign up!

---

## 🌐 Production Deployment

### Frontend → Vercel

The Next.js app deploys cleanly to Vercel:

1. Push to GitHub
2. Import the repo at https://vercel.com/new
3. Add all environment variables (same as `.env.example`)
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain
5. Deploy — Vercel will auto-detect Next.js and run `prisma generate` via `postinstall`

### Realtime Service → Render / Railway / Fly.io

The Socket.IO service in `mini-services/zovo-realtime/` cannot run on Vercel (Vercel doesn't support long-lived WebSocket servers). Deploy it separately:

**Render (free tier):**
1. Create a new "Web Service" pointing to the `mini-services/zovo-realtime` subfolder
2. Build command: `bun install`
3. Start command: `bun run index.ts`
4. Set `JWT_SECRET` env var (same as the Next.js app)
5. Once deployed, set `REALTIME_BASE_URL` on Vercel to your Render URL (e.g. `https://zovo-realtime.onrender.com`)
6. Also set `NEXT_PUBLIC_REALTIME_BASE_URL` to the same URL (so the frontend connects directly)

**Railway / Fly.io:** similar process.

### Database → Neon

[Neon](https://neon.tech) provides free managed PostgreSQL with branching. The connection string in `DATABASE_URL` works as-is.

### Google Cloud Setup

Enable these APIs in your Google Cloud Console (https://console.cloud.google.com/apis/library):
- **Maps JavaScript API** (for the visual map)
- **Places API (New)** (for autocomplete)
- **Geocoding API** (for reverse geocoding)
- **Directions API** (for route calculation)

Create an API key and restrict it to your domain + the APIs above.

For Google OAuth:
1. Go to **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add your Vercel domain to **Authorized JavaScript origins**
4. Copy the Client ID and Secret to env vars

### Gmail SMTP Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password (8 chars, no spaces)
4. Use it as `SMTP_PASS`

---

## 📊 Database Schema

14 normalized models:

| Model | Purpose |
|---|---|
| `User` | Core user account (email, password, role, ratings) |
| `DriverProfile` | License + Aadhaar + driver-specific stats |
| `Vehicle` | Make/model/plate/seats/RC/insurance |
| `PassengerProfile` | Passenger rating + ride count |
| `Ride` | Driver's offered ride (route, time, seats, price) |
| `Booking` | Passenger's seat request on a ride |
| `Message` | In-app chat messages |
| `Notification` | User notifications |
| `Payment` | Transaction records with platform fee |
| `Review` | Post-ride ratings (driver ↔ passenger) |
| `Verification` | Verification documents and status per type |
| `AuditLog` | Admin action audit trail |
| `LiveLocation` | Real-time driver GPS during active rides |

---

## 🔐 Demo Accounts

After running `bun run bootstrap-admin`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@zovo.app` | `admin123` |

Sign up new accounts to test the passenger and driver flows.

---

## 🧪 Verified End-to-End Flow

The complete booking lifecycle is tested and working:

1. **Driver** signs up → email verified via Gmail SMTP → driver verification → vehicle registered
2. **Driver** offers ride (Bhavnagar → Ahmedabad, ₹350/seat)
3. **Passenger** searches via map autocomplete → finds ride
4. **Passenger** books → driver receives request instantly via Socket.IO
5. **Driver** accepts → 6-digit OTP generated → passenger notified
6. **Driver** activates ride → verifies OTP → ride starts (live GPS begins)
7. **Driver** completes ride → payment recorded (₹350 total, ₹35 platform fee, ₹315 driver payout)
8. **Passenger** rates driver 5 stars
9. **In-app chat** exchanges messages between driver and passenger
10. **Admin panel** shows real-time stats: users, drivers, rides, revenue

---

## 🛡 Security Features

- ✅ JWT auth in httpOnly cookies (7-day expiry)
- ✅ bcrypt password hashing (12 rounds)
- ✅ Server-side Google ID token verification
- ✅ Role-based access control on every API endpoint
- ✅ Zod schema validation on all inputs
- ✅ File upload restrictions (5MB max, image/PDF only)
- ✅ Audit logs for admin actions
- ✅ Rate limiting ready (add `next-ratelimit` if needed)

---

## 📈 Real-Time Events

All events flow through the Socket.IO server:

| Event | Direction | Trigger |
|---|---|---|
| `booking:request` | Server → Driver | Passenger requests booking |
| `booking:accepted` | Server → Passenger | Driver accepts |
| `booking:rejected` | Server → Passenger | Driver rejects |
| `booking:cancelled` | Server → Both | Either party cancels |
| `otp:generated` | Server → Passenger | OTP created on accept |
| `otp:verified` | Server → Both | Driver verified OTP |
| `ride:started` | Server → Both | Ride began |
| `ride:completed` | Server → Both | Ride finished |
| `ride:location` | Driver → Server → Passenger | GPS update (~1s) |
| `ride:seats` | Server → All | Seat count changed |
| `chat:message` | Client → Server → Other | New chat message |
| `chat:read` | Client → Server → Other | Messages marked read |
| `notification` | Server → User | Any notification |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — feel free to use this for your own ride-sharing platform.

---

## 🙏 Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) for free fallback geocoding
- [OSRM](https://project-osrm.org/) for free fallback routing
- [Neon](https://neon.tech) for managed PostgreSQL
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Vercel](https://vercel.com) for hosting the Next.js app

---

**Built with ❤️ for carpoolers everywhere.**
