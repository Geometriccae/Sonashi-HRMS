import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './SalarySlipManualAddModal.module.css'; // reuse existing modal chrome styles
import advStyles from './SalaryAdvanceModal.module.css';
import { FaTimes, FaSave, FaSpinner, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import employeeService from '../../services/EmployeeService';
import salaryAdvanceService from '../../services/SalaryAdvanceService';
import { useToast } from '../../context/ToastContext';
import DateInput from '../DateInput';

/* ─── helpers ──────────────────────────────────────────────── */
const toAmount = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const today = () => new Date().toISOString().split('T')[0];

const emptyRow = () => ({
  _key: Math.random().toString(36).slice(2),
  selectedEmployeeId: '',
  employeeName: '',
  employeeCode: '',
  department: '',
  designation: '',
  company: '',
  grossSalary: '',
  amount: '',
  advanceDate: today(),
  remarks: '',
  // searchable picker state
  searchText: '',
  pickerOpen: false,
});

/* ─── Searchable Employee Picker ───────────────────────────── */
/**
 * A text-input + dropdown that lets the user type to filter employees.
 *
 * Props:
 *   employees       {Array}   full list
 *   value           {string}  selected employee _id ('' = none)
 *   displayValue    {string}  text to show in the input when an emp is selected
 *   searchText      {string}
 *   isOpen          {boolean}
 *   onChange        (employeeId) => void
 *   onSearchChange  (text) => void
 *   onOpen          () => void
 *   onClose         () => void
 *   disabled        {boolean}
 */
function EmployeePicker({
  employees,
  value,
  displayValue,
  searchText,
  isOpen,
  onChange,
  onSearchChange,
  onOpen,
  onClose,
  disabled,
}) {
  const wrapperRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const query = searchText.toLowerCase().trim();
  const filtered = query
    ? employees.filter(
        (emp) =>
          emp.employeeName?.toLowerCase().includes(query) ||
          emp.employeeId?.toLowerCase().includes(query) ||
          emp.department?.toLowerCase().includes(query) ||
          emp.designation?.toLowerCase().includes(query)
      )
    : employees;

  const handleInputChange = (e) => {
    onSearchChange(e.target.value);
    if (!isOpen) onOpen();
  };

  const handleSelect = (emp) => {
    onChange(emp._id);
    onClose();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    onSearchChange('');
    onOpen();
  };

  const inputValue = isOpen ? searchText : displayValue || searchText;

  return (
    <div ref={wrapperRef} className={advStyles.pickerWrapper}>
      <div className={advStyles.pickerInputRow}>
        <FaSearch className={advStyles.pickerSearchIcon} />
        <input
          type="text"
          className={advStyles.pickerInput}
          placeholder="Search by name, ID, department…"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={onOpen}
          disabled={disabled}
          autoComplete="off"
        />
        {(value || searchText) && !disabled && (
          <button
            type="button"
            className={advStyles.pickerClearBtn}
            onClick={handleClear}
            title="Clear selection"
          >
            <FaTimes size={11} />
          </button>
        )}
        <button
          type="button"
          className={advStyles.pickerToggleBtn}
          onClick={isOpen ? onClose : onOpen}
          disabled={disabled}
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className={advStyles.pickerDropdown}>
          {filtered.length === 0 ? (
            <div className={advStyles.pickerEmpty}>No employees match "{searchText}"</div>
          ) : (
            <ul className={advStyles.pickerList}>
              {filtered.slice(0, 100).map((emp) => (
                <li
                  key={emp._id}
                  className={`${advStyles.pickerItem} ${emp._id === value ? advStyles.pickerItemSelected : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus on input briefly so blur doesn't fire first
                    handleSelect(emp);
                  }}
                >
                  <span className={advStyles.pickerEmpName}>{emp.employeeName}</span>
                  <span className={advStyles.pickerEmpMeta}>
                    {[emp.employeeId, emp.department, emp.designation]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
              {filtered.length > 100 && (
                <li className={advStyles.pickerMore}>
                  +{filtered.length - 100} more — refine your search
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Modal ────────────────────────────────────────────── */
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

  /* ── row helpers ── */
  const handleAddRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleRemoveRow = (key) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r._key !== key)));

  /** Fill employee details into a row when an employee is selected. */
  const handleEmployeeSelect = useCallback(
    (key, employeeId) => {
      const emp = employees.find((e) => e._id === employeeId);
      setRows((prev) =>
        prev.map((r) => {
          if (r._key !== key) return r;
          if (!emp) {
            return { ...r, selectedEmployeeId: '', employeeName: '', employeeCode: '', department: '', designation: '', company: '', grossSalary: '', searchText: '', pickerOpen: false };
          }
          const sal = emp.salaryDetails || {};
          const gross = toAmount(sal.basicSalary) + toAmount(sal.houseRent) + toAmount(sal.travelExp) + toAmount(sal.other);
          return {
            ...r,
            selectedEmployeeId: emp._id,
            employeeName: emp.employeeName || '',
            employeeCode: emp.employeeId || '',
            department: emp.department || '',
            designation: emp.designation || emp.role || '',
            company: emp.company || '',
            grossSalary: gross > 0 ? gross.toFixed(2) : '',
            searchText: emp.employeeName || '',
            pickerOpen: false,
          };
        })
      );
    },
    [employees]
  );

  const handlePickerSearch = (key, text) =>
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, searchText: text, selectedEmployeeId: text ? r.selectedEmployeeId : '' } : r))
    );

  const handlePickerOpen = (key) =>
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, pickerOpen: true } : { ...r, pickerOpen: false }))
    );

  const handlePickerClose = (key) =>
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, pickerOpen: false } : r)));

  const handleRowChange = (key, field, value) =>
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));

  /* ── validation ── */
  const validate = () => {
    for (const row of rows) {
      if (!row.selectedEmployeeId) return 'Please select a valid employee for every row.';
      const amt = parseFloat(row.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return `Amount must be a positive number for ${row.employeeName || 'one of the employees'}.`;
      }
      if (!row.advanceDate) return 'Advance date is required for all rows.';
    }
    return null;
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { showToast(err, 'error'); return; }

    setIsSubmitting(true);
    try {
      const advances = rows.map((r) => ({
        employeeId: r.selectedEmployeeId,
        amount: parseFloat(r.amount),
        advanceDate: r.advanceDate,
        remarks: r.remarks || '',
      }));

      const result = await salaryAdvanceService.createAdvances(advances);

      if (result.errors?.length) {
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

  const eligibleEmployees = employees.filter((emp) => {
    const status = String(emp.employeeStatus || '').toLowerCase();
    return !['inactive', 'resigned', 'terminated'].includes(status);
  });

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
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
            Search and select employees, enter the advance amount for each, then save.
            Click <strong>+ Add Employee</strong> to add multiple rows.
          </p>

          <div className={advStyles.rowsContainer}>
            {rows.map((row, idx) => (
              <div key={row._key} className={advStyles.employeeCard}>
                {/* Card header */}
                <div className={advStyles.cardHeader}>
                  <span className={advStyles.cardIndex}>Employee #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className={advStyles.removeRowBtn}
                      onClick={() => handleRemoveRow(row._key)}
                      title="Remove this row"
                    >
                      <FaTrash size={13} />
                    </button>
                  )}
                </div>

                {/* Searchable employee picker */}
                <div className={styles.inputGroup}>
                  <label>Employee *</label>
                  {isLoadingEmployees ? (
                    <div className={advStyles.loadingPill}>
                      <FaSpinner className={advStyles.spin} /> Loading employees…
                    </div>
                  ) : (
                    <EmployeePicker
                      employees={eligibleEmployees}
                      value={row.selectedEmployeeId}
                      displayValue={row.employeeName}
                      searchText={row.searchText}
                      isOpen={row.pickerOpen}
                      onChange={(id) => handleEmployeeSelect(row._key, id)}
                      onSearchChange={(text) => handlePickerSearch(row._key, text)}
                      onOpen={() => handlePickerOpen(row._key)}
                      onClose={() => handlePickerClose(row._key)}
                      disabled={isSubmitting}
                    />
                  )}
                </div>

                {/* Auto-filled employee info chips */}
                {row.selectedEmployeeId && (
                  <div className={advStyles.empInfo}>
                    {row.employeeCode && <span><strong>ID:</strong> {row.employeeCode}</span>}
                    {row.department   && <span><strong>Dept:</strong> {row.department}</span>}
                    {row.designation  && <span><strong>Desig:</strong> {row.designation}</span>}
                    {row.company      && <span><strong>Co:</strong> {row.company}</span>}
                    {row.grossSalary  && (
                      <span>
                        <strong>Gross:</strong> AED{' '}
                        {Number(row.grossSalary).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
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

          {/* Add-row button */}
          <button type="button" className={advStyles.addRowBtn} onClick={handleAddRow} disabled={isSubmitting}>
            <FaPlus style={{ marginRight: 6 }} /> Add Employee
          </button>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? <FaSpinner className={advStyles.spin} /> : <FaSave />}
              &nbsp;{isSubmitting
                ? 'Saving…'
                : `Save ${rows.length > 1 ? `${rows.length} Advances` : 'Advance'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SalaryAdvanceModal;
