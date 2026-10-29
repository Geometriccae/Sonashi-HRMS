import React, { useEffect, useState, useCallback } from 'react';
import styles from './SalarySlipManualAddModal.module.css'; // reuse existing styles
import advStyles from './SalaryAdvanceModal.module.css';
import { FaTimes, FaSave, FaSpinner, FaPlus, FaTrash } from 'react-icons/fa';
import employeeService from '../../services/EmployeeService';
import salaryAdvanceService from '../../services/SalaryAdvanceService';
import { useToast } from '../../context/ToastContext';
import DateInput from '../DateInput';

const toAmount = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const today = () => new Date().toISOString().split('T')[0];

const emptyRow = (employees) => ({
  _key: Math.random().toString(36).slice(2),
  selectedEmployeeId: '',
  employeeName: '',
  employeeCode: '',
  department: '',
  designation: '',
  company: '',
  amount: '',
  advanceDate: today(),
  remarks: '',
  // salary info (display only)
  basicSalary: '',
  grossSalary: '',
});

/**
 * Multi-employee salary advance creation modal.
 *
 * Props:
 *   isOpen      {boolean}
 *   onClose     {function}
 *   onSuccess   {function}
 */
function SalaryAdvanceModal({ isOpen, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);

  // Load employee list once when opened
  useEffect(() => {
    if (!isOpen) return;
    setRows([emptyRow()]);

    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const data = await employeeService.getEmployees();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        showToast('Failed to load employee list.', 'error');
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleRemoveRow = (key) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r._key !== key)));

  const handleEmployeeSelect = (key, employeeId) => {
    const emp = employees.find((e) => e._id === employeeId);
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        if (!emp) return { ...r, selectedEmployeeId: '' };

        const sal = emp.salaryDetails || {};
        const basicSalary = toAmount(sal.basicSalary);
        const gross = basicSalary + toAmount(sal.houseRent) + toAmount(sal.travelExp) + toAmount(sal.other);

        return {
          ...r,
          selectedEmployeeId: emp._id,
          employeeName: emp.employeeName || '',
          employeeCode: emp.employeeId || '',
          department: emp.department || '',
          designation: emp.designation || emp.role || '',
          company: emp.company || '',
          basicSalary: basicSalary > 0 ? basicSalary.toFixed(2) : '',
          grossSalary: gross > 0 ? gross.toFixed(2) : '',
        };
      })
    );
  };

  const handleRowChange = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  };

  const validate = () => {
    for (const row of rows) {
      if (!row.selectedEmployeeId) return 'Please select an employee for every row.';
      const amt = parseFloat(row.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return `Amount must be a positive number for ${row.employeeName || 'one of the employees'}.`;
      }
      if (!row.advanceDate) return 'Advance date is required for all rows.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      showToast(err, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const advances = rows.map((r) => ({
        employeeId: r.selectedEmployeeId,
        amount: parseFloat(r.amount),
        advanceDate: r.advanceDate,
        remarks: r.remarks || '',
      }));

      const result = await salaryAdvanceService.createAdvances(advances);

      if (result.errors && result.errors.length > 0) {
        const errNames = result.errors.map((e) => e.employeeId || e.error).join(', ');
        showToast(`${result.created.length} created, ${result.errors.length} failed: ${errNames}`, 'error');
      } else {
        showToast(result.message || `${result.created.length} advance(s) created.`, 'success');
      }

      onSuccess && onSuccess(result);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to create advances.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const employeeOptions = employees.filter((emp) => {
    // Only active / working employees are eligible for advances
    const status = String(emp.employeeStatus || '').toLowerCase();
    return !['inactive', 'resigned', 'terminated'].includes(status);
  });

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modalContent} ${advStyles.advanceModal}`}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2>Create Salary Advance</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSubmitting} type="button">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={advStyles.hint}>
            Enter advance details for one or more employees. Click <strong>+ Add Employee</strong> to add more rows.
          </p>

          {/* Employee rows */}
          <div className={advStyles.rowsContainer}>
            {rows.map((row, idx) => (
              <div key={row._key} className={advStyles.employeeCard}>
                {/* Card header */}
                <div className={advStyles.cardHeader}>
                  <span className={advStyles.cardIndex}>#{idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className={advStyles.removeRowBtn}
                      onClick={() => handleRemoveRow(row._key)}
                      title="Remove this row"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>

                {/* Employee selector */}
                <div className={styles.grid}>
                  <div className={styles.inputGroup}>
                    <label>Employee *</label>
                    {isLoadingEmployees ? (
                      <input readOnly value="Loading…" className={styles.readOnlyInput} />
                    ) : (
                      <select
                        value={row.selectedEmployeeId}
                        onChange={(e) => handleEmployeeSelect(row._key, e.target.value)}
                        className={advStyles.select}
                        required
                      >
                        <option value="">— Select Employee —</option>
                        {employeeOptions.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.employeeName}
                            {emp.employeeId ? ` (${emp.employeeId})` : ''}
                            {emp.department ? ` — ${emp.department}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Auto-filled employee info */}
                {row.selectedEmployeeId && (
                  <div className={advStyles.empInfo}>
                    {row.employeeCode && (
                      <span><strong>ID:</strong> {row.employeeCode}</span>
                    )}
                    {row.department && (
                      <span><strong>Dept:</strong> {row.department}</span>
                    )}
                    {row.designation && (
                      <span><strong>Desig:</strong> {row.designation}</span>
                    )}
                    {row.company && (
                      <span><strong>Co:</strong> {row.company}</span>
                    )}
                    {row.grossSalary && (
                      <span><strong>Gross:</strong> AED {Number(row.grossSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                )}

                {/* Amount, Date, Remarks */}
                <div className={styles.grid}>
                  <div className={styles.inputGroup}>
                    <label>Advance Amount (AED) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => handleRowChange(row._key, 'amount', e.target.value)}
                      className={advStyles.amountInput}
                      required
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Advance Date *</label>
                    <DateInput
                      name="advanceDate"
                      value={row.advanceDate}
                      onChange={(e) => handleRowChange(row._key, 'advanceDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Remarks</label>
                  <input
                    type="text"
                    placeholder="Optional note"
                    value={row.remarks}
                    onChange={(e) => handleRowChange(row._key, 'remarks', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add row button */}
          <button type="button" className={advStyles.addRowBtn} onClick={handleAddRow}>
            <FaPlus style={{ marginRight: 6 }} /> Add Employee
          </button>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? <FaSpinner className={advStyles.spin} /> : <FaSave />}
              &nbsp;{isSubmitting ? 'Saving…' : `Save ${rows.length > 1 ? `${rows.length} Advances` : 'Advance'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SalaryAdvanceModal;
