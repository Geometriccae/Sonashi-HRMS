import React, { useEffect, useState } from 'react';
import styles from './SalarySlipManualAddModal.module.css';
import { FaTimes, FaSave, FaSpinner } from 'react-icons/fa';
import salarySlipService from '../../services/SalarySlipService';
import employeeService from '../../services/EmployeeService';
import attendanceService from '../../services/AttendanceService';
import { useToast } from '../../context/ToastContext';
import Dropdown from '../DropDown';
import DateInput from '../DateInput';
import { formatAed } from '../../utils/currency';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const createInitialFormData = (month, year) => ({
    selectedEmployeeId: '',
    employeeName: '',
    email: '',
    department: '',
    designation: '',
    dateOfJoining: '',
    totalWorkingDays: '',
    presentDays: '',
    payableDays: '',
    basic: '',
    houseRent: '',
    travelExp: '',
    other: '',
    deduction: '',
    grossSalary: '',
    netSalary: '',
    month,
    year,
});

const createInitialBaseAmounts = () => ({
    basic: 0,
    houseRent: 0,
    travelExp: 0,
    other: 0,
});

const toAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const formatAmount = (value) => (Number.isFinite(value) ? value : 0).toFixed(2);

const toIsoDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const getMonthIndex = (monthValue) => {
    const normalized = String(monthValue || '').trim().toLowerCase();
    return MONTH_NAMES.findIndex((monthName) => monthName.toLowerCase() === normalized);
};

const getPayrollPeriod = (monthValue, yearValue) => {
    const monthIndex = getMonthIndex(monthValue);
    const numericYear = Number(yearValue);
    if (monthIndex < 0 || !Number.isFinite(numericYear)) return null;

    const start = new Date(numericYear, monthIndex, 1);
    const end = new Date(numericYear, monthIndex + 1, 0);

    return {
        monthIndex,
        year: numericYear,
        start,
        end,
        totalCalendarDays: end.getDate(),
    };
};

const getDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const recalculateSalaryFields = (draft, baseAmounts) => {
    const totalWorkingDays = Number(draft.totalWorkingDays);
    const fallbackPayable = draft.payableDays === '' ? totalWorkingDays : Number(draft.payableDays);
    const normalizedPayable = Number.isFinite(fallbackPayable) ? fallbackPayable : 0;
    const ratio = totalWorkingDays > 0 ? Math.max(0, normalizedPayable) / totalWorkingDays : 0;

    const basic = baseAmounts.basic * ratio;
    const houseRent = baseAmounts.houseRent * ratio;
    const travelExp = baseAmounts.travelExp * ratio;
    const other = baseAmounts.other * ratio;
    const grossSalary = basic + houseRent + travelExp + other;
    const deduction = toAmount(draft.deduction);
    const netSalary = grossSalary - deduction;

    return {
        ...draft,
        basic: formatAmount(basic),
        houseRent: formatAmount(houseRent),
        travelExp: formatAmount(travelExp),
        other: formatAmount(other),
        grossSalary: formatAmount(grossSalary),
        netSalary: formatAmount(netSalary),
    };
};

const validateFormData = (data) => {
    const errors = {};
    const totalWorkingDays = Number(data.totalWorkingDays);
    const presentDays = Number(data.presentDays);
    const payableDays = Number(data.payableDays);

    if (data.totalWorkingDays === '' || !Number.isFinite(totalWorkingDays) || totalWorkingDays < 0) {
        errors.totalWorkingDays = 'Total Working Days must be 0 or more.';
    }

    if (data.presentDays === '' || !Number.isFinite(presentDays) || presentDays < 0) {
        errors.presentDays = 'Present Days must be 0 or more.';
    } else if (Number.isFinite(totalWorkingDays) && presentDays > totalWorkingDays) {
        errors.presentDays = 'Present Days cannot be greater than Total Working Days.';
    }

    if (data.payableDays === '' || !Number.isFinite(payableDays) || payableDays < 0) {
        errors.payableDays = 'Payable Days must be 0 or more.';
    } else if (Number.isFinite(totalWorkingDays) && payableDays > totalWorkingDays) {
        errors.payableDays = 'Payable Days cannot be greater than Total Working Days.';
    }

    return errors;
};

function SalarySlipManualAddModal({ isOpen, onClose, onSuccess, month, year, existingSlips = [] }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
    const [baseAmounts, setBaseAmounts] = useState(createInitialBaseAmounts());
    const [formData, setFormData] = useState(createInitialFormData(month, year));
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!isOpen) return;

        setFormData(createInitialFormData(month, year));
        setBaseAmounts(createInitialBaseAmounts());
        setErrors({});

        const fetchEmployees = async () => {
            setIsLoadingEmployees(true);
            try {
                const data = await employeeService.getEmployees();
                setEmployees(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error fetching employees:', error);
            } finally {
                setIsLoadingEmployees(false);
            }
        };

        fetchEmployees();
    }, [isOpen, month, year]);

    useEffect(() => {
        if (!isOpen || !formData.selectedEmployeeId) return;

        const period = getPayrollPeriod(formData.month, formData.year);
        if (!period) return;

        let isMounted = true;

        const loadAttendanceDefaults = async () => {
            setIsLoadingAttendance(true);
            try {
                const rangeRecords = await attendanceService.getByRange(
                    period.start.toISOString().slice(0, 10),
                    period.end.toISOString().slice(0, 10)
                );

                if (!isMounted) return;

                const allRecords = Array.isArray(rangeRecords) ? rangeRecords : [];
                const totalWorkingDaysFromAttendance = new Set(
                    allRecords.map((record) => getDateKey(record.date)).filter(Boolean)
                ).size;

                const employeeRecords = allRecords.filter((record) => {
                    const recordEmployeeId = String(record.employee?._id || record.employee || '');
                    return recordEmployeeId === formData.selectedEmployeeId;
                });

                const presentDays = employeeRecords.filter((record) => record.status === 'Onsite').length;
                const fallbackWorkingDays = period.totalCalendarDays;
                const totalWorkingDays = totalWorkingDaysFromAttendance || fallbackWorkingDays;
                const payableDays = presentDays > 0 ? presentDays : totalWorkingDays;

                setFormData((current) => {
                    if (current.selectedEmployeeId !== formData.selectedEmployeeId) return current;

                    const updated = {
                        ...current,
                        totalWorkingDays: String(totalWorkingDays),
                        presentDays: String(Math.min(presentDays, totalWorkingDays)),
                        payableDays: String(Math.min(payableDays, totalWorkingDays)),
                    };
                    return recalculateSalaryFields(updated, baseAmounts);
                });
                setErrors({});
            } catch (attendanceError) {
                console.error('Error fetching attendance defaults for salary slip:', attendanceError);
            } finally {
                if (isMounted) {
                    setIsLoadingAttendance(false);
                }
            }
        };

        loadAttendanceDefaults();

        return () => {
            isMounted = false;
        };
    }, [isOpen, formData.selectedEmployeeId, formData.month, formData.year]);

    const handleEmployeeSelect = (e) => {
        const employeeId = e.target.value;
        const employee = employees.find((item) => item._id === employeeId);
        if (!employee) return;

        const salary = employee.salaryDetails || {};
        const nextBaseAmounts = {
            basic: toAmount(salary.basicSalary),
            houseRent: toAmount(salary.houseRent),
            travelExp: toAmount(salary.travelExp),
            other: toAmount(salary.other),
        };
        const deduction = toAmount(salary.deduction);
        const payrollPeriod = getPayrollPeriod(formData.month, formData.year);
        const fallbackWorkingDays = payrollPeriod?.totalCalendarDays || 0;

        setBaseAmounts(nextBaseAmounts);
        setErrors({});
        setFormData((current) =>
            recalculateSalaryFields(
                {
                    ...current,
                    selectedEmployeeId: employeeId,
                    employeeName: employee.employeeName || '',
                    email: employee.emailId || '',
                    department: employee.department || '',
                    designation: employee.designation || employee.role || '',
                    dateOfJoining: toIsoDate(employee.doj),
                    totalWorkingDays: fallbackWorkingDays ? String(fallbackWorkingDays) : '',
                    presentDays: '',
                    payableDays: fallbackWorkingDays ? String(fallbackWorkingDays) : '',
                    deduction: formatAmount(deduction),
                },
                nextBaseAmounts
            )
        );
    };

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((current) => {
            const updated = { ...current, [name]: value };

            if (name === 'month' || name === 'year') {
                const payrollPeriod = getPayrollPeriod(
                    name === 'month' ? value : updated.month,
                    name === 'year' ? value : updated.year
                );
                if (payrollPeriod && !updated.selectedEmployeeId && updated.totalWorkingDays === '') {
                    updated.totalWorkingDays = String(payrollPeriod.totalCalendarDays);
                    updated.payableDays = String(payrollPeriod.totalCalendarDays);
                }
            }

            if (['totalWorkingDays', 'payableDays', 'deduction'].includes(name)) {
                return recalculateSalaryFields(updated, baseAmounts);
            }

            if (['basic', 'houseRent', 'travelExp', 'other'].includes(name)) {
                const totalWorkingDays = Number(updated.totalWorkingDays);
                const payableDays = Number(updated.payableDays);
                const ratio = totalWorkingDays > 0 && payableDays >= 0 ? payableDays / totalWorkingDays : 0;
                const normalizedValue = toAmount(value);

                const nextBaseAmounts = {
                    ...baseAmounts,
                    [name]: ratio > 0 ? normalizedValue / ratio : normalizedValue,
                };
                setBaseAmounts(nextBaseAmounts);
                return recalculateSalaryFields(updated, nextBaseAmounts);
            }

            const grossSalary =
                toAmount(updated.basic) +
                toAmount(updated.houseRent) +
                toAmount(updated.travelExp) +
                toAmount(updated.other);
            const netSalary = grossSalary - toAmount(updated.deduction);

            updated.grossSalary = formatAmount(grossSalary);
            updated.netSalary = formatAmount(netSalary);
            return updated;
        });

        setErrors(validateFormData({
            ...formData,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateFormData(formData);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) return;

        const monthStr = formData.month.trim().toLowerCase();
        const yearStr = formData.year.toString().trim();
        const emailStr = formData.email.trim().toLowerCase();

        setIsLoading(true);
        try {
            const alreadyExists = existingSlips.find((slip) =>
                slip.emailId?.toLowerCase() === emailStr &&
                slip.month?.toLowerCase() === monthStr &&
                String(slip.year) === yearStr
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
                totalWorkingDays: parseFloat(formData.totalWorkingDays) || 0,
                presentDays: parseFloat(formData.presentDays) || 0,
                payableDays: parseFloat(formData.payableDays) || 0,
                basicPay: parseFloat(formData.basic) || 0,
                hra: parseFloat(formData.houseRent) || 0,
                conveyanceAllowance: parseFloat(formData.travelExp) || 0,
                otherAllowance: parseFloat(formData.other) || 0,
                grossSalary: parseFloat(formData.grossSalary) || 0,
                totalDeduction: parseFloat(formData.deduction) || 0,
                deductionsPFTax: parseFloat(formData.deduction) || 0,
                netSalary: parseFloat(formData.netSalary) || 0,
                month: formData.month,
                year: formData.year,
            });
            showToast('Salary slip created successfully.', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            showToast(error.message || 'Failed to create salary slip.', 'error');
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
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Employee Information</h3>
                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <Dropdown
                                    label="Employee Name *"
                                    placeholder={isLoadingEmployees ? 'Loading employees...' : 'Search Name or ID...'}
                                    value={formData.selectedEmployeeId}
                                    options={employees.map((employee) => ({
                                        label: `${employee.employeeName} (${employee.employeeId || 'No ID'})`,
                                        value: employee._id,
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
                                <label>Department</label>
                                <input type="text" name="department" value={formData.department} onChange={handleChange} placeholder="Department" />
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
                            <div className={styles.inputGroup}>
                                <label>Total Working Days</label>
                                <input type="number" name="totalWorkingDays" value={formData.totalWorkingDays} onChange={handleChange} min="0" placeholder="0" />
                                {errors.totalWorkingDays ? <span className={styles.validationError}>{errors.totalWorkingDays}</span> : null}
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Present Days</label>
                                <input type="number" name="presentDays" value={formData.presentDays} onChange={handleChange} min="0" placeholder="0" />
                                {errors.presentDays ? <span className={styles.validationError}>{errors.presentDays}</span> : null}
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Payable Days</label>
                                <input type="number" name="payableDays" value={formData.payableDays} onChange={handleChange} min="0" placeholder="0" />
                                {errors.payableDays ? <span className={styles.validationError}>{errors.payableDays}</span> : null}
                                {isLoadingAttendance ? <span className={styles.helperText}>Loading attendance defaults...</span> : null}
                            </div>
                        </div>
                    </div>

                    <div className={styles.twoColumnSection}>
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
