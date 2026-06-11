import React, { useState, useEffect } from "react";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import DateInput from "../components/DateInput";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";

function Reports() {
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
  const [minExperience, setMinExperience] = useState("All");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterYear, setFilterYear] = useState("All");

  const monthsList = ["All", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentYear = new Date().getFullYear();
  const yearsList = ["All"];
  for (let i = 0; i < 15; i++) {
    yearsList.push((currentYear - i).toString());
  }

  // Dynamic dropdown list selectors
  const [uniqueDepartments, setUniqueDepartments] = useState(["All"]);
  const [uniqueRoles, setUniqueRoles] = useState(["All"]);
  const [uniqueOffices, setUniqueOffices] = useState(["All"]);
  const [uniqueCountries, setUniqueCountries] = useState(["All"]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preview States
  const [previewData, setPreviewData] = useState([]);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployeesList();
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

  const reportTypes = [
    "Leave Report",
    "Airfare Report",
    "Increment report",
    "Document expiry",
    "Salary report"
  ];
  const formats = ["Excel", "PDF"];

  const leadTypeOptions = ["All", "Lead", "Client"];
  const followupStatusOptions = [
    "All", "Completed", "Contacted", "Demo Scheduled", "Lost",
    "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"
  ];
  const employeeStatusOptions = ["All", "Active", "InActive"];
  const minExperienceOptions = ["All", ...Array.from({ length: 21 }, (_, i) => String(i))];

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
    setMinExperience("All");
    setStartDate("");
    setEndDate("");
    setFilterMonth("All");
    setFilterYear("All");
    setError("");
    setPreviewData([]);
    setPreviewHeaders([]);
    setShowPreview(false);
  };

  const fetchReportData = async (type) => {
    const hasDateFilter = (startDate && endDate) || filterMonth !== "All" || filterYear !== "All";

    const isDateMatch = (dateVal) => {
      if (!dateVal) return false;
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return false;

      let match = true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date < start || date > end) match = false;
      }
      if (filterMonth !== "All") {
        const monthMap = { "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5, "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11 };
        if (date.getMonth() !== monthMap[filterMonth]) match = false;
      }
      if (filterYear !== "All") {
        if (date.getFullYear().toString() !== filterYear) match = false;
      }
      return match;
    };

    if (type === "Leave Report") {
      let leaves = await leaveRequestService.getLeaveRequests();
      leaves = Array.isArray(leaves) ? leaves : (leaves.data || []);

      if (filterDepartment !== "All") {
        leaves = leaves.filter(l => l.department === filterDepartment);
      }

      if (hasDateFilter) {
        leaves = leaves.filter(l => isDateMatch(l.appliedOn || l.createdAt));
      }

      return leaves.map(l => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        return {
          "Employee Name": l.employeeName || "",
          "Company": l.company || "",
          "Department": l.department || "",
          "Reporting Manager": l.reportingManager || "",
          "Leave Type": l.leaveType || "",
          "Start Date": l.startDate ? new Date(l.startDate).toLocaleDateString('en-GB') : "",
          "End Date": l.endDate ? new Date(l.endDate).toLocaleDateString('en-GB') : "",
          "Duration (Days)": isNaN(durationDays) ? 0 : durationDays,
          "Status": l.status || "",
          "Applied On": l.appliedOn ? new Date(l.appliedOn).toLocaleDateString('en-GB') : "",
          "Request Airfare": l.requestAirfare ? "Yes" : "No",
          "Airfare Status": l.airfareStatus || "",
          "Reason": l.reason || ""
        };
      });
    }

    if (type === "Airfare Report") {
      let data = await employeeService.getEmployeesList();
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      if (minExperience !== "All") {
        const minYears = parseFloat(minExperience);
        if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
      }
      if (hasDateFilter) {
        empList = empList.filter(e => isDateMatch(e.travellingDate));
      }

      return empList.map(e => ({
        "Employee ID": e.employeeId || "",
        "Name": e.employeeName || "",
        "Department": e.department || "",
        "Role": e.role || "",
        "Office Location": e.office || "",
        "Airfare Eligible": e.airFare ? "Yes" : "No",
        "Last Working Day": e.lastWorkingDay ? new Date(e.lastWorkingDay).toLocaleDateString('en-GB') : "Not set",
        "Travelling Date": e.travellingDate ? new Date(e.travellingDate).toLocaleDateString('en-GB') : "Not set",
        "First Working Day": e.firstWorkingDay ? new Date(e.firstWorkingDay).toLocaleDateString('en-GB') : "",
        "Passport No": e.passportNo || "",
        "Passport Expiry": e.passportExpiryDate ? new Date(e.passportExpiryDate).toLocaleDateString('en-GB') : ""
      }));
    }

    if (type === "Increment report") {
      let data = await employeeService.getEmployeesList();
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      if (minExperience !== "All") {
        const minYears = parseFloat(minExperience);
        if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
      }

      let incrementRows = [];
      empList.forEach(e => {
        if (Array.isArray(e.increments) && e.increments.length > 0) {
          e.increments.forEach(inc => {
            incrementRows.push({
              employeeId: e.employeeId,
              name: e.employeeName,
              department: e.department,
              role: e.role,
              date: inc.date,
              previousSalary: inc.previousSalary,
              incrementAmount: inc.incrementAmount,
              newSalary: inc.newSalary,
              reason: inc.reason
            });
          });
        }
      });

      if (hasDateFilter) {
        incrementRows = incrementRows.filter(row => isDateMatch(row.date));
      }

      return incrementRows.map(row => ({
        "Employee ID": row.employeeId || "",
        "Name": row.name || "",
        "Department": row.department || "",
        "Role": row.role || "",
        "Increment Date": row.date ? new Date(row.date).toLocaleDateString('en-GB') : "",
        "Previous Salary": row.previousSalary || 0,
        "Increment Amount": row.incrementAmount || 0,
        "New Salary": row.newSalary || 0,
        "Reason/Remarks": row.reason || ""
      }));
    }

    if (type === "Document expiry") {
      let data = await employeeService.getEmployeesList();
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      if (minExperience !== "All") {
        const minYears = parseFloat(minExperience);
        if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
      }

      if (hasDateFilter) {
        empList = empList.filter(e => {
          return isDateMatch(e.passportExpiryDate) || isDateMatch(e.visaExpiryDate) || isDateMatch(e.labourCardExpiryDate);
        });
      }

      const today = new Date();
      const getStatus = (expiryDate) => {
        if (!expiryDate) return "N/A";
        const exp = new Date(expiryDate);
        const diffTime = exp - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return "EXPIRED";
        if (diffDays <= 30) return "Expiring in < 30 Days";
        if (diffDays <= 90) return "Expiring in < 90 Days";
        return "Active / Valid";
      };

      return empList.map(e => {
        const passportStatus = getStatus(e.passportExpiryDate);
        const visaStatus = getStatus(e.visaExpiryDate);
        const laborStatus = getStatus(e.labourCardExpiryDate);

        return {
          "Employee ID": e.employeeId || "",
          "Name": e.employeeName || "",
          "Department": e.department || "",
          "Role": e.role || "",
          "Passport No": e.passportNo || "",
          "Passport Expiry": e.passportExpiryDate ? new Date(e.passportExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Passport Status": passportStatus,
          "Visa Expiry": e.visaExpiryDate ? new Date(e.visaExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Visa Status": visaStatus,
          "Labour Card Expiry": e.labourCardExpiryDate ? new Date(e.labourCardExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Labour Card Status": laborStatus
        };
      });
    }

    if (type === "Salary report") {
      let data = await employeeService.getEmployeesList();
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      if (minExperience !== "All") {
        const minYears = parseFloat(minExperience);
        if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
      }

      return empList.map(e => {
        const sal = e.salaryDetails || {};
        return {
          "Employee ID": e.employeeId || "",
          "Name": e.employeeName || "",
          "Department": e.department || "",
          "Role": e.role || "",
          "Basic Salary": sal.basicSalary || 0,
          "House Rent Allowance": sal.houseRent || 0,
          "Travel Allowance": sal.travelExp || 0,
          "Other Allowance": sal.other || 0,
          "Total Allowance": sal.totalAllowance || 0,
          "Deduction": sal.deduction || 0,
          "Total / Net Salary": sal.totalSalary || 0,
          "Bank Name": sal.bankName || "",
          "Account Number": sal.accountNumber || "",
          "IBAN": sal.ibanNumber || "",
          "Sort Code": sal.bankSortCode || ""
        };
      });
    }

    return [];
  };

  const handlePreview = async () => {
    if (!reportType) { alert("Please select a report type."); return; }
    setLoading(true);
    setError("");
    setPreviewData([]);
    setPreviewHeaders([]);
    setShowPreview(false);

    try {
      const data = await fetchReportData(reportType);
      if (data.length === 0) {
        alert("No data found for the selected filters.");
        return;
      }
      setPreviewData(data);
      setPreviewHeaders(Object.keys(data[0]));
      setShowPreview(true);
    } catch (err) {
      console.error("Preview generation failed:", err);
      setError("Failed to load preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportType) { alert("Please select a report type."); return; }
    if (!format) { alert("Please select a format."); return; }

    setLoading(true);
    setError("");

    try {
      if (reportType === "Leave Report") {
        await generateLeaveReport();
      } else if (reportType === "Airfare Report") {
        await generateAirfareReport();
      } else if (reportType === "Increment report") {
        await generateIncrementReport();
      } else if (reportType === "Document expiry") {
        await generateDocumentExpiryReport();
      } else if (reportType === "Salary report") {
        await generateSalaryReport();
      }
    } catch (err) {
      console.error("Report generation failed:", err);
      setError("Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateLeaveReport = async () => {
    const exportData = await fetchReportData("Leave Report");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Leave_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Leave_Report");
    }
  };

  const generateAirfareReport = async () => {
    const exportData = await fetchReportData("Airfare Report");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Airfare_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Airfare_Report");
    }
  };

  const generateIncrementReport = async () => {
    const exportData = await fetchReportData("Increment report");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Increment_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Increment_Report");
    }
  };

  const generateDocumentExpiryReport = async () => {
    const exportData = await fetchReportData("Document expiry");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Document_Expiry_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Document_Expiry_Report");
    }
  };

  const generateSalaryReport = async () => {
    const exportData = await fetchReportData("Salary report");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Salary_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Salary_Report");
    }
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

  const exportToPDF = (data, fileName) => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Add title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(fileName.replace("_", " ").toUpperCase(), 14, 15);
    
    // Add subtitle / date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${data.length}`, 14, 21);

    let filteredData = data;

    const headers = Object.keys(filteredData[0]);
    const rows = filteredData.map(item => 
      headers.map(header => 
        item[header] !== null && item[header] !== undefined ? String(item[header]) : ""
      )
    );

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [22, 163, 74], // green color matching the UI #16a34a
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // light grey for alternate rows
      },
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar title="Generate a Report" breadcrumb="Reports" />

        <PageBody as="section" className={styles["main-content"]}>
          <div className={styles.reportCard}>
          <div className={styles["report-container"]}>
            <div className={styles["report-header"]}>
              <div className={styles.reportHeaderText}>
                <div className={styles["report-title"]}>Generate Reports</div>
                <p className={styles.reportSubtitle}>
                  Configure filters below, then preview or download your report.
                </p>
              </div>
              <div className={styles["report-actions"]}>
                <button type="button" className={styles["cancel-button"]} onClick={handleCancel}>Cancel</button>
                <button type="button" className={styles["preview-button"]} onClick={handlePreview} disabled={loading}>
                  {loading ? "Loading..." : "Preview"}
                </button>
                <button type="button" className={styles["generate-button"]} onClick={handleGenerateReport} disabled={loading}>
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
                      setMinExperience("All");
                      setFilterMonth("All");
                      setFilterYear("All");
                    }}
                  >
                    <option value="">Select type</option>
                    {reportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>



              {/* Employee & Leave Report Filters */}
              {(reportType === "Airfare Report" ||
                reportType === "Increment report" ||
                reportType === "Document expiry" ||
                reportType === "Salary report" ||
                reportType === "Leave Report") && (
                <div className={styles.filtersPanel}>
                  {/* Status Filter (Only show for employee reports, not leave report) */}
                  {(reportType !== "Leave Report") && (
                    <>
                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>Status</div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={employeeStatus} onChange={e => setEmployeeStatus(e.target.value)}>
                            {employeeStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
        
                    </>
                  )}

                  {/* Department Filter (Show for all of them) */}
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Department</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
                        {uniqueDepartments.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
    

                  {/* Role/Office/Country/Experience filters (Show only for non-leave reports) */}
                  {(reportType !== "Leave Report") && (
                    <>
                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>Role</div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            {uniqueRoles.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
        

                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>Office Location</div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterOffice} onChange={e => setFilterOffice(e.target.value)}>
                            {uniqueOffices.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
        

                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>Country (Nationality)</div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
                            {uniqueCountries.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      {reportType !== "Document expiry" && (
                        <div className={styles["form-row"]}>
                          <div className={styles["form-label"]}>Min Years of Experience</div>
                          <div className={styles["form-field"]}>
                            <select
                              className={styles["select-field"]}
                              value={minExperience}
                              onChange={e => setMinExperience(e.target.value)}
                            >
                              {minExperienceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
        
                    </>
                  )}
                </div>
              )}

              {reportType === "Document expiry" && (
                <div className={styles["form-row"]}>
                  <div className={styles["form-label"]}>Min Years of Experience</div>
                  <div className={styles["form-field"]}>
                    <select
                      className={styles["select-field"]}
                      value={minExperience}
                      onChange={e => setMinExperience(e.target.value)}
                    >
                      {minExperienceOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className={styles.datePeriodPanel}>
              {/* Date Range */}
              <div className={`${styles["form-row"]} ${styles.dateRangeRow}`}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={`${styles["form-field"]} ${styles.dateRangeGroup}`}>
                  <DateInput className={styles["date-field"]} value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span className={styles.dateRangeSep}>to</span>
                  <DateInput className={styles["date-field"]} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className={styles.periodGroup}>
              {/* Month */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Month</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Year */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Year</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              </div>
              </div>



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

              {error && <div className={styles.errorMessage}>{error}</div>}

            </div>

            {showPreview && previewData.length > 0 && (
              <div className={styles["preview-section"]}>
                <div className={styles["preview-title-row"]}>
                  <div className={styles["report-title"]}>Report Preview ({reportType})</div>
                  <div className={styles["preview-subtitle"]}>Showing {previewData.length} records</div>
                </div>
                <div className={styles["preview-table-container"]}>
                  <table className={styles["preview-table"]}>
                    <thead>
                      <tr>
                        {previewHeaders.map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 15).map((row, idx) => (
                        <tr key={idx}>
                          {previewHeaders.map(h => <td key={h}>{row[h] !== null && row[h] !== undefined ? String(row[h]) : ""}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 15 && (
                  <div className={styles.previewNote}>
                    * Showing first 15 records in preview. Generate Excel/PDF to download all {previewData.length} records.
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

        </PageBody>
      </main>
    </div>
  );
}

export default Reports;
