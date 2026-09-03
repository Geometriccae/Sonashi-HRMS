import React, { useState, useEffect } from "react";
import EmployeeService from "../../services/EmployeeService";
import {
    calculateLeaveBalance,
    calculateLeaveDays,
    filterLeavesForEmployee,
    getApprovedLeavesForEmployee,
} from "../../utils/leaveCalculator";
import { fetchEmployeeLeaveHistory } from "../../utils/fetchEmployeeLeaveHistory";
import { buildLeaveHistoryYears, leaveBelongsToHistoryYear } from "../../utils/yearOptions";
import {
    formatExperienceLabel,
    formatVacationStatusLabel,
    getEffectiveVacationStatus,
} from "../../utils/yetToGoHelpers";
import { saveAs } from "file-saver";
import "./LeaveForm.css"; // Reusing the shared clean modal styles

const formatDisplayDate = (value) => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB");
};

function LeaveApplicationFormModal({ isOpen, onClose, leaveRequest, allLeaveRequests, onEditLeave, canEdit = false }) {
    const [employeeDetails, setEmployeeDetails] = useState({});
    const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedYear, setExpandedYear] = useState(null);

    useEffect(() => {
        if (!isOpen || !leaveRequest) {
            setEmployeeDetails({});
            setEmployeeLeaveHistory([]);
            return;
        }

        const fetchEmployee = async () => {
            setIsLoading(true);
            // Seed from leave-list enrichment so DOJ/manager show immediately for all roles
            if (leaveRequest.employeeMaster && (leaveRequest.employeeMaster.doj || leaveRequest.employeeMaster.employeeId)) {
                setEmployeeDetails(leaveRequest.employeeMaster);
            } else {
                setEmployeeDetails({});
            }
            setEmployeeLeaveHistory([]);
            try {
                const emp = leaveRequest.employee;
                const recordId =
                    leaveRequest.employeeRecordId?._id ||
                    leaveRequest.employeeRecordId ||
                    emp?.employeeId?._id ||
                    emp?.employeeId ||
                    "";
                const empIdToFetch = recordId || emp?._id || emp;

                let resolvedEmp = null;
                if (empIdToFetch && /^[a-fA-F0-9]{24}$/.test(String(empIdToFetch))) {
                    try {
                        const data = await EmployeeService.getEmployee(empIdToFetch);
                        if (data && (data.employeeName || data.employeeId || data.doj)) {
                            resolvedEmp = data;
                            setEmployeeDetails(data);
                        }
                    } catch (err) {
                        // Fall through to list lookup — User._id is not always Employee._id
                        console.warn("Employee by id lookup failed, trying list match:", err?.message || err);
                    }
                }
                if (!resolvedEmp) {
                    const allEmps = await EmployeeService.getEmployeesList({ force: true });
                    const list = Array.isArray(allEmps) ? allEmps : (allEmps?.employees || []);
                    const code = String(leaveRequest.employeeId || leaveRequest.linkedEmployeeCode || "").trim();
                    const name = String(leaveRequest.employeeName || emp?.username || "").toLowerCase().trim();
                    const match =
                        list.find((e) => recordId && String(e._id) === String(recordId)) ||
                        (code && list.find((e) => String(e.employeeId).toLowerCase() === code.toLowerCase())) ||
                        (name && list.find((e) => String(e.employeeName || "").toLowerCase().trim() === name)) ||
                        null;
                    if (match) {
                        resolvedEmp = match;
                        setEmployeeDetails(match);
                    }
                }

                const historyId = resolvedEmp?._id || (recordId && /^[a-fA-F0-9]{24}$/.test(String(recordId)) ? recordId : null);
                if (historyId) {
                    const rows = await fetchEmployeeLeaveHistory(historyId);
                    setEmployeeLeaveHistory(rows);
                }
            } catch (error) {
                console.error("Error fetching employee details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEmployee();
    }, [isOpen, leaveRequest?._id, leaveRequest?.employee, leaveRequest?.employeeId, leaveRequest?.employeeRecordId, leaveRequest?.employeeMaster]);

    if (!isOpen || !leaveRequest) return null;

    // Prefer fetched Employee master; fall back to list enrichment (employeeMaster) so all roles share one source
    const employee = Object.keys(employeeDetails).length
        ? employeeDetails
        : (leaveRequest.employeeMaster || leaveRequest.employee || {});
    const balanceLeaveSource =
        employeeLeaveHistory.length > 0
            ? employeeLeaveHistory
            : Array.isArray(allLeaveRequests)
              ? allLeaveRequests
              : [];
    const employeeLeaveRecords = filterLeavesForEmployee(employee, balanceLeaveSource);
    const leaveStats = calculateLeaveBalance(employee, balanceLeaveSource, leaveRequest?.startDate || new Date());
    const employeeLeaves = getApprovedLeavesForEmployee(employee, balanceLeaveSource);
    const experienceLabel =
        formatExperienceLabel(employee.doj, employee.totalYearsExperience, leaveRequest?.startDate || new Date()) || "N/A";
    const leaveDaysLabel = (() => {
        const days = calculateLeaveDays(leaveRequest.startDate, leaveRequest.endDate, leaveRequest.leaveDays);
        if (days == null || days <= 0) return "—";
        return `${days} ${days === 1 ? "Day" : "Days"}`;
    })();
    const vacationStatus =
        getEffectiveVacationStatus(leaveRequest, employee) ||
        employee.vacationStatus ||
        leaveRequest.status;
    const vacationStatusLabel = formatVacationStatusLabel(vacationStatus) || vacationStatus || "—";

    const years = buildLeaveHistoryYears(employee.doj);

    const getYearlyLeaves = (year) =>
        employeeLeaves.filter((req) => leaveBelongsToHistoryYear(req, year, employee.doj));

    const getYearlyTotal = (year) => {
        if (!leaveStats) return 0;
        const yearEnd = new Date(year, 11, 31);
        const takenStart = leaveStats.takenRangeStart
            ? new Date(leaveStats.takenRangeStart)
            : leaveStats.calculationStartDate
              ? new Date(leaveStats.calculationStartDate)
              : null;
        if (takenStart && yearEnd < takenStart) {
            return leaveStats.historicalYearTotals?.[year] ?? 0;
        }
        return leaveStats.yearTotals?.[year] ?? 0;
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleDownloadExcel = async () => {
        const ExcelJS = (await import("exceljs")).default;
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
        saveAs(new Blob([buffer]), `Leave_Report_${String(employee.employeeName || leaveRequest.employeeName || "employee").replace(/\s+/g, "_")}.xlsx`);
    };

    const detailCell = (label, value) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {label}
            </span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>
                {value || "N/A"}
            </span>
        </div>
    );

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
                    {isLoading && (
                        <div style={{ marginBottom: "16px", fontSize: "13px", color: "#64748b" }}>Loading employee details…</div>
                    )}

                    {/* Employee + current leave request — same information Admin sees when reviewing */}
                    <div style={{
                        background: "#fff",
                        padding: "20px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        marginBottom: "20px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                            <div>
                                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                                    {employee.employeeName || leaveRequest.employeeName || "Unknown"}
                                </div>
                                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                                    {employee.employeeId || leaveRequest.employeeId || leaveRequest.linkedEmployeeCode || "—"}
                                </div>
                            </div>
                            <span style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontSize: "12px",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                            }}>
                                {vacationStatusLabel}
                            </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
                            {detailCell("Date of Joining", formatDisplayDate(employee.doj))}
                            {detailCell("Total Experience", experienceLabel)}
                            {detailCell(
                                "Department",
                                employee.department || leaveRequest.employeeMaster?.department || leaveRequest.department
                            )}
                            {detailCell(
                                "Reporting Manager",
                                employee.reportingManager ||
                                    leaveRequest.employeeMaster?.reportingManager ||
                                    leaveRequest.reportingManager
                            )}
                            {detailCell("Leave Type", leaveRequest.leaveType)}
                            {detailCell("Leave Days", leaveDaysLabel)}
                            {detailCell("Start Date", formatDisplayDate(leaveRequest.startDate))}
                            {detailCell("End Date", formatDisplayDate(leaveRequest.endDate))}
                            {detailCell("Ticket Type", leaveRequest.requestAirfare ? "Company Ticket" : "Personal Ticket")}
                            {detailCell("Leave Status", leaveRequest.status === "Cancelled" ? "Reverted" : leaveRequest.status)}
                            {detailCell("Applied On", formatDisplayDate(leaveRequest.appliedOn))}
                            {detailCell("Reason", leaveRequest.reason)}
                        </div>
                    </div>

                    {/* Summary Metrics — same centralized leaveCalculator as Admin */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total Entitlement</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>{leaveStats.entitlement} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Last 5 years (Capped)</span>
                        </div>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Leave Taken</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444", marginTop: "4px" }}>{leaveStats.totalTaken} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>In last 5 years</span>
                        </div>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Available</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#1d4ed8", marginTop: "4px" }}>{leaveStats.balance} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Entitlement − Taken</span>
                        </div>
                        <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Expired</span>
                            <div style={{ fontSize: "24px", fontWeight: "700", color: "#9a3412", marginTop: "4px" }}>{leaveStats.expiredDays} Days</div>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Older than 5 years</span>
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
                            <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Leave History</h3>
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
                                    const yearLeaves = getYearlyLeaves(year);
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
                                                                                {canEdit && onEditLeave ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            onEditLeave(leave);
                                                                                        }}
                                                                                        title="Click to edit this leave"
                                                                                        style={{
                                                                                            background: "none",
                                                                                            border: "none",
                                                                                            padding: 0,
                                                                                            color: "#2563eb",
                                                                                            fontWeight: 600,
                                                                                            fontSize: "13px",
                                                                                            cursor: "pointer",
                                                                                            textDecoration: "underline",
                                                                                            textAlign: "left",
                                                                                        }}
                                                                                    >
                                                                                        {new Date(leave.startDate).toLocaleDateString('en-GB')} - {new Date(leave.endDate).toLocaleDateString('en-GB')}
                                                                                    </button>
                                                                                ) : (
                                                                                    <>
                                                                                        {new Date(leave.startDate).toLocaleDateString('en-GB')} - {new Date(leave.endDate).toLocaleDateString('en-GB')}
                                                                                    </>
                                                                                )}
                                                                            </td>
                                                                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#334155", textAlign: "right" }}>
                                                                                {calculateLeaveDays(leave.startDate, leave.endDate, leave.leaveDays) || 0} Days
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
                        <strong>Note:</strong> Accrual is 2.5 days per completed month from DOJ (<strong>{employee.doj ? new Date(employee.doj).toLocaleDateString('en-GB') : 'N/A'}</strong>), capped at 150 days for the latest 5-year active window.
                        {employeeLeaveRecords.length === 0 && !isLoading ? (
                            <span> Leave history will appear once employee master records are linked.</span>
                        ) : null}
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
