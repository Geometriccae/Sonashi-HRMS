import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import leaveRequestService from "../../services/LeaveRequestService";
import EmployeeService from "../../services/EmployeeService";
import InputField from "../InputField";
import Dropdown from "../DropDown";
import DatePickerModal from "../DatePickerModal";
import { OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import "../sales-and-leads/AddClientModal.css";

function EditLeaveRequestModal({ isOpen, onClose, onSubmit, leaveRequest, allLeaveRequests }) {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userRole, setUserRole] = useState("");
    const [employees, setEmployees] = useState([]);
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
        status: "Pending"
    });
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null); // 'start' | 'end'

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
        if (isOpen && (role.toLowerCase() === "admin" || role.toLowerCase() === "hr")) {
            fetchEmployees();
        }
    }, [isOpen]);

    useEffect(() => {
        if (leaveRequest) {
            setFormData({
                employeeId: leaveRequest.employee?._id || leaveRequest.employee || "",
                employeeName: leaveRequest.employee?.username || leaveRequest.employeeName || "",
                company: leaveRequest.company || "",
                department: leaveRequest.department || "",
                reportingManager: leaveRequest.reportingManager || "",
                leaveType: leaveRequest.leaveType || "Personal Leave",
                startDate: leaveRequest.startDate ? new Date(leaveRequest.startDate).toISOString().split('T')[0] : "",
                endDate: leaveRequest.endDate ? new Date(leaveRequest.endDate).toISOString().split('T')[0] : "",
                reason: leaveRequest.reason || "",
                status: leaveRequest.status || "Pending"
            });
        }
    }, [leaveRequest]);

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
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleEmployeeChange = (e) => {
        const selectedId = e.target.value;
        const selectedEmployee = employees.find(emp => emp._id === selectedId);
        setFormData((prev) => ({
            ...prev,
            employeeId: selectedId,
            employeeName: selectedEmployee ? selectedEmployee.employeeName : ""
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const result = await leaveRequestService.updateLeaveRequest(leaveRequest._id, formData);
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

    const companyOptions = [
        { value: "Auxin Bulk Pvt Ltd", label: "Auxin Bulk Pvt Ltd" },
        { value: "Auxin Projects Pvt Ltd", label: "Auxin Projects Pvt Ltd" },
        { value: "Auxin Shipping Ltd", label: "Auxin Shipping Ltd" }
    ];

    const baseDepartmentOptions = [
        { value: "HR", label: "HR" },
        { value: "IT", label: "IT" },
        { value: "Sales", label: "Sales" },
        { value: "Finance", label: "Finance" },
        { value: "Operations", label: "Operations" },
        { value: "Marketing", label: "Marketing" }
    ];

    const employeeOptions = employees.map(emp => ({
        value: emp._id,
        label: emp.employeeName || emp.name || "Unknown"
    }));

    const reportingManagerOptions = employees.map(emp => ({
        value: emp.employeeName || emp.name || "Unknown",
        label: emp.employeeName || emp.name || "Unknown"
    }));

    // Ensure auto-filled department and manager appear in Dropdowns even if not in standard list
    const departmentOptions = [...baseDepartmentOptions];
    if (formData.department && !departmentOptions.find(o => o.value === formData.department)) {
        departmentOptions.push({ value: formData.department, label: formData.department });
    }

    if (formData.reportingManager && !reportingManagerOptions.find(o => o.value === formData.reportingManager)) {
        reportingManagerOptions.push({ value: formData.reportingManager, label: formData.reportingManager });
    }

    // Logic moved to state above for clarity


    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="add-client-modal" style={{ width: "40rem", height: "auto", maxHeight: "90vh" }}>
                <div className="add-client-header">
                    <h2 className="add-client-title">Request Leave</h2>
                    <button className="close-button" onClick={onClose}>
                        <span className="close-icon">&times;</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                    <div className="add-client-content" style={{ padding: "2rem 2.5rem", gap: "1.5rem", flex: 1, overflowY: "auto" }}>
                        <div className="form-fields-grid">
                            {isManager ? (
                                <Dropdown
                                    label="Employee *"
                                    placeholder="Select employee"
                                    options={employeeOptions}
                                    value={formData.employeeId}
                                    onChange={handleEmployeeChange}
                                    disabled={!isEditable}
                                />
                            ) : (
                                <InputField
                                    label="Employee"
                                    value={formData.employeeName}
                                    disabled={true}
                                    readOnly={true}
                                />
                            )}

                            {(() => {
                                const selectedEmp = employees.find(e => e._id === formData.employeeId) || leaveRequest?.employee;
                                
                                if (selectedEmp) {
                                    const { balance, totalTaken } = calculateLeaveBalance(selectedEmp, allLeaveRequests);
                                    
                                    // Calculate requested days for the current form
                                    let requestedDays = 0;
                                    if (formData.startDate && formData.endDate) {
                                        const s = new Date(formData.startDate);
                                        const e = new Date(formData.endDate);
                                        if (!isNaN(s) && !isNaN(e) && e >= s) {
                                            requestedDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                                        }
                                    }

                                    return (
                                        <div style={{
                                            gridColumn: "1 / -1",
                                            background: balance > 0 ? "#f0fdf4" : (balance < 0 ? "#fef2f2" : "#f8fafc"),
                                            border: `1px solid ${balance > 0 ? "#bbf7d0" : (balance < 0 ? "#fecaca" : "#e2e8f0")}`,
                                            padding: "16px 24px",
                                            borderRadius: "12px",
                                            color: balance > 0 ? "#166534" : (balance < 0 ? "#991b1b" : "#334155"),
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "12px",
                                            marginTop: "5px",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                    <span style={{ opacity: 0.8 }}>Current Taken:</span>
                                                    <span>{totalTaken} Days</span>
                                                </div>
                                                <div style={{ width: "1px", height: "16px", background: "currentColor", opacity: 0.2 }}></div>
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                    <span style={{ opacity: 0.8 }}>Current Balance:</span>
                                                    <span>{balance} Days</span>
                                                </div>
                                            </div>
                                            
                                            {requestedDays > 0 && (
                                                <div style={{ 
                                                    display: "flex", 
                                                    justifyContent: "space-between", 
                                                    alignItems: "center", 
                                                    paddingTop: "12px", 
                                                    borderTop: "1px dashed currentColor", 
                                                    opacity: 0.9 
                                                }}>
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <span style={{ opacity: 0.8 }}>This Request:</span>
                                                        <span style={{ color: "#1d4ed8" }}>{requestedDays} Days</span>
                                                    </div>
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <span style={{ opacity: 0.8 }}>Remaining:</span>
                                                        <span style={{ color: (balance - requestedDays) < 0 ? "#ef4444" : "inherit" }}>
                                                            {balance - requestedDays} Days
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

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
                                            <img src={calendarIcon} alt="" width="16" height="16" style={{ flexShrink: 0 }} />
                                        </div>
                                    </div>
                                    <div className="input-field">
                                        <div className="input-label-container">
                                            <label className="input-label">End Date <span style={{ color: "red", marginLeft: "4px" }}>*</span></label>
                                        </div>
                                        <div className="input-container" style={{ cursor: "pointer" }} onClick={() => { setDatePickerField("end"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.endDate || ""} placeholder="Select date" />
                                            <img src={calendarIcon} alt="" width="16" height="16" style={{ flexShrink: 0 }} />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <InputField
                                        label="Start Date *"
                                        type="date"
                                        value={formData.startDate}
                                        disabled={true}
                                    />
                                    <InputField
                                        label="End Date *"
                                        type="date"
                                        value={formData.endDate}
                                        disabled={true}
                                    />
                                </>
                            )}

                            {isManager && (
                                <Dropdown
                                    label="Status *"
                                    placeholder="Select status"
                                    options={statusOptions}
                                    value={formData.status}
                                    onChange={(e) => handleInputChange("status", e.target.value)}
                                />
                            )}

                            <InputField
                                label="Reason *"
                                placeholder="Enter reason for leave"
                                value={formData.reason}
                                onChange={(e) => handleInputChange("reason", e.target.value)}
                                disabled={!isEditable}
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="button-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="button-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update"}
                        </button>
                    </div>
                </form>
            </div>
            {isEditable && (
                <DatePickerModal
                    isOpen={datePickerOpen}
                    onClose={() => setDatePickerOpen(false)}
                    onSelectDate={handleDateSelect}
                    selectedDate={datePickerField === "start" ? formData.startDate : formData.endDate}
                    disabledDates={OFFICIAL_HOLIDAYS_2026}
                />
            )}
        </div>
    );
}

export default EditLeaveRequestModal;
