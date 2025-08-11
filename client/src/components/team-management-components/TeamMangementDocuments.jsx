import React from "react";
import styles from "./TeamManagementDocuments.module.css";
import Sidebar from "../../pages/sidebar/Sidebar";
import DataTable from "../DataTable";

import belldot from "../../assets/dashboard/bell-dot.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";

function TeamManagementDocuments() {
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
    <div className="">
      

        <section className={styles["documents-table-section"]}>
          <DataTable data={documentsData} />
        </section>
      
    </div>
  );
}

export default TeamManagementDocuments;
