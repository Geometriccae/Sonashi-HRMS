import React, { useState, useEffect } from "react";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import SalarySlipTable from "../components/salary-slip/SalarySlipTable";

function SalarySlips() {
    const [userRole, setUserRole] = useState("");

    useEffect(() => {
        setUserRole(localStorage.getItem("role") || "");
    }, []);

    return (
        <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
            <Side />

            <main className={pageLayoutStyles.pageMain}>
                <TopNavbar title="Salary Slips" breadcrumb="Salary Slips" />

                <PageBody as="section" className={styles["main-content"]}>
                    <SalarySlipTable userRole={userRole} />
                </PageBody>
            </main>
        </div>
    );
}

export default SalarySlips;
