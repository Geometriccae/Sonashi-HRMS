import React, { useState, useEffect } from "react";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";

import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import ProfileAvatar from "../components/ProfileAvatar";
import clientService from "../services/ClientService";
import config from "../config/config";
import NotificationBell from "../components/NotificationBell";

function Reports() {
  const [username, setUsername] = useState("");
   const [userRole, setUserRole] = useState("");
  const [reportType, setReportType] = useState("");
  const [format, setFormat] = useState("");
  const [dateRange, setDateRange] = useState("10/07/2025");
  const [enableAnalytics, setEnableAnalytics] = useState(true);
  const [isReportTypeDropdownOpen, setIsReportTypeDropdownOpen] =
    useState(false);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [followupStatus, setFollowupStatus] = useState("");
  const [isFollowupStatusDropdownOpen, setIsFollowupStatusDropdownOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  const reportTypes = [
    "Sales Report",
    "Client Report",
    "Team Performance Report",
    "Financial Report",
  ];

  const formats = ["PDF", "Excel", "CSV"];

  const followupStatusOptions = [
    "All",
    "Contacted",
    "Needs Analysis",
    "Demo Scheduled",
    "Proposal Sent",
    "Completed",
    "Pending",
    "Progress",
    "Won",
    "Lost",
  ];

  const handleGenerateReport = async () => {
    // Only proceed if format selected
    if (!format) {
      alert('Please select a format (PDF, Excel, CSV).');
      return;
    }

    // Map Sales Report to clients/leads dataset
    if (reportType === 'Sales Report' || reportType === 'Client Report' || reportType === 'Sales') {
      // Ensure data is loaded for current filters
      if (!results || results.length === 0) {
        await fetchByFollowupStatus(followupStatus, startDate, endDate);
      }

      // Export in selected format
      if (format === 'CSV') {
        exportCSV();
      } else if (format === 'Excel') {
        // Use CSV for Excel-compatible export
        exportCSV();
      } else if (format === 'PDF') {
        exportPDF();
      } else {
        alert('Unsupported format selected.');
      }
      return;
    }

    alert('Selected report type is not implemented yet. Choose Sales Report.');
  };

  const handleCancel = () => {
    setReportType("");
    setFormat("");
    setDateRange("10/07/2025");
    setEnableAnalytics(true);
    setFollowupStatus("");
    setResults([]);
    setError("");
    setStartDate("");
    setEndDate("");
  };

  const fetchByFollowupStatus = async (status, sDate, eDate) => {
    // If no filters at all, clear results
    if ((!status || status === 'All') && !sDate && !eDate) {
      setResults([]);
      return;
    }
    try {
      setLoading(true);
      setError("");

      // Treat "All" as no status filter
      const filterStatus = status === 'All' ? undefined : status;

      // First try clientService helper if available
      if (clientService && typeof clientService.getClientsByFollowupStatus === "function") {
        try {
          const data = await clientService.getClientsByFollowupStatus(filterStatus, sDate, eDate);
          // normalize response to array
          if (Array.isArray(data)) {
            setResults(data);
            return;
          } else if (data && Array.isArray(data.clients)) {
            setResults(data.clients);
            return;
          } else if (data && Array.isArray(data.data)) {
            setResults(data.data);
            return;
          } else {
            console.warn("clientService returned unexpected shape, falling back to direct fetch", data);
            throw new Error("fallback");
          }
        } catch (svcErr) {
          console.warn("clientService failed or returned unexpected data, falling back:", svcErr);
          // continue to fallback
        }
      }

      // Fallback: direct fetch to backend /api/clients with query params
      const params = new URLSearchParams();
      if (filterStatus) params.append("followupStatus", filterStatus);
      if (sDate) params.append("startDate", sDate);
      if (eDate) params.append("endDate", eDate);

      // Build API base reliably
      let apiBase = (config.API_BASE_URL || "").replace(/\/+$/, "");
      if (!apiBase.endsWith("/api")) apiBase = `${apiBase}/api`;
      const url = `${apiBase}/clients${params.toString() ? `?${params.toString()}` : ""}`;

      const token = localStorage.getItem("token");
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to fetch clients: ${resp.status} ${resp.statusText} - ${text.slice(0,200)}`);
      }

      const json = await resp.json();
      if (Array.isArray(json)) {
        setResults(json);
      } else if (json && Array.isArray(json.clients)) {
        setResults(json.clients);
      } else if (json && Array.isArray(json.data)) {
        setResults(json.data);
      } else {
        setResults(Array.isArray(json) ? json : []);
      }
    } catch (e) {
      console.error("fetchByFollowupStatus error:", e);
      setError(e.message || "Failed to fetch data");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!results || results.length === 0) {
      alert('No data available to export. Please select a status/date range and fetch data first.');
      return;
    }

    const headers = ["Company","Email","Phone","Follow-up Status","Created"];
    const rows = (results || []).map(c => {
      const email = (c.email || c.emailId || '') ;
      const phone = (c.phone || c.mobile || c.phoneNumber || '');
      const created = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
      return [
        c.companyName || c.clientName || '',
        email,
        phone,
        c.followupStatus || '',
        created
      ];
    });

    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const statusPart = followupStatus ? `_${followupStatus.replace(/\s+/g,'_')}` : '';
    a.download = `clients_report${statusPart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    const title = followupStatus ? `Clients - ${followupStatus}` : 'Clients';
    const rows = (results || []).map(c => `
      <tr>
        <td>${c.companyName || ''}</td>
        <td>${c.email || ''}</td>
        <td>${c.phone || ''}</td>
        <td>${c.followupStatus || ''}</td>
        <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</td>
      </tr>`).join('');
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        body{font-family:Arial;padding:16px}
        h1{font-size:18px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:8px;text-align:left}
        th{background:#f5f5f5}
      </style>
      </head><body>
      <h1>${title}</h1>
      <table>
        <thead><tr><th>Company</th><th>Email</th><th>Phone</th><th>Follow-up Status</th><th>Created</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
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
                     <div className={styles["profile-name"]}>
                       {username?.toUpperCase()}
                     </div>
                     <div className={styles["profile-type"]}>
                                          {userRole?.toUpperCase()}
                                        </div>
                   </div>
                 </div>
                 <img src={chevrondown} alt="" />
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
                <button
                  className={styles["cancel-button"]}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className={styles["generate-button"]}
                  onClick={handleGenerateReport}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
          <div className={styles["report-form"]}>
            <div className={styles["form-section"]}>
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>
                  Select Type of Report
                </div>
                <div className={styles["form-field"]}>
                  <div
                    className={styles["dropdown-field"]}
                    onClick={() =>
                      setIsReportTypeDropdownOpen(!isReportTypeDropdownOpen)
                    }
                  >
                    <span
                      className={
                        reportType
                          ? styles["field-text"]
                          : styles["field-placeholder"]
                      }
                    >
                      {reportType || "Select type"}
                    </span>
                    <svg
                      className={styles["dropdown-icon"]}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="#98A1B0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {isReportTypeDropdownOpen && (
                      <div className={styles["dropdown-menu"]}>
                        {reportTypes.map((type) => (
                          <div
                            key={type}
                            className={styles["dropdown-item"]}
                            onClick={() => {
                              setReportType(type);
                              setIsReportTypeDropdownOpen(false);
                            }}
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Follow-up Status</div>
                <div className={styles["form-field"]}>
                  <div
                    className={styles["dropdown-field"]}
                    onClick={() =>
                      setIsFollowupStatusDropdownOpen(!isFollowupStatusDropdownOpen)
                    }
                  >
                    <span
                      className={
                        followupStatus
                          ? styles["field-text"]
                          : styles["field-placeholder"]
                      }
                    >
                      {followupStatus || "Select follow-up status"}
                    </span>
                    <svg
                      className={styles["dropdown-icon"]}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="#98A1B0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {isFollowupStatusDropdownOpen && (
                      <div className={styles["dropdown-menu"]}>
                        {followupStatusOptions.map((s) => (
                          <div
                            key={s}
                            className={styles["dropdown-item"]}
                            onClick={() => {
                              setFollowupStatus(s);
                              setIsFollowupStatusDropdownOpen(false);
                              fetchByFollowupStatus(s, startDate, endDate);
                            }}
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={styles["form-field"]} style={{ display: 'flex', gap: '8px' }}>
                  <input className={styles["date-field"]} type="date" value={startDate} onChange={e => {
                    setStartDate(e.target.value);
                    fetchByFollowupStatus(followupStatus, e.target.value, endDate);
                  }} />
                  <input className={styles["date-field"]} type="date" value={endDate} onChange={e => {
                    setEndDate(e.target.value);
                    fetchByFollowupStatus(followupStatus, startDate, e.target.value);
                  }} />
                </div>
              </div>
<div className={styles["divider-line"]}></div>

              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Format</div>
                <div className={styles["form-field"]}>
                  <div
                    className={styles["dropdown-field"]}
                    onClick={() =>
                      setIsFormatDropdownOpen(!isFormatDropdownOpen)
                    }
                  >
                    <span
                      className={
                        format
                          ? styles["field-text"]
                          : styles["field-placeholder"]
                      }
                    >
                      {format || "Select a format"}
                    </span>
                    <svg
                      className={styles["dropdown-icon"]}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="#98A1B0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {isFormatDropdownOpen && (
                      <div className={styles["dropdown-menu"]}>
                        {formats.map((format) => (
                          <div
                            key={format}
                            className={styles["dropdown-item"]}
                            onClick={() => {
                              setFormat(format);
                              setIsFormatDropdownOpen(false);
                            }}
                          >
                            {format}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles["divider-line"]}></div>

              {/* <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={styles["form-field"]}>
                  <div className={styles["date-field"]}>
                    <span className={styles["field-text"]}>{dateRange}</span>
                    <svg
                      className={styles["calendar-icon"]}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M5.33333 1.33398V4.00065M10.6667 1.33398V4.00065M2 6.66732H14M3.33333 2.66732H12.6667C13.403 2.66732 14 3.26427 14 4.00065V13.334C14 14.0704 13.403 14.6673 12.6667 14.6673H3.33333C2.59695 14.6673 2 14.0704 2 13.334V4.00065C2 3.26427 2.59695 2.66732 3.33333 2.66732Z"
                        stroke="#98A1B0"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className={styles["divider-line"]}></div> */}

              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Additional Settings</div>
                <div className={styles["form-field"]}>
                  <div className={styles["checkbox-container"]}>
                    <div
                      className={`${styles["checkbox"]} ${
                        enableAnalytics ? styles["checkbox-checked"] : ""
                      }`}
                      onClick={() => setEnableAnalytics(!enableAnalytics)}
                    >
                      {enableAnalytics && (
                        <svg
                          className={styles["checkbox-check"]}
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M1.875 6.75L4.5 9.375L10.5 3.375"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className={styles["checkbox-content"]}>
                      <div className={styles["checkbox-title"]}>
                        Enable Analytics
                      </div>
                      <div className={styles["checkbox-description"]}>
                        Pictorial Graphs will be generated
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Section removed. Use Generate button and selected format for export. */}
        </section>
      </main>
    </div>
  );
}

export default Reports;
