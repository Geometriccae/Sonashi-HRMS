import React, { useState, useEffect } from 'react';
import styles from './SalarySlipManualAddModal.module.css';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import salarySlipService from '../../services/SalarySlipService';
import employeeService from '../../services/EmployeeService';
import { useToast } from '../../context/ToastContext';
import Dropdown from '../DropDown';
import DateInput from '../DateInput';
import { formatAed } from '../../utils/currency';

function SalarySlipManualAddModal({ isOpen, onClose, onSuccess, month, year, existingSlips = [] }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [formData, setFormData] = useState({
        selectedEmployeeId: '',
        employeeName: '',
        email: '',
        department: '',
        designation: '',
        dateOfJoining: '',
        // Earnings (custom fields)
        basic: '',
        houseRent: '',
        travelExp: '',
        other: '',
        // Deductions (custom field)
        deduction: '',
        // Calculated fields
        grossSalary: '',
        netSalary: '',
        month: month,
        year: year
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                selectedEmployeeId: '',
                employeeName: '',
                email: '',
                department: '',
                designation: '',
                dateOfJoining: '',
                basic: '',
                houseRent: '',
                travelExp: '',
                other: '',
                deduction: '',
                grossSalary: '',
                netSalary: '',
                month: month,
                year: year
            });

            // Fetch employees for the dropdown
            const fetchEmployees = async () => {
                setIsLoadingEmployees(true);
                try {
                    const data = await employeeService.getEmployees();
                    // Filter active employees or as per business logic
                    setEmployees(data || []);
                } catch (error) {
                    console.error("Error fetching employees:", error);
                } finally {
                    setIsLoadingEmployees(false);
                }
            };
            fetchEmployees();
        }
    }, [isOpen, month, year]);

    const handleEmployeeSelect = (e) => {
        const employeeId = e.target.value;
        const emp = employees.find(emp => emp._id === employeeId);
        if (emp) {
            // Copy amounts from this employee's salaryDetails only (0 stays 0).
            const toAmt = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const sal = emp.salaryDetails || {};
            const basic = toAmt(sal.basicSalary);
            const houseRent = toAmt(sal.houseRent);
            const travelExp = toAmt(sal.travelExp);
            const other = toAmt(sal.other);
            const deduction = toAmt(sal.deduction);

            const grossSalary = basic + houseRent + travelExp + other;
            const netSalary = grossSalary - deduction;

            setFormData(prev => ({
                ...prev,
                selectedEmployeeId: employeeId,
                employeeName: emp.employeeName,
                email: emp.emailId || '',
                department: emp.department || '',
                designation: emp.designation || emp.role || '',
                dateOfJoining: emp.doj ? new Date(emp.doj).toISOString().split('T')[0] : '',
                basic: basic.toString(),
                houseRent: houseRent.toString(),
                travelExp: travelExp.toString(),
                other: other.toString(),
                deduction: deduction.toString(),
                grossSalary: grossSalary.toFixed(2),
                netSalary: netSalary.toFixed(2)
            }));
        }
    };

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            const basic = Number(updated.basic) || 0;
            const houseRent = Number(updated.houseRent) || 0;
            const travelExp = Number(updated.travelExp) || 0;
            const other = Number(updated.other) || 0;
            const deduction = Number(updated.deduction) || 0;

            const grossSalary = basic + houseRent + travelExp + other;
            const netSalary = grossSalary - deduction;

            updated.grossSalary = grossSalary.toFixed(2);
            updated.netSalary = netSalary.toFixed(2);

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation: Check if slip already exists for this employee/month/year
        // This is a basic frontend check. The backend also handles this via findOneAndUpdate.
        const monthStr = formData.month.trim().toLowerCase();
        const yearStr = formData.year.toString().trim();
        const emailStr = formData.email.trim().toLowerCase();
        
        setIsLoading(true);
        try {
            // Check if slip already exists in the provided list
            const alreadyExists = existingSlips.find(s => 
                s.emailId?.toLowerCase() === emailStr && 
                s.month?.toLowerCase() === monthStr && 
                String(s.year) === yearStr
            );

            if (alreadyExists) {
                if (!window.confirm(`A salary slip for ${formData.employeeName} for ${formData.month} ${formData.year} already exists. Do you want to update it?`)) {
                    setIsLoading(false);
                    return;
                }
            }

            await salarySlipService.createSalarySlip({
                employeeName: formData.employeeName,
                emailId: formData.email,
                department: formData.department,
                designation: formData.designation,
                dateOfJoining: formData.dateOfJoining,
                // Map custom fields to existing backend fields (AED label only, same amounts)
                basicPay: parseFloat(formData.basic) || 0,
                hra: parseFloat(formData.houseRent) || 0,
                conveyanceAllowance: parseFloat(formData.travelExp) || 0,
                otherAllowance: parseFloat(formData.other) || 0,
                grossSalary: parseFloat(formData.grossSalary) || 0,
                totalDeduction: parseFloat(formData.deduction) || 0,
                deductionsPFTax: parseFloat(formData.deduction) || 0,
                netSalary: parseFloat(formData.netSalary) || 0,
                month: formData.month,
                year: formData.year
            });
            showToast("Salary slip created successfully.", "success");
            onSuccess();
            onClose();
        } catch (error) {
            showToast(error.message || "Failed to create salary slip.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Create Salary Slip</h2>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Employee Info Section */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Employee Information</h3>
                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <Dropdown
                                    label="Employee Name *"
                                    placeholder={isLoadingEmployees ? "Loading employees..." : "Search Name or ID..."}
                                    value={formData.selectedEmployeeId}
                                    options={employees.map(emp => ({
                                        label: `${emp.employeeName} (${emp.employeeId || 'No ID'})`,
                                        value: emp._id
                                    }))}
                                    onChange={handleEmployeeSelect}
                                    required
                                    disabled={isLoadingEmployees}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Employee Email *</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="employee@example.com" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Designation *</label>
                                <input type="text" name="designation" value={formData.designation} onChange={handleChange} required placeholder="e.g. Software Engineer" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Date of Joining</label>
                                <DateInput name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Month</label>
                                <input type="text" name="month" value={formData.month} onChange={handleChange} placeholder="e.g. January" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Year</label>
                                <input type="text" name="year" value={formData.year} onChange={handleChange} placeholder="e.g. 2024" />
                            </div>
                        </div>
                    </div>

                    {/* Earnings & Deductions Side by Side */}
                    <div className={styles.twoColumnSection}>
                        {/* Earnings Section */}
                        <div className={styles.column}>
                            <h3 className={styles.sectionTitle}>Earnings</h3>
                            <table className={styles.slipTable}>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>BASIC</td>
                                        <td>
                                            <input type="number" name="basic" value={formData.basic} onChange={handleChange} required placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>HOUSE RENT</td>
                                        <td>
                                            <input type="number" name="houseRent" value={formData.houseRent} onChange={handleChange} required placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>TRAVEL EXP</td>
                                        <td>
                                            <input type="number" name="travelExp" value={formData.travelExp} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>OTHER</td>
                                        <td>
                                            <input type="number" name="other" value={formData.other} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Gross Salary</strong></td>
                                        <td>
                                            <input
                                                type="text"
                                                value={formData.grossSalary ? formatAed(formData.grossSalary) : 'AED 0.00'}
                                                readOnly
                                                className={styles.readOnlyInput}
                                            />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Deductions Section */}
                        <div className={styles.column}>
                            <h3 className={styles.sectionTitle}>Deductions</h3>
                            <table className={styles.slipTable}>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th>Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>DEDUCTION</td>
                                        <td>
                                            <input type="number" name="deduction" value={formData.deduction} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Total Deduction</strong></td>
                                        <td>
                                            <input type="text" value={formData.deduction ? formatAed(formData.deduction) : 'AED 0.00'} readOnly className={styles.readOnlyInput} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Net Payable Section */}
                    <div className={styles.netPayableSection}>
                        <div className={styles.netPayableRow}>
                            <span className={styles.netPayableLabel}>Net Payable</span>
                            <span className={styles.netPayableValue}>
                                {formData.netSalary ? formatAed(formData.netSalary) : 'AED 0.00'}
                            </span>
                        </div>
                        <p className={styles.netPayableNote}>Net Payable = Gross Salary - Total Deduction</p>
                        <p className={styles.netPayableNote}>
                            <strong>Auto Calculations:</strong> HRA = Basic Pay ÷ 2 | Other Allowance = Gross Salary - (Basic Pay + HRA + Conveyance)
                        </p>
                    </div>

                    <div className={styles.modalFooter}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                            {isLoading ? <FaSpinner className={styles.spin} /> : <FaSave />}
                            <span>{isLoading ? 'Creating...' : 'Create Slip'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default SalarySlipManualAddModal;
