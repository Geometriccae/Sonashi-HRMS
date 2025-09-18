import React, { useState, useEffect } from "react";
import styles from "./DashboardOverview.module.css";
import { formatDate } from "../utils/dateUtils";
import ConversionDataChart from "./ConversionDataChart";

// Import available icons
import arrowupright from "../assets/dashboard/arrow-up-right.svg";
import settings from "../assets/dashboard/settings.svg";
import calendar from "../assets/dashboard/calendar.svg";
import plus from "../assets/dashboard/plus.svg";
import weather from "../assets/dashboard/weather.png";
import threedot from "../assets/dashboard/3dot.svg";
import smile_emoji from "../assets/dashboard/bxs_smile.svg";
import quote_solid from "../assets/dashboard/quote-solid.svg";
import Ellipse_dot from "../assets/dashboard/Ellipse27.svg";

function DashboardOverview() {
  const [username, setUsername] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "User");

    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formatted = now.toLocaleDateString("en-US", options);
    setCurrentDate(`It's ${formatted}`);
  }, []);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className={styles.dashboardOverview}>
      {/* Header Section */}
      <div className={styles.headerRow}>
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeText}>
              <div className={styles.greeting}>
                {getTimeGreeting()}, {username}
              </div>
              <div className={styles.date}>{currentDate}</div>
            </div>
            <div className={styles.welcomeImage}>
              <div className={styles.imagePlaceholder}>
                <img src={weather} alt="" height={80} width={100} />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.metricsRow}>
          {/* Total Payables Card */}
          <div className={styles.metricCard}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Payables</div>
              <div className={styles.metricValue}>$13,375</div>
            </div>
            <div className={styles.metricDetails}>
              <img src={threedot} alt="trend" className={styles.trendIcon} />
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span className={styles.changeIcon}>↗</span>
                  <span className={styles.grow}>04%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Receivables Card */}
          <div className={styles.metricCard}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Receivables</div>
              <div className={styles.metricValue}>$343,130</div>
            </div>
            <div className={styles.metricDetails}>
              <img src={threedot} alt="trend" className={styles.trendIcon} />
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span className={styles.changeIcon}>↗</span>
                  <span className={styles.grow}>1.3%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Profit Card */}
          <div className={`${styles.metricCard} ${styles.profitCard}`}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Profit this month</div>
              <div className={styles.metricValue}>$220,420</div>
            </div>
            <div className={styles.metricDetails}>
              <img src={threedot} alt="trend" className={styles.trendIcon} />
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span
                    className={styles.changeIcon}
                    style={{ color: "white" }}
                  >
                    ↗
                  </span>
                  <span style={{ color: "white" }}>20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Row */}
      <div className={styles.contentRow}>
        {/* Lead Conversion Section */}
        <div className={styles.leadConversionCard}>
          <div className={styles.cardHeader}>
            <h3>Lead Conversion</h3>
            <button className={styles.actionButton}>
              <img src={arrowupright} alt="settings" />
            </button>
          </div>

          <div className={styles.conversionStats}>
            <div className={styles.statsRow}>
              <div className={styles.percentageValue}>58%</div>
              <div className={styles.changeChip}>
                <span className={styles.changeIcon}>↗</span>
                <span className={styles.grow}>2.34%</span>
              </div>
            </div>
            <div className={styles.description}>
              78 task points achieved in the last 30 days! Good Job!
            </div>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill}></div>
            </div>
            <div className={styles.progressLabels}>
              <span>Progress</span>
              <span>
                <strong>580</strong> / 1000
              </span>
            </div>
          </div>

          <div className={styles.activitySection}>
            <h4>Conversion attempts this week</h4>
            <div className={styles.activityGrid}>
              {[...Array(5)].map((_, rowIndex) => (
                <div key={rowIndex} className={styles.activityRow}>
                  {[...Array(17)].map((_, colIndex) => {
                    const activity = Math.random();
                    let activityClass = styles.activityEmpty;
                    if (activity > 0.7) activityClass = styles.activityHigh;
                    else if (activity > 0.4)
                      activityClass = styles.activityMedium;
                    else if (activity > 0.2) activityClass = styles.activityLow;

                    return (
                      <div
                        key={colIndex}
                        className={`${styles.activityCell} ${activityClass}`}
                      ></div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conversion Data Chart */}
        <ConversionDataChart />
      </div>

      {/* Bottom Row */}
      <div className={styles.bottomRow}>
        {/* Calendar Section */}
        <div className={styles.calendarCard}>
          <div className={styles.cardHeaderCalendar}>
            <h3>Your Calendar</h3>
            <button className={styles.actionButton}>
              <img src={arrowupright} alt="calendar" />
            </button>
          </div>

          <div className={styles.calendarControls}>
            <div className={styles.viewToggle}>
              <button className={styles.toggleButton}>Day</button>
              <button className={`${styles.toggleButton} ${styles.active}`}>
                Week
              </button>
              <button className={styles.toggleButton}>Month</button>
            </div>
          </div>

          <div className={styles.calendarContent}>
            <div className={styles.timeSlots}>
              <div className={styles.timeHeader}>
                <div>Morning</div>
                <div>Lunch</div>
              </div>

              <div className={styles.timeGrid}>
                {[
                  "09:00",
                  "09:30",
                  "10:00",
                  "10:30",
                  "11:00",
                  "11:30",
                  "12:00",
                  "12:30",
                  "13:00",
                  "13:30",
                  "14:00",
                  "14:30",
                  "15:00",
                ].map((time) => (
                  <div key={time} className={styles.timeSlot}>
                    <div>{time}</div>
                    <div className={styles.timeLine}></div>
                  </div>
                ))}
              </div>

              <div className={styles.events}>
                <div className={`${styles.event} ${styles.orangeEvent}`}>
                  <div className={styles.eventBadge}>Meeting</div>
                  <div className={styles.eventTitle}>
                    Meeting with dev team on Issue #47
                  </div>
                  <div className={styles.eventLink}>
                    https://meet.google.com/dic-frg-svu
                  </div>
                </div>

                <div className={`${styles.event} ${styles.blueEvent}`}>
                  <div className={styles.eventBadge}>Meeting</div>
                  <div className={styles.eventTitle}>
                    Team Lunch with Client to propose new ideas for...
                  </div>
                  <div className={styles.eventLink}>
                    https://meet.google.com/dic-frg-svu
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className={styles.tasksCard}>
          <div className={styles.cardHeader}>
            <h3>Today's Tasks</h3>
            <button className={styles.actionButton}>
              <img src={arrowupright} alt="add task" />
            </button>
          </div>

          <div className={styles.tasksList}>
            <div className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <h4>Complete shipment for Aurum Central</h4>
                <p>Aurum Central</p>
              </div>
              <div className={styles.taskAvatar}>
                <img src={quote_solid} alt="" />
              </div>
            </div>
            <div className={styles.taskDivider}></div>
            <div className={styles.taskMeta}>
              <div className={styles.taskAvatars}>
                {/* Multiple avatar placeholders */}
                <div className={styles.avatarStack}>
                  <div className={styles.avatar}>U1</div>
                  <div className={styles.avatar}>U2</div>
                  <div className={styles.avatar}>U3</div>
                </div>
              </div>
              <div className={styles.taskTime}>
                <span className={styles.today}>Today</span>
                <span className={styles.timeRange}>11:00 AM - 12:30 PM</span>
              </div>
            </div>

            <div className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <h4>Legal Review for new clients</h4>
                <p>Internal Affairs</p>
              </div>
              <div className={styles.taskAvatar1}>
                <img src={quote_solid} alt="" />
              </div>
            </div>
            <div className={styles.taskDivider}></div>
            <div className={styles.taskMeta}>
              <div className={styles.taskAvatars}></div>
              <div className={styles.taskTime}>
                <span className={styles.today}>Today</span>
                <span className={styles.timeRange}>2:00 PM - 3:30 PM</span>
              </div>
            </div>

            <div className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <h4>Legal Review for new clients</h4>
                <p>Internal Affairs</p>
              </div>
              <div className={styles.taskAvatar1}>
                <img src={quote_solid} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
