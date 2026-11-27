# Multi-Company Daily & Personal Expense Tracker

A full-stack, mobile-first web application for tracking daily business expenses paid via personal accounts, UPI/Paytm, and cash (metro, food, auto/rickshaw, travel, petty cash). Expenses are stored in **Supabase**, analyzed with **AI Vision (Gemini)**, archived & renamed in **Google Drive**, and **live-synced chronologically** to company-specific **Google Sheets** for your accountant.

---

## Features

- **Mobile-First PWA-Style UI:** Optimized for quick logging on the go with thumb-friendly bottom navigation, camera capture, and desktop sidebar.
- **AI Screenshot OCR & Remark Parsing:** Gemini Vision extracts amount, date, time, payment method, payee, UTR, and scans for user-typed remarks inside Paytm/UPI screenshots.
- **Cash & Petty Cash Quick Presets:** Dedicated manual entry for metro recharges, auto/cab, street food, and cash with historical date/time support.
- **Unique Receipt Code:** Race-safe atomic format `{COMPANY_CODE}-{YYYYMMDD}-{001}` (e.g., `CO1-20261127-001`).
- **Live Google Sheets Sync:** Upserts data to company-specific spreadsheets with 13 standardized columns and chronological sorting by date and time.
- **Automatic Google Drive Archiving:** Attached receipts are saved in the company's Drive folder and renamed to `{RECEIPT_CODE}.jpg`.
- **Personal Reimbursement Tracker:** Calculates exact amounts owed to each team member for business expenses paid from personal accounts or cash.
- **Admin Approval Gate:** New signups require admin review before viewing or logging company expenses (the first registered user is automatically approved as Admin).
- **Dynamic Multi-Company Support:** 2 companies seeded initially, with instant admin ability to add 3rd+ companies with their own Sheet & Drive IDs.
- **Historical CSV Bulk Import:** Backfill past expenses with automatic receipt code assignment and live Google Sheets syncing.
- **Hostinger SPA Ready:** Includes `.htaccess` configuration to prevent client-side routing 404s.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons
- **Backend & Database:** Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Storage)
- **Serverless Compute:** Supabase Edge Functions (Deno)
  - `parse-receipt`: Gemini Vision API OCR
  - `sync-expense`: Google Cloud Service Account OAuth2 JWT, Drive API, Sheets API
- **Deployment:** Hostinger (Apache SPA) / GitHub

---

## Quick Start

### 1. Database Setup
Execute `supabase/schema.sql` in the Supabase SQL Editor.

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 3. Deploy Edge Functions
Follow instructions in [SETUP.md](SETUP.md) to set secrets and deploy:
```bash
supabase functions deploy parse-receipt --no-verify-jwt
supabase functions deploy sync-expense --no-verify-jwt
```

### 4. Build and Run
```bash
npm install
npm run dev
```

For production deployment to Hostinger, see the step-by-step instructions in [SETUP.md](SETUP.md).
