# Complete Setup & Deployment Guide

This guide walks you through setting up the **Multi-Company Daily & Personal Expense Tracker** with **Supabase**, **AI Receipt Parsing (Gemini Vision)**, **Google Cloud Service Account (Live Sheets & Drive Sync)**, and deploying the web app directly to **Hostinger** from GitHub.

---

## Architecture Overview

```
Mobile / Desktop (React + Vite PWA)
       │
       ▼
Supabase Database (PostgreSQL) ──► RLS & Admin Approval Workflow
       │
       ├──► Storage Bucket ('receipts')
       │
       ├──► Edge Function: 'parse-receipt' ──► Google Gemini API (AI Vision)
       │
       └──► Edge Function: 'sync-expense'  ──► Google Cloud Service Account
                                                       ├──► Google Drive Folder (Archive & Rename)
                                                       └──► Google Sheets (Live Upsert & Sort)
```

---

## 1. Supabase Database & Storage Setup

1. Create a new project in [Supabase](https://supabase.com).
2. Go to **SQL Editor** in your Supabase Dashboard.
3. Open `supabase/schema.sql` from this repository and run the entire script.
   - This creates:
     - `profiles` table with automatic Admin creation for the first user.
     - `companies` table seeded with 2 default companies (`Alpha Enterprises` `CO1` and `Beta Global Corp` `CO2`).
     - `daily_receipt_sequences` table & `generate_receipt_code()` function.
     - `expenses` table with indexes.
     - `receipts` storage bucket with Row Level Security.
     - Full RLS policies.
4. Go to **Project Settings -> API** and copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon / public key** (`VITE_SUPABASE_ANON_KEY`)
   - **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## 2. Google Cloud Service Account Setup

To allow the background Edge Function to upload files to Google Drive and update Google Sheets without requiring personal Google logins:

### A. Create Project & Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Company-Expense-Tracker`).
3. Enable both APIs:
   - **Google Drive API**
   - **Google Sheets API**

### B. Create Service Account & Download JSON Key
1. In Google Cloud Console, navigate to **IAM & Admin -> Service Accounts**.
2. Click **Create Service Account**:
   - Name: `expense-tracker-sync`
   - Role: `Editor` or `Viewer/Editor`
3. Click into the newly created service account, go to the **Keys** tab, click **Add Key -> Create new key**, and choose **JSON**.
4. Download the JSON key file. Keep this secure. Note the `client_email` inside the JSON (e.g., `expense-tracker-sync@your-project.iam.gserviceaccount.com`).

### C. Share Google Sheets and Drive Folders
1. Create 2 Google Sheets (one for Company 1, one for Company 2).
2. For each Google Sheet:
   - Click **Share**.
   - Add the Service Account email with **Editor** permissions.
   - Copy the Sheet ID from the URL (the string between `/d/` and `/edit`):
     `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`**`/edit`
3. Create 2 Google Drive Folders (one for Company 1's receipts, one for Company 2's receipts).
4. For each Drive Folder:
   - Click **Share**.
   - Add the Service Account email with **Editor** permissions.
   - Copy the Folder ID from the URL:
     `https://drive.google.com/drive/folders/`**`1a2b3c4d5e6f7g8h9i0j`**

---

## 3. Gemini Vision API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** and generate a new key.
3. Save this key (`GEMINI_API_KEY`).

---

## 4. Deploy Supabase Edge Functions & Configure Secrets

Install the Supabase CLI if you haven't already:
```bash
brew install supabase/tap/supabase
```

Login and link your Supabase project:
```bash
supabase login
supabase link --project-ref your-project-id
```

### Set Edge Function Secrets
Set the required secrets in Supabase (replace with your values):

```bash
# 1. Gemini API Key
supabase secrets set GEMINI_API_KEY="AIzaSyYourGeminiApiKey"

# 2. Google Service Account Key (minify the JSON file to a single line or pass directly)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'

# 3. Supabase internal credentials (if not already set automatically)
supabase secrets set SUPABASE_URL="https://your-project-id.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Deploy Functions
```bash
supabase functions deploy parse-receipt --no-verify-jwt
supabase functions deploy sync-expense --no-verify-jwt
```

---

## 5. Configure Companies in the App

1. Sign up as the **first user** in the application.
   - The first user is automatically granted `admin` role and `approved` status!
2. Open the **Admin Dashboard -> Companies & Sheets** tab:
3. Update the seeded companies (`CO1` and `CO2`):
   - Set **Google Sheet ID**
   - Set **Sheet Tab Name** (default: `Expenses`)
   - Set **Google Drive Folder ID**
4. If you have a 3rd company in the future, simply click **Add Company**, enter its details, and it is immediately ready for logging and syncing without any code modifications!

---

## 6. Deploy to Hostinger (Production Web App)

The application includes `public/.htaccess` which configures Apache / Hostinger SPA routing rules to prevent 404 errors when refreshing client-side routes.

### Option A: Automatic Git Deployment via Hostinger Git Repository
1. Push your repository to GitHub.
2. In Hostinger hPanel, go to **Websites -> Manage -> Git**.
3. Link your GitHub repository:
   - Branch: `main`
   - Install Directory: `public_html` (or a subdirectory)
4. Set build command (or deploy the built `/dist` directory).

### Option B: Build Locally & Upload via Hostinger File Manager / FTP
1. In your local terminal with Node.js installed:
   ```bash
   npm install
   npm run build
   ```
2. This generates the `dist/` directory containing:
   - `index.html`
   - `.htaccess` (copied automatically from `public/.htaccess`)
   - `manifest.webmanifest`
   - Optimized JS & CSS bundles in `assets/`
3. Upload the contents of `dist/` directly into your Hostinger `public_html/` folder.

---

## 7. How the Live Synchronization Works

Whenever an expense is saved or edited:
1. **Unique Code:** Formats `{COMPANY_CODE}-{YYYYMMDD}-{SEQUENCE}` (e.g. `CO1-20261127-001`).
2. **Drive Upload:** If a screenshot/bill is attached, it is uploaded to that company's designated Google Drive Folder and renamed to `{RECEIPT_CODE}.jpg`.
3. **Google Sheets Live Sync:**
   - Appends or updates the row in the company's Google Sheet with 13 columns:
     `Receipt Code`, `Date`, `Time`, `Company`, `Logged By`, `Category`, `Type of Payment`, `Paid From`, `Description / Reason`, `Payment ID / UTR`, `Amount (INR)`, `Receipt Link`, `Last Updated`.
   - Executes `sortRange` ascending on **Date (Col B)** then **Time (Col C)** so the accountant's spreadsheet is always chronologically ordered.
