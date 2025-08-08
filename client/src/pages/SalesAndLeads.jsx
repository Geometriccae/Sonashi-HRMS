import React, { useState, useRef, useEffect } from "react";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";

import DataTable from "../components/DataTable";
import Calendar from "../components/CalendarComponent";
import DeleteModal from "../components/delete-modal/DeleteModal";
import CreateEventModal from "../components/CreateEventModal";
import FileUploadModal from "../components/FileUploadModal";
import DropDownList from "../components/DropDownList";
import TaskBoard from "../components/TaskBoard";


import belldot from "../assets/dashboard/bell-dot.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import plus from "../assets/dashboard/plus.svg";
import arrowleft from "../assets/dashboard/arrow-left.svg";
import maersksymbol from "../assets/dashboard/maersk_symbol.svg";

function SalesAndLeads() {
  const [activeTab, setActiveTab] = useState('basicInfo');
  const basicInfoRef = useRef(null);
  const meetingsRef = useRef(null);
  const documentsRef = useRef(null);
  const tasksRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(''); // 'entry' or 'data'
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const exportButtonRef = useRef(null);

  useEffect(() => {
    const updateIndicatorPosition = () => {
      let activeElement;
      switch (activeTab) {
        case 'basicInfo':
          activeElement = basicInfoRef.current;
          break;
        case 'meetings':
          activeElement = meetingsRef.current;
          break;
        case 'documents':
          activeElement = documentsRef.current;
          break;
        case 'tasks':
          activeElement = tasksRef.current;
          break;
        default:
          activeElement = basicInfoRef.current;
      }

      if (activeElement) {
        const rect = activeElement.getBoundingClientRect();
        const containerRect = activeElement.parentElement.getBoundingClientRect();
        setIndicatorStyle({
          width: rect.width,
          left: rect.left - containerRect.left
        });
      }
    };

    updateIndicatorPosition();
    window.addEventListener('resize', updateIndicatorPosition);

    return () => {
      window.removeEventListener('resize', updateIndicatorPosition);
    };
  }, [activeTab]);

  const handleDeleteEntry = () => {
    setDeleteType('entry');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteData = () => {
    setDeleteType('data');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteType === 'entry') {
      console.log("Delete Entry confirmed");
      // Implement delete entry logic here
    } else if (deleteType === 'data') {
      console.log("Delete Data confirmed");
      // Implement delete data logic here
    }
    setIsDeleteModalOpen(false);
    setDeleteType('');
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteType('');
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
        left: rect.left
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
      case 'pdf':
        alert("Exporting as PDF...");
        // Implement PDF export logic here
        break;
      case 'csv':
        alert("Exporting as CSV...");
        // Implement CSV export logic here
        break;
      case 'txt':
        alert("Exporting as TXT...");
        // Implement TXT export logic here
        break;
      case 'print':
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
      case 'basicInfo':
        return (
          <div className={styles.row_view5}>
            <button className={`${styles.button_row_view} ${styles.editbutton}`} onClick={() => alert("Edit Data Pressed!")}>
              <span className={`${styles.text3} ${styles.editbuttontext}`}>Edit Data</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/5rqzbf3s_expires_30_days.png"} className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/xz7ev9ao_expires_30_days.png"} className={styles.image3} />
            </button>
            <button className={styles.button_row_view3} onClick={handleDeleteEntry}>
              <span className={styles.text5}>Delete Entry</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/ghab1uy5_expires_30_days.png"} className={styles.image3} />
            </button>
          </div>
        );
      case 'meetings':
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={handleNewEvent}>
              <span className={styles.text3}>New Event</span>
              <img src={plus} className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/xz7ev9ao_expires_30_days.png"} className={styles.image3} />
            </button>
          </div>
        );
      case 'documents':
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={handleFileUpload}>
              <span className={styles.text3}>Upload</span>
              <img src={plus} className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/xz7ev9ao_expires_30_days.png"} className={styles.image3} />
            </button>
            <button className={styles.button_row_view3} onClick={handleDeleteData}>
              <span className={styles.text5}>Delete Data</span>
              <img src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/ghab1uy5_expires_30_days.png"} className={styles.image3} />
            </button>
          </div>
        );
      case 'tasks':
        return (
          <div className={styles.row_view5}>
            <button className={styles.button_row_view} onClick={() => alert("New Task Pressed!")}>
              <span className={styles.text3}>New Task</span>
              <img src="https://api.builder.io/api/v1/image/assets/TEMP/b1a5443c4c270e01b0d3b27bba8a7a21e49403cd?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9" className={styles.image3} />
            </button>
            <button
              ref={exportButtonRef}
              className={styles.button_row_view2}
              onClick={handleExportClick}
            >
              <span className={styles.text4}>Export</span>
              <img src="https://api.builder.io/api/v1/image/assets/TEMP/62b07f5543b20d982f6c427ca284b71c4beda176?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9" className={styles.image3} />
            </button>
          </div>
        );
      default:
        return null;
    }
  };


  const documentsData = [
    {
      id: 1,
      fileName: "Cargo Load",
      fileSize: "56KB",
      fileType: "image",
      type: "Important",
      uploadedBy: "Ramesh Mohan",
      userRole: "Sales Executive",
      filetype: "Image",
      uploadedDate: "8/21/15",
    },
    {
      id: 2,
      fileName: "Info Document",
      fileSize: "56KB",
      fileType: "document",
      type: "Extra",
      uploadedBy: "Gurpreet Singh",
      userRole: "Sales Executive",
      filetype: "Document",
      uploadedDate: "6/19/14",
    },
    {
      id: 3,
      fileName: "Shipping demo",
      fileSize: "56KB",
      fileType: "video",
      type: "Important",
      uploadedBy: "Nayantara S",
      userRole: "Sales Executive",
      filetype: "Video",
      uploadedDate: "2/11/12",
    },
    {
      id: 4,
      fileName: "Cargo Images",
      fileSize: "56KB",
      fileType: "image",
      type: "Important",
      uploadedBy: "Albin Antony",
      userRole: "Sales Executive",
      filetype: "Image",
      uploadedDate: "8/16/13",
    },
    {
      id: 5,
      fileName: "Audio Recording",
      fileSize: "56KB",
      fileType: "audio",
      type: "Extra",
      uploadedBy: "Priya Warrier",
      userRole: "Sales Executive",
      filetype: "Audio",
      uploadedDate: "4/21/12",
    },
    {
      id: 6,
      fileName: "Shipment Manifest",
      fileSize: "56KB",
      fileType: "document",
      type: "Important",
      uploadedBy: "Ganesh R",
      userRole: "Sales Executive",
      filetype: "Document",
      uploadedDate: "3/4/16",
    },
    {
      id: 7,
      fileName: "Image 031",
      fileSize: "56KB",
      fileType: "image",
      type: "Important",
      uploadedBy: "Nayantara S",
      userRole: "Sales Executive",
      filetype: "Image",
      uploadedDate: "2/11/12",
    },
  ];

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Sales & Leads</div>

            <div className={styles["dashboard-profile"]}>
              <img src={belldot} alt="belldot" className={styles["belldot-icon"]} />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <img src={admindemo} alt="" className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>Preety Sinha</div>
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
            <div className={styles["breadcrumb-notactive"]}>Sales and Leads</div>
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
                    src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/4z4kfmha_expires_30_days.png"}
                    className={styles.image}
                    alt=""
                  />
                  <div className={styles.row_view3}>
                    <div className={styles.row_view4}>
                      <img
                        src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/emvz7kw9_expires_30_days.png"}
                        className={styles.image2}
                        alt="Maersk logo"
                      />
                      <span className={styles.text}>
                        {"Maersk"}
                      </span>
                    </div>
                    <button className={styles.button}
                      onClick={()=>alert("Pressed!")}>
                      <span className={styles.text2}>
                        {"Lead"}
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
                    className={`${styles.text6} ${activeTab === 'basicInfo' ? styles.active : ''}`}
                    onClick={() => setActiveTab('basicInfo')}
                  >
                    {"Basic Info"}
                  </span>
                  <span
                    ref={meetingsRef}
                    className={`${styles.text7} ${activeTab === 'meetings' ? styles.active : ''}`}
                    onClick={() => setActiveTab('meetings')}
                  >
                    {"Meetings"}
                  </span>
                  <div
                    ref={documentsRef}
                    className={`${styles.view2} ${activeTab === 'documents' ? styles.active : ''}`}
                    onClick={() => setActiveTab('documents')}
                  >
                    <span className={styles.text8}>
                      {"Documents"}
                    </span>
                  </div>
                  <div
                    ref={tasksRef}
                    className={`${styles.view2} ${activeTab === 'tasks' ? styles.active : ''}`}
                    onClick={() => setActiveTab('tasks')}
                  >
                    <span className={styles.text8}>
                      {"Tasks"}
                    </span>
                  </div>
                  <div
                    className={styles.box}
                    style={{
                      width: `${indicatorStyle.width}px`,
                      left: `${indicatorStyle.left}px`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className={styles.column3}>
              {activeTab === 'basicInfo' && (
                <>
                {/* first row */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                  </div>
                  {/* second row */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                  </div>
                  {/* third row */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                  </div>
                  {/* fourth row */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                  </div>
                  {/* fifth row */}
                  <div className={styles.row_view6}>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column4}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                    <div className={styles.column5}>
                      <span className={styles.text9}>
                        {"First Name"}
                      </span>
                      <span className={styles.text10}>
                        {"Ryan"}
                      </span>
                    </div>
                  </div>
                  {/* Add more basic info content as needed */}
                </>
              )}

              {activeTab === 'meetings' && (
                <div className={styles.meetingsContent}>
                  <Calendar />
                </div>
              )}

              {activeTab === 'documents' && (
                <div >
                  {/* <p>Documents content will be displayed here</p> */}
                  {/* Add your documents content here when ready */}
                  <section className="documents-table-section">
                <DataTable data={documentsData} />
               </section>
                </div>
              )}

              {activeTab === 'tasks' && (
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
        title={deleteType === 'entry' ? 'Delete this Entry?' : 'Delete this Data?'}
        description={
          deleteType === 'entry'
            ? 'Are you sure you want to delete this entry? This action cannot be undone.'
            : 'Are you sure you want to delete this data? This action cannot be undone.'
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

export default SalesAndLeads;
