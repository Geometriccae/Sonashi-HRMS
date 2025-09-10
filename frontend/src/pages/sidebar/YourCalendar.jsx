import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../team-management/TeamManagementSalesLeads.module.css";
import Side from "../sidebar/Sidebar";

import Documents from "../../components/team-management-components/TeamMangementDocuments";
// import Calendar from "../../components/CalendarComponent";
import Meetingstable from "./YourCalendarMeetings";

import DeleteModal from "../../components/delete-modal/DeleteModal";
import CreateEventModal from "../../components/sales-and-leads/CreateEventModal";
import FileUploadModal from "../../components/FileUploadModal";
import DropDownList from "../../components/DropDownList";

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

function YourCalendar() {
  const [activeTab, setActiveTab] = useState("meetings");
  const basicInfoRef = useRef(null);
  const meetingsRef = useRef(null);
  const documentsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry' or 'data'
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
    

      useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
      }, []);

  useEffect(() => {
    const updateIndicatorPosition = () => {
      let activeElement;
      switch (activeTab) {
        case "basicInfo":
          activeElement = basicInfoRef.current;
          break;
        case "meetings":
          activeElement = meetingsRef.current;
          break;
        case "documents":
          activeElement = documentsRef.current;
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

  const handleDeleteConfirm = () => {
    if (deleteType === "entry") {
      console.log("Delete Entry confirmed");
      // Implement delete entry logic here
    } else if (deleteType === "data") {
      console.log("Delete Data confirmed");
      // Implement delete data logic here
    }
    setIsDeleteModalOpen(false);
    setDeleteType("");
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

  const handleFileUpload = () => {
    setIsFileUploadModalOpen(true);
  };

  const handleFileUploadClose = () => {
    setIsFileUploadModalOpen(false);
  };

  const handleFileUploadComplete = (files) => {
    console.log("Files uploaded:", files);
    // Handle uploaded files here
    setIsFileUploadModalOpen(false);
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

  const handleExportOptionSelect = (option) => {
    console.log(`Export as ${option} selected`);
    switch (option) {
      case "pdf":
        alert("Exporting as PDF...");
        // Implement PDF export logic here
        break;
      case "csv":
        alert("Exporting as CSV...");
        // Implement CSV export logic here
        break;
      case "txt":
        alert("Exporting as TXT...");
        // Implement TXT export logic here
        break;
      case "print":
        alert("Printing document...");
        // Implement print logic here
        window.print();
        break;
      default:
        console.log("Unknown export option:", option);
    }
  };

  // Render different buttons based on active tab
  const renderButtons = () => {
    switch (activeTab) {
      case "meetings":
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={handleNewEvent}>
              <span className={styles.text3}>New Event</span>
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
      default:
        return null;
    }
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Calendar</div>

            <div className={styles["dashboard-profile"]}>
              <img
                src={belldot}
                alt="belldot"
                className={styles["belldot-icon"]}
              />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>Administrator</div>
                  </div>
                </div>
                <img src={chevrondown} alt="" />
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-notactive"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>Your Calendar</div>
          </div>
        </section>

        <div className={styles.contain}style={{ borderBottom: "5px solid #E4E4E4" }}>
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
                      <span className={styles.text}>{"Your Calendar"}</span>
                    </div>
                  </div>
                </div>

                {renderButtons()}
              </div>

              {/* Tab Navigation */}
            </div>
            <div className={styles.column3}>
              {activeTab === "meetings" && (
                <div className={styles.meetingsContent} >
                  <Meetingstable />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={handleCreateEventClose}
      />

      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={handleFileUploadClose}
        onUpload={handleFileUploadComplete}
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

export default YourCalendar;
