import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastProvider } from "./context/ToastContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";

const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SalesAndLeads = lazy(() => import("./pages/SalesAndLeads"));
const Reports = lazy(() => import("./pages/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const YourCalendar = lazy(() => import("./pages/sidebar/YourCalendar"));
const SalesAndLeadsClient = lazy(() => import("./pages/SalesAndLeadsClient"));
const Documents = lazy(() => import("./components/sales-and-leads/Documents"));
const Example = lazy(() => import("./pages/Example"));
const TeamManagement = lazy(() => import("./pages/team-management/TeamManagement"));
const TeamManagementSalesAndLeads = lazy(() => import("./pages/team-management/TeamManagementSalesLeads"));
const Venkat = lazy(() => import("./pages/Venkat"));
const CheckInHistory = lazy(() => import("./pages/CheckInHistory"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AttendanceManagement = lazy(() => import("./pages/team-management/AttendanceManagement"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const LeaveRequests = lazy(() => import("./pages/LeaveRequests"));
const SalarySlips = lazy(() => import("./pages/SalarySlips"));
const CompanyDocument = lazy(() => import("./pages/CompanyDocument"));
const AnnualVacations = lazy(() => import("./pages/AnnualVacations"));
const SettingsPreferences = lazy(() => import("./pages/SettingsPreferences"));
const HrMetricsDashboardPage = lazy(() => import("./pages/HrMetricsDashboardPage"));

const RouteFallback = () => (
  <div
    style={{
      minHeight: "40vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#64748b",
      fontSize: 14,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    Loading…
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SidebarProvider>
          <Router>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgotpassword" element={<ForgotPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/salesandleadsclient/:id" element={<ProtectedRoute><SalesAndLeadsClient /></ProtectedRoute>} />
                <Route path="/salesandleads" element={<ProtectedRoute><SalesAndLeads /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/company-document" element={<ProtectedRoute><CompanyDocument /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/yourcalendar" element={<ProtectedRoute><YourCalendar /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
                <Route path="/teammanagement" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/teammanagement_salesleads/:id" element={<ProtectedRoute><TeamManagementSalesAndLeads /></ProtectedRoute>} />
                <Route path="/attendance-management" element={<ProtectedRoute><AttendanceManagement /></ProtectedRoute>} />
                <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
                <Route path="/checkin-history" element={<ProtectedRoute><CheckInHistory /></ProtectedRoute>} />
                <Route path="/help-support" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
                <Route path="/leave-requests" element={<ProtectedRoute><LeaveRequests /></ProtectedRoute>} />
                <Route path="/annual-vacations" element={<ProtectedRoute><AnnualVacations /></ProtectedRoute>} />
                <Route path="/salary-slips" element={<ProtectedRoute><SalarySlips /></ProtectedRoute>} />
                <Route path="/hr-metrics-dashboard" element={<ProtectedRoute><HrMetricsDashboardPage /></ProtectedRoute>} />
                <Route path="/venkat" element={<ProtectedRoute><Venkat /></ProtectedRoute>} />
                <Route path="/settings-preferences" element={<ProtectedRoute><SettingsPreferences /></ProtectedRoute>} />
                <Route path="/example" element={<Example />} />
              </Routes>
            </Suspense>
          </Router>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
