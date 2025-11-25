import React, { useState, useEffect } from "react";
import AttendanceService from "../../services/AttendanceService";

function AttendanceUpdateModal({ isOpen, onClose, employee, onSaved }) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("Onsite");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const t = new Date().toISOString().slice(0, 10);
      setDate(t);
      setStatus("Onsite");
      setNote("");
      setError("");
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      // Ensure date is passed correctly
      const record = await AttendanceService.setAttendance(employee._id, date, status, note);
      onSaved && onSaved(record);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  // Styles
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '400px',
    maxWidth: '90%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    fontFamily: 'Inter, sans-serif',
  };

  const headerStyle = {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  };

  const subtitleStyle = {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  };

  const bodyStyle = {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  };

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    color: '#111827',
    outline: 'none',
  };

  const footerStyle = {
    padding: '16px 24px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  };

  const btnStyle = {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
  };

  const cancelBtnStyle = {
    ...btnStyle,
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    color: '#374151',
  };

  const saveBtnStyle = {
    ...btnStyle,
    backgroundColor: '#2563eb',
    color: '#fff',
  };

  const errorStyle = {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '10px 16px',
    fontSize: '14px',
    borderBottom: '1px solid #fecaca',
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Update Attendance</h3>
          <div style={subtitleStyle}>{employee?.employeeName || "Employee"}</div>
        </div>
        
        {error && <div style={errorStyle}>{error}</div>}

        <div style={bodyStyle}>
          <label style={labelStyle}>
            Date
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Status
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              style={inputStyle}
            >
              <option value="Onsite">Onsite</option>
              <option value="Leave">Leave</option>
            </select>
          </label>

          <label style={labelStyle}>
            Note (Optional)
            <input 
              type="text" 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="e.g., Late arrival"
              style={inputStyle}
            />
          </label>
        </div>

        <div style={footerStyle}>
          <button 
            style={cancelBtnStyle} 
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            style={saveBtnStyle} 
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttendanceUpdateModal;