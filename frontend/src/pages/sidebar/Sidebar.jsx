import React, { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import DateRangePickerModal from "../../components/DateRangePickerModal";
import useDateRange from "../../hooks/useDateRange";
import { useSidebar } from "../../context/SidebarContext";
import LogoutModal from "../../components/logout-modal/LogoutModal";

import sonashi_logo from "../../assets/sonashi_logo.png";
import users from "../../assets/dashboard/users.svg";
import calendar from "../../assets/dashboard/calendar.svg";
import circlehelp from "../../assets/dashboard/circle-help.svg";
import cloud from "../../assets/dashboard/cloud.svg";
import filechartcolumn from "../../assets/dashboard/file-chart-column.svg";
import layoutdashboard from "../../assets/dashboard/layout-dashboard.svg";
import settings from "../../assets/dashboard/settings.svg";
import addcontact from "../../assets/dashboard/add-contact.png";
import logout from "../../assets/dashboard/log-out.svg";

function NavItem({ to, icon, label, active, onNavigate }) {
  const { isCollapsed } = useSidebar();

  return (
    <li className={active ? styles.active : ""}>
      <Link
        to={to}
        className={styles["sidebar-link"]}
        onClick={onNavigate}
        title={isCollapsed ? label : undefined}
      >
        <img src={icon} alt="" className={styles.icon} />
        <span className={styles.linkText}>{label}</span>
      </Link>
    </li>
  );
}

function Sidebar() {
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);
  const navigate = useNavigate();
  const { isOpen, isCollapsed, closeSidebar, toggleCollapse, toggleSidebar } = useSidebar();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const userRole = localStorage.getItem("role");

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
    setIsLogoutModalOpen(false);
  };

  const handleCloseLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };

  const {
    dateRange,
    updateDateRange,
    getFormattedDateRange,
    getCurrentPreset,
  } = useDateRange();

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
  };

  const handleNavClick = () => {
    closeSidebar();
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.mobileOpenTab} ${isOpen ? styles.mobileOpenTabHidden : ""}`}
        onClick={toggleSidebar}
        aria-label="Open sidebar"
        title="Open menu"
      >
        <FaChevronRight />
      </button>
      <div
        className={`${styles.overlay} ${isOpen ? styles.showOverlay : ""}`}
        onClick={closeSidebar}
      />
      <div
        className={`${styles["sidebar-layout"]} ${isOpen ? styles.open : ""} ${isCollapsed ? styles.collapsed : ""}`}
      >
        <div className={styles.mobileCloseBtn} onClick={closeSidebar}>
          ×
        </div>

        <div className={styles["sidebar-header"]}>
          <div className={styles.sidebarHeaderRow}>
            <div className={styles["auxin-logo"]}>
              <img
                src={sonashi_logo}
                alt="Sonashi Logo"
                className={styles["auxinlogo-img"]}
              />
            </div>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={toggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          </div>
          <div className={styles.line} />
        </div>

        <div className={styles["sidebar-nav"]}>
          <div className={styles["menu-sections"]}>
            <div className={styles["menu-section-one"]}>
              <p className={styles["section-title"]}>MAIN</p>
              <ul>
                <NavItem
                  to="/dashboard"
                  icon={layoutdashboard}
                  label="Dashboard"
                  active={isActive("/dashboard")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/teammanagement"
                  icon={users}
                  label="Team Management"
                  active={isActive("/teammanagement")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/leave-requests"
                  icon={calendar}
                  label="Leave Management"
                  active={isActive("/leave-requests")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/annual-vacations"
                  icon={calendar}
                  label="Annual Vacations"
                  active={isActive("/annual-vacations")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/salary-slips"
                  icon={filechartcolumn}
                  label="Salary Slips"
                  active={isActive("/salary-slips")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/reports"
                  icon={filechartcolumn}
                  label="Reports"
                  active={isActive("/reports")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/company-document"
                  icon={cloud}
                  label="Company Document"
                  active={isActive("/company-document")}
                  onNavigate={handleNavClick}
                />
                {["admin", "hod"].includes(userRole) && (
                  <NavItem
                    to="/user-management"
                    icon={addcontact}
                    label="User Management"
                    active={isActive("/user-management")}
                    onNavigate={handleNavClick}
                  />
                )}
              </ul>
            </div>

            <div className={styles["menu-section-two"]}>
              <p className={styles["section-title"]}>ADDITIONAL</p>
              <ul>
                <NavItem
                  to="/profile"
                  icon={settings}
                  label="Settings"
                  active={isActive("/profile")}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to=""
                  icon={cloud}
                  label="My Files"
                  active={false}
                  onNavigate={handleNavClick}
                />
                <NavItem
                  to="/help-support"
                  icon={circlehelp}
                  label="Help & Support"
                  active={isActive("/help-support")}
                  onNavigate={handleNavClick}
                />
              </ul>
            </div>
          </div>
        </div>

        <div className={styles["sidebar-footer-content"]}>
          <div className={styles.line} />
          <button
            type="button"
            className={styles.footerLogoutBtn}
            onClick={handleLogoutClick}
            title={isCollapsed ? "Logout" : undefined}
          >
            <img src={logout} alt="" className={styles.icon} />
            <span className={styles.linkText}>Logout</span>
          </button>
        </div>

        <DateRangePickerModal
          isOpen={isDateRangeModalOpen}
          onClose={handleDateRangeModalClose}
          onApplyDateRange={handleDateRangeApply}
          initialStartDate={dateRange.start}
          initialEndDate={dateRange.end}
        />
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
