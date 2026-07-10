Sonashi HRMS - Hostinger Upload Package
Generated: 2026-07-10

ZIP FILES
=========
1. sonashi-frontend-hostinger-latest.zip (~2.9 MB)
   - React SOURCE project (required by Hostinger auto-deploy)
   - Includes: blue sidebar + light topbar, breadcrumb bar, logo watermark,
     sidebar border toggle, modal fixes, Team Management table scroll,
     Reports employee filter, Annual Vacations updates, UI theme polish
   - .env.production: https://backend.sonashi.in/api

2. sonashi-backend-hostinger-latest.zip (~0.12 MB)
   - Node.js server code only
   - Excludes: node_modules, uploads, .env, scratch

LOCATION
========
c:\Users\ASUS\sonashi\Sonashi-HRMS\deploy\

BACKEND (backend.sonashi.in)
============================
1. Upload sonashi-backend-hostinger-latest.zip
2. Extract into your Node.js app folder
3. Set Environment Variables in Hostinger hPanel:
   PORT=5000
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_secret
   FRONTEND_URL=https://hrms.sonashi.in
   EMAIL_USER=...
   EMAIL_PASS=...
4. Run: npm install && npm start

FRONTEND (hrms.sonashi.in)
==========================
1. Upload sonashi-frontend-hostinger-latest.zip
2. Hostinger settings:
   Build command: npm run build
   Output directory: build
   Node version: 18.x or 20.x
3. Deploy / Redeploy

IMPORTANT
=========
- Do NOT upload .env files — use Hostinger environment variables
- Frontend zip must be SOURCE code (has package.json at root), not build folder only
- After deploy, restart backend and hard-refresh frontend (Ctrl+Shift+R)
