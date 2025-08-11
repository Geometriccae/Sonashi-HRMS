import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SalesAndLeads from "./pages/SalesAndLeads";
import Documents from "./components/sales-and-leads/Documents";
import Example from "./pages/Example";
import AddClient from "./pages/AddClient";
import ClientReview from "./pages/ClientDataReview";
import TeamManagement from "./pages/team-management/TeamManagement";
import TeamManagementSalesAndLeads from "./pages/team-management/TeamManagementSalesLeads";
import Venkat from "./pages/Venkat";







function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/salesandleads" element={<SalesAndLeads />} />
        <Route path="/documents" element={<Documents />} />
        
        <Route path="/venkat" element={<Venkat />} />
        
        <Route path="/example" element={<Example />} />
        <Route path="/addclient" element={<AddClient />} />
        <Route path="/clientreview" element={<ClientReview />} />

        <Route path="/teammanagement" element={<TeamManagement />} />
        <Route path="/teammanagement_salesleads" element={<TeamManagementSalesAndLeads />} />
      </Routes>
    </Router>
  );
}

export default App;
