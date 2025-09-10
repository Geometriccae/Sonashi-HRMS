import React, { useState, useEffect } from "react";
import "./CreateEventModal.css"; // Reusing the same styles
import DatePickerModal from "../DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import { updateEvent } from "../../services/CreateEventService";

function EditEventModal({ isOpen, onClose, clientId, eventData, onEventUpdated }) {
  const [formData, setFormData] = useState({
    eventName: "",
    eventType: "",
    date: "",
    time: "",
    assignedTeamMember: "",
    notes: "",
    link: "",
    color: "#FF9500",
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Populate form data when eventData changes
  useEffect(() => {
    if (eventData && isOpen) {
      const eventDate = new Date(eventData.start);
      const timeString = eventDate.toTimeString().slice(0, 5); // HH:MM format
      const dateString = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      setFormData({
        eventName: eventData.title || "",
        eventType: eventData.eventType || "",
        date: dateString,
        time: timeString,
        assignedTeamMember: eventData.assignedTeamMember || "",
        notes: eventData.notes || "",
        link: eventData.link || "",
        color: eventData.color || "#FF9500",
      });
    }
  }, [eventData, isOpen]);

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

  const handleSubmit = async () => {
    if (
      !formData.eventName ||
      !formData.eventType ||
      !formData.date ||
      !formData.time
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const updatedEventData = {
        ...formData,
        clientId,
        date: new Date(formData.date),
        time: formData.time,
      };

      const updatedEvent = await updateEvent(clientId, eventData.id, updatedEventData);
      console.log("Event updated:", updatedEvent);

      if (onEventUpdated) {
        onEventUpdated(updatedEvent);
      }

      onClose();
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateIconClick = () => {
    setIsDatePickerOpen(true);
  };

  const handleDatePickerClose = () => {
    setIsDatePickerOpen(false);
  };

  const handleDateSelect = (selectedDate) => {
    const formattedDate = selectedDate.toISOString().split("T")[0];
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

  const handleColorSelect = (color) => {
    handleInputChange("color", color);
  };

  return (
    <div className="create-event-modal-backdrop" onClick={handleBackdropClick}>
      <div className="create-event-modal">
        <div className="modal-event-content">
          <div className="modal-eventheader">
            <h2 className="modal-title">Edit Event</h2>
            <p className="modal-subtitle">
              Update your event details, labels and links.
            </p>
          </div>

          <div className="form-fields">
            <div className="input-field">
              <label className="field-label">Event Name *</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Eg. Client Meeting"
                  value={formData.eventName}
                  onChange={(e) =>
                    handleInputChange("eventName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Event Type *</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
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
                  <option value="other">Other</option>
                </select>
                <div className="select-icon">
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

            <div className="input-field">
              <label className="field-label">Select a date *</label>
              <div className="date-wrapper">
                <input
                  type="text"
                  className="form-input has-icon"
                  value={formatDateForDisplay(formData.date)}
                  placeholder="MM/DD/YYYY"
                  readOnly
                />
                <div className="input-icon" onClick={handleDateIconClick}>
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

            <div className="input-field">
              <label className="field-label">Select a Time *</label>
              <div className="time-wrapper">
                <input
                  type="time"
                  className="form-input has-icon"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Assign a Team Member</label>
              <div className="select-wrapper">
                <select
                  className="form-select"
                  value={formData.assignedTeamMember}
                  onChange={(e) =>
                    handleInputChange("assignedTeamMember", e.target.value)
                  }
                >
                  <option value="">Select team member</option>
                  <option value="Venkat">Venkatesh</option>
                  <option value="Mukesh">Mukesh</option>
                  <option value="Varun">Varun</option>
                  <option value="Dinesh">Dinesh</option>
                </select>

                <div className="select-icon">
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

            <div className="input-field">
              <label className="field-label">Add notes</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  placeholder="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                />
              </div>
            </div>

            <div className="input-field">
              <label className="field-label">Attach Link</label>
              <div className="input-wrapper">
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.example.com"
                  value={formData.link}
                  onChange={(e) => handleInputChange("link", e.target.value)}
                />
              </div>
            </div>

            {/* <div className="color-selector">
              <label className="field-label">Event Color</label>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                {["#FF9500", "#007AFF", "#34C759", "#30B0C7"].map((color) => (
                  <div
                    key={color}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      border:
                        formData.color === color
                          ? "2px solid #000"
                          : "2px solid transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div> */}

            <div className="color-selector">
  <label className="field-label">Event Color</label>
  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
    {["#FF9500", "#007AFF", "#34C759", "#30B0C7"].map((color) => (
      <label
        key={color}
        style={{
          display: "inline-block",
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          border: `3px solid ${formData.color === color ? "#000" : color}`,
          cursor: "pointer",
          position: "relative",
        }}
      >
        <input
          type="radio"
          name="eventColor"
          value={color}
          style={{ display: "none" }}
          checked={formData.color === color}   // ✅ pre-selects saved color
          onChange={() => handleColorSelect(color)}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundColor: formData.color === color ? color : "transparent",
            transition: "0.2s",
          }}
        />
      </label>
    ))}
  </div>
</div>

          </div>
        </div>



        <div className="modal-actions">
          <button
            className="event-cancel-button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="event-attach-button"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Event"}
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

export default EditEventModal;
