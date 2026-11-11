import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './SalarySlipManualAddModal.module.css'; // reuse existing modal chrome styles
import advStyles from './SalaryAdvanceModal.module.css';
import historyStyles from './OffCycleHistoryModal.module.css';
import {
  FaTimes,
  FaSave,
  FaSpinner,
  FaPlus,
  FaTrash,
  FaSearch,
  FaDownload,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
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
  searchText: '',
  pickerOpen: false,
});

/* ─── Searchable Employee Picker ───────────────────────────── */
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
                    e.preventDefault();
                    handleSelect(emp);
                  }}
                >
                  <span className={advStyles.pickerEmpName}>{emp.employeeName}</span>
                  <span className={advStyles.pickerEmpMeta}>
                    {[emp.employeeId, emp.department, emp.designation].filter(Boolean).join(' · ')}
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
function SalaryAdvanceModal({ isOpen, onClose, onSuccess, initialType = 'advance' }) {
  const { showToast } = useToast();

  // Top tab: 'create' | 'history'
  const [activeTab, setActiveTab] = useState('create');

  // Form states
  const [paymentType, setPaymentType] = useState(initialType);
  const [period, setPeriod] = useState('');
  const [disbursementDate, setDisbursementDate] = useState(today());
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);

  // Post-submit SIF export prompt state
  const [createdBatch, setCreatedBatch] = useState(null);
  const [isExportingSif, setIsExportingSif] = useState(false);

  // History states
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [exportingHistoryBatchId, setExportingHistoryBatchId] = useState(null);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const data = await salaryAdvanceService.getBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load off-cycle batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  // Sync initial type and reset state on open
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('create');
    setPaymentType(initialType || 'advance');
    setCreatedBatch(null);
    setRows([emptyRow()]);
    setDisbursementDate(today());

    const curYear = new Date().getFullYear();
    const curQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    setPeriod(`Q${curQuarter} ${curYear}`);

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
    fetchBatches();
  }, [isOpen, initialType, fetchBatches]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── row helpers ── */
  const handleAddRow = () => setRows((prev) => [...prev, { ...emptyRow(), advanceDate: disbursementDate }]);

  const handleRemoveRow = (key) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r._key !== key)));

  const handleEmployeeSelect = useCallback(
    (key, employeeId) => {
      const emp = employees.find((e) => e._id === employeeId);
      setRows((prev) =>
        prev.map((r) => {
          if (r._key !== key) return r;
          if (!emp) {
            return {
              ...r,
              selectedEmployeeId: '',
              employeeName: '',
              employeeCode: '',
              department: '',
              designation: '',
              company: '',
              grossSalary: '',
              searchText: '',
              pickerOpen: false,
            };
          }
          const sal = emp.salaryDetails || {};
          const gross =
            toAmount(sal.basicSalary) +
            toAmount(sal.houseRent) +
            toAmount(sal.travelExp) +
            toAmount(sal.other);
          return {
            ...r,
            selectedEmployeeId: emp._id,
            employeeName: emp.employeeName || '',
            employeeCode: emp.employeeId || '',
            department: emp.department || '',
            designation: emp.designation || emp.role || '',
            company: emp.company || emp.office || '',
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
      prev.map((r) =>
        r._key === key ? { ...r, searchText: text, selectedEmployeeId: text ? r.selectedEmployeeId : '' } : r
      )
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
    }
    if (!disbursementDate) return 'Payment date is required.';
    if (paymentType === 'commission' && !period) return 'Commission period is required.';
    return null;
  };

  /* ── submit with optional immediate SIF download ── */
  const handleSubmit = async (e, shouldDownloadSif = false) => {
    if (e && e.preventDefault) e.preventDefault();
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
        advanceDate: disbursementDate,
        remarks: r.remarks || '',
      }));

      const payload = {
        type: paymentType,
        period: paymentType === 'commission' ? period : '',
        advanceDate: disbursementDate,
        advances,
      };

      const result = await salaryAdvanceService.createAdvances(payload);

      if (result.errors?.length) {
        const errNames = result.errors.map((e) => e.employeeId || e.error).join(', ');
        showToast(`${result.created.length} created, ${result.errors.length} failed: ${errNames}`, 'error');
      } else {
        showToast(result.message || `${result.created.length} item(s) created successfully.`, 'success');
      }

      onSuccess && onSuccess(result);
      fetchBatches();

      const batchSummary = {
        batchId: result.batchId,
        type: result.type || paymentType,
        count: result.created?.length || 0,
        totalAmount: result.totalAmount || 0,
      };

      if (result.created?.length > 0) {
        setCreatedBatch(batchSummary);

        if (shouldDownloadSif && result.batchId) {
          setIsExportingSif(true);
          try {
            const sifRes = await salaryAdvanceService.exportSif({
              batchId: result.batchId,
              type: result.type || paymentType,
              rows,
              employees,
            });
            if (sifRes.multipleEmployers) {
              showToast(sifRes.message, 'info');
            } else {
              showToast(`SIF exported: ${sifRes.fileName}`, 'success');
            }
          } catch (sifErr) {
            console.error('SIF export error:', sifErr);
            showToast(`Saved, but SIF download failed: ${sifErr.message}`, 'error');
          } finally {
            setIsExportingSif(false);
          }
        }
      } else {
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create transactions.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSif = async () => {
    if (!createdBatch) return;
    setIsExportingSif(true);
    try {
      const res = await salaryAdvanceService.exportSif({
        batchId: createdBatch.batchId,
        type: createdBatch.type,
        rows,
        employees,
      });

      showToast(`SIF exported successfully: ${res.fileName}`, 'success');
      fetchBatches();
    } catch (err) {
      console.error('SIF export error:', err);
      showToast(err.message || 'Failed to export SIF', 'error');
    } finally {
      setIsExportingSif(false);
    }
  };

  const handleExportHistoryBatchSif = async (batch) => {
    setExportingHistoryBatchId(batch.batchId);
    try {
      const advanceIds =
        Array.isArray(batch.items) && batch.items.length
          ? batch.items.map((i) => i._id || i.id).filter(Boolean)
          : [];
      const result = await salaryAdvanceService.exportSif({
        batchId: batch.batchId,
        advanceIds: advanceIds.length ? advanceIds : undefined,
        type: batch.type,
        batch,
        employees,
      });
      showToast(`SIF downloaded for ${batch.batchId}`, 'success');
      fetchBatches();
    } catch (err) {
      showToast(err.message || 'Failed to export SIF', 'error');
    } finally {
      setExportingHistoryBatchId(null);
    }
  };

  if (!isOpen) return null;

  const eligibleEmployees = employees.filter((emp) => {
    const status = String(emp.employeeStatus || '').toLowerCase();
    return !['inactive', 'resigned', 'terminated'].includes(status);
  });

  const isAdvance = paymentType === 'advance';

  const filteredBatches = batches.filter((b) => {
    if (historyTypeFilter !== 'all' && b.type !== historyTypeFilter) return false;
    return true;
  });

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className={`${styles.modalContent} ${advStyles.advanceModal}`} style={{ maxWidth: 880 }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              Salary Advance &amp; Off-Cycle SIF
            </h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSubmitting} type="button">
            <FaTimes />
          </button>
        </div>

        {/* Top View Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0 20px',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setCreatedBatch(null);
            }}
            style={{
              padding: '12px 18px',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'create' ? '2px solid #0f766e' : '2px solid transparent',
              color: activeTab === 'create' ? '#0f766e' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FaPlus size={11} /> Create Advance / Commission
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchBatches();
            }}
            style={{
              padding: '12px 18px',
              fontSize: 13,
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'history' ? '2px solid #0f766e' : '2px solid transparent',
              color: activeTab === 'history' ? '#0f766e' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FaDownload size={11} /> SIF Batches &amp; History
            {batches.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: '#e2e8f0',
                  color: '#475569',
                  padding: '1px 7px',
                  borderRadius: 10,
                }}
              >
                {batches.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: CREATE ADVANCE / COMMISSION */}
        {activeTab === 'create' && (
          <>
            {createdBatch ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <FaCheckCircle style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 20, color: '#0f172a' }}>
                  {createdBatch.type === 'advance' ? 'Salary Advance Batch Saved!' : 'Commission Payout Batch Saved!'}
                </h3>
                <p style={{ color: '#475569', fontSize: 14, margin: '0 0 16px 0' }}>
                  Batch ID: <strong>{createdBatch.batchId}</strong> · {createdBatch.count} employee(s) · Total:{' '}
                  <strong>
                    AED{' '}
                    {Number(createdBatch.totalAmount || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </p>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 20,
                    textAlign: 'left',
                    fontSize: 13,
                    color: '#334155',
                  }}
                >
                  <strong>UAE WPS SIF Ready:</strong> You can download the SIF file now or access it later from the{' '}
                  <strong>SIF Batches &amp; History</strong> tab.
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    style={{
                      background: '#0284c7',
                      borderColor: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={handleDownloadSif}
                    disabled={isExportingSif}
                  >
                    {isExportingSif ? <FaSpinner className={advStyles.spin} /> : <FaDownload />}
                    <span>{isExportingSif ? 'Generating SIF…' : `Download ${createdBatch.type === 'advance' ? 'Advance' : 'Commission'} SIF`}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setCreatedBatch(null);
                      setRows([emptyRow()]);
                    }}
                  >
                    Create Another
                  </button>
                  <button type="button" className={styles.cancelBtn} onClick={onClose}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => handleSubmit(e, false)} className={styles.form}>
                {/* Type Toggle Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => setPaymentType('advance')}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isAdvance ? '2px solid #0f766e' : '1px solid #cbd5e1',
                      background: isAdvance ? '#f0fdfa' : '#ffffff',
                      color: isAdvance ? '#0f766e' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    Salary Advance (Payroll Recovery)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('commission')}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: !isAdvance ? '2px solid #6d28d9' : '1px solid #cbd5e1',
                      background: !isAdvance ? '#faf5ff' : '#ffffff',
                      color: !isAdvance ? '#6d28d9' : '#475569',
                      transition: 'all 0.15s',
                    }}
                  >
                    Commission Payout (Independent)
                  </button>
                </div>

                {/* Informational Notice */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    lineHeight: 1.4,
                    background: isAdvance ? '#f0fdfa' : '#faf5ff',
                    borderLeft: `4px solid ${isAdvance ? '#0f766e' : '#6d28d9'}`,
                    color: isAdvance ? '#134e4a' : '#581c87',
                  }}
                >
                  {isAdvance ? (
                    <span>
                      <strong>Salary Advance:</strong> Scheduled for automatic deduction in subsequent monthly payroll. Maintains outstanding balance until fully recovered.
                    </span>
                  ) : (
                    <span>
                      <strong>Independent Commission Payout:</strong> Disbursed via its own SIF. <strong>Will NOT</strong> be deducted from monthly salary or affect advance balances.
                    </span>
                  )}
                </div>

                {/* Common Batch Controls: Date & Period */}
                <div className={styles.grid} style={{ marginBottom: 16 }}>
                  <div className={styles.inputGroup}>
                    <label>{isAdvance ? 'Disbursement Date *' : 'Payout Date *'}</label>
                    <DateInput
                      name="disbursementDate"
                      value={disbursementDate}
                      onChange={(e) => {
                        setDisbursementDate(e.target.value);
                        setRows((prev) => prev.map((r) => ({ ...r, advanceDate: e.target.value })));
                      }}
                    />
                  </div>

                  {!isAdvance ? (
                    <div className={styles.inputGroup}>
                      <label>Commission Period *</label>
                      <input
                        type="text"
                        placeholder="e.g. Q1 2026, Nov 2026"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className={styles.inputGroup}>
                      <label>Target Recovery Period (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Next Payroll Cycle"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <p className={advStyles.hint}>
                  Select employees and enter the {isAdvance ? 'advance' : 'commission'} amount for each.
                  Click <strong>+ Add Employee</strong> to add multiple rows.
                </p>

                <div className={advStyles.rowsContainer}>
                  {rows.map((row, idx) => (
                    <div key={row._key} className={advStyles.employeeCard}>
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

                      <div className={styles.grid} style={{ marginTop: 10 }}>
                        <div className={styles.inputGroup}>
                          <label>{isAdvance ? 'Advance Amount (AED) *' : 'Commission Amount (AED) *'}</label>
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
                          <label>Remarks</label>
                          <input
                            type="text"
                            placeholder={isAdvance ? 'e.g. Travel emergency advance' : 'e.g. Q1 Promoter target incentive'}
                            value={row.remarks}
                            onChange={(e) => handleRowChange(row._key, 'remarks', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" className={advStyles.addRowBtn} onClick={handleAddRow} disabled={isSubmitting}>
                  <FaPlus style={{ marginRight: 6 }} /> Add Employee
                </button>

                {/* Total summary bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginTop: 16,
                    border: '1px solid #e2e8f0',
                    fontSize: 13,
                  }}
                >
                  <span>Total {rows.length} recipient(s)</span>
                  <span>
                    <strong>
                      Total Amount: AED{' '}
                      {rows
                        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>

                {/* Footer with Save Only AND Save & Download SIF */}
                <div className={styles.modalFooter} style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={(e) => handleSubmit(e, false)}
                    disabled={isSubmitting}
                    style={{ borderColor: '#cbd5e1', color: '#334155', fontWeight: 600 }}
                  >
                    <FaSave style={{ marginRight: 6 }} /> Save Only
                  </button>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    style={{
                      background: isAdvance ? '#0f766e' : '#6d28d9',
                      borderColor: isAdvance ? '#0f766e' : '#6d28d9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={isSubmitting || isExportingSif}
                  >
                    {isSubmitting || isExportingSif ? (
                      <FaSpinner className={advStyles.spin} />
                    ) : (
                      <FaDownload />
                    )}
                    <span>
                      {isSubmitting
                        ? 'Saving…'
                        : isExportingSif
                        ? 'Exporting SIF…'
                        : `Save & Download ${isAdvance ? 'Advance' : 'Commission'} SIF`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* TAB 2: SIF BATCHES & HISTORY */}
        {activeTab === 'history' && (
          <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div className={historyStyles.typeToggleGroup}>
                <button
                  type="button"
                  className={`${historyStyles.typeToggleBtn} ${historyTypeFilter === 'all' ? historyStyles.typeToggleBtnActive : ''}`}
                  onClick={() => setHistoryTypeFilter('all')}
                >
                  All ({batches.length})
                </button>
                <button
                  type="button"
                  className={`${historyStyles.typeToggleBtn} ${historyTypeFilter === 'advance' ? historyStyles.typeToggleBtnActive : ''}`}
                  onClick={() => setHistoryTypeFilter('advance')}
                >
                  Advances ({batches.filter((b) => b.type === 'advance').length})
                </button>
                <button
                  type="button"
                  className={`${historyStyles.typeToggleBtn} ${historyTypeFilter === 'commission' ? historyStyles.typeToggleBtnActive : ''}`}
                  onClick={() => setHistoryTypeFilter('commission')}
                >
                  Commissions ({batches.filter((b) => b.type === 'commission').length})
                </button>
              </div>

              <span style={{ fontSize: 13, color: '#64748b' }}>
                Download WPS .SIF files for any previous batch below:
              </span>
            </div>

            {loadingBatches ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                <FaSpinner className={advStyles.spin} style={{ fontSize: 24, marginBottom: 8 }} />
                <p>Loading batches…</p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <p>No {historyTypeFilter !== 'all' ? historyTypeFilter : ''} batches found.</p>
                <button
                  type="button"
                  className={styles.submitBtn}
                  style={{ background: '#0f766e', borderColor: '#0f766e', marginTop: 12 }}
                  onClick={() => setActiveTab('create')}
                >
                  <FaPlus style={{ marginRight: 6 }} /> Create Your First Batch
                </button>
              </div>
            ) : (
              <div className={historyStyles.tableWrapper}>
                <table className={historyStyles.batchTable}>
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Type</th>
                      <th>Payment Date</th>
                      <th>Employees</th>
                      <th>Total Amount</th>
                      <th>SIF Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((b) => {
                      const isExpanded = expandedBatchId === b.batchId;
                      const isExportingThis = exportingHistoryBatchId === b.batchId;
                      const isAdv = b.type === 'advance';

                      return (
                        <React.Fragment key={b.batchId}>
                          <tr className={historyStyles.batchRow}>
                            <td>
                              <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                                {b.batchId}
                              </span>
                            </td>
                            <td>
                              <span className={isAdv ? historyStyles.badgeTypeAdvance : historyStyles.badgeTypeCommission}>
                                {isAdv ? 'Advance' : 'Commission'}
                              </span>
                            </td>
                            <td>{b.advanceDate ? new Date(b.advanceDate).toLocaleDateString() : '—'}</td>
                            <td>{b.employeeCount}</td>
                            <td>
                              <strong>
                                AED{' '}
                                {Number(b.totalAmount || 0).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </strong>
                            </td>
                            <td>
                              {b.sifExported ? (
                                <span className={historyStyles.badgeStatusSif} title={`File: ${b.sifFileName || 'SIF generated'}`}>
                                  SIF Exported
                                </span>
                              ) : (
                                <span className={historyStyles.badgeStatusActive}>Ready for SIF</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className={historyStyles.downloadSifBtn}
                                  onClick={() => handleExportHistoryBatchSif(b)}
                                  disabled={isExportingThis}
                                  title="Download UAE WPS SIF file"
                                >
                                  {isExportingThis ? (
                                    <FaSpinner className={advStyles.spin} />
                                  ) : (
                                    <FaDownload />
                                  )}
                                  <span>{isExportingThis ? 'Exporting…' : 'Download SIF'}</span>
                                </button>
                                <button
                                  type="button"
                                  className={historyStyles.viewBtn}
                                  onClick={() => setExpandedBatchId(isExpanded ? null : b.batchId)}
                                  title="View individual employee records"
                                >
                                  {isExpanded ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail drawer */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{ padding: 0 }}>
                                <div className={historyStyles.detailsDrawer}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                                    <span>
                                      <strong>Batch Details:</strong> {b.items?.length || b.employeeCount} employee(s)
                                    </span>
                                    {b.sifFileName && (
                                      <span>
                                        <strong>Latest SIF File:</strong> {b.sifFileName}
                                      </span>
                                    )}
                                  </div>
                                  <table className={historyStyles.subTable}>
                                    <thead>
                                      <tr>
                                        <th>Employee</th>
                                        <th>Emp ID</th>
                                        <th>Amount (AED)</th>
                                        {isAdv && <th>Recovered (AED)</th>}
                                        {isAdv && <th>Balance (AED)</th>}
                                        <th>Status</th>
                                        <th>Remarks</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(b.items || []).map((item) => (
                                        <tr key={item._id || item.employeeId}>
                                          <td><strong>{item.employeeName || item.employee?.employeeName || '—'}</strong></td>
                                          <td>{item.employeeId || '—'}</td>
                                          <td>
                                            AED {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </td>
                                          {isAdv && (
                                            <td>
                                              AED {Number(item.recoveredAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                          )}
                                          {isAdv && (
                                            <td>
                                              AED {Number(item.outstandingBalance ?? item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                          )}
                                          <td>
                                            <span style={{ fontSize: 11, textTransform: 'capitalize' }}>
                                              {String(item.status || 'active').replace('_', ' ')}
                                            </span>
                                          </td>
                                          <td style={{ color: '#64748b' }}>{item.remarks || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SalaryAdvanceModal;
