import React, { useState } from "react";
import "./AddClientModal.css";
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import clientService from "../../services/ClientService";
import config from "../../config/config";

function AddClientModal({ isOpen, onClose, onSubmit }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileImage, setProfileImage] = useState(null);
  
  const [formData, setFormData] = useState({
    // 1. Company & Contact Details
    companyName: "",
    type: "",
    address: "",
    country: "",
    taxId: "",
    website: "",
    primaryContactName: "",
    designation: "",
    phone: "",
    mobile: "",
    email: "",
    socialLinks: "",

    // 2. Customer Classification
    industryType: "",
    cargoType: "",
    decisionMaker: "",
    relationshipStatus: "",
    accountManager: "",

    // 3. Business / Commercial Data
    typicalCargoes: "",
    averageShipmentSize: "",
    shipmentFrequency: "",
    tradingRoutes: "",
    contractType: "",
    historicalVolume: "",
    competitors: "",

    // 4. Project Logistics Specific
    projectName: "",
    projectTimelineStart: "",
    projectTimelineEnd: "",
    epcContractor: "",
    specialRequirements: "",
    riskNotes: "",

    // 5. Interactions & Opportunities
    leadSource: "",
    currentStatus: "",
    opportunityValue: "",
    followUpDate: "",
    notes: "",

    // Follow-up pipeline status
    followupStatus: "Pending",

    // 6. Operational Links
    preferredLoadPorts: "",
    preferredDischargePorts: "",
    demurrageTerms: "",
    preferredAgents: "",
    incoterms: "",

    // New field
    category: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      setError("");
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
      setError("");
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setError("");
    }
  };

  const handleStepClick = (stepId) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
      setError("");
    }
  };

  const handleFinish = async () => {
    

    // Validate required fields
    if (!formData.companyName || !formData.email) {
      setError("Company Name and Email are required fields");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Filter out empty fields and convert date strings to Date objects
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== "")
      );

      // Convert date strings to Date objects for MongoDB
      if (filteredData.projectTimelineStart) {
        filteredData.projectTimelineStart = new Date(
          filteredData.projectTimelineStart
        );
      }
      if (filteredData.projectTimelineEnd) {
        filteredData.projectTimelineEnd = new Date(
          filteredData.projectTimelineEnd
        );
      }
      if (filteredData.followUpDate) {
        filteredData.followUpDate = new Date(filteredData.followUpDate);
      }

      // Convert opportunityValue to number if it exists
      if (filteredData.opportunityValue) {
        filteredData.opportunityValue = Number(filteredData.opportunityValue);
      }

      // const savedClient = await clientService.createClient(filteredData);
      const savedClient = await clientService.createClientWithFile(filteredData, profileImage);

      // Call the onSubmit callback with the saved client data
      if (onSubmit) {
        onSubmit(savedClient);
      }

      onClose();
      setCurrentStep(1);

      // Reset form data
      setFormData({
        companyName: "",
        type: "",
        address: "",
        country: "",
        taxId: "",
        website: "",
        primaryContactName: "",
        designation: "",
        phone: "",
        mobile: "",
        email: "",
        socialLinks: "",
        industryType: "",
        cargoType: "",
        decisionMaker: "",
        relationshipStatus: "",
        accountManager: "",
        typicalCargoes: "",
        averageShipmentSize: "",
        shipmentFrequency: "",
        tradingRoutes: "",
        contractType: "",
        historicalVolume: "",
        competitors: "",
        projectName: "",
        projectTimelineStart: "",
        projectTimelineEnd: "",
        epcContractor: "",
        specialRequirements: "",
        riskNotes: "",
        leadSource: "",
        currentStatus: "",
        opportunityValue: "",
        followUpDate: "",
        notes: "",
        preferredLoadPorts: "",
        preferredDischargePorts: "",
        demurrageTerms: "",
        preferredAgents: "",
        incoterms: "",
        category: "",
      });
    } catch (err) {
      console.error("Error creating client1:", err);
      setError(err.message || "Failed to create client. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

 const handlePhotoUpload = (file) => {
  setProfileImage(file);
};

  const handleEditPhoto = () => {
    console.log("Edit photo");
  };

  const typeOptions = [
    { value: "Shipper", label: "Shipper" },
    { value: "Consignee", label: "Consignee" },
    { value: "Broker", label: "Broker" },
    { value: "Agent", label: "Agent" },
    { value: "Other", label: "Other" },
  ];

  const decisionMakerOptions = [
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
  ];

  const relationshipStatusOptions = [
    { value: "Prospect", label: "Prospect" },
    { value: "Active", label: "Active" },
    { value: "Dormant", label: "Dormant" },
    { value: "Lost", label: "Lost" },
  ];

  const contractTypeOptions = [
    { value: "COA", label: "COA" },
    { value: "Spot", label: "Spot" },
    { value: "Tender", label: "Tender" },
    { value: "Long-term", label: "Long-term" },
  ];

  const currentStatusOptions = [
    { value: "Lead", label: "Lead" },
    { value: "Quoted", label: "Quoted" },
    { value: "Contacted", label: "Contacted" },
    { value: "Negotiation", label: "Negotiation" },
    { value: "Won", label: "Won" },
    { value: "Lost", label: "Lost" },
  ];

  const followupStatusOptions = [
    { value: "Contacted", label: "Contacted" },
    { value: "Needs Analysis", label: "Needs Analysis" },
    { value: "Demo Scheduled", label: "Demo Scheduled" },
    { value: "Proposal Sent", label: "Proposal Sent" },
    { value: "Completed", label: "Completed" },
    { value: "Pending", label: "Pending" },
    { value: "Progress", label: "Progress" },
    { value: "Won", label: "Won" },
    { value: "Lost", label: "Lost" },
  ];

  const incotermsOptions = [
    { value: "FOB", label: "FOB" },
    { value: "CIF", label: "CIF" },
    { value: "DAP", label: "DAP" },
    // { value: "EXW", label: "EXW" },
    // { value: "FCA", label: "FCA" },
    // { value: "CPT", label: "CPT" },
    // { value: "CIP", label: "CIP" },
    // { value: "DPU", label: "DPU" },
    // { value: "DDP", label: "DDP" },
  ];

  // New dropdown option lists
  const leadSourceOptions = [
    { value: "COLD CALL", label: "COLD CALL" },
    { value: "ADVERTISEMENT", label: "ADVERTISEMENT" },
    { value: "EMPLOYEE", label: "EMPLOYEE" },
    { value: "REFERRAL", label: "REFERRAL" },
    { value: "EXTERNAL", label: "EXTERNAL" }
  ];
  
  const leadStatusOptions = [
    { value: "NEW", label: "NEW" },
    { value: "ATTEMPTED TO", label: "ATTEMPTED TO" },
    { value: "CONTACT", label: "CONTACT" },
    { value: "CONTACTED", label: "CONTACTED" },
    { value: "QUALIFIED", label: "QUALIFIED" },
    { value: "CONTACT", label: "CONTACT" }
  ];
  
  const industryTypeOptions = [
  { value: "", label: "-None-" },
  { value: "FREIGHT", label: "FREIGHT" },
  { value: "FORWARDERS", label: "FORWARDERS" },
  { value: "INDUSTRIAL BOILER", label: "INDUSTRIAL BOILER" },
  { value: "OFFSHORE COMPANIES", label: "OFFSHORE COMPANIES" },
  { value: "JACK UP RIG OWNERS", label: "JACK UP RIG OWNERS" },
  { value: "OIL AND GAS COMPANIES", label: "OIL AND GAS COMPANIES" },
  { value: "THERMAL POWER", label: "THERMAL POWER" },
  { value: "NUCLEAR POWER", label: "NUCLEAR POWER" },
  { value: "HYDRO POWER", label: "HYDRO POWER" },
  { value: "NAVY", label: "NAVY" },
  { value: "WINDMILL COMPANIES", label: "WINDMILL COMPANIES" },
  { value: "OFFSHORE WINDMILL COMPANIES", label: "OFFSHORE WINDMILL COMPANIES" },
  { value: "STEEL TRADERS", label: "STEEL TRADERS" },
  { value: "SHIP BUILDING", label: "SHIP BUILDING" },
  { value: "SHIPYARDS", label: "SHIPYARDS" },
  { value: "DRY DOCKS", label: "DRY DOCKS" },
  { value: "PORT INFRASTRUCTURE COMPANIES", label: "PORT INFRASTRUCTURE COMPANIES" }
];

  
  const categoryOptions = [
    { value: "", label: "-None-" },
    { value: "BULK", label: "BULK" },
    { value: "BREAKBULK", label: "BREAKBULK" },
    { value: "PROJECT", label: "PROJECT" }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="add-client-content">
            <ProfilePhotoUpload onUpload={handlePhotoUpload} />
            <div className="form-fields-grid">
              
              <InputField
                label="Company Name *"
                placeholder="Company Name"
                required
                value={formData.companyName}
                onChange={(e) =>
                  handleInputChange("companyName", e.target.value)
                }
              />

              <InputField
                label="Client Type"
                placeholder="Select type"
                isDropdown
                options={typeOptions}
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
              />

              <InputField
                label="Address"
                placeholder="Address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />

              <InputField
                label="Country"
                placeholder="Country"
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
              />

              <InputField
                label="Tax ID (GST/VAT)"
                placeholder="Tax ID"
                value={formData.taxId}
                onChange={(e) => handleInputChange("taxId", e.target.value)}
              />

              <InputField
                label="Website"
                placeholder="Website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
              />

              <InputField
                label="Primary Contact Name"
                placeholder="Contact Name"
                value={formData.primaryContactName}
                onChange={(e) =>
                  handleInputChange("primaryContactName", e.target.value)
                }
              />

              <InputField
                label="Designation"
                placeholder="Designation"
                value={formData.designation}
                onChange={(e) =>
                  handleInputChange("designation", e.target.value)
                }
              />

              <InputField
                label="Phone (Office)"
                placeholder="Phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />

              <InputField
                label="Mobile"
                placeholder="Mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
              />

              <InputField
                label="Email *"
                placeholder="Email"
                required
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />

              <InputField
                label="Social Links"
                placeholder="Social media profiles"
                value={formData.socialLinks}
                onChange={(e) =>
                  handleInputChange("socialLinks", e.target.value)
                }
              />

              <InputField
                label="Industry Type"
                placeholder="Industry Type"
                isDropdown
                options={industryTypeOptions}
                value={formData.industryType}
                onChange={(e) =>
                  handleInputChange("industryType", e.target.value)
                }
              />

              <InputField
                label="Category"
                placeholder="Select category"
                isDropdown
                options={categoryOptions}
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              />

              <InputField
                label="Decision Maker"
                placeholder="Select option"
                isDropdown
                options={decisionMakerOptions}
                value={formData.decisionMaker}
                onChange={(e) =>
                  handleInputChange("decisionMaker", e.target.value)
                }
              />

              <InputField
                label="Relationship Status"
                placeholder="Select status"
                isDropdown
                options={relationshipStatusOptions}
                value={formData.relationshipStatus}
                onChange={(e) =>
                  handleInputChange("relationshipStatus", e.target.value)
                }
              />

              <InputField
                label="Account Manager"
                placeholder="Account Manager"
                value={formData.accountManager}
                onChange={(e) =>
                  handleInputChange("accountManager", e.target.value)
                }
              />

              <InputField
                label="Lead Source"
                placeholder="Select lead source"
                isDropdown
                options={leadSourceOptions}
                value={formData.leadSource}
                onChange={(e) => handleInputChange("leadSource", e.target.value)}
              />

              <InputField
                label="Lead Status"
                placeholder="Select lead status"
                isDropdown
                options={leadStatusOptions}
                value={formData.currentStatus} // stored to currentStatus field
                onChange={(e) => handleInputChange("currentStatus", e.target.value)}
              />

              <InputField
                label="Opportunity Value"
                placeholder="Opportunity Value"
                type="number"
                value={formData.opportunityValue} // Changed from accountManager
                onChange={(e) =>
                  handleInputChange("opportunityValue", e.target.value)
                }
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <InputField
                label="Typical Cargoes"
                placeholder="Typical Cargoes"
                value={formData.typicalCargoes}
                onChange={(e) =>
                  handleInputChange("typicalCargoes", e.target.value)
                }
              />

              <InputField
                label="Average Shipment Size"
                placeholder="Average Shipment Size"
                value={formData.averageShipmentSize}
                onChange={(e) =>
                  handleInputChange("averageShipmentSize", e.target.value)
                }
              />

              <InputField
                label="Shipment Frequency"
                placeholder="Shipment Frequency"
                value={formData.shipmentFrequency}
                onChange={(e) =>
                  handleInputChange("shipmentFrequency", e.target.value)
                }
              />

              <InputField
                label="Trading Routes"
                placeholder="Trading Routes"
                value={formData.tradingRoutes}
                onChange={(e) =>
                  handleInputChange("tradingRoutes", e.target.value)
                }
              />

              <InputField
                label="Contract Type"
                placeholder="Select contract type"
                isDropdown
                options={contractTypeOptions}
                value={formData.contractType}
                onChange={(e) =>
                  handleInputChange("contractType", e.target.value)
                }
              />

              <InputField
                label="Historical Volume"
                placeholder="Historical Volume"
                value={formData.historicalVolume}
                onChange={(e) =>
                  handleInputChange("historicalVolume", e.target.value)
                }
              />

              <InputField
                label="Competitors"
                placeholder="Competitors"
                value={formData.competitors}
                onChange={(e) =>
                  handleInputChange("competitors", e.target.value)
                }
              />

              <InputField
                label="Project Name"
                placeholder="Project Name"
                value={formData.projectName}
                onChange={(e) =>
                  handleInputChange("projectName", e.target.value)
                }
              />

              <InputField
                label="Project Start Date"
                placeholder="Start Date"
                type="date"
                value={formData.projectTimelineStart}
                onChange={(e) =>
                  handleInputChange("projectTimelineStart", e.target.value)
                }
              />

              <InputField
                label="Project End Date"
                placeholder="End Date"
                type="date"
                value={formData.projectTimelineEnd}
                onChange={(e) =>
                  handleInputChange("projectTimelineEnd", e.target.value)
                }
              />

              <InputField
                label="EPC Contractor"
                placeholder="EPC Contractor"
                value={formData.epcContractor}
                onChange={(e) =>
                  handleInputChange("epcContractor", e.target.value)
                }
              />

              <InputField
                label="Special Requirements"
                placeholder="Special Requirements"
                textarea
                value={formData.specialRequirements}
                onChange={(e) =>
                  handleInputChange("specialRequirements", e.target.value)
                }
              />

              <InputField
                label="Risk Notes"
                placeholder="Risk Notes"
                textarea
                value={formData.riskNotes}
                onChange={(e) => handleInputChange("riskNotes", e.target.value)}
              />

              <InputField
                label="Preferred Load Ports"
                placeholder="Preferred Load Ports"
                value={formData.preferredLoadPorts}
                onChange={(e) =>
                  handleInputChange("preferredLoadPorts", e.target.value)
                }
              />

              <InputField
                label="Preferred Discharge Ports"
                placeholder="Preferred Discharge Ports"
                value={formData.preferredDischargePorts}
                onChange={(e) =>
                  handleInputChange("preferredDischargePorts", e.target.value)
                }
              />

              <InputField
                label="Demurrage Terms"
                placeholder="Demurrage Terms"
                value={formData.demurrageTerms}
                onChange={(e) =>
                  handleInputChange("demurrageTerms", e.target.value)
                }
              />

              <InputField
                label="Preferred Agents"
                placeholder="Preferred Agents"
                value={formData.preferredAgents}
                onChange={(e) =>
                  handleInputChange("preferredAgents", e.target.value)
                }
              />

              <InputField
                label="Incoterms"
                placeholder="Select incoterms"
                isDropdown
                options={incotermsOptions}
                value={formData.incoterms}
                onChange={(e) => handleInputChange("incoterms", e.target.value)}
              />
            </div>
          </div>
        );

      case 3:
        const clientData = [
          [
            {
              label: "Company Name",
              value: formData.companyName || "Not provided",
            },
            { label: "Client Type", value: formData.type || "Not provided" },
            { label: "Email", value: formData.email || "Not provided" },
          ],
          [
            { label: "Phone", value: formData.phone || "Not provided" },
            { label: "Mobile", value: formData.mobile || "Not provided" },
            { label: "Country", value: formData.country || "Not provided" },
          ],
          [
            { label: "Address", value: formData.address || "Not provided" },
            { label: "Tax ID", value: formData.taxId || "Not provided" },
            { label: "Website", value: formData.website || "Not provided" },
          ],
          [
            {
              label: "Primary Contact",
              value: formData.primaryContactName || "Not provided",
            },
            {
              label: "Designation",
              value: formData.designation || "Not provided",
            },
            {
              label: "Industry Type",
              value: formData.industryType || "Not provided",
            },
          ],
          [
            {
              label: "Cargo Type",
              value: formData.cargoType || "Not provided",
            },
            {
              label: "Decision Maker",
              value: formData.decisionMaker || "Not provided",
            },
            {
              label: "Relationship Status",
              value: formData.relationshipStatus || "Not provided",
            },
          ],
          [
            {
              label: "Account Manager",
              value: formData.accountManager || "Not provided",
            },
            {
              label: "Contract Type",
              value: formData.contractType || "Not provided",
            },
            { label: "Incoterms", value: formData.incoterms || "Not provided" },
          ],
          [
            {
              label: "Lead Source",
              value: formData.leadSource || "Not provided",
            },
            {
              label: "Current Status",
              value: formData.currentStatus || "Not provided",
            },
            {
              label: "Opportunity Value",
              value: formData.opportunityValue
                ? `$${formData.opportunityValue}`
                : "Not provided",
            },
          ],
        ];

        return (
          <div className="client-review-content">
            <div className="company-profile-section">
              <div className="company-info">
                {profileImage ? (
                  <img
                    src={URL.createObjectURL(profileImage)}
                    alt="Company logo"
                    className="company-logo"
                  />
                ) : clientData?.profilePicture ? (
                  <img
                    src={`${config.API_BASE_URL.replace('/api', '')}${clientData.profilePicture}`}
                    alt="Company logo"
                    className="company-logo"
                  />
                ) : (
                  <div className="default-company-logo">
                    {formData.companyName?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
                <div className="company-name">
                  {formData.companyName || "Company Name"}
                </div>
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
        return "Corporate Details";
      case 2:
        return "Billing & Operational Details";
      case 3:
        return "Review Client Information";
      default:
        return "Add New Client";
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-client-modal">
        <div className="add-client-header">
          <h1 className="add-client-title">{getStepTitle()}</h1>
          <button className="close-button" onClick={onClose}>
            <div className="close-icon">&times;</div>
          </button>
        </div>

        <ProgressSteps
          currentStep={currentStep}
          onStepClick={handleStepClick}
          steps={["Corporate Details", "Billing Details", "Review"]}
        />

        {error && <div className="error-message">{error}</div>}

        {renderStepContent()}

        <div className="form-actions">
          {currentStep > 1 && (
            <button className="button-secondary" onClick={handlePrevious}>
              Previous
            </button>
          )}
          {currentStep < 3 ? (
            <button className="button-primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button
              className="button-primary"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding Client..." : "Finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddClientModal;
