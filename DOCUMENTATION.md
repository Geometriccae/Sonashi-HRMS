# Sonashi HRMS — Project Documentation

## 1. Sonashi HRMS

**Repository:** [https://github.com/Geometriccae/Sonashi-HRMS.git](https://github.com/Geometriccae/Sonashi-HRMS.git)

**Branch:** `dharani-ft`

**Database:** MongoDB (Mongoose)  
**Database URL:** Set via Hostinger / server environment variable `MONGO_URI`  
*(Do not commit credentials — configure in Hostinger hPanel or local `.env`)*

**Deploy URL (Frontend):** [https://hrms.sonashi.in](https://hrms.sonashi.in)

**Deploy URL (Backend API):** [https://backend.sonashi.in](https://backend.sonashi.in)  
**API Base:** `https://backend.sonashi.in/api`

**Description:**  
Full-stack Human Resource Management System for Sonashi — employee lifecycle, leave & vacation tracking, payroll/salary slips, UAE WPS SIF import/export, reports, company documents, and role-based admin access.

**Features:**

- Dashboard (Admin overview cards, expiry alerts, vacation status)
- Team Management
  - Employee profiles (Basic Info, Documents, Salary, Increments, Leave, SIF)
  - Bulk employee Excel import
  - Document upload / preview / Save / Download / Set type
- Leave Management
- Annual Vacations (On vacation, Yet to go, Returned back)
- Salary Slips (generate, bulk import, PDF)
- Reports
  - Airfare, Increment, Document expiry, Salary, Employee Experience, Leave
  - Searchable employee filter
  - Minimum / Exact experience modes
  - Excel & PDF export
- SIF (UAE WPS) Import / Export
  - `.SIF` EDR/SCR generate & parse
  - Excel with red WPS columns (StaffID, EMPID, EMPLOYERID, AGENTCODE, BANKACCOUNT)
  - Company Employer ID / agent routing settings
- Company Documents
- User Management
- Settings & Preferences
- Help & Support
- Authentication (JWT)
  - Admin / HOD / HR / Viewer roles
- Real-time notifications (Socket.io)
- Document & visa/passport expiry reminders (cron)

**Stack:**

- Frontend: React 18, Ant Design, React Router, ExcelJS, jsPDF
- Backend: Node.js, Express 5, MongoDB / Mongoose, Multer, JWT, Socket.io
- Deployment: Hostinger (`hrms.sonashi.in` + `backend.sonashi.in`)

---

## 2. Frontend Service

**Repository:** [https://github.com/Geometriccae/Sonashi-HRMS.git](https://github.com/Geometriccae/Sonashi-HRMS.git) *(folder: `frontend/`)*

**Branch:** `dharani-ft`

**Database URL:** N/A (calls Backend API)

**Deploy URL:** [https://hrms.sonashi.in](https://hrms.sonashi.in)

**Description:**  
React SPA for Sonashi HRMS UI — dashboards, team management, leave, payroll reports, and SIF tools.

**Features:**

- React SPA (`create-react-app` / `react-scripts`)
- UI: Ant Design + custom CSS modules
- Auth token storage & protected routes
- API client services under `frontend/src/services/`
- Build: `npm run build` → output `build/`
- Production API: `REACT_APP_API_URL=https://backend.sonashi.in/api`

---

## 3. Backend Service

**Repository:** [https://github.com/Geometriccae/Sonashi-HRMS.git](https://github.com/Geometriccae/Sonashi-HRMS.git) *(folder: `server/`)*

**Branch:** `dharani-ft`

**Database URL:** MongoDB connection string via `MONGO_URI` environment variable

**Deploy URL:** [https://backend.sonashi.in](https://backend.sonashi.in)

**Description:**  
Node.js / Express API for employees, leave, salary slips, documents, reports data, notifications, and UAE WPS SIF import/export.

**Features:**

- REST API under `/api/*`
- JWT authentication middleware
- Employee CRUD + Excel import
- Leave requests & salary slips
- SIF routes (`/api/sif`) — settings, `.SIF` / Excel import & export
- File uploads (Multer)
- Socket.io real-time events
- Expiry notification cron
- Environment variables (Hostinger):
  - `PORT`
  - `MONGO_URI`
  - `JWT_SECRET`
  - `FRONTEND_URL=https://hrms.sonashi.in`
  - `EMAIL_USER` / `EMAIL_PASS` (optional mail)

---

## Local development

```bash
# Backend
cd server
npm install
npm start

# Frontend (separate terminal)
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000` and expects the API at the URL in `frontend/.env` / `config`.

---

## Deploy notes (Hostinger)

1. Upload backend source → `npm install && npm start` (set env vars in hPanel).
2. Upload frontend **source** zip → Build command `npm run build`, output directory `build`.
3. After deploy, hard-refresh the browser (`Ctrl+Shift+R`).

Deploy package guide: `deploy/HOSTINGER-UPLOAD-README.txt`
