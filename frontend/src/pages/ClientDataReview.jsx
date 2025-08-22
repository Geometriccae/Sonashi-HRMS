import React from "react";
import "./ClientDataReview.css";
import ProgressSteps from "../components/ProgressSteps";

function ClientDataReview() {
  const handleClose = () => {
    // Handle close dialog
    console.log("Close dialog");
  };

  const handleEditPhoto = () => {
    // Handle photo edit
    console.log("Edit photo");
  };

  const handlePrevious = () => {
    // Handle previous step logic
    console.log("Previous step");
  };

  const handleFinish = () => {
    // Handle finish logic
    console.log("Finish");
  };

  // Sample client data - this would typically come from props or state
  const clientData = [
    [
      { label: "First Name", value: "Ryan" },
      { label: "Last Name", value: "Johnson" },
      { label: "Email", value: "ryan@example.com" },
    ],
    [
      { label: "Phone", value: "+1 (555) 123-4567" },
      { label: "Company", value: "GRS Shipping" },
      { label: "Client Type", value: "Corporate" },
    ],
    [
      { label: "Address", value: "123 Main Street" },
      { label: "City", value: "New York" },
      { label: "State", value: "NY" },
    ],
    [
      { label: "ZIP Code", value: "10001" },
      { label: "Country", value: "United States" },
      { label: "Cargo Type", value: "Container" },
    ],
  ];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap"
        rel="stylesheet"
      />
      <div className="client-review-container">
        <div className="client-review-header">
          <h1 className="client-review-title">Add new Client</h1>
          <button className="close-button" onClick={handleClose}>
            <div className="close-icon" />
          </button>
        </div>

        <ProgressSteps currentStep={3} />

        <div className="company-profile-section">
          <div className="company-info">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/6c9e546530e43d261ce6d1abbca51b7fb531a632?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
              alt="Company logo"
              className="company-logo"
            />
            <div className="company-name">GRS Shipping</div>
          </div>
          <button className="edit-photo-button" onClick={handleEditPhoto}>
            <span className="edit-photo-text">Edit Photo</span>
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/8dcd0639b791b1b115321ae13fb57120a1f0c09b?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
              alt="Edit icon"
              className="edit-photo-icon"
            />
          </button>
        </div>

        <div className="client-data-section">
          {clientData.map((row, rowIndex) => (
            <div key={rowIndex} className="data-row">
              {row.map((field, fieldIndex) => (
                <div key={fieldIndex} className="data-field">
                  <div className="field-label">{field.label}</div>
                  <div className="field-value">{field.value}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="review-actions">
          <button className="button-secondary" onClick={handlePrevious}>
            Prev
          </button>
          <button className="button-primary" onClick={handleFinish}>
            Finish
          </button>
        </div>
      </div>
    </>
  );
}

export default ClientDataReview;
