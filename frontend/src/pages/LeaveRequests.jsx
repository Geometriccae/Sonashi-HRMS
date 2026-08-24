import React, { useState, useEffect } from "react";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";
import LeaveRequestTable from "../components/leave-request/LeaveRequestTable";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import leaveRequestService from "../services/LeaveRequestService";
import UserService from "../services/UserService";

function LeaveRequests() {
    const [userRole, setUserRole] = useState("");
    const [leaveBalance, setLeaveBalance] = useState("--");
    const [metrics, setMetrics] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

    useEffect(() => {
        setUserRole(localStorage.getItem("role") || "");
        fetchLeaveBalance();
    }, []);

    const fetchLeaveBalance = async () => {
        try {
            const user = await UserService.getMe();
            setLeaveBalance(user.leaveBalance !== undefined ? user.leaveBalance : 21);
        } catch (error) {
            console.error("Error fetching leave balance:", error);
        }
    };

    /** Derive KPI cards from the same leave list the table already fetched (no second API call). */
    const applyMetricsFromData = (data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        const total = list.length;
        const pending = list.filter((r) => r.status === "Pending").length;
        const approved = list.filter((r) => r.status === "Approved").length;
        const rejected = list.filter((r) => r.status === "Rejected").length;
        setMetrics({ total, pending, approved, rejected });
        setIsLoadingMetrics(false);
    };

    const fetchMetrics = async (maybeData) => {
        if (Array.isArray(maybeData) || (maybeData && Array.isArray(maybeData.data))) {
            applyMetricsFromData(maybeData);
            return;
        }
        setIsLoadingMetrics(true);
        try {
            const data = await leaveRequestService.getLeaveRequests();
            applyMetricsFromData(data);
        } catch (error) {
            console.error("Error fetching leave metrics:", error);
            setIsLoadingMetrics(false);
        }
    };

    return (
        <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
            <Side />

            <main className={`${styles["main-container"]} ${pageLayoutStyles.pageMain}`}>
                <TopNavbar title="Leave Management" breadcrumb="Leave Management" />

                <PageBody>
                <section className={styles.cardcontainer}>
                    <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Rejected</h4>
                            </div>
                            <h2 style={{ color: "#dc2626" }}>{isLoadingMetrics ? "--" : metrics.rejected}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Total Requests</h4>
                            </div>
                            <h2>{isLoadingMetrics ? "--" : metrics.total}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Pending</h4>
                            </div>
                            <h2 style={{ color: "#f97316" }}>{isLoadingMetrics ? "--" : metrics.pending}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Approved</h4>
                            </div>
                            <h2 style={{ color: "#16a34a" }}>{isLoadingMetrics ? "--" : metrics.approved}</h2>
                        </div>
                    </div>
                </section>

                <section className={styles["main-content"]}>
                    <LeaveRequestTable onUpdate={fetchMetrics} />
                </section>
                </PageBody>
            </main>
        </div>
    );
}

export default LeaveRequests;
