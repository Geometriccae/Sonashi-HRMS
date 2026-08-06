import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./TeamManagementSalesLeads.module.css";
import Side from "../sidebar/Sidebar";
import employeeService from "../../services/EmployeeService";
import leaveRequestService from "../../services/LeaveRequestService";
import DocumentsService from "../../services/EmployeeDocumentService";
import { DOC_TYPE_OPTIONS } from "../../components/team-management-components/TeamMangementDocuments";
import EditEmployeeModal from "../../components/team-management-components/EditEmployeeModal";
import Documents from "../../components/team-management-components/TeamMangementDocuments";
// import Calendar from "../../components/CalendarComponent";
import Meetingstable from "../../components/team-management-components/MeetingsTable";
import config, { buildImageUrl, handleImageError } from "../../config/config";
import TopNavbar, { PageBody, pageLayoutStyles } from "../../components/TopNavbar";
import DeleteModal from "../../components/delete-modal/DeleteModal";
import AssignTaskModal from "../../components/team-management-components/AssignTaskModal";
import FileUploadModal from "../../components/FileUploadModal";
import DropDownList from "../../components/DropDownList";
import AddIncrementModal from "../../components/team-management-components/AddIncrementModal";
import AddLeaveRequestModal from "../../components/leave-request/AddLeaveRequestModal";
import EditLeaveRequestModal from "../../components/leave-request/EditLeaveRequestModal";
import { exportEmployeeBasicInfo, exportEvents, exportDocuments, exportToPDF, exportToTXT } from "../../utils/exportUtils";
import { getEventsByEmployeeId } from "../../services/AssignEventService";
import { useToast } from "../../context/ToastContext";
import { calculateLeaveBalance, calculateLeaveDays } from "../../utils/leaveCalculator";
import { findLinkedEmployee } from "../../utils/yetToGoHelpers";
import {
  formatEmployeeStatusDisplay,
  isNonWorkingEmployeeStatus,
  isWorkingEmployeeStatus,
} from "../../utils/employeeStatusDisplay";

import belldot from "../../assets/dashboard/bell-dot.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";
import employee from "../../assets/dashboard/employee.jpg";
import arrowleft from "../../assets/dashboard/arrow-left.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import plus from "../../assets/dashboard/plus.svg";
import pencillineblue from "../../assets/dashboard/pencil-line-blue.svg";
import upload from "../../assets/dashboard/upload.svg";
import deletewhite from "../../assets/dashboard/delete-white.svg";
import ProfileAvatar from "../../components/ProfileAvatar";
import MobileBottomNavigation from "../../components/MobileBottomNavigation";
const EditIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 30 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15.1136 6.0089H8.02525C7.48812 6.0089 6.97299 6.22227 6.59318 6.60208C6.21337 6.98189 6 7.49702 6 8.03415V22.2109C6 22.748 6.21337 23.2632 6.59318 23.643C6.97299 24.0228 7.48812 24.2361 8.02525 24.2361H22.202C22.7391 24.2361 23.2543 24.0228 23.6341 23.643C24.0139 23.2632 24.2272 22.748 24.2272 22.2109V15.1225M21.5691 5.62916C21.972 5.22632 22.5183 5 23.088 5C23.6578 5 24.2041 5.22632 24.607 5.62916C25.0098 6.03201 25.2361 6.57839 25.2361 7.1481C25.2361 7.71781 25.0098 8.26419 24.607 8.66704L15.4802 17.7948C15.2397 18.0351 14.9427 18.2109 14.6164 18.3062L11.7072 19.1568C11.62 19.1822 11.5277 19.1838 11.4397 19.1612C11.3518 19.1387 11.2715 19.093 11.2074 19.0288C11.1432 18.9646 11.0974 18.8843 11.0749 18.7964C11.0524 18.7085 11.0539 18.6161 11.0793 18.529L11.9299 15.6197C12.0256 15.2937 12.2019 14.997 12.4423 14.757L21.5691 5.62916Z"
      stroke="#8C8E90"
      strokeWidth="2.02525"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 29 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 8.0505H23.2272M21.202 8.0505V22.2272C21.202 23.2399 20.1894 24.2525 19.1767 24.2525H9.0505C8.03787 24.2525 7.02525 23.2399 7.02525 22.2272V8.0505M10.0631 8.0505V6.02525C10.0631 5.01262 11.0757 4 12.0884 4H16.1389C17.1515 4 18.1641 5.01262 18.1641 6.02525V8.0505M12.0884 13.1136V19.1894M16.1389 13.1136V19.1894"
      stroke="#8C8E90"
      strokeWidth="2.02525"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);



function TeamManagementSalesLeads() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("basicInfo");
  const basicInfoRef = useRef(null);
  const salaryRef = useRef(null);
  const incrementsRef = useRef(null);
  const leaveTabRef = useRef(null);
  const documentsRef = useRef(null);

  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [remarks, setRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [addingRemark, setAddingRemark] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry', 'data', or 'increment'
  const [selectedIncrement, setSelectedIncrement] = useState(null);
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isEditLeaveModalOpen, setIsEditLeaveModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const teamListPath = location.state?.from || "/teammanagement";
  // const { employeeId } = useParams();

  const { id: employeeId } = useParams();

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [calendarKey, setCalendarKey] = useState(0); // Force calendar refresh
  const [documentsKey, setDocumentsKey] = useState(0); // Force documents refresh

  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isIncrementModalOpen, setIsIncrementModalOpen] = useState(false);

  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  const isAdmin = userRole === "admin" || userRole === "hod";

  // Fetch employee data when component mounts or employeeId changes
  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

  const fetchEmployeeLeaves = async (currentEmployee) => {
    try {
      const leaves = await leaveRequestService.getLeaveRequests();
      const allLeaves = Array.isArray(leaves) ? leaves : leaves.data || [];
      setAllLeaveRequests(allLeaves);

      const emp =
        currentEmployee ||
        employee ||
        (employeeId ? { _id: employeeId } : null);

      const visibleStatuses = new Set([
        "Approved",
        "HOD Approved",
        "Pending",
        "Imported",
      ]);

      const empLeaves = allLeaves.filter((req) => {
        if (!req || !visibleStatuses.has(req.status)) return false;

        // Primary: shared linker (User.employeeId ↔ Employee._id, name, codes)
        if (emp && findLinkedEmployee(req, [emp])) return true;

        // Fallback: leave.employee stored as Employee._id when no User exists
        const empMongoId = String(emp?._id || employeeId || "");
        const empCode = String(emp?.employeeId || "");
        const reqRef = String(req.employee?._id || req.employee || "");
        if (empMongoId && reqRef && reqRef === empMongoId) return true;

        const linkedEmpId = String(
          req.employee?.employeeId?._id || req.employee?.employeeId || ""
        );
        if (
          linkedEmpId &&
          (linkedEmpId === empMongoId || (empCode && linkedEmpId === empCode))
        ) {
          return true;
        }

        if (req.employeeId) {
          const rid = String(req.employeeId);
          if (rid === empMongoId || (empCode && rid === empCode)) return true;
        }

        const reqName = String(req.employeeName || "")
          .toLowerCase()
          .trim();
        const empName = String(emp?.employeeName || "")
          .toLowerCase()
          .trim();
        if (reqName && empName && reqName === empName) return true;

        return false;
      });

      setEmployeeLeaves(
        empLeaves.sort(
          (a, b) => new Date(b.startDate) - new Date(a.startDate)
        )
      );
    } catch (err) {
      console.error("Failed to fetch leaves", err);
    }
  };

  // Keep Leave Entitlement in sync whenever the tab is opened
  useEffect(() => {
    if (activeTab === "leave" && (employee || employeeId)) {
      fetchEmployeeLeaves(employee);
    }
  }, [activeTab, employeeId, employee?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // const fetchEmployeeData = async () => {
  //   try {
  //     setLoading(true);
  //     setError(null);
  //     const employeeData = await employeeService.getEmployee(employeeId);
  //     console.log("Fetched employee data:", employeeData);
  //     setEmployee(employeeData);
  //   } catch (err) {
  //     console.error("Error fetching employee:", err);
  //     setError("Failed to load employee data. Please try again.");
  //     setEmployee(null);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const fetchEmployeeData = async () => {
    if (!employeeId) {
      setError("Employee ID is missing in URL");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("Fetching employee with ID:", employeeId);

      const employeeData = await employeeService.getEmployee(employeeId);

      console.log("Fetched employee data:", employeeData);

      if (!employeeData) {
        setError("No employee data returned from API");
        setEmployee(null);
      } else {
        setEmployee(employeeData);
        fetchEmployeeLeaves(employeeData);
      }
    } catch (err) {
      console.error("Error fetching employee:", err);
      setError("Failed to load employee data. Please try again.");
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRemarks = React.useCallback(async () => {
    if (!employeeId || (userRole !== "admin" && userRole !== "hod")) return;
    setRemarksLoading(true);
    setRemarkError("");
    try {
      const data = await employeeService.getEmployeeRemarks(employeeId);
      setRemarks(Array.isArray(data) ? data : []);
    } catch (err) {
      setRemarkError(err?.message || "Failed to load remarks");
      setRemarks([]);
    } finally {
      setRemarksLoading(false);
    }
  }, [employeeId, userRole]);

  useEffect(() => {
    if (activeTab === "remarks" && employeeId) fetchRemarks();
  }, [activeTab, employeeId, fetchRemarks]);

  const handleAddRemark = async (e) => {
    e.preventDefault();
    const trimmed = (remarkText || "").trim();
    if (!trimmed) {
      setRemarkError("Remark cannot be empty");
      return;
    }
    setRemarkError("");
    setAddingRemark(true);
    try {
      const created = await employeeService.addEmployeeRemark(employeeId, trimmed);
      setRemarks((prev) => [created, ...prev]);
      setRemarkText("");
      showToast?.("Remark added successfully", "success");
    } catch (err) {
      setRemarkError(err?.message || "Failed to add remark");
      showToast?.(err?.message || "Failed to add remark", "error");
    } finally {
      setAddingRemark(false);
    }
  };

  const canAccessRemarks = userRole === "admin" || userRole === "hod";

  useEffect(() => {
    const updateIndicatorPosition = () => {
      let activeElement;
      switch (activeTab) {
        case "basicInfo":
          activeElement = basicInfoRef.current;
          break;
        case "documents":
          activeElement = documentsRef.current;
          break;
        case "salary":
          activeElement = salaryRef.current;
          break;
        case "increments":
          activeElement = incrementsRef.current;
          break;
        case "leave":
          activeElement = leaveTabRef.current;
          break;

        default:
          activeElement = basicInfoRef.current;
      }

      if (activeElement) {
        const rect = activeElement.getBoundingClientRect();
        const containerRect =
          activeElement.parentElement.getBoundingClientRect();
        setIndicatorStyle({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    updateIndicatorPosition();
    window.addEventListener("resize", updateIndicatorPosition);

    return () => {
      window.removeEventListener("resize", updateIndicatorPosition);
    };
  }, [activeTab]);

  const handleDeleteEntry = () => {
    setDeleteType("entry");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteData = () => {
    setDeleteType("data");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (deleteType === "entry") {
        await employeeService.deleteEmployee(employeeId);
        showToast("Employee deleted successfully.", 'success');
        navigate(teamListPath);
        return; // no further cleanup needed, leaving page
      } else if (deleteType === "data") {
        await DocumentsService.removeAll(employeeId);
        setDocumentsKey(prev => prev + 1);
        showToast("All documents deleted successfully.", 'success');
      } else if (deleteType === "increment") {
        const updatedEmployee = await employeeService.deleteEmployeeIncrement(employeeId, selectedIncrement._id);
        setEmployee(updatedEmployee);
        showToast("Increment deleted successfully.", 'success');
      }
    } catch (e) {
      console.error("Delete failed", e);
      showToast(e.message || "Delete failed", 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteType("");
      setSelectedIncrement(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteType("");
    setSelectedIncrement(null);
  };

  const handleNewEvent = () => {
    setIsCreateEventModalOpen(true);
  };

  const handleCreateEventClose = () => {
    setIsCreateEventModalOpen(false);
  };

  const handleEditEmployeeClose = () => {
    setIsEditEmployeeModalOpen(false);
  };

  const handleEventCreated = (newEvent) => {
    console.log("Event created successfully:", newEvent);
    // Force calendar component to refresh by updating its key
    setCalendarKey(prev => prev + 1);
    // You can also update local events state if needed
    setEvents(prev => [...prev, newEvent]);
  };

  const handleEditEmployeeSubmit = async (updatedEmployee) => {
    try {
      setEmployee(updatedEmployee);
      setIsEditEmployeeModalOpen(false);
      showToast("Employee details updated successfully.", 'success');
    } catch (err) {
      console.error("Error updating employee:", err);
      showToast("Failed to update employee.", 'error');
    }
  };

  const handleAddIncrement = async (incrementData) => {
    try {
      let updatedEmployee;
      if (selectedIncrement) {
        updatedEmployee = await employeeService.updateEmployeeIncrement(employeeId, selectedIncrement._id, incrementData);
        showToast("Salary increment updated successfully.", 'success');
      } else {
        updatedEmployee = await employeeService.addEmployeeIncrement(employeeId, incrementData);
        showToast("Salary increment added successfully.", 'success');
      }
      setEmployee(updatedEmployee);
      setSelectedIncrement(null);
    } catch (err) {
      console.error("Error saving increment:", err);
      showToast(err.message || "Failed to save increment.", 'error');
    }
  };

  const handleEditIncrementClick = (inc) => {
    setSelectedIncrement(inc);
    setIsIncrementModalOpen(true);
  };

  const handleDeleteIncrementClick = (inc) => {
    setSelectedIncrement(inc);
    setDeleteType("increment");
    setIsDeleteModalOpen(true);
  };

  const handleFileUpload = () => {
    setIsFileUploadModalOpen(true);
  };

  const handleFileUploadClose = () => {
    setIsFileUploadModalOpen(false);
  };

  const handleFileUploadComplete = async (files) => {
    try {
      if (!employeeId || !files || files.length === 0) return;
      // Upload each file sequentially (could be parallel if desired)
      for (const fileObj of files) {
        // Handle backwards compatibility if fileObj is just a File
        const isFile = fileObj instanceof File || !fileObj.rawFile;
        const file = isFile ? fileObj : fileObj.rawFile;
        const type = isFile ? undefined : fileObj.type;

        await DocumentsService.uploadForEmployee(employeeId, file, {
          uploadedBy: "Current User",
          userRole: "Sales Executive",
          type: type
        });
      }
      // Refresh documents tab
      setDocumentsKey(prev => prev + 1);
      showToast("Files uploaded successfully.", 'success');
    } catch (e) {
      console.error("Upload failed", e);
      showToast(e.message || "Upload failed", 'error');
    } finally {
      setIsFileUploadModalOpen(false);
    }
  };

  const handleExportClick = (event) => {
    if (exportButtonRef.current) {
      const rect = exportButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  const handleExportOptionSelect = async (option) => {
    try {
      if (activeTab === "basicInfo") {
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(employee, null, 2), `${employee?.employeeName || 'employee'}_basic_info.txt`);
        return exportEmployeeBasicInfo(employee);
      }

      if (activeTab === "meetings") {
        const events = await getEventsByEmployeeId(employeeId);
        const mapped = (events || []).map(e => ({
          title: e.eventName || e.title,
          date: e.date,
          time: e.time,
          eventType: e.eventType,
          notes: e.notes,
          link: e.link,
          assignedTeamMember: e.assignedTeamMember,
          color: e.color
        }));
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(mapped, null, 2), `${employee?.employeeName || 'employee'}_events.txt`);
        return exportEvents(mapped, employee?.employeeName || 'employee');
      }

      if (activeTab === "documents") {
        const docs = await DocumentsService.listByEmployee(employeeId);
        if (option === "pdf") return exportToPDF();
        if (option === "txt") return exportToTXT(JSON.stringify(docs, null, 2), `${employee?.employeeName || 'employee'}_documents.txt`);
        return exportDocuments(docs, employee?.employeeName || 'employee');
      }

      if (option === "print") {
        return window.print();
      }
    } catch (e) {
      console.error('Export failed:', e);
      showToast(e.message || 'Export failed', 'error');
    } finally {
      setIsDropdownOpen(false);
    }
  };

  // Render different buttons based on active tab
  const renderButtons = () => {
    const isAdmin = userRole === "admin" || userRole === "hod";
    const canEdit =
      userRole !== "viewer" &&
      userRole !== "authorize_user" &&
      (isAdmin || userRole === "hr");

    switch (activeTab) {
      case "basicInfo":
        return (
          <div className={styles.row_view5}>
            {canEdit && (
              <button
                className={`${styles.button_row_view} ${styles.editbutton}`}
                onClick={() => setIsEditEmployeeModalOpen(true)}
              >
                <span className={`${styles.text3} ${styles.editbuttontext}`}>
                  Edit Data
                </span>
                <img src={pencillineblue} className={styles.image3} alt="edit" />
              </button>
            )}
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
            </button>
            {isAdmin && (
              <button
                className={styles.button_row_view3}
                onClick={handleDeleteEntry}
              >
                <span className={styles.text5}>Delete Entry</span>
                <img src={deletewhite} className={styles.image3} alt="delete" />
              </button>
            )}
          </div>
        );
      case "salary":
        return (
          <div className={styles.row_view5}>
            {canEdit && (
              <button
                className={`${styles.button_row_view} ${styles.editbutton}`}
                onClick={() => setIsEditEmployeeModalOpen(true)}
              >
                <span className={`${styles.text3} ${styles.editbuttontext}`}>
                  Edit Salary
                </span>
                <img src={pencillineblue} className={styles.image3} alt="edit" />
              </button>
            )}
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
            </button>
          </div>
        );
      case "documents":
        return (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={handleFileUpload}
            >
              <span className={styles.text3}>Upload</span>
              <img src={plus} className={styles.image3} alt="" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
            </button>
            {isAdmin && (
              <button
                className={styles.button_row_view3}
                onClick={handleDeleteData}
              >
                <span className={styles.text5}>Delete All</span>
                <img src={deletewhite} className={styles.image3} alt="delete" />
              </button>
            )}
          </div>
        );
      case "increments":
        return isAdmin ? (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={() => setIsIncrementModalOpen(true)}
            >
              <span className={styles.text3}>Add Increment</span>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
          </div>
        ) : null;
      case "leave":
        return isAdmin ? (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={() => setIsLeaveModalOpen(true)}
            >
              <span className={styles.text3}>Add Leave Entitlement</span>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
          </div>
        ) : null;
      default:
        return null;
    }
  };


  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar
          title="Team Management"
          breadcrumbs={[
            { label: "Home", path: "/dashboard" },
            { label: "Team Management", path: teamListPath },
            { label: loading ? "Loading..." : employee?.employeeName || "Employee" },
          ]}
        />

        <PageBody>
        <div className={styles.contain}>
          <div className={styles.scroll_view}>
            <div className={styles.column}>
              <div className={styles.row_view}>
                <div className={styles.row_view2}>
                  <img
                    src={arrowleft}
                    className={styles.image}
                    alt="Go Back"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(teamListPath)}
                  />
                  <div className={styles.row_view3}>
                    <div className={styles.row_view4}>
                      {/* <img
                        src={employee}
                        className={styles.image2}
                        alt="Employee avatar"
                      /> */}
                      {/* <img
                          src={`${config.API_BASE_URL.replace('/api', '')}${employee.profilePhoto}`}
                          className={styles.image2}
                          alt={`${employee.employeeName} logo`}
                        /> */}

                      {/* {employee.profilePhoto ? (
                        <img
                          src={`${config.API_BASE_URL.replace('/api', '')}${employee.profilePhoto}`}
                          className={styles.image2}
                          alt={`${employee.employeeName} logo`}
                        />
                      ) : (
                        <div className={styles.defaultCompanyLogo}>
                          {employee.employeeName?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                      )} */}

                      {employee ? (
                        employee.profilePhoto ? (
                          <img
                            src={buildImageUrl(employee.profilePhoto)}
                            className={styles.image2}
                            alt={`${employee.employeeName} logo`}
                            onError={handleImageError}
                          />
                        ) : (
                          <div className={styles.defaultCompanyLogo}>
                            {employee.employeeName?.charAt(0)?.toUpperCase() ||
                              "C"}
                          </div>
                        )
                      ) : (
                        <div className={styles.defaultCompanyLogo}>C</div> // fallback while loading
                      )}

                      <span className={styles.text}>
                        {loading
                          ? "Loading..."
                          : employee?.employeeName || "Employee Name"}
                      </span>
                    </div>
                    <button className={styles.button}>
                      <span className={styles.text2}>
                        {(() => {
                          if (loading) return "...";
                          const vs = employee?.vacationStatus || "Onsite";
                          const labelMap = {
                            "On Vacation": "On vacation",
                            "Vacation Approved": "Returned back from vacation",
                            "Vacation Pending": "Yet to go",
                          };
                          return labelMap[vs] || vs;
                        })()}
                      </span>
                    </button>
                  </div>
                </div>

                {/* <div className={styles.row_view5}>
                  <button className={styles.button_row_view}
                    onClick={()=>alert("Pressed!")}>
                    <span className={styles.text3}>
                      {"Edit Data"}
                    </span>
                    <img
                      src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/5rqzbf3s_expires_30_days.png"}
                      className={styles.image3}
                    />
                  </button>
                  <button className={styles.button_row_view2}
                    onClick={()=>alert("Pressed!")}>
                    <span className={styles.text4}>
                      {"Export"}
                    </span>
                    <img
                      src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/xz7ev9ao_expires_30_days.png"}
                      className={styles.image3}
                    />
                  </button>
                  <button className={styles.button_row_view3}
                    onClick={()=>alert("Pressed!")}>
                    <span className={styles.text5}>
                      {"Delete Entry"}
                    </span>
                    <img
                      src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/ghab1uy5_expires_30_days.png"}
                      className={styles.image3}
                    />
                  </button>
                </div> */}
                {renderButtons()}
              </div>

              {/* Tab Navigation */}
              <div className={styles.view}>
                <div className={styles.column2}>
                  <span
                    ref={basicInfoRef}
                    className={`${styles.text6} ${activeTab === "basicInfo" ? styles.active : ""
                      }`}
                    onClick={() => setActiveTab("basicInfo")}
                  >
                    {"Basic Info"}
                  </span>
                  <div
                    ref={documentsRef}
                    className={`${styles.view2} ${activeTab === "documents" ? styles.active : ""
                      }`}
                    onClick={() => setActiveTab("documents")}
                  >
                    <span className={styles.text8}>{"Documents"}</span>
                  </div>
                  <div
                    ref={salaryRef}
                    className={`${styles.view2} ${activeTab === "salary" ? styles.active : ""
                      }`}
                    onClick={() => setActiveTab("salary")}
                  >
                    <span className={styles.text8}>{"Salary Details"}</span>
                  </div>
                  <div
                    ref={incrementsRef}
                    className={`${styles.view2} ${activeTab === "increments" ? styles.active : ""
                      }`}
                    onClick={() => setActiveTab("increments")}
                  >
                    <span className={styles.text8}>{"Increments"}</span>
                  </div>
                  <div
                    ref={leaveTabRef}
                    className={`${styles.view2} ${activeTab === "leave" ? styles.active : ""
                      }`}
                    onClick={() => setActiveTab("leave")}
                  >
                    <span className={styles.text8}>{"Leave Entitlement"}</span>
                  </div>

                  <div
                    className={styles.box}
                    style={{
                      width: `${indicatorStyle.width}px`,
                      left: `${indicatorStyle.left}px`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className={styles.column3}>
              {activeTab === "basicInfo" && (
                <>
                  {loading ? (
                    <div style={{ padding: "40px", textAlign: "center" }}>
                      <p>Loading employee information...</p>
                    </div>
                  ) : error ? (
                    <div style={{ padding: "40px", textAlign: "center" }}>
                      <p style={{ color: "#ED5E56" }}>{error}</p>
                      <button
                        onClick={fetchEmployeeData}
                        className="primary-button"
                        style={{ marginTop: "16px" }}
                      >
                        Try Again
                      </button>
                    </div>
                  ) : employee ? (
                    <>
                      {/* first row */}
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Employee ID</span><span className={styles.text10}>{employee.employeeId || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Employee Name</span><span className={styles.text10}>{employee.employeeName || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Email ID</span><span className={styles.text10}>{employee.emailId || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Mobile Number</span><span className={styles.text10}>{employee.mobile || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Role</span><span className={styles.text10}>{employee.role || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Designation</span><span className={styles.text10}>{employee.designation || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Department</span><span className={styles.text10}>{employee.department || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Attendance Status</span><span className={styles.text10}>{employee.attendance || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Date of Join (DOJ)</span><span className={styles.text10}>{employee.doj ? new Date(employee.doj).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}>
                          <span className={styles.text9}>Total Exp (Yrs)</span>
                          <span className={styles.text10}>
                            {(() => {
                              if (!employee.doj) return "0";
                              const start = new Date(employee.doj);
                              const end = (isNonWorkingEmployeeStatus(employee.employeeStatus) && employee.lastWorkingDay)
                                ? new Date(employee.lastWorkingDay)
                                : new Date();

                              const diffMs = Math.max(0, end - start);
                              const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
                              return years.toFixed(1);
                            })()}
                          </span>
                        </div>
                        <div className={styles.column4}><span className={styles.text9}>Notice Period</span><span className={styles.text10}>{employee.noticePeriod || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Provision Period</span><span className={styles.text10}>{employee.provisionPeriod || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Notice Period Start</span><span className={styles.text10}>{employee.noticePeriodStartDate ? new Date(employee.noticePeriodStartDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Notice Period End</span><span className={styles.text10}>{employee.noticePeriodEndDate ? new Date(employee.noticePeriodEndDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Provision Period Start</span><span className={styles.text10}>{employee.provisionPeriodStartDate ? new Date(employee.provisionPeriodStartDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Provision Period End</span><span className={styles.text10}>{employee.provisionPeriodEndDate ? new Date(employee.provisionPeriodEndDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Date of Birth</span><span className={styles.text10}>{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Gender</span><span className={styles.text10}>{employee.gender || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Nationality</span><span className={styles.text10}>{employee.nationality || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Emirates ID</span><span className={styles.text10}>{employee.emiratesId || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Passport No</span><span className={styles.text10}>{employee.passportNo || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Labour Card Number</span><span className={styles.text10}>{employee.labourCardNumber || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Company Code</span><span className={styles.text10}>{employee.companyCode || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>IBAN Number</span><span className={styles.text10}>{employee?.salaryDetails?.ibanNumber || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Bank Sort Code</span><span className={styles.text10}>{employee?.salaryDetails?.bankSortCode || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Passport Expiry</span><span className={styles.text10}>{employee.passportExpiryDate ? new Date(employee.passportExpiryDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Labour Card Expiry</span><span className={styles.text10}>{employee.labourCardExpiryDate ? new Date(employee.labourCardExpiryDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Visa Expiry</span><span className={styles.text10}>{employee.visaExpiryDate ? new Date(employee.visaExpiryDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Emirates ID Expiry</span><span className={styles.text10}>{employee.emiratesIdExpiryDate ? new Date(employee.emiratesIdExpiryDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Contract Renewal</span><span className={styles.text10}>{employee.contractRenewalDate ? new Date(employee.contractRenewalDate).toLocaleDateString('en-GB') : "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Office</span><span className={styles.text10}>{employee.office || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Work Permit No</span><span className={styles.text10}>{employee.workPermitNo || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Reporting Manager</span><span className={styles.text10}>{employee.reportingManager || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Employee Status</span><span className={styles.text10}>{formatEmployeeStatusDisplay(employee)}</span></div>
                        {isNonWorkingEmployeeStatus(employee.employeeStatus) ? (
                          <div className={styles.column5}>
                            <span className={styles.text9}>Last Working Day</span>
                            <span className={styles.text10}>
                              {employee.lastWorkingDay ? new Date(employee.lastWorkingDay).toLocaleDateString('en-GB') : "Not provided"}
                            </span>
                          </div>
                        ) : (
                          <div className={styles.column5}></div>
                        )}
                      </div>
                      {isWorkingEmployeeStatus(employee.employeeStatus) && (
                        <div className={styles.row_view6}>
                          <div className={styles.column4}>
                            <span className={styles.text9}>Vacation Status</span>
                            <span className={styles.text10}>
                              {(() => {
                                const vs = employee.vacationStatus || "Onsite";
                                const colorMap = {
                                  "On Vacation": { bg: "#fff7ed", color: "#c2410c" },
                                  "Vacation Approved": { bg: "#f0fdf4", color: "#15803d" },
                                  "Vacation Pending": { bg: "#fffbeb", color: "#b45309" },
                                  "Onsite": { bg: "#f0fdf4", color: "#15803d" },
                                };
                                const style = colorMap[vs] || colorMap["Onsite"];
                                const labelMap = {
                                  "On Vacation": "On vacation",
                                  "Vacation Approved": "Returned back from vacation",
                                  "Vacation Pending": "Yet to go",
                                };
                                const displayLabel = labelMap[vs] || vs;
                                return (
                                  <span style={{
                                    display: "inline-flex",
                                    padding: "3px 10px",
                                    borderRadius: "20px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    background: style.bg,
                                    color: style.color,
                                    marginTop: "4px"
                                  }}>
                                    {displayLabel}
                                  </span>
                                );
                              })()}
                            </span>
                          </div>
                          {(employee.vacationStatus === "On Vacation" || employee.vacationStatus === "Vacation Pending") && (
                            <>
                              <div className={styles.column4}>
                                <span className={styles.text9}>Last Working Day</span>
                                <span className={styles.text10}>
                                  {employee.lastWorkingDay ? new Date(employee.lastWorkingDay).toLocaleDateString('en-GB') : "Not provided"}
                                </span>
                              </div>
                              <div className={styles.column4}>
                                <span className={styles.text9}>Travelling Date</span>
                                <span className={styles.text10}>
                                  {employee.travellingDate ? new Date(employee.travellingDate).toLocaleDateString('en-GB') : "Not provided"}
                                </span>
                              </div>
                            </>
                          )}
                          {employee.vacationStatus === "Vacation Approved" && (
                            <>
                              <div className={styles.column4}>
                                <span className={styles.text9}>Return / Entry Date</span>
                                <span className={styles.text10}>
                                  {employee.returnDate ? new Date(employee.returnDate).toLocaleDateString('en-GB') : "Not provided"}
                                </span>
                              </div>
                              <div className={styles.column4}>
                                <span className={styles.text9}>First Working Day</span>
                                <span className={styles.text10}>
                                  {employee.firstWorkingDay ? new Date(employee.firstWorkingDay).toLocaleDateString('en-GB') : "Not provided"}
                                </span>
                              </div>
                            </>
                          )}
                          <div className={styles.column5}></div>
                        </div>
                      )}
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Life Insurance</span><span className={styles.text10}>{employee.lifeInsurance ? "Yes" : "No"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Medical Insurance</span><span className={styles.text10}>{employee.medicalInsurance ? "Yes" : "No"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Air Fare</span><span className={styles.text10}>{employee.airFare ? "Yes" : "No"}</span></div>
                        <div className={styles.column5}></div>
                      </div>
                      
                      {/* Emergency Contact details */}
                      <div className={styles.row_view6} style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <div className={styles.column4} style={{ flex: '1 1 50%' }}>
                          <span className={styles.text9} style={{ fontWeight: 'bold', fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Emergency Contact - UAE</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Relationship</span><span className={styles.text10}>{employee.emergencyContact?.uae?.relationship || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Name</span><span className={styles.text10}>{employee.emergencyContact?.uae?.name || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Address</span><span className={styles.text10}>{employee.emergencyContact?.uae?.address || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Contact No.</span><span className={styles.text10}>{employee.emergencyContact?.uae?.contactNo || "Not provided"}</span></div>
                          </div>
                        </div>
                        <div className={styles.column4} style={{ flex: '1 1 50%' }}>
                          <span className={styles.text9} style={{ fontWeight: 'bold', fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Emergency Contact - Home Country</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Relationship</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry?.relationship || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Name</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry?.name || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Address</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry?.address || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Contact No.</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry?.contactNo || "Not provided"}</span></div>
                          </div>
                        </div>
                      </div>
                      {/* Second Home Country Emergency Contact */}
                      <div className={styles.row_view6} style={{ marginTop: '16px', borderTop: '1px dashed #eee', paddingTop: '16px' }}>
                        <div className={styles.column4} style={{ flex: '1 1 100%' }}>
                          <span className={styles.text9} style={{ fontWeight: 'bold', fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Emergency Contact - Home Country 2</span>
                          <div style={{ display: 'flex', flexDirection: 'row', gap: '40px', marginTop: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Relationship</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry2?.relationship || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Name</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry2?.name || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Address</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry2?.address || "Not provided"}</span></div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span className={styles.text9}>Contact No.</span><span className={styles.text10}>{employee.emergencyContact?.homeCountry2?.contactNo || "Not provided"}</span></div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: "40px", textAlign: "center" }}>
                      <p>Employee not found.</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "salary" && (
                <>
                  <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>Basic</span><span className={styles.text10}>{employee?.salaryDetails?.basicSalary ? `AED ${employee.salaryDetails.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>House Rent</span><span className={styles.text10}>{employee?.salaryDetails?.houseRent ? `AED ${employee.salaryDetails.houseRent.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Travel Exp</span><span className={styles.text10}>{employee?.salaryDetails?.travelExp ? `AED ${employee.salaryDetails.travelExp.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column5}><span className={styles.text9}>Other</span><span className={styles.text10}>{employee?.salaryDetails?.other ? `AED ${employee.salaryDetails.other.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                  </div>
                  <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>Total Allowance</span><span className={styles.text10}>{employee?.salaryDetails?.totalAllowance ? `AED ${employee.salaryDetails.totalAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Deduction</span><span className={styles.text10}>{employee?.salaryDetails?.deduction ? `AED ${employee.salaryDetails.deduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Net Salary</span><span className={styles.text10}>{employee?.salaryDetails?.totalSalary ? `AED ${employee.salaryDetails.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "AED 0.00"}</span></div>
                    <div className={styles.column5}></div>
                  </div>
                  <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>Bank Name</span><span className={styles.text10}>{employee?.salaryDetails?.bankName || "Not provided"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Account Number</span><span className={styles.text10}>{employee?.salaryDetails?.accountNumber || "Not provided"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>IBAN Number</span><span className={styles.text10}>{employee?.salaryDetails?.ibanNumber || "Not provided"}</span></div>
                    <div className={styles.column5}><span className={styles.text9}>Bank Sort Code</span><span className={styles.text10}>{employee?.salaryDetails?.bankSortCode || "Not provided"}</span></div>
                  </div>
                </>
              )}

              {activeTab === "increments" && (
                <div style={{ padding: "0 36px", width: "100%" }}>
                  <div className={styles.increments_table_container}>
                    <table className={styles.increments_table}>
                      <thead>
                        <tr>
                          <th>Effective Date</th>
                          <th>Previous Salary</th>
                          <th>Increment</th>
                          <th>New Salary</th>
                          <th>Reason</th>
                          {(userRole === "admin" || userRole === "hod") && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {employee?.increments && employee.increments.length > 0 ? (
                          employee.increments
                            .slice()
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((inc, index) => (
                              <tr key={index}>
                                <td>{new Date(inc.date).toLocaleDateString('en-GB')}</td>
                                <td>AED {inc.previousSalary?.toLocaleString() || 0}</td>
                                <td style={{ color: "#34C759", fontWeight: "600" }}>+AED {inc.incrementAmount?.toLocaleString() || 0}</td>
                                <td style={{ fontWeight: "600" }}>AED {inc.newSalary?.toLocaleString() || 0}</td>
                                <td>{inc.reason || "-"}</td>
                                {(userRole === "admin" || userRole === "hod") && (
                                  <td style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                                    <button
                                      style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                                      onClick={() => handleEditIncrementClick(inc)}
                                      title="Edit Increment"
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                                      onClick={() => handleDeleteIncrementClick(inc)}
                                      title="Delete Increment"
                                    >
                                      <DeleteIcon />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={(userRole === "admin" || userRole === "hod") ? "6" : "5"} style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
                              No increment history found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "leave" && (
                <div style={{ padding: "0 36px", width: "100%" }}>
                  {(() => {
                    const leaveStats = employee
                      ? calculateLeaveBalance(employee, allLeaveRequests)
                      : null;
                    const latest = employeeLeaves[0];
                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Current Leave Status</div>
                          <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                            {latest?.status || "No active record"}
                          </div>
                        </div>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Leave Days Taken</div>
                          <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                            {leaveStats ? leaveStats.totalTaken : 0}
                          </div>
                        </div>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Leave Balance</div>
                          <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                            {leaveStats ? leaveStats.balance : 0}
                          </div>
                        </div>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Entitlement</div>
                          <div style={{ marginTop: "4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                            {leaveStats ? leaveStats.entitlement : 0}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className={styles.increments_table_container}>
                    <table className={styles.increments_table}>
                      <thead>
                        <tr>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Leave Days</th>
                          <th>Leave Type</th>
                          <th>Ticket Type</th>
                          <th>Status</th>
                          <th>Reason</th>
                          {isAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {employeeLeaves && employeeLeaves.length > 0 ? (
                          employeeLeaves.map((leave, index) => (
                            <tr key={leave._id || index}>
                              <td>{new Date(leave.startDate).toLocaleDateString('en-GB')}</td>
                              <td>{new Date(leave.endDate).toLocaleDateString('en-GB')}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>
                                {(() => {
                                  const days = calculateLeaveDays(leave.startDate, leave.endDate);
                                  return days != null ? `${days} ${days === 1 ? "day" : "days"}` : "—";
                                })()}
                              </td>
                              <td>{leave.leaveType}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  fontWeight: "700",
                                  color: leave.requestAirfare ? "#15803d" : "#9a3412",
                                  fontSize: "11px",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: leave.requestAirfare ? "#f0fdf4" : "#fff7ed",
                                  whiteSpace: "nowrap"
                                }}>
                                  {leave.requestAirfare ? "Company Ticket" : "Personal Ticket"}
                                </span>
                              </td>
                              <td>{leave.status}</td>
                              <td>{leave.reason || "-"}</td>
                              {isAdmin && (
                                <td style={{ textAlign: "center" }}>
                                  <button
                                    title="Edit Leave"
                                    onClick={() => { setSelectedLeave(leave); setIsEditLeaveModalOpen(true); }}
                                    style={{
                                      background: "none", border: "none", cursor: "pointer",
                                      color: "#2563eb", padding: "4px", borderRadius: "6px",
                                      display: "inline-flex", alignItems: "center"
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={isAdmin ? "8" : "7"} style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
                              No leave history found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  <section className="documents-table-section">
                    <Documents employeeId={employeeId} refreshKey={documentsKey} />
                  </section>
                </div>
              )}

            </div>
          </div>
        </div>
        </PageBody>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={
          deleteType === "increment" ? "Delete this Increment?" :
            deleteType === "entry" ? "Delete this Entry?" : "Delete this Data?"
        }
        description={
          deleteType === "increment" ? "Are you sure you want to delete this increment? This action cannot be undone." :
            deleteType === "entry"
              ? "Are you sure you want to delete this entry? This action cannot be undone."
              : "Are you sure you want to delete this data? This action cannot be undone."
        }
      />



      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={handleFileUploadClose}
        onUpload={handleFileUploadComplete}
        allowTypeSelection={true}
        typeOptions={DOC_TYPE_OPTIONS}
      />

      <AssignTaskModal
        isOpen={isCreateEventModalOpen}
        onClose={handleCreateEventClose}
        employeeId={employeeId}
        onEventCreated={handleEventCreated}
      />

      <EditEmployeeModal
        isOpen={isEditEmployeeModalOpen}
        onClose={handleEditEmployeeClose}
        onSubmit={handleEditEmployeeSubmit}
        employee={employee}
      />

      <AddIncrementModal
        isOpen={isIncrementModalOpen}
        onClose={() => { setIsIncrementModalOpen(false); setSelectedIncrement(null); }}
        onSubmit={handleAddIncrement}
        employee={employee}
        initialData={selectedIncrement}
      />

      <AddLeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={async () => {
          await fetchEmployeeLeaves(employee);
        }}
        allLeaveRequests={allLeaveRequests}
        initialEmployeeId={employeeId}
      />

      <EditLeaveRequestModal
        isOpen={isEditLeaveModalOpen}
        onClose={() => { setIsEditLeaveModalOpen(false); setSelectedLeave(null); }}
        onSubmit={async () => {
          await fetchEmployeeLeaves(employee);
        }}
        leaveRequest={selectedLeave}
        allLeaveRequests={allLeaveRequests}
      />

      <DropDownList
        isOpen={isDropdownOpen}
        onClose={handleDropdownClose}
        onOptionSelect={handleExportOptionSelect}
        position={dropdownPosition}
      />
    </div>
  );
}

export default TeamManagementSalesLeads;
