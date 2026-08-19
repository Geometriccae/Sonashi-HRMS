import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./LeaveRequestTable.module.css";
import plus from "../../assets/dashboard/plus.svg";
import leaveRequestService from "../../services/LeaveRequestService";
import employeeService from "../../services/EmployeeService";
import DeleteModal from "../delete-modal/DeleteModal";
import AddLeaveRequestModal from "./AddLeaveRequestModal";
import EditLeaveRequestModal from "./EditLeaveRequestModal";
import LeaveApplicationFormModal from "./LeaveApplicationFormModal";
import ImportLeaveExcelModal from "./ImportLeaveExcelModal";
import { useToast } from "../../context/ToastContext";
import OptionService from "../../services/OptionService";
import Select from "react-select";
import DateInput from "../DateInput";
import { DEPARTMENT_OPTIONS_DEFAULT } from "../../constants/employeeDropdownOptions";
import {
    canManageLeaves as checkCanManageLeaves,
    canCreateLeaves,
    canEditLeaves,
    canApproveLeaveRequest,
    getUserRole,
} from "../../utils/permissions";
import { buildYearList, yearsFromLeaveRequests } from "../../utils/yearOptions";
import {
    readPersistedPage,
    writePersistedPage,
    writePersistedPath,
    useResetPageOnFilterChange,
} from "../../hooks/usePersistedListPage";

const EditIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const DeleteIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const CheckIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const XIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const ViewIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const RevertIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
);

function LeaveRequestTable({ onUpdate }) {
    const { showToast } = useToast();
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("All");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [userRole, setUserRole] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();

    // Page from URL, else last session page (survives sidebar navigation)
    const currentPage = Math.max(
        1,
        Number(searchParams.get("page")) || readPersistedPage("leave-requests", 1)
    );

    const setCurrentPage = useCallback((page) => {
        const safe = Math.max(1, Math.floor(Number(page) || 1));
        writePersistedPage("leave-requests", safe);
        const path = safe <= 1 ? "/leave-requests" : `/leave-requests?page=${safe}`;
        writePersistedPath("leave-requests", path);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (safe <= 1) next.delete("page");
            else next.set("page", String(safe));
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const resetToFirstPage = useCallback(() => {
        setCurrentPage(1);
    }, [setCurrentPage]);

    // Sync session whenever page is shown (including restore from session into URL)
    useEffect(() => {
        writePersistedPage("leave-requests", currentPage);
        const path = currentPage <= 1 ? "/leave-requests" : `/leave-requests?page=${currentPage}`;
        writePersistedPath("leave-requests", path);
        if (!searchParams.get("page") && currentPage > 1) {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("page", String(currentPage));
                return next;
            }, { replace: true });
        }
    }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDept, setSelectedDept] = useState("All");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedManager, setSelectedManager] = useState("All");
    const [selectedMonth, setSelectedMonth] = useState(() => searchParams.get("month") || "All");
    // Default current year so Leave Management shows that year's records (change dropdown for 2022–2025 etc.)
    const [selectedYear, setSelectedYear] = useState(() => searchParams.get("year") || String(new Date().getFullYear()));
    const [selectedLeaveType] = useState(() => searchParams.get("leaveType") || "All");
    const [departments, setDepartments] = useState([]);
    const [managers, setManagers] = useState([]);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvalAction, setApprovalAction] = useState(null); // { type: 'approve' | 'reject', request: object }
    const [revertModal, setRevertModal] = useState(null);
    const [isReverting, setIsReverting] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const itemsPerPage = 10;

    const isHOD = String(userRole || "").toLowerCase() === "hod";
    const isAdminRole = String(userRole || "").toLowerCase() === "admin";
    const isHR = String(userRole || "").toLowerCase() === "hr";
    const roleLower = String(userRole || "").toLowerCase();
    const isViewerRole = roleLower === "viewer" || roleLower === "authorize_user";
    const canManageLeaves = checkCanManageLeaves(userRole);
    const canCreateLeaveRequests = canCreateLeaves(userRole);
    const canEditLeaveRequests = canEditLeaves(userRole);

    const fetchLeaveRequests = async () => {
        setIsLoading(true);
        try {
            const data = await leaveRequestService.getLeaveRequests();
            setLeaveRequests(data);
            
            // Extract unique managers from data in the table
            const uniqueManagers = [...new Set(data.map(req => req.reportingManager).filter(Boolean))];
            setManagers(uniqueManagers.sort());

            // Extract unique departments from data in the table
            const uniqueDepts = [...new Set(data.map(req => req.department).filter(Boolean))];
            setDepartments(uniqueDepts.sort());
            
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error fetching leave requests:", error);
            showToast("Failed to fetch leave requests.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setUserRole(getUserRole());
        fetchLeaveRequests();
    }, []);

    const handleEdit = (request) => {
        setSelectedRequest(request);
        setIsEditModalOpen(true);
    };

    const handleEditFromOverview = (leave) => {
        setIsFormModalOpen(false);
        setSelectedRequest(leave);
        setIsEditModalOpen(true);
    };

    const handleDelete = (request) => {
        setSelectedRequest(request);
        setIsDeleteModalOpen(true);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(paginatedRequests.map(req => req._id));
        } else {
            setSelectedRows([]);
        }
    };

    const toggleSelectRow = (id) => {
        if (selectedRows.includes(id)) {
            setSelectedRows(selectedRows.filter(rowId => rowId !== id));
        } else {
            setSelectedRows([...selectedRows, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRows.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} leave requests? This cannot be undone.`)) return;
        
        setIsDeletingBulk(true);
        try {
            await leaveRequestService.bulkDelete(selectedRows);
            showToast(`Successfully deleted ${selectedRows.length} leave requests`, "success");
            setSelectedRows([]);
            fetchLeaveRequests();
        } catch (error) {
            console.error("Error bulk deleting:", error);
            showToast(error.response?.data?.message || "Failed to delete selected leave requests", "error");
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const handleViewForm = (request) => {
        setSelectedRequest(request);
        setIsFormModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            await leaveRequestService.deleteLeaveRequest(selectedRequest._id);
            showToast("Leave request deleted successfully.", "success");
            fetchLeaveRequests();
            setIsDeleteModalOpen(false);
        } catch (error) {
            showToast("Failed to delete leave request.", "error");
        }
    };

    const handleApprove = (request) => {
        setApprovalAction({ type: 'approve', request });
        setIsApprovalModalOpen(true);
    };

    const handleReject = (request) => {
        setApprovalAction({ type: 'reject', request });
        setIsApprovalModalOpen(true);
    };

    const confirmApprovalAction = async () => {
        if (!approvalAction) return;
        const { type, request } = approvalAction;
        
        try {
            if (type === 'approve') {
                await leaveRequestService.approveLeaveRequest(request._id, "Approved");
                showToast("Leave request approved successfully.", "success");
            } else {
                await leaveRequestService.approveLeaveRequest(request._id, "Rejected");
                showToast("Leave request rejected successfully.", "success");
            }
            // Yet to go uses employee vacationStatus — clear stale employee list cache
            employeeService.invalidateCache();
            fetchLeaveRequests();
            setIsApprovalModalOpen(false);
            setApprovalAction(null);
        } catch (error) {
            console.error(`Error ${type}ing leave request:`, error);
            const errorMessage = error.response?.data?.message || `Failed to ${type} leave request.`;
            showToast(errorMessage, "error");
            setIsApprovalModalOpen(false);
            setApprovalAction(null);
        }
    };

    const isUnavailedLeave = (request) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(request.startDate);
        start.setHours(0, 0, 0, 0);
        return start > today;
    };

    const canRevertLeave = (request) => {
        if (!canManageLeaves) return false;
        if (request.status !== "Approved" && request.status !== "HOD Approved") return false;
        return isUnavailedLeave(request);
    };

    const handleRevert = (request) => {
        setRevertModal({ request });
    };

    const confirmRevert = async () => {
        if (!revertModal?.request) return;
        setIsReverting(true);
        try {
            const result = await leaveRequestService.revertLeaveRequest(revertModal.request._id);
            const days = result.creditedDays != null ? ` (${result.creditedDays} day(s) credited back)` : "";
            showToast(`Leave reverted successfully${days}.`, "success");
            setRevertModal(null);
            fetchLeaveRequests();
        } catch (error) {
            const msg = error.response?.data?.message
                || (error.response?.status === 404 ? "Revert API not found. Please restart the backend server." : null)
                || "Failed to revert leave request.";
            showToast(msg, "error");
        } finally {
            setIsReverting(false);
        }
    };

    const uniqueYears = buildYearList({
        fromDataYears: yearsFromLeaveRequests(leaveRequests),
        pastYears: 25,
        futureYears: 5,
    });

    const yearOptions = [
        { value: "All", label: "All Years" },
        ...uniqueYears.map(year => ({ value: String(year), label: String(year) }))
    ];

    /** Calendar year of leave start — matches Duration year display (UTC / ISO date). */
    const getLeaveStartYear = (dateVal) => {
        if (!dateVal) return null;
        if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
            return Number(dateVal.slice(0, 4));
        }
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return null;
        return d.getUTCFullYear();
    };

    const monthOptions = [
        { value: "All", label: "Month" },
        { value: "0", label: "January" },
        { value: "1", label: "February" },
        { value: "2", label: "March" },
        { value: "3", label: "April" },
        { value: "4", label: "May" },
        { value: "5", label: "June" },
        { value: "6", label: "July" },
        { value: "7", label: "August" },
        { value: "8", label: "September" },
        { value: "9", label: "October" },
        { value: "10", label: "November" },
        { value: "11", label: "December" }
    ];

    const filteredRequests = leaveRequests.filter(req => {
        // Status Filter (Segmented Control)
        if (activeFilter !== "All") {
            if (activeFilter === "History") {
                if (req.status !== "Approved" && req.status !== "Rejected" && req.status !== "Cancelled") return false;
            } else if (req.status !== activeFilter) {
                return false;
            }
        }

        // Search Query (Name or ID)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const name = (req.employee?.username || req.employeeName || "").toLowerCase();
            const id = (req.employeeId || "").toLowerCase();
            if (!name.includes(query) && !id.includes(query)) return false;
        }

        // Department Filter
        if (selectedDept !== "All" && req.department !== selectedDept) return false;

        // Manager Filter
        if (selectedManager !== "All" && req.reportingManager !== selectedManager) return false;

        // Date Range Filter
        if (startDate) {
            const reqStart = new Date(req.startDate);
            const filterStart = new Date(startDate);
            if (reqStart < filterStart) return false;
        }
        if (endDate) {
            const reqEnd = new Date(req.endDate);
            const filterEnd = new Date(endDate);
            if (reqEnd > filterEnd) return false;
        }

        // Month Filter
        if (selectedMonth !== "All") {
            const d = new Date(req.startDate);
            if (Number.isNaN(d.getTime())) return false;
            const reqMonth = d.getUTCMonth(); // 0 to 11
            if (reqMonth !== parseInt(selectedMonth, 10)) return false;
        }

        // Year Filter — leave start year must match selected Year
        if (selectedYear !== "All") {
            const reqYear = getLeaveStartYear(req.startDate);
            if (reqYear == null || reqYear !== parseInt(selectedYear, 10)) return false;
        }

        if (selectedLeaveType && selectedLeaveType !== "All") {
            if (selectedLeaveType === "Annual Leave") {
                if (req.leaveType !== "Annual Leave" && req.leaveType !== "Vacation") return false;
            } else if (req.leaveType !== selectedLeaveType) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    // Determine which requests can be approved based on role + Admin/self rules
    const canApprove = (request) => canApproveLeaveRequest(request, userRole);

    // Strict UTC formatter for DD/MM/YYYY to completely prevent timezone shift
    const formatDisplayDate = (dateString) => {
        if (!dateString) return "N/A";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "N/A";
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    };

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage) || 1);
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

    // Clamp only after data is loaded — empty list briefly has totalPages=1 and was wiping restored page
    useEffect(() => {
        if (leaveRequests.length === 0) return;
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [leaveRequests.length, currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset page only when filters actually change (Strict Mode safe)
    useResetPageOnFilterChange(resetToFirstPage, {
        activeFilter,
        searchQuery,
        selectedDept,
        startDate,
        endDate,
        selectedManager,
        selectedMonth,
        selectedYear,
        selectedLeaveType,
    });

    // Handle page change
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
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

    // Official Holidays for 2026
    const OFFICIAL_HOLIDAYS_2026 = new Set([
        '2026-01-01', '2026-01-26', '2026-02-19', '2026-03-03', '2026-03-19',
        '2026-03-21', '2026-04-26', '2026-04-03', '2026-04-14', '2026-05-01',
        '2026-06-26', '2026-08-15', '2026-08-26', '2026-08-28', '2026-09-14',
        '2026-10-02', '2026-10-20', '2026-11-06', '2026-11-10', '2026-11-11',
        '2026-11-24', '2026-12-25'
    ]);

    // Calculate working days only (excluding weekends and public holidays)
    const calculateDays = (start, end) => {
        let workingDays = 0;
        const startDate = new Date(start);
        const endDate = new Date(end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const day = currentDate.getDay();
            const dateStr = currentDate.toISOString().split('T')[0];
            // Count only if not weekend (Sat=6, Sun=0) and not a holiday
            if (day !== 0 && day !== 6 && !OFFICIAL_HOLIDAYS_2026.has(dateStr)) {
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return workingDays;
    };

    if (isLoading) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Leave Management</h2>
                <div className={styles.actions}>
                    {canCreateLeaveRequests && isHR && (
                        <>
                            {selectedRows.length > 0 && (
                                <button 
                                    className={styles.addButton} 
                                    onClick={handleBulkDelete}
                                    disabled={isDeletingBulk}
                                    style={{ background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5" }}
                                >
                                    <span>{isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedRows.length})`}</span>
                                </button>
                            )}
                            <button className={`${styles.addButton} ${styles.importButton || ''}`} style={{ background: '#10b981' }} onClick={() => setIsImportModalOpen(true)}>
                                <span>Import Excel</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </button>
                        </>
                    )}
                    {canCreateLeaveRequests && isHR && (
                        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                            <span>Request Leave</span>
                            <img src={plus} alt="" />
                        </button>
                    )}
                    {canCreateLeaveRequests && isAdminRole && (
                        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                            <span>Request Leave</span>
                            <img src={plus} alt="" />
                        </button>
                    )}
                    {!canManageLeaves && canCreateLeaveRequests && (
                        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                            <span>Request Leave</span>
                            <img src={plus} alt="" />
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.controls}>
                <div className={styles.filterBar}>
                    <Select
                        placeholder="Year"
                        options={yearOptions}
                        value={
                            yearOptions.find((opt) => opt.value === selectedYear) || {
                                value: selectedYear,
                                label: selectedYear === "All" ? "All Years" : String(selectedYear),
                            }
                        }
                        onChange={(opt) => setSelectedYear(opt?.value || String(new Date().getFullYear()))}
                        styles={{
                            control: (base) => ({
                                ...base,
                                minHeight: "42px",
                                borderRadius: "8px",
                                borderColor: selectedYear !== "All" ? "#007aff" : "#e4e4e4",
                                fontSize: "0.875rem",
                                minWidth: "140px",
                                flex: "0 0 auto",
                                cursor: "pointer",
                                boxShadow:
                                    selectedYear !== "All"
                                        ? "0 0 0 2px rgba(0, 122, 255, 0.15)"
                                        : "none",
                            }),
                            menu: (base) => ({
                                ...base,
                                zIndex: 100,
                            }),
                        }}
                        maxMenuHeight={200}
                    />

                    <div className={styles.searchSection}>
                        <div className={styles.inputWrapper}>
                            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.selectSection}>
                        <Select
                            placeholder="Department"
                            options={[
                                { value: "All", label: "Department" },
                                ...departments.map(dept => ({ value: dept, label: dept }))
                            ]}
                            value={{ value: selectedDept, label: selectedDept === "All" ? "Department" : selectedDept }}
                            onChange={(opt) => setSelectedDept(opt.value)}
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    minHeight: '42px',
                                    borderRadius: '8px',
                                    borderColor: '#e4e4e4',
                                    fontSize: '0.875rem',
                                    minWidth: '160px',
                                    cursor: 'pointer'
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 100
                                })
                            }}
                            maxMenuHeight={200}
                        />

                        <Select
                            placeholder="Manager"
                            options={[
                                { value: "All", label: "Manager" },
                                ...managers.map(manager => ({ value: manager, label: manager }))
                            ]}
                            value={{ value: selectedManager, label: selectedManager === "All" ? "Manager" : selectedManager }}
                            onChange={(opt) => setSelectedManager(opt.value)}
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    minHeight: '42px',
                                    borderRadius: '8px',
                                    borderColor: '#e4e4e4',
                                    fontSize: '0.875rem',
                                    minWidth: '160px',
                                    cursor: 'pointer'
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 100
                                })
                            }}
                            maxMenuHeight={200}
                        />

                        <Select
                            placeholder="Month"
                            options={monthOptions}
                            value={monthOptions.find(opt => opt.value === selectedMonth)}
                            onChange={(opt) => setSelectedMonth(opt.value)}
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    minHeight: '42px',
                                    borderRadius: '8px',
                                    borderColor: '#e4e4e4',
                                    fontSize: '0.875rem',
                                    minWidth: '140px',
                                    cursor: 'pointer'
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 100
                                })
                            }}
                            maxMenuHeight={200}
                        />
                    </div>

                    <div className={styles.dateSection}>
                        <div className={styles.dateInputWrapper}>
                            <span>From:</span>
                            <DateInput
                                className={styles.dateInput}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className={styles.dateInputWrapper}>
                            <span>To:</span>
                            <DateInput
                                className={styles.dateInput}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <button 
                            className={styles.resetButton}
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedDept("All");
                                setSelectedManager("All");
                                setStartDate("");
                                setEndDate("");
                                setSelectedMonth("All");
                                setSelectedYear(String(new Date().getFullYear()));
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <div className={styles.segmentedControl}>
                    {(isAdminRole
                        ? ["All", "Pending", "Approved", "Rejected", "Cancelled", "History"]
                        : ["All", "Pending", "Approved", "Rejected", "Cancelled", "History"]
                    ).map(filter => (
                        <button
                            key={filter}
                            className={`${styles.filterButton} ${activeFilter === filter ? styles.active : ""}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {canEditLeaveRequests && isHR && (
                                <th style={{ width: "40px" }}>
                                    <input 
                                        type="checkbox" 
                                        checked={paginatedRequests && paginatedRequests.length > 0 && selectedRows.length === paginatedRequests.length}
                                        onChange={handleSelectAll}
                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                    />
                                </th>
                            )}
                            <th>Employee</th>
                            <th>Company</th>
                            <th>Department</th>
                            <th>Manager</th>
                            <th>Type</th>
                            {activeFilter === "History" ? (
                                <>
                                    <th>Reason</th>
                                    <th>Days</th>
                                    <th>Dates</th>
                                    <th>Ticket</th>
                                    <th>Status</th>
                                </>
                            ) : (
                                <>
                                    <th>Days</th>
                                    <th>Duration</th>
                                    <th>Ticket</th>
                                    <th>Status</th>
                                </>
                            )}
                            <th>Applied On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRequests.map(req => (
                            <tr key={req._id}>
                                {canEditLeaveRequests && isHR && (
                                    <td>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedRows.includes(req._id)}
                                            onChange={() => toggleSelectRow(req._id)}
                                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                        />
                                    </td>
                                )}
                                <td>
                                    <div className={styles.employeeInfo}>
                                        <div className={styles.employeeName}>
                                            {req.employee?.username || req.employeeName || 'Unknown'}
                                        </div>
                                    </div>
                                </td>

                                <td>{req.company || 'N/A'}</td>
                                <td>{req.department || 'N/A'}</td>
                                <td>{req.reportingManager || 'N/A'}</td>

                                <td>{req.leaveType}</td>
                                {activeFilter === "History" ? (
                                    <>
                                        <td>{req.reason}</td>
                                        <td>{calculateDays(req.startDate, req.endDate)} Days</td>
                                        <td>
                                            {formatDisplayDate(req.startDate)} - {formatDisplayDate(req.endDate)}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ 
                                                fontWeight: "700", 
                                                color: req.requestAirfare ? "#15803d" : "#9a3412",
                                                fontSize: "11px",
                                                padding: "3px 8px",
                                                borderRadius: "6px",
                                                background: req.requestAirfare ? "#f0fdf4" : "#fff7ed"
                                            }}>
                                                {req.requestAirfare ? "COMPANY" : "PERSONAL"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status === "Cancelled" ? "Reverted" : req.status}
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>{calculateDays(req.startDate, req.endDate)} Days</td>
                                        <td>
                                            {formatDisplayDate(req.startDate)} - {formatDisplayDate(req.endDate)}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{ 
                                                fontWeight: "700", 
                                                color: req.requestAirfare ? "#15803d" : "#9a3412",
                                                fontSize: "11px",
                                                padding: "3px 8px",
                                                borderRadius: "6px",
                                                background: req.requestAirfare ? "#f0fdf4" : "#fff7ed"
                                            }}>
                                                {req.requestAirfare ? "COMPANY" : "PERSONAL"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status === "Cancelled" ? "Reverted" : req.status}
                                            </span>
                                        </td>
                                    </>
                                )}
                                <td>{formatDisplayDate(req.appliedOn)}</td>
                                <td>
                                    <div className={styles.rowActions}>
                                        {canManageLeaves ? (
                                            // Management view (Admin/HOD/HR)
                                            <>
                                                {/* HR and HOD can Edit/Delete. Everyone can View. */}
                                                <button
                                                    className={styles.iconButton}
                                                    onClick={() => handleViewForm(req)}
                                                    title="View Leave Details"
                                                >
                                                    <ViewIcon />
                                                </button>

                                                {canEditLeaveRequests && (
                                                    <>
                                                        <button className={styles.iconButton} onClick={() => handleEdit(req)} title="Edit">
                                                            <EditIcon />
                                                        </button>
                                                        <button className={styles.iconButton} onClick={() => handleDelete(req)} title="Delete">
                                                            <DeleteIcon />
                                                        </button>
                                                    </>
                                                )}
                                                
                                                {canApprove(req) ? (
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <button
                                                            className={`${styles.iconButton} ${styles.approveButton}`}
                                                            onClick={() => handleApprove(req)}
                                                            title={isViewerRole ? "Approve Leave" : (isHOD ? "Approve (Send to Admin)" : "Final Approve")}
                                                        >
                                                            <CheckIcon />
                                                        </button>
                                                        <button
                                                            className={`${styles.iconButton} ${styles.rejectButton}`}
                                                            onClick={() => handleReject(req)}
                                                            title="Reject"
                                                        >
                                                            <XIcon />
                                                        </button>
                                                    </div>
                                                ) : null}
                                                {canRevertLeave(req) && (
                                                    <button
                                                        className={`${styles.iconButton} ${styles.revertButton}`}
                                                        onClick={() => handleRevert(req)}
                                                        title="Revert unavailed leave (credit balance back)"
                                                    >
                                                        <RevertIcon />
                                                    </button>
                                                )}
                                                {!canApprove(req) && !canRevertLeave(req) && (isAdminRole || isHOD || isViewerRole || isHR) && (
                                                    <span className={styles.noAction}>—</span>
                                                )}
                                            </>
                                        ) : (
                                            // Employee view
                                            <>
                                                <button
                                                    className={styles.iconButton}
                                                    onClick={() => handleViewForm(req)}
                                                    title="View Leave Details"
                                                >
                                                    <ViewIcon />
                                                </button>
                                                {req.status === "Pending" && (
                                                    <>
                                                        <button className={styles.iconButton} onClick={() => handleEdit(req)}>
                                                            <EditIcon />
                                                        </button>
                                                        <button className={styles.iconButton} onClick={() => handleDelete(req)}>
                                                            <DeleteIcon />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                            <tr>
                                <td colSpan="7" className={styles.noData}>No leave requests found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className={styles.pagination}>
                    <div className={styles.paginationInfo}>
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} entries
                    </div>
                    <div className={styles.paginationControls}>
                        <button
                            className={styles.pageButton}
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>
                        {getPageNumbers().map((page, index) => (
                            <button
                                key={index}
                                className={`${styles.pageButton} ${page === safePage ? styles.activePage : ''} ${page === '...' ? styles.ellipsis : ''}`}
                                onClick={() => page !== '...' && handlePageChange(page)}
                                disabled={page === '...'}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            className={styles.pageButton}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            <AddLeaveRequestModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={fetchLeaveRequests}
                allLeaveRequests={leaveRequests}
                onEditLeave={(leave) => {
                    setIsAddModalOpen(false);
                    handleEdit(leave);
                }}
            />

            <EditLeaveRequestModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                leaveRequest={selectedRequest}
                onSubmit={fetchLeaveRequests}
                allLeaveRequests={leaveRequests}
            />

            <DeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Leave Management"
                description="Are you sure you want to delete this leave record? This action cannot be undone."
            />

            <LeaveApplicationFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                leaveRequest={selectedRequest}
                allLeaveRequests={leaveRequests}
                canEdit={canEditLeaveRequests}
                onEditLeave={handleEditFromOverview}
            />

            <ImportLeaveExcelModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    fetchLeaveRequests();
                }}
            />

            {isApprovalModalOpen && (
                <div className="modal-backdrop" style={{ zIndex: 200000 }}>
                    <div style={{ 
                        background: "#fff", 
                        padding: "32px", 
                        borderRadius: "16px", 
                        maxWidth: "450px", 
                        width: "90%",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
                    }}>
                        <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "12px", color: "#0f172a" }}>
                            Confirm {approvalAction.type === 'approve' ? 'Approval' : 'Rejection'}
                        </h2>
                        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "24px", lineHeight: "1.6" }}>
                            Are you sure you want to <strong>{approvalAction.type}</strong> the leave request for 
                            <strong> {approvalAction.request.employeeName || approvalAction.request.employee?.username}</strong>?
                        </p>

                        <div style={{ 
                            background: "#f8fafc", 
                            padding: "16px", 
                            borderRadius: "12px", 
                            border: "1px solid #e2e8f0",
                            marginBottom: "24px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontSize: "13px", color: "#64748b" }}>Leave Duration:</span>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                    {new Date(approvalAction.request.startDate).toLocaleDateString('en-GB')} - {new Date(approvalAction.request.endDate).toLocaleDateString('en-GB')}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "13px", color: "#64748b" }}>Airfare Claim:</span>
                                <span style={{ 
                                    fontSize: "13px", 
                                    fontWeight: "800", 
                                    color: approvalAction.request.requestAirfare ? "#16a34a" : "#475569" 
                                }}>
                                    {approvalAction.request.requestAirfare ? "COMPANY TICKET" : "PERSONAL TICKET"}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px" }}>
                            <button 
                                onClick={() => setIsApprovalModalOpen(false)}
                                style={{ 
                                    flex: 1, 
                                    padding: "12px", 
                                    borderRadius: "8px", 
                                    border: "1px solid #e2e8f0", 
                                    background: "#fff",
                                    fontWeight: "600",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmApprovalAction}
                                style={{ 
                                    flex: 1, 
                                    padding: "12px", 
                                    borderRadius: "8px", 
                                    border: "none", 
                                    background: approvalAction.type === 'approve' ? "#10b981" : "#ef4444",
                                    color: "#fff",
                                    fontWeight: "600",
                                    cursor: "pointer"
                                }}
                            >
                                Confirm {approvalAction.type === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {revertModal && (
                <div className="modal-backdrop" style={{ zIndex: 200000 }}>
                    <div style={{
                        background: "#fff",
                        padding: "32px",
                        borderRadius: "16px",
                        maxWidth: "480px",
                        width: "90%",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
                    }}>
                        <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "12px", color: "#0f172a" }}>
                            Revert Leave Request
                        </h2>
                        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px", lineHeight: "1.6" }}>
                            Revert the approved leave for <strong>{revertModal.request.employeeName || revertModal.request.employee?.username}</strong>?
                            The leave balance will be credited back because this leave has not started yet.
                        </p>
                        <div style={{
                            background: "#faf5ff",
                            padding: "14px 16px",
                            borderRadius: "12px",
                            border: "1px solid #ddd6fe",
                            marginBottom: "20px",
                            fontSize: "13px",
                            color: "#5b21b6",
                            lineHeight: "1.5"
                        }}>
                            Leave cancellation is only allowed for unavailed (future) leave. Once a leave has started, it cannot be reverted.
                        </div>
                        <div style={{
                            background: "#f8fafc",
                            padding: "16px",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            marginBottom: "24px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontSize: "13px", color: "#64748b" }}>Leave Duration:</span>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                    {formatDisplayDate(revertModal.request.startDate)} - {formatDisplayDate(revertModal.request.endDate)}
                                </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "13px", color: "#64748b" }}>Current Status:</span>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                                    {revertModal.request.status}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button
                                onClick={() => setRevertModal(null)}
                                disabled={isReverting}
                                style={{
                                    flex: 1,
                                    padding: "12px",
                                    borderRadius: "8px",
                                    border: "1px solid #e2e8f0",
                                    background: "#fff",
                                    fontWeight: "600",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRevert}
                                disabled={isReverting}
                                style={{
                                    flex: 1,
                                    padding: "12px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: "#7c3aed",
                                    color: "#fff",
                                    fontWeight: "600",
                                    cursor: isReverting ? "not-allowed" : "pointer",
                                    opacity: isReverting ? 0.7 : 1
                                }}
                            >
                                {isReverting ? "Reverting..." : "Confirm Revert"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LeaveRequestTable;

