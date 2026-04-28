import React, { useState, useEffect } from "react";
import EmployeeService from "../../services/EmployeeService";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./LeaveForm.css"; // Reusing the shared clean modal styles

function LeaveApplicationFormModal({ isOpen, onClose, leaveRequest, allLeaveRequests }) {
    const [employeeDetails, setEmployeeDetails] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [expandedYear, setExpandedYear] = useState(null);

    useEffect(() => {
        if (!isOpen || !leaveRequest) return;
        
        const fetchEmployee = async () => {
            setIsLoading(true);
            try {
                const emp = leaveRequest.employee;
                const empIdToFetch = emp?._id || emp;
                
                if (empIdToFetch && String(empIdToFetch).length === 24) {
                    const data = await EmployeeService.getEmployee(empIdToFetch);
                    if (data) setEmployeeDetails(data);
                } else if (leaveRequest.employeeName) {
                    // Fallback to name search if ID is not a Mongo ID
                    const allEmps = await EmployeeService.getEmployees();
                    const match = allEmps.find(e => e.employeeName === leaveRequest.employeeName);
                    if (match) setEmployeeDetails(match);
                }
            } catch (error) {
                console.error("Error fetching employee details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEmployee();
    }, [isOpen, leaveRequest]);

    if (!isOpen || !leaveRequest) return null;

    const employee = Object.keys(employeeDetails).length ? employeeDetails : (leaveRequest.employee || {});
    const leaveStats = calculateLeaveBalance(employee, allLeaveRequests);
    
    // Get last 5 years history
    const currentYear = 2026;
    const years = [2026, 2025, 2024, 2023, 2022];
    
    const empNameSearch = String(employee.employeeName || employee.name || "").toLowerCase().trim();
    
    const employeeLeaves = (allLeaveRequests || []).filter(req => {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        return (reqName === empNameSearch) && (req.status === "Approved" || req.status === "HOD Approved");
    });

    const getYearlyTotal = (year) => {
        return employeeLeaves
            .filter(req => new Date(req.startDate).getFullYear() === year)
            .reduce((total, req) => {
                const s = new Date(req.startDate);
                const e = new Date(req.endDate);
                return total + (Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
            }, 0);
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleDownloadExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leave Report');
        
        worksheet.columns = [
            { header: 'Year', key: 'year', width: 15 },
            { header: 'Leaves Taken (Days)', key: 'days', width: 25 }
        ];

        years.forEach(year => {
            worksheet.addRow({ year, days: getYearlyTotal(year) });
        });

        worksheet.addRow({});
        worksheet.addRow({ year: 'TOTAL TAKEN', days: leaveStats.totalTaken });
        worksheet.addRow({ year: 'ENTITLEMENT', days: leaveStats.entitlement });
        worksheet.addRow({ year: 'BALANCE', days: leaveStats.balance });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Leave_Report_${empNameSearch.replace(/\s+/g, '_')}.xlsx`);
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 100000 }}>
            <div className="leave-modal-container" style={{ maxWidth: "800px" }}>
                <div className="leave-modal-header">
                    <div>
                        <h2 className="leave-modal-title">Employee Leave Overview</h2>
                        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748b" }}>
                            Detailed leave records and balance for <strong>{employee.employeeName || leaveRequest.employeeName}</strong>
                        </p>
                    </div>
                    <button className="leave-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="leave-modal-content" style={{ background: "#f8fafc" }}>
                    {/* Summary Metrics */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total Entitlement</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>{leaveStats.entitlement} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Last 5 years (Capped)</span>
                        </div>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Expired / Unavailable</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#9a3412", marginTop: "4px" }}>{leaveStats.expiredDays} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Older than 5 years</span>
                        </div>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total Taken</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444", marginTop: "4px" }}>{leaveStats.totalTaken} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>In last 5 years</span>
                        </div>
                    </div>

                    {/* Airfare Benefit Box */}
                    <div style={{ 
                        background: leaveRequest.requestAirfare ? "#f0fdf4" : "#f8fafc", 
                        padding: "16px 20px", 
                        borderRadius: "12px", 
                        border: `1px solid ${leaveRequest.requestAirfare ? "#bbf7d0" : "#e2e8f0"}`,
                        marginBottom: "24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <div>
                            <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>AIRFARE CLAIM STATUS</div>
                            <div style={{ fontSize: "18px", fontWeight: "800", color: leaveRequest.requestAirfare ? "#166534" : "#475569" }}>
                                {leaveRequest.requestAirfare ? "YES - COMPANY TICKET REQUESTED" : "NO - PERSONAL TICKET / OWN EXPENSE"}
                            </div>
                        </div>
                        <div style={{ 
                            padding: "8px 16px", 
                            borderRadius: "20px", 
                            background: leaveRequest.requestAirfare ? "#16a34a" : "#94a3b8",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: "700"
                        }}>
                            {leaveRequest.requestAirfare ? "COMPANY PAY" : "SELF PAY"}
                        </div>
                    </div>

                    {/* Yearly History Table */}
                    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Leave History (Last 5 Years)</h3>
                            <button 
                                onClick={handleDownloadExcel}
                                style={{ fontSize: "12px", color: "#007aff", background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}
                            >
                                Download Excel Report
                            </button>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                    <th style={{ textAlign: "left", padding: "12px 20px", fontSize: "12px", fontWeight: "600", color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>YEAR</th>
                                    <th style={{ textAlign: "right", padding: "12px 20px", fontSize: "12px", fontWeight: "600", color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>LEAVES TAKEN</th>
                                    <th style={{ textAlign: "right", padding: "12px 20px", fontSize: "12px", fontWeight: "600", color: "#64748b", borderBottom: "1px solid #f1f5f9" }}>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {years.map(year => {
                                    const total = getYearlyTotal(year);
                                    const yearLeaves = employeeLeaves.filter(req => new Date(req.startDate).getFullYear() === year);
                                    const isExpanded = expandedYear === year;
                                    return (
                                        <React.Fragment key={year}>
                                            <tr style={{ borderBottom: "1px solid #f1f5f9", cursor: total > 0 ? "pointer" : "default" }} onClick={() => total > 0 && setExpandedYear(isExpanded ? null : year)}>
                                                <td style={{ padding: "12px 20px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>{year}</td>
                                                <td style={{ padding: "12px 20px", fontSize: "14px", textAlign: "right", color: total > 0 ? "#007aff" : "#94a3b8", textDecoration: total > 0 ? "underline" : "none" }}>
                                                    {total} Days
                                                </td>
                                                <td style={{ padding: "12px 20px", fontSize: "12px", textAlign: "right" }}>
                                                    <span style={{ 
                                                        padding: "4px 8px", 
                                                        borderRadius: "4px", 
                                                        background: total > 30 ? "#fef2f2" : "#f0fdf4",
                                                        color: total > 30 ? "#ef4444" : "#16a34a",
                                                        fontWeight: "600"
                                                    }}>
                                                        {total > 30 ? "Exceeded" : "Within Limit"}
                                                    </span>
                                                </td>
                                            </tr>
                                            {isExpanded && yearLeaves.length > 0 && (
                                                <tr>
                                                    <td colSpan="3" style={{ padding: "0" }}>
                                                        <div style={{ background: "#f8fafc", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                                                            <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#475569", textTransform: "uppercase" }}>Leave Details for {year}</h4>
                                                            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                                                <thead>
                                                                    <tr style={{ background: "#f1f5f9" }}>
                                                                        <th style={{ padding: "10px 16px", fontSize: "11px", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>TYPE</th>
                                                                        <th style={{ padding: "10px 16px", fontSize: "11px", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>DATES</th>
                                                                        <th style={{ padding: "10px 16px", fontSize: "11px", textAlign: "right", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>DURATION</th>
                                                                        <th style={{ padding: "10px 16px", fontSize: "11px", textAlign: "center", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>AIRFARE</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {yearLeaves.map(leave => (
                                                                        <tr key={leave._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#334155" }}>{leave.leaveType || 'Annual'}</td>
                                                                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#334155" }}>
                                                                                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                                                                            </td>
                                                                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#334155", textAlign: "right" }}>
                                                                                {Math.round((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1} Days
                                                                            </td>
                                                                            <td style={{ padding: "10px 16px", fontSize: "12px", textAlign: "center" }}>
                                                                                <span style={{
                                                                                    padding: "4px 8px",
                                                                                    borderRadius: "4px",
                                                                                    background: leave.requestAirfare ? "#dcfce7" : "#f1f5f9",
                                                                                    color: leave.requestAirfare ? "#166534" : "#64748b",
                                                                                    fontWeight: "600",
                                                                                    display: "inline-block"
                                                                                }}>
                                                                                    {leave.requestAirfare ? "COMPANY" : "NONE"}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: "20px", padding: "16px", background: "#fffbeb", borderRadius: "12px", border: "1px solid #fef3c7", fontSize: "13px", color: "#92400e" }}>
                        <strong>Note:</strong> Records are calculated from the joined date (<strong>{employee.doj ? new Date(employee.doj).toLocaleDateString() : 'N/A'}</strong>). 
                        The standard entitlement is 30 days per calendar year.
                    </div>
                </div>

                <div className="leave-modal-footer">
                    <button className="leave-btn-secondary" onClick={onClose}>Close Overview</button>
                    <button className="leave-btn-primary" onClick={() => window.print()}>Print Summary</button>
                </div>
            </div>
        </div>
    );
}

export default LeaveApplicationFormModal;
