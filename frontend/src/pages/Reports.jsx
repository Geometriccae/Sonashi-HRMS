import React, { useState, useEffect } from "react";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import NotificationBell from "../components/NotificationBell";

function Reports() {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [reportType, setReportType] = useState("");
  const [format, setFormat] = useState("");

  // Filters
  const [leadType, setLeadType] = useState("All");
  const [followupStatus, setFollowupStatus] = useState("All");
  const [employeeStatus, setEmployeeStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterRole, setFilterRole] = useState("All");
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterCountry, setFilterCountry] = useState("All");
  const [minExperience, setMinExperience] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dynamic dropdown list selectors
  const [uniqueDepartments, setUniqueDepartments] = useState(["All"]);
  const [uniqueRoles, setUniqueRoles] = useState(["All"]);
  const [uniqueOffices, setUniqueOffices] = useState(["All"]);
  const [uniqueCountries, setUniqueCountries] = useState(["All"]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");

    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployees();
        const empList = Array.isArray(data)
          ? data
          : data.employees || data.data || [];

        // Extract unique options — sort first, then prepend "All"
        const depts = ["All", ...[...new Set(empList.map(e => e.department).filter(Boolean))].sort()];
        const roles  = ["All", ...[...new Set(empList.map(e => e.role).filter(Boolean))].sort()];
        const offices = ["All", ...[...new Set(empList.map(e => e.office).filter(Boolean))].sort()];
        const countries = ["All", ...[...new Set(empList.map(e => e.nationality).filter(Boolean))].sort()];

        setUniqueDepartments(depts);
        setUniqueRoles(roles);
        setUniqueOffices(offices);
        setUniqueCountries(countries);
      } catch (err) {
        console.error("Failed to load employees for report filters:", err);
      }
    };
    loadEmployees();
  }, []);

  const reportTypes = ["Sales Report", "Employee Report"];
  const formats = ["Excel", "CSV"];

  const leadTypeOptions = ["All", "Lead", "Client"];
  const followupStatusOptions = [
    "All", "Completed", "Contacted", "Demo Scheduled", "Lost",
    "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"
  ];
  const employeeStatusOptions = ["All", "Active", "InActive"];

  const clientDropdownOptions = {
    clientType: ["Agent", "Barge Operator", "Barge Owners", "Broker", "CHA", "Consignee", "Freigt Forwarder", "Other", "Ship Owners", "Shipper", "Transporter"],
    leadType: ["Client", "Lead"],
    leadSource: ["Advertisement", "Cold Call", "Conference", "Employee Referral", "Exhibitor", "Exhibition As Visitor", "External Referral", "SOCIAL MEDIA"],
    leadStatus: ["Attempted To Contact", "Contact In Future", "Contacted", "Junk Lead", "Lost Lead", "Negotiation", "New", "Qualified", "Quoted", "Won"],
    industryType: ["Bulk trading company", "Cement manufacturing companies", "Cryogenic tank manufacturers", "Dredging companies", "Drydocks", "Fiber pipe manufacturing company", "Freight forwarders", "Gypsum traders", "Heavy engineering", "Heavy transport companies in abroad", "Heavy transport companies in india", "Hydro power", "Industrial air filter companies", "Industrial boiler", "Industrial gases tank / cylinders", "Jack up rig owners", "Limestone traders", "Mining companies", "Navy", "Nuclear power", "Offshore companies", "Offshore windmill companies", "Oil and gas companies", "Pick up trucks", "Port infrastructure companies", "Railway wagon manufacturers", "Shipbuilding", "Shipyards", "Silica sand manufacturers", "Steel traders", "Straddle carrier manufacturer", "Thermal power", "Transformer manufacturers", "Windmill companies"],
    category: ["Breakbulk", "Bulk", "Project"],
    decisionMaker: ["No", "Yes"],
    relationshipStatus: ["Active", "Dormant", "Lost", "Prospect"],
    contractType: ["COA", "Long-term", "Spot", "Tender"],
    currentStatus: ["Contacted", "Lead", "Lost", "Negotiation", "Quoted", "Won"],
    followupStatus: ["Completed", "Contacted", "Demo Scheduled", "Lost", "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"],
    incoterms: ["FOB", "CIF", "DAP"]
  };

  const employeeDropdownOptions = {
    attendance: ["Active", "InActive"],
    department: ["Operations", "Sales", "Marketing", "HR", "Finance", "IT", "Logistics", "Customer Service"],
    role: ["Operations Manager", "Sales Executive", "Logistics Coordinator", "Account Manager", "HR Manager", "Finance Analyst", "IT Specialist", "Customer Service Representative"]
  };

  const handleCancel = () => {
    setReportType("");
    setFormat("");
    setLeadType("All");
    setFollowupStatus("All");
    setEmployeeStatus("All");
    setFilterDepartment("All");
    setFilterRole("All");
    setFilterOffice("All");
    setFilterCountry("All");
    setMinExperience("");
    setStartDate("");
    setEndDate("");
    setError("");
  };

  const handleGenerateReport = async () => {
    if (!reportType) { alert("Please select a report type."); return; }
    if (!format) { alert("Please select a format."); return; }

    setLoading(true);
    setError("");

    try {
      if (reportType === "Sales Report") {
        await generateSalesReport();
      } else if (reportType === "Employee Report") {
        await generateEmployeeReport();
      }
    } catch (err) {
      console.error("Report generation failed:", err);
      setError("Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async () => {
    let data = await clientService.getClients();
    let clients = Array.isArray(data) ? data : (data.clients || data.data || []);

    if (leadType !== "All") clients = clients.filter(c => c.leadType === leadType);
    if (followupStatus !== "All") clients = clients.filter(c => c.followupStatus === followupStatus);
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      clients = clients.filter(c => {
        const date = new Date(c.createdAt);
        return date >= start && date <= end;
      });
    }

    if (clients.length === 0) { alert("No data found for the selected filters."); return; }

    const exportData = clients.map(c => ({
      "Company Name": c.companyName || "",
      "Client Type": c.clientType || "",
      "Lead Type": c.leadType || "",
      "Address": c.address || "",
      "Country": c.country || "",
      "Tax ID": c.taxId || "",
      "Website": c.website || "",
      "Primary Contact": c.primaryContactName || "",
      "Designation": c.designation || "",
      "Phone": c.phone || "",
      "Mobile": c.mobile || "",
      "Email": c.email || "",
      "Social Links": c.socialLinks || "",
      "Industry Type": c.industryType || "",
      "Cargo Type": c.cargoType || "",
      "Decision Maker": c.decisionMaker || "",
      "Relationship Status": c.relationshipStatus || "",
      "Account Manager": c.accountManager || "",
      "Typical Cargoes": c.typicalCargoes || "",
      "Avg Shipment Size": c.averageShipmentSize || "",
      "Shipment Freq": c.shipmentFrequency || "",
      "Trading Routes": c.tradingRoutes || "",
      "Contract Type": c.contractType || "",
      "Historical Volume": c.historicalVolume || "",
      "Competitors": c.competitors || "",
      "Project Name": c.projectName || "",
      "Project Start": c.projectTimelineStart ? new Date(c.projectTimelineStart).toLocaleDateString() : "",
      "Project End": c.projectTimelineEnd ? new Date(c.projectTimelineEnd).toLocaleDateString() : "",
      "EPC Contractor": c.epcContractor || "",
      "Special Reqs": c.specialRequirements || "",
      "Risk Notes": c.riskNotes || "",
      "Lead Source": c.leadSource || "",
      "Current Status": c.currentStatus || "",
      "Opportunity Value": c.opportunityValue || "",
      "Follow-up Date": c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : "",
      "Notes": c.notes || "",
      "Follow-up Status": c.followupStatus || "",
      "Pref Load Ports": c.preferredLoadPorts || "",
      "Pref Discharge Ports": c.preferredDischargePorts || "",
      "Demurrage Terms": c.demurrageTerms || "",
      "Pref Agents": c.preferredAgents || "",
      "Incoterms": c.incoterms || "",
      "Category": c.category || "",
      "Created At": c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""
    }));

    exportToExcel(exportData, "Sales_Report", clientDropdownOptions);
  };

  const generateEmployeeReport = async () => {
    let data = await employeeService.getEmployees();
    let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

    if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
    if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
    if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
    if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
    if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
    if (minExperience !== "") {
      const minYears = parseFloat(minExperience);
      if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
    }
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      empList = empList.filter(e => {
        const date = e.doj ? new Date(e.doj) : new Date(e.createdAt);
        return date >= start && date <= end;
      });
    }

    if (empList.length === 0) { alert("No data found for the selected filters."); return; }

    const exportData = empList.map(e => ({
      "Employee ID": e.employeeId || "",
      "Name": e.employeeName || "",
      "Mobile": e.mobile || "",
      "Email": e.emailId || "",
      "Role": e.role || "",
      "Designation": e.designation || "",
      "Department": e.department || "",
      "Office Location": e.office || "",
      "Country (Nationality)": e.nationality || "",
      "DOJ (Date of Joining)": e.doj ? new Date(e.doj).toLocaleDateString('en-GB') : "",
      "Years of Experience": e.totalYearsExperience != null ? e.totalYearsExperience : 0,
      "Status": e.employeeStatus || e.attendance || "",
      "Created At": e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ""
    }));

    exportToExcel(exportData, "Employee_Report", employeeDropdownOptions);
  };

  const exportToExcel = (data, fileName, dropdownOptions) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws, "Report Data");

    if (dropdownOptions) {
      const legendRows = [];
      Object.keys(dropdownOptions).forEach(key => {
        legendRows.push({ "Field": key.toUpperCase(), "Options": "" });
        dropdownOptions[key].forEach(opt => legendRows.push({ "Field": "", "Options": opt }));
        legendRows.push({ "Field": "", "Options": "" });
      });
      const wsLegend = XLSX.utils.json_to_sheet(legendRows);
      XLSX.utils.book_append_sheet(wb, wsLegend, "Dropdown Options");
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(dataBlob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Generate a Report</div>
            <div className={styles["dashboard-profile"]}>
              <NotificationBell />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>{userRole?.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Reports</div>
          </div>
        </section>

        <section className={styles["main-content"]}>
          <div className={styles["report-container"]}>
            <div className={styles["report-header"]}>
              <div className={styles["report-title"]}>Generate Reports</div>
              <div className={styles["report-actions"]}>
                <button className={styles["cancel-button"]} onClick={handleCancel}>Cancel</button>
                <button className={styles["generate-button"]} onClick={handleGenerateReport} disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles["report-form"]}>
            <div className={styles["form-section"]}>

              {/* Report Type */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Type of Report</div>
                <div className={styles["form-field"]}>
                  <select
                    className={styles["select-field"]}
                    value={reportType}
                    onChange={e => {
                      setReportType(e.target.value);
                      setLeadType("All");
                      setFollowupStatus("All");
                      setEmployeeStatus("All");
                      setFilterDepartment("All");
                      setFilterRole("All");
                      setFilterOffice("All");
                      setFilterCountry("All");
                      setMinExperience("");
                    }}
                  >
                    <option value="">Select type</option>
                    {reportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              {/* Sales Report Filters */}
              {reportType === "Sales Report" && (
                <>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Lead Type</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={leadType} onChange={e => setLeadType(e.target.value)}>
                        {leadTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Follow-up Status</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={followupStatus} onChange={e => setFollowupStatus(e.target.value)}>
                        {followupStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>
                </>
              )}

              {/* Employee Report Filters */}
              {reportType === "Employee Report" && (
                <>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Status</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={employeeStatus} onChange={e => setEmployeeStatus(e.target.value)}>
                        {employeeStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Department</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
                        {uniqueDepartments.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Role</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                        {uniqueRoles.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Office Location</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterOffice} onChange={e => setFilterOffice(e.target.value)}>
                        {uniqueOffices.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Country (Nationality)</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
                        {uniqueCountries.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>

                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Min Years of Experience</div>
                    <div className={styles["form-field"]}>
                      <input
                        type="number"
                        className={styles["date-field"]}
                        style={{ width: "100%" }}
                        placeholder="e.g. 2"
                        value={minExperience}
                        onChange={e => setMinExperience(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles["divider-line"]}></div>
                </>
              )}

              {/* Date Range */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={styles["form-field"]} style={{ display: 'flex', gap: '8px' }}>
                  <input className={styles["date-field"]} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <input className={styles["date-field"]} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              {/* Format */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Format</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={format} onChange={e => setFormat(e.target.value)}>
                    <option value="">Select a format</option>
                    {formats.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {error && <div className={styles["error-message"]} style={{ color: 'red', marginTop: '10px' }}>{error}</div>}

            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Reports;
