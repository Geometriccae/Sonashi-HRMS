import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SalesAndLeads from "./pages/SalesAndLeads";
import SalesAndLeadsClient from "./pages/SalesAndLeadsClient";
import Documents from "./components/sales-and-leads/Documents";
import Example from "./pages/Example";
// import AddClient from "./pages/AddClient";
import TeamManagement from "./pages/team-management/TeamManagement";
import TeamManagementSalesAndLeads from "./pages/team-management/TeamManagementSalesLeads";
import Venkat from "./pages/Venkat";
import ProtectedRoute from "./components/ProtectedRoute";



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>

        } />

        <Route path="/salesandleadsclient" element={
          <ProtectedRoute><SalesAndLeadsClient /></ProtectedRoute>
        } />
        <Route path="/salesandleads" element={
          <ProtectedRoute><SalesAndLeads /></ProtectedRoute>
        } />

       

        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        {/* <Route path="/addclient" element={<ProtectedRoute><AddClient /></ProtectedRoute>} /> */}

        <Route path="/teammanagement" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
        <Route path="/teammanagement_salesleads" element={<ProtectedRoute><TeamManagementSalesAndLeads /></ProtectedRoute>} />

        <Route path="/venkat" element={<ProtectedRoute><Venkat /></ProtectedRoute>} />
        <Route path="/example" element={<Example />} />

      </Routes>
    </Router>
  );
}

export default App;
