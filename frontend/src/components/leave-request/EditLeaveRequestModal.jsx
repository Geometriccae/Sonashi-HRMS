import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import leaveRequestService from "../../services/LeaveRequestService";
import EmployeeService from "../../services/EmployeeService";
import InputField from "../InputField";
import Dropdown from "../DropDown";
import DatePickerModal from "../DatePickerModal";
import Select from "react-select";
import { OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import { DEPARTMENT_OPTIONS_DEFAULT } from "../../constants/employeeDropdownOptions";
import OptionService from "../../services/OptionService";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import "./LeaveForm.css"; // Using new clean grid styles

function EditLeaveRequestModal({ isOpen, onClose, onSubmit, leaveRequest, allLeaveRequests }) {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userRole, setUserRole] = useState("");
    const [employees, setEmployees] = useState([]);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        company: "Sonashi",
        department: "",
        reportingManager: "",
        leaveType: "Personal Leave",
        startDate: "",
        endDate: "",
        reason: "",
        status: "Pending",
        requestAirfare: false
    });
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null); // 'start' | 'end'
    const [dynamicDepartmentOptions, setDynamicDepartmentOptions] = useState([]);
    const [selectedYearDetails, setSelectedYearDetails] = useState(null); // { year, leaves }

    const currentRole = String(userRole || "").toLowerCase();
    const isAdmin = currentRole === "admin";
    const isHR = currentRole === "hr";
    const isManager = isAdmin || isHR;
    const isEditable = isManager || leaveRequest?.status === "Pending";

    const handleDateSelect = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const value = `${y}-${m}-${d}`;
        setFormData((prev) => ({ ...prev, [datePickerField === "start" ? "startDate" : "endDate"]: value }));
        setDatePickerOpen(false);
    };

    useEffect(() => {
        const role = localStorage.getItem("role") || "";
        setUserRole(role);
        if (isOpen) {
            if (role.toLowerCase() === "admin" || role.toLowerCase() === "hr") {
                fetchEmployees();
            }
            fetchDepartmentOptions();
        }
    }, [isOpen]);

    const fetchDepartmentOptions = async () => {
        try {
            const dbOptions = await OptionService.getOptions('department');
            const merged = OptionService.mergeWithDynamicOptions(DEPARTMENT_OPTIONS_DEFAULT, dbOptions);
            setDynamicDepartmentOptions(merged);
        } catch (error) {
            console.error("Error fetching departments:", error);
            setDynamicDepartmentOptions(DEPARTMENT_OPTIONS_DEFAULT);
        }
    };

    const handleAddDepartment = async (label) => {
        try {
            await OptionService.addOption('department', label);
            await fetchDepartmentOptions();
            showToast(`Department "${label}" added successfully`, "success");
        } catch (err) {
            console.error("Error adding department:", err);
            showToast(err.response?.data?.message || "Failed to add department", "error");
        }
    };

    const handleDeleteDepartment = async (option) => {
        try {
            const dbOptions = await OptionService.getOptions('department');
            const toDelete = dbOptions.find(o => o.label === option.label);
            if (toDelete) {
                await OptionService.deleteOption('department', toDelete._id);
                await fetchDepartmentOptions();
                showToast(`Department "${option.label}" deleted`, "success");
            } else {
                showToast("Cannot delete default options", "error");
            }
        } catch (err) {
            console.error("Error deleting department:", err);
            showToast("Failed to delete department", "error");
        }
    };

    useEffect(() => {
        if (leaveRequest) {
            const empId = leaveRequest.employee?._id || leaveRequest.employee || leaveRequest.employeeId || leaveRequest.employeeName || "";
            const empName = leaveRequest.employeeName || leaveRequest.employee?.employeeName || leaveRequest.employee?.username || leaveRequest.employee?.name || "";
            
            setFormData({
                employeeId: empId,
                employeeName: empName,
                company: leaveRequest.company || "Sonashi",
                department: leaveRequest.department || "",
                reportingManager: leaveRequest.reportingManager || "",
                leaveType: leaveRequest.leaveType || "Personal Leave",
                startDate: leaveRequest.startDate ? new Date(leaveRequest.startDate).toISOString().split('T')[0] : "",
                endDate: leaveRequest.endDate ? new Date(leaveRequest.endDate).toISOString().split('T')[0] : "",
                reason: leaveRequest.reason || "",
                status: leaveRequest.status || "Pending",
                requestAirfare: leaveRequest.requestAirfare || false,
                visaExpiryDate: (leaveRequest.employee?.visaExpiryDate || employees.find(e => e._id === empId)?.visaExpiryDate) ? new Date(leaveRequest.employee?.visaExpiryDate || employees.find(e => e._id === empId)?.visaExpiryDate).toISOString().split('T')[0] : ""
            });
            setError("");
            setSelectedYearDetails(null);
        }
    }, [leaveRequest, isOpen]);

    const fetchEmployees = async () => {
        try {
            const data = await EmployeeService.getEmployees();
            setEmployees(data);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        // Disabled backdrop click to close, forcing use of X or Cancel button
        /* if (e.target === e.currentTarget) {
            onClose();
        } */
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (error) setError("");
    };

    const handleEmployeeChange = (selectedOption) => {
        if (!selectedOption) {
            setFormData(prev => ({ ...prev, employeeId: "", employeeName: "" }));
            return;
        }
        const selectedId = selectedOption.value;
        const selectedEmployee = employees.find(emp => emp._id === selectedId);
        setFormData((prev) => ({
            ...prev,
            employeeId: selectedId,
            employeeName: selectedEmployee ? (selectedEmployee.employeeName || selectedEmployee.name || "") : "",
            visaExpiryDate: selectedEmployee?.visaExpiryDate ? new Date(selectedEmployee.visaExpiryDate).toISOString().split('T')[0] : ""
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Remove strict validation for fields that might be missing in historical imported data
        if (!formData.employeeName || !formData.startDate || !formData.endDate) {
            setError("Please fill in all required fields marked with *");
            return;
        }

        const payload = { ...formData };
        // Prevent sending invalid ObjectIds to the backend for historical records
        if (!payload.employeeId || payload.employeeId === "unknown" || (typeof payload.employeeId === 'string' && payload.employeeId.length !== 24)) {
            delete payload.employeeId;
        }

        setError("");
        setIsSubmitting(true);
        try {
            const result = await leaveRequestService.updateLeaveRequest(leaveRequest._id, payload);
            showToast("Leave request updated successfully.", "success");
            onSubmit(result);
            onClose();
        } catch (error) {
            console.error("Error updating leave request:", error);
            showToast(error.response?.data?.message || "Failed to update leave request.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const leaveTypeOptions = [
        { value: "Sick Leave", label: "Sick Leave" },
        { value: "Vacation", label: "Vacation" },
        { value: "Personal Leave", label: "Personal Leave" },
        { value: "Maternity/Paternity", label: "Maternity/Paternity" },
        { value: "Other", label: "Other" }
    ];

    const statusOptions = [
        { value: "Pending", label: "Pending" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" }
    ];

    const baseDepartmentOptions = dynamicDepartmentOptions;

    const employeeOptions = employees.map(emp => ({
        value: emp._id,
        label: `${emp.employeeName || emp.name || "Unknown"} (${emp.employeeId || "N/A"})`
    }));

    const reportingManagerOptions = employees.map(emp => ({
        value: emp.employeeName || emp.name || "Unknown",
        label: emp.employeeName || emp.name || "Unknown"
    }));

    const departmentOptions = [...baseDepartmentOptions];
    if (formData.department && !departmentOptions.find(o => o.value === formData.department)) {
        departmentOptions.push({ value: formData.department, label: formData.department });
    }

    if (formData.reportingManager && !reportingManagerOptions.find(o => o.value === formData.reportingManager)) {
        reportingManagerOptions.push({ value: formData.reportingManager, label: formData.reportingManager });
    }

    // Calculate History Logic
    const selectedEmp = employees.find(e => e._id === formData.employeeId) || 
                        (formData.employeeName && employees.find(e => {
                            const eName = String(e.employeeName || e.name || "").toLowerCase().trim();
                            const fName = String(formData.employeeName || "").toLowerCase().trim();
                            return eName === fName && fName !== "";
                        })) || 
                        leaveRequest?.employee;
                        
    const leaveStats = selectedEmp && typeof selectedEmp === 'object' ? calculateLeaveBalance(selectedEmp, allLeaveRequests) : { entitlement: 0, totalTaken: 0, balance: 0, expiredDays: 0, airfareEligible: false };
    const years = [2026, 2025, 2024, 2023, 2022];
    const employeeLeaves = (allLeaveRequests || []).filter(req => {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        let empNameSearch = "";
        if (selectedEmp && selectedEmp.employeeName) empNameSearch = String(selectedEmp.employeeName).toLowerCase().trim();
        else if (selectedEmp && selectedEmp.name) empNameSearch = String(selectedEmp.name).toLowerCase().trim();
        else empNameSearch = String(formData.employeeName || "").toLowerCase().trim();
        
        return (reqName === empNameSearch) && (req.status === "Approved" || req.status === "HOD Approved" || req.status === "Imported");
    });

    const getYearlyLeaves = (year) => {
        return employeeLeaves.filter(req => new Date(req.startDate).getFullYear() === year);
    };

    const getYearlyTotal = (year) => {
        return getYearlyLeaves(year)
            .reduce((total, req) => {
                const s = new Date(req.startDate);
                const e = new Date(req.endDate);
                return total + (Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
            }, 0);
    };

    const handleYearClick = (year) => {
        if (selectedYearDetails?.year === year) {
            setSelectedYearDetails(null);
        } else {
            setSelectedYearDetails({
                year,
                leaves: getYearlyLeaves(year)
            });
        }
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 100000 }}>
            <div className="leave-modal-container" style={{ maxWidth: "800px" }}>
                <div className="leave-modal-header">
                    <h2 className="leave-modal-title">Edit Leave Request</h2>
                    <button className="leave-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="leave-modal-content" style={{ background: "#f8fafc" }}>
                    <form onSubmit={handleSubmit} className="leave-main-form">
                        <div className="leave-form-grid">
                            <div className="full-width">
                                {isManager ? (
                                    <div className="full-width">
                                        <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>
                                            Employee <span style={{ color: "red", marginLeft: "4px" }}>*</span>
                                        </label>
                                        <Select
                                            options={employeeOptions}
                                            value={
                                                employeeOptions.find(opt => opt.value === formData.employeeId) || 
                                                (formData.employeeName && employeeOptions.find(opt => opt.label.toLowerCase().includes(formData.employeeName.toLowerCase()))) ||
                                                (formData.employeeName ? { value: formData.employeeId || "unknown", label: formData.employeeName } : null)
                                            }
                                            onChange={handleEmployeeChange}
                                            placeholder="Select employee..."
                                            isSearchable
                                            isDisabled={!isEditable}
                                            styles={{
                                                control: (base) => ({
                                                    ...base,
                                                    minHeight: '44px',
                                                    borderRadius: '8px',
                                                    borderColor: '#E2E8F0',
                                                    boxShadow: 'none',
                                                    '&:hover': { borderColor: '#CBD5E1' }
                                                }),
                                                menuPortal: base => ({ ...base, zIndex: 999999 })
                                            }}
                                            menuPortalTarget={document.body}
                                        />
                                    </div>
                                ) : (
                                    <InputField
                                        label="Employee"
                                        value={formData.employeeName}
                                        disabled={true}
                                    />
                                )}
                            </div>



                            <InputField
                                label="Company *"
                                value="Sonashi"
                                disabled={true}
                                onChange={() => {}}
                            />

                            <Dropdown
                                label="Department *"
                                placeholder="Select department"
                                options={departmentOptions}
                                value={formData.department}
                                onChange={(e) => handleInputChange("department", e.target.value)}
                                onAdd={isManager ? handleAddDepartment : null}
                                onDelete={isManager ? handleDeleteDepartment : null}
                                disabled={!isEditable}
                            />

                            <Dropdown
                                label="Reporting Manager *"
                                placeholder="Select reporting manager"
                                options={reportingManagerOptions}
                                value={formData.reportingManager}
                                onChange={(e) => handleInputChange("reportingManager", e.target.value)}
                                disabled={!isEditable}
                            />

                            <Dropdown
                                label="Leave Type *"
                                placeholder="Select leave type"
                                options={leaveTypeOptions}
                                value={formData.leaveType}
                                onChange={(e) => handleInputChange("leaveType", e.target.value)}
                                disabled={!isEditable}
                            />

                            {isEditable ? (
                                <>
                                    <div className="input-field">
                                        <div className="input-label-container">
                                            <label className="input-label">Start Date <span style={{ color: "red", marginLeft: "4px" }}>*</span></label>
                                        </div>
                                        <div className="input-container" style={{ cursor: "pointer" }} onClick={() => { setDatePickerField("start"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.startDate || ""} placeholder="Select date" />
                                            <img src={calendarIcon} alt="" width="16" height="16" />
                                        </div>
                                    </div>
                                    <div className="input-field">
                                        <div className="input-label-container">
                                            <label className="input-label">End Date <span style={{ color: "red", marginLeft: "4px" }}>*</span></label>
                                        </div>
                                        <div className="input-container" style={{ cursor: "pointer" }} onClick={() => { setDatePickerField("end"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.endDate || ""} placeholder="Select date" />
                                            <img src={calendarIcon} alt="" width="16" height="16" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <InputField label="Start Date *" value={formData.startDate} disabled={true} />
                                    <InputField label="End Date *" value={formData.endDate} disabled={true} />
                                </>
                            )}

                            {isAdmin && (
                                <div className="full-width">
                                    <Dropdown
                                        label="Status *"
                                        placeholder="Select status"
                                        options={statusOptions}
                                        value={formData.status}
                                        onChange={(e) => handleInputChange("status", e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="full-width">
                                <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                                    <div className="input-field">
                                        <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>Joining Date</label>
                                        <input 
                                            type="text" 
                                            className="input-field-input" 
                                            disabled 
                                            value={leaveRequest?.employee?.doj ? new Date(leaveRequest.employee.doj).toLocaleDateString() : 'N/A'} 
                                            style={{ background: "#f8fafc" }} 
                                        />
                                    </div>
                                    <div className="input-field">
                                        <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>Total Experience</label>
                                        <input 
                                            type="text" 
                                            className="input-field-input" 
                                            disabled 
                                            value={leaveStats.workingYears ? `${leaveStats.workingYears} Years` : 'N/A'} 
                                            style={{ background: "#f8fafc" }} 
                                        />
                                    </div>
                                    <div className="input-field">
                                        <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>Visa Expiry Date</label>
                                        <input 
                                            type="text" 
                                            className="input-field-input" 
                                            disabled 
                                            value={formData.visaExpiryDate ? new Date(formData.visaExpiryDate).toLocaleDateString() : 'Not Set'} 
                                            style={{ background: "#f8fafc" }} 
                                        />
                                    </div>
                                </div>
                            </div>

                             <div className="full-width">
                                <InputField
                                    label="Reason *"
                                    placeholder="Enter reason for leave"
                                    value={formData.reason}
                                    onChange={(e) => handleInputChange("reason", e.target.value)}
                                    disabled={!isEditable}
                                />
                            </div>

                            {(() => {
                                const { airfareEligible } = leaveStats;
                                
                                return (
                                    <div className="full-width" style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginTop: "12px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: "700", fontSize: "14px", color: "#0f172a" }}>Airfare Request</div>
                                                    Eligibility: <span style={{ 
                                                        color: leaveStats.airfareAvailable ? "#16a34a" : "#ef4444", 
                                                        fontWeight: "800",
                                                        padding: "2px 6px",
                                                        background: leaveStats.airfareAvailable ? "#f0fdf4" : "#fef2f2",
                                                        borderRadius: "4px",
                                                        marginLeft: "4px"
                                                    }}>
                                                        {(leaveStats?.airfareStatus || "N/A").toUpperCase()}
                                                    </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <input 
                                                    type="checkbox" 
                                                    id="requestAirfareEdit"
                                                    checked={formData.requestAirfare}
                                                    onChange={(e) => handleInputChange("requestAirfare", e.target.checked)}
                                                    disabled={!isEditable}
                                                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                                                />
                                                <label htmlFor="requestAirfareEdit" style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Request Airfare</label>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {error && (
                            <div style={{ 
                                margin: "16px 0", 
                                padding: "12px 16px", 
                                background: "#fef2f2", 
                                border: "1px solid #fecaca", 
                                borderRadius: "8px", 
                                color: "#991b1b", 
                                fontSize: "13px",
                                fontWeight: "600",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                {error}
                            </div>
                        )}

                        <div className="leave-modal-footer" style={{ padding: "0", border: "none", marginTop: "12px" }}>
                            <button type="button" className="leave-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                            <button type="submit" className="leave-btn-primary" disabled={isSubmitting} style={{ flex: 2 }}>
                                {isSubmitting ? "Updating..." : "Update Request"}
                            </button>
                        </div>
                    </form>

                {/* Employee Leave Overview Section - Side Panel */}
                {selectedEmp || formData.employeeName ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", color: "#0f172a" }}>Employee Leave Summary</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "12px" }}>
                                <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0", textAlign: "center" }}>
                                    <div style={{ fontSize: "10px", color: "#166534", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Entitlement</div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#14532d" }}>{leaveStats.entitlement} Days</div>
                                </div>
                                <div style={{ padding: "12px", background: "#fef2f2", borderRadius: "12px", border: "1px solid #fecaca", textAlign: "center" }}>
                                    <div style={{ fontSize: "10px", color: "#991b1b", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Taken</div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#7f1d1d" }}>{leaveStats.totalTaken} Days</div>
                                </div>
                                <div style={{ padding: "12px", background: "#fff7ed", borderRadius: "12px", border: "1px solid #fed7aa", textAlign: "center" }}>
                                    <div style={{ fontSize: "10px", color: "#9a3412", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Expired</div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#7c2d12" }}>{leaveStats.expiredDays} Days</div>
                                </div>
                                <div style={{ padding: "12px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe", textAlign: "center" }}>
                                    <div style={{ fontSize: "10px", color: "#1e40af", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Available</div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#1e3a8a" }}>{leaveStats.balance} Days</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                                <h3 style={{ fontSize: "15px", fontWeight: "700", margin: 0 }}>Leave History (Last 5 Years)</h3>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "400px" }}>
                                    <thead>
                                        <tr style={{ background: "#f8fafc" }}>
                                            <th style={{ textAlign: "left", padding: "12px 24px", fontSize: "12px", color: "#64748b" }}>YEAR</th>
                                            <th style={{ textAlign: "right", padding: "12px 24px", fontSize: "12px", color: "#64748b" }}>TAKEN</th>
                                            <th style={{ textAlign: "right", padding: "12px 24px", fontSize: "12px", color: "#64748b" }}>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {years.map(year => {
                                            const total = getYearlyTotal(year);
                                            const isSelected = selectedYearDetails?.year === year;
                                            return (
                                                <React.Fragment key={year}>
                                                    <tr 
                                                        style={{ 
                                                            borderBottom: "1px solid #f1f5f9", 
                                                            cursor: "pointer",
                                                            background: isSelected ? "#f8fafc" : "transparent"
                                                        }}
                                                        onClick={() => handleYearClick(year)}
                                                    >
                                                        <td style={{ padding: "14px 24px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>{year}</td>
                                                        <td style={{ padding: "14px 24px", fontSize: "14px", textAlign: "right", color: "#2563eb", fontWeight: "700", textDecoration: "underline" }}>
                                                            {total} Days
                                                        </td>
                                                        <td style={{ padding: "14px 24px", textAlign: "right" }}>
                                                            <span style={{
                                                                padding: "4px 10px",
                                                                borderRadius: "6px",
                                                                fontSize: "11px",
                                                                fontWeight: "700",
                                                                background: total > 30 ? "#fef2f2" : "#f0fdf4",
                                                                color: total > 30 ? "#ef4444" : "#16a34a"
                                                            }}>
                                                                {total > 30 ? "EXCEEDED" : "WITHIN LIMIT"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {isSelected && (
                                                        <tr>
                                                            <td colSpan="3" style={{ padding: "0" }}>
                                                                <div style={{ background: "#f8fafc", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                                                                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", marginBottom: "12px", textTransform: "uppercase" }}>
                                                                        Leave Details for {year}
                                                                    </div>
                                                                    {selectedYearDetails.leaves.length > 0 ? (
                                                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                                            {selectedYearDetails.leaves.map((req, idx) => (
                                                                                <div key={idx} style={{ 
                                                                                    background: "#fff", 
                                                                                    padding: "12px", 
                                                                                    borderRadius: "8px", 
                                                                                    border: "1px solid #e2e8f0",
                                                                                    display: "flex",
                                                                                    justifyContent: "space-between",
                                                                                    alignItems: "center"
                                                                                }}>
                                                                                    <div>
                                                                                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                                                                                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                                                                        </div>
                                                                                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                                                                                            {req.leaveType} • {Math.round((new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24)) + 1} Days
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ textAlign: "right" }}>
                                                                                        <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748b" }}>AIRFARE</div>
                                                                                        <div style={{ 
                                                                                            fontSize: "12px", 
                                                                                            fontWeight: "700", 
                                                                                            color: req.requestAirfare ? "#16a34a" : "#94a3b8" 
                                                                                        }}>
                                                                                            {req.requestAirfare ? "YES" : "NO"}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>No approved leaves found for this year.</div>
                                                                    )}
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
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: "40px", background: "#fff", borderRadius: "16px", border: "1px dashed #cbd5e1", textAlign: "center", color: "#94a3b8" }}>
                        Select an employee to view their leave history and balance summary.
                    </div>
                )}
                </div>
            </div>
            {isEditable && (
                <DatePickerModal
                    isOpen={datePickerOpen}
                    onClose={() => setDatePickerOpen(false)}
                    onSelectDate={handleDateSelect}
                    selectedDate={datePickerField === "start" ? formData.startDate : formData.endDate}
                />
            )}
        </div>
    );
}

export default EditLeaveRequestModal;
