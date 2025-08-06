import React, { useState } from "react";
import "./AddClient.css";
import InputField from "../components/InputField";
import ProgressSteps from "../components/ProgressSteps";
import ProfilePhotoUpload from "../components/ProfilePhotoUpload";

function AddClient() {
  const [formData, setFormData] = useState({
    firstName: "",
    clientType: "",
    cargoType: "Bulk Cargo",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePrevious = () => {
    // Handle previous step logic
    console.log("Previous step");
  };

  const handleNext = () => {
    // Handle next step logic
    console.log("Next step");
  };

  const handlePhotoUpload = () => {
    // Handle photo upload logic
    console.log("Upload photo");
  };

  const handleClose = () => {
    // Handle close dialog
    console.log("Close dialog");
  };

  const clientTypeOptions = [
    { value: "client", label: "Client" },
    { value: "lead", label: "Lead" },
  ];

  const cargoTypeOptions = [
    { value: "bulk", label: "Bulk Cargo" },
    { value: "container", label: "Container" },
    { value: "liquid", label: "Liquid Cargo" },
  ];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap"
        rel="stylesheet"
      />
      <div className="add-client-container">
        <div className="add-client-header">
          <h1 className="add-client-title">Add new Client</h1>
          <button className="close-button" onClick={handleClose}>
            <div className="close-icon" />
          </button>
        </div>

        <ProgressSteps currentStep={1} />

        <div className="add-client-content">
          <ProfilePhotoUpload onUpload={handlePhotoUpload} />

          <div className="form-fields-grid">
            <InputField
              label="First Name"
              placeholder="First Name"
              required
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
            />

            <InputField
              label="Client/Lead"
              placeholder="Select type"
              isDropdown
              options={clientTypeOptions}
              value={formData.clientType}
              onChange={(e) => handleInputChange("clientType", e.target.value)}
            />

            <InputField
              label="Cargo Type"
              placeholder="Select cargo type"
              isDropdown
              options={cargoTypeOptions}
              value={formData.cargoType}
              onChange={(e) => handleInputChange("cargoType", e.target.value)}
            />

            <InputField
              label="Last Name"
              placeholder="Last Name"
              required
              hasError={false}
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
            />

            <InputField
              label="Email"
              placeholder="Email"
              required
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
            />

            <InputField
              label="Phone"
              placeholder="Phone"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />

            <InputField
              label="Company"
              placeholder="Company"
              required
              value={formData.company}
              onChange={(e) => handleInputChange("company", e.target.value)}
            />

            <InputField
              label="Address"
              placeholder="Address"
              required
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
            />

            <InputField
              label="City"
              placeholder="City"
              required
              value={formData.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
            />

            <InputField
              label="State"
              placeholder="State"
              required
              value={formData.state}
              onChange={(e) => handleInputChange("state", e.target.value)}
            />

            <InputField
              label="ZIP Code"
              placeholder="ZIP Code"
              required
              value={formData.zipCode}
              onChange={(e) => handleInputChange("zipCode", e.target.value)}
            />

            <InputField
              label="Country"
              placeholder="Country"
              required
              value={formData.country}
              onChange={(e) => handleInputChange("country", e.target.value)}
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="button-secondary" onClick={handlePrevious}>
            Prev
          </button>
          <button className="button-primary" onClick={handleNext}>
            Next
          </button>
        </div>
      </div>
    </>
  );
}

export default AddClient;
