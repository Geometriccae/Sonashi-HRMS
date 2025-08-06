import React, { useState } from "react";
import "./ClientsTable.css";
import DeleteModal from "./delete-modal/DeleteModal";
import AddClientModal from "./AddClientModal";
import FilterModal from "./FilterModal";
import { Link } from "react-router-dom";

// SVG Components
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

const SettingsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="button-icon"
  >
    <path
      d="M20.5547 7H11.5547M14.5547 17H5.55469M14.5547 17C14.5547 18.6569 15.8978 20 17.5547 20C19.2115 20 20.5547 18.6569 20.5547 17C20.5547 15.3431 19.2115 14 17.5547 14C15.8978 14 14.5547 15.3431 14.5547 17ZM10.5547 7C10.5547 8.65685 9.21154 10 7.55469 10C5.89783 10 4.55469 8.65685 4.55469 7C4.55469 5.34315 5.89783 4 7.55469 4C9.21154 4 10.5547 5.34315 10.5547 7Z"
      stroke="#007AFF"
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

// Sample data
const clientsData = [
  {
    id: 1,
    companyName: "SR Shipping",
    email: "info@srshipping.com",
    type: "Client",
    assignedTo: "Ramesh Mohan",
    assignedRole: "Sales Executive",
    category: "Bulk Cargo",
    phoneNumber: "+91 984 483 3947",
  },
  {
    id: 2,
    companyName: "Maersk",
    email: "info@maersk.com",
    type: "Lead",
    assignedTo: "Gurpreet Singh",
    assignedRole: "Sales Executive",
    category: "Projects",
    phoneNumber: "+91 984 483 3947",
  },
  {
    id: 3,
    companyName: "InVista",
    email: "info@invistacorp.com",
    type: "Client",
    assignedTo: "Nayantara S",
    assignedRole: "Sales Executive",
    category: "Break Bulk",
    phoneNumber: "+91 984 483 3947",
  },
  {
    id: 4,
    companyName: "Amazon Warehouses",
    email: "info@amazon.com",
    type: "Client",
    assignedTo: "Albin Antony",
    assignedRole: "Sales Executive",
    category: "Bulk Cargo",
    phoneNumber: "+91 984 483 3947",
  },
  {
    id: 5,
    companyName: "Temu International",
    email: "info@temuship.com",
    type: "Lead",
    assignedTo: "Priya Warrier",
    assignedRole: "Sales Executive",
    category: "Projects",
    phoneNumber: "+91 984 483 3947",
  },
];

function ClientsTable() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const handleEdit = (id) => {
    console.log("Edit client with id:", id);
  };

  const handleDelete = (id) => {
    const client = clientsData.find(c => c.id === id);
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    console.log("Delete client with id:", clientToDelete?.id);
    // Implement actual delete logic here
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const handleAddClient = () => {
    setIsAddClientModalOpen(true);
  };

  const handleAddClientClose = () => {
    setIsAddClientModalOpen(false);
  };

  const handleAddClientSubmit = (formData) => {
    console.log("New client data:", formData);
    // Implement actual add client logic here
    // You would typically send this data to your backend API
  };

  const handleFilterClick = () => {
    setIsFilterModalOpen(true);
  };

  const handleFilterModalClose = () => {
    setIsFilterModalOpen(false);
  };

  const handleFilterSelect = (option) => {
    console.log("Filter selected:", option);
    // Implement filter logic here
    // You can modify the filtering logic based on the selected option
  };

  const filteredData = clientsData.filter((client) => {
    let matchesFilter = true;
    if (activeFilter === "Clients") {
      matchesFilter = client.type === "Client";
    } else if (activeFilter === "Leads") {
      matchesFilter = client.type === "Lead";
    }
    const matchesSearch =
      client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="clients-table-container">
      <div className="table-header-section">
        <div className="table-title-section">
          <h2 className="table-title">Clients and Leads</h2>
          <div className="action-buttons">
            <button className="primary-button" onClick={handleAddClient}>
              Add Client/Lead
              <UserPlusIcon />
            </button>
            <button className="secondary-button">
              Manage Categories
              <SettingsIcon />
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
              className={`toggle-button ${activeFilter === "Clients" ? "active" : ""}`}
              onClick={() => setActiveFilter("Clients")}
            >
              Clients
            </button>
            <button
              className={`toggle-button ${activeFilter === "Leads" ? "active" : ""}`}
              onClick={() => setActiveFilter("Leads")}
            >
              Leads
            </button>
          </div>

          <div className="search-and-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <SearchIcon />
            </div>
            <button className="filter-button" onClick={handleFilterClick}>
              <FilterIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="table-section">
        <div className="table-wrapper">
          <div className="table-columns">
            {/* Company Name Column */}
            <div className="table-column company-column">
              <div className="table-header">
                <div className="table-header-cell">
                  <div className="header-content">
                    <span className="header-text">Company Name</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {filteredData.map((client) => (
                <Link key={client.id} to= '/salesandleads' className="table-cell company-cell no-link-style">
                  <div className="avatar"></div>
                  <div className="companyinfo">
                    <div className="company-name">{client.companyName}</div>
                    <div className="company-email">{client.email}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Type Column */}
            <div className="table-column type-column">
              <div className="table-header">
                <div className="table-header-cell">
                  <div className="header-content">
                    <span className="header-text">Type</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell type-cell">
                  <div className={`type-chip ${client.type.toLowerCase().replace(' ', '')}`}>
                  <span className="chip-text">{client.type}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Assigned To Column */}
            <div className="table-column assigned-column">
              <div className="table-header">
                <div className="table-header-cell">
                  <div className="header-content">
                    <span className="header-text">Assigned to</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell assigned-cell">
                  <div className="assigned-info">
                    <div className="assigned-name">{client.assignedTo}</div>
                    <div className="assigned-role">{client.assignedRole}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Categories Column */}
            <div className="table-column categories-column">
              <div className="table-header">
                <div className="table-header-cell">
                  <div className="header-content">
                    <span className="header-text">Categories</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell categories-cell">
                  <div className="category-info">
                    <div className="category-text">{client.category}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone Number Column */}
            <div className="table-column phone-column">
              <div className="table-header">
                <div className="table-header-cell">
                  <div className="header-content">
                    <span className="header-text">Phone Number</span>
                  </div>
                </div>
              </div>
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell phone-cell">
                  <div className="phone-info">
                    <div className="phone-text">{client.phoneNumber}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Actions Column */}
            <div className="table-column edit-actions-column">
              <div className="table-header">
                <div className="table-header-cell"></div>
              </div>
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell edit-actions-cell">
                  <button
                    className="action-button edit-button"
                    onClick={() => handleEdit(client.id)}
                    aria-label="Edit client"
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
              {filteredData.map((client) => (
                <div key={client.id} className="table-cell delete-actions-cell">
                  <button
                    className="action-button delete-button"
                    onClick={() => handleDelete(client.id)}
                    aria-label="Delete client"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* <div className="pagination-section">
        <button className="pagination-button">
          <span>Previous</span>
        </button>
        <span className="page-info">Page 1 of 10</span>
        <button className="pagination-button">
          <span>Next</span>
        </button>
      </div> */}

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${clientToDelete?.companyName}?`}
        description={`Are you sure you want to delete ${clientToDelete?.companyName}? This action cannot be undone.`}
      />

      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={handleAddClientClose}
        onSubmit={handleAddClientSubmit}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={handleFilterModalClose}
        onFilterSelect={handleFilterSelect}
      />
    </div>
  );
}

export default ClientsTable;
