import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import leaveRequestService from "../../services/LeaveRequestService";
import EmployeeService from "../../services/EmployeeService";
import InputField from "../InputField";
import Dropdown from "../DropDown";
import DatePickerModal from "../DatePickerModal";
import Select from "react-select";
import { OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import { DEPARTMENT_OPTIONS_DEFAULT } from "../../constants/employeeDropdownOptions";
import OptionService from "../../services/OptionService";
import "./LeaveForm.css";

function AddLeaveRequestModal({ isOpen, onClose, onSubmit, allLeaveRequests }) {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [userRole, setUserRole] = useState("");
    const [loggedInUser, setLoggedInUser] = useState({ id: "", username: "" });
    const [formData, setFormData] = useState({
        employeeId: "",
        employeeName: "",
        company: "Sonashi",
        department: "",
        reportingManager: "",
        leaveType: "Personal Leave",
        startDate: "",
        endDate: "",
        reason: ""
    });
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null); // 'start' | 'end'
    const [dynamicDepartmentOptions, setDynamicDepartmentOptions] = useState([]);

    const currentRole = String(userRole || "").toLowerCase();
    const isAdmin = currentRole === "admin";
    const isHR = currentRole === "hr";
    const isManager = isAdmin || isHR;

    useEffect(() => {
        const role = localStorage.getItem("role") || "";
        const username = localStorage.getItem("username") || "";
        const userId = localStorage.getItem("userId") || "";

        setUserRole(role);
        setLoggedInUser({ id: userId, username: username });
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            fetchDepartmentOptions();
        }
    }, [isOpen]);

    const fetchDepartmentOptions = async () => {
        try {
            const dbOptions = await OptionService.getOptions('department');
            console.log("DB DEPARTMENTS:", dbOptions);
            const merged = OptionService.mergeWithDynamicOptions(DEPARTMENT_OPTIONS_DEFAULT, dbOptions);
            console.log("MERGED DEPARTMENTS:", merged);
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

    // Update form data for regular users once employees are loaded
    useEffect(() => {
        if (isOpen && employees.length > 0 && userRole.toLowerCase() !== "admin" && userRole.toLowerCase() !== "hr") {
            const userId = localStorage.getItem("userId") || "";
            const username = localStorage.getItem("username") || "";
            const me = employees.find(e => e._id === userId || e.employeeId === userId);
            setFormData(prev => ({
                ...prev,
                employeeId: userId,
                employeeName: username,
                department: me?.department || prev.department,
                reportingManager: me?.reportingManager || prev.reportingManager
            }));
        }
    }, [isOpen, employees, userRole]);

    const fetchEmployees = async () => {
        try {
            const data = await EmployeeService.getEmployees();
            const empList = Array.isArray(data) ? data : (data.employees || data.data || []);
            setEmployees(empList);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleEmployeeChange = (selectedOption) => {
        if (!selectedOption) {
            setFormData(prev => ({
                ...prev,
                employeeId: "",
                employeeName: "",
                department: "",
                reportingManager: ""
            }));
            return;
        }
        const selectedId = selectedOption.value;
        const selectedEmployee = employees.find(emp => emp._id === selectedId);

        console.log("SELECTED EMPLOYEE DATA:", selectedEmployee);

        setFormData((prev) => {
            const updated = {
                ...prev,
                employeeId: selectedId,
                employeeName: selectedEmployee ? (selectedEmployee.employeeName || selectedEmployee.name || "") : "",
                department: (selectedEmployee?.department || "").trim(),
                reportingManager: (selectedEmployee?.reportingManager || "").trim()
            };
            console.log("UPDATED FORM STATE:", updated);
            return updated;
        });
    };

    const handleDateSelect = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const value = `${y}-${m}-${d}`;
        setFormData((prev) => ({ ...prev, [datePickerField === "start" ? "startDate" : "endDate"]: value }));
        setDatePickerOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.employeeName || !formData.company || !formData.department || !formData.reportingManager || !formData.startDate || !formData.endDate || !formData.reason) {
            showToast("Please fill in all required fields.", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await leaveRequestService.createLeaveRequest(formData);
            showToast("Leave request submitted successfully.", "success");
            onSubmit(result);
            onClose();
            setFormData({
                employeeId: isAdmin || isHR ? "" : loggedInUser.id,
                employeeName: isAdmin || isHR ? "" : loggedInUser.username,
                company: "Sonashi",
                department: "",
                reportingManager: "",
                leaveType: "Personal Leave",
                startDate: "",
                endDate: "",
                reason: ""
            });
        } catch (error) {
            console.error("Error creating leave request:", error);
            showToast(error.response?.data?.message || "Failed to submit leave request.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate History Logic (Same as View Template)
    const selectedEmp = employees.find(e => e._id === formData.employeeId);
    const leaveStats = selectedEmp ? calculateLeaveBalance(selectedEmp, allLeaveRequests) : { entitlement: 0, totalTaken: 0, balance: 0 };
    const years = [2026, 2025, 2024, 2023, 2022];
    const employeeLeaves = (allLeaveRequests || []).filter(req => {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        const empNameSearch = String(selectedEmp?.employeeName || selectedEmp?.name || "").toLowerCase().trim();
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

    const leaveTypeOptions = [
        { value: "Sick Leave", label: "Sick Leave" },
        { value: "Vacation", label: "Vacation" },
        { value: "Personal Leave", label: "Personal Leave" },
        { value: "Maternity/Paternity", label: "Maternity/Paternity" },
        { value: "Other", label: "Other" }
    ];

    const departmentOptions = dynamicDepartmentOptions;

    const employeeOptions = employees.map(emp => ({
        value: emp._id,
        label: `${emp.employeeName || emp.name || "Unknown"} (${emp.employeeId || "N/A"})`
    }));

    const reportingManagerOptions = employees.map(emp => ({
        value: (emp.employeeName || emp.name || "").trim(),
        label: (emp.employeeName || emp.name || "Unknown").trim()
    })).filter(opt => opt.value !== "");

    const currentManager = (formData.reportingManager || "").trim();
    if (currentManager && !reportingManagerOptions.find(o => o.value === currentManager)) {
        reportingManagerOptions.push({ value: currentManager, label: currentManager });
    }

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 100000 }}>
            <div className="leave-modal-container">
                <div className="leave-modal-header">
                    <h2 className="leave-modal-title">New Leave Request</h2>
                    <button className="leave-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="leave-modal-content" style={{ background: "#f8fafc" }}>
                    <form onSubmit={handleSubmit} className="leave-main-form">
                        <div className="leave-form-grid" style={{ display: "grid", gap: "20px" }}>
                            <div className="full-width">
                                <label className="input-label" style={{ display: "block", marginBottom: "8px" }}>Employee *</label>
                                {isManager ? (
                                    <Select
                                        options={employeeOptions}
                                        value={employeeOptions.find(opt => opt.value === formData.employeeId) || null}
                                        onChange={handleEmployeeChange}
                                        placeholder="Select employee..."
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
                                ) : (
                                    <input type="text" className="input-field-input" value={formData.employeeName} disabled style={{ background: "#f8fafc" }} />
                                )}
                            </div>

                            <div className="full-width">
                                <div className="form-row">
                                    <Dropdown
                                        label="Department *"
                                        options={departmentOptions}
                                        value={formData.department}
                                        onChange={(e) => handleInputChange("department", e.target.value)}
                                        onAdd={isManager ? handleAddDepartment : null}
                                        onDelete={isManager ? handleDeleteDepartment : null}
                                        required
                                    />
                                    <Dropdown
                                        label="Reporting Manager *"
                                        options={reportingManagerOptions}
                                        value={formData.reportingManager}
                                        onChange={(e) => handleInputChange("reportingManager", e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="full-width">
                                <Dropdown
                                    label="Leave Type *"
                                    options={leaveTypeOptions}
                                    value={formData.leaveType}
                                    onChange={(e) => handleInputChange("leaveType", e.target.value)}
                                    required
                                    style={{ maxWidth: "50%" }}
                                />
                            </div>

                            <div className="full-width">
                                <div className="form-row">
                                    <div className="input-field">
                                        <label className="input-label">Start Date *</label>
                                        <div className="input-container" onClick={() => { setDatePickerField("start"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.startDate} placeholder="Start date" />
                                            <img src={calendarIcon} alt="" width="16" />
                                        </div>
                                    </div>
                                    <div className="input-field">
                                        <label className="input-label">End Date *</label>
                                        <div className="input-container" onClick={() => { setDatePickerField("end"); setDatePickerOpen(true); }}>
                                            <input type="text" className="input-field-input" readOnly value={formData.endDate} placeholder="End date" />
                                            <img src={calendarIcon} alt="" width="16" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="full-width">
                                <InputField label="Reason *" placeholder="Reason for leave" value={formData.reason} onChange={(e) => handleInputChange("reason", e.target.value)} />
                            </div>

                            <div className="leave-modal-footer" style={{ padding: "0", border: "none", marginTop: "12px" }}>
                                <button type="button" className="leave-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="leave-btn-primary" disabled={isSubmitting} style={{ flex: 2 }}>
                                    {isSubmitting ? "Submitting..." : "Submit Request"}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Employee Leave Overview Section - Now neatly UNDER the fields */}
                    {selectedEmp ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                                <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", color: "#0f172a" }}>Employee Leave Summary</h3>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "16px" }}>
                                    <div style={{ padding: "16px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#166534", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Entitlement</div>
                                        <div style={{ fontSize: "20px", fontWeight: "800", color: "#14532d" }}>{leaveStats.entitlement} Days</div>
                                    </div>
                                    <div style={{ padding: "16px", background: "#fef2f2", borderRadius: "12px", border: "1px solid #fecaca", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#991b1b", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Total Taken</div>
                                        <div style={{ fontSize: "20px", fontWeight: "800", color: "#7f1d1d" }}>{leaveStats.totalTaken} Days</div>
                                    </div>
                                    <div style={{ padding: "16px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe", textAlign: "center" }}>
                                        <div style={{ fontSize: "11px", color: "#1e40af", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Available</div>
                                        <div style={{ fontSize: "20px", fontWeight: "800", color: "#1e3a8a" }}>{leaveStats.balance} Days</div>
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
                                                return (
                                                    <tr key={year} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                        <td style={{ padding: "14px 24px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>{year}</td>
                                                        <td style={{ padding: "14px 24px", fontSize: "14px", textAlign: "right", color: "#0f172a" }}>{total} Days</td>
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

            <DatePickerModal
                isOpen={datePickerOpen}
                onClose={() => setDatePickerOpen(false)}
                onSelectDate={handleDateSelect}
                selectedDate={datePickerField === "start" ? formData.startDate : formData.endDate}
                disabledDates={OFFICIAL_HOLIDAYS_2026}
            />
        </div>
    );
}

export default AddLeaveRequestModal;
