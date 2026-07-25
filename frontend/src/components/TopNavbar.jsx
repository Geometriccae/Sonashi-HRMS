import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import { HiOutlineHome } from "react-icons/hi2";
import { IoChevronForward } from "react-icons/io5";
import { FiUser, FiSettings, FiLogOut } from "react-icons/fi";
import styles from "./TopNavbar.module.css";
import layoutStyles from "./PageLayout.module.css";
import NotificationBell from "./NotificationBell";
import ProfileAvatar from "./ProfileAvatar";
import LogoutModal from "./logout-modal/LogoutModal";

const ROLE_LABELS = {
  admin: "Administrator",
  hr: "HR Manager",
  hod: "Head of Department",
  viewer: "Viewer",
  authorize_user: "Authorize User",
  sales_executive: "Sales Executive",
  sales_lead: "Sales Lead",
};

function TopNavbar({
  title,
  breadcrumb,
  breadcrumbs,
  showBreadcrumb = true,
  showGreeting = false,
  subtitle,
}) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getRoleLabel = () => {
    return ROLE_LABELS[userRole] || userRole?.replace(/_/g, " ") || "User";
  };

  const handleConfirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
    setIsLogoutModalOpen(false);
  };

  const displaySubtitle =
    subtitle || (showGreeting ? `${getTimeGreeting()}, ${username || "there"}` : null);

  return (
    <>
      <div className={styles.headerShell}>
        <div className={styles.topbarCard}>
          <div className={styles.topbarInner}>
          <div className={styles.topbarLeft}>
            <div className={styles.titleBlock}>
              <h1 className={styles.pageTitle}>{title}</h1>
              {displaySubtitle && (
                <p className={styles.pageSubtitle}>{displaySubtitle}</p>
              )}
            </div>
          </div>

          <div className={styles.topbarRight}>
            <NotificationBell />

            <div className={styles.divider} />

            <Dropdown align="end" className={styles.profileDropdown}>
              <Dropdown.Toggle
                as="button"
                className={styles.profileTrigger}
                id="topbar-profile-dropdown"
              >
                <ProfileAvatar size={38} className={styles.avatar} />
                <div className={styles.profileMeta}>
                  <span className={styles.profileName}>
                    {username || "User"}
                  </span>
                  <span className={`${styles.roleBadge} ${styles[`role_${userRole}`] || ""}`}>
                    {getRoleLabel()}
                  </span>
                </div>
                <IoChevronForward className={styles.profileChevron} />
              </Dropdown.Toggle>

              <Dropdown.Menu className={styles.dropdownMenu} renderOnMount>
                <div className={styles.dropdownHeader}>
                  <ProfileAvatar size={44} className={styles.dropdownAvatar} />
                  <div>
                    <div className={styles.dropdownName}>{username || "User"}</div>
                    <div className={styles.dropdownRole}>{getRoleLabel()}</div>
                  </div>
                </div>

                <Dropdown.Divider className={styles.dropdownDivider} />

                <Dropdown.Item
                  as={Link}
                  to="/profile"
                  className={styles.dropdownItem}
                >
                  <FiUser className={styles.dropdownIcon} />
                  My Profile
                </Dropdown.Item>

                <Dropdown.Item
                  as={Link}
                  to="/profile"
                  className={styles.dropdownItem}
                >
                  <FiSettings className={styles.dropdownIcon} />
                  Settings
                </Dropdown.Item>

                <Dropdown.Divider className={styles.dropdownDivider} />

                <Dropdown.Item
                  className={`${styles.dropdownItem} ${styles.logoutItem}`}
                  onClick={() => setIsLogoutModalOpen(true)}
                >
                  <FiLogOut className={styles.dropdownIcon} />
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
          </div>
        </div>

        {showBreadcrumb && (breadcrumbs?.length > 0 || breadcrumb) && (
          <nav className={styles.breadcrumbBar} aria-label="Breadcrumb">
            {breadcrumbs?.length > 0 ? (
              breadcrumbs.map((item, index) => (
                <React.Fragment key={`${item.label}-${index}`}>
                  {index > 0 && (
                    <IoChevronForward className={styles.breadcrumbSep} />
                  )}
                  {item.path ? (
                    <Link to={item.path} className={styles.breadcrumbLink}>
                      {index === 0 && (
                        <HiOutlineHome className={styles.breadcrumbHomeIcon} />
                      )}
                      {item.label}
                    </Link>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>{item.label}</span>
                  )}
                </React.Fragment>
              ))
            ) : (
              <>
                <Link to="/dashboard" className={styles.breadcrumbLink}>
                  <HiOutlineHome className={styles.breadcrumbHomeIcon} />
                  Home
                </Link>
                <IoChevronForward className={styles.breadcrumbSep} />
                <span className={styles.breadcrumbCurrent}>{breadcrumb}</span>
              </>
            )}
          </nav>
        )}
      </div>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}

export function PageBody({ children, className = "", as: Tag = "div" }) {
  return (
    <Tag className={`${layoutStyles.pageBody} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

export { layoutStyles as pageLayoutStyles };
export default TopNavbar;
