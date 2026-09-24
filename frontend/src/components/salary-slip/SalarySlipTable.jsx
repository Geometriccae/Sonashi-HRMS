import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./SalarySlipTable.module.css";
import plus from "../../assets/dashboard/plus.svg";
import { useToast } from "../../context/ToastContext";
import salarySlipService from "../../services/SalarySlipService";
import expenseService from "../../services/ExpenseService";
import employeeService from "../../services/EmployeeService";
import SalarySlipBulkImportModal from "./SalarySlipBulkImportModal";
import SalarySlipManualAddModal from "./SalarySlipManualAddModal";
import SalarySlipEditModal from "./SalarySlipEditModal";
import DateInput from "../DateInput";
import { formatAed } from "../../utils/currency";
import { isPlaceholderEmployeeEmail } from "../../utils/employeeEmailDisplay";
import { buildYearList, yearsFromSalarySlips } from "../../utils/yearOptions";
import {
    useUrlListPage,
    useResetPageOnFilterChange,
} from "../../hooks/usePersistedListPage";
import { downloadPayslipPdf } from "../../utils/payslipPdf";
import { downloadSalarySlipsZip } from "../../utils/salarySlipBulkDownload";
import { exportSalarySlipsToExcel } from "../../utils/salarySlipExcelExport";
import {
    PERIOD_PRESETS,
    MONTH_NAMES,
    fetchParamsForPeriod,
    filterSlipsByPeriod,
    periodZipLabel,
} from "../../utils/salarySlipPeriodFilter";

const DownloadIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

const EditIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);

const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const XIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// Generic Confirmation Dialog Component
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", confirmColor = "#dc2626", icon = "warning" }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.dialogContent}>
                <div className={styles.dialogIcon}>
                    {icon === "warning" ? (
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={confirmColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    ) : (
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    )}
                </div>
                <h3 className={styles.dialogTitle}>{title}</h3>
                <p className={styles.dialogMessage}>{message}</p>
                <div className={styles.dialogActions}>
                    <button className={styles.dialogCancelBtn} onClick={onClose}>Cancel</button>
                    <button 
                        className={styles.dialogDeleteBtn} 
                        style={{ backgroundColor: confirmColor }} 
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Create Expense Modal Component for Employees
const CreateExpenseModal = ({ isOpen, onClose, onSuccess, showToast }) => {
    const [formData, setFormData] = useState({
        expenseTitle: '',
        expenseDescription: '',
        expenseAmount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        expenseCategory: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState('');

    const categories = ['Travel', 'Food', 'Office Supplies', 'Equipment', 'Communication', 'Other'];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (category) => {
        setFormData(prev => {
            const currentCategories = prev.expenseCategory;
            if (currentCategories.includes(category)) {
                return { ...prev, expenseCategory: currentCategories.filter(c => c !== category) };
            } else {
                return { ...prev, expenseCategory: [...currentCategories, category] };
            }
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('File size should not exceed 5MB', 'error');
                return;
            }
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                showToast('Only JPG, PNG, and PDF files are allowed', 'error');
                return;
            }
            setSelectedFile(file);
            setFilePreview(file.name);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.expenseTitle.trim() || !formData.expenseDescription.trim() || !formData.expenseAmount) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        if (parseFloat(formData.expenseAmount) <= 0) {
            showToast('Amount must be greater than 0', 'error');
            return;
        }

        if (formData.expenseCategory.length === 0) {
            showToast('Please select at least one category', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // Create FormData for file upload
            const submitFormData = new FormData();
            submitFormData.append('expenseTitle', formData.expenseTitle);
            submitFormData.append('expenseDescription', formData.expenseDescription);
            submitFormData.append('expenseAmount', formData.expenseAmount);
            submitFormData.append('expenseDate', formData.expenseDate);
            submitFormData.append('expenseCategory', formData.expenseCategory.join(', '));
            
            // Append file if selected
            if (selectedFile) {
                submitFormData.append('document', selectedFile);
            }

            await expenseService.createExpense(submitFormData);
            showToast('Expense request submitted successfully! It will be reviewed by HOD and HR.', 'success');
            setFormData({
                expenseTitle: '',
                expenseDescription: '',
                expenseAmount: '',
                expenseDate: new Date().toISOString().split('T')[0],
                expenseCategory: []
            });
            setSelectedFile(null);
            setFilePreview('');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            showToast(error.message || 'Failed to submit expense request', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.expenseModalContent}>
                <div className={styles.expenseModalHeader}>
                    <div className={styles.expenseModalIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <h3 className={styles.expenseModalTitle}>Create Expense Request</h3>
                    <p className={styles.expenseModalSubtitle}>Submit office-related expenses for reimbursement</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.expenseForm}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Expense Title *</label>
                        <input
                            type="text"
                            name="expenseTitle"
                            value={formData.expenseTitle}
                            onChange={handleChange}
                            placeholder="e.g., Travel to client meeting"
                            className={styles.formInput}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Description *</label>
                        <textarea
                            name="expenseDescription"
                            value={formData.expenseDescription}
                            onChange={handleChange}
                            placeholder="Provide details about the expense..."
                            className={styles.formTextarea}
                            rows="3"
                            required
                        />
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Amount (AED) *</label>
                            <input
                                type="number"
                                name="expenseAmount"
                                value={formData.expenseAmount}
                                onChange={handleChange}
                                placeholder="0.00"
                                className={styles.formInput}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Date *</label>
                            <DateInput
                                name="expenseDate"
                                value={formData.expenseDate}
                                onChange={handleChange}
                                className={styles.formInput}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Category *</label>
                        <div className={styles.categoryDropdownWrapper}>
                            <div
                                className={`${styles.categoryDropdownTrigger} ${isCategoryDropdownOpen ? styles.categoryDropdownTriggerOpen : ''}`}
                                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            >
                                <span className={formData.expenseCategory.length > 0 ? styles.categoryDropdownText : styles.categoryDropdownPlaceholder}>
                                    {formData.expenseCategory.length > 0
                                        ? formData.expenseCategory.join(', ')
                                        : 'Select categories...'}
                                </span>
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className={`${styles.categoryDropdownArrow} ${isCategoryDropdownOpen ? styles.categoryDropdownArrowOpen : ''}`}
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            {isCategoryDropdownOpen && (
                                <div className={styles.categoryDropdownMenu}>
                                    {categories.map(cat => (
                                        <label key={cat} className={styles.categoryCheckboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={formData.expenseCategory.includes(cat)}
                                                onChange={() => handleCategoryChange(cat)}
                                                className={styles.categoryCheckbox}
                                            />
                                            <span className={styles.categoryCheckboxText}>{cat}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Upload Document</label>
                        <div className={styles.fileUploadWrapper}>
                            <input
                                type="file"
                                id="expense-document"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange}
                                className={styles.fileInput}
                            />
                            <label htmlFor="expense-document" className={styles.fileUploadLabel}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <span>{filePreview || 'Choose file (JPG, PNG, PDF - Max 5MB)'}</span>
                            </label>
                        </div>
                    </div>

                    <div className={styles.expenseNote}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Your request will be reviewed by HOD first, then HR Admin for final approval.</span>
                    </div>

                    <div className={styles.expenseModalActions}>
                        <button type="button" className={styles.dialogCancelBtn} onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.expenseSubmitBtn} disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function SalarySlipTable({ userRole }) {
    const currentRole = String(userRole || "").toLowerCase();
    const isHOD = currentRole === "hod";
    const isAdminRole = currentRole === "admin";
    const isHR = currentRole === "hr";
    const isViewer =
      currentRole === "viewer" || currentRole === "authorize_user";
    const isAdmin = isAdminRole || isHOD || isHR || isViewer;
    const canManageSlips = (isAdminRole || isHOD) && !isViewer;
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const yearFromUrl = searchParams.get("year");
    const monthFromUrl = searchParams.get("month");
    const [salarySlips, setSalarySlips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination — resume last page via URL + session (same as Leave/Team)
    const [currentPage, setCurrentPage, resetToFirstPage] = useUrlListPage({
        storageKey: "salary-slips",
        basePath: "/salary-slips",
    });

    const itemsPerPage = 10;

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [slipToDelete, setSlipToDelete] = useState(null);

    // Default period: This Month (URL month/year still supported as manual)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        if (monthFromUrl) return monthFromUrl;
        if (!isAdmin) return new Date().toLocaleString("default", { month: "long" });
        return MONTH_NAMES[new Date().getMonth()];
    });
    const [selectedYear, setSelectedYear] = useState(() => {
        if (yearFromUrl) return yearFromUrl;
        return String(new Date().getFullYear());
    });
    const [periodPreset, setPeriodPreset] = useState(
        monthFromUrl || yearFromUrl ? "manual" : "this_month"
    );
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
    const bulkDownloadLockRef = useRef(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [slipToEdit, setSlipToEdit] = useState(null);

    // Expense modal state (for employees only)
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Employee tab state (Salary Slip / Expense)
    const [employeeTab, setEmployeeTab] = useState('salary');

    // Report type filter for admin (Salary Report / Expense Report)
    const [reportType, setReportType] = useState('salary');
    const [expenses, setExpenses] = useState([]);
    const [myExpenses, setMyExpenses] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState("All");
    const [isGenerating, setIsGenerating] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [selectedSlips, setSelectedSlips] = useState([]);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
    const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

    // Determine which expenses can be approved based on role
    const canApproveExpense = (expense) => {
        if (isHOD && expense.status === 'Pending') return true;
        if (isAdminRole && expense.status === 'HOD Approved') return true;
        return false;
    };

    // Handle expense approval
    const handleApproveExpense = async (expense) => {
        try {
            if (isHOD && expense.status === 'Pending') {
                await expenseService.hodAction(expense._id, 'approve');
                showToast('Expense approved by HOD. Waiting for HR Admin approval.', 'success');
            } else if (isAdminRole && expense.status === 'HOD Approved') {
                await expenseService.hrAction(expense._id, 'approve');
                showToast('Expense approved successfully.', 'success');
            }
            fetchData();
        } catch (error) {
            console.error('Error approving expense:', error);
            showToast(error.message || 'Failed to approve expense.', 'error');
        }
    };

    // Handle expense rejection
    const handleRejectExpense = async (expense) => {
        try {
            if (isHOD && expense.status === 'Pending') {
                await expenseService.hodAction(expense._id, 'reject');
                showToast('Expense rejected by HOD.', 'success');
            } else if (isAdminRole && expense.status === 'HOD Approved') {
                await expenseService.hrAction(expense._id, 'reject');
                showToast('Expense rejected by HR Admin.', 'success');
            }
            fetchData();
        } catch (error) {
            console.error('Error rejecting expense:', error);
            showToast(error.message || 'Failed to reject expense.', 'error');
        }
    };
    
    // Fetch unique departments from employees
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const emps = await employeeService.getEmployeesList();
                const depts = [...new Set(emps.map(e => e.department).filter(Boolean))];
                setDepartments(depts);
            } catch (err) {
                console.warn("Failed to fetch departments for filter", err);
            }
        };
        if (isAdmin) fetchDepartments();
    }, [isAdmin]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isAdmin) {
                if (reportType === 'salary') {
                    const params =
                        periodPreset === "manual"
                            ? { month: selectedMonth.trim(), year: selectedYear.trim() }
                            : fetchParamsForPeriod(periodPreset, customFrom, customTo);
                    const data = await salarySlipService.getAllSalarySlips(
                        params.month,
                        params.year
                    );
                    setSalarySlips(data || []);
                } else {
                    const data = await expenseService.getAllExpenses();
                    setExpenses(data || []);
                }
            } else {
                // Employee view
                if (employeeTab === 'salary') {
                    const data = await salarySlipService.getMySalarySlips();
                    setSalarySlips(data || []);
                } else {
                    const data = await expenseService.getMyExpenses();
                    setMyExpenses(data || []);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast(error.message || "Failed to fetch data.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, selectedMonth, selectedYear, periodPreset, customFrom, customTo, reportType, employeeTab, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset page only when filters actually change (Strict Mode safe)
    useResetPageOnFilterChange(resetToFirstPage, {
        selectedMonth,
        selectedYear,
        periodPreset,
        customFrom,
        customTo,
        reportType,
        employeeTab,
        searchQuery,
        selectedDepartment,
    });

    // Pagination calculations - works for both salary slips and expenses
    const periodFilteredSlips =
        isAdmin && reportType === "salary" && periodPreset !== "manual"
            ? filterSlipsByPeriod(salarySlips, periodPreset, customFrom, customTo)
            : salarySlips;

    const filteredSalarySlips = periodFilteredSlips.filter(slip => {
        const matchesSearch = slip.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             slip.emailId?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = selectedDepartment === "All" || slip.department === selectedDepartment;
        return matchesSearch && matchesDept;
    });

    const filteredExpenses = expenses.filter(exp => 
        exp.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        exp.employeeEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const currentData = isAdmin
        ? (reportType === 'expense' ? filteredExpenses : filteredSalarySlips)
        : (employeeTab === 'expense' ? myExpenses : salarySlips);
    const totalPages = Math.max(1, Math.ceil(currentData.length / itemsPerPage) || 1);
    const safePage = Math.min(currentPage, currentData.length === 0 ? currentPage : totalPages);
    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentSlips = filteredSalarySlips.slice(startIndex, endIndex);
    const currentExpenses = filteredExpenses.slice(startIndex, endIndex);
    const currentMyExpenses = myExpenses.slice(startIndex, endIndex);

    // Clamp restored page only after rows exist (avoid empty → page 1 wipe)
    useEffect(() => {
        if (currentData.length === 0) return;
        if (currentData.length === 0) return;
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentData.length, currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleDownload = async (slip) => {
        try {
            await downloadPayslipPdf(slip);
            showToast("Payslip downloaded successfully.", "success");
        } catch (error) {
            console.error("PDF generation failed:", error);
            showToast("Failed to generate premium payslip.", "error");
        }
    };

    const handlePeriodChange = (value) => {
        setPeriodPreset(value);
        if (value === "this_month") {
            const now = new Date();
            setSelectedMonth(MONTH_NAMES[now.getMonth()]);
            setSelectedYear(String(now.getFullYear()));
        } else if (value === "this_year") {
            setSelectedMonth("All");
            setSelectedYear(String(new Date().getFullYear()));
        } else if (value === "today") {
            setSelectedMonth("All");
            setSelectedYear(String(new Date().getFullYear()));
        }
    };

    const handleMonthChange = (value) => {
        setSelectedMonth(value);
        setPeriodPreset("manual");
    };

    const handleYearChange = (value) => {
        setSelectedYear(value);
        setPeriodPreset("manual");
    };

    const handleBulkDownload = async () => {
        if (bulkDownloadLockRef.current || isBulkDownloading) return;
        if (periodPreset === "custom" && (!customFrom || !customTo)) {
            showToast("Please select From Date and To Date for Custom Range.", "error");
            return;
        }
        if (!filteredSalarySlips.length) {
            showToast("No salary slips found for the selected period.", "error");
            return;
        }
        bulkDownloadLockRef.current = true;
        setIsBulkDownloading(true);
        setBulkProgress({ done: 0, total: filteredSalarySlips.length });
        try {
            const result = await downloadSalarySlipsZip(filteredSalarySlips, {
                period: periodPreset === "manual" ? "this_month" : periodPreset,
                customFrom,
                customTo,
                onProgress: (done, total) => setBulkProgress({ done, total }),
            });
            showToast(
                `Downloaded ${result.count} salary slip(s) as ${result.zipName}.`,
                "success"
            );
        } catch (error) {
            console.error("Bulk download failed:", error);
            showToast(
                error.message || "No salary slips found for the selected period.",
                "error"
            );
        } finally {
            setIsBulkDownloading(false);
            setBulkProgress({ done: 0, total: 0 });
            bulkDownloadLockRef.current = false;
        }
    };

    const handleExcelExport = async () => {
        if (isExcelExporting) return;
        if (periodPreset === "custom" && (!customFrom || !customTo)) {
            showToast("Please select From Date and To Date for Custom Range.", "error");
            return;
        }
        if (!filteredSalarySlips.length) {
            showToast("No salary slips found for the selected period.", "error");
            return;
        }
        setIsExcelExporting(true);
        try {
            const label = periodZipLabel(
                periodPreset === "manual" ? "this_month" : periodPreset,
                customFrom,
                customTo
            );
            await exportSalarySlipsToExcel(filteredSalarySlips, `Salary_Slips_${label}`);
            showToast("Excel export downloaded successfully.", "success");
        } catch (error) {
            console.error("Excel export failed:", error);
            showToast(
                error.message || "No salary slips found for the selected period.",
                "error"
            );
        } finally {
            setIsExcelExporting(false);
        }
    };

    const openDeleteDialog = (slip) => {
        setSlipToDelete(slip);
        setDeleteDialogOpen(true);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedSlips(currentSlips.map(s => s._id));
        } else {
            setSelectedSlips([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedSlips(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedSlips.length === 0) return;
        try {
            await salarySlipService.bulkDeleteSalarySlips(selectedSlips);
            showToast(`Successfully deleted ${selectedSlips.length} salary slips.`, "success");
            setSelectedSlips([]);
            setBulkDeleteConfirmOpen(false);
            fetchData();
        } catch (error) {
            showToast(error.message || "Failed to delete records.", "error");
        }
    };

    const closeDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setSlipToDelete(null);
    };

    const confirmDelete = async () => {
        if (!slipToDelete) return;
        try {
            await salarySlipService.deleteSalarySlip(slipToDelete._id);
            showToast("Salary slip record removed.", "success");
            closeDeleteDialog();
            fetchData();
        } catch (error) {
            showToast("Failed to delete record.", "error");
        }
    };

    const handleGenerateBulk = async () => {
        if (selectedMonth === "All" || selectedYear === "All") {
            showToast("Please select a specific Month and Year first.", "error");
            return;
        }

        // Always allow generate/regenerate — backend upserts existing and creates missing employees
        setGenerateConfirmOpen(true);
    };

    const confirmGenerateBulk = async () => {
        setGenerateConfirmOpen(false);
        setIsGenerating(true);
        try {
            const resp = await salarySlipService.generateBulkSalarySlips(selectedMonth, selectedYear);
            const skipped = Array.isArray(resp?.skipped) ? resp.skipped : [];
            const fullMonthLeave = skipped.filter((s) =>
                String(s.reason || "").toLowerCase().includes("approved leave for the entire month")
            );
            const baseMsg =
                resp.message ||
                `Generated/updated ${resp.count ?? 0} salary slip(s) for ${selectedMonth} ${selectedYear}.`;
            if (fullMonthLeave.length > 0) {
                const names = fullMonthLeave
                    .slice(0, 5)
                    .map((s) => s.name)
                    .filter(Boolean)
                    .join(", ");
                const more =
                    fullMonthLeave.length > 5 ? ` (+${fullMonthLeave.length - 5} more)` : "";
                showToast(
                    `${baseMsg} Skipped (full-month approved leave): ${names}${more}`.trim(),
                    "info"
                );
            } else {
                showToast(baseMsg, "success");
            }
            fetchData();
        } catch (error) {
            const errorMsg = error.message.includes('Unexpected token') 
                ? "Backend error. Please check your server." 
                : error.message;
            showToast(errorMsg || "Failed to generate slips.", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) return <div className={styles.loading}>Loading...</div>;

    const months = ["All", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const years = buildYearList({
        fromDataYears: yearsFromSalarySlips(salarySlips),
        pastYears: 25,
        futureYears: 5,
        includeAll: true,
    });

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h2 className={styles.title}>
                        {isAdmin
                            ? (reportType === 'salary' ? 'Salary Slips' : 'Expense Reports')
                            : (employeeTab === 'salary' ? 'Salary Slips' : 'My Expenses')}
                    </h2>
                    <p className={styles.subtitle}>
                        {isAdmin
                            ? (reportType === 'salary'
                                ? "Manage and import employee salary slips"
                                : "Review and manage employee expense requests")
                            : (employeeTab === 'salary'
                                ? "View and download your monthly salary slips"
                                : "View and track your expense requests")}
                    </p>
                </div>
                <div className={styles.actions}>
                    {isAdmin && (
                        <div className={styles.filters}>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className={styles.reportTypeSelect}
                            >
                                <option value="salary">Salary Report</option>
                                <option value="expense">Expense Report</option>
                            </select>
                            {reportType === 'salary' && (
                                <>
                                    <select
                                        value={periodPreset === "manual" ? "manual" : periodPreset}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === "manual") {
                                                setPeriodPreset("manual");
                                                return;
                                            }
                                            handlePeriodChange(value);
                                        }}
                                        className={styles.select}
                                        title="Period filter"
                                    >
                                        {PERIOD_PRESETS.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                        <option value="manual">Month / Year</option>
                                    </select>
                                    {periodPreset === "custom" && (
                                        <>
                                            <input
                                                type="date"
                                                value={customFrom}
                                                onChange={(e) => setCustomFrom(e.target.value)}
                                                className={styles.select}
                                                title="From Date"
                                            />
                                            <input
                                                type="date"
                                                value={customTo}
                                                onChange={(e) => setCustomTo(e.target.value)}
                                                className={styles.select}
                                                title="To Date"
                                            />
                                        </>
                                    )}
                                    {(periodPreset === "manual" || periodPreset === "this_month") && (
                                        <>
                                            <select value={selectedMonth} onChange={(e) => handleMonthChange(e.target.value)} className={styles.select}>
                                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} className={styles.select}>
                                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </>
                                    )}
                                    {periodPreset !== "manual" && periodPreset !== "this_month" && periodPreset !== "custom" && (
                                        <span className={styles.periodHint}>
                                            {periodPreset === "today" && "Created today"}
                                            {periodPreset === "this_year" && `Year ${new Date().getFullYear()}`}
                                        </span>
                                    )}
                                    <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className={styles.select}>
                                        <option value="All">All Departments</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <div className={styles.searchContainer}>
                                        <input 
                                            type="text" 
                                            placeholder="Search Employee..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className={styles.searchInput}
                                        />
                                        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleExcelExport}
                                        className={styles.excelBtn}
                                        disabled={isExcelExporting || isBulkDownloading}
                                    >
                                        {isExcelExporting ? (
                                            <div className={styles.spinner}></div>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="8" y1="13" x2="16" y2="13"></line>
                                                <line x1="8" y1="17" x2="16" y2="17"></line>
                                                <line x1="10" y1="9" x2="10" y2="9"></line>
                                            </svg>
                                        )}
                                        <span>{isExcelExporting ? "Exporting..." : "Excel Export"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBulkDownload}
                                        className={styles.bulkDownloadBtn}
                                        disabled={isBulkDownloading || isExcelExporting}
                                    >
                                        {isBulkDownloading ? (
                                            <div className={styles.spinner}></div>
                                        ) : (
                                            <DownloadIcon />
                                        )}
                                        <span>
                                            {isBulkDownloading
                                                ? `Preparing ${bulkProgress.done}/${bulkProgress.total || "…"}…`
                                                : "Bulk Download"}
                                        </span>
                                    </button>
                                </>
                            )}
                            {reportType === 'expense' && (
                                <div className={styles.searchContainer}>
                                    <input 
                                        type="text" 
                                        placeholder="Search Employee..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={styles.searchInput}
                                    />
                                    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </div>
                            )}
                        </div>
                    )}
                    {canManageSlips && reportType === 'salary' && (
                        <>
                            <button onClick={() => setIsManualAddModalOpen(true)} className={styles.addBtn}>
                                <img src={plus} alt="" className={styles.addBtnIcon} />
                                <span>Create Salary Slip</span>
                            </button>
                            <button 
                                onClick={handleGenerateBulk} 
                                className={styles.generateBtn}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <div className={styles.spinner}></div>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 2v6h-6"></path>
                                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                                        <path d="M3 22v-6h6"></path>
                                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                                    </svg>
                                )}
                                <span>{isGenerating ? 'Generating...' : 'Auto-Generate for All'}</span>
                            </button>
                            {/* <div className={styles.importWrapper}>
                                </button>
                            </div> */}
                            {selectedSlips.length > 0 && (
                                <button
                                    onClick={() => setBulkDeleteConfirmOpen(true)}
                                    className={styles.bulkDeleteBtn}
                                >
                                    <TrashIcon />
                                    <span>Delete Selected ({selectedSlips.length})</span>
                                </button>
                            )}
                        </>
                    )}
                    {!isAdmin && (employeeTab === 'expense') && (
                        <button onClick={() => setIsExpenseModalOpen(true)} className={styles.expenseBtn}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                            <span>Create Expense</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Employee Tab Controls */}
            {!isAdmin && (
                <div className={styles.tabControls}>
                    <div className={styles.tabButtons}>
                        <button
                            className={`${styles.tabButton} ${employeeTab === 'salary' ? styles.tabButtonActive : ''}`}
                            onClick={() => setEmployeeTab('salary')}
                        >
                            Salary Slip
                        </button>
                        <button
                            className={`${styles.tabButton} ${employeeTab === 'expense' ? styles.tabButtonActive : ''}`}
                            onClick={() => setEmployeeTab('expense')}
                        >
                            Expense
                        </button>
                    </div>
                </div>
            )}

            <div className={`${styles.tableWrapper} hrms-table-scroll`}>
                {/* Salary Slips Table */}
                {((isAdmin && reportType === 'salary') || (!isAdmin && (employeeTab === 'salary'))) && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {canManageSlips && (
                                    <th className={styles.checkboxColumn}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={currentSlips.length > 0 && selectedSlips.length === currentSlips.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                )}
                                <th>Employee Name</th>
                                {isAdmin && <th>Email ID</th>}
                                <th>Designation</th>
                                {isAdmin && <th>Month</th>}
                                {isAdmin && <th>Year</th>}
                                {!isAdmin && <th>Month & Year</th>}
                                <th>BASIC (AED)</th>
                                <th>HOUSE RENT (AED)</th>
                                <th>TRAVEL EXP (AED)</th>
                                <th>OTHER (AED)</th>
                                <th>DEDUCTION (AED)</th>
                                <th>Net Salary (AED)</th>
                                <th className={styles.actionsColumn}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentSlips.length > 0 ? (
                                currentSlips.map((slip) => (
                                    <tr key={slip._id} className={selectedSlips.includes(slip._id) ? styles.selectedRow : ""}>
                                        {canManageSlips && (
                                            <td className={styles.checkboxColumn}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkbox}
                                                    checked={selectedSlips.includes(slip._id)}
                                                    onChange={() => handleSelectRow(slip._id)}
                                                />
                                            </td>
                                        )}
                                        <td className={styles.empName}>{slip.employeeName}</td>
                                        {isAdmin && (
                                            <td>
                                                {(slip.emailId && !slip.emailId.includes('import.hrms.placeholder')) 
                                                    ? slip.emailId 
                                                    : '-'}
                                            </td>
                                        )}
                                        <td>{slip.designation}</td>
                                        {isAdmin && <td>{slip.month}</td>}
                                        {isAdmin && <td>{slip.year}</td>}
                                        {!isAdmin && <td className={styles.monthYear}>{slip.month} {slip.year}</td>}
                                        <td>{Number(slip.basicPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>{Number(slip.hra ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>{Number(slip.conveyanceAllowance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>{Number(slip.otherAllowance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>{Number(slip.deductionsPFTax ?? slip.totalDeduction ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td><span className={styles.netSal}>{formatAed(slip.netSalary ?? 0)}</span></td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button
                                                    className={styles.downloadBtn}
                                                    onClick={() => handleDownload(slip)}
                                                    title="Download PDF"
                                                >
                                                    <DownloadIcon />
                                                    {!isAdmin && <span>Download</span>}
                                                </button>
                                                {canManageSlips && (
                                                    <button
                                                        className={styles.editBtn}
                                                        onClick={() => {
                                                            setSlipToEdit(slip);
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        title="Edit Record"
                                                    >
                                                        <EditIcon />
                                                    </button>
                                                )}
                                                {canManageSlips && (
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={() => openDeleteDialog(slip)}
                                                        title="Delete Record"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isAdmin ? 14 : 9} className={styles.noData}>
                                        No salary slips found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Expense Reports Table (Admin Only) */}
                {isAdmin && reportType === 'expense' && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Employee Name</th>
                                <th>Email ID</th>
                                <th>Expense Title</th>
                                <th>Category</th>
                                <th>Amount (AED)</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th className={styles.actionsColumn}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentExpenses.length > 0 ? (
                                currentExpenses.map((expense) => (
                                    <tr key={expense._id}>
                                        <td className={styles.empName}>{expense.employeeName}</td>
                                        <td>{expense.employeeEmail}</td>
                                        <td>{expense.expenseTitle}</td>
                                        <td>
                                            <span className={styles.categoryBadge}>{expense.expenseCategory}</span>
                                        </td>
                                        <td><span className={styles.expenseAmount}>{formatAed(expense.expenseAmount)}</span></td>
                                        <td>{new Date(expense.expenseDate).toLocaleDateString('en-IN')}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[`status${expense.status?.replace(/\s/g, '')}`]}`}>
                                                {expense.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button
                                                    className={styles.viewBtn}
                                                    onClick={() => {
                                                        showToast(`Description: ${expense.expenseDescription}`, 'info');
                                                    }}
                                                    title="View Details"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                        <circle cx="12" cy="12" r="3"></circle>
                                                    </svg>
                                                </button>
                                                {expense.receiptUrl && (
                                                    <button
                                                        className={styles.downloadBtn}
                                                        onClick={async () => {
                                                            try {
                                                                await expenseService.downloadDocument(expense._id, expense.expenseTitle);
                                                                showToast('Document downloaded successfully', 'success');
                                                            } catch (error) {
                                                                showToast(error.message || 'Failed to download document', 'error');
                                                            }
                                                        }}
                                                        title="Download Document"
                                                    >
                                                        <DownloadIcon />
                                                    </button>
                                                )}
                                                {canApproveExpense(expense) ? (
                                                    <>
                                                        <button
                                                            className={styles.approveBtn}
                                                            onClick={() => handleApproveExpense(expense)}
                                                            title={isHOD ? "Approve (Send to HR Admin)" : "Final Approve"}
                                                        >
                                                            <CheckIcon />
                                                        </button>
                                                        <button
                                                            className={styles.rejectBtn}
                                                            onClick={() => handleRejectExpense(expense)}
                                                            title="Reject"
                                                        >
                                                            <XIcon />
                                                        </button>
                                                    </>
                                                ) : (
                                                    expense.status !== 'Pending' && expense.status !== 'HOD Approved' && (
                                                        <span className={styles.noAction}>—</span>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className={styles.noData}>
                                        No expense reports found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Employee Expenses Table */}
                {!isAdmin && (employeeTab === 'expense') && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Expense Title</th>
                                <th>Category</th>
                                <th>Amount (AED)</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Document</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentMyExpenses.length > 0 ? (
                                currentMyExpenses.map((expense) => (
                                    <tr key={expense._id}>
                                        <td className={styles.empName}>{expense.expenseTitle}</td>
                                        <td>
                                            <span className={styles.categoryBadge}>{expense.expenseCategory}</span>
                                        </td>
                                        <td><span className={styles.expenseAmount}>{formatAed(expense.expenseAmount)}</span></td>
                                        <td>{new Date(expense.expenseDate).toLocaleDateString('en-IN')}</td>
                                        <td className={styles.descriptionCell}>{expense.expenseDescription}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[`status${expense.status?.replace(/\s/g, '')}`]}`}>
                                                {expense.status}
                                            </span>
                                        </td>
                                        <td>
                                            {expense.receiptUrl ? (
                                                <button
                                                    className={styles.downloadBtn}
                                                    onClick={async () => {
                                                        try {
                                                            await expenseService.downloadDocument(expense._id, expense.expenseTitle);
                                                            showToast('Document downloaded successfully', 'success');
                                                        } catch (error) {
                                                            showToast(error.message || 'Failed to download document', 'error');
                                                        }
                                                    }}
                                                    title="Download Document"
                                                >
                                                    <DownloadIcon />
                                                </button>
                                            ) : (
                                                <span className={styles.noDocument}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className={styles.noData}>
                                        No expense requests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <div className={styles.paginationInfo}>
                        Showing {startIndex + 1} to {Math.min(endIndex, currentData.length)} of {currentData.length} entries
                    </div>
                    <div className={styles.paginationControls}>
                        <button
                            className={styles.pageBtn}
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>

                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} className={styles.pageEllipsis}>...</span>
                            ) : (
                                <button
                                    key={page}
                                    className={`${styles.pageBtn} ${currentPage === page ? styles.pageBtnActive : ''}`}
                                    onClick={() => handlePageChange(page)}
                                >
                                    {page}
                                </button>
                            )
                        ))}

                        <button
                            className={styles.pageBtn}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
            )}
            {/* Single Delete Confirmation */}
            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={closeDeleteDialog}
                onConfirm={confirmDelete}
                title="Delete Salary Slip"
                message={<>Are you sure you want to delete the salary slip for <strong>{slipToDelete?.employeeName}</strong>? This action cannot be undone.</>}
                confirmText="Delete"
                confirmColor="#dc2626"
            />

            {/* Bulk Delete Confirmation */}
            <ConfirmDialog
                isOpen={bulkDeleteConfirmOpen}
                onClose={() => setBulkDeleteConfirmOpen(false)}
                onConfirm={handleBulkDelete}
                title="Delete Multiple Records"
                message={`Are you sure you want to delete ${selectedSlips.length} selected salary slips? This action cannot be undone.`}
                confirmText="Delete All"
                confirmColor="#dc2626"
            />

            {/* Bulk Generate Confirmation */}
            <ConfirmDialog
                isOpen={generateConfirmOpen}
                onClose={() => setGenerateConfirmOpen(false)}
                onConfirm={confirmGenerateBulk}
                title="Generate Salary Slips"
                message={`Generate or update salary slips for ${selectedMonth} ${selectedYear}? Missing eligible employees will be added; existing slips for this month will be updated.`}
                confirmText={salarySlips.length > 0 ? "Regenerate Now" : "Generate Now"}
                confirmColor="#16a34a"
                icon="success"
            />

            <SalarySlipBulkImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={fetchData}
                month={selectedMonth === 'All' ? new Date().toLocaleString('default', { month: 'long' }) : selectedMonth}
                year={selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear}
            />

            <SalarySlipManualAddModal
                isOpen={isManualAddModalOpen}
                onClose={() => setIsManualAddModalOpen(false)}
                onSuccess={fetchData}
                month={selectedMonth === 'All' ? new Date().toLocaleString('default', { month: 'long' }) : selectedMonth}
                year={selectedYear === 'All' ? new Date().getFullYear().toString() : selectedYear}
                existingSlips={salarySlips}
            />

            <SalarySlipEditModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSlipToEdit(null);
                }}
                onSuccess={fetchData}
                salarySlip={slipToEdit}
            />

            {/* Create Expense Modal for Employees */}
            {!isAdmin && (
                <CreateExpenseModal
                    isOpen={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    showToast={showToast}
                />
            )}
        </div>
    );
}

export default SalarySlipTable;
