import React, { useState } from "react";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarAlt,
  FaChartBar,
  FaCog,
  FaFolder,
  FaQuestionCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import DateRangePickerModal from "../../components/DateRangePickerModal";
import useDateRange from "../../hooks/useDateRange";
import { useSidebar } from "../../context/SidebarContext";
import LogoutModal from "../../components/logout-modal/LogoutModal";

import sonashi_logo from "../../assets/sonashi_logo.png";
import users from "../../assets/dashboard/users.svg";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import arrowdownup from "../../assets/dashboard/arrow-down-up.svg";
import belldot from "../../assets/dashboard/bell-dot.svg";
import calendar from "../../assets/dashboard/calendar.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import circlehelp from "../../assets/dashboard/circle-help.svg";
import cloud from "../../assets/dashboard/cloud.svg";
import filechartcolumn from "../../assets/dashboard/file-chart-column.svg";
import icons from "../../assets/dashboard/Icons.svg";
import layoutdashboard from "../../assets/dashboard/layout-dashboard.svg";
import packageicon from "../../assets/dashboard/package.svg";
import scaneye from "../../assets/dashboard/scan-eye.svg";
import settings2 from "../../assets/dashboard/settings-2.svg";
import settings from "../../assets/dashboard/settings.svg";
import userplus from "../../assets/dashboard/user-plus.svg";
import addcontact from "../../assets/dashboard/add-contact.png";
import logout from "../../assets/dashboard/log-out.svg";
import offbutton from "../../assets/dashboard/off-button.png";

function Sidebar() {
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);
  const navigate = useNavigate();
  const { isOpen, closeSidebar } = useSidebar();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);


  // Fix: Get role directly from localStorage
  const userRole = localStorage.getItem("role"); // This returns a string like "sales_executive"

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    // Clear authentication data
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role"); // Also clear role on logout
    // Redirect to login page
    navigate("/login", { replace: true });
    setIsLogoutModalOpen(false);
  };

  const handleCloseLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };

  // Use the custom date range hook for backend functionality
  const {
    dateRange,
    updateDateRange,
    getFormattedDateRange,
    getCurrentPreset,
  } = useDateRange();

  const handleDateRangeClick = () => {
    setIsDateRangeModalOpen(true);
  };

  const handleDateRangeModalClose = () => {
    setIsDateRangeModalOpen(false);
  };

  const handleDateRangeApply = (startDate, endDate) => {
    updateDateRange(startDate, endDate);
    console.log("Date range selected:", {
      start: startDate,
      end: endDate,
      formatted: getFormattedDateRange(),
      preset: getCurrentPreset(),
    });
    // Here you can add logic to filter data based on the selected date range
    // Example: triggerDataRefresh(startDate, endDate);
  };

  return (
    <>
      <div 
        className={`${styles.overlay} ${isOpen ? styles.showOverlay : ""}`} 
        onClick={closeSidebar}
      />
      <div className={`${styles["sidebar-layout"]} ${isOpen ? styles.open : ""}`}>
        <div className={styles.mobileCloseBtn} onClick={closeSidebar}>
          ×
        </div>
        <div className={styles["sidebar-content"]}>
        <div className={styles["auxin-logo"]}>
          <img
            src={sonashi_logo}
            alt="Sonashi Logo"
            className={styles["auxinlogo-img"]}
          />
        </div>
        <div className={styles["line"]}></div>

        <div className={styles["menu-sections"]}>
          <div className={styles["menu-section-one"]}>
            <p className={styles["section-title"]}>MAIN</p>
            <ul>
              <li className={isActive("/dashboard") ? styles.active : ""}>
                <Link to="/dashboard" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img
                    src={layoutdashboard}
                    alt="Dashboard"
                    className={styles.icon}
                  />
                  Dashboard
                </Link>
              </li>

              <li className={isActive("/teammanagement") ? styles.active : ""}>
                <Link to="/teammanagement" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img
                    src={users}
                    alt="teamManagement"
                    className={styles.icon}
                  />{" "}
                  Team Management
                </Link>
              </li>

              <li className={isActive("/leave-requests") ? styles.active : ""}>
                <Link to="/leave-requests" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img
                    src={calendar}
                    alt="Leave Management"
                    className={styles.icon}
                  />
                  Leave Management
                </Link>
              </li>

              <li className={isActive("/salary-slips") ? styles.active : ""}>
                <Link to="/salary-slips" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img
                    src={filechartcolumn}
                    alt="Salary Slips"
                    className={styles.icon}
                  />
                  Salary Slips
                </Link>
              </li>


              {/* User Management - Admin & HOD Only */}
              {["admin", "hod"].includes(userRole) && (
                <li className={isActive("/user-management") ? styles.active : ""}>
                  <Link to="/user-management" className={styles["sidebar-link"]} onClick={closeSidebar}>
                    <img
                      src={addcontact}
                      alt="User Management"
                      className={styles.icon}
                    />{" "}
                    User Management
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className={styles["menu-section-two"]}>
            <p className={styles["section-title"]}>ADDITIONAL</p>
            <ul>
              <li className={isActive("/profile") ? styles.active : ""}>
                <Link to="/profile" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img src={settings} alt="Profile" className={styles.icon} />{" "}
                  Settings
                </Link>
              </li>
              <li>
                <Link to="" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img src={cloud} alt="My Files" className={styles.icon} /> My
                  Files
                </Link>
              </li>
              <li className={isActive("/help-support") ? styles.active : ""}>
                <Link to="/help-support" className={styles["sidebar-link"]} onClick={closeSidebar}>
                  <img
                    src={circlehelp}
                    alt="Help & Support"
                    className={styles.icon}
                  />{" "}
                  Help & Support
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles["sidebar-footer-content"]}>
        {/* <div className={styles["view-as-executive"]}>
          <div className={styles["view-as-executive-row"]}>
            <img src={scaneye} alt="View as Executive" />
            <div className={styles["label"]}>View as Executive</div>
          </div>
          <img src={offbutton} alt="View as Executive" height={28} />
        </div> */}

        <div className={styles["line"]}></div>
        <button className={styles.footerLogoutBtn} onClick={handleLogoutClick}>
          <img src={logout} alt="Logout" className={styles.icon} />
          Logout
        </button>
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        isOpen={isDateRangeModalOpen}
        onClose={handleDateRangeModalClose}
        onApplyDateRange={handleDateRangeApply}
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
      />
      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={handleCloseLogoutModal}
        onConfirm={handleConfirmLogout}
      />
    </div>
    </>
  );
}

export default Sidebar;
