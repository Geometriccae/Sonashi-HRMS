import React, { useState, useEffect } from 'react';
import styles from './SalarySlipManualAddModal.module.css';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import salarySlipService from '../../services/SalarySlipService';
import { useToast } from '../../context/ToastContext';

function SalarySlipEditModal({ isOpen, onClose, onSuccess, salarySlip }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        employeeName: '',
        email: '',
        designation: '',
        basicPay: '',
        hra: '',
        deductions: '',
        netSalary: '',
        month: '',
        year: ''
    });

    useEffect(() => {
        if (salarySlip && isOpen) {
            setFormData({
                employeeName: salarySlip.employeeName || '',
                email: salarySlip.emailId || '',
                designation: salarySlip.designation || '',
                basicPay: salarySlip.basicPay?.toString() || '',
                hra: salarySlip.hra?.toString() || '',
                deductions: salarySlip.deductionsPFTax?.toString() || '',
                netSalary: salarySlip.netSalary?.toString() || '',
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

            // Auto-calculate net salary if salary fields change
            if (['basicPay', 'hra', 'deductions'].includes(name)) {
                const basic = parseFloat(updated.basicPay) || 0;
                const hra = parseFloat(updated.hra) || 0;
                const ded = parseFloat(updated.deductions) || 0;
                updated.netSalary = (basic + hra - ded).toString();
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
                designation: formData.designation,
                basicPay: parseFloat(formData.basicPay) || 0,
                hra: parseFloat(formData.hra) || 0,
                deductionsPFTax: parseFloat(formData.deductions) || 0,
                netSalary: parseFloat(formData.netSalary) || 0,
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
                            <label>Basic Pay (₹) *</label>
                            <input type="number" name="basicPay" value={formData.basicPay} onChange={handleChange} required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>HRA (₹) *</label>
                            <input type="number" name="hra" value={formData.hra} onChange={handleChange} required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Deductions (₹) *</label>
                            <input type="number" name="deductions" value={formData.deductions} onChange={handleChange} required />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Net Salary (₹)</label>
                            <input type="number" name="netSalary" value={formData.netSalary} readOnly className={styles.readOnlyInput} />
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
