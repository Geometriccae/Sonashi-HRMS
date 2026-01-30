import React, { useState, useEffect, useCallback } from "react";
import styles from "./SalarySlipTable.module.css";
import plus from "../../assets/dashboard/plus.svg";
import { useToast } from "../../context/ToastContext";
import salarySlipService from "../../services/SalarySlipService";
import expenseService from "../../services/ExpenseService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import SalarySlipBulkImportModal from "./SalarySlipBulkImportModal";
import SalarySlipManualAddModal from "./SalarySlipManualAddModal";
import SalarySlipEditModal from "./SalarySlipEditModal";

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

// Delete Confirmation Dialog Component
const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, employeeName }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.dialogContent}>
                <div className={styles.dialogIcon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3 className={styles.dialogTitle}>Delete Salary Slip</h3>
                <p className={styles.dialogMessage}>
                    Are you sure you want to delete the salary slip for <strong>{employeeName}</strong>? This action cannot be undone.
                </p>
                <div className={styles.dialogActions}>
                    <button className={styles.dialogCancelBtn} onClick={onClose}>Cancel</button>
                    <button className={styles.dialogDeleteBtn} onClick={onConfirm}>Delete</button>
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
            // Join categories as comma-separated string for backend
            const submitData = {
                ...formData,
                expenseCategory: formData.expenseCategory.join(', ')
            };
            await expenseService.createExpense(submitData);
            showToast('Expense request submitted successfully! It will be reviewed by HOD and HR.', 'success');
            setFormData({
                expenseTitle: '',
                expenseDescription: '',
                expenseAmount: '',
                expenseDate: new Date().toISOString().split('T')[0],
                expenseCategory: []
            });
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
                            <label className={styles.formLabel}>Amount (₹) *</label>
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
                            <input
                                type="date"
                                name="expenseDate"
                                value={formData.expenseDate}
                                onChange={handleChange}
                                className={styles.formInput}
                                required
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
    const isHOD = userRole === "hod";
    const isAdminRole = userRole === "admin";
    const isAdmin = isAdminRole || isHOD;
    const { showToast } = useToast();
    const [salarySlips, setSalarySlips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [slipToDelete, setSlipToDelete] = useState(null);

    // Default to 'All' for admin to display all imported data immediately
    const [selectedMonth, setSelectedMonth] = useState(isAdmin ? "All" : new Date().toLocaleString('default', { month: 'long' }));
    const [selectedYear, setSelectedYear] = useState(isAdmin ? "All" : new Date().getFullYear().toString());
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

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isAdmin) {
                if (reportType === 'salary') {
                    const data = await salarySlipService.getAllSalarySlips(selectedMonth.trim(), selectedYear.trim());
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
            setCurrentPage(1); // Reset to first page on data change
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("Failed to fetch data.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [isAdmin, selectedMonth, selectedYear, reportType, employeeTab, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Pagination calculations - works for both salary slips and expenses
    const currentData = isAdmin
        ? (reportType === 'expense' ? expenses : salarySlips)
        : (employeeTab === 'expense' ? myExpenses : salarySlips);
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentSlips = salarySlips.slice(startIndex, endIndex);
    const currentExpenses = expenses.slice(startIndex, endIndex);
    const currentMyExpenses = myExpenses.slice(startIndex, endIndex);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleDownload = (slip) => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 15;

            // 1. Header (Company Info)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.text("AUXIN", margin, 20);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("Dindigul, Tamil Nadu, India", margin, 26);

            // 2. Bar: Payslip for the month
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, 35, pageWidth - (margin * 2), 10, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(margin, 35, pageWidth - (margin * 2), 10, 'S');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text(`Payslip for the month of ${slip.month} ${slip.year}`, pageWidth / 2, 41.5, { align: "center" });

            // 3. Employee Pay Summary Section
            let currentY = 55;
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("EMPLOYEE PAY SUMMARY", margin, currentY);

            doc.setDrawColor(226, 232, 240);
            doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

            currentY += 10;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);

            // Left Column
            doc.text(`Employee Name  : ${slip.employeeName}`, margin, currentY);
            doc.text(`Designation           : ${slip.designation}`, margin, currentY + 7);
            doc.text(`Email ID                : ${slip.emailId}`, margin, currentY + 14);

            // Right Column
            const rightColX = pageWidth / 2 + 10;
            doc.text(`Pay Date               : ${new Date().toLocaleDateString()}`, rightColX, currentY);
            doc.text(`Location                : Dindigul`, rightColX, currentY + 7);
            doc.text(`Pay Period            : ${slip.month} ${slip.year}`, rightColX, currentY + 14);

            currentY += 25;

            // 4. Earnings & Deductions Table (Combined Design)
            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin },
                theme: 'plain',
                head: [['EARNINGS', 'AMOUNT', 'DEDUCTIONS', 'AMOUNT']],
                body: [
                    ['Basic Salary', `Rs. ${slip.basicPay.toLocaleString()}`, 'PF / Tax', `Rs. ${slip.deductionsPFTax.toLocaleString()}`],
                    ['HRA', `Rs. ${slip.hra.toLocaleString()}`, '', ''],
                    ['', '', '', ''],
                ],
                headStyles: {
                    fillColor: [248, 250, 252],
                    textColor: [30, 41, 59],
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [226, 232, 240]
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 4,
                    textColor: [71, 85, 105],
                    lineWidth: 0.1,
                    lineColor: [226, 232, 240]
                },
                columnStyles: {
                    1: { halign: 'right' },
                    3: { halign: 'right' }
                }
            });

            currentY = doc.lastAutoTable.finalY;

            // 5. Totals Bar
            const grossEarnings = slip.basicPay + slip.hra;
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, currentY, (pageWidth - margin * 2) / 2, 10, 'F');
            doc.rect(pageWidth / 2, currentY, (pageWidth - margin * 2) / 2, 10, 'F');
            doc.rect(margin, currentY, pageWidth - margin * 2, 10, 'S');

            doc.setFont("helvetica", "bold");
            doc.text("Gross Earnings", margin + 2, currentY + 6.5);
            doc.text(`Rs. ${grossEarnings.toLocaleString()}`, pageWidth / 2 - 5, currentY + 6.5, { align: "right" });

            doc.text("Total Deductions", pageWidth / 2 + 2, currentY + 6.5);
            doc.text(`Rs. ${slip.deductionsPFTax.toLocaleString()}`, pageWidth - margin - 2, currentY + 6.5, { align: "right" });

            // 6. Total Net Payable Box
            currentY += 15;
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, currentY, pageWidth - margin * 2, 20, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(margin, currentY, pageWidth - margin * 2, 20, 'S');

            doc.setFontSize(12);
            doc.text(`Total Net Payable   Rs. ${slip.netSalary.toLocaleString()}`, pageWidth / 2, currentY + 10, { align: "center" });

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text("**Total Net Payable = Gross Earnings - Total Deductions", pageWidth / 2, currentY + 16, { align: "center" });

            // 7. Signatures
            currentY += 50;
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);

            doc.line(margin + 5, currentY, margin + 65, currentY);
            doc.text("Employee Signature", margin + 35, currentY + 5, { align: "center" });

            doc.line(pageWidth - margin - 65, currentY, pageWidth - margin - 5, currentY);
            doc.text("HR Signature", pageWidth - margin - 35, currentY + 5, { align: "center" });

            // 8. Footer
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("System Generated Payslip", pageWidth / 2, 285, { align: "center" });

            // Output
            doc.save(`Payslip_${slip.emailId}_${slip.month}_${slip.year}.pdf`);
            showToast("Payslip downloaded successfully.", "success");
        } catch (error) {
            console.error("PDF generation failed:", error);
            showToast("Failed to generate premium payslip.", "error");
        }
    };

    const openDeleteDialog = (slip) => {
        setSlipToDelete(slip);
        setDeleteDialogOpen(true);
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

    if (isLoading) return <div className={styles.loading}>Loading...</div>;

    const months = ["All", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const years = ["All", currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];

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
                                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={styles.select}>
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={styles.select}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    )}
                    {isAdmin && reportType === 'salary' && (
                        <>
                            <button onClick={() => setIsManualAddModalOpen(true)} className={styles.addBtn}>
                                <img src={plus} alt="" className={styles.addBtnIcon} />
                                <span>Create Salary Slip</span>
                            </button>
                            <div className={styles.importWrapper}>
                                <button onClick={() => setIsImportModalOpen(true)} className={styles.importButton}>
                                    <img src={plus} alt="" className={styles.plusIcon} />
                                    <span>Bulk Import</span>
                                </button>
                            </div>
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

            <div className={styles.tableWrapper}>
                {/* Salary Slips Table */}
                {((isAdmin && reportType === 'salary') || (!isAdmin && (employeeTab === 'salary'))) && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Employee Name</th>
                                {isAdmin && <th>Email ID</th>}
                                <th>Designation</th>
                                {isAdmin && <th>Month</th>}
                                {isAdmin && <th>Year</th>}
                                {!isAdmin && <th>Month & Year</th>}
                                <th>Basic Pay (₹)</th>
                                <th>HRA (₹)</th>
                                <th>Deductions (PF/Tax)</th>
                                <th>Net Salary (₹)</th>
                                <th className={styles.actionsColumn}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentSlips.length > 0 ? (
                                currentSlips.map((slip) => (
                                    <tr key={slip._id}>
                                        <td className={styles.empName}>{slip.employeeName}</td>
                                        {isAdmin && <td>{slip.emailId}</td>}
                                        <td>{slip.designation}</td>
                                        {isAdmin && <td>{slip.month}</td>}
                                        {isAdmin && <td>{slip.year}</td>}
                                        {!isAdmin && <td className={styles.monthYear}>{slip.month} {slip.year}</td>}
                                        <td>{slip.basicPay.toLocaleString()}</td>
                                        <td>{slip.hra.toLocaleString()}</td>
                                        <td>{slip.deductionsPFTax.toLocaleString()}</td>
                                        <td><span className={styles.netSal}>₹{slip.netSalary.toLocaleString()}</span></td>
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
                                                {isAdmin && (
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
                                                {isAdmin && (
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
                                    <td colSpan={isAdmin ? 11 : 7} className={styles.noData}>
                                        No salary slips found {selectedMonth !== 'All' || selectedYear !== 'All' ? `for ${selectedMonth} ${selectedYear}` : 'in the system'}.
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
                                <th>Amount (₹)</th>
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
                                        <td><span className={styles.expenseAmount}>₹{expense.expenseAmount?.toLocaleString()}</span></td>
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
                                <th>Amount (₹)</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Status</th>
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
                                        <td><span className={styles.expenseAmount}>₹{expense.expenseAmount?.toLocaleString()}</span></td>
                                        <td>{new Date(expense.expenseDate).toLocaleDateString('en-IN')}</td>
                                        <td className={styles.descriptionCell}>{expense.expenseDescription}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[`status${expense.status?.replace(/\s/g, '')}`]}`}>
                                                {expense.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className={styles.noData}>
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

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={closeDeleteDialog}
                onConfirm={confirmDelete}
                employeeName={slipToDelete?.employeeName || ''}
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
