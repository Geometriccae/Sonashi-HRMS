import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./SalesAndLeadsClient.module.css";
import Side from "./sidebar/Sidebar";

import Documents from "../components/sales-and-leads/Documents";
import DocumentsService from "../services/DocumentsService";
import Calendar from "../components/sales-and-leads/CalendarComponent";
import DeleteModal from "../components/delete-modal/DeleteModal";
import CreateEventModal from "../components/sales-and-leads/CreateEventModal";
import EditClientModal from "../components/sales-and-leads/EditClientModal";
import FileUploadModal from "../components/FileUploadModal";
import DropDownList from "../components/DropDownList";
import TaskBoard from "../components/sales-and-leads/TaskBoard";
import clientService from "../services/ClientService"; // Import your client service
import config from "../config/config";

import belldot from "../assets/dashboard/bell-dot.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import plus from "../assets/dashboard/plus.svg";
import arrowleft from "../assets/dashboard/arrow-left.svg";
import maersksymbol from "../assets/dashboard/maersk_symbol.svg";
import pencillineblue from "../assets/dashboard/pencil-line-blue.svg";
import upload from "../assets/dashboard/upload.svg";
import deletewhite from "../assets/dashboard/delete-white.svg";
import ProfileAvatar from "../components/ProfileAvatar";

function SalesAndLeadsClient(clientId ) {
  const [activeTab, setActiveTab] = useState("basicInfo");
  const basicInfoRef = useRef(null);
  const meetingsRef = useRef(null);
  const documentsRef = useRef(null);
  const tasksRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'entry' or 'data'
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const exportButtonRef = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams(); // Get the client ID from URL params
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [calendarKey, setCalendarKey] = useState(0); // Force calendar refresh
  const [documentsKey, setDocumentsKey] = useState(0); // Force documents refresh

   const [username, setUsername] = useState("");
    
      useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
      }, []);
    

  // Fetch client data when component mounts
  useEffect(() => {
    const fetchClientData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const client = await clientService.getClient(id);
        setClientData(client);
        setError(null);
      } catch (err) {
        console.error("Error fetching client:", err);
        setError(err.message || "Failed to fetch client data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, [id]);

  // Main useEffect for tab indicator positioning
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
        case "tasks":
          activeElement = tasksRef.current;
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

  // Additional useEffect to handle initial tab indicator positioning after data loads
  useEffect(() => {
    if (clientData && activeTab === "basicInfo") {
      const updateInitialPosition = () => {
        if (basicInfoRef.current) {
          const rect = basicInfoRef.current.getBoundingClientRect();
          const containerRect =
            basicInfoRef.current.parentElement.getBoundingClientRect();
          setIndicatorStyle({
            width: rect.width,
            left: rect.left - containerRect.left,
          });
        }
      };

      // Small delay to ensure DOM is fully rendered
      setTimeout(updateInitialPosition, 200);
    }
  }, [clientData, activeTab]);

  // Add loading and error states
  if (isLoading) {
    return (
      <div className={styles["dashboard-layout"]}>
        <Side />
        <main>
          <div className={styles.loadingState}>Loading client data...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles["dashboard-layout"]}>
        <Side />
        <main>
          <div className={styles.errorState}>
            <p>Error: {error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </main>
      </div>
    );
  }
  if (!clientData) {
    return (
      <div className={styles["dashboard-layout"]}>
        <Side />
        <main>
          <div className={styles.errorState}>Client not found</div>
        </main>
      </div>
    );
  }

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
        await clientService.deleteClient(id);
        navigate("/salesandleads");
        return; // no further cleanup needed, leaving page
      } else if (deleteType === "data") {
        // Optional: implement bulk document delete for this client in backend later
        // For now, simply refresh documents list key
        setDocumentsKey(prev => prev + 1);
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert(e.message || "Delete failed");
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

  const handleEventCreated = (newEvent) => {
    console.log("Event created successfully:", newEvent);
    // Force calendar component to refresh by updating its key
    setCalendarKey(prev => prev + 1);
    // You can also update local events state if needed
    setEvents(prev => [...prev, newEvent]);
  };

  const handleEditClientClose = () => {
    setIsEditClientModalOpen(false);
  };

  const handleEditClientSubmit = async (updatedClient) => {
    try {
      // Update the client data in local state
      setClientData(updatedClient);
      setIsEditClientModalOpen(false);
    } catch (err) {
      console.error("Error updating client:", err);
      setError(err.message || "Failed to update client");
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
      if (!id || !files || files.length === 0) return;
      // Upload each file sequentially (could be parallel if desired)
      for (const file of files) {
        await DocumentsService.uploadForClient(id, file, {
          uploadedBy: "Current User",
          userRole: "Sales Executive",
        });
      }
      // Refresh documents tab
      setDocumentsKey(prev => prev + 1);
    } catch (e) {
      console.error("Upload failed", e);
      alert(e.message || "Upload failed");
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
      case "basicInfo":
        return (
          <div className={styles.row_view5}>
            <button
              className={`${styles.button_row_view} ${styles.editbutton}`}
              onClick={() => setIsEditClientModalOpen(true)}
            >
              <span className={`${styles.text3} ${styles.editbuttontext}`}>
                Edit Data
              </span>
              <img src={pencillineblue} className={styles.image3} alt="edit" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="export" />
            </button>
            <button
              className={styles.button_row_view3}
              onClick={handleDeleteEntry}
            >
              <span className={styles.text5}>Delete Entry</span>
              <img src={deletewhite} className={styles.image3} alt="delete" />
            </button>
          </div>
        );
      case "meetings":
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={handleNewEvent}>
              <span className={styles.text3}>New Event</span>
              <img src={plus} className={styles.image3} alt="plus" />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} alt="export" className={styles.image3} />
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
              <img src={upload} className={styles.image3} alt="" />
            </button>
            <button
              className={styles.button_row_view3}
              onClick={handleDeleteData}
            >
              <span className={styles.text5}>Delete All</span>
              <img src={deletewhite} alt="delete" className={styles.image3} />
            </button>
          </div>
        );
      case "tasks":
        return (
          <div className={styles.row_view5}>
            <button
              className={styles.button_row_view}
              onClick={() => alert("New Task Pressed!")}
            >
              <span className={styles.text3}>New Task</span>
              <img src={plus} alt="newtask" className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={upload} className={styles.image3} alt="" />
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
            <div className={styles["dashboard-title"]}>Sales & Leads</div>

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
            <div
              className={styles["breadcrumb-notactive"]}
              onClick={() => navigate("/salesandleads")}
              style={{ cursor: "pointer" }}
            >
              Sales and Leads
            </div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>Maersk</div>
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
                      {clientData.profilePicture ? (
                        <img
                          src={`${config.API_BASE_URL.replace('/api', '')}${clientData.profilePicture}`}
                          className={styles.image2}
                          alt={`${clientData.companyName} logo`}
                        />
                      ) : (
                        <div className={styles.defaultCompanyLogo}>
                          {clientData.companyName?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                      )}
                      <span className={styles.text}>
                        {clientData.companyName || "Client Name"}
                      </span>
                    </div>
                    <button
                      className={styles.button}
                      onClick={() => alert("Pressed!")}
                    >
                      <span className={styles.text2}>{"Lead"}</span>
                    </button>
                  </div>
                </div>
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
                  <span
                    ref={meetingsRef}
                    className={`${styles.text7} ${
                      activeTab === "meetings" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("meetings")}
                  >
                    {"Meetings"}
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
                    ref={tasksRef}
                    className={`${styles.view2} ${
                      activeTab === "tasks" ? styles.active : ""
                    }`}
                    onClick={() => setActiveTab("tasks")}
                  >
                    <span className={styles.text8}>{"Tasks"}</span>
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
                  {/* Company Details */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Company Name</span>
                      <span className={styles.text10}>
                        {clientData.companyName || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Client Type</span>
                      <span className={styles.text10}>
                        {clientData.type || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Email</span>
                      <span className={styles.text10}>
                        {clientData.email || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>Phone</span>
                      <span className={styles.text10}>
                        {clientData.phone || "Not provided"}
                      </span>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Primary Contact</span>
                      <span className={styles.text10}>
                        {clientData.primaryContactName || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Designation</span>
                      <span className={styles.text10}>
                        {clientData.designation || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Mobile</span>
                      <span className={styles.text10}>
                        {clientData.mobile || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>Website</span>
                      <span className={styles.text10}>
                        {clientData.website ? (
                          <a
                            href={clientData.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {clientData.website}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Address Details */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Address</span>
                      <span className={styles.text10}>
                        {clientData.address || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Country</span>
                      <span className={styles.text10}>
                        {clientData.country || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Tax ID</span>
                      <span className={styles.text10}>
                        {clientData.taxId || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>Relationship Status</span>
                      <span className={styles.text10}>
                        {clientData.relationshipStatus || "Not provided"}
                      </span>
                    </div>
                  </div>

                  {/* Business Details */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Industry Type</span>
                      <span className={styles.text10}>
                        {clientData.industryType || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Cargo Type</span>
                      <span className={styles.text10}>
                        {clientData.cargoType || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Account Manager</span>
                      <span className={styles.text10}>
                        {clientData.accountManager || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>Decision Maker</span>
                      <span className={styles.text10}>
                        {clientData.decisionMaker || "Not provided"}
                      </span>
                    </div>
                  </div>

                  {/* Additional Business Details */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Contract Type</span>
                      <span className={styles.text10}>
                        {clientData.contractType || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Incoterms</span>
                      <span className={styles.text10}>
                        {clientData.incoterms || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>Lead Source</span>
                      <span className={styles.text10}>
                        {clientData.leadSource || "Not provided"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>Current Status</span>
                      <span className={styles.text10}>
                        {clientData.currentStatus || "Not provided"}
                      </span>
                    </div>
                  </div>
                  {/* Add more basic info content as needed */}
                </>
              )}

              {activeTab === "meetings" && (
                <div className={styles.meetingsContent}>
                  <Calendar key={calendarKey} clientId={id} />
                </div>
              )}

              {activeTab === "documents" && (
                <div>
                  {/* <p>Documents content will be displayed here</p> */}
                  {/* Add your documents content here when ready */}
                  <section className="documents-table-section">
                    <Documents clientId={id} refreshKey={documentsKey} />
                  </section>
                </div>
              )}

              {activeTab === "tasks" && (
                <div className={styles.tasksContent}>
                  <TaskBoard />
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
        clientId={id}
        onEventCreated={handleEventCreated}
      />
       

      <EditClientModal
        isOpen={isEditClientModalOpen}
        onClose={handleEditClientClose}
        onSubmit={handleEditClientSubmit}
        clientData={clientData}
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

export default SalesAndLeadsClient;
