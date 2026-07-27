import React, { useState, useEffect } from 'react';
import styles from './SalarySlipManualAddModal.module.css';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import salarySlipService from '../../services/SalarySlipService';
import { useToast } from '../../context/ToastContext';
import DateInput from '../DateInput';
import { inrToAed, aedToInr, formatAed } from '../../utils/currency';

function SalarySlipEditModal({ isOpen, onClose, onSuccess, salarySlip }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        employeeName: '',
        email: '',
        department: '',
        designation: '',
        dateOfJoining: '',
        // Earnings
        basicPay: '',
        hra: '',
        conveyanceAllowance: '',
        otherAllowance: '',
        // Deductions
        advance: '',
        leave: '',
        staffLoan: '',
        profTax: '',
        incomeTaxTDS: '',
        // Calculated fields
        grossSalary: '',
        totalDeduction: '',
        netSalary: '',
        month: '',
        year: ''
    });

    useEffect(() => {
        if (salarySlip && isOpen) {
            // Stored values are INR — show AED in the form (1 AED = 26.20 INR)
            const basicPay = inrToAed(salarySlip.basicPay || 0);
            const hra = inrToAed(salarySlip.hra || 0);
            const conveyanceAllowance = inrToAed(salarySlip.conveyanceAllowance || 0);
            const otherAllowance = inrToAed(salarySlip.otherAllowance || 0);
            let advance = inrToAed(salarySlip.advance || 0);
            const leave = inrToAed(salarySlip.leave || 0);
            const staffLoan = inrToAed(salarySlip.staffLoan || 0);
            const profTax = inrToAed(salarySlip.profTax || 0);
            const incomeTaxTDS = inrToAed(salarySlip.incomeTaxTDS || 0);

            // If we have a total/legacy deduction but no breakdown, put it in 'advance' so it's visible
            const hasBreakdown = (advance + leave + staffLoan + profTax + incomeTaxTDS) > 0;
            const legacyDeduction = inrToAed(salarySlip.deductionsPFTax || salarySlip.totalDeduction || 0);
            if (!hasBreakdown && legacyDeduction > 0) {
                advance = legacyDeduction;
            }

            const grossSalary = salarySlip.grossSalary != null
                ? inrToAed(salarySlip.grossSalary)
                : (basicPay + hra + conveyanceAllowance + otherAllowance);
            const totalDeduction = salarySlip.totalDeduction != null
                ? inrToAed(salarySlip.totalDeduction)
                : ((advance + leave + staffLoan + profTax + incomeTaxTDS) || legacyDeduction || 0);
            const netSalary = salarySlip.netSalary != null
                ? inrToAed(salarySlip.netSalary)
                : (grossSalary - totalDeduction);

            setFormData({
                employeeName: salarySlip.employeeName || '',
                email: (salarySlip.emailId && !salarySlip.emailId.includes('import.hrms.placeholder')) 
                    ? salarySlip.emailId 
                    : '-',
                department: salarySlip.department || '',
                designation: salarySlip.designation || '',
                dateOfJoining: salarySlip.dateOfJoining || '',
                basicPay: basicPay.toString(),
                hra: hra.toString(),
                conveyanceAllowance: conveyanceAllowance.toString(),
                otherAllowance: otherAllowance.toString(),
                advance: advance.toString(),
                leave: leave.toString(),
                staffLoan: staffLoan.toString(),
                profTax: profTax.toString(),
                incomeTaxTDS: incomeTaxTDS.toString(),
                grossSalary: grossSalary.toFixed(2),
                totalDeduction: totalDeduction.toFixed(2),
                netSalary: netSalary.toFixed(2),
                month: salarySlip.month || '',
                year: salarySlip.year || ''
            });
        }
    }, [salarySlip, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Auto-calculate Gross Salary, Total Deduction, and Net Salary
            const earningFields = ['basicPay', 'hra', 'conveyanceAllowance', 'otherAllowance'];
            const deductionFields = ['advance', 'leave', 'staffLoan', 'profTax', 'incomeTaxTDS'];

            if (earningFields.includes(name) || deductionFields.includes(name)) {
                // Calculate Gross Salary (sum of all earnings)
                const basicPay = parseFloat(updated.basicPay) || 0;
                const hra = parseFloat(updated.hra) || 0;
                const conveyanceAllowance = parseFloat(updated.conveyanceAllowance) || 0;
                const otherAllowance = parseFloat(updated.otherAllowance) || 0;
                const grossSalary = basicPay + hra + conveyanceAllowance + otherAllowance;

                // Calculate Total Deduction (sum of all deductions)
                const advance = parseFloat(updated.advance) || 0;
                const leave = parseFloat(updated.leave) || 0;
                const staffLoan = parseFloat(updated.staffLoan) || 0;
                const profTax = parseFloat(updated.profTax) || 0;
                const incomeTaxTDS = parseFloat(updated.incomeTaxTDS) || 0;
                const totalDeduction = advance + leave + staffLoan + profTax + incomeTaxTDS;

                // Calculate Net Payable
                const netSalary = grossSalary - totalDeduction;

                updated.grossSalary = grossSalary.toFixed(2);
                updated.totalDeduction = totalDeduction.toFixed(2);
                updated.netSalary = netSalary.toFixed(2);
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await salarySlipService.updateSalarySlip(salarySlip._id, {
                employeeName: formData.employeeName,
                emailId: formData.email,
                department: formData.department,
                designation: formData.designation,
                dateOfJoining: formData.dateOfJoining,
                // Earnings — form is AED; persist as INR for existing storage
                basicPay: aedToInr(formData.basicPay),
                hra: aedToInr(formData.hra),
                conveyanceAllowance: aedToInr(formData.conveyanceAllowance),
                otherAllowance: aedToInr(formData.otherAllowance),
                grossSalary: aedToInr(formData.grossSalary),
                // Deductions
                advance: aedToInr(formData.advance),
                leave: aedToInr(formData.leave),
                staffLoan: aedToInr(formData.staffLoan),
                profTax: aedToInr(formData.profTax),
                incomeTaxTDS: aedToInr(formData.incomeTaxTDS),
                totalDeduction: aedToInr(formData.totalDeduction),
                // Legacy field for backward compatibility
                deductionsPFTax: aedToInr(formData.totalDeduction),
                netSalary: aedToInr(formData.netSalary),
                month: formData.month,
                year: formData.year
            });
            showToast("Salary slip updated successfully.", "success");
            onSuccess();
            onClose();
        } catch (error) {
            showToast(error.message || "Failed to update salary slip.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Edit Salary Slip</h2>
                    <button onClick={onClose} className={styles.closeBtn}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Employee Info Section */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Employee Information</h3>
                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <label>Employee Name *</label>
                                <input type="text" name="employeeName" value={formData.employeeName} onChange={handleChange} required placeholder="Full Name" />
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
                                <input type="text" value={formData.month} readOnly className={styles.readOnlyInput} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Year</label>
                                <input type="text" value={formData.year} readOnly className={styles.readOnlyInput} />
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
                                        <td>Basic Pay</td>
                                        <td>
                                            <input type="number" name="basicPay" value={formData.basicPay} onChange={handleChange} required placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>HRA (House Rent Allowance)</td>
                                        <td>
                                            <input type="number" name="hra" value={formData.hra} onChange={handleChange} required placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Conveyance Allowance</td>
                                        <td>
                                            <input type="number" name="conveyanceAllowance" value={formData.conveyanceAllowance} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Other Allowance</td>
                                        <td>
                                            <input type="number" name="otherAllowance" value={formData.otherAllowance} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Gross Salary</strong></td>
                                        <td>
                                            <input type="text" value={formData.grossSalary ? formatAed(formData.grossSalary) : 'AED 0.00'} readOnly className={styles.readOnlyInput} />
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
                                        <td>Advance</td>
                                        <td>
                                            <input type="number" name="advance" value={formData.advance} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Leave</td>
                                        <td>
                                            <input type="number" name="leave" value={formData.leave} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Staff Loan</td>
                                        <td>
                                            <input type="number" name="staffLoan" value={formData.staffLoan} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Prof. Tax</td>
                                        <td>
                                            <input type="number" name="profTax" value={formData.profTax} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Income Tax/TDS</td>
                                        <td>
                                            <input type="number" name="incomeTaxTDS" value={formData.incomeTaxTDS} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalRow}>
                                        <td><strong>Total Deduction</strong></td>
                                        <td>
                                            <input type="text" value={formData.totalDeduction ? formatAed(formData.totalDeduction) : 'AED 0.00'} readOnly className={styles.readOnlyInput} />
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
                    </div>

                    <div className={styles.modalFooter}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                            {isLoading ? <FaSpinner className={styles.spin} /> : <FaSave />}
                            <span>{isLoading ? 'Updating...' : 'Update Slip'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default SalarySlipEditModal;
