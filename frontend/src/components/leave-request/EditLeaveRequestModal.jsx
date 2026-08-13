import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext";
import leaveRequestService from "../../services/LeaveRequestService";
import EmployeeService from "../../services/EmployeeService";
import InputField from "../InputField";
import Dropdown from "../DropDown";
import DatePickerModal from "../DatePickerModal";
import DateInput from "../DateInput";
import Select from "react-select";
import { OFFICIAL_HOLIDAYS_2026 } from "../../utils/leaveHolidays";
import { calculateLeaveBalance } from "../../utils/leaveCalculator";
import { buildYearList, yearsFromLeaveRequests } from "../../utils/yearOptions";
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
    // Which leave record the form is editing (click a date in history to switch)
    const [activeLeave, setActiveLeave] = useState(leaveRequest || null);

    const currentRole = String(userRole || "").toLowerCase();
    const isAdmin = currentRole === "admin";
    const isHR = currentRole === "hr";
    const isHOD = currentRole === "hod";
    const isManager = isAdmin || isHR || isHOD;
    const targetLeave = activeLeave || leaveRequest;
    const isEditable = isManager || targetLeave?.status === "Pending";
    const isPastLeaveRequest = targetLeave?.isPastLeave || (targetLeave?.status === 'Approved' && targetLeave?.startDate && new Date(targetLeave.startDate) < new Date());

    const resolveEmployeeRecord = (empId, empName, leaveEmp) => {
        const linkedId =
            leaveEmp?.employeeId?._id ||
            leaveEmp?.employeeId ||
            "";
        return (
            (empId && employees.find((e) => String(e._id) === String(empId))) ||
            (linkedId && employees.find((e) => String(e._id) === String(linkedId))) ||
            (empName &&
                employees.find((e) => {
                    const eName = String(e.employeeName || e.name || "").toLowerCase().trim();
                    const fName = String(empName || "").toLowerCase().trim();
                    return eName === fName && fName !== "";
                })) ||
            null
        );
    };

    const formatVisaInputDate = (val) =>
        val ? new Date(val).toISOString().split("T")[0] : "";

    const populateFormFromLeave = (req) => {
        if (!req) return;
        const rawEmpId = req.employee?._id || req.employee || req.employeeId || "";
        const empIdStr =
            rawEmpId && typeof rawEmpId === "object"
                ? String(rawEmpId._id || rawEmpId)
                : String(rawEmpId || "");
        const empId = /^[a-fA-F0-9]{24}$/.test(empIdStr) ? empIdStr : "";
        const empName = req.employeeName || req.employee?.employeeName || req.employee?.username || req.employee?.name || "";
        const matchedEmp = resolveEmployeeRecord(empId, empName, req.employee);
        const visaSrc = req.employee?.visaExpiryDate || matchedEmp?.visaExpiryDate;
        setFormData({
            employeeId: matchedEmp?._id || empId,
            employeeName: empName,
            company: req.company || "Sonashi",
            department: req.department || "",
            reportingManager: req.reportingManager || "",
            leaveType: req.leaveType || "Personal Leave",
            startDate: req.startDate ? new Date(req.startDate).toISOString().split('T')[0] : "",
            endDate: req.endDate ? new Date(req.endDate).toISOString().split('T')[0] : "",
            reason: req.reason || "",
            status: req.status || "Pending",
            requestAirfare: req.requestAirfare || false,
            visaExpiryDate: formatVisaInputDate(visaSrc)
        });
        setError("");
    };

    const handleSelectLeaveFromHistory = (req) => {
        if (!req?._id) return;
        setActiveLeave(req);
        populateFormFromLeave(req);
        showToast("Loaded leave for editing — update dates and save.", "success");
    };

    const handleDateSelect = (date) => {
        if (error) setError("");
        const selected = new Date(date);
        selected.setHours(0, 0, 0, 0);

        const currentSelectedEmp = employees.find(e => e._id === formData.employeeId) || 
                                   (formData.employeeName && employees.find(e => {
                                       const eName = String(e.employeeName || e.name || "").toLowerCase().trim();
                                       const fName = String(formData.employeeName || "").toLowerCase().trim();
                                       return eName === fName && fName !== "";
                                   })) || 
                                   targetLeave?.employee;

        if (currentSelectedEmp && currentSelectedEmp.doj) {
            const joiningDate = new Date(currentSelectedEmp.doj);
            joiningDate.setHours(0, 0, 0, 0);
            if (selected < joiningDate) {
                setError(`Start date and End date cannot be before the Employee's Joining Date (${joiningDate.toLocaleDateString('en-GB')}).`);
                return;
            }
        }

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
            if (role.toLowerCase() === "admin" || role.toLowerCase() === "hr" || role.toLowerCase() === "hod") {
                fetchEmployees();
            }
            fetchDepartmentOptions();
        }
    }, [isOpen]);

    const fetchDepartmentOptions = async () => {
        try {
            const [dbOptions, excluded] = await Promise.all([
                OptionService.getOptions('department'),
                OptionService.getExcludedDefaults('department'),
            ]);
            const merged = OptionService.mergeWithDynamicOptions(DEPARTMENT_OPTIONS_DEFAULT, dbOptions, excluded);
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
        if (!option?.label || option.label === "-Select-") return;
        try {
            const dbOptions = await OptionService.getOptions('department');
            const toDelete = dbOptions.find((o) => o.label === option.label);
            if (toDelete) {
                await OptionService.deleteOption('department', toDelete._id);
            } else {
                await OptionService.excludeDefaultOption('department', option.label);
            }
            await fetchDepartmentOptions();
            showToast(`Department "${option.label}" deleted`, "success");
        } catch (err) {
            console.error("Error deleting department:", err);
            showToast("Failed to delete department", "error");
        }
    };

    useEffect(() => {
        if (leaveRequest) {
            setActiveLeave(leaveRequest);
            const rawEmpId =
                leaveRequest.employee?._id ||
                leaveRequest.employee ||
                leaveRequest.employeeId ||
                "";
            const empIdStr = rawEmpId != null ? String(rawEmpId) : "";
            const empId = /^[a-fA-F0-9]{24}$/.test(empIdStr) ? empIdStr : "";
            const empName = leaveRequest.employeeName || leaveRequest.employee?.employeeName || leaveRequest.employee?.username || leaveRequest.employee?.name || "";
            const matchedEmp = resolveEmployeeRecord(empId, empName, leaveRequest.employee);
            const visaSrc = leaveRequest.employee?.visaExpiryDate || matchedEmp?.visaExpiryDate;

            setFormData({
                employeeId: matchedEmp?._id || empId,
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
                visaExpiryDate: formatVisaInputDate(visaSrc)
            });
            setError("");
            setSelectedYearDetails(null);
        }
    }, [leaveRequest, isOpen, employees]);

    const fetchEmployees = async () => {
        try {
            const data = await EmployeeService.getEmployeesList();
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
        // Only send real Mongo ObjectIds (24-char names like "MAHESH CHAINANI RAMCHAND" must not be sent)
        if (
            !payload.employeeId ||
            payload.employeeId === "unknown" ||
            typeof payload.employeeId !== "string" ||
            !/^[a-fA-F0-9]{24}$/.test(payload.employeeId)
        ) {
            delete payload.employeeId;
        }
        // Field edits must not re-submit unchanged status (avoids approval/self-approve guards)
        if (!targetLeave?.status || payload.status === targetLeave.status) {
            delete payload.status;
        }

        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const currentSelectedEmp = employees.find(e => e._id === formData.employeeId) || 
                                   (formData.employeeName && employees.find(e => {
                                       const eName = String(e.employeeName || e.name || "").toLowerCase().trim();
                                       const fName = String(formData.employeeName || "").toLowerCase().trim();
                                       return eName === fName && fName !== "";
                                   })) || 
                                   targetLeave?.employee;

        if (currentSelectedEmp && currentSelectedEmp.doj) {
            const joiningDate = new Date(currentSelectedEmp.doj);
            joiningDate.setHours(0, 0, 0, 0);
            if (start < joiningDate || end < joiningDate) {
                setError(`Start date and End date cannot be before the Employee's Joining Date (${joiningDate.toLocaleDateString('en-GB')}).`);
                return;
            }
        }

        setError("");
        setIsSubmitting(true);
        try {
            const leaveId = targetLeave?._id || leaveRequest?._id;
            const result = await leaveRequestService.updateLeaveRequest(leaveId, payload);
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
        { value: "Annual Leave", label: "Annual Leave" },
        { value: "Maternity/Paternity", label: "Maternity/Paternity" },
        { value: "Other", label: "Other" }
    ];

    const statusOptions = [
        { value: "Pending", label: "Pending" },
        { value: "HOD Approved", label: "HOD Approved" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" },
        { value: "Cancelled", label: "Cancelled" }
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

    // Resolve Employee master (doj / visa live on Employee, not User on leaveRequest.employee)
    const linkedEmployeeId =
        targetLeave?.employee?.employeeId?._id ||
        targetLeave?.employee?.employeeId ||
        leaveRequest?.employee?.employeeId?._id ||
        leaveRequest?.employee?.employeeId ||
        "";
    const selectedEmp = employees.find(e => e._id === formData.employeeId) ||
                        (linkedEmployeeId && employees.find(e => String(e._id) === String(linkedEmployeeId))) ||
                        (formData.employeeName && employees.find(e => {
                            const eName = String(e.employeeName || e.name || "").toLowerCase().trim();
                            const fName = String(formData.employeeName || "").toLowerCase().trim();
                            return eName === fName && fName !== "";
                        })) ||
                        (typeof targetLeave?.employee === "object" && targetLeave.employee?.doj
                            ? targetLeave.employee
                            : null);
                        
    const leaveStats = selectedEmp && typeof selectedEmp === 'object' ? calculateLeaveBalance(selectedEmp, allLeaveRequests, formData.startDate) : { entitlement: 0, totalTaken: 0, balance: 0, expiredDays: 0, airfareEligible: false };
    const employeeLeaves = (allLeaveRequests || []).filter(req => {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        let empNameSearch = "";
        if (selectedEmp && selectedEmp.employeeName) empNameSearch = String(selectedEmp.employeeName).toLowerCase().trim();
        else if (selectedEmp && selectedEmp.name) empNameSearch = String(selectedEmp.name).toLowerCase().trim();
        else empNameSearch = String(formData.employeeName || "").toLowerCase().trim();
        
        return (reqName === empNameSearch) && (req.status === "Approved" || req.status === "HOD Approved" || req.status === "Imported");
    });
    const years = buildYearList({
      fromDataYears: yearsFromLeaveRequests(employeeLeaves),
      pastYears: 25,
      futureYears: 2,
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

    const getSelectedDaysCount = () => {
        if (!formData.startDate || !formData.endDate) return null;
        const s = new Date(formData.startDate);
        const e = new Date(formData.endDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        
        s.setHours(0, 0, 0, 0);
        e.setHours(0, 0, 0, 0);
        
        if (s > e) {
            return { error: "Start date must be before or equal to End date" };
        }
        
        const calendarDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        
        let workingDays = 0;
        const tempDate = new Date(s);
        const holidaysSet = new Set(OFFICIAL_HOLIDAYS_2026 || []);
        
        while (tempDate <= e) {
            const day = tempDate.getDay();
            const y = tempDate.getFullYear();
            const m = String(tempDate.getMonth() + 1).padStart(2, '0');
            const d = String(tempDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            if (day !== 0 && day !== 6 && !holidaysSet.has(dateStr)) {
                workingDays++;
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }
        
        return { calendarDays, workingDays };
    };

    const daysCount = getSelectedDaysCount();

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

                            {daysCount && (
                                <div className="full-width" style={{ marginTop: "-8px", marginBottom: "8px" }}>
                                    {daysCount.error ? (
                                        <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                            {daysCount.error}
                                        </div>
                                    ) : (
                                        <div style={{
                                            background: "#f0f9ff",
                                            border: "1px solid #bae6fd",
                                            padding: "12px 16px",
                                            borderRadius: "10px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "12px"
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                                </svg>
                                                <span style={{ fontSize: "14px", fontWeight: "700", color: "#0369a1" }}>Selected Leave Duration:</span>
                                            </div>
                                            <div style={{ display: "flex", gap: "16px" }}>
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: "11px", color: "#0369a1", fontWeight: "600", textTransform: "uppercase" }}>Calendar Days</div>
                                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#0284c7" }}>{daysCount.calendarDays} {daysCount.calendarDays === 1 ? "Day" : "Days"}</div>
                                                </div>
                                                <div style={{ borderLeft: "1px solid #bae6fd" }} />
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: "11px", color: "#0369a1", fontWeight: "600", textTransform: "uppercase" }}>Working Days</div>
                                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#0284c7" }}>{daysCount.workingDays} {daysCount.workingDays === 1 ? "Day" : "Days"}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                            value={selectedEmp?.doj ? new Date(selectedEmp.doj).toLocaleDateString('en-GB') : 'N/A'} 
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
                                        {(isPastLeaveRequest && isEditable) ? (
                                            <DateInput
                                                className="input-field-input"
                                                value={formData.visaExpiryDate || (selectedEmp?.visaExpiryDate ? new Date(selectedEmp.visaExpiryDate).toISOString().split("T")[0] : "")}
                                                onChange={(e) => handleInputChange("visaExpiryDate", e.target.value)}
                                            />
                                        ) : (
                                            <input 
                                                type="text" 
                                                className="input-field-input" 
                                                disabled 
                                                value={
                                                    (formData.visaExpiryDate || selectedEmp?.visaExpiryDate)
                                                        ? new Date(formData.visaExpiryDate || selectedEmp.visaExpiryDate).toLocaleDateString('en-GB')
                                                        : 'Not Set'
                                                } 
                                                style={{ background: "#f8fafc" }} 
                                            />
                                        )}
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
                                 return (
                                     <div className="full-width animated-ticket-container" style={{ marginTop: "12px" }}>
                                         <label className="ticket-label-title">
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                 <path d="M22 2L2 22" /><path d="M17 2l5 5" /><path d="M2 12l5 5" /><path d="M7 17l-5 5" /><path d="M12 12l5-5" /><path d="M17 7l5 5v5" /><path d="M2 12l10-10" />
                                             </svg>
                                             Ticket Type
                                         </label>
                                         <div className="ticket-cards-wrapper">
                                             {/* Company Ticket Card */}
                                             <div 
                                                 className={`ticket-card company-ticket ${formData.requestAirfare ? 'selected' : ''} ${!isAdmin ? 'readonly' : ''}`}
                                                 onClick={() => isAdmin && handleInputChange("requestAirfare", true)}
                                             >
                                                 <div className="ticket-card-icon">
                                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                         <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4.5 19.5 3c-1.5-1.5-3-1.5-4.5.5L11.5 7 3.3 5.2c-.9-.2-1.7.4-1.5 1.3l1.4 4.7 5.7 2.9-2.9 5.7-4.7-1.4c-.9-.2-1.5.6-1.3 1.5L2 22l8.2-1.8 5.7 2.9 2.9-5.7-1-.2z" />
                                                     </svg>
                                                 </div>
                                                 <div className="ticket-card-title">Company Ticket</div>
                                                 <div className="ticket-card-desc">Travel expenses fully sponsored and arranged by the company.</div>
                                             </div>

                                             {/* Personal Ticket Card */}
                                             <div 
                                                 className={`ticket-card personal-ticket ${!formData.requestAirfare ? 'selected' : ''} ${!isAdmin ? 'readonly' : ''}`}
                                                 onClick={() => isAdmin && handleInputChange("requestAirfare", false)}
                                             >
                                                 <div className="ticket-card-icon">
                                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                         <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                                                         <line x1="12" y1="4" x2="12" y2="20" />
                                                         <line x1="2" y1="12" x2="22" y2="12" />
                                                     </svg>
                                                 </div>
                                                 <div className="ticket-card-title">Personal Ticket</div>
                                                 <div className="ticket-card-desc">Travel expenses paid by the employee (self-expense / own ticket).</div>
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
                                <div style={{ padding: "12px", background: "#f3e8ff", borderRadius: "12px", border: "1px solid #d8b4fe", textAlign: "center" }}>
                                    <div style={{ fontSize: "10px", color: "#6b21a8", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Experience</div>
                                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#581c87" }}>{leaveStats.workingYears || 0} Years</div>
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
                                                                            {selectedYearDetails.leaves.map((req, idx) => {
                                                                                const isActiveRow = targetLeave?._id && req._id && String(targetLeave._id) === String(req._id);
                                                                                return (
                                                                                <div key={req._id || idx} style={{ 
                                                                                    background: isActiveRow ? "#eff6ff" : "#fff", 
                                                                                    padding: "12px", 
                                                                                    borderRadius: "8px", 
                                                                                    border: isActiveRow ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                                                                    display: "flex",
                                                                                    justifyContent: "space-between",
                                                                                    alignItems: "center"
                                                                                }}>
                                                                                    <div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleSelectLeaveFromHistory(req)}
                                                                                            title="Click to edit this leave"
                                                                                            style={{
                                                                                                fontSize: "13px",
                                                                                                fontWeight: "600",
                                                                                                color: "#2563eb",
                                                                                                background: "none",
                                                                                                border: "none",
                                                                                                padding: 0,
                                                                                                cursor: "pointer",
                                                                                                textDecoration: "underline",
                                                                                                textAlign: "left",
                                                                                            }}
                                                                                        >
                                                                                            {new Date(req.startDate).toLocaleDateString('en-GB')} - {new Date(req.endDate).toLocaleDateString('en-GB')}
                                                                                        </button>
                                                                                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                                                                                            {req.leaveType} • {Math.round((new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24)) + 1} Days
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ textAlign: "right" }}>
                                                                                        <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748b" }}>TICKET</div>
                                                                                        <div style={{ 
                                                                                            fontSize: "11px", 
                                                                                            fontWeight: "700", 
                                                                                            color: req.requestAirfare ? "#15803d" : "#9a3412" 
                                                                                        }}>
                                                                                            {req.requestAirfare ? "COMPANY" : "PERSONAL"}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                );
                                                                            })}
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
