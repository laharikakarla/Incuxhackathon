# IncuX AI Hackathon

A premium hackathon management platform operated by IncuX AI.

## Project Overview

The platform supports:
- Participant registration and profiles
- Team formation and management
- Hackathon submissions
- Recruiter and judge portals
- Community discussions
- Payment management
- Admin dashboard
- Digital certificates

## Phase 1: project foundation

The current repository contains the public-facing React application foundation. Event dates, location, eligibility, prizes, partners, and organizer details are intentionally shown as unconfirmed placeholders until officially announced. Login, registration, and contact forms validate in the browser only; they do not send or store data.

### Requirements

- Node.js 20.19+ or 22.12+ (Node 24 is also supported)
- npm

### Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Useful checks and production preview:

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

No environment variables or external service credentials are needed for Phase 1. The app uses locally bundled fonts and does not connect to Supabase or payment services.

### App structure

- `src/app/` — application providers and routes
- `src/components/` — reusable layout, UI, and shared components
- `src/pages/public/` — public pages
- `src/styles.css` — visual tokens, responsive styles, and reduced-motion handling
- `public/` — static files served as-is (add assets here when needed)

## Technology Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Local MVP backend: Node.js and Express
- Local MVP database: SQLite (`better-sqlite3`)
- Future hosted backend under security review: Supabase and PostgreSQL
- Version Control: GitHub

## Local MVP (no Supabase connection)

The local demo runs a React/Vite frontend and an Express API backed by SQLite. It does not connect to Supabase or use the proposed PostgreSQL schema. Local account, profile, registration, session, announcement, and audit data is stored in `.local/aicuxora.sqlite` (ignored by Git).

Start both local services from the repository root:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The API health endpoint is `http://127.0.0.1:8787/api/health`. Stop both services with Ctrl+C.

To create a local administrator, first stop `npm run dev` with Ctrl+C, then run `npm run admin:create` in an interactive terminal and enter the account details when prompted. The password is masked while typing; no default account or password is created. Restart with `npm run dev`, then sign in through `/login`. The local database prevents two processes from opening it at once.

Local student registration creates an individual event registration, hashes the password with Node.js scrypt, and requires the local demo verification step before login. No email is sent; a one-time verification link is shown by the local registration page. This is for local demonstration only and is not suitable for public deployment. Payment, teams, submissions, recovery emails, admin invitations/role changes, and most content editing are not implemented. Do not use real participant credentials or personal data in this demo.
