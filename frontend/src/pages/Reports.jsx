import React, { useState, useEffect } from "react";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";

import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";

function Reports() {
  const [username, setUsername] = useState("");
  const [reportType, setReportType] = useState("");
  const [format, setFormat] = useState("");
  const [dateRange, setDateRange] = useState("10/07/2025");
  const [enableAnalytics, setEnableAnalytics] = useState(true);
  const [isReportTypeDropdownOpen, setIsReportTypeDropdownOpen] =
    useState(false);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
  }, []);

  const reportTypes = [
    "Sales Report",
    "Client Report",
    "Team Performance Report",
    "Financial Report",
  ];

  const formats = ["PDF", "Excel", "CSV"];

  const handleGenerateReport = () => {
    console.log("Generating report:", {
      type: reportType,
      format: format,
      dateRange: dateRange,
      analytics: enableAnalytics,
    });
    // Add report generation logic here
  };

  const handleCancel = () => {
    setReportType("");
    setFormat("");
    setDateRange("10/07/2025");
    setEnableAnalytics(true);
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Generate a Report</div>

            <div className={styles["dashboard-profile"]}>
              <img
                src={belldot}
                alt="belldot"
                className={styles["belldot-icon"]}
              />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <img
                    src={admindemo}
                    alt=""
                    className={styles["profile-picture"]}
                  />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>
                      {username?.toUpperCase()}
                    </div>
                    <div className={styles["profile-type"]}>Administrator</div>
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

              <div className={styles["form-row"]}>
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

              <div className={styles["divider-line"]}></div>

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
        </section>
      </main>
    </div>
  );
}

export default Reports;
