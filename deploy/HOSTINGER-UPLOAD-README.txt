Sonashi HRMS - Hostinger Upload Package
Generated: 2026-07-16

ZIP FILES
=========
1. sonashi-frontend-hostinger-latest.zip (~2.93 MB)
   - React SOURCE project (required by Hostinger auto-deploy)
   - Includes: UI theme, sidebar toggle, breadcrumbs, logo watermark,
     Team Management doc view Save/Download/Set, table scroll,
     Reports employee filter, Annual Vacations updates
   - .env.production: https://backend.sonashi.in/api

2. sonashi-backend-hostinger-latest.zip (~0.12 MB)
   - Node.js server code only
   - Includes: PATCH /api/employeedocuments/:id/type (Set document type)
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
5. Restart the Node app

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
- Deploy backend first if using Set document type, then frontend
- After deploy, restart backend and hard-refresh frontend (Ctrl+Shift+R)
