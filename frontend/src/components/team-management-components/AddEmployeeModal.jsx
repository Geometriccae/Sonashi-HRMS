import React, { useState, useEffect } from "react";
import "./AddEmployeeModal.css"; // Using the same CSS file
import ProgressSteps from "../ProgressSteps";
import InputField from "../InputField";
import ProfilePhotoUpload from "../ProfilePhotoUpload";
import editIcon from "../../assets/dashboard/pencil-line-blue.svg";
import employeeService from "../../services/EmployeeService";
import ClientService from "../../services/ClientService";
import config from "../../config/config";
import Dropdown from "../DropDown";
import Select from "react-select";
import ToastContainer from "../Toast";
import DocumentUploadField from "./DocumentUploadField";
import DocumentsService from "../../services/EmployeeDocumentService";
import OptionService from "../../services/OptionService";
import {
  ACTIVE_OPTIONS,
  VACATION_STATUS_OPTIONS,
  DEPARTMENT_OPTIONS_DEFAULT,
  GENDER_OPTIONS,
  EMERGENCY_RELATIONSHIP_OPTIONS,
  ROLE_OPTIONS_DEFAULT,
  DEFAULT_COMPANY_CODE,
  DEFAULT_COMPANY_NAME,
  resolveDefaultCompanyCode,
  resolveDefaultCompanyName,
  mergeWithDynamicOptions,
} from "../../constants/employeeDropdownOptions";
import {
  formatEmployeeStatusDisplay,
  isNonWorkingEmployeeStatus,
  isWorkingEmployeeStatus,
} from "../../utils/employeeStatusDisplay";
import { formatExperienceLabel } from "../../utils/yetToGoHelpers";
import CompanyDocumentService from "../../services/CompanyDocumentService";
import {
  buildCompanyOptionsFromDocuments,
  resolveCompanyCodeFromDocuments,
} from "../../utils/companyCodeFromDocuments";

function AddEmployeeModal({ isOpen, onClose, onSubmit }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileImage, setProfileImage] = useState(null);
  const [employeeDocuments, setEmployeeDocuments] = useState({
    passportPage1: null,
    passportPage2: null,
    idCard: null,
    labourCard: null,
    medicalCard: null,
    visaPage: null
  });


  const [formData, setFormData] = useState({
    // 1. Basic Information
    workPermitNo: "",
    employeeId: "",
    office: DEFAULT_COMPANY_NAME,
    employeeName: "",
    reportingManager: "",
    gender: "",
    mobile: "",
    emailId: "",
    emiratesId: "",
    nationality: "",
    emergencyUaeName: "",
    emergencyUaeRelationship: "",
    emergencyUaeAddress: "",
    emergencyUaeContactNo: "",
    emergencyHomeName: "",
    emergencyHomeRelationship: "",
    emergencyHomeAddress: "",
    emergencyHomeContactNo: "",
    emergencyHomeName2: "",
    emergencyHomeRelationship2: "",
    emergencyHomeAddress2: "",
    emergencyHomeContactNo2: "",

    // 2. Employment Details
    role: "",
    designation: "",
    department: "",
    doj: "",
    noticePeriod: "",
    provisionPeriod: "",
    noticePeriodStartDate: "",
    noticePeriodEndDate: "",
    provisionPeriodStartDate: "",
    provisionPeriodEndDate: "",
    lastWorkingDay: "",
    totalYearsExperience: "",
    dateOfBirth: "",
    passportNo: "",
    passportExpiryDate: "",
    labourCardNumber: "",
    labourCardExpiryDate: "",
    companyCode: DEFAULT_COMPANY_CODE,
    visaExpiryDate: "",
    emiratesIdExpiryDate: "",
    remarks: "",
    employeeStatus: "Active",
    vacationStatus: "Onsite",
    attendance: "Onsite",
    lifeInsurance: false,
    medicalInsurance: false,
    airFare: false,

    // 3. Salary Details
    basicSalary: "",
    houseRent: "",
    travelExp: "",
    other: "",
    totalAllowance: "",
    deduction: "",
    totalSalary: "",
    bankName: "",
    accountNumber: "",
    ibanNumber: "",
    bankSortCode: "",
  });

  const [clients, setClients] = useState([]);
  const [companyDocuments, setCompanyDocuments] = useState([]);
  const [roleOptions, setRoleOptions] = useState(ROLE_OPTIONS_DEFAULT);
  const [departmentOptions, setDepartmentOptions] = useState(DEPARTMENT_OPTIONS_DEFAULT);
  const [toasts, setToasts] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchCompanyDocuments();
      fetchEmployeeDropdownValues();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      const data = await ClientService.getClients();
      const clientList = Array.isArray(data) ? data : data.clients || [];
      setClients(clientList);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
      setClients([]);
      addToast("Failed to fetch clients.", "error");
    }
  };

  const fetchCompanyDocuments = async () => {
    try {
      const data = await CompanyDocumentService.getAll();
      const docs = Array.isArray(data) ? data : [];
      setCompanyDocuments(docs);
      setFormData((prev) => {
        const office = resolveDefaultCompanyName(prev.office);
        const fromDocs = resolveCompanyCodeFromDocuments(office, docs);
        return {
          ...prev,
          office,
          companyCode: fromDocs || resolveDefaultCompanyCode(prev.companyCode),
        };
      });
    } catch (err) {
      console.error("Failed to fetch company documents:", err);
      setCompanyDocuments([]);
    }
  };

  const handleCompanyChange = (companyName) => {
    const fromDocs = resolveCompanyCodeFromDocuments(companyName, companyDocuments);
    setFormData((prev) => ({
      ...prev,
      office: companyName,
      companyCode: fromDocs || resolveDefaultCompanyCode(""),
    }));
  };

  const fetchEmployeeDropdownValues = async () => {
    try {
      const [roles, depts, excludedRoles, excludedDepts] = await Promise.all([
        OptionService.getOptions('role'),
        OptionService.getOptions('department'),
        OptionService.getExcludedDefaults('role'),
        OptionService.getExcludedDefaults('department'),
      ]);

      setRoleOptions(OptionService.mergeWithDynamicOptions(ROLE_OPTIONS_DEFAULT, roles, excludedRoles));
      setDepartmentOptions(OptionService.mergeWithDynamicOptions(DEPARTMENT_OPTIONS_DEFAULT, depts, excludedDepts));
    } catch (err) {
      console.error("Failed to fetch dynamic options:", err);
      setRoleOptions(ROLE_OPTIONS_DEFAULT);
      setDepartmentOptions(DEPARTMENT_OPTIONS_DEFAULT);
    }
  };

  const handleRoleAdd = async (label) => {
    try {
      await OptionService.addOption('role', label);
      await fetchEmployeeDropdownValues();
      addToast(`Role "${label}" added successfully`, "success");
    } catch (err) {
      console.error("Error adding role:", err);
      addToast(err.response?.data?.message || "Failed to add role", "error");
    }
  };

  const handleRoleDelete = async (option) => {
    if (!option?.label || option.label === "-Select-") return;
    try {
      const roles = await OptionService.getOptions('role');
      const toDelete = roles.find((r) => r.label === option.label);
      if (toDelete) {
        await OptionService.deleteOption('role', toDelete._id);
      } else {
        await OptionService.excludeDefaultOption('role', option.label);
      }
      await fetchEmployeeDropdownValues();
      addToast(`Role "${option.label}" deleted`, "success");
    } catch (err) {
      addToast("Failed to delete role", "error");
    }
  };

  const handleDeptAdd = async (label) => {
    try {
      await OptionService.addOption('department', label);
      await fetchEmployeeDropdownValues();
      addToast(`Department "${label}" added successfully`, "success");
    } catch (err) {
      console.error("Error adding department:", err);
      addToast(err.response?.data?.message || "Failed to add department", "error");
    }
  };

  const handleDeptDelete = async (option) => {
    if (!option?.label || option.label === "-Select-") return;
    try {
      const depts = await OptionService.getOptions('department');
      const toDelete = depts.find((d) => d.label === option.label);
      if (toDelete) {
        await OptionService.deleteOption('department', toDelete._id);
      } else {
        await OptionService.excludeDefaultOption('department', option.label);
      }
      await fetchEmployeeDropdownValues();
      addToast(`Department "${option.label}" deleted`, "success");
    } catch (err) {
      addToast("Failed to delete department", "error");
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      // Backdrop click no longer closes the modal
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field if it exists
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const addToast = (message, type = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDocumentChange = (field, file) => {
    setEmployeeDocuments((prev) => ({
      ...prev,
      [field]: file,
    }));
    // Clear error for this field if it exists
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = (step) => {
    const errors = {};
    const missingFields = [];

    if (step === 1) {
      if (!formData.employeeId) {
        errors.employeeId = true;
        missingFields.push("Employee ID");
      }
      if (!formData.employeeName) {
        errors.employeeName = true;
        missingFields.push("Employee Name");
      }
      if (!formData.role) {
        errors.role = true;
        missingFields.push("Role");
      }
    } else if (step === 2) {

      if (!formData.department) {
        errors.department = true;
        missingFields.push("Department");
      }
    }

    setValidationErrors(errors);

    if (missingFields.length > 0) {
      addToast(
        `Please fill in the following required fields: ${missingFields.join(
          ", "
        )}`,
        "error"
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleStepClick = (stepId) => {
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  const handleFinish = async () => {
    // Validate required fields
    const errors = {};
    const missingFields = [];

    if (!formData.employeeId) {
      errors.employeeId = true;
      missingFields.push("Employee ID");
    }
    if (!formData.employeeName) {
      errors.employeeName = true;
      missingFields.push("Employee Name");
    }
    if (!formData.role) {
      errors.role = true;
      missingFields.push("Role");
    }
    if (!formData.department) {
      errors.department = true;
      missingFields.push("Department");
    }

    if (missingFields.length > 0) {
      setValidationErrors(errors);
      addToast(
        `Please fill in the following required fields: ${missingFields.join(
          ", "
        )}`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Filter out empty fields
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== "")
      );

      // assignedProjects is already an array, no need to split

      // Extract salary details cleanly
      const payload = { ...filteredData };

      // Always persist bank / labour / company fields
      payload.labourCardNumber = formData.labourCardNumber || "";
      payload.companyCode = resolveDefaultCompanyCode(formData.companyCode);
      payload.office = resolveDefaultCompanyName(formData.office);
      payload.salaryDetails = {
        basicSalary: parseFloat(formData.basicSalary) || 0,
        houseRent: parseFloat(formData.houseRent) || 0,
        travelExp: parseFloat(formData.travelExp) || 0,
        other: parseFloat(formData.other) || 0,
        totalAllowance: parseFloat(formData.totalAllowance) || 0,
        deduction: parseFloat(formData.deduction) || 0,
        totalSalary: parseFloat(formData.totalSalary) || 0,
        bankName: formData.bankName || "",
        accountNumber: formData.accountNumber || "",
        ibanNumber: formData.ibanNumber || "",
        bankSortCode: formData.bankSortCode || ""
      };
      [
        "basicSalary", "houseRent", "travelExp", "other", "totalAllowance",
        "deduction", "totalSalary", "bankName", "accountNumber", "ibanNumber", "bankSortCode",
      ].forEach((k) => delete payload[k]);

      payload.emergencyContact = {
        uae: {
          name: formData.emergencyUaeName || "",
          relationship: formData.emergencyUaeRelationship || "",
          address: formData.emergencyUaeAddress || "",
          contactNo: formData.emergencyUaeContactNo || ""
        },
        homeCountry: {
          name: formData.emergencyHomeName || "",
          relationship: formData.emergencyHomeRelationship || "",
          address: formData.emergencyHomeAddress || "",
          contactNo: formData.emergencyHomeContactNo || ""
        },
        homeCountry2: {
          name: formData.emergencyHomeName2 || "",
          relationship: formData.emergencyHomeRelationship2 || "",
          address: formData.emergencyHomeAddress2 || "",
          contactNo: formData.emergencyHomeContactNo2 || ""
        }
      };

      const savedEmployee = await employeeService.createEmployeeWithFile(
        payload,
        profileImage
      );

      const empId = savedEmployee._id || savedEmployee.id || savedEmployee.employee?._id || savedEmployee.employee?.id;
      if (empId) {
        const docUploads = [
          { file: employeeDocuments.passportPage1, type: "Passport Page 1" },
          { file: employeeDocuments.passportPage2, type: "Passport Page 2" },
          { file: employeeDocuments.idCard, type: "ID Card" },
          { file: employeeDocuments.labourCard, type: "Labour Card" },
          { file: employeeDocuments.medicalCard, type: "Medical Card" },
          { file: employeeDocuments.visaPage, type: "Visa Page" },
        ];
        for (const { file, type } of docUploads) {
          if (!file) continue;
          try {
            await DocumentsService.uploadForEmployee(empId, file, {
              type,
            });
          } catch (docErr) {
            console.warn("Document upload failed:", type, docErr);
          }
        }
      }

      // Call the onSubmit callback with the saved employee data
      if (onSubmit) {
        onSubmit(savedEmployee);
      }

      onClose();
      setCurrentStep(1);

      // Reset form data
      setFormData({
        workPermitNo: "",
        employeeId: "",
        office: DEFAULT_COMPANY_NAME,
        employeeName: "",
        reportingManager: "",
        gender: "",
        mobile: "",
        emailId: "",
        emiratesId: "",
        nationality: "",
        emergencyUaeName: "",
        emergencyUaeRelationship: "",
        emergencyUaeAddress: "",
        emergencyUaeContactNo: "",
        emergencyHomeName: "",
        emergencyHomeRelationship: "",
        emergencyHomeAddress: "",
        emergencyHomeContactNo: "",
        emergencyHomeName2: "",
        emergencyHomeRelationship2: "",
        emergencyHomeAddress2: "",
        emergencyHomeContactNo2: "",
        role: "",
        designation: "",
        department: "",
        doj: "",
        noticePeriod: "",
        provisionPeriod: "",
        noticePeriodStartDate: "",
        noticePeriodEndDate: "",
        provisionPeriodStartDate: "",
        provisionPeriodEndDate: "",
        lastWorkingDay: "",
        totalYearsExperience: "",
        dateOfBirth: "",
        passportNo: "",
        passportExpiryDate: "",
        labourCardNumber: "",
        labourCardExpiryDate: "",
        companyCode: DEFAULT_COMPANY_CODE,
        visaExpiryDate: "",
        emiratesIdExpiryDate: "",
        remarks: "",
        employeeStatus: "Active",
        vacationStatus: "Onsite",
        attendance: "Onsite",
        lifeInsurance: false,
        medicalInsurance: false,
        basicSalary: "",
        houseRent: "",
        travelExp: "",
        other: "",
        totalAllowance: "",
        deduction: "",
        totalSalary: "",
        bankName: "",
        accountNumber: "",
        ibanNumber: "",
        bankSortCode: "",
      });

      setProfileImage(null);
      setEmployeeDocuments({ passportPage1: null, passportPage2: null, idCard: null, labourCard: null, medicalCard: null, visaPage: null });
      addToast("Employee created successfully!", "success");
    } catch (err) {
      console.error("Error creating employee:", err);
      let errorMessage =
        err.message || "Failed to create employee. Please try again.";

      // Handle duplicate email error
      if (
        errorMessage.includes("email") &&
        errorMessage.includes("already exists")
      ) {
        errorMessage =
          "An employee with this email already exists. Please use a different email.";
      } else if (
        errorMessage.includes("employeeId") &&
        errorMessage.includes("already exists")
      ) {
        errorMessage =
          "An employee with this ID already exists. Please use a different Employee ID.";
      } else if (errorMessage.includes("Duplicate")) {
        errorMessage =
          "Duplicate entry found. Please check the information and try again.";
      }
      addToast(
        errorMessage,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (file, base64) => {
    setProfileImage(base64 || file);
  };

  const handleEditPhoto = () => {
    console.log("Edit photo");
  };

  const activeOptions = ACTIVE_OPTIONS;
  const vacationStatusOptions = VACATION_STATUS_OPTIONS;
  const genderOptions = GENDER_OPTIONS;
  const emergencyRelationshipOptions = EMERGENCY_RELATIONSHIP_OPTIONS;

  const companyOptions = buildCompanyOptionsFromDocuments(companyDocuments, formData.office);

  const clientOptions = clients.map((client) => ({
    value: client._id,
    label: client.clientName || client.companyName || "Unnamed Client",
  }));

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="add-client-content">
            <ProfilePhotoUpload onUpload={handlePhotoUpload} initialImage={profileImage} />
            <div className="form-fields-grid">
              <InputField
                label="Person Code"
                placeholder="Person Code"
                value={formData.workPermitNo}
                onChange={(e) =>
                  handleInputChange("workPermitNo", e.target.value)
                }
              />

              <InputField
                label="Employee ID"
                placeholder="EMP-001"
                required
                value={formData.employeeId}
                onChange={(e) =>
                  handleInputChange("employeeId", e.target.value)
                }
                hasError={validationErrors.employeeId}
              />

              <Dropdown
                label="Company"
                placeholder="Select company"
                options={companyOptions}
                value={formData.office || DEFAULT_COMPANY_NAME}
                onChange={(e) => handleCompanyChange(e.target.value)}
              />

              <InputField
                label="Company Code"
                placeholder="Auto-filled from selected Company"
                value={formData.companyCode || DEFAULT_COMPANY_CODE}
                onChange={(e) => handleInputChange("companyCode", e.target.value)}
              />

              <InputField
                label="IBAN Number"
                placeholder="Enter IBAN"
                value={formData.ibanNumber}
                onChange={(e) => handleInputChange("ibanNumber", e.target.value)}
              />

              <InputField
                label="Bank Sort Code"
                placeholder="Enter Bank Sort Code"
                value={formData.bankSortCode}
                onChange={(e) => handleInputChange("bankSortCode", e.target.value)}
              />

              <InputField
                label="Employee Name"
                placeholder="Full Name"
                required
                value={formData.employeeName}
                onChange={(e) =>
                  handleInputChange("employeeName", e.target.value)
                }
                hasError={validationErrors.employeeName}
              />

              <InputField
                label="Reporting Manager"
                placeholder="Reporting Manager"
                value={formData.reportingManager}
                onChange={(e) =>
                  handleInputChange("reportingManager", e.target.value)
                }
              />

              <Dropdown
                label="Gender"
                placeholder="Select gender"
                options={genderOptions}
                value={formData.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
              />

              <InputField
                label="Mobile Number (digits only, optional)"
                placeholder="971501234567"
                type="tel"
                inputMode="numeric"
                value={formData.mobile}
                onChange={(e) =>
                  handleInputChange("mobile", e.target.value.replace(/\D/g, ""))
                }
                hasError={validationErrors.mobile}
              />

              <InputField
                label="Email ID (optional)"
                placeholder="employee@company.com"
                type="email"
                value={formData.emailId}
                onChange={(e) => handleInputChange("emailId", e.target.value)}
                hasError={validationErrors.emailId}
              />

              <InputField
                label="Emirates ID"
                placeholder="Emirates ID"
                value={formData.emiratesId}
                onChange={(e) =>
                  handleInputChange("emiratesId", e.target.value)
                }
              />

              <InputField
                label="Nationality"
                placeholder="Nationality"
                value={formData.nationality}
                onChange={(e) =>
                  handleInputChange("nationality", e.target.value)
                }
              />

              <Dropdown
                id="add-employee-role"
                label="Role"
                placeholder="Select role"
                options={roleOptions}
                value={formData.role}
                onAdd={handleRoleAdd}
                onDelete={handleRoleDelete}
                onChange={(e) => handleInputChange("role", e.target.value)}
                hasError={validationErrors.role}
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
                label="DOJ"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.doj}
                onChange={(e) => handleInputChange("doj", e.target.value)}
              />

              <InputField
                label="Notice Period (Duration)"
                placeholder="e.g. 30 days"
                value={formData.noticePeriod}
                onChange={(e) => handleInputChange("noticePeriod", e.target.value)}
              />

              <InputField
                label="Provision Period (Duration)"
                placeholder="e.g. 3 months"
                value={formData.provisionPeriod}
                onChange={(e) => handleInputChange("provisionPeriod", e.target.value)}
              />

              <InputField
                label="Notice Period Start Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.noticePeriodStartDate}
                onChange={(e) => handleInputChange("noticePeriodStartDate", e.target.value)}
              />

              <InputField
                label="Notice Period End Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.noticePeriodEndDate}
                onChange={(e) => handleInputChange("noticePeriodEndDate", e.target.value)}
              />

              <InputField
                label="Provision Period Start Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.provisionPeriodStartDate}
                onChange={(e) => handleInputChange("provisionPeriodStartDate", e.target.value)}
              />

              <InputField
                label="Provision Period End Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.provisionPeriodEndDate}
                onChange={(e) => handleInputChange("provisionPeriodEndDate", e.target.value)}
              />

              {/* Emergency Contacts Section */}
              <div style={{ gridColumn: "span 2", marginTop: "10px" }}>
                <h3 className="section-subtitle">Emergency Contact - UAE</h3>
                <div className="form-fields-grid" style={{ marginTop: "10px" }}>
                  <Dropdown
                    label="Relationship"
                    placeholder="Select relationship"
                    options={emergencyRelationshipOptions}
                    value={formData.emergencyUaeRelationship}
                    onChange={(e) => handleInputChange("emergencyUaeRelationship", e.target.value)}
                  />
                  <InputField
                    label="Name"
                    placeholder="Contact Name"
                    value={formData.emergencyUaeName}
                    onChange={(e) => handleInputChange("emergencyUaeName", e.target.value)}
                  />
                  <InputField
                    label="Address"
                    placeholder="UAE Address"
                    value={formData.emergencyUaeAddress}
                    onChange={(e) => handleInputChange("emergencyUaeAddress", e.target.value)}
                  />
                  <InputField
                    label="Contact No."
                    placeholder="Contact Number"
                    value={formData.emergencyUaeContactNo}
                    onChange={(e) => handleInputChange("emergencyUaeContactNo", e.target.value)}
                  />
                </div>

                <h3 className="section-subtitle" style={{ marginTop: "20px" }}>Emergency Contact - Home Country</h3>
                <div className="form-fields-grid" style={{ marginTop: "10px" }}>
                  <Dropdown
                    label="Relationship"
                    placeholder="Select relationship"
                    options={emergencyRelationshipOptions}
                    value={formData.emergencyHomeRelationship}
                    onChange={(e) => handleInputChange("emergencyHomeRelationship", e.target.value)}
                  />
                  <InputField
                    label="Name"
                    placeholder="Contact Name"
                    value={formData.emergencyHomeName}
                    onChange={(e) => handleInputChange("emergencyHomeName", e.target.value)}
                  />
                  <InputField
                    label="Address"
                    placeholder="Home Country Address"
                    value={formData.emergencyHomeAddress}
                    onChange={(e) => handleInputChange("emergencyHomeAddress", e.target.value)}
                  />
                  <InputField
                    label="Contact No."
                    placeholder="Contact Number"
                    value={formData.emergencyHomeContactNo}
                    onChange={(e) => handleInputChange("emergencyHomeContactNo", e.target.value)}
                  />
                </div>

                <h3 className="section-subtitle" style={{ marginTop: "20px" }}>Emergency Contact - Home Country 2</h3>
                <div className="form-fields-grid" style={{ marginTop: "10px" }}>
                  <Dropdown
                    label="Relationship"
                    placeholder="Select relationship"
                    options={emergencyRelationshipOptions}
                    value={formData.emergencyHomeRelationship2}
                    onChange={(e) => handleInputChange("emergencyHomeRelationship2", e.target.value)}
                  />
                  <InputField
                    label="Name"
                    placeholder="Contact Name"
                    value={formData.emergencyHomeName2}
                    onChange={(e) => handleInputChange("emergencyHomeName2", e.target.value)}
                  />
                  <InputField
                    label="Address"
                    placeholder="Home Country Address"
                    value={formData.emergencyHomeAddress2}
                    onChange={(e) => handleInputChange("emergencyHomeAddress2", e.target.value)}
                  />
                  <InputField
                    label="Contact No."
                    placeholder="Contact Number"
                    value={formData.emergencyHomeContactNo2}
                    onChange={(e) => handleInputChange("emergencyHomeContactNo2", e.target.value)}
                  />
                </div>
              </div>

              {/* Documents Section */}
              <div className="documents-section">
                <h3 className="section-subtitle">Documents</h3>
                <div className="documents-grid">
                  <div style={{ gridColumn: "span 2", border: "1px dashed #cbd5e0", padding: "12px", borderRadius: "8px", background: "#f8fafc" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#4a5568", marginBottom: "12px" }}>Passport Documents</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <DocumentUploadField
                        label="Page 1"
                        field="passportPage1"
                        file={employeeDocuments.passportPage1}
                        hasError={validationErrors.passportPage1}
                        onUpload={handleDocumentChange}
                        onRemove={() => handleDocumentChange("passportPage1", null)}
                        optional
                      />
                      <DocumentUploadField
                        label="Page 2"
                        field="passportPage2"
                        file={employeeDocuments.passportPage2}
                        hasError={validationErrors.passportPage2}
                        onUpload={handleDocumentChange}
                        onRemove={() => handleDocumentChange("passportPage2", null)}
                        optional
                      />
                    </div>
                  </div>
                  <DocumentUploadField
                    label="ID Card"
                    field="idCard"
                    file={employeeDocuments.idCard}
                    hasError={validationErrors.idCard}
                    onUpload={handleDocumentChange}
                    onRemove={() => handleDocumentChange("idCard", null)}
                    optional
                  />
                  <DocumentUploadField
                    label="Labour Card"
                    field="labourCard"
                    file={employeeDocuments.labourCard}
                    hasError={validationErrors.labourCard}
                    onUpload={handleDocumentChange}
                    onRemove={() => handleDocumentChange("labourCard", null)}
                    optional
                  />
                  <DocumentUploadField
                    label="Medical Card"
                    field="medicalCard"
                    file={employeeDocuments.medicalCard}
                    hasError={validationErrors.medicalCard}
                    onUpload={handleDocumentChange}
                    onRemove={() => handleDocumentChange("medicalCard", null)}
                    optional
                  />
                  <DocumentUploadField
                    label="Visa Page"
                    field="visaPage"
                    file={employeeDocuments.visaPage}
                    hasError={validationErrors.visaPage}
                    onUpload={handleDocumentChange}
                    onRemove={() => handleDocumentChange("visaPage", null)}
                    optional
                  />
                </div>
              </div>
            </div>
          </div>
        );



      case 2:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <InputField
                label="Total Year of Experience"
                placeholder="—"
                value={
                  formatExperienceLabel(
                    formData.doj,
                    formData.totalYearsExperience,
                    (isNonWorkingEmployeeStatus(formData.employeeStatus) && formData.lastWorkingDay)
                      ? formData.lastWorkingDay
                      : new Date()
                  ) || "—"
                }
                readOnly
              />

              <InputField
                label="Date of Birth"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  handleInputChange("dateOfBirth", e.target.value)
                }
              />

              <InputField
                label="Passport No."
                placeholder="Passport No."
                value={formData.passportNo}
                onChange={(e) =>
                  handleInputChange("passportNo", e.target.value)
                }
              />

              <InputField
                label="Passport Expiry Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.passportExpiryDate}
                onChange={(e) =>
                  handleInputChange("passportExpiryDate", e.target.value)
                }
              />

              <InputField
                label="Labour Card Number"
                placeholder="Labour Card Number"
                value={formData.labourCardNumber}
                onChange={(e) =>
                  handleInputChange("labourCardNumber", e.target.value)
                }
              />

              <InputField
                label="Labour Card Expiry Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.labourCardExpiryDate}
                onChange={(e) =>
                  handleInputChange("labourCardExpiryDate", e.target.value)
                }
              />

              <InputField
                label="Visa Expiry Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.visaExpiryDate}
                onChange={(e) =>
                  handleInputChange("visaExpiryDate", e.target.value)
                }
              />

              <InputField
                label="Emirates ID Expiry Date"
                placeholder="YYYY-MM-DD"
                type="date"
                value={formData.emiratesIdExpiryDate}
                onChange={(e) =>
                  handleInputChange("emiratesIdExpiryDate", e.target.value)
                }
              />

              <InputField
                label="Remarks"
                placeholder="Remarks"
                value={formData.remarks}
                onChange={(e) => handleInputChange("remarks", e.target.value)}
              />

              <Dropdown
                label="Department"
                placeholder="Select department"
                options={departmentOptions}
                value={formData.department}
                onAdd={handleDeptAdd}
                onDelete={handleDeptDelete}
                onChange={(e) =>
                  handleInputChange("department", e.target.value)
                }
                hasError={validationErrors.department}
              />

              <Dropdown
                label="Employee Status"
                placeholder="Select status"
                options={activeOptions}
                value={formData.employeeStatus}
                onChange={(e) =>
                  handleInputChange("employeeStatus", e.target.value)
                }
              />

              {isNonWorkingEmployeeStatus(formData.employeeStatus) && (
                <InputField
                  label="Last Working Day"
                  placeholder="YYYY-MM-DD"
                  type="date"
                  value={formData.lastWorkingDay}
                  onChange={(e) => handleInputChange("lastWorkingDay", e.target.value)}
                />
              )}

              {isWorkingEmployeeStatus(formData.employeeStatus) && (
                <Dropdown
                  label="Vacation Status"
                  placeholder="Select vacation status"
                  options={vacationStatusOptions}
                  value={formData.vacationStatus}
                  onChange={(e) =>
                    handleInputChange("vacationStatus", e.target.value)
                  }
                />
              )}

              <div className="input-field">
                <div className="input-label-container">
                  <label className="input-label">Life Insurance</label>
                </div>
                <div style={{ display: "flex", gap: "24px", height: "46px", alignItems: "center", background: "#f9f9f9", borderRadius: "8px", padding: "0 16px", border: "1px dashed #ccc" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="lifeInsurance" checked={formData.lifeInsurance === true} onChange={() => handleInputChange("lifeInsurance", true)} />
                    Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="lifeInsurance" checked={formData.lifeInsurance === false} onChange={() => handleInputChange("lifeInsurance", false)} />
                    No
                  </label>
                </div>
              </div>

              <div className="input-field">
                <div className="input-label-container">
                  <label className="input-label">Medical Insurance</label>
                </div>
                <div style={{ display: "flex", gap: "24px", height: "46px", alignItems: "center", background: "#f9f9f9", borderRadius: "8px", padding: "0 16px", border: "1px dashed #ccc" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="medicalInsurance" checked={formData.medicalInsurance === true} onChange={() => handleInputChange("medicalInsurance", true)} />
                    Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="medicalInsurance" checked={formData.medicalInsurance === false} onChange={() => handleInputChange("medicalInsurance", false)} />
                    No
                  </label>
                </div>
              </div>

              <div className="input-field">
                <div className="input-label-container">
                  <label className="input-label">Air Fare</label>
                </div>
                <div style={{ display: "flex", gap: "24px", height: "46px", alignItems: "center", background: "#f9f9f9", borderRadius: "8px", padding: "0 16px", border: "1px dashed #ccc" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="airFare" checked={formData.airFare === true} onChange={() => handleInputChange("airFare", true)} />
                    Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#333" }}>
                    <input type="radio" name="airFare" checked={formData.airFare === false} onChange={() => handleInputChange("airFare", false)} />
                    No
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="billing-content">
            <div className="form-fields-grid">
              <InputField
                label="Basic Salary (BASIC)"
                placeholder="0.00"
                type="number"
                value={formData.basicSalary}
                onChange={(e) => {
                  const basic = parseFloat(e.target.value) || 0;
                  const hra = parseFloat(formData.houseRent) || 0;
                  const travel = parseFloat(formData.travelExp) || 0;
                  const other = parseFloat(formData.other) || 0;
                  const totalAllow = hra + travel + other;
                  const deduct = parseFloat(formData.deduction) || 0;
                  setFormData(prev => ({
                    ...prev,
                    basicSalary: e.target.value,
                    totalAllowance: totalAllow.toString(),
                    totalSalary: (basic + totalAllow - deduct).toString()
                  }));
                }}
              />
              <InputField
                label="House Rent (HOUSE RENT)"
                placeholder="0.00"
                type="number"
                value={formData.houseRent}
                onChange={(e) => {
                  const hra = parseFloat(e.target.value) || 0;
                  const basic = parseFloat(formData.basicSalary) || 0;
                  const travel = parseFloat(formData.travelExp) || 0;
                  const other = parseFloat(formData.other) || 0;
                  const totalAllow = hra + travel + other;
                  const deduct = parseFloat(formData.deduction) || 0;
                  setFormData(prev => ({
                    ...prev,
                    houseRent: e.target.value,
                    totalAllowance: totalAllow.toString(),
                    totalSalary: (basic + totalAllow - deduct).toString()
                  }));
                }}
              />
              <InputField
                label="Travel Exp (TRAVEL EXP)"
                placeholder="0.00"
                type="number"
                value={formData.travelExp}
                onChange={(e) => {
                  const travel = parseFloat(e.target.value) || 0;
                  const basic = parseFloat(formData.basicSalary) || 0;
                  const hra = parseFloat(formData.houseRent) || 0;
                  const other = parseFloat(formData.other) || 0;
                  const totalAllow = hra + travel + other;
                  const deduct = parseFloat(formData.deduction) || 0;
                  setFormData(prev => ({
                    ...prev,
                    travelExp: e.target.value,
                    totalAllowance: totalAllow.toString(),
                    totalSalary: (basic + totalAllow - deduct).toString()
                  }));
                }}
              />
              <InputField
                label="Other Allowance (OTHER)"
                placeholder="0.00"
                type="number"
                value={formData.other}
                onChange={(e) => {
                  const other = parseFloat(e.target.value) || 0;
                  const basic = parseFloat(formData.basicSalary) || 0;
                  const hra = parseFloat(formData.houseRent) || 0;
                  const travel = parseFloat(formData.travelExp) || 0;
                  const totalAllow = hra + travel + other;
                  const deduct = parseFloat(formData.deduction) || 0;
                  setFormData(prev => ({
                    ...prev,
                    other: e.target.value,
                    totalAllowance: totalAllow.toString(),
                    totalSalary: (basic + totalAllow - deduct).toString()
                  }));
                }}
              />
              <InputField
                label="Deduction (DEDUCTION)"
                placeholder="0.00"
                type="number"
                value={formData.deduction}
                onChange={(e) => {
                  const deduct = parseFloat(e.target.value) || 0;
                  const basic = parseFloat(formData.basicSalary) || 0;
                  const totalAllow = parseFloat(formData.totalAllowance) || 0;
                  setFormData(prev => ({
                    ...prev,
                    deduction: e.target.value,
                    totalSalary: (basic + totalAllow - deduct).toString()
                  }));
                }}
              />
              <InputField
                label="Net Salary"
                placeholder="0.00"
                type="number"
                readOnly
                value={formData.totalSalary}
              />
              <InputField
                label="Bank Name"
                placeholder="Enter bank name"
                value={formData.bankName}
                onChange={(e) => handleInputChange("bankName", e.target.value)}
              />
              <InputField
                label="Account Number"
                placeholder="Enter account number"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange("accountNumber", e.target.value)}
              />
              <InputField
                label="IBAN Number"
                placeholder="Enter IBAN"
                value={formData.ibanNumber}
                onChange={(e) => handleInputChange("ibanNumber", e.target.value)}
              />
              <InputField
                label="Bank Sort Code"
                placeholder="Enter Bank Sort Code"
                value={formData.bankSortCode}
                onChange={(e) => handleInputChange("bankSortCode", e.target.value)}
              />
            </div>
          </div>
        );

      case 4:
        const employeeData = [
          [
            {
              label: "Employee ID",
              value: formData.employeeId || "Not provided",
            },
            {
              label: "Employee Name",
              value: formData.employeeName || "Not provided",
            },
          ],
          [
            { label: "Mobile", value: formData.mobile || "Not provided" },
            { label: "Email", value: formData.emailId || "Not provided" },
          ],
          [
            { label: "Role", value: formData.role || "Not provided" },
            {
              label: "Designation",
              value: formData.designation || "Not provided",
            },
          ],
          [
            {
              label: "Department",
              value: formData.department || "Not provided",
            },
            {
              label: "Employee Status",
              value: formatEmployeeStatusDisplay(formData) || "Not provided",
            },
          ],
          [
            {
              label: "Notice Period",
              value: formData.noticePeriod || "Not provided",
            },
            {
              label: "Provision Period",
              value: formData.provisionPeriod || "Not provided",
            },
          ],
          [
            {
              label: "Company",
              value: formData.office || "Not provided",
            },
            {
              label: "Company Code",
              value: formData.companyCode || "Not provided",
            },
          ],
          [
            {
              label: "Labour Card Number",
              value: formData.labourCardNumber || "Not provided",
            },
            {
              label: "Air Fare",
              value: formData.airFare ? "Yes" : "No",
            },
          ],
          [
            {
              label: "Life Insurance",
              value: formData.lifeInsurance ? "Yes" : "No",
            },
            {
              label: "Medical Insurance",
              value: formData.medicalInsurance ? "Yes" : "No",
            },
          ],
          [
            {
              label: "Basic Salary",
              value: formData.basicSalary ? `AED ${formData.basicSalary}` : "0",
            },
            {
              label: "HRA",
              value: formData.houseRent ? `AED ${formData.houseRent}` : "0",
            },
          ],
          [
            {
              label: "Travel Exp",
              value: formData.travelExp ? `AED ${formData.travelExp}` : "0",
            },
            {
              label: "Other",
              value: formData.other ? `AED ${formData.other}` : "0",
            },
          ],
          [
            {
              label: "Bank Name",
              value: formData.bankName || "Not provided",
            },
            {
              label: "Account Number",
              value: formData.accountNumber || "Not provided",
            },
          ],
          [
            {
              label: "IBAN Number",
              value: formData.ibanNumber || "Not provided",
            },
            {
              label: "Bank Sort Code",
              value: formData.bankSortCode || "Not provided",
            },
          ],
          [
            {
              label: "Deduction",
              value: formData.deduction ? `AED ${formData.deduction}` : "0",
            },
            {
              label: "Net Salary",
              value: formData.totalSalary ? `AED ${formData.totalSalary}` : "0",
            },
          ],
        ];

        return (
          <div className="client-review-content">
            <div className="add-employee-profile-section ">
              <div className="company-info">
                {profileImage ? (
                  <img
                    src={typeof profileImage === 'string' ? profileImage : URL.createObjectURL(profileImage)}
                    alt="Employee"
                    className="company-logo"
                  />
                ) : (
                  <div className="default-company-logo">
                    {formData.employeeName?.charAt(0)?.toUpperCase() || "E"}
                  </div>
                )}
                <div className="company-name">
                  {formData.employeeName || "Employee Name"}
                </div>
                {/* <div className="employee-id">
                  {formData.employeeId || "Employee ID"}
                </div> */}
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
        return "Basic Information";
      case 2:
        return "Employment Details";
      case 3:
        return "Salary Details";
      case 4:
        return "Review Employee Information";
      default:
        return "Add New Employee";
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
          steps={["Basic Info", "Employment Details", "Salary Details", "Review"]}
        />

        {renderStepContent()}

        <div className="form-actions">
          {currentStep > 1 && (
            <button className="button-secondary" onClick={handlePrevious}>
              Previous
            </button>
          )}
          {currentStep < 4 ? (
            <button className="button-primary" onClick={handleNext}>
              Next
            </button>
          ) : (

            <button
              className="button-primary"
              onClick={handleFinish}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding Employee..." : "Finish"}
            </button>
          )}
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </div>
  );
}

export default AddEmployeeModal;
