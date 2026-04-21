import React, { useRef, useState, useEffect } from "react";
import EmployeeService from "../../services/EmployeeService";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./LeaveApplicationFormModal.css";

function LeaveApplicationFormModal({ isOpen, onClose, leaveRequest, allLeaveRequests }) {
    const printRef = useRef();
    const [employeeDetails, setEmployeeDetails] = useState({});

    useEffect(() => {
        if (!isOpen || !leaveRequest) return;
        
        const fetchEmployee = async () => {
            try {
                const emp = leaveRequest.employee;
                const email = emp?.emailId || leaveRequest.userEmail; // Sometimes we might have email
                const employeeNameInRequest = leaveRequest.employeeName;

                // 1. Try fetching by ID link if it exists
                const targetEmpIdRef = emp?.employeeId || emp?._id || emp;
                const empIdStr = targetEmpIdRef?._id ? String(targetEmpIdRef._id) : typeof targetEmpIdRef === "string" ? targetEmpIdRef : null;

                if (empIdStr && empIdStr.length === 24) { // Only if it looks like a Mongo ID
                    try {
                        const data = await EmployeeService.getEmployee(empIdStr);
                        if (data && data.employeeName) {
                            setEmployeeDetails(data);
                            return;
                        }
                    } catch (e) { console.warn("ID fetch failed, trying email", e); }
                }

                // 2. Try fetching by Email
                const targetEmail = email || (emp && typeof emp === 'object' && emp.emailId);
                if (targetEmail) {
                    try {
                        const data = await EmployeeService.getEmployeeByEmail(targetEmail);
                        if (data && data._id) {
                            setEmployeeDetails(data);
                            return;
                        }
                    } catch (e) { console.warn("Email fetch failed, trying name", e); }
                }

                // 3. Last resort: Try getting all and matching by name (only if list is manageable)
                const allEmps = await EmployeeService.getEmployees();
                const match = allEmps.find(e => 
                    e.employeeName === employeeNameInRequest || 
                    (e.emailId && e.emailId === targetEmail)
                );
                if (match) {
                    setEmployeeDetails(match);
                }
            } catch (error) {
                console.error("Critical failure in employee fetch", error);
            }
        };

        fetchEmployee();
    }, [isOpen, leaveRequest]);

    if (!isOpen || !leaveRequest) return null;

    // Use full employee details if fetched, else fallback to whatever is in the request (or basic)
    const employee = Object.keys(employeeDetails).length ? employeeDetails : (leaveRequest.employee || {});
    // Extract employee data
    const empName = employee.employeeName || employee.username || employee.name || "-";
    const empId = employee.employeeId || "-";
    const role = employee.role || "-";
    const visaExpiry = employee.visaExpiryDate ? new Date(employee.visaExpiryDate).toLocaleDateString() : "-";
    const doj = employee.doj ? new Date(employee.doj).toLocaleDateString() : "-";
    const reportingManager = employee.reportingManager || "-";
    const office = employee.office || "Main";
    const formDate = new Date(leaveRequest.createdAt || Date.now()).toLocaleDateString();
    
    // Calculate balances
    const leaveStats = calculateLeaveBalance(employee, allLeaveRequests);

    const empIdStr = String(employee._id || employee);
    const empEmailStr = String(employee.emailId || "").toLowerCase().trim();
    const empNameStr = String(employee.employeeName || employee.name || "").toLowerCase().trim();

    const empNameSearch = String(employee.employeeName || employee.name || "").toLowerCase().trim();
    const empIdSearch = String(employee._id || "").toLowerCase();

    // Group past leaves by year
    const pastLeaves = (allLeaveRequests || [])
        .filter(req => {
            if (req.status !== "Approved" && req.status !== "HOD Approved") return false;
            
            const reqName = String(req.employeeName || "").toLowerCase().trim();
            if (reqName && reqName === empNameSearch) return true;
            
            const reqEmpObj = req.employee;
            if (reqEmpObj && typeof reqEmpObj === "object") {
                const linkedId = String(reqEmpObj.employeeId?._id || reqEmpObj.employeeId || "").toLowerCase();
                if (linkedId && linkedId === empIdSearch) return true;
            }
            return false;
        })
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    // Find last leave date (excluding the current request)
    let lastLeaveDate = "-";
    const actualPast = pastLeaves.filter(p => p._id !== leaveRequest._id);
    if (actualPast.length > 0) {
        lastLeaveDate = `${new Date(actualPast[0].startDate).toLocaleDateString()} to ${new Date(actualPast[0].endDate).toLocaleDateString()}`;
    }

    const leavesByYear = {};
    
    // 1. Add matching leaves from the list
    pastLeaves.forEach(req => {
        const year = new Date(req.startDate).getFullYear();
        if (!leavesByYear[year]) leavesByYear[year] = 0;
        const s = new Date(req.startDate);
        const e = new Date(req.endDate);
        const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        leavesByYear[year] += days;
    });

    // 2. Add current leaveRequest if it's not already in the "Approved" list
    if (leaveRequest && leaveRequest.status !== "Approved" && leaveRequest.status !== "HOD Approved") {
        const currentYearValue = new Date(leaveRequest.startDate).getFullYear();
        if (!leavesByYear[currentYearValue]) leavesByYear[currentYearValue] = 0;
        const s = new Date(leaveRequest.startDate);
        const e = new Date(leaveRequest.endDate);
        const currentDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        leavesByYear[currentYearValue] += currentDays;
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleDownloadPDF = () => {
        if (!printRef.current) return;
        
        const element = printRef.current;
        const opt = {
            margin:       0.5,
            filename:     `Leave_Application_${empName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        // Old approach was print, now it's direct download
        if (window.html2pdf) {
            window.html2pdf().set(opt).from(element).save();
        } else {
            // Fallback to print if library not loaded
            window.print();
        }
    };

    const handleDownloadExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leave Application');

        // Style helper
        const headerStyle = {
            font: { bold: true, size: 14 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8FAADC' } },
            border: { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        };
        
        const blueBg = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } },
            font: { bold: true },
            border: { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        };

        // Row 1: Header
        worksheet.mergeCells('A1:K1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `LEAVE APPLICATION FORM-${new Date().getFullYear()}`;
        titleCell.style = headerStyle;

        // Row 2: Basic Info
        worksheet.addRow(['Role:', role, 'Employee Name:', empName, '', '', 'Current Visa:', visaExpiry, '', 'Date:', formDate]);
        worksheet.mergeCells('D2:G2');
        worksheet.mergeCells('H2:I2');
        worksheet.mergeCells('J2:K2');

        // Row 3: Headers
        const headerRow = worksheet.addRow(['Employee ID:', 'Last Leave Date:', '', 'Joined Date (As per visa):', '', '', '', 'Reporting Manager:', '', 'Remarks:', '']);
        headerRow.eachCell(c => { c.font = { bold: true }; c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} } });
        worksheet.mergeCells('B3:C3');
        worksheet.mergeCells('D3:G3');
        worksheet.mergeCells('H3:I3');
        worksheet.mergeCells('J3:K3');

        // Row 4: Values
        const valRow = worksheet.addRow([empId, lastLeaveDate, '', doj, '', '', '', reportingManager, '', leaveRequest.remarks || "Company Ticket", '']);
        worksheet.mergeCells('B4:C4');
        worksheet.mergeCells('D4:G4');
        worksheet.mergeCells('H4:I4');
        worksheet.mergeCells('J4:K4');

        // Row 5: Working Years
        worksheet.addRow(['', '', 'Working Years:', `${leaveStats.workingYears} Years`, '', '', '', 'Office:', office, '', '']);
        const row5 = worksheet.getRow(5);
        row5.getCell(3).style = blueBg;
        row5.getCell(8).style = blueBg;
        worksheet.mergeCells('D5:G5');
        worksheet.mergeCells('I5:K5');

        // Table Part
        worksheet.addRow([]);
        worksheet.mergeCells('A7:I7');
        worksheet.getCell('A7').value = 'Leave Application';
        worksheet.getCell('A7').style = blueBg;
        worksheet.mergeCells('J7:K7');
        worksheet.getCell('J7').value = 'Remaining Entitlement';
        worksheet.getCell('J7').style = blueBg;

        // Leave Table Data
        worksheet.addRow(['Leave Type', 'Start', 'End', 'Days', `${new Date().getFullYear()-2}`, `${new Date().getFullYear()-1}`, `${new Date().getFullYear()}`, `${new Date().getFullYear()+1}`, `${new Date().getFullYear()+2}`, 'Total (Yrs)', 'Balance']);
        const dataRow = worksheet.addRow([
            'CT (Company)', 
            start ? start.toLocaleDateString() : '-', 
            end ? end.toLocaleDateString() : '-', 
            reqDays > 30 ? 30 : reqDays,
            leavesByYear[new Date().getFullYear()-2] || 0,
            leavesByYear[new Date().getFullYear()-1] || 0,
            leavesByYear[new Date().getFullYear()] || 0,
            leavesByYear[new Date().getFullYear()+1] || 0,
            leavesByYear[new Date().getFullYear()+2] || 0,
            leaveStats.totalTaken,
            leaveStats.balance
        ]);

        const ptRow = worksheet.addRow([
            'PT (Personal)',
            reqDays > 30 ? start.toLocaleDateString() : '',
            reqDays > 30 ? end.toLocaleDateString() : '',
            reqDays > 30 ? reqDays - 30 : 0,
            '', '', '', '', '', '', ''
        ]);

        // Auto width
        worksheet.columns.forEach(col => col.width = 15);

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Leave_Application_${empName.replace(/\s+/g, '_')}.xlsx`);
    };

    // Current Leave Request math
    const start = leaveRequest.startDate ? new Date(leaveRequest.startDate) : null;
    const end = leaveRequest.endDate ? new Date(leaveRequest.endDate) : null;
    let reqDays = 0;
    if (start && end) {
        const msPerDay = 1000 * 60 * 60 * 24;
        reqDays = Math.round((end - start) / msPerDay) + 1;
    }

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 10000 }}>
            <div className="add-client-modal" style={{ width: "95%", maxWidth: "1100px", display: "flex", flexDirection: "column", maxHeight: "95vh" }}>
                <div className="add-client-header">
                    <h2 className="add-client-title">Leave Application Form</h2>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button className="excel-button" onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#107c10', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Download Excel
                            </button>
                            <button className="primary-button" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download PDF
                            </button>
                        </div>
                        <button className="close-button" onClick={onClose}>
                            <span className="close-icon">&times;</span>
                        </button>
                    </div>
                </div>

                <div className="add-client-content" style={{ overflowY: "auto", padding: "2rem" }}>
                    <div ref={printRef} className="print-container">
                        <style>{`
                            @media print {
                                body * { visibility: hidden; }
                                .print-container, .print-container * { visibility: visible; }
                                .print-container { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
                                .leave-excel-table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
                                .leave-excel-table th, .leave-excel-table td { border: 1px solid #000 !important; padding: 4px 6px; text-align: center; }
                                .leave-excel-header { background-color: #8faadc !important; font-weight: bold; font-size: 14px; -webkit-print-color-adjust: exact; }
                                .bg-blue { background-color: #b4c6e7 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
                                .signature-box { border-top: 1px solid #000; padding: 20px 10px; text-align: left; margin-bottom: 20px;}
                            }
                            .leave-excel-table { width: 100%; border-collapse: collapse; border: 2px solid #000; font-family: Arial, sans-serif; font-size: 12px; }
                            .leave-excel-table th, .leave-excel-table td { border: 1px solid #000; padding: 6px; text-align: center; color: #000; }
                            .bg-blue { background-color: #b4c6e7; font-weight: bold; }
                            .leave-excel-header { background-color: #8faadc; font-size: 16px; font-weight: bold; padding: 10px; text-transform: uppercase; }
                        `}</style>
                        <table className="leave-excel-table">
                            <tbody>
                                <tr>
                                    <td colSpan="11" className="leave-excel-header">LEAVE APPLICATION FORM-{new Date().getFullYear()} SAMPLE</td>
                                </tr>
                                <tr>
                                    <td colSpan="2" style={{ textAlign: "left" }}><strong>Role:</strong> {role}</td>
                                    <td colSpan="3" style={{ textAlign: "left" }}><strong>Employee Name:</strong> {empName}</td>
                                    <td colSpan="4" style={{ textAlign: "left" }}><strong>Current Visa:</strong> {visaExpiry}</td>
                                    <td colSpan="2" style={{ textAlign: "left" }}><strong>Date:</strong> {formDate}</td>
                                </tr>
                                <tr>
                                    <td colSpan="1" style={{ fontWeight: "bold" }}>Employee ID:</td>
                                    <td colSpan="2" style={{ fontWeight: "bold" }}>Last Leave Date:</td>
                                    <td colSpan="4" style={{ fontWeight: "bold" }}>Joined Date (As per visa):</td>
                                    <td colSpan="2" style={{ fontWeight: "bold" }}>Reporting Manager:</td>
                                    <td colSpan="2" style={{ fontWeight: "bold" }}>Remarks:</td>
                                </tr>
                                <tr>
                                    <td colSpan="1" rowSpan="3" style={{ verticalAlign: "middle" }}>{empId}</td>
                                    <td colSpan="2" rowSpan="3" style={{ verticalAlign: "middle" }}>{lastLeaveDate}</td>
                                    <td colSpan="4" rowSpan="3" style={{ verticalAlign: "middle" }}>{doj}</td>
                                    <td colSpan="2" rowSpan="3" style={{ verticalAlign: "middle" }}>{reportingManager}</td>
                                    <td colSpan="2" rowSpan="3" style={{ verticalAlign: "middle" }}>{leaveRequest.remarks || "Company Ticket"}</td>
                                </tr>
                                <tr></tr>
                                <tr></tr>
                                <tr>
                                    <td colSpan="3" className="bg-blue" style={{ textAlign: "right", paddingRight: "10px" }}>Working Years:</td>
                                    <td colSpan="4" style={{ fontWeight: "bold" }}>{leaveStats.workingYears} Years</td>
                                    <td colSpan="4" className="bg-blue" style={{ textAlign: "left", paddingLeft: "10px" }}>Office: {office}</td>
                                </tr>
                                <tr>
                                    <td colSpan="4" className="bg-blue">Leave Application</td>
                                    <td colSpan="5" className="bg-blue" style={{ color: leaveStats.airfareStatus.includes('Eligible') ? '#065f46' : '#991b1b' }}>
                                        Airfare Status: {leaveStats.airfareStatus}
                                    </td>
                                    <td colSpan="2" className="bg-blue">Remaining Entitlement</td>
                                </tr>
                                <tr>
                                    <td className="bg-blue" rowSpan="2" style={{ fontSize: "10px" }}>
                                        <div style={{ textAlign: "left", borderBottom: '1px solid #000'}}>CT - Company Ticket</div>
                                        <div style={{ textAlign: "left" }}>PT - Personal Ticket</div>
                                        <br/><strong>Leave Type</strong>
                                    </td>
                                    <td colSpan="3" className="bg-blue">Applied Date</td>
                                    <td colSpan="5" className="bg-blue">No. of Leaves in Years</td>
                                    <td colSpan="1" className="bg-blue">Total Leave Taken<br/>(In {leaveStats.workingYears} years)</td>
                                    <td colSpan="1" className="bg-blue">Balance<br/>Leave</td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>Start</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>End</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>No of Days</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>{new Date().getFullYear() - 2}</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>{new Date().getFullYear() - 1}</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>{new Date().getFullYear()}</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>{new Date().getFullYear() + 1}</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>{new Date().getFullYear() + 2}</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>Days</td>
                                    <td style={{ fontWeight: "bold", background: "#f3f4f6" }}>Days</td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: "bold" }}>CT (Company)</td>
                                    <td>{start ? start.toLocaleDateString() : "-"}</td>
                                    <td>{end ? end.toLocaleDateString() : "-"}</td>
                                    <td>{reqDays > 30 ? 30 : reqDays}</td>
                                    <td>{leavesByYear[new Date().getFullYear() - 2] || 0}</td>
                                    <td>{leavesByYear[new Date().getFullYear() - 1] || 0}</td>
                                    <td>{leavesByYear[new Date().getFullYear()] || 0}</td>
                                    <td>{leavesByYear[new Date().getFullYear() + 1] || 0}</td>
                                    <td>{leavesByYear[new Date().getFullYear() + 2] || 0}</td>
                                    <td rowSpan="2" style={{ verticalAlign: "middle" }}>{leaveStats.totalTaken}</td>
                                    <td rowSpan="2" style={{ verticalAlign: "middle" }}>{leaveStats.balance}</td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: "bold", height: "30px" }}>PT (Personal)</td>
                                    <td>{reqDays > 30 ? start.toLocaleDateString() : ""}</td>
                                    <td>{reqDays > 30 ? end.toLocaleDateString() : ""}</td>
                                    <td>{reqDays > 30 ? reqDays - 30 : 0}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colSpan="11" style={{ fontWeight: "bold", padding: "10px", textAlign: "center" }}>
                                        Accounts, HR Remarks:
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan="11" style={{ padding: "0" }}>
                                        <div className="signature-box" style={{ borderTop: "1px solid #000" }}>
                                            <div style={{ textAlign: "center", marginBottom: "30px", fontWeight: "bold" }}>
                                                Recommended by: {reportingManager}
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 50px" }}>
                                                <div><strong>Signature:</strong></div>
                                                <div><strong>Date:</strong></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan="11" style={{ padding: "0" }}>
                                        <div className="signature-box">
                                            <div style={{ textAlign: "center", marginBottom: "30px", fontWeight: "bold" }}>
                                                Approved by: Kailash Laungani
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 50px" }}>
                                                <div><strong>Signature:</strong></div>
                                                <div><strong>Date:</strong></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeaveApplicationFormModal;
