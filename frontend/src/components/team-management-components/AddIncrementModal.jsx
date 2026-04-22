import React, { useState, useEffect } from "react";
import styles from "./AddIncrementModal.module.css";
import config from "../../config/config";

const AddIncrementModal = ({ isOpen, onClose, onSubmit, employee }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    previousSalary: 0,
    incrementAmount: 0,
    newSalary: 0,
    reason: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && employee) {
      const currentSalary = employee.salaryDetails?.totalSalary || 0;
      setFormData({
        date: new Date().toISOString().split('T')[0],
        previousSalary: currentSalary,
        incrementAmount: 0,
        newSalary: currentSalary,
        reason: "",
      });
    }
  }, [isOpen, employee]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate new salary if increment amount changes
      if (field === "incrementAmount") {
        const amt = parseFloat(value) || 0;
        updated.newSalary = prev.previousSalary + amt;
      }
      // Auto-calculate increment amount if new salary changes
      else if (field === "newSalary") {
        const newSal = parseFloat(value) || 0;
        updated.incrementAmount = newSal - prev.previousSalary;
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error submitting increment:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className={styles.header}>
          <h2>Add Salary Increment</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Increment Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Previous Salary (AED)</label>
            <input
              type="number"
              value={formData.previousSalary}
              disabled
              className={styles.disabledInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Increment Amount (AED)</label>
            <input
              type="number"
              value={formData.incrementAmount}
              onChange={(e) => handleInputChange("incrementAmount", e.target.value)}
              placeholder="e.g. 500"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>New Salary (AED)</label>
            <input
              type="number"
              value={formData.newSalary}
              onChange={(e) => handleInputChange("newSalary", e.target.value)}
              placeholder="e.g. 5500"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Reason / Note</label>
            <textarea
              value={formData.reason}
              onChange={(e) => handleInputChange("reason", e.target.value)}
              placeholder="Reason for increment"
              rows={3}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Saving..." : "Add Increment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncrementModal;
