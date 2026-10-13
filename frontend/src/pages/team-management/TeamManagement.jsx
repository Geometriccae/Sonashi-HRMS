import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Row, Col, Card, Statistic, ConfigProvider, Typography } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import styles from "./TeamManagement.module.css";
import Side from "../sidebar/Sidebar";
import TopNavbar, { PageBody, pageLayoutStyles } from "../../components/TopNavbar";
import TeamMembersTable from "../../components/team-management-components/TeamMembersTable";
import EmployeeService from "../../services/EmployeeService";

const { Text } = Typography;

const statCards = [
  {
    key: "total",
    title: "Total Employees",
    subtitle: "Active team members",
    icon: <TeamOutlined />,
    color: "#007aff",
    bg: "linear-gradient(135deg, #e8f4ff 0%, #f0f8ff 100%)",
    field: "totalEmployees",
    listFilter: "All",
  },
  {
    key: "active",
    title: "Active Employees",
    subtitle: "Present in workspace",
    icon: <UserOutlined />,
    color: "#52c41a",
    bg: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
    field: "activeEmployees",
    listFilter: "Active",
  },
  {
    key: "inactive",
    title: "Inactive Employees",
    subtitle: "Offboarded or absent",
    icon: <UserDeleteOutlined />,
    color: "#fa8c16",
    bg: "linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%)",
    field: "inactiveEmployees",
    listFilter: "Inactive",
  },
];

function TeamManagement() {
  const [stats, setStats] = useState({
    attendancePercentage: 0,
    totalAssignedProjects: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
  });

  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchStats();
  }, []);

  // Same URL filter the employee list already uses (?filter=Active|Inactive|All).
  const handleStatCardClick = (listFilter) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("page");
      if (listFilter === "Active") next.delete("filter");
      else next.set("filter", listFilter);
      return next;
    }, { replace: true });
    fetchStats({ force: true });
  };

  const fetchStats = async ({ force = false } = {}) => {
    try {
      const employeeStats = await EmployeeService.getEmployeeStats({ basic: true, force });
      setStats({
        attendancePercentage: 0,
        totalAssignedProjects: employeeStats.totalAssignedProjects || 0,
        totalEmployees: employeeStats.totalEmployees || 0,
        activeEmployees: employeeStats.activeEmployees || 0,
        inactiveEmployees: employeeStats.inactiveEmployees || 0,
      });
    } catch (error) {
      console.error("Error fetching team stats:", error);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#007aff",
          borderRadius: 12,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        },
      }}
    >
      <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
        <Side />
        <main className={pageLayoutStyles.pageMain}>
          <TopNavbar title="Team Management" breadcrumb="Team Management" />

          <PageBody>
            <div className={styles["page-content"]}>
            <section className={styles["stats-container"]}>
              <Row gutter={[16, 16]} style={{ width: "100%" }}>
                {statCards.map((card) => (
                  <Col xs={24} sm={24} md={8} key={card.key}>
                    <Card
                      bordered={false}
                      role="button"
                      tabIndex={0}
                      title={`Show ${card.title}`}
                      onClick={() => handleStatCardClick(card.listFilter)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleStatCardClick(card.listFilter);
                        }
                      }}
                      style={{
                        background: card.bg,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                        height: "100%",
                        cursor: "pointer",
                      }}
                      styles={{ body: { padding: "20px 24px" } }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
                            {card.title}
                          </Text>
                          <Statistic
                            value={stats[card.field]}
                            valueStyle={{
                              fontSize: 36,
                              fontWeight: 700,
                              color: "#161616",
                              lineHeight: 1.2,
                              marginTop: 4,
                            }}
                          />
                          <Text style={{ color: card.color, fontSize: 13, fontWeight: 600 }}>
                            {card.subtitle}
                          </Text>
                        </div>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            color: card.color,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                          }}
                        >
                          {card.icon}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </section>

            <section className={styles["main-content"]}>
              <TeamMembersTable />
            </section>
            </div>
          </PageBody>
        </main>
      </div>
    </ConfigProvider>
  );
}

export default TeamManagement;
