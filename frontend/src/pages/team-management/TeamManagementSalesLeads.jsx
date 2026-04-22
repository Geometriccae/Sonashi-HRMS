import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./TeamManagementSalesLeads.module.css";
import Side from "../sidebar/Sidebar";
import employeeService from "../../services/EmployeeService";
import DocumentsService from "../../services/EmployeeDocumentService";
import EditEmployeeModal from "../../components/team-management-components/EditEmployeeModal";
import Documents from "../../components/team-management-components/TeamMangementDocuments";
// import Calendar from "../../components/CalendarComponent";
import Meetingstable from "../../components/team-management-components/MeetingsTable";
import config from "../../config/config";
import { FaBars } from "react-icons/fa";
import DeleteModal from "../../components/delete-modal/DeleteModal";
import AssignTaskModal from "../../components/team-management-components/AssignTaskModal";
import FileUploadModal from "../../components/FileUploadModal";
import DropDownList from "../../components/DropDownList";
import AddIncrementModal from "../../components/team-management-components/AddIncrementModal";
import { exportEmployeeBasicInfo, exportEvents, exportDocuments, exportToPDF, exportToTXT } from "../../utils/exportUtils";
import { getEventsByEmployeeId } from "../../services/AssignEventService";
import { useSidebar } from "../../context/SidebarContext";

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
import NotificationBell from "../../components/NotificationBell";
import MobileBottomNavigation from "../../components/MobileBottomNavigation";
import { useToast } from "../../context/ToastContext";

function TeamManagementSalesLeads() {
  const { toggleSidebar } = useSidebar();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("basicInfo");
  const basicInfoRef = useRef(null);
  const salaryRef = useRef(null);
  const incrementsRef = useRef(null);
  const documentsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [remarks, setRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [addingRemark, setAddingRemark] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry' or 'data'
 const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
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

  // Fetch employee data when component mounts or employeeId changes
  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

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
          navigate("/teammanagement");
          return; // no further cleanup needed, leaving page
        } else if (deleteType === "data") {
          // Optional: implement bulk document delete for this client in backend later
          // For now, simply refresh documents list key
          setDocumentsKey(prev => prev + 1);
          showToast("Data deleted successfully.", 'success');
        }
      } catch (e) {
        console.error("Delete failed", e);
        showToast(e.message || "Delete failed", 'error');
      } finally {
        setIsDeleteModalOpen(false);
        setDeleteType("");
      }
    };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteType("");
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
      const updatedEmployee = await employeeService.addEmployeeIncrement(employeeId, incrementData);
      setEmployee(updatedEmployee);
      showToast("Salary increment added successfully.", 'success');
    } catch (err) {
      console.error("Error adding increment:", err);
      showToast(err.message || "Failed to add increment.", 'error');
    }
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
      for (const file of files) {
        await DocumentsService.uploadForEmployee(employeeId, file, {
          uploadedBy: "Current User",
          userRole: "Sales Executive",
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
    const canEdit = isAdmin || userRole === "hr";

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
      default:
        return null;
    }
  };


  return (
    <div className={styles["dashboard-layout"]}>
     <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["header-left"]}>
              <button className={styles.menuToggleBtn} onClick={toggleSidebar}>
                <FaBars />
              </button>
              <div className={styles["dashboard-title"]}>Team Management</div>
            </div>

            <div className={styles["dashboard-profile"]}>
                <NotificationBell/>
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar
                    size={40}
                    className={styles["profile-picture"]}
                  />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>
                      {username?.toUpperCase()}
                    </div>
                     <div className={styles["profile-type"]}>
                                          {userRole?.toUpperCase()}
                                        </div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-notactive"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div
              className={styles["breadcrumb-notactive"]}
              onClick={() => navigate("/teammanagement")}
              style={{ cursor: "pointer" }}
            >
              Team Management
            </div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>
              {loading ? "Loading..." : employee?.employeeName || "Employee"}
            </div>
          </div>
        </section>

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
                    onClick={() => navigate(-1)}
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
                            src={`${config.API_BASE_URL.replace("/api", "")}${
                              employee.profilePhoto
                            }`}
                            className={styles.image2}
                            alt={`${employee.employeeName} logo`}
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
                    <button
                      className={styles.button}
                      onClick={() => alert("Pressed!")}
                    >
                      <span className={styles.text2}>
                        {loading ? "..." : employee?.attendance || "On Site"}
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
                    className={`${styles.text6} ${
                      activeTab === "basicInfo" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("basicInfo")}
                  >
                    {"Basic Info"}
                  </span>
                  <div
                    ref={documentsRef}
                    className={`${styles.view2} ${
                      activeTab === "documents" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("documents")}
                  >
                    <span className={styles.text8}>{"Documents"}</span>
                  </div>
                  <div
                    ref={salaryRef}
                    className={`${styles.view2} ${
                      activeTab === "salary" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("salary")}
                  >
                    <span className={styles.text8}>{"Salary Details"}</span>
                  </div>
                  <div
                    ref={incrementsRef}
                    className={`${styles.view2} ${
                      activeTab === "increments" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("increments")}
                  >
                    <span className={styles.text8}>{"Increments"}</span>
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

                        <div className={styles.column4}><span className={styles.text9}>Date of Birth</span><span className={styles.text10}>{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Gender</span><span className={styles.text10}>{employee.gender || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Nationality</span><span className={styles.text10}>{employee.nationality || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Date of Join (DOJ)</span><span className={styles.text10}>{employee.doj ? new Date(employee.doj).toLocaleDateString() : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Total Exp (Yrs)</span><span className={styles.text10}>{employee.totalYearsExperience !== undefined && employee.totalYearsExperience !== null ? employee.totalYearsExperience : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Emirates ID</span><span className={styles.text10}>{employee.emiratesId || "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Passport No</span><span className={styles.text10}>{employee.passportNo || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Passport Expiry</span><span className={styles.text10}>{employee.passportExpiryDate ? new Date(employee.passportExpiryDate).toLocaleDateString() : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Labour Card Expiry</span><span className={styles.text10}>{employee.labourCardExpiryDate ? new Date(employee.labourCardExpiryDate).toLocaleDateString() : "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Visa Expiry</span><span className={styles.text10}>{employee.visaExpiryDate ? new Date(employee.visaExpiryDate).toLocaleDateString() : "Not provided"}</span></div>
                        <div className={styles.column5}><span className={styles.text9}>Office</span><span className={styles.text10}>{employee.office || "Not provided"}</span></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Work Permit No</span><span className={styles.text10}>{employee.workPermitNo || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Reporting Manager</span><span className={styles.text10}>{employee.reportingManager || "Not provided"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Status</span><span className={styles.text10}>{employee.employeeStatus || "Active"}</span></div>
                        <div className={styles.column5}></div>
                      </div>
                      <div className={styles.row_view6}>
                        <div className={styles.column4}><span className={styles.text9}>Life Insurance</span><span className={styles.text10}>{employee.lifeInsurance ? "Yes" : "No"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Medical Insurance</span><span className={styles.text10}>{employee.medicalInsurance ? "Yes" : "No"}</span></div>
                        <div className={styles.column4}><span className={styles.text9}>Air Fare</span><span className={styles.text10}>{employee.airFare ? "Yes" : "No"}</span></div>
                        <div className={styles.column5}></div>
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
                <div style={{ padding: "16px 36px" }}>
                  <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>BASIC</span><span className={styles.text10}>{employee?.salaryDetails?.basicSalary ? `AED ${employee.salaryDetails.basicSalary}` : "0"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>HOUSE RENT</span><span className={styles.text10}>{employee?.salaryDetails?.houseRent ? `AED ${employee.salaryDetails.houseRent}` : "0"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>TRAVEL EXP</span><span className={styles.text10}>{employee?.salaryDetails?.travelExp ? `AED ${employee.salaryDetails.travelExp}` : "0"}</span></div>
                    <div className={styles.column5}><span className={styles.text9}>OTHER</span><span className={styles.text10}>{employee?.salaryDetails?.other ? `AED ${employee.salaryDetails.other}` : "0"}</span></div>
                  </div>
                  <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>Total Allowance</span><span className={styles.text10}>{employee?.salaryDetails?.totalAllowance ? `AED ${employee.salaryDetails.totalAllowance}` : "0"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>DEDUCTION</span><span className={styles.text10}>{employee?.salaryDetails?.deduction ? `AED ${employee.salaryDetails.deduction}` : "0"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Net Salary</span><span className={styles.text10}>{employee?.salaryDetails?.totalSalary ? `AED ${employee.salaryDetails.totalSalary}` : "0"}</span></div>
                    <div className={styles.column5}></div>
                  </div>
                   <div className={styles.row_view6}>
                    <div className={styles.column4}><span className={styles.text9}>Bank Name</span><span className={styles.text10}>{employee?.salaryDetails?.bankName || "Not provided"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>Account Number</span><span className={styles.text10}>{employee?.salaryDetails?.accountNumber || "Not provided"}</span></div>
                    <div className={styles.column4}><span className={styles.text9}>IBAN Number</span><span className={styles.text10}>{employee?.salaryDetails?.ibanNumber || "Not provided"}</span></div>
                    <div className={styles.column5}><span className={styles.text9}>Bank SORT Code</span><span className={styles.text10}>{employee?.salaryDetails?.bankSortCode || "Not provided"}</span></div>
                  </div>
                </div>
              )}

              {activeTab === "increments" && (
                <div style={{ padding: "0 36px", width: "100%" }}>
                  <div className={styles.increments_table_container}>
                    <table className={styles.increments_table}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Previous Salary</th>
                          <th>Increment</th>
                          <th>New Salary</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee?.increments && employee.increments.length > 0 ? (
                          employee.increments
                            .slice()
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((inc, index) => (
                              <tr key={index}>
                                <td>{new Date(inc.date).toLocaleDateString()}</td>
                                <td>AED {inc.previousSalary?.toLocaleString() || 0}</td>
                                <td style={{ color: "#34C759", fontWeight: "600" }}>+AED {inc.incrementAmount?.toLocaleString() || 0}</td>
                                <td style={{ fontWeight: "600" }}>AED {inc.newSalary?.toLocaleString() || 0}</td>
                                <td>{inc.reason || "-"}</td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
                              No increment history found.
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
                    <Documents employeeId={employeeId} refreshKey={documentsKey}  />
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

       {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={
          deleteType === "entry" ? "Delete this Entry?" : "Delete this Data?"
        }
        description={
          deleteType === "entry"
            ? "Are you sure you want to delete this entry? This action cannot be undone."
            : "Are you sure you want to delete this data? This action cannot be undone."
        }
      />



      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={handleFileUploadClose}
        onUpload={handleFileUploadComplete}
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
        onClose={() => setIsIncrementModalOpen(false)}
        onSubmit={handleAddIncrement}
        employee={employee}
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
