Sonashi HRMS - Hostinger deploy zips (latest)
Generated: 2026-08-12 11:25

Files:
  hostinger-frontend.zip  - React frontend (hrms.sonashi.in)
  hostinger-backend.zip   - Node/Express API (backend.sonashi.in)

package.json is at ZIP ROOT for both.
Excluded: node_modules, .env, build, logs, uploads

Frontend: npm run build, output: build
Backend: entry server.js, npm start
Keep env vars in Hostinger panel (not in zip).
