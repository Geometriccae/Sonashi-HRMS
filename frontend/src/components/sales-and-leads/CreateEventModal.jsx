// import React, { useState } from "react";
// import axios from "axios";
// import "./CreateEventModal.css";
// import InputField from "../InputField";
// import DatePickerModal from "../DatePickerModal";
// import calendarIcon from "../../assets/dashboard/calendar.svg";
// import { createEvent } from "../../services/CreateEventService";

// function CreateEventModal({ isOpen, onClose, clientId, onEventAdded }) {

//   const [formData, setFormData] = useState({
//     eventName: "",
//     eventType: "",
//     date: "",
//     time: "",
//     notes: "",
//     link: "",
//     assignedTeamMember: ""
//   });

//   const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

//   if (!isOpen) return null;

//   const handleBackdropClick = (e) => {
//     if (e.target === e.currentTarget) {
//       onClose();
//     }
//   };

//   const handleInputChange = (field, value) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: value
//     }));
//   };

//   const handleSubmit = async () => {
//     try {
//       const response = await axios.post(
//         `http://localhost:5000/api/clients/${clientId}/events`,
//         formData
//       );
//       console.log("Event saved:", response.data);

//       // Optional: notify parent
//       if (onEventAdded) {
//         onEventAdded(response.data.client.events);
//       }

//       onClose();
//     } catch (error) {
//       console.error("Error saving event:", error);
//     }
//   };

//   const handleDateIconClick = () => {
//     setIsDatePickerOpen(true);
//   };

//   const handleDatePickerClose = () => {
//     setIsDatePickerOpen(false);
//   };

//   const handleDateSelect = (selectedDate) => {
//     const formattedDate = selectedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
//     handleInputChange('date', formattedDate);
//     setIsDatePickerOpen(false);
//   };

//   const formatDateForDisplay = (dateString) => {
//     if (!dateString) return "";
//     const date = new Date(dateString);
//     return date.toLocaleDateString('en-US', {
//       month: '2-digit',
//       day: '2-digit',
//       year: 'numeric'
//     });
//   };

//   return (
//     <div className="create-event-modal-backdrop" onClick={handleBackdropClick}>
//       <div className="create-event-modal">
//         <div className="modal-event-content">
//           <div className="modal-eventheader">
//             <h2 className="modal-title">Create Event</h2>
//             <p className="modal-subtitle">Select your event type, add labels and links.</p>
//           </div>

//           <div className="form-fields">
//             <div className="input-field">
//               <label className="field-label">Event Name *</label>
//               <div className="input-wrapper">
//                 <input
//                   type="text"
//                   className="form-input"
//                   placeholder="Eg. Client Meeting"
//                   value={formData.eventName}
//                   onChange={(e) => handleInputChange('eventName', e.target.value)}
//                 />
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Event Type *</label>
//               <div className="select-wrapper">
//                 <select
//                   className="form-select"
//                   value={formData.eventType}
//                   onChange={(e) => handleInputChange('eventType', e.target.value)}
//                 >
//                   <option value="">Select type</option>
//                   <option value="meeting">Meeting</option>
//                   <option value="call">Call</option>
//                   <option value="presentation">Presentation</option>
//                   <option value="workshop">Workshop</option>
//                 </select>

//                 <div className="select-icon">
//                   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
//                     <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </div>
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Select a date *</label>
//               <div className="date-wrapper">
//                 <input
//                   type="text"
//                   className="form-input has-icon"
//                   value={formatDateForDisplay(formData.date)}
//                   onChange={(e) => handleInputChange('date', e.target.value)}
//                   placeholder="MM/DD/YYYY"
//                   readOnly
//                 />
//                 <div className="input-icon" onClick={handleDateIconClick}>
//                   <img
//                     src={calendarIcon}
//                     alt="Calendar"
//                     width="16"
//                     height="16"
//                     style={{cursor: 'pointer'}}
//                   />
//                 </div>
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Select a Time *</label>
//               <div className="time-wrapper">
//                 <input
//                   type="time"
//                   className="form-input has-icon"
//                   value={formData.time}
//                   onChange={(e) => handleInputChange('time', e.target.value)}

//                 />
//                 {/* <div className="input-icon">
//                   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
//                     <g clipPath="url(#clip0_2031_8954)">
//                       <path d="M8.00016 4.00016V8.00016L10.6668 9.3335M14.6668 8.00016C14.6668 11.6821 11.6821 14.6668 8.00016 14.6668C4.31826 14.6668 1.3335 11.6821 1.3335 8.00016C1.3335 4.31826 4.31826 1.3335 8.00016 1.3335C11.6821 1.3335 14.6668 4.31826 14.6668 8.00016Z" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                     </g>
//                     <defs>
//                       <clipPath id="clip0_2031_8954">
//                         <rect width="16" height="16" fill="white"/>
//                       </clipPath>
//                     </defs>
//                   </svg>
//                 </div> */}
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Assign a Team Member</label>
//               <div className="select-wrapper">
//                 <select
//                   className="form-select"
//                   value={formData.assignedTeamMember}
//                   onChange={(e) => handleInputChange('assignedTeamMember', e.target.value)}
//                 >
//                   <option value="">Select team member</option>
//                   <option value="Venkat">Venkatesh</option>
//                   <option value="Mukesh">Mukesh</option>
//                   <option value="Varun">Varun</option>
//                   <option value="Dinesh">Dinesh</option>
//                 </select>

//                 <div className="select-icon">
//                   <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
//                     <path d="M4 6L8 10L12 6" stroke="#98A1B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </div>
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Add notes</label>
//               <div className="input-wrapper">
//                 <input
//                   type="text"
//                   className="form-input"
//                   placeholder="Eg. Client Meeting"
//                   value={formData.notes}
//                   onChange={(e) => handleInputChange('notes', e.target.value)}
//                 />
//               </div>
//             </div>

//             <div className="input-field">
//               <label className="field-label">Attach Link</label>
//               <div className="input-wrapper">
//                 <input
//                   type="text"
//                   className="form-input"
//                   placeholder="www.google.com"
//                   value={formData.link}
//                   onChange={(e) => handleInputChange('link', e.target.value)}
//                 />
//               </div>
//             </div>

//             <div className="color-selector">
//               <svg width="132" height="24" viewBox="0 0 132 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//                 <circle cx="12" cy="12" r="11" stroke="#FF9500" strokeWidth="2"/>
//                 <circle cx="48" cy="12" r="11" stroke="#007AFF" strokeWidth="2"/>
//                 <circle cx="84" cy="12" r="11" stroke="#34C759" strokeWidth="2"/>
//                 <circle cx="120" cy="12" r="11" stroke="#30B0C7" strokeWidth="2"/>
//               </svg>
//             </div>
//           </div>
//         </div>

//         <div className="modal-actions">
//           <button className="event-cancel-button" onClick={onClose}>
//             Cancel
//           </button>
//           <button className="event-attach-button" onClick={handleSubmit}>
//             Add Event
//           </button>
//         </div>
//       </div>

//       <DatePickerModal
//         isOpen={isDatePickerOpen}
//         onClose={handleDatePickerClose}
//         onSelectDate={handleDateSelect}
//         selectedDate={formData.date}
//       />
//     </div>
//   );
// }

// export default CreateEventModal;
import React, { useState } from "react";
import "./CreateEventModal.css";
import DatePickerModal from "../DatePickerModal";
import calendarIcon from "../../assets/dashboard/calendar.svg";
import { createEvent } from "../../services/CreateEventService"; // We'll create this

function CreateEventModal({ isOpen, onClose, clientId, onEventCreated }) {
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
      
      const eventData = {
        ...formData,
        clientId,
        date: new Date(formData.date), 
        time: formData.time,
      };

      const createdEvent = await createEvent(clientId, eventData);
      console.log("Event created:", createdEvent);

      if (onEventCreated) {
        onEventCreated(createdEvent);
      }

      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event. Please try again.");
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
            <h2 className="modal-title">Create Event</h2>
            <p className="modal-subtitle">
              Select your event type, add labels and links.
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

            {/* <div className="input-field">
              <label className="field-label">Add notes</label>
              <div className="input-wrapper">
                <textarea
                  className="form-input"
                  placeholder="Add event notes..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows="3"
                />
              </div>
            </div> */}

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
          checked={formData.color === color}
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
            {isLoading ? "Creating..." : "Add Event"}
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

export default CreateEventModal;
