import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Modal,
} from "antd";
import {
  UserAddOutlined,
  UploadOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import DeleteModal from "../delete-modal/DeleteModal";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import EmployeeBulkImportModal from "./EmployeeBulkImportModal";
import employeeService from "../../services/EmployeeService";
import styles from "./TeamMembersTable.module.css";
import { buildImageUrl, getApiBaseUrl } from "../../config/config";
import { io as ioClient } from "socket.io-client";
import { useToast } from "../../context/ToastContext";
import { ACTIVE_OPTIONS } from "../../constants/employeeDropdownOptions";
import { canUpdateVacationReturn } from "../../utils/permissions";
import {
  readPersistedPage,
  writePersistedPage,
  writePersistedPath,
} from "../../hooks/usePersistedListPage";
import {
  formatEmployeeStatusDisplay,
  employeeStatusTagColor,
  isWorkingEmployeeStatus,
  apiStatusForEmployeeCategory,
} from "../../utils/employeeStatusDisplay";
import {
  isNoticeOrProvisionStatus,
  buildEmployeeStatusPrompt,
  validateEmployeeStatusPrompt,
  datesFromEmployeeStatusPrompt,
  applyEmployeeStatusChange,
  applyEmployeeStatusReset,
  employeeStatusChangeSuccessMessage,
  employeeStatusResetSuccessMessage,
} from "../../utils/employeeStatusUpdate";
import EmployeeStatusDatePromptModal from "./EmployeeStatusDatePromptModal";
import { HR_METRICS_LIST_PARAM_KEYS } from "../../utils/hrMetricsFilters";

import { employeeEmailDisplayState } from "../../utils/employeeEmailDisplay";
import {
  formatVacationStatus,
  vacationStatusTagColor,
  VACATION_STATUS_EDIT_OPTIONS,
} from "../../utils/vacationStatusDisplay";
import {
  applyVacationStatusChange,
  buildStatusChangePrompt,
  datesFromPrompt,
} from "../../utils/vacationStatusUpdate";
import VacationDatePromptModal from "./VacationDatePromptModal";

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

const vacationTagColor = vacationStatusTagColor;

const vacationLabel = formatVacationStatus;

const formatVacationDates = (record, vs) => {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : null);
  if (vs === "On Vacation" || vs === "Vacation Pending") {
    const lines = [];
    const lwd = fmt(record.lastWorkingDay);
    const travel = fmt(record.travellingDate);
    const leaveEnd = fmt(record.endDate || record.leaveEndDate);
    if (lwd) lines.push(`LWD: ${lwd}`);
    if (travel) lines.push(`Travel: ${travel}`);
    if (leaveEnd) lines.push(`Leave End: ${leaveEnd}`);
    return lines;
  }
  if (vs === "Vacation Approved") {
    const lines = [];
    const ret = fmt(record.returnDate);
    const fwd = fmt(record.firstWorkingDay);
    if (ret) lines.push(`Return: ${ret}`);
    if (fwd) lines.push(`First Work Day: ${fwd}`);
    return lines;
  }
  return [];
};

function TeamMembersTable() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const itemsPerPage = Number(searchParams.get("size")) || 20;
  const activeFilter = searchParams.get("filter") || "Active";
  const urlSearch = searchParams.get("q") || "";
  const listReturnPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/teammanagement?${query}` : "/teammanagement";
  }, [searchParams]);

  // HR Metrics year/filters belong on the metrics dashboard, not this list.
  useEffect(() => {
    const hasMetricsParams = HR_METRICS_LIST_PARAM_KEYS.some((key) => searchParams.has(key));
    if (!hasMetricsParams) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      HR_METRICS_LIST_PARAM_KEYS.forEach((key) => next.delete(key));
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  // Restore last page from session when URL has no page (e.g. sidebar click)
  useEffect(() => {
    if (searchParams.get("page")) return;
    const saved = readPersistedPage("teammanagement", 1);
    if (saved > 1) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(saved));
        return next;
      }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep session in sync so Back / sidebar can resume this list position
  useEffect(() => {
    writePersistedPage("teammanagement", currentPage);
    writePersistedPath("teammanagement", listReturnPath);
  }, [currentPage, listReturnPath]);

  const patchSearchParams = (updates, { resetPage = false } = {}) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (resetPage) next.delete("page");

      Object.entries(updates).forEach(([key, value]) => {
        const normalized = value == null ? "" : String(value).trim();
        const isDefault =
          (key === "page" && (normalized === "" || normalized === "1")) ||
          (key === "size" && (normalized === "" || normalized === "20")) ||
          (key === "filter" && (normalized === "" || normalized === "Active")) ||
          (key === "q" && normalized === "");

        if (isDefault) next.delete(key);
        else next.set(key, normalized);
      });

      return next;
    }, { replace: true });
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const userRole = localStorage.getItem("role") || "";
  const isAdmin = userRole === "admin" || userRole === "hod";
  const canEditEmployees =
    userRole !== "viewer" && userRole !== "authorize_user";
  const canReturn = canUpdateVacationReturn(userRole);
  const canDeleteEmployees = userRole === "admin" || userRole === "hod";
  const [datePrompt, setDatePrompt] = useState(null);
  const [datePromptSaving, setDatePromptSaving] = useState(false);
  const [statusPrompt, setStatusPrompt] = useState(null);
  const [statusPromptSaving, setStatusPromptSaving] = useState(false);
  const [periodResetTarget, setPeriodResetTarget] = useState(null);
  const [periodResetSaving, setPeriodResetSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(String(searchInput || "").trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if ((debouncedSearch || "") === (urlSearch || "")) return;
    patchSearchParams({ q: debouncedSearch }, { resetPage: true });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, itemsPerPage, activeFilter, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let socket;
    let cancelled = false;
    let idleHandle = null;
    const connectSocket = () => {
      if (cancelled) return;
      const socketUrl = getApiBaseUrl();
      socket = ioClient(socketUrl, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        reconnection: true
      });

      const onEmployeeCreated = (employee) => {
        if (!employee) return;
        // Refresh current page so counts/order stay correct with server pagination
        fetchEmployees({ soft: true });
      };

      socket.on('employee-created', onEmployeeCreated);
    };

    // Defer socket until after first paint so list fetch isn't competing for bandwidth
    if (typeof requestIdleCallback === 'function') {
      idleHandle = { kind: 'idle', id: requestIdleCallback(connectSocket, { timeout: 2500 }) };
    } else {
      idleHandle = { kind: 'timeout', id: setTimeout(connectSocket, 1200) };
    }

    return () => {
      cancelled = true;
      if (idleHandle?.kind === 'idle' && typeof cancelIdleCallback === 'function') {
        try { cancelIdleCallback(idleHandle.id); } catch (e) { /* ignore */ }
      } else if (idleHandle?.kind === 'timeout') {
        clearTimeout(idleHandle.id);
      }
      try { if (socket) { socket.disconnect(); } } catch (e) { }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEmployees = async ({ soft = false } = {}) => {
    try {
      if (!soft && employees.length === 0) setLoading(true);
      setError(null);
      const status = apiStatusForEmployeeCategory(activeFilter);
      const result = await employeeService.getEmployeesListPaginated({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        status,
      });
      const rows = Array.isArray(result?.employees) ? result.employees : [];
      setEmployees(rows);
      setTotalEmployees(Number(result?.total) || rows.length);

      // Prefetch next page after first paint (never blocks UI)
      const totalPages = Math.max(1, Math.ceil((Number(result?.total) || 0) / itemsPerPage));
      if (currentPage < totalPages) {
        employeeService
          .getEmployeesListPaginated({
            page: currentPage + 1,
            limit: itemsPerPage,
            search: debouncedSearch,
            status,
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to load employees. Please try again.");
    } finally {
      if (!soft) setLoading(false);
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
      fetchEmployees();
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
    fetchEmployees();
    const created = res?.created ?? 0;
    const failed = res?.failed ?? 0;
    if (failed === 0) {
      showToast(`Imported ${created} employee(s).`, "success");
    } else {
      const first = res?.errors?.[0];
      const detail = first ? ` Row ${first.row}: ${first.message}` : "";
      showToast(
        `Imported ${created} employee(s). ${failed} row(s) failed.${detail} Open â€œBulk importâ€ again to read the full list.`,
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
      fetchEmployees();
      showToast(`${formData.employeeName} has been successfully added.`, 'success');
    } catch (err) {
      console.error("Error refreshing employees after add:", err);
      fetchEmployees();
      showToast("Employee added, but failed to refresh list.", 'warning');
    }
  };

  const handleEditEmployeeSubmit = async () => {
    try {
      employeeService.invalidateCache?.();
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
      const updated = await applyVacationStatusChange({
        employeeId: empId,
        newStatus,
        dates: extraFields,
          leaveId: employeeItem.linkedLeaveId || null,
        });

      const liveStatus = updated?.vacationStatus || newStatus;

      setEmployees(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId)
            ? {
                ...e,
                ...(updated && typeof updated === "object" ? updated : {}),
                ...extraFields,
                vacationStatus: liveStatus,
                attendance: liveStatus === "Vacation Approved" ? "Onsite" : e.attendance,
              }
            : e
        )
      );

      employeeService.invalidateCache?.();
      await fetchEmployees({ soft: true });
      showToast("Vacation status updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update vacation status:", err);
      showToast(err?.message || "Failed to update vacation status.", "error");
      throw err;
    }
  };

  const handleStatusDropdownChange = (employeeItem, newStatus) => {
    const prompt = buildStatusChangePrompt(employeeItem, newStatus);
    if (prompt) {
      setDatePrompt(prompt);
    } else {
      handleVacationStatusChange(employeeItem, newStatus);
    }
  };

  const handleDatePromptConfirm = async () => {
    if (!datePrompt || datePromptSaving) return;
    const { employeeItem, newStatus } = datePrompt;
    const { dates, error } = datesFromPrompt(datePrompt);
    if (error) {
      showToast(error, "error");
      return;
    }
    setDatePromptSaving(true);
    try {
      await handleVacationStatusChange(employeeItem, newStatus, dates);
      setDatePrompt(null);
    } catch (err) {
      // handled
    } finally {
      setDatePromptSaving(false);
    }
  };

  const handleDatePromptCancel = () => {
    if (datePromptSaving) return;
    setDatePrompt(null);
  };

  const handleEmployeeStatusChange = (employeeItem, newStatus, options = {}) => {
    const prompt = buildEmployeeStatusPrompt(employeeItem, newStatus, options);
    if (prompt) {
      setStatusPrompt(prompt);
      return;
    }
    confirmEmployeeStatusChange(employeeItem, newStatus, {}, options);
  };

  const confirmEmployeeStatusChange = async (employeeItem, newStatus, dates = {}, options = {}) => {
    const isEdit = Boolean(options.isEdit);
    setStatusPromptSaving(true);
    try {
      const { payload, updated, empId } = await applyEmployeeStatusChange({
        employeeItem,
        newStatus,
        dates,
      });
      setEmployees((prev) =>
        prev.map((e) =>
          (e._id === empId || e.id === empId)
            ? { ...e, ...payload, ...(updated && typeof updated === "object" ? updated : {}) }
            : e
        )
      );
      showToast(employeeStatusChangeSuccessMessage(newStatus, isEdit), "success");
      setStatusPrompt(null);
    } catch (err) {
      console.error("Failed to update employee status:", err);
      showToast(err?.message || "Failed to update employee status.", "error");
    } finally {
      setStatusPromptSaving(false);
    }
  };

  const handleStatusPromptConfirm = async () => {
    if (!statusPrompt || statusPromptSaving) return;
    const error = validateEmployeeStatusPrompt(statusPrompt);
    if (error) {
      showToast(error, "error");
      return;
    }
    await confirmEmployeeStatusChange(
      statusPrompt.employeeItem,
      statusPrompt.newStatus,
      datesFromEmployeeStatusPrompt(statusPrompt),
      { isEdit: Boolean(statusPrompt.isEdit) }
    );
  };

  const handleStatusPromptCancel = () => {
    if (statusPromptSaving || periodResetSaving) return;
    setStatusPrompt(null);
  };

  const requestPeriodReset = (employeeItem) => {
    if (!employeeItem || !isNoticeOrProvisionStatus(employeeItem.employeeStatus)) return;
    setPeriodResetTarget(employeeItem);
  };

  const handlePeriodResetCancel = () => {
    if (periodResetSaving) return;
    setPeriodResetTarget(null);
  };

  const handlePeriodResetConfirm = async () => {
    if (!periodResetTarget || periodResetSaving) return;
    setPeriodResetSaving(true);
    try {
      const { payload, updated, empId, currentStatus } = await applyEmployeeStatusReset(periodResetTarget);
      setEmployees((prev) =>
        prev.map((e) =>
          (e._id === empId || e.id === empId)
            ? { ...e, ...payload, ...(updated && typeof updated === "object" ? updated : {}) }
            : e
        )
      );
      showToast(employeeStatusResetSuccessMessage(currentStatus), "success");
      setPeriodResetTarget(null);
      setStatusPrompt(null);
    } catch (err) {
      console.error("Failed to reset employee status:", err);
      showToast(err?.message || "Failed to reset status.", "error");
    } finally {
      setPeriodResetSaving(false);
    }
  };

  // Server already applied status + search; this page holds only the current page rows.
  const filteredData = employees;

  const totalPages = Math.max(1, Math.ceil(totalEmployees / itemsPerPage) || 1);

  // Load avatars only for the visible page (list API no longer embeds profilePhoto)
  useEffect(() => {
    const ids = filteredData
      .map((r) => r._id || r.id)
      .filter(Boolean)
      .filter((id) => {
        const row = filteredData.find((r) => String(r._id || r.id) === String(id));
        return row && !row.profilePhoto;
      });
    if (!ids.length) return;
    let cancelled = false;
    employeeService
      .getProfilePhotosByIds(ids)
      .then((photos) => {
        if (cancelled || !Array.isArray(photos) || !photos.length) return;
        const byId = new Map(photos.map((p) => [String(p._id || p.id), p.profilePhoto]));
        setEmployees((prev) =>
          prev.map((e) => {
            const photo = byId.get(String(e._id || e.id));
            return photo ? { ...e, profilePhoto: photo } : e;
          })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentPage, itemsPerPage, filteredData]);

  useEffect(() => {
    if (loading) return;
    if (totalEmployees === 0) return;
    if (currentPage > totalPages) {
      patchSearchParams({ page: totalPages === 1 ? undefined : totalPages });
    }
  }, [totalEmployees, currentPage, totalPages, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFilteredSelected =
    filteredData.length > 0 && filteredData.every((m) => isRowSelected(selectedEmployeeIds, m));

  const isInitialLoading = loading && employees.length === 0 && !error;

  const columns = [
      {
        title: "S.No",
        key: "sno",
        width: 70,
        align: "center",
        render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1,
      },
      {
        title: "Employee Name",
        dataIndex: "employeeName",
        key: "employeeName",
        sorter: (a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""),
        render: (name, record) => (
          <Link
            to={`/teammanagement_salesleads/${record._id || record.id}`}
            state={{ from: listReturnPath }}
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
        title: "Employee Status",
        dataIndex: "employeeStatus",
        key: "employeeStatus",
        width: 240,
        sorter: (a, b) =>
          formatEmployeeStatusDisplay(a).localeCompare(formatEmployeeStatusDisplay(b)),
        render: (status, record) => {
          const displayLabel = formatEmployeeStatusDisplay(record);
          const statusOptions = ACTIVE_OPTIONS.filter((o) => o.value).map((o) => ({
            value: o.value,
            label: o.label,
          }));
          if (canEditEmployees) {
            return (
              <Select
                size="small"
                value={status || "Active"}
                style={{ minWidth: 220 }}
                onClick={(e) => e.stopPropagation()}
                onChange={(val) => handleEmployeeStatusChange(record, val)}
                options={statusOptions}
                popupMatchSelectWidth={false}
                labelRender={() => displayLabel}
              />
            );
          }
          return (
            <Tag
              color={employeeStatusTagColor(status || "Active")}
              style={{ borderRadius: 20, fontWeight: 600, whiteSpace: "normal" }}
            >
              {displayLabel}
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
          const isActive = isWorkingEmployeeStatus(record.employeeStatus);
          if (!isActive) return <Typography.Text type="secondary">â€”</Typography.Text>;

          const vs = record.vacationStatus || "Onsite";
          const dateLines = formatVacationDates(record, vs);

          if (canReturn) {
            return (
              <Space direction="vertical" size={2}>
                <Select
                  size="small"
                  value={vs}
                  style={{ minWidth: 160 }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(val) => handleStatusDropdownChange(record, val)}
                  options={VACATION_STATUS_EDIT_OPTIONS}
                />
                {dateLines.map((line) => (
                  <Typography.Text key={line} type="secondary" style={{ fontSize: 11 }}>
                    {line}
                  </Typography.Text>
                ))}
              </Space>
            );
          }

          return (
            <Space direction="vertical" size={2}>
              <Tag color={vacationTagColor[vs] || "default"} style={{ borderRadius: 20 }}>
                {vacationLabel(vs)}
              </Tag>
              {dateLines.map((line) => (
                <Typography.Text key={line} type="secondary" style={{ fontSize: 11 }}>
                  {line}
                </Typography.Text>
              ))}
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
          const emailDisplay = employeeEmailDisplayState(email, "â€”");
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
            {mobile || "â€”"}
          </Typography.Text>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 170,
        align: "center",
        render: (_, record) => (
          <Space size={4}>
            <Tooltip title="View">
              <Link
                to={`/teammanagement_salesleads/${record._id || record.id}`}
                state={{ from: listReturnPath }}
              >
                <Button type="text" icon={<EyeOutlined />} size="small" />
              </Link>
            </Tooltip>
            {canEditEmployees && isNoticeOrProvisionStatus(record.employeeStatus) && (
              <>
                <Tooltip title="Edit Status Dates">
                  <Button
                    type="text"
                    icon={<CalendarOutlined />}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEmployeeStatusChange(record, record.employeeStatus, { isEdit: true });
                    }}
                  />
                </Tooltip>
                <Tooltip title="Reset Status">
                  <Button
                    type="text"
                    icon={<UndoOutlined />}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestPeriodReset(record);
                    }}
                  />
                </Tooltip>
              </>
            )}
            {canEditEmployees && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
              </Tooltip>
            )}
            {canDeleteEmployees && (
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
          {canDeleteEmployees && selectedEmployeeIds.length > 0 && (
            <Button danger onClick={() => setIsDeleteModalOpen(true)}>
              Delete selected ({selectedEmployeeIds.length})
            </Button>
          )}
          {canEditEmployees && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => setIsBulkImportModalOpen(true)}>
                Bulk import
              </Button>
              <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddEmployee}>
                Add Employee
              </Button>
            </>
          )}
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
          onChange={(value) => patchSearchParams({ filter: value }, { resetPage: true })}
          options={[
            { label: "Active", value: "Active" },
            { label: "Ex-Employees", value: "Inactive" },
            { label: "All", value: "All" },
          ]}
          style={{ background: "#f5f5f5", padding: 4, borderRadius: 24 }}
        />
        <Input
          placeholder="Search by name, employee ID, email, role..."
          prefix={<SearchOutlined style={{ color: "#98A1B0" }} />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          allowClear
          onClear={() => setSearchInput("")}
          style={{ width: 320, borderRadius: 24 }}
        />
      </div>

      <div className={styles.tableScrollWrap}>
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
                searchInput ? "No employees match your search." : "No employees found."
              }
            />
          ),
        }}
        pagination={{
          current: currentPage,
          pageSize: itemsPerPage,
          total: totalEmployees,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`,
          onChange: (page, size) => {
            patchSearchParams({
              page: page === 1 ? undefined : page,
              size: size === 20 ? undefined : size,
            });
          },
        }}
        scroll={{ x: 900, y: "calc(100vh - 26rem)" }}
        size="middle"
      />
      </div>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={memberToDelete ? `Delete ${memberToDelete.employeeName}?` : `Delete ${selectedEmployeeIds.length} employees?`}
        description={memberToDelete
          ? `Are you sure you want to delete ${memberToDelete.employeeName}? This action cannot be undone.`
          : `Are you sure you want to delete these ${selectedEmployeeIds.length} employees? This action cannot be undone.`}
      />

      <DeleteModal
        isOpen={Boolean(periodResetTarget)}
        onClose={handlePeriodResetCancel}
        onConfirm={handlePeriodResetConfirm}
        confirmText="Reset"
        zIndex={100010}
        title={periodResetTarget?.employeeStatus === "Provision Period" ? "Reset Provision Period?" : "Reset Notice Period?"}
        description={
          periodResetTarget?.employeeStatus === "Provision Period"
            ? "Are you sure you want to reset the Provision Period for this employee? This will clear the current Provision Period dates and restore the employee's previous status. This action cannot be undone automatically."
            : "Are you sure you want to reset the Notice Period for this employee? This will clear the current Notice Period dates, clear the Last Working Day, and restore the employee's previous status. This action cannot be undone automatically."
        }
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

      {/* Vacation date selection, shared with Employee Master / Employee Profile */}
      <VacationDatePromptModal
        prompt={datePrompt}
        saving={datePromptSaving}
        onChange={(patch) => setDatePrompt((prev) => (prev ? { ...prev, ...patch } : prev))}
        onCancel={handleDatePromptCancel}
        onConfirm={handleDatePromptConfirm}
      />

      {/* Status date prompt modal (notice / provision / exit) */}
      <EmployeeStatusDatePromptModal
        prompt={statusPrompt}
        saving={statusPromptSaving}
        periodResetSaving={periodResetSaving}
        onChange={(patch) => setStatusPrompt((prev) => (prev ? { ...prev, ...patch } : prev))}
        onCancel={handleStatusPromptCancel}
        onConfirm={handleStatusPromptConfirm}
        onReset={() => requestPeriodReset(statusPrompt.employeeItem)}
      />

    </Card>
  );
}

export default TeamMembersTable;
