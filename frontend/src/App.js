import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import SalesAndLeads from "./pages/SalesAndLeads";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import YourCalendar from "./pages/sidebar/YourCalendar";
import SalesAndLeadsClient from "./pages/SalesAndLeadsClient";
import Documents from "./components/sales-and-leads/Documents";
import Example from "./pages/Example";
// import AddClient from "./pages/AddClient";
import TeamManagement from "./pages/team-management/TeamManagement";
import TeamManagementSalesAndLeads from "./pages/team-management/TeamManagementSalesLeads";
import Venkat from "./pages/Venkat";
import CheckInHistory from "./pages/CheckInHistory";
import UserManagement from "./pages/UserManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import AttendanceManagement from "./pages/team-management/AttendanceManagement";
import HelpSupport from "./pages/HelpSupport";
import LeaveRequests from "./pages/LeaveRequests";
import SalarySlips from "./pages/SalarySlips";
import CompanyDocument from "./pages/CompanyDocument";
import AnnualVacations from "./pages/AnnualVacations";
import SettingsPreferences from "./pages/SettingsPreferences";
import HrMetricsDashboardPage from "./pages/HrMetricsDashboardPage";

import { ToastProvider } from "./context/ToastContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SidebarProvider>
          <Router>
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
            {/* <Route path="/addclient" element={<ProtectedRoute><AddClient /></ProtectedRoute>} /> */}
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
          </Router>
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
