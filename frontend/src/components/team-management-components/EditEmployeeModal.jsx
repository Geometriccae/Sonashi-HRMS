import React, { useState, useEffect } from "react";
import "./AddEmployeeModal.css"; // Using the same CSS file
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import employeeService from "../../services/EmployeeService";

function EditEmployeeModal({ isOpen, onClose, onSubmit, employee }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileImage, setProfileImage] = useState(null);
  const [currentProfileImageUrl, setCurrentProfileImageUrl] = useState(null);
  
  const [formData, setFormData] = useState({
    // 1. Basic Information
    employeeId: "",
    employeeName: "",
    mobile: "",
    emailId: "",
    
    // 2. Employment Details
    role: "",
    designation: "",
    department: "",
    attendance: "Onsite",
    
    // 3. Project Assignments
    assignedProjects: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form data when employee prop changes
  useEffect(() => {
    if (employee && isOpen) {
      setFormData({
        employeeId: employee.employeeId || "",
        employeeName: employee.employeeName || "",
        mobile: employee.mobile || "",
        emailId: employee.emailId || "",
        role: employee.role || "",
        designation: employee.designation || "",
        department: employee.department || "",
        attendance: employee.attendance || "Onsite",
        assignedProjects: Array.isArray(employee.assignedProjects) 
          ? employee.assignedProjects.join(", ") 
          : employee.assignedProjects || "",
      });
      
      // Set current profile image URL if exists
      if (employee.profilePhotoUrl) {
        setCurrentProfileImageUrl(employee.profilePhotoUrl);
      }
      
      // Reset form state
      setCurrentStep(1);
      setProfileImage(null);
      setError("");
    }
  }, [employee, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setProfileImage(null);
      setCurrentProfileImageUrl(null);
      setError("");
      setFormData({
        employeeId: "",
        employeeName: "",
        mobile: "",
        emailId: "",
        role: "",
        designation: "",
        department: "",
        attendance: "Onsite",
        assignedProjects: "",
      });
    }
  }, [isOpen]);

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
    if (!formData.employeeId || !formData.employeeName || !formData.mobile || 
        !formData.emailId || !formData.role || !formData.department) {
      setError("Employee ID, Name, Mobile, Email, Role, and Department are required fields");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Filter out empty fields
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== "")
      );

      // Convert assignedProjects from string to array
      if (filteredData.assignedProjects) {
        filteredData.assignedProjects = filteredData.assignedProjects
          .split(",")
          .map(project => project.trim())
          .filter(project => project !== "");
      }

      const updatedEmployee = await employeeService.updateEmployeeWithFile(
        employee._id || employee.id, 
        filteredData, 
        profileImage
      );

      // Call the onSubmit callback with the updated employee data
      if (onSubmit) {
        onSubmit(updatedEmployee);
      }

      onClose();
    } catch (err) {
      console.error("Error updating employee:", err);
      setError(err.message || "Failed to update employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (file) => {
    setProfileImage(file);
    setCurrentProfileImageUrl(null); // Clear current URL when new file is uploaded
  };

  const handleEditPhoto = () => {
    // Trigger file input for photo upload
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handlePhotoUpload(file);
      }
    };
    fileInput.click();
  };

  // Options for dropdowns
  const attendanceOptions = [
    { value: "Onsite", label: "Onsite" },
    { value: "Leave", label: "Leave" },
  ];

  const departmentOptions = [
    { value: "Operations", label: "Operations" },
    { value: "Sales", label: "Sales" },
    { value: "Marketing", label: "Marketing" },
    { value: "HR", label: "HR" },
    { value: "Finance", label: "Finance" },
    { value: "IT", label: "IT" },
    { value: "Logistics", label: "Logistics" },
    { value: "Customer Service", label: "Customer Service" },
  ];

  const roleOptions = [
    { value: "Operations Manager", label: "Operations Manager" },
    { value: "Sales Executive", label: "Sales Executive" },
    { value: "Logistics Coordinator", label: "Logistics Coordinator" },
    { value: "Account Manager", label: "Account Manager" },
    { value: "HR Manager", label: "HR Manager" },
    { value: "Finance Analyst", label: "Finance Analyst" },
    { value: "IT Specialist", label: "IT Specialist" },
    { value: "Customer Service Representative", label: "Customer Service Representative" },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="add-client-content">
            <ProfilePhotoUpload 
              onUpload={handlePhotoUpload}
              currentImageUrl={currentProfileImageUrl}
              defaultText="Update Profile Photo"
            />
            <div className="form-fields-grid">
              <InputField
                label="Employee ID *"
                placeholder="EMP-001"
                required
                value={formData.employeeId}
                onChange={(e) => handleInputChange("employeeId", e.target.value)}
              />

              <InputField
                label="Employee Name *"
                placeholder="Full Name"
                required
                value={formData.employeeName}
                onChange={(e) => handleInputChange("employeeName", e.target.value)}
              />

              <InputField
                label="Mobile Number *"
                placeholder="+91 1234567890"
                required
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
              />

              <InputField
                label="Email ID *"
                placeholder="employee@company.com"
                required
                type="email"
                value={formData.emailId}
                onChange={(e) => handleInputChange("emailId", e.target.value)}
              />

              <InputField
                label="Role *"
                placeholder="Select role"
                isDropdown
                options={roleOptions}
                value={formData.role}
                onChange={(e) => handleInputChange("role", e.target.value)}
              />

              <InputField
                label="Designation"
                placeholder="Designation"
                value={formData.designation}
                onChange={(e) => handleInputChange("designation", e.target.value)}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <InputField
                label="Department *"
                placeholder="Select department"
                isDropdown
                options={departmentOptions}
                value={formData.department}
                onChange={(e) => handleInputChange("department", e.target.value)}
              />

              <InputField
                label="Attendance Status"
                placeholder="Select status"
                isDropdown
                options={attendanceOptions}
                value={formData.attendance}
                onChange={(e) => handleInputChange("attendance", e.target.value)}
              />

              <InputField
                label="Assigned Projects"
                placeholder="Project A, Project B, Project C"
                value={formData.assignedProjects}
                onChange={(e) => handleInputChange("assignedProjects", e.target.value)}
                helperText="Enter projects separated by commas"
              />
            </div>
          </div>
        );

      case 3:
        const employeeData = [
          [
            { label: "Employee ID", value: formData.employeeId || "Not provided" },
            { label: "Employee Name", value: formData.employeeName || "Not provided" },
          ],
          [
            { label: "Mobile", value: formData.mobile || "Not provided" },
            { label: "Email", value: formData.emailId || "Not provided" },
          ],
          [
            { label: "Role", value: formData.role || "Not provided" },
            { label: "Designation", value: formData.designation || "Not provided" },
          ],
          [
            { label: "Department", value: formData.department || "Not provided" },
            { label: "Attendance", value: formData.attendance || "Not provided" },
          ],
          [
            { 
              label: "Assigned Projects", 
              value: formData.assignedProjects || "Not assigned" 
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
                    alt="Employee"
                    className="company-logo"
                  />
                ) : currentProfileImageUrl ? (
                  <img
                    src={currentProfileImageUrl}
                    alt="Employee"
                    className="company-logo"
                  />
                ) : (
                  <div className="default-company-logo">
                    {formData.employeeName?.charAt(0)?.toUpperCase() || 'E'}
                  </div>
                )}
                <div className="company-name">
                  {formData.employeeName || "Employee Name"}
                </div>
                <div className="employee-id">
                  {formData.employeeId || "Employee ID"}
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
              {employeeData.map((row, rowIndex) => (
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
        return "Edit Basic Information";
      case 2:
        return "Edit Employment Details";
      case 3:
        return "Review Updated Information";
      default:
        return "Edit Employee";
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

        <ProgressSteps
          currentStep={currentStep}
          onStepClick={handleStepClick}
          steps={["Basic Info", "Employment Details", "Review"]}
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
              {isSubmitting ? "Updating Employee..." : "Update"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditEmployeeModal;
