import React, { useState, useEffect } from "react";
import styles from "./LeaveRequestTable.module.css";
import plus from "../../assets/dashboard/plus.svg";
import leaveRequestService from "../../services/LeaveRequestService";
import DeleteModal from "../delete-modal/DeleteModal";
import AddLeaveRequestModal from "./AddLeaveRequestModal";
import EditLeaveRequestModal from "./EditLeaveRequestModal";
import { useToast } from "../../context/ToastContext";

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

function LeaveRequestTable({ onUpdate }) {
    const { showToast } = useToast();
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("All");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [userRole, setUserRole] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const isHOD = userRole === "hod";
    const isAdminRole = userRole === "admin";
    const isAdminOrHOD = isAdminRole || isHOD;

    const fetchLeaveRequests = async () => {
        setIsLoading(true);
        try {
            const data = await leaveRequestService.getLeaveRequests();
            setLeaveRequests(data);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error fetching leave requests:", error);
            showToast("Failed to fetch leave requests.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setUserRole(localStorage.getItem("role") || "");
        fetchLeaveRequests();
    }, []);

    const handleEdit = (request) => {
        setSelectedRequest(request);
        setIsEditModalOpen(true);
    };

    const handleDelete = (request) => {
        setSelectedRequest(request);
        setIsDeleteModalOpen(true);
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

    const handleApprove = async (request) => {
        try {
            // The backend will handle the proper status transition based on user role
            await leaveRequestService.approveLeaveRequest(request._id, "Approved");
            if (isHOD) {
                showToast("Leave request approved by HOD. Waiting for Admin approval.", "success");
            } else {
                showToast("Leave request approved successfully.", "success");
            }
            fetchLeaveRequests();
        } catch (error) {
            console.error("Error approving leave request:", error);
            const errorMessage = error.response?.data?.message || "Failed to approve leave request.";
            showToast(errorMessage, "error");
        }
    };

    const handleReject = async (request) => {
        try {
            await leaveRequestService.approveLeaveRequest(request._id, "Rejected");
            showToast("Leave request rejected successfully.", "success");
            fetchLeaveRequests();
        } catch (error) {
            console.error("Error rejecting leave request:", error);
            const errorMessage = error.response?.data?.message || "Failed to reject leave request.";
            showToast(errorMessage, "error");
        }
    };

    const filteredRequests = leaveRequests.filter(req => {
        if (activeFilter === "All") return true;
        if (activeFilter === "History") return req.status === "Approved" || req.status === "Rejected";
        if (activeFilter === "HOD Approved") return req.status === "HOD Approved";
        return req.status === activeFilter;
    });

    // Determine which requests can be approved based on role
    const canApprove = (request) => {
        if (isHOD && request.status === "Pending") return true;
        if (isAdminRole && request.status === "HOD Approved") return true;
        return false;
    };

    // Pagination calculations
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

    // Reset to page 1 when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter]);

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
                    {!isAdminOrHOD && (
                        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                            <span>Request Leave</span>
                            <img src={plus} alt="" />
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.controls}>
                <div className={styles.segmentedControl}>
                    {(isAdminRole
                        ? ["All", "HOD Approved", "Approved", "Rejected", "History"]
                        : isHOD
                            ? ["All", "Pending", "HOD Approved", "Approved", "Rejected", "History"]
                            : ["All", "Pending", "HOD Approved", "Approved", "Rejected", "History"]
                    ).map(filter => (
                        <button
                            key={filter}
                            className={`${styles.filterButton} ${activeFilter === filter ? styles.active : ""}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter === "HOD Approved" ? "HOD Approved" : filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Company</th>
                            <th>Type</th>
                            {activeFilter === "History" ? (
                                <>
                                    <th>Reason</th>
                                    <th>Days</th>
                                    <th>Dates</th>
                                    <th>Status</th>
                                </>
                            ) : (
                                <>
                                    <th>Duration</th>
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
                                <td>
                                    <div className={styles.employeeInfo}>
                                        <div className={styles.employeeName}>
                                            {req.employee?.username || req.employeeName || 'Unknown'}
                                        </div>
                                    </div>
                                </td>

                                <td>{req.company || 'N/A'}</td>

                                <td>{req.leaveType}</td>
                                {activeFilter === "History" ? (
                                    <>
                                        <td>{req.reason}</td>
                                        <td>{calculateDays(req.startDate, req.endDate)} Days</td>
                                        <td>
                                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>
                                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span className={`${styles.statusChip} ${styles[req.status.toLowerCase().replace(' ', '_')]}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                    </>
                                )}
                                <td>{new Date(req.appliedOn).toLocaleDateString()}</td>
                                <td>
                                    <div className={styles.rowActions}>
                                        {isAdminOrHOD ? (
                                            // HOD/Admin view: Show Approve/Reject buttons based on status
                                            canApprove(req) ? (
                                                <>
                                                    <button
                                                        className={`${styles.iconButton} ${styles.approveButton}`}
                                                        onClick={() => handleApprove(req)}
                                                        title={isHOD ? "Approve (Send to Admin)" : "Final Approve"}
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
                                                </>
                                            ) : (
                                                <span className={styles.noAction}>—</span>
                                            )
                                        ) : (
                                            // Employee view: Show Edit/Delete buttons only for Pending requests
                                            req.status === "Pending" ? (
                                                <>
                                                    <button className={styles.iconButton} onClick={() => handleEdit(req)}>
                                                        <EditIcon />
                                                    </button>
                                                    <button className={styles.iconButton} onClick={() => handleDelete(req)}>
                                                        <DeleteIcon />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={styles.noAction}>—</span>
                                            )
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
                                className={`${styles.pageButton} ${page === currentPage ? styles.activePage : ''} ${page === '...' ? styles.ellipsis : ''}`}
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
            />

            <EditLeaveRequestModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                leaveRequest={selectedRequest}
                onSubmit={fetchLeaveRequests}
            />

            <DeleteModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Leave Management"
                description="Are you sure you want to delete this leave record? This action cannot be undone."
            />
        </div>
    );
}

export default LeaveRequestTable;

