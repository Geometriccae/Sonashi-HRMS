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
import leaveRequestService from "../../services/LeaveRequestService";
import styles from "./TeamMembersTable.module.css";
import { buildImageUrl, getApiBaseUrl } from "../../config/config";
import { io as ioClient } from "socket.io-client";
import { useToast } from "../../context/ToastContext";
import DateInput from "../DateInput";
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
  isNonWorkingEmployeeStatus,
  EMPLOYEE_STATUS_VALUES,
} from "../../utils/employeeStatusDisplay";
import {
  matchesHrMetricsListFilters,
  readHrMetricsListParams,
} from "../../utils/hrMetricsFilters";

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

const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const isNoticeOrProvisionStatus = (status) =>
  status === "Notice Period" || status === "Provision Period";

const getPeriodRestoreStatus = (employee) => {
  const current = employee?.employeeStatus;
  const prev = String(employee?.previousEmployeeStatus || "").trim();
  if (prev && EMPLOYEE_STATUS_VALUES.includes(prev) && prev !== current) {
    return prev;
  }
  return "Active";
};

const getDateConfigForStatus = (status) => {
  const configs = {
    "On Vacation": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
      tertiaryLabel: "Leave End Date",
      tertiaryFieldKey: "leaveEndDate",
    },
    "Vacation Pending": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
      tertiaryLabel: "Leave End Date",
      tertiaryFieldKey: "leaveEndDate",
    },
    "Vacation Approved": {
      label: "Return / Entry Date",
      fieldKey: "returnDate",
      secondaryLabel: "First Working Day",
      secondaryFieldKey: "firstWorkingDay",
    },
  };
  return configs[status] || null;
};

const buildVacationDatePrompt = (employeeItem, newStatus) => {
  const cfg = getDateConfigForStatus(newStatus);
  if (!cfg) return null;
  return {
    employeeItem,
    newStatus,
    label: cfg.label,
    fieldKey: cfg.fieldKey,
    dateValue: toDateInputValue(employeeItem[cfg.fieldKey]),
    secondaryLabel: cfg.secondaryLabel,
    secondaryFieldKey: cfg.secondaryFieldKey,
    secondaryDateValue: cfg.secondaryFieldKey ? toDateInputValue(employeeItem[cfg.secondaryFieldKey]) : "",
    tertiaryLabel: cfg.tertiaryLabel,
    tertiaryFieldKey: cfg.tertiaryFieldKey,
    tertiaryDateValue: cfg.tertiaryFieldKey
      ? toDateInputValue(employeeItem.endDate || employeeItem.leaveEndDate)
      : "",
  };
};

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
  const searchTerm = searchParams.get("q") || "";
  const metricsListParams = useMemo(() => readHrMetricsListParams(searchParams), [searchParams]);
  const listReturnPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/teammanagement?${query}` : "/teammanagement";
  }, [searchParams]);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    fetchEmployees();

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
      const employeesData = await employeeService.getEmployeesList();
      setEmployees(employeesData || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to load employees. Please try again.");
    } finally {
      setLoading(false);
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
      fetchEmployees();
      showToast(`${formData.employeeName} has been successfully added.`, 'success');
    } catch (err) {
      console.error("Error refreshing employees after add:", err);
      fetchEmployees();
      showToast("Employee added, but failed to refresh list.", 'warning');
    }
  };

  const handleEditEmployeeSubmit = async (formData) => {
    try {
      fetchEmployees();
      showToast("Employee details updated successfully.", 'success');
    } catch (err) {
      console.error("Error refreshing employees after edit:", err);
      showToast("Employee updated, but failed to refresh list.", 'warning');
    }
  };

  const handleVacationStatusChange = async (employeeItem, newStatus, extraFields = {}) => {
    const empId = employeeItem._id || employeeItem.id;
    try {
      if (newStatus === "Vacation Approved" && (extraFields.returnDate || extraFields.firstWorkingDay)) {
        const returnDate = extraFields.returnDate || extraFields.firstWorkingDay;
        const firstWorkingDay = extraFields.firstWorkingDay || returnDate;
        await employeeService.markVacationReturn(empId, {
          returnDate,
          firstWorkingDay,
          leaveId: employeeItem.linkedLeaveId || null,
        });
      } else {
        await employeeService.updateEmployee(empId, { vacationStatus: newStatus, ...extraFields });
      }

      // Update in-state
      setEmployees(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId)
            ? {
                ...e,
                vacationStatus: newStatus,
                ...extraFields,
                attendance: newStatus === "Vacation Approved" ? "Onsite" : e.attendance,
              }
            : e
        )
      );

      showToast("Vacation status updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update vacation status:", err);
      showToast(err?.message || "Failed to update vacation status.", "error");
      throw err;
    }
  };

  const handleStatusDropdownChange = (employeeItem, newStatus) => {
    const prompt = buildVacationDatePrompt(employeeItem, newStatus);
    if (prompt) {
      // Prefill return dates from planned leave end when marking returned
      if (newStatus === "Vacation Approved") {
        const planned = toDateInputValue(employeeItem.endDate || employeeItem.returnDate) || toDateInputValue(new Date());
        prompt.dateValue = prompt.dateValue || planned;
        prompt.secondaryDateValue = prompt.secondaryDateValue || planned;
      }
      setDatePrompt(prompt);
    } else {
      handleVacationStatusChange(employeeItem, newStatus);
    }
  };

  const handleDatePromptConfirm = async () => {
    if (!datePrompt || datePromptSaving) return;
    const { employeeItem, newStatus, fieldKey, dateValue, secondaryFieldKey, secondaryDateValue, tertiaryFieldKey, tertiaryDateValue } = datePrompt;
    if (newStatus === "Vacation Approved" && !dateValue) {
      showToast("Please select the Return / Entry Date.", "error");
      return;
    }
    const extraFields = {};
    if (dateValue) extraFields[fieldKey] = new Date(dateValue).toISOString();
    if (secondaryFieldKey && secondaryDateValue) {
      extraFields[secondaryFieldKey] = new Date(secondaryDateValue).toISOString();
    } else if (newStatus === "Vacation Approved" && dateValue) {
      extraFields.firstWorkingDay = new Date(dateValue).toISOString();
    }
    if (tertiaryFieldKey && tertiaryDateValue) {
      extraFields[tertiaryFieldKey] = new Date(tertiaryDateValue).toISOString();
    }
    setDatePromptSaving(true);
    try {
      await handleVacationStatusChange(employeeItem, newStatus, extraFields);
      if (employeeItem.linkedLeaveId && tertiaryDateValue) {
        try {
          await leaveRequestService.updateLeaveRequest(employeeItem.linkedLeaveId, {
            endDate: new Date(tertiaryDateValue).toISOString(),
          });
        } catch (_) { /* employee dates already saved */ }
      }
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
    const isEdit = Boolean(options.isEdit);
    if (newStatus === "Notice Period") {
      setStatusPrompt({
        employeeItem,
        newStatus,
        mode: "notice",
        isEdit,
        noticePeriodStartDate: toDateInputValue(employeeItem.noticePeriodStartDate),
        noticePeriodEndDate: toDateInputValue(
          employeeItem.noticePeriodEndDate || employeeItem.lastWorkingDay
        ),
        lastWorkingDay: "",
        provisionPeriodStartDate: "",
        provisionPeriodEndDate: "",
      });
      return;
    }
    if (newStatus === "Provision Period") {
      setStatusPrompt({
        employeeItem,
        newStatus,
        mode: "provision",
        isEdit,
        provisionPeriodStartDate: toDateInputValue(employeeItem.provisionPeriodStartDate),
        provisionPeriodEndDate: toDateInputValue(employeeItem.provisionPeriodEndDate),
        lastWorkingDay: "",
        noticePeriodStartDate: "",
        noticePeriodEndDate: "",
      });
      return;
    }
    if (isNonWorkingEmployeeStatus(newStatus)) {
      setStatusPrompt({
        employeeItem,
        newStatus,
        mode: "exit",
        lastWorkingDay: toDateInputValue(employeeItem.lastWorkingDay),
        noticePeriodStartDate: "",
        noticePeriodEndDate: "",
        provisionPeriodStartDate: "",
        provisionPeriodEndDate: "",
      });
      return;
    }
    confirmEmployeeStatusChange(employeeItem, newStatus, {});
  };

  const confirmEmployeeStatusChange = async (employeeItem, newStatus, dates = {}, options = {}) => {
    const empId = employeeItem._id || employeeItem.id;
    const isEdit = Boolean(options.isEdit);
    setStatusPromptSaving(true);
    try {
      const payload = { employeeStatus: newStatus };
      const currentStatus = employeeItem.employeeStatus || "Active";

      if (
        isNoticeOrProvisionStatus(newStatus) &&
        currentStatus !== newStatus
      ) {
        payload.previousEmployeeStatus = currentStatus;
      }

      if (newStatus === "Notice Period") {
        if (dates.noticePeriodStartDate) {
          payload.noticePeriodStartDate = new Date(dates.noticePeriodStartDate).toISOString();
        }
        if (dates.noticePeriodEndDate) {
          payload.noticePeriodEndDate = new Date(dates.noticePeriodEndDate).toISOString();
          payload.lastWorkingDay = new Date(dates.noticePeriodEndDate).toISOString();
        }
      } else if (newStatus === "Provision Period") {
        if (dates.provisionPeriodStartDate) {
          payload.provisionPeriodStartDate = new Date(dates.provisionPeriodStartDate).toISOString();
        }
        if (dates.provisionPeriodEndDate) {
          payload.provisionPeriodEndDate = new Date(dates.provisionPeriodEndDate).toISOString();
        }
      } else if (isNonWorkingEmployeeStatus(newStatus)) {
        payload.lastWorkingDay = dates.lastWorkingDay
          ? new Date(dates.lastWorkingDay).toISOString()
          : null;
        payload.vacationStatus = "Onsite";
        payload.attendance = "Onsite";
      }

      const updated = await employeeService.updateEmployee(empId, payload);
      setEmployees(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId)
            ? { ...e, ...payload, ...(updated && typeof updated === "object" ? updated : {}) }
            : e
        )
      );
      employeeService.invalidateCache?.();
      if (isEdit && newStatus === "Notice Period") {
        showToast("Notice Period updated successfully.", "success");
      } else if (isEdit && newStatus === "Provision Period") {
        showToast("Provision Period updated successfully.", "success");
      } else {
        showToast("Employee status updated successfully.", "success");
      }
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
    const mode = statusPrompt.mode || "exit";
    if (mode === "notice") {
      const start = statusPrompt.noticePeriodStartDate;
      const end = statusPrompt.noticePeriodEndDate;
      if (start && end && start > end) {
        showToast("Start date cannot be after the end date.", "error");
        return;
      }
    }
    if (mode === "provision") {
      const start = statusPrompt.provisionPeriodStartDate;
      const end = statusPrompt.provisionPeriodEndDate;
      if (start && end && start > end) {
        showToast("Start date cannot be after the end date.", "error");
        return;
      }
    }
    await confirmEmployeeStatusChange(
      statusPrompt.employeeItem,
      statusPrompt.newStatus,
      {
        lastWorkingDay: statusPrompt.lastWorkingDay,
        noticePeriodStartDate: statusPrompt.noticePeriodStartDate,
        noticePeriodEndDate: statusPrompt.noticePeriodEndDate,
        provisionPeriodStartDate: statusPrompt.provisionPeriodStartDate,
        provisionPeriodEndDate: statusPrompt.provisionPeriodEndDate,
      },
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
    const employeeItem = periodResetTarget;
    const empId = employeeItem._id || employeeItem.id;
    const currentStatus = employeeItem.employeeStatus;
    const restoredStatus = getPeriodRestoreStatus(employeeItem);
    const payload = {
      employeeStatus: restoredStatus,
      previousEmployeeStatus: null,
    };
    if (currentStatus === "Notice Period") {
      payload.noticePeriodStartDate = null;
      payload.noticePeriodEndDate = null;
      payload.lastWorkingDay = null;
    } else if (currentStatus === "Provision Period") {
      payload.provisionPeriodStartDate = null;
      payload.provisionPeriodEndDate = null;
    }

    setPeriodResetSaving(true);
    try {
      const updated = await employeeService.updateEmployee(empId, payload);
      setEmployees(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId)
            ? { ...e, ...payload, ...(updated && typeof updated === "object" ? updated : {}) }
            : e
        )
      );
      employeeService.invalidateCache?.();
      showToast(
        currentStatus === "Provision Period"
          ? "Provision Period reset successfully."
          : "Notice Period reset successfully.",
        "success"
      );
      setPeriodResetTarget(null);
      setStatusPrompt(null);
    } catch (err) {
      console.error("Failed to reset employee status:", err);
      showToast(err?.message || "Failed to reset status.", "error");
    } finally {
      setPeriodResetSaving(false);
    }
  };

  const filteredData = useMemo(() => {
    const asOf = metricsListParams.year
      ? new Date(Number(metricsListParams.year), 11, 31, 23, 59, 59, 999)
      : new Date();

    return employees.filter((member) => {
      let matchesFilter = true;
      if (activeFilter === "Active") {
        matchesFilter = isWorkingEmployeeStatus(member.employeeStatus);
      } else if (activeFilter === "Inactive") {
        matchesFilter = isNonWorkingEmployeeStatus(member.employeeStatus);
      }

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        (member.employeeName || "").toLowerCase().includes(q) ||
        (member.employeeId || "").toLowerCase().includes(q) ||
        (member.emailId || "").toLowerCase().includes(q) ||
        (member.mobile || "").toLowerCase().includes(q) ||
        (member.role || "").toLowerCase().includes(q);

      const matchesMetrics = matchesHrMetricsListFilters(member, metricsListParams, asOf);

      return matchesFilter && matchesSearch && matchesMetrics;
    });
  }, [employees, activeFilter, searchTerm, metricsListParams]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage) || 1);

  useEffect(() => {
    // Don't clamp while employees are still loading (empty list → totalPages=1 wipes restored page)
    if (employees.length === 0) return;
    if (currentPage > totalPages) {
      patchSearchParams({ page: totalPages === 1 ? undefined : totalPages });
    }
  }, [employees.length, currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (!isActive) return <Typography.Text type="secondary">—</Typography.Text>;

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
                  options={[
                    { value: "Onsite", label: "Onsite" },
                    { value: "On Vacation", label: "On vacation" },
                    { value: "Vacation Approved", label: "Returned back from vacation" },
                    { value: "Vacation Pending", label: "Yet to go" },
                  ]}
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
            { label: "Inactive", value: "Inactive" },
            { label: "All", value: "All" },
          ]}
          style={{ background: "#f5f5f5", padding: 4, borderRadius: 24 }}
        />
        <Input
          placeholder="Search by name, employee ID, email, role..."
          prefix={<SearchOutlined style={{ color: "#98A1B0" }} />}
          value={searchTerm}
          onChange={(e) => patchSearchParams({ q: e.target.value }, { resetPage: true })}
          allowClear
          onClear={() => patchSearchParams({ q: "" }, { resetPage: true })}
          style={{ width: 320, borderRadius: 24 }}
        />
      </div>

      {metricsListParams.year ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Showing employees for ${metricsListParams.year}${metricsListParams.month ? ` / ${metricsListParams.month}` : ""}${metricsListParams.gender ? ` · ${metricsListParams.gender}` : ""}${metricsListParams.department ? ` · ${metricsListParams.department}` : ""}${metricsListParams.joined === "1" ? " · New joiners" : ""}${metricsListParams.exited === "1" ? " · Exits" : ""}.`}
        />
      ) : null}

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
                searchTerm ? "No employees match your search." : "No employees found."
              }
            />
          ),
        }}
        pagination={{
          current: currentPage,
          pageSize: itemsPerPage,
          total: filteredData.length,
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
              @keyframes datePromptSpin {
                to { transform: rotate(360deg); }
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
                disabled={datePromptSaving}
                style={{
                  position: "absolute",
                  top: "20px", right: "20px",
                  background: "#f1f5f9", border: "none",
                  width: "32px", height: "32px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", color: "#64748b",
                  cursor: datePromptSaving ? "not-allowed" : "pointer",
                  opacity: datePromptSaving ? 0.5 : 1,
                  transition: "all 0.2s ease",
                  lineHeight: 1
                }}
                onMouseEnter={e => { if (!datePromptSaving) { e.target.style.background = "#e2e8f0"; e.target.style.color = "#0f172a"; } }}
                onMouseLeave={e => { if (!datePromptSaving) { e.target.style.background = "#f1f5f9"; e.target.style.color = "#64748b"; } }}
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
                  {datePrompt.secondaryFieldKey ? "Set Vacation Dates" : `Set ${datePrompt.label}`}
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
                  Please select the vacation-related date{datePrompt.secondaryFieldKey ? "s" : ""} for <strong style={{ color: "#334155" }}>{datePrompt.employeeItem.employeeName}</strong>.
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
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Select {datePrompt.label}
                  </label>
                  <DateInput
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
                  />
                </div>
                {datePrompt.secondaryFieldKey && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Select {datePrompt.secondaryLabel}
                    </label>
                    <DateInput
                      value={datePrompt.secondaryDateValue}
                      className="premium-input-date"
                      onChange={e => setDatePrompt(prev => ({ ...prev, secondaryDateValue: e.target.value }))}
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
                    />
                  </div>
                )}
                {datePrompt.tertiaryFieldKey && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Select {datePrompt.tertiaryLabel}
                    </label>
                    <DateInput
                      value={datePrompt.tertiaryDateValue}
                      className="premium-input-date"
                      onChange={e => setDatePrompt(prev => ({ ...prev, tertiaryDateValue: e.target.value }))}
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
                    />
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                onClick={handleDatePromptCancel}
                disabled={datePromptSaving}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "2px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: datePromptSaving ? "not-allowed" : "pointer",
                  opacity: datePromptSaving ? 0.6 : 1,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={e => { if (!datePromptSaving) { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; } }}
                onMouseLeave={e => { if (!datePromptSaving) { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; } }}
              >
                Cancel
              </button>
              <button
                onClick={handleDatePromptConfirm}
                disabled={datePromptSaving}
                style={{
                  padding: "12px 28px",
                  borderRadius: "12px",
                  border: "none",
                  background: datePromptSaving ? "#94a3b8" : "linear-gradient(135deg, #4f46e5, #6366f1)",
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: datePromptSaving ? "not-allowed" : "pointer",
                  boxShadow: datePromptSaving ? "none" : "0 4px 12px rgba(79, 70, 229, 0.25)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  minWidth: "120px"
                }}
                onMouseEnter={e => { if (!datePromptSaving) { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(79, 70, 229, 0.35)"; } }}
                onMouseLeave={e => { if (!datePromptSaving) { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.25)"; } }}
              >
                {datePromptSaving && (
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid rgba(255,255,255,0.35)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "datePromptSpin 0.7s linear infinite"
                    }}
                  />
                )}
                {datePromptSaving ? "Saving..." : "Confirm"}
              </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Status date prompt modal (notice / provision / exit) */}
      {statusPrompt && (() => {
        const nameInitials = statusPrompt.employeeItem.employeeName
          ? statusPrompt.employeeItem.employeeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : "EE";
        const mode = statusPrompt.mode || "exit";
        const isEdit = Boolean(statusPrompt.isEdit);
        const statusLabel =
          ACTIVE_OPTIONS.find((o) => o.value === statusPrompt.newStatus)?.label ||
          statusPrompt.newStatus;
        const title =
          mode === "notice"
            ? (isEdit ? "Edit Notice Period" : "Set Notice Period")
            : mode === "provision"
              ? (isEdit ? "Edit Provision Period" : "Set Provision Period")
              : "Update Employee Status";
        const description =
          mode === "notice"
            ? <>Please {isEdit ? "update" : "set"} notice period dates for <strong style={{ color: "#334155" }}>{statusPrompt.employeeItem.employeeName}</strong>.</>
            : mode === "provision"
              ? <>Please {isEdit ? "update" : "set"} provision period dates for <strong style={{ color: "#334155" }}>{statusPrompt.employeeItem.employeeName}</strong>.</>
              : <>Please select the last working day for <strong style={{ color: "#334155" }}>{statusPrompt.employeeItem.employeeName}</strong>.</>;
        const dateInputStyle = {
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
          cursor: "pointer",
        };

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 100001,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px"
            }}
            onClick={handleStatusPromptCancel}
          >
            <style>{`
              @keyframes statusPromptFadeIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              @keyframes statusPromptSpin {
                to { transform: rotate(360deg); }
              }
              .status-prompt-date:focus {
                border-color: #ef4444 !important;
                box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
              }
            `}</style>
            <div
              style={{
                background: "#fff",
                borderRadius: "24px",
                padding: "36px",
                width: "440px",
                maxWidth: "100%",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(239, 68, 68, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                position: "relative",
                overflow: "hidden",
                border: "1px solid #f1f5f9",
                animation: "statusPromptFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                textAlign: "left"
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: "6px",
                background: "linear-gradient(90deg, #ef4444, #f97316, #eab308)"
              }} />

              <button
                onClick={handleStatusPromptCancel}
                disabled={statusPromptSaving}
                style={{
                  position: "absolute",
                  top: "20px", right: "20px",
                  background: "#f1f5f9", border: "none",
                  width: "32px", height: "32px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", color: "#64748b",
                  cursor: statusPromptSaving ? "not-allowed" : "pointer",
                  opacity: statusPromptSaving ? 0.5 : 1,
                  transition: "all 0.2s ease",
                  lineHeight: 1
                }}
                onMouseEnter={e => { if (!statusPromptSaving) { e.target.style.background = "#e2e8f0"; e.target.style.color = "#0f172a"; } }}
                onMouseLeave={e => { if (!statusPromptSaving) { e.target.style.background = "#f1f5f9"; e.target.style.color = "#64748b"; } }}
              >&times;</button>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px", marginTop: "10px" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #fee2e2, #fecaca)",
                  color: "#dc2626",
                  fontSize: "22px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 16px rgba(220, 38, 38, 0.12)"
                }}>
                  {nameInitials}
                </div>
                <h3 style={{ margin: "10px 0 2px", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                  {title}
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
                  {description}
                </p>
              </div>

              <div style={{
                background: "#fef2f2",
                borderRadius: "16px",
                padding: "14px 18px",
                border: "1px solid #fecaca",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Changing Status to:
                </span>
                <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    background: "linear-gradient(135deg, #fee2e2, #fecaca)",
                    color: "#991b1b",
                    fontSize: "13px",
                    fontWeight: "800",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    border: "1px solid #fca5a525"
                  }}>
                    <span style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#ef4444",
                      boxShadow: "0 0 0 2px #ef444425"
                    }} />
                    {statusLabel}
                  </span>
                </div>
              </div>

              {mode === "notice" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Notice Period Start Date
                    </label>
                    <DateInput
                      value={statusPrompt.noticePeriodStartDate || ""}
                      className="status-prompt-date"
                      onChange={e => setStatusPrompt(prev => ({ ...prev, noticePeriodStartDate: e.target.value }))}
                      style={dateInputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Notice Period End Date / Last Working Day
                    </label>
                    <DateInput
                      value={statusPrompt.noticePeriodEndDate || ""}
                      className="status-prompt-date"
                      onChange={e => setStatusPrompt(prev => ({ ...prev, noticePeriodEndDate: e.target.value }))}
                      style={dateInputStyle}
                    />
                  </div>
                </>
              )}

              {mode === "provision" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Provision Period Start Date
                    </label>
                    <DateInput
                      value={statusPrompt.provisionPeriodStartDate || ""}
                      className="status-prompt-date"
                      onChange={e => setStatusPrompt(prev => ({ ...prev, provisionPeriodStartDate: e.target.value }))}
                      style={dateInputStyle}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Provision Period End Date
                    </label>
                    <DateInput
                      value={statusPrompt.provisionPeriodEndDate || ""}
                      className="status-prompt-date"
                      onChange={e => setStatusPrompt(prev => ({ ...prev, provisionPeriodEndDate: e.target.value }))}
                      style={dateInputStyle}
                    />
                  </div>
                </>
              )}

              {mode === "exit" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Last Working Day
                  </label>
                  <DateInput
                    value={statusPrompt.lastWorkingDay || ""}
                    className="status-prompt-date"
                    onChange={e => setStatusPrompt(prev => ({ ...prev, lastWorkingDay: e.target.value }))}
                    style={dateInputStyle}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={handleStatusPromptCancel}
                  disabled={statusPromptSaving || periodResetSaving}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "2px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: (statusPromptSaving || periodResetSaving) ? "not-allowed" : "pointer",
                    opacity: (statusPromptSaving || periodResetSaving) ? 0.6 : 1,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; } }}
                  onMouseLeave={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; } }}
                >
                  Cancel
                </button>
                {isEdit && (mode === "notice" || mode === "provision") && (
                  <button
                    onClick={() => requestPeriodReset(statusPrompt.employeeItem)}
                    disabled={statusPromptSaving || periodResetSaving}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "2px solid #fecaca",
                      background: "#fff",
                      color: "#dc2626",
                      fontWeight: "700",
                      fontSize: "14px",
                      cursor: (statusPromptSaving || periodResetSaving) ? "not-allowed" : "pointer",
                      opacity: (statusPromptSaving || periodResetSaving) ? 0.6 : 1,
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.background = "#fef2f2"; e.target.style.borderColor = "#fca5a5"; } }}
                    onMouseLeave={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.background = "#fff"; e.target.style.borderColor = "#fecaca"; } }}
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleStatusPromptConfirm}
                  disabled={statusPromptSaving || periodResetSaving}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: (statusPromptSaving || periodResetSaving) ? "#94a3b8" : "linear-gradient(135deg, #dc2626, #ef4444)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: (statusPromptSaving || periodResetSaving) ? "not-allowed" : "pointer",
                    boxShadow: (statusPromptSaving || periodResetSaving) ? "none" : "0 4px 12px rgba(220, 38, 38, 0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    minWidth: "120px"
                  }}
                  onMouseEnter={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.35)"; } }}
                  onMouseLeave={e => { if (!statusPromptSaving && !periodResetSaving) { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.25)"; } }}
                >
                  {statusPromptSaving && (
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "statusPromptSpin 0.7s linear infinite"
                      }}
                    />
                  )}
                  {statusPromptSaving ? "Saving..." : (isEdit ? "Save Changes" : "Confirm")}
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
