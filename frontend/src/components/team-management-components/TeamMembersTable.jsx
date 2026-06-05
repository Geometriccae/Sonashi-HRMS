import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  Table,
  Button,
  Input,
  Segmented,
  Tag,
  Avatar,
  Space,
  Typography,
  Select,
  Alert,
  Empty,
  Tooltip,
} from "antd";
import {
  UserAddOutlined,
  UploadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import DeleteModal from "../delete-modal/DeleteModal";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import EmployeeBulkImportModal from "./EmployeeBulkImportModal";
import employeeService from "../../services/EmployeeService";
import ClientService from "../../services/ClientService";
import { buildImageUrl, getApiBaseUrl } from "../../config/config";
import { io as ioClient } from "socket.io-client";
import { useToast } from "../../context/ToastContext";

/** Legacy server-generated placeholder emails — show as empty in the table. */
const LEGACY_PLACEHOLDER_EMAIL_HOST = "import.hrms.placeholder";

function displayEmployeeEmail(emailId) {
  if (emailId == null || String(emailId).trim() === "") {
    return { text: "—", isEmpty: true };
  }
  const s = String(emailId).trim();
  if (s.toLowerCase().endsWith(`@${LEGACY_PLACEHOLDER_EMAIL_HOST}`)) {
    return { text: "—", isEmpty: true };
  }
  return { text: s, isEmpty: false };
}

/** Stable string id for selection / delete (ObjectId vs string from API/socket). */
function empRowId(memberOrId) {
  if (memberOrId == null) return "";
  if (typeof memberOrId === "object" && ("_id" in memberOrId || "id" in memberOrId)) {
    const raw = memberOrId._id ?? memberOrId.id;
    return raw == null ? "" : String(raw);
  }
  return String(memberOrId);
}

function isRowSelected(selectedIds, member) {
  const rid = empRowId(member);
  if (!rid) return false;
  return selectedIds.some((s) => String(s) === rid);
}

const vacationTagColor = {
  Onsite: "success",
  "On Vacation": "processing",
  "Vacation Approved": "purple",
  "Vacation Pending": "warning",
};

const vacationLabel = (vs) => {
  if (vs === "On Vacation") return "On vacation";
  if (vs === "Vacation Approved") return "Returned back";
  if (vs === "Vacation Pending") return "Yet to go";
  return vs;
};

function TeamMembersTable() {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const userRole = localStorage.getItem("role") || "";
  const isAdmin = userRole === "admin" || userRole === "hod";
  const [datePrompt, setDatePrompt] = useState(null);

  // Fetch employees and clients from API
  useEffect(() => {
    fetchEmployees();
    fetchClients();

    // Listen for real-time employee creations so UI updates without manual refresh
    const socketUrl = getApiBaseUrl();
    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true
    });

    const onEmployeeCreated = (employee) => {
      if (!employee) return;
      setEmployees((prev) => {
        if (!prev) return [employee];
        const exists = prev.some((e) => String(e._id) === String(employee._id));
        if (exists) return prev;
        return [employee, ...prev];
      });
    };

    socket.on('employee-created', onEmployeeCreated);

    return () => {
      try { socket.off('employee-created', onEmployeeCreated); socket.disconnect(); } catch (e) { }
    };
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const employeesData = await employeeService.getEmployees();
      console.log("Fetched employees:", employeesData);
      setEmployees(employeesData || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      // Keep existing list visible; surface error inline
      setError("Failed to load employees. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await ClientService.getClients();
      const clientList = Array.isArray(data) ? data : data.clients || [];
      setClients(clientList);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const handleSelectAllInListClick = () => {
    const ids = filteredData.map((m) => empRowId(m)).filter(Boolean);
    if (!ids.length) return;
    setSelectedEmployeeIds((prev) => [...new Set([...prev.map(String), ...ids])]);
  };

  const handleClearSelection = () => {
    setSelectedEmployeeIds([]);
  };

  const handleEdit = (employee) => {
    setEmployeeToEdit(employee);
    setIsEditEmployeeModalOpen(true);
  };

  const handleDelete = (employee) => {
    setMemberToDelete(employee);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (memberToDelete) {
        // Single delete
        await employeeService.deleteEmployee(empRowId(memberToDelete));
        showToast(`${memberToDelete.employeeName} has been deleted.`, 'success');
      } else if (selectedEmployeeIds.length > 0) {
        // Bulk delete
        await employeeService.bulkDeleteEmployees(selectedEmployeeIds.map(String));
        showToast(`${selectedEmployeeIds.length} employees have been deleted.`, 'success');
        setSelectedEmployeeIds([]);
      }

      // Refresh the employees list
      await fetchEmployees();
    } catch (err) {
      console.error("Error deleting employee(s):", err);
      const errorMsg = err.message || "Unknown error";
      setError(`Failed to delete: ${errorMsg}`);
      showToast(`Failed to delete: ${errorMsg}`, 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setMemberToDelete(null);
  };

  const handleAddEmployee = () => {
    setIsAddEmployeeModalOpen(true);
  };

  const handleAddEmployeeClose = () => {
    setIsAddEmployeeModalOpen(false);
  };

  const handleBulkImportClose = () => {
    setIsBulkImportModalOpen(false);
  };

  const handleBulkImportSuccess = async (res) => {
    await fetchEmployees();
    const created = res?.created ?? 0;
    const failed = res?.failed ?? 0;
    if (failed === 0) {
      showToast(`Imported ${created} employee(s).`, "success");
    } else {
      const first = res?.errors?.[0];
      const detail = first ? ` Row ${first.row}: ${first.message}` : "";
      showToast(
        `Imported ${created} employee(s). ${failed} row(s) failed.${detail} Open “Bulk import” again to read the full list.`,
        "warning",
        14000
      );
    }
  };

  const handleEditEmployeeClose = () => {
    setIsEditEmployeeModalOpen(false);
    setEmployeeToEdit(null);
  };

  const handleAddEmployeeSubmit = async (formData) => {
    try {
      // If the AddEmployeeModal returns the created employee, append optimistically.
      // Expectation: onSubmit may return the created employee object; if not, we still refresh.
      const created = formData?.createdEmployee || null;
      if (created) {
        setEmployees((prev) => [created, ...prev]);
      }
      // run background refresh to reconcile server state
      await fetchEmployees();

      // Show success notification
      showToast(`${formData.employeeName} has been successfully added.`, 'success');
    } catch (err) {
      console.error("Error refreshing employees after add:", err);
      // Re-fetch to ensure consistency on error
      fetchEmployees();
      showToast("Employee added, but failed to refresh list.", 'warning');
    }
  };

  const handleEditEmployeeSubmit = async (formData) => {
    try {
      // Refresh the employees list after editing
      await fetchEmployees();
      showToast("Employee details updated successfully.", 'success');
    } catch (err) {
      console.error("Error refreshing employees after edit:", err);
      showToast("Employee updated, but failed to refresh list.", 'warning');
    }
  };

  const handleVacationStatusChange = async (employeeItem, newStatus, extraFields = {}) => {
    const empId = employeeItem._id || employeeItem.id;
    try {
      await employeeService.updateEmployee(empId, { vacationStatus: newStatus, ...extraFields });

      // Update in-state
      setEmployees(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId) ? { ...e, vacationStatus: newStatus, ...extraFields } : e
        )
      );

      showToast("Vacation status updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update vacation status:", err);
      showToast("Failed to update vacation status.", "error");
      throw err;
    }
  };

  const handleStatusDropdownChange = (employeeItem, newStatus) => {
    const dateConfig = {
      "On Vacation": { label: "Last Working Day", fieldKey: "lastWorkingDay" },
      "Vacation Pending": { label: "Travelling Date", fieldKey: "travellingDate" },
      "Vacation Approved": { label: "Entered Date", fieldKey: "firstWorkingDay" },
    };
    const cfg = dateConfig[newStatus];
    if (cfg) {
      setDatePrompt({
        employeeItem,
        newStatus,
        label: cfg.label,
        fieldKey: cfg.fieldKey,
        dateValue: ""
      });
    } else {
      handleVacationStatusChange(employeeItem, newStatus);
    }
  };

  const handleDatePromptConfirm = async () => {
    if (!datePrompt) return;
    const { employeeItem, newStatus, fieldKey, dateValue } = datePrompt;
    const extraFields = dateValue ? { [fieldKey]: new Date(dateValue).toISOString() } : {};
    try {
      await handleVacationStatusChange(employeeItem, newStatus, extraFields);
      setDatePrompt(null);
    } catch (err) {
      // handled
    }
  };

  const handleDatePromptCancel = () => {
    setDatePrompt(null);
  };

  // Filter employees first
  const filteredData = employees.filter((member) => {
    let matchesFilter = true;
    if (activeFilter === "Active") {
      matchesFilter = member.employeeStatus !== "InActive";
    } else if (activeFilter === "Inactive") {
      matchesFilter = member.employeeStatus === "InActive";
    }

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (member.employeeName || "").toLowerCase().includes(q) ||
      (member.employeeId || "").toLowerCase().includes(q) ||
      (member.emailId || "").toLowerCase().includes(q) ||
      (member.role || "").toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  // Pagination: compute total pages (minimum 1 so UI behaves like ClientsTable)
  const totalPages = Math.max(1, Math.ceil((filteredData.length || 0) / itemsPerPage));

  // Reset to first page when filters/search/list length change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, employees.length]); // <-- removed filteredData.length here

  // Ensure currentPage stays within bounds and derive a safe page for slicing
  const currentPageSafe = Math.max(1, Math.min(currentPage, totalPages));
  useEffect(() => {
    if (currentPage !== currentPageSafe) setCurrentPage(currentPageSafe);
  }, [currentPageSafe]); // ensure state sync if bounds changed externally

  // If filteredData becomes empty, ensure we are on page 1
  useEffect(() => {
    if ((filteredData || []).length === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filteredData.length, currentPage]);

  const allFilteredSelected =
    filteredData.length > 0 && filteredData.every((m) => isRowSelected(selectedEmployeeIds, m));

  const isInitialLoading = loading && employees.length === 0 && !error;

  const columns = [
      {
        title: "S.No",
        key: "sno",
        width: 70,
        align: "center",
        render: (_, __, index) => (currentPageSafe - 1) * itemsPerPage + index + 1,
      },
      {
        title: "Employee Name",
        dataIndex: "employeeName",
        key: "employeeName",
        sorter: (a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""),
        render: (name, record) => (
          <Link
            to={`/teammanagement_salesleads/${record._id || record.id}`}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <Space>
              <Avatar
                size={40}
                src={record.profilePhoto ? buildImageUrl(record.profilePhoto) : undefined}
                style={{ backgroundColor: "#007aff", flexShrink: 0 }}
              >
                {name ? name.charAt(0).toUpperCase() : "E"}
              </Avatar>
              <div>
                <Typography.Text strong style={{ display: "block", textTransform: "capitalize" }}>
                  {(name || "Unknown").toLowerCase()}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
                  {record.role || "No Role"}
                </Typography.Text>
              </div>
            </Space>
          </Link>
        ),
      },
      {
        title: "Status",
        dataIndex: "employeeStatus",
        key: "employeeStatus",
        width: 120,
        sorter: (a, b) => (a.employeeStatus || "").localeCompare(b.employeeStatus || ""),
        render: (status) => {
          const isActive = status !== "InActive";
          return (
            <Tag color={isActive ? "success" : "default"} style={{ borderRadius: 20, fontWeight: 600 }}>
              {status || "Active"}
            </Tag>
          );
        },
      },
      {
        title: "Vacation Status",
        dataIndex: "vacationStatus",
        key: "vacationStatus",
        width: 200,
        render: (_, record) => {
          const isActive = record.employeeStatus !== "InActive";
          if (!isActive) return <Typography.Text type="secondary">—</Typography.Text>;

          const vs = record.vacationStatus || "Onsite";
          const dateFieldMap = {
            "On Vacation": "lastWorkingDay",
            "Vacation Pending": "travellingDate",
            "Vacation Approved": "firstWorkingDay",
          };
          const dateField = dateFieldMap[vs];
          const dateVal = dateField ? record[dateField] : null;

          if (isAdmin) {
            return (
              <Space direction="vertical" size={2}>
                <Select
                  size="small"
                  value={vs}
                  style={{ minWidth: 160 }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(val) => handleStatusDropdownChange(record, val)}
                  options={[
                    { value: "Onsite", label: "Onsite" },
                    { value: "On Vacation", label: "On vacation" },
                    { value: "Vacation Approved", label: "Returned back from vacation" },
                    { value: "Vacation Pending", label: "Yet to go" },
                  ]}
                />
                {dateVal && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {new Date(dateVal).toLocaleDateString("en-GB")}
                  </Typography.Text>
                )}
              </Space>
            );
          }

          return (
            <Space direction="vertical" size={2}>
              <Tag color={vacationTagColor[vs] || "default"} style={{ borderRadius: 20 }}>
                {vacationLabel(vs)}
              </Tag>
              {dateVal && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(dateVal).toLocaleDateString("en-GB")}
                </Typography.Text>
              )}
            </Space>
          );
        },
      },
      {
        title: "Email ID",
        dataIndex: "emailId",
        key: "emailId",
        sorter: (a, b) => (a.emailId || "").localeCompare(b.emailId || ""),
        render: (email) => {
          const emailDisplay = displayEmployeeEmail(email);
          return (
            <Typography.Text type={emailDisplay.isEmpty ? "secondary" : undefined}>
              {emailDisplay.text}
            </Typography.Text>
          );
        },
      },
      {
        title: "Phone Number",
        dataIndex: "mobile",
        key: "mobile",
        width: 140,
        render: (mobile) => (
          <Typography.Text type={mobile ? undefined : "secondary"}>
            {mobile || "—"}
          </Typography.Text>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 130,
        align: "center",
        render: (_, record) => (
          <Space size={4}>
            <Tooltip title="View">
              <Link to={`/teammanagement_salesleads/${record._id || record.id}`}>
                <Button type="text" icon={<EyeOutlined />} size="small" />
              </Link>
            </Tooltip>
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
            </Tooltip>
            {isAdmin && (
              <Tooltip title="Delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ];

  const rowSelection = {
    selectedRowKeys: selectedEmployeeIds,
    onChange: (keys) => setSelectedEmployeeIds(keys.map(String)),
    onSelectAll: (selected) => {
      const ids = filteredData.map((m) => empRowId(m)).filter(Boolean);
      if (selected) {
        setSelectedEmployeeIds((prev) => [...new Set([...prev.map(String), ...ids])]);
      } else {
        const idSet = new Set(ids);
        setSelectedEmployeeIds((prev) => prev.filter((id) => !idSet.has(String(id))));
      }
    },
    getCheckboxProps: (record) => ({
      name: record.employeeName,
    }),
  };

  return (
    <Card
      bordered={false}
      style={{
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        borderRadius: 16,
      }}
      styles={{ body: { padding: "24px" } }}
    >
      {loading && employees.length > 0 && (
        <Alert message="Refreshing employees..." type="info" showIcon style={{ marginBottom: 16 }} />
      )}
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchEmployees}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Team Members
        </Typography.Title>
        <Space wrap>
          {filteredData.length > 0 && !allFilteredSelected && (
            <Button onClick={handleSelectAllInListClick}>
              Select all ({filteredData.length})
            </Button>
          )}
          {selectedEmployeeIds.length > 0 && (
            <Button onClick={handleClearSelection}>Clear selection</Button>
          )}
          {selectedEmployeeIds.length > 0 && (
            <Button danger onClick={() => setIsDeleteModalOpen(true)}>
              Delete selected ({selectedEmployeeIds.length})
            </Button>
          )}
          <Button icon={<UploadOutlined />} onClick={() => setIsBulkImportModalOpen(true)}>
            Bulk import
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddEmployee}>
            Add Employee
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Segmented
          value={activeFilter}
          onChange={setActiveFilter}
          options={[
            { label: "All", value: "All" },
            { label: "Active", value: "Active" },
            { label: "Inactive", value: "Inactive" },
          ]}
          style={{ background: "#f5f5f5", padding: 4, borderRadius: 24 }}
        />
        <Input
          placeholder="Search by name, employee ID, email, role..."
          prefix={<SearchOutlined style={{ color: "#98A1B0" }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          style={{ width: 320, borderRadius: 24 }}
        />
      </div>

      <Table
        rowKey={(record) => empRowId(record)}
        columns={columns}
        dataSource={filteredData}
        rowSelection={rowSelection}
        loading={isInitialLoading ? { tip: "Loading employees..." } : loading}
        locale={{
          emptyText: (
            <Empty
              description={
                searchTerm ? "No employees match your search." : "No employees found."
              }
            />
          ),
        }}
        pagination={{
          current: currentPageSafe,
          pageSize: itemsPerPage,
          total: filteredData.length,
          showSizeChanger: true,
          pageSizeOptions: ["5", "10", "15"],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== itemsPerPage) setItemsPerPage(size);
          },
        }}
        scroll={{ x: 900 }}
        size="middle"
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={memberToDelete ? `Delete ${memberToDelete.employeeName}?` : `Delete ${selectedEmployeeIds.length} employees?`}
        description={memberToDelete
          ? `Are you sure you want to delete ${memberToDelete.employeeName}? This action cannot be undone.`
          : `Are you sure you want to delete these ${selectedEmployeeIds.length} employees? This action cannot be undone.`}
      />

      <AddEmployeeModal
        isOpen={isAddEmployeeModalOpen}
        onClose={handleAddEmployeeClose}
        onSubmit={handleAddEmployeeSubmit}
      />

      <EmployeeBulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={handleBulkImportClose}
        onSuccess={handleBulkImportSuccess}
      />

      <EditEmployeeModal
        isOpen={isEditEmployeeModalOpen}
        onClose={handleEditEmployeeClose}
        onSubmit={handleEditEmployeeSubmit}
        employee={employeeToEdit}
      />

      {/* Vacation Date Prompt Modal */}
      {datePrompt && (() => {
        const nameInitials = datePrompt.employeeItem.employeeName
          ? datePrompt.employeeItem.employeeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : "EE";

        const getStatusLabelAndStyle = (status) => {
          const config = {
            "On Vacation": { label: "On vacation", bg: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#1e3a8a", dot: "#3b82f6" },
            "Vacation Approved": { label: "Returned back from vacation", bg: "linear-gradient(135deg, #ede9fe, #ddd6fe)", color: "#4c1d95", dot: "#7c3aed" },
            "Vacation Pending": { label: "Yet to go", bg: "linear-gradient(135deg, #fef9c3, #fde68a)", color: "#713f12", dot: "#f59e0b" }
          };
          return config[status] || { label: status, bg: "#f8fafc", color: "#334155", dot: "#64748b" };
        };

        const statusCfg = getStatusLabelAndStyle(datePrompt.newStatus);

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 100001,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px"
            }}
            onClick={handleDatePromptCancel}
          >
            <style>{`
              @keyframes datePromptFadeIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              .premium-input-date:focus {
                border-color: #6366f1 !important;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
              }
            `}</style>
            <div
              style={{
                background: "#fff",
                borderRadius: "24px",
                padding: "36px",
                width: "440px",
                maxWidth: "100%",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(79, 70, 229, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                position: "relative",
                overflow: "hidden",
                border: "1px solid #f1f5f9",
                animation: "datePromptFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                textAlign: "left"
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top Accent Gradient Bar */}
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: "6px",
                background: "linear-gradient(90deg, #4f46e5, #8b5cf6, #ec4899)"
              }} />

              {/* Close Button */}
              <button
                onClick={handleDatePromptCancel}
                style={{
                  position: "absolute",
                  top: "20px", right: "20px",
                  background: "#f1f5f9", border: "none",
                  width: "32px", height: "32px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", color: "#64748b", cursor: "pointer",
                  transition: "all 0.2s ease",
                  lineHeight: 1
                }}
                onMouseEnter={e => { e.target.style.background = "#e2e8f0"; e.target.style.color = "#0f172a"; }}
                onMouseLeave={e => { e.target.style.background = "#f1f5f9"; e.target.style.color = "#64748b"; }}
              >&times;</button>

              {/* Avatar & Header */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px", marginTop: "10px" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ede9fe, #c7d2fe)",
                  color: "#4f46e5",
                  fontSize: "22px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 16px rgba(79, 70, 229, 0.12)"
                }}>
                  {nameInitials}
                </div>
                <h3 style={{ margin: "10px 0 2px", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                  Set {datePrompt.label}
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
                  Please select the vacation-related date for <strong style={{ color: "#334155" }}>{datePrompt.employeeItem.employeeName}</strong>.
                </p>
              </div>

              {/* Status Badge Visual Transition Indicator */}
              <div style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "14px 18px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Updating Status to:
                  </span>
                </div>
                <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    background: statusCfg.bg,
                    color: statusCfg.color,
                    fontSize: "13px",
                    fontWeight: "800",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    border: `1px solid ${statusCfg.dot}25`
                  }}>
                    <span style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: statusCfg.dot,
                      boxShadow: `0 0 0 2px ${statusCfg.dot}25`
                    }} />
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Date Input Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Select {datePrompt.label}
                </label>
                <input
                  type="date"
                  value={datePrompt.dateValue}
                  className="premium-input-date"
                  onChange={e => setDatePrompt(prev => ({ ...prev, dateValue: e.target.value }))}
                  style={{
                    border: "2px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    fontSize: "15px",
                    color: "#0f172a",
                    fontWeight: "600",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                    cursor: "pointer"
                  }}
                  autoFocus
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  onClick={handleDatePromptCancel}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "2px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; }}
                  onMouseLeave={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDatePromptConfirm}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                  onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(79, 70, 229, 0.35)"; }}
                  onMouseLeave={e => { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.25)"; }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </Card>
  );
}

export default TeamMembersTable;
