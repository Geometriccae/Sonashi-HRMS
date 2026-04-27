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
    const [dynamicDepartmentOptions, setDynamicDepartmentOptions] = useState([]);

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
            const empId = leaveRequest.employee?._id || leaveRequest.employee || "";
            const empName = leaveRequest.employee?.username || leaveRequest.employeeName || "";
            
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
            employeeName: selectedEmployee ? (selectedEmployee.employeeName || selectedEmployee.name || "") : ""
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

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 100000 }}>
            <div className="leave-modal-container">
                <div className="leave-modal-header">
                    <h2 className="leave-modal-title">Edit Leave Request</h2>
                    <button className="leave-modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    <div className="leave-modal-content">
                        <div className="leave-form-grid">
                            <div className="full-width">
                                {isManager ? (
                                    <div className="full-width">
                                        <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>
                                            Employee <span style={{ color: "red", marginLeft: "4px" }}>*</span>
                                        </label>
                                        <Select
                                            options={employeeOptions}
                                            value={employeeOptions.find(opt => opt.value === formData.employeeId) || null}
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

                            {(() => {
                                const selectedEmp = employees.find(e => e._id === formData.employeeId) || leaveRequest?.employee;
                                if (selectedEmp && typeof selectedEmp === 'object') {
                                    const { balance, totalTaken } = calculateLeaveBalance(selectedEmp, allLeaveRequests);
                                    let requestedDays = 0;
                                    if (formData.startDate && formData.endDate) {
                                        const s = new Date(formData.startDate);
                                        const e = new Date(formData.endDate);
                                        if (!isNaN(s) && !isNaN(e) && e >= s) requestedDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
                                    }

                                    return (
                                        <div className="leave-balance-card" style={{
                                            background: balance > 0 ? "#f0fdf4" : (balance < 0 ? "#fef2f2" : "#f8fafc"),
                                            border: `1px solid ${balance > 0 ? "#bbf7d0" : (balance < 0 ? "#fecaca" : "#e2e8f0")}`,
                                            color: balance > 0 ? "#166534" : (balance < 0 ? "#991b1b" : "#334155")
                                        }}>
                                            <div className="leave-balance-row">
                                                <div className="leave-balance-item">
                                                    <span className="leave-balance-label">Current Taken:</span>
                                                    <span>{totalTaken} Days</span>
                                                </div>
                                                <div className="leave-balance-item">
                                                    <span className="leave-balance-label">Current Balance:</span>
                                                    <span>{balance} Days</span>
                                                </div>
                                            </div>
                                            {requestedDays > 0 && (
                                                <div className="leave-balance-row" style={{ paddingTop: "12px", borderTop: "1px dashed currentColor" }}>
                                                    <div className="leave-balance-item">
                                                        <span className="leave-balance-label">This Request:</span>
                                                        <span style={{ color: "#007aff" }}>{requestedDays} Days</span>
                                                    </div>
                                                    <div className="leave-balance-item">
                                                        <span className="leave-balance-label">Remaining:</span>
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
                                <InputField
                                    label="Reason *"
                                    placeholder="Enter reason for leave"
                                    value={formData.reason}
                                    onChange={(e) => handleInputChange("reason", e.target.value)}
                                    disabled={!isEditable}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="leave-modal-footer">
                        <button type="button" className="leave-btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="leave-btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Updating..." : "Update Request"}
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
