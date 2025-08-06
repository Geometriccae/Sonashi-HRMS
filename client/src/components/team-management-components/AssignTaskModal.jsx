import React, { useState } from "react";
import styles from "./AssignTaskModal.module.css";
import InputField from "../../components/InputField";
import DatePickerModal from "../DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import user from "../../assets/dashboard/user.svg";

function AssignTaskModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    eventName: "",
    eventType: "",
    date: "",
    time: "",
    notes: "",
    link: "",
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    console.log("Event data:", formData);
    // Add your event creation logic here
    onClose();
  };

  const handleDateIconClick = () => {
    setIsDatePickerOpen(true);
  };

  const handleDatePickerClose = () => {
    setIsDatePickerOpen(false);
  };

  const handleDateSelect = (selectedDate) => {
    const formattedDate = selectedDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    handleInputChange("date", formattedDate);
    setIsDatePickerOpen(false);
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div
      className={styles["create-event-modal-backdrop"]}
      onClick={handleBackdropClick}
    >
      <div className={styles["create-event-modal"]}>
        <div className={styles["modal-event-content"]}>
          <div className={styles["modal-eventheader"]}>
            <h2 className={styles["modal-title"]}>Assign Task</h2>
            <p className={styles["modal-subtitle"]}>
              Assign a task to RameshMohan
            </p>
          </div>

          <div className={styles["form-fields"]}>
            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Event Name *</label>
              <div className={styles["input-wrapper"]}>
                <input
                  type="text"
                  className={styles["form-input"]}
                  placeholder="Eg. Client Meeting"
                  value={formData.eventName}
                  onChange={(e) =>
                    handleInputChange("eventName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Event Type *</label>
              <div className={styles["select-wrapper"]}>
                <select
                  className={styles["form-select"]}
                  value={formData.eventType}
                  onChange={(e) =>
                    handleInputChange("eventType", e.target.value)
                  }
                >
                  <option value="">Select type</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="presentation">Presentation</option>
                  <option value="workshop">Workshop</option>
                </select>
                <div className={styles["select-icon"]}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="#98A1B0"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Select a date *</label>
              <div className={styles["date-wrapper"]}>
                <input
                  type="text"
                  className={`${styles["form-input"]} ${styles["has-icon"]}`}
                  value={formatDateForDisplay(formData.date)}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  placeholder="MM/DD/YYYY"
                  readOnly
                />
                <div
                  className={styles["input-icon"]}
                  onClick={handleDateIconClick}
                >
                  <img
                    src={calendarIcon}
                    alt="Calendar"
                    width="16"
                    height="16"
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Select a Time *</label>
              <div className={styles["time-wrapper"]}>
                <input
                  type="time"
                  className={`${styles["form-input"]} ${styles["has-icon"]}`}
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                />
                {/* <div className={styles["input-icon"]}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_2031_8954)">
                      <path d="M8.00016 4.00016V8.00016L10.6668 9.3335M14.6668 8.00016C14.6668 11.6821 11.6821 14.6668 8.00016 14.6668C4.31826 14.6668 1.3335 11.6821 1.3335 8.00016C1.3335 4.31826 4.31826 1.3335 8.00016 1.3335C11.6821 1.3335 14.6668 4.31826 14.6668 8.00016Z" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_2031_8954">
                        <rect width="16" height="16" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </div> */}
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Add a Team Member</label>
              <div className={styles["select-wrapper"]}>
                <select
                  className={styles["form-select"]}
                  value={formData.eventType}
                  onChange={(e) =>
                    handleInputChange("eventType", e.target.value)
                  }
                >

                  <option value="">Select team member</option>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="presentation">Presentation</option>
                  <option value="workshop">Workshop</option>
                </select>
                <div className={styles["select-icon"]}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="#98A1B0"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Add notes</label>
              <div className={styles["input-wrapper"]}>
                <input
                  type="text"
                  className={styles["form-input"]}
                  placeholder="Eg. Client Meeting"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                />
              </div>
            </div>

            <div className={styles["input-field"]}>
              <label className={styles["field-label"]}>Attach Link</label>
              <div className={styles["input-wrapper"]}>
                <input
                  type="text"
                  className={styles["form-input"]}
                  placeholder="www.google.com"
                  value={formData.link}
                  onChange={(e) => handleInputChange("link", e.target.value)}
                />
              </div>
            </div>

            <div className={styles["color-selector"]}>
              <svg
                width="132"
                height="24"
                viewBox="0 0 132 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="11"
                  stroke="#FF9500"
                  strokeWidth="2"
                />
                <circle
                  cx="48"
                  cy="12"
                  r="11"
                  stroke="#007AFF"
                  strokeWidth="2"
                />
                <circle
                  cx="84"
                  cy="12"
                  r="11"
                  stroke="#34C759"
                  strokeWidth="2"
                />
                <circle
                  cx="120"
                  cy="12"
                  r="11"
                  stroke="#30B0C7"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className={styles["task-modal-actions"]}>
          <button className={styles["event-cancel-button"]} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles["event-attach-button"]}
            onClick={handleSubmit}
          >
            Attach Files
          </button>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={handleDatePickerClose}
        onSelectDate={handleDateSelect}
        selectedDate={formData.date}
      />
    </div>
  );
}

export default AssignTaskModal;
