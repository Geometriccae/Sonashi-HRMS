import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import "./TeamMembersTable.css";
import DeleteModal from "../delete-modal/DeleteModal";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import FilterDropdown from "../FilterDropdown";
import employeeService from "../../services/EmployeeService";
import config from "../../config/config";

// SVG Components (reusing from ClientsTable)
const UserPlusIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="button-icon"
  >
    <path
      d="M16.5547 21V19C16.5547 17.9391 16.1333 16.9217 15.3831 16.1716C14.633 15.4214 13.6156 15 12.5547 15H6.55469C5.49382 15 4.47641 15.4214 3.72626 16.1716C2.97611 16.9217 2.55469 17.9391 2.55469 19V21M19.5547 8V14M22.5547 11H16.5547M13.5547 7C13.5547 9.20914 11.7638 11 9.55469 11C7.34555 11 5.55469 9.20914 5.55469 7C5.55469 4.79086 7.34555 3 9.55469 3C11.7638 3 13.5547 4.79086 13.5547 7Z"
      stroke="white"
      strokeOpacity="0.9"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const SearchIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 17 17"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="search-icon"
  >
    <path
      d="M14.4063 14.5938L11.5396 11.7271M13.0729 7.92708C13.0729 10.8726 10.6851 13.2604 7.73958 13.2604C4.79406 13.2604 2.40625 10.8726 2.40625 7.92708C2.40625 4.98156 4.79406 2.59375 7.73958 2.59375C10.6851 2.59375 13.0729 4.98156 13.0729 7.92708Z"
      stroke="#98A1B0"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const FilterIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 33"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="filter-icon"
  >
    <path
      d="M4 8.59375H28M9.33333 16.5938H22.6667M13.3333 24.5938H18.6667"
      stroke="#98A1B0"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const SortIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="sort-icon"
  >
    <path
      d="M2.23642 11.7338L4.93675 14.4341M4.93675 14.4341L7.63708 11.7338M4.93675 14.4341V3.63281M14.3879 6.33314L11.6876 3.63281M11.6876 3.63281L8.98725 6.33314M11.6876 3.63281V14.4341"
      stroke="#808080"
      strokeOpacity="0.7"
      strokeWidth="1.01262"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const EditIcon = () => (
  <svg
    width="29"
    height="29"
    viewBox="0 0 30 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="edit-icon"
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
    width="29"
    height="29"
    viewBox="0 0 29 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="delete-icon"
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

function TeamMembersTable() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filterButtonRef = useRef(null);

  // Fetch employees from API
  useEffect(() => {
    fetchEmployees();
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
      setError("Failed to load employees. Please try again.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
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
        await employeeService.deleteEmployee(memberToDelete._id || memberToDelete.id);
        // Refresh the employees list
        await fetchEmployees();
      }
    } catch (err) {
      console.error("Error deleting employee:", err);
      setError("Failed to delete employee. Please try again.");
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

  const handleEditEmployeeClose = () => {
    setIsEditEmployeeModalOpen(false);
    setEmployeeToEdit(null);
  };

  const handleAddEmployeeSubmit = async (formData) => {
    try {
      // Refresh the employees list after adding
      await fetchEmployees();
    } catch (err) {
      console.error("Error refreshing employees after add:", err);
    }
  };

  const handleEditEmployeeSubmit = async (formData) => {
    try {
      // Refresh the employees list after editing
      await fetchEmployees();
    } catch (err) {
      console.error("Error refreshing employees after edit:", err);
    }
  };

  const handleFilterClick = (event) => {
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left - 200
      });
    }
    setIsFilterDropdownOpen(!isFilterDropdownOpen);
  };

  const handleFilterDropdownClose = () => {
    setIsFilterDropdownOpen(false);
  };

  const handleFilterSelect = (option) => {
    console.log("Filter selected:", option);
  };

  const filteredData = employees.filter((member) => {
    let matchesFilter = true;
    if (activeFilter === "Active") {
      matchesFilter = member.attendance !== "Leave";
    } else if (activeFilter === "Inactive") {
      matchesFilter = member.attendance === "Leave";
    }
    
    const matchesSearch =
      (member.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.emailId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.role || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const getProjectsDisplay = (assignedProjects) => {
    if (!assignedProjects || assignedProjects.length === 0) {
      return { main: "No Projects", description: "Not assigned" };
    }
    
    if (Array.isArray(assignedProjects)) {
      const main = assignedProjects[0];
      const description = assignedProjects.length > 1 
        ? `+${assignedProjects.length - 1} more projects` 
        : "Single project assigned";
      return { main, description };
    }
    
    return { main: assignedProjects, description: "Project assigned" };
  };

  if (loading) {
    return (
      <div className="clients-table-container">
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading employees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="clients-table-container">
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p style={{ color: "#ED5E56" }}>{error}</p>
          <button 
            onClick={fetchEmployees}
            className="primary-button"
            style={{ marginTop: "16px" }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="clients-table-container">
      <div className="table-header-section">
        <div className="table-title-section">
          <h2 className="table-title">Team Members</h2>
          <div className="action-buttons">
            <button className="primary-button" onClick={handleAddEmployee}>
              Add Employee
              <UserPlusIcon />
            </button>
          </div>
        </div>
        <div className="controls-section">
          <div className="segmented-control">
            <button
              className={`toggle-button ${activeFilter === "All" ? "active-all" : ""}`}
              onClick={() => setActiveFilter("All")}
            >
              All
            </button>
            <button
              className={`toggle-button ${activeFilter === "Active" ? "active" : ""}`}
              onClick={() => setActiveFilter("Active")}
            >
              Active
            </button>
            <button
              className={`toggle-button ${activeFilter === "Inactive" ? "active" : ""}`}
              onClick={() => setActiveFilter("Inactive")}
            >
              Inactive
            </button>
          </div>
          <div className="search-and-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <SearchIcon />
            </div>
            <button
              ref={filterButtonRef}
              className="filter-button"
              onClick={handleFilterClick}
            >
              <FilterIcon />
            </button>
          </div>
        </div>
      </div>
      
      {filteredData.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>No employees found.</p>
          {searchTerm && (
            <p style={{ color: "#8C8E90", fontSize: "14px" }}>
              Try adjusting your search criteria.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="table-section">
            <div className="table-wrapper">
              <div className="table-columns">
                {/* Employee Name Column */}
                <div className="table-column company-column">
                  <div className="table-header">
                    <div className="table-header-cell">
                      <div className="header-content">
                        <span className="header-text">Employee Name</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {filteredData.map((member) => (
                    <Link  
                      key={member._id || member.id} 
                      to={`/teammanagement_salesleads/${member._id || member.id}`} 
                      className="table-cell company-cell no-link-style"
                    >
                      <div className="avatar">
                    {member.profilePhoto ? (
                      <img
                        src={`${config.API_BASE_URL.replace('/api', '')}${member.profilePhoto}`}
                        alt={`${member.companyName} profile`}
                        className="client-profile-image"
                      />
                    ) : (
                      <div className="avatar">
                        {member.employeeName ? member.employeeName.charAt(0).toUpperCase() : 'E'}
                      </div>
                          )}
                       </div>
                      <div className="companyinfo">
                        <div className="company-name">{member.employeeName || 'Unknown'}</div>
                        <div className="company-email">{member.role || 'No Role'}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {/* Attendance Column */}
                <div className="table-column type-column">
                  <div className="table-header">
                    <div className="table-header-cell">
                      <div className="header-content">
                        <span className="header-text">Attendance</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {filteredData.map((member) => (
                    <div key={member._id || member.id} className="table-cell type-cell">
                      <div className={`type-chip ${(member.attendance || 'onsite').toLowerCase().replace(' ', '')}`}>
                        <span className="chip-text">{member.attendance || 'Onsite'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Email Column */}
                <div className="table-column assigned-column">
                  <div className="table-header">
                    <div className="table-header-cell">
                      <div className="header-content">
                        <span className="header-text">Email ID</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {filteredData.map((member) => (
                    <div key={member._id || member.id} className="table-cell assigned-cell">
                      <div className="assigned-info">
                        <div className="assigned-name">{member.emailId || 'No Email'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Phone Number Column */}
                <div className="table-column categories-column">
                  <div className="table-header">
                    <div className="table-header-cell">
                      <div className="header-content">
                        <span className="header-text">Phone Number</span>
                      </div>
                    </div>
                  </div>
                  {filteredData.map((member) => (
                    <div key={member._id || member.id} className="table-cell categories-cell">
                      <div className="category-info">
                        <div className="category-text">{member.mobile || 'No Phone'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Assigned Project Column */}
                <div className="table-column phone-column">
                  <div className="table-header">
                    <div className="table-header-cell">
                      <div className="header-content">
                        <span className="header-text">Assigned Project</span>
                        <SortIcon />
                      </div>
                    </div>
                  </div>
                  {filteredData.map((member) => {
                    const projectDisplay = getProjectsDisplay(member.assignedProjects);
                    return (
                      <div key={member._id || member.id} className="table-cell phone-cell">
                        <div className="phone-info">
                          <div className="phone-text">{projectDisplay.main}</div>
                          <div className="company-email">{projectDisplay.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Edit Actions Column */}
                <div className="table-column edit-actions-column">
                  <div className="table-header">
                    <div className="table-header-cell"></div>
                  </div>
                  {filteredData.map((member) => (
                    <div key={member._id || member.id} className="table-cell edit-actions-cell">
                      <button
                        className="action-button edit-button"
                        onClick={() => handleEdit(member)}
                        aria-label="Edit team member"
                      >
                        <EditIcon />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Delete Actions Column */}
                <div className="table-column delete-actions-column">
                  <div className="table-header">
                    <div className="table-header-cell"></div>
                  </div>
                  {filteredData.map((member) => (
                    <div key={member._id || member.id} className="table-cell delete-actions-cell">
                      <button
                        className="action-button delete-button"
                        onClick={() => handleDelete(member)}
                        aria-label="Delete team member"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pagination-section">
            <button className="pagination-button">
              <span>Previous</span>
            </button>
            <span className="page-info">
              Page 1 of {Math.ceil(filteredData.length / 10) || 1}
            </span>
            <button className="pagination-button">
              <span>Next</span>
            </button>
          </div>
        </>
      )}
      
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${memberToDelete?.employeeName}?`}
        description={`Are you sure you want to delete ${memberToDelete?.employeeName}? This action cannot be undone.`}
      />
      
      <AddEmployeeModal
        isOpen={isAddEmployeeModalOpen}
        onClose={handleAddEmployeeClose}
        onSubmit={handleAddEmployeeSubmit}
      />

      <EditEmployeeModal
        isOpen={isEditEmployeeModalOpen}
        onClose={handleEditEmployeeClose}
        onSubmit={handleEditEmployeeSubmit}
        employee={employeeToEdit}
      />

      <FilterDropdown
        isOpen={isFilterDropdownOpen}
        onClose={handleFilterDropdownClose}
        onFilterSelect={handleFilterSelect}
        position={dropdownPosition}
      />
    </div>
  );
}

export default TeamMembersTable;
