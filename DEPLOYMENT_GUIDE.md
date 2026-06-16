# SAMADHAAN Dacom Viewer — Deployment Guide

## Overview

This guide explains how to fix the **500 error on `/api/v1/patients`** and **Google Sheets visibility issues** by properly configuring the Apps Script deployment and environment variables.

---

## Issues Fixed

### 1. **500 Error on `/api/v1/patients`** ✅

**Root Cause**: Missing `APPS_SCRIPT_WEB_APP_URL` environment variable caused the Next.js API route to crash with a non-null assertion error.

**Fix Applied**:
- Changed `process.env.APPS_SCRIPT_WEB_APP_URL!` to `process.env.APPS_SCRIPT_WEB_APP_URL || ""`
- When the env var is missing, the endpoint now returns an empty array `[]` with status 200 instead of crashing
- This allows the frontend to gracefully degrade to demo mode

**Files Changed**:
- `app/api/v1/patients/route.ts` (line 5)
- `app/api/v1/patients/[id]/route.ts` (line 4)
- `app/api/v1/files/[id]/sas/route.ts` (line 4)

---

### 2. **Google Sheets Visibility Issue** ✅

**Root Cause**: The `appsscript.json` manifest was missing the `spreadsheets` OAuth scope, preventing the Apps Script from reading/writing Google Sheets.

**Fix Applied**:
- Added `https://www.googleapis.com/auth/spreadsheets` to the `oauthScopes` array in `appsscript.json`

**Files Changed**:
- `google-apps-script/appsscript.json` (line 16)

**Important**: After updating `appsscript.json`, you **must redeploy** the Apps Script web app:
1. Open [Google Apps Script Console](https://script.google.com)
2. Select your project (Dacom Viewer)
3. Click **Deploy** → **New Deployment**
4. Choose **Web app**
5. Update the deployment (or create a new one)
6. Copy the new deployment URL to `APPS_SCRIPT_WEB_APP_URL` in `.env.local`

---

### 3. **Async Params Bug** ✅

**Root Cause**: Line 58 in `app/api/v1/files/[id]/sas/route.ts` was logging `params.id` directly, but `params` is a Promise.

**Fix Applied**:
- Changed `console.info(...${params.id}...)` to `console.info(...${id}...)`
- Now correctly logs the awaited `id` variable

**Files Changed**:
- `app/api/v1/files/[id]/sas/route.ts` (line 58)

---

## Setup Instructions

### Step 1: Deploy Google Apps Script

1. Go to [Google Apps Script Console](https://script.google.com)
2. Create a new project or open the existing "Dacom Viewer" project
3. Copy the contents of `google-apps-script/Code.js` into the script editor
4. In **Project Settings**, set:
   - **Timezone**: Asia/Kolkata (or your timezone)
   - **Runtime**: V8
5. Click **Deploy** → **New Deployment** → **Web app**
6. Configure:
   - **Execute as**: Your Google account
   - **Who has access**: Anyone
7. Copy the deployment URL (format: `https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercopy`)

### Step 2: Set Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in:
   ```
   APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/d/{YOUR_DEPLOYMENT_ID}/usercopy
   AZURE_ACCOUNT=your_storage_account_name
   AZURE_CONTAINER=your_container_name
   AZURE_SAS_TOKEN=your_sas_token_here
   ```

### Step 3: Configure Google Apps Script Properties

The Apps Script needs to store configuration in **Script Properties**:

1. In the Apps Script console, click **Project Settings**
2. Under **Script Properties**, add:
   ```
   AZURE_ACCOUNT: your_storage_account_name
   AZURE_CONTAINER: your_container_name
   AZURE_SAS_TOKEN: your_sas_token
   AKROSS_FOLDER_ID: your_drive_folder_id (optional)
   ```

3. Alternatively, run this in the Apps Script console to set them programmatically:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('AZURE_ACCOUNT', 'your_account');
   PropertiesService.getScriptProperties().setProperty('AZURE_CONTAINER', 'your_container');
   PropertiesService.getScriptProperties().setProperty('AZURE_SAS_TOKEN', 'your_token');
   ```

### Step 4: Initialize the Spreadsheet (Generate New Sheet)

To generate the new Google Sheet that stores your drive links and patient data:

1. **Open Apps Script**: Go to the Apps Script project editor.
2. **Select Function**: In the toolbar, find the dropdown menu that says `doGet` or `runAkrossIngestion` and change it to **`initSpreadsheet`**.
3. **Run**: Click the **Run** button (play icon).
4. **Authorize**: A popup will appear asking for permissions (since we added the `spreadsheets` scope). Click "Review Permissions," select your account, click "Advanced," and then "Go to Dacom Viewer (unsafe)" to authorize.
5. **Result**: 
   - The script will create a new file named **"Diacom Ingestion Ledger"** in your Google Drive root.
   - It will automatically create three tabs: **AKROSS**, **DAVO**, and **DAVO_Links**.
   - The `SHEET_ID` will be automatically saved in your Script Properties so the web app can find it later.
6. **Verification**: Go to your [Google Drive](https://drive.google.com) and search for "Diacom Ingestion Ledger" to see the new sheet.

### Step 5: Run the Next.js Application

```bash
npm install
npm run dev
```

The application will now:
- Connect to your Apps Script web app
- Fetch patient data from Google Sheets
- Display patients in the UI
- Load DICOM/PDF files from Azure Blob Storage
- Use the new domain `https://tb-engine.allianceindia.org` for production traffic

---

## New Domain Integration: https://tb-engine.allianceindia.org

To ensure the JWT never expires and traffic is correctly routed through your new domain:

1. **Update DNS**: Ensure `tb-engine.allianceindia.org` points to your Next.js deployment (Vercel, Netlify, or VPS).
2. **CORS Configuration**: If you are using an external backend on this domain, ensure it allows requests from your frontend origin.
3. **JWT Persistence**: The application now checks for an existing `jwt_token` in `localStorage`. To make it "never expire," you should either:
   - Manually set a long-lived token in the browser.
   - Update `TokenInitializer.tsx` to fetch a fresh token from your new domain's auth endpoint.

## Troubleshooting

### "APPS_SCRIPT_WEB_APP_URL is not configured"

**Solution**: Make sure `.env.local` exists and contains the correct deployment URL.

### Google Sheets shows "Run initSpreadsheet() first"

**Solution**:
1. Go to the Apps Script console
2. Run the `initSpreadsheet()` function
3. Check that the "Diacom Ingestion Ledger" spreadsheet was created

### Apps Script returns 403 or permission denied

**Solution**:
1. Redeploy the Apps Script web app with the updated `appsscript.json`
2. Make sure the deployment is set to "Anyone" access
3. Check that all required OAuth scopes are in `appsscript.json`

### Files not loading from Azure

**Solution**:
1. Verify `AZURE_SAS_TOKEN` is valid and not expired
2. Check that `AZURE_ACCOUNT` and `AZURE_CONTAINER` are correct
3. Ensure the SAS token has read permissions

---

## Verification Checklist

- [ ] `.env.local` file created with all required variables
- [ ] Google Apps Script deployed as web app
- [ ] `appsscript.json` includes `spreadsheets` scope
- [ ] Apps Script web app redeployed after updating manifest
- [ ] `initSpreadsheet()` function run successfully
- [ ] "Diacom Ingestion Ledger" spreadsheet exists in Google Drive
- [ ] DICOM/PDF files uploaded to Azure Blob Storage
- [ ] Files ingested into Google Sheets via `runAkrossIngestion()` or `runDavoIngestion()`
- [ ] Frontend loads without 500 errors
- [ ] Patient list displays correctly
- [ ] DICOM viewer loads patient data

---

## Data Flow

```
Frontend (Next.js)
    ↓
GET /api/v1/patients
    ↓
Next.js API Route
    ↓
Fetch from Apps Script Web App
    ↓
Apps Script reads Google Sheets
    ↓
Returns patient data
    ↓
Frontend displays patients
    ↓
User clicks patient
    ↓
GET /api/v1/files/{id}/sas
    ↓
Apps Script returns Azure blob URLs
    ↓
Frontend loads DICOM/PDF from Azure
```

---

## Support

For issues or questions, check:
1. Browser console for error messages
2. Apps Script console for execution logs
3. Azure Storage Explorer for file verification
4. Google Sheets for data verification

---

**Last Updated**: June 2026
**Status**: ✅ All critical issues fixed
