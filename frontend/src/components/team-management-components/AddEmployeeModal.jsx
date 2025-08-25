import React, { useState } from "react";
import "./AddEmployeeModal.css";
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";

function AddEmployeeModal({ isOpen, onClose, onSubmit }) {
  const [currentStep, setCurrentStep] = useState(1);
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

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepClick = (stepId) => {
    setCurrentStep(stepId);
  };

  const handleFinish = () => {
    onSubmit(formData);
    onClose();
    setCurrentStep(1);
    setFormData({
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
  };

  const handlePhotoUpload = () => {
    console.log("Upload photo");
  };

  const handleEditPhoto = () => {
    console.log("Edit photo");
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
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
        );

      case 2:
        return (
          <div className="billing-content">
            
          </div>
        );

      case 3:
        const clientData = [
          [
            { label: "First Name", value: formData.firstName || "Ryan" },
            { label: "Last Name", value: formData.lastName || "Johnson" },
            { label: "Email", value: formData.email || "ryan@example.com" },
          ],
          [
            { label: "Phone", value: formData.phone || "+1 (555) 123-4567" },
            { label: "Company", value: formData.company || "GRS Shipping" },
            { label: "Client Type", value: formData.clientType || "Corporate" },
          ],
          [
            { label: "Address", value: formData.address || "123 Main Street" },
            { label: "City", value: formData.city || "New York" },
            { label: "State", value: formData.state || "NY" },
          ],
          [
            { label: "ZIP Code", value: formData.zipCode || "10001" },
            { label: "Country", value: formData.country || "United States" },
            { label: "Cargo Type", value: formData.cargoType || "Container" },
          ],
        ];

        return (
          <div className="client-review-content">
            <div className="add-employee-profile-section">
              <div className="company-info">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/6c9e546530e43d261ce6d1abbca51b7fb531a632?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
                  alt="Company logo"
                  className="company-logo"
                />
                <div className="company-name">{formData.company || "GRS Shipping"}</div>
              </div>
              <button className="edit-photo-button" onClick={handleEditPhoto}>
                <span className="edit-photo-text">Edit Photo</span>
                <img
                  src={editIcon}
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
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Add new Employee";
      case 2:
        return "Add new Employee";
      case 3:
        return "Add new Employee";
      default:
        return "Add new Employee";
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-client-modal">
        <div className="add-client-header">
          <h1 className="add-client-title">{getStepTitle()}</h1>
          <button className="close-button" onClick={onClose}>
            <div className="close-icon">×</div>
          </button>
        </div>

        <ProgressSteps currentStep={currentStep} onStepClick={handleStepClick} />

        {renderStepContent()}

        <div className="form-actions">
          {currentStep > 1 && (
            <button className="button-secondary" onClick={handlePrevious}>
              Prev
            </button>
          )}
          {currentStep < 3 ? (
            <button className="button-primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button className="button-primary" onClick={handleFinish}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddEmployeeModal;
