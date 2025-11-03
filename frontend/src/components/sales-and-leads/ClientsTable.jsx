import React, { useState, useRef, useEffect } from "react";
import styles from "./ClientsTable.module.css";
import DeleteModal from "../delete-modal/DeleteModal";
import AddClientModal from "./AddClientModal";
import EditClientModal from "./EditClientModal";
import FilterDropdown from "../FilterDropdown";
import { Link } from "react-router-dom";
import clientService from "../../services/ClientService";
import config from "../../config/config";
import plus from "../../assets/dashboard/plus.svg";
import ImportCsvModal from "./ImportCsvModal";
import { io as ioClient } from "socket.io-client";

// SVG Components
const UserPlusIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={styles.buttonIcon}
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
    className={styles.buttonIcon}
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
    className={styles.searchIcon}
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
    className={styles.filterIcon}
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
    className={styles.sortIcon}
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
    className={styles.editIcon}
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
    className={styles.deleteIcon}
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

function ClientsTable() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [clientsData, setClientsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const filterButtonRef = useRef(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Fetch clients data from backend (moved out so callers can reuse)
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const clients = await clientService.getClients();
      // server returns array
      setClientsData(Array.isArray(clients) ? clients : (clients.clients || []));
      setError(null);
    } catch (err) {
      console.error("Error fetching clients:", err);
      // Surface error but keep current list visible (avoid full-screen error)
      setError(err.message || "Failed to fetch clients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();

    // real-time listener: update clients list when server broadcasts a new client
    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;
    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    const onClientCreated = (client) => {
      try {
        if (!client) return;
        setClientsData((prev) => {
          if (!prev) return [client];
          // avoid duplicate if already present
          const exists = prev.some((c) => String(c._id) === String(client._id));
          if (exists) return prev;
          return [client, ...prev];
        });
      } catch (e) {
        console.warn('Error handling client-created event', e);
      }
    };

    socket.on('client-created', onClientCreated);

    return () => {
      try { socket.off('client-created', onClientCreated); socket.disconnect(); } catch (e) {}
    };
  }, []);

  const handleEdit = (id) => {
    const client = clientsData.find((c) => c._id === id);
    if (client) {
      setClientToEdit(client);
      setIsEditClientModalOpen(true);
    }
  };

  const handleDelete = (id) => {
    const client = clientsData.find((c) => c._id === id);
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await clientService.deleteClient(clientToDelete._id);
      setClientsData((prevClients) =>
        prevClients.filter((client) => client._id !== clientToDelete._id)
      );
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (err) {
      console.error("Error deleting client:", err);
      setError(err.message || "Failed to delete client");
    }
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

  const handleAddClientSubmit = async (formData, profileImage) => {
    try {
      // Choose appropriate API call depending on whether a file was provided
      let created;
      if (profileImage) {
        created = await clientService.createClientWithFile(formData, profileImage);
      } else {
        created = await clientService.createClient(formData);
      }

      // Optimistically show the created client immediately (dedupe)
      if (created) {
        setClientsData((prev) => {
          const exists = prev && prev.some((c) => String(c._id) === String(created._id));
          if (exists) return prev;
          return [created, ...(prev || [])];
        });
      }
      setIsAddClientModalOpen(false);
      // Background refresh to reconcile server state; don't block UI and don't replace visible list on error
      fetchClients().catch((e) => {
        console.warn("Background refresh after create failed:", e);
      });
    } catch (err) {
      console.error("Error creating client:", err);
      setError(err.message || "Failed to create client");
      throw err;
    }
  };

  const handleEditClientClose = () => {
    setIsEditClientModalOpen(false);
    setClientToEdit(null);
  };

  const handleEditClientSubmit = async (updatedClient) => {
    try {
      setClientsData((prevClients) =>
        prevClients.map((client) =>
          client._id === updatedClient._id ? updatedClient : client
        )
      );
      setIsEditClientModalOpen(false);
      setClientToEdit(null);
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err.message || "Failed to update client");
    }
  };

  const handleFilterClick = (event) => {
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left - 200,
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

  const filteredData = clientsData.filter((client) => {
    let matchesFilter = true;
    if (activeFilter === "Clients") {
      matchesFilter =
        client.type === "Client" || client.relationshipStatus === "Active";
    } else if (activeFilter === "Leads") {
      matchesFilter =
        client.type === "Lead" || client.relationshipStatus === "Prospect";
    }

    const matchesSearch =
      client.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pagedData = filteredData.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Reset to first page when filters/search change
  useEffect(() => { setCurrentPage(1); }, [activeFilter, searchTerm, clientsData.length]);

  const triggerImport = () => {
    console.log("Import button clicked, opening modal");
    setImportError("");
    setIsImportModalOpen(true);
  };

  // handle modal result: refresh authoritative list so new server IDs/fields appear
  const handleImportComplete = async (importedClients = [], importErrors = []) => {
    try {
      await fetchClients();
      if (importErrors && importErrors.length > 0) {
        setImportError(`${importErrors.length} errors occurred during import. Check modal for details.`);
      } else {
        setImportError("");
      }
    } catch (e) {
      console.error("Error refreshing after import:", e);
      setImportError("Import completed but failed to refresh list. Try refreshing page.");
    } finally {
      setIsImportModalOpen(false);
    }
  };

  // NOTE: don't early-return for loading/error so the existing list (if any) stays visible.
  // If there are no clients yet, show loading/empty states below as usual.
  // An inline banner will show transient loading or error information.

  // Render top inline banners
  const topBanner = (
    <>
      {isLoading && clientsData.length > 0 && (
        <div className={styles.loadingState} style={{ marginBottom: 8 }}>
          Refreshing data...
        </div>
      )}
      {error && (
        <div className={styles.errorState} style={{ marginBottom: 8 }}>
          <span>Error: {error}</span>
          <button onClick={fetchClients} style={{ marginLeft: 12 }}>Retry</button>
        </div>
      )}
    </>
  );

  return (
    <div className={styles.clientsTableContainer}>
      {topBanner}
      <div className={styles.tableHeaderSection}>
        <div className={styles.tableTitleSection}>
          <h2 className={styles.tableTitle}>Clients and Leads</h2>
          <div className={styles.actionButtons}>
            <button className={styles.primaryButton} onClick={triggerImport} disabled={isImporting}>
              <div className={styles.addClientButtonText}>Import</div>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
            <button className={styles.primaryButton} onClick={handleAddClient}>
              <div className={styles.addClientButtonText}>Add Client/Lead</div>
              <UserPlusIcon />
            </button>
            <button className={styles.secondaryButton}>
              <div className={styles.addClientButtonText}>Manage Categories</div>
              <SettingsIcon />
            </button>
          </div>
        </div>

        <div className={styles.controlsSection}>
          <div className={styles.segmentedControl}>
            <button
              className={`${styles.toggleButton} ${
                activeFilter === "All" ? styles.activeAll : ""
              }`}
              onClick={() => setActiveFilter("All")}
            >
              All
            </button>
            <button
              className={`${styles.toggleButton} ${
                activeFilter === "Clients" ? styles.active : ""
              }`}
              onClick={() => setActiveFilter("Clients")}
            >
              Clients
            </button>
            <button
              className={`${styles.toggleButton} ${
                activeFilter === "Leads" ? styles.active : ""
              }`}
              onClick={() => setActiveFilter("Leads")}
            >
              Leads
            </button>
          </div>

          <div className={styles.searchAndFilter}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <SearchIcon />
            </div>
            <button
              ref={filterButtonRef}
              className={styles.filterButton}
              onClick={handleFilterClick}
            >
              <FilterIcon />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableSection}>
        {importError && (
          <div className={styles.errorState} style={{ marginBottom: 8 }}>{importError}</div>
        )}
        <div className={styles.tableWrapper}>
          <div className={styles.tableColumns}>
            {/* Company Name Column */}
            <div className={`${styles.tableColumn} ${styles.companyColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Company Name</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <Link
                  key={client._id}
                  to={`/salesandleadsclient/${client._id}`}
                  className={`${styles.tableCell} ${styles.companyCell} ${styles.noLinkStyle}`}
                >
                  <div className={styles.avatar}>
                    {client.profilePicture ? (
                      <img
                        src={`${config.API_BASE_URL.replace('/api', '')}${client.profilePicture}`}
                        alt={`${client.companyName} profile`}
                        className={styles.clientProfileImage}
                      />
                    ) : (
                      <div className={styles.defaultAvatar}>
                        {client.companyName?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className={styles.companyinfo}>
                    <div className={styles.companyName}>{client.companyName}</div>
                    <div className={styles.companyEmail}>{client.email}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Type Column */}
            <div className={`${styles.tableColumn} ${styles.typeColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Type</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.typeCell}`}>
                  <div
                    className={`${styles.typeChip} ${styles[(
                      client.type ||
                      client.relationshipStatus ||
                      ""
                    )
                      .toLowerCase()
                      .replace(" ", "")]}`}
                  >
                    <span className={styles.chipText}>
                      {client.type || client.relationshipStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Assigned To Column */}
            <div className={`${styles.tableColumn} ${styles.assignedColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Assigned to</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.assignedCell}`}>
                  <div className={styles.assignedInfo}>
                    <div className={styles.assignedName}>{/* display name or fallback */}
                      {client.assignedTo && client.assignedTo.employeeName ? client.assignedTo.employeeName : (client.assignedTo?.username || client.assignedTo || 'Unassigned')}
                    </div>
                    <div className={styles.assignedRole}>{client.assignedRole || ''}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Categories Column */}
            <div className={`${styles.tableColumn} ${styles.categoriesColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Categories</span>
                    <SortIcon />
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.categoriesCell}`}>
                  <div className={styles.categoryInfo}>
                    <div className={styles.categoryText}>{client.category || ''}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone Number Column */}
            <div className={`${styles.tableColumn} ${styles.phoneColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}>
                  <div className={styles.headerContent}>
                    <span className={styles.headerText}>Phone Number</span>
                  </div>
                </div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.phoneCell}`}>
                  <div className={styles.phoneInfo}>
                    <div className={styles.phoneText}>
                      {client.mobile || client.phone || "Not provided"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Actions Column */}
            <div className={`${styles.tableColumn} ${styles.editActionsColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}></div>
              </div>
              {pagedData.map((client) => (
                <div key={client._id} className={`${styles.tableCell} ${styles.editActionsCell}`}>
                  <button
                    className={`${styles.actionButton} ${styles.editButton}`}
                    onClick={() => handleEdit(client._id)}
                    aria-label="Edit client"
                  >
                    <EditIcon />
                  </button>
                </div>
              ))}
            </div>

            {/* Delete Actions Column */}
            <div className={`${styles.tableColumn} ${styles.deleteActionsColumn}`}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell}></div>
              </div>
              {pagedData.map((client) => (
                <div
                  key={client._id}
                  className={`${styles.tableCell} ${styles.deleteActionsCell}`}
                >
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={() => handleDelete(client._id)}
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

      <div className={styles.paginationSection}>
        <button className={styles.paginationButton} onClick={goPrev} disabled={currentPageSafe <= 1}>
          <span>Previous</span>
        </button>
        <span className={styles.pageInfo}>
          Page {currentPageSafe} of {totalPages}
        </span>
        <button className={styles.paginationButton} onClick={goNext} disabled={currentPageSafe >= totalPages}>
          <span>Next</span>
        </button>
      </div>

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

      <EditClientModal
        isOpen={isEditClientModalOpen}
        onClose={handleEditClientClose}
        onSubmit={handleEditClientSubmit}
        clientData={clientToEdit}
      />

      <FilterDropdown
        isOpen={isFilterDropdownOpen}
        onClose={handleFilterDropdownClose}
        onFilterSelect={handleFilterSelect}
        position={dropdownPosition}
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportCsvModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  );
}

export default ClientsTable;