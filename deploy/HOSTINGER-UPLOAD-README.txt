Sonashi HRMS - Hostinger Upload Package
Generated: 2026-07-17

ZIP FILES
=========
1. sonashi-frontend-hostinger-latest.zip (~2.93 MB)
   - React SOURCE project (required by Hostinger auto-deploy)
   - Includes latest UI/report updates:
     * Reports: searchable Individual Employee dropdown
     * Reports: Minimum / Exact experience filter modes
     * Dashboard: Yet to go shows ALL upcoming (no 60-day limit)
     * Shared yet-to-go helper used by Dashboard + Annual Vacations
   - Also includes prior: UI theme, sidebar toggle, breadcrumbs,
     Team Management doc Save/Download/Set, table scroll
   - .env.production: https://backend.sonashi.in/api

LOCATION
========
c:\Users\ASUS\sonashi\Sonashi-HRMS\deploy\

FRONTEND (hrms.sonashi.in)
==========================
1. Upload sonashi-frontend-hostinger-latest.zip
2. Hostinger settings:
   Build command: npm run build
   Output directory: build
   Node version: 18.x or 20.x
3. Deploy / Redeploy
4. Hard-refresh after deploy (Ctrl+Shift+R)

IMPORTANT
=========
- Do NOT upload local .env — use Hostinger env / .env.production in zip
- Frontend zip must be SOURCE code (package.json at root), not build folder only
- Backend zip not included in this package (frontend-only request)
