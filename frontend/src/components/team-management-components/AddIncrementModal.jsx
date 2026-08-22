import React, { useState, useEffect } from "react";
import DateInput from "../DateInput";
import styles from "./AddIncrementModal.module.css";

const AddIncrementModal = ({ isOpen, onClose, onSubmit, employee, initialData }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    previousSalary: 0,
    incrementAmount: 0,
    newSalary: 0,
    basicSalaryIncrement: "",
    houseRentIncrement: "",
    travelExpIncrement: "",
    otherIncrement: "",
    reason: "",
  });

  const [loading, setLoading] = useState(false);
  const [dateBaseline, setDateBaseline] = useState(new Date().toISOString().split("T")[0]);

  const [revisedInputs, setRevisedInputs] = useState({
    basicSalaryIncrement: "",
    houseRentIncrement: "",
    travelExpIncrement: "",
    otherIncrement: "",
  });

  const [pctInputs, setPctInputs] = useState({
    basicSalaryIncrement: "",
    houseRentIncrement: "",
    travelExpIncrement: "",
    otherIncrement: "",
  });

  // Extract previous baseline earnings from employee's profile
  // If we are editing, we subtract this increment's values from the current ones to find the exact baselines
  const previousBasic = employee
    ? initialData
      ? (employee.salaryDetails?.basicSalary || 0) - (initialData.basicSalaryIncrement || 0)
      : (employee.salaryDetails?.basicSalary || 0)
    : 0;

  const previousHouseRent = employee
    ? initialData
      ? (employee.salaryDetails?.houseRent || 0) - (initialData.houseRentIncrement || 0)
      : (employee.salaryDetails?.houseRent || 0)
    : 0;

  const previousTravel = employee
    ? initialData
      ? (employee.salaryDetails?.travelExp || 0) - (initialData.travelExpIncrement || 0)
      : (employee.salaryDetails?.travelExp || 0)
    : 0;

  const previousOther = employee
    ? initialData
      ? (employee.salaryDetails?.other || 0) - (initialData.otherIncrement || 0)
      : (employee.salaryDetails?.other || 0)
    : 0;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const loadedDate = initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        setDateBaseline(loadedDate);
        setFormData({
          date: loadedDate,
          previousSalary: initialData.previousSalary || 0,
          incrementAmount: initialData.incrementAmount || 0,
          newSalary: initialData.newSalary || 0,
          basicSalaryIncrement: initialData.basicSalaryIncrement !== undefined ? initialData.basicSalaryIncrement.toString() : "",
          houseRentIncrement: initialData.houseRentIncrement !== undefined ? initialData.houseRentIncrement.toString() : "",
          travelExpIncrement: initialData.travelExpIncrement !== undefined ? initialData.travelExpIncrement.toString() : "",
          otherIncrement: initialData.otherIncrement !== undefined ? initialData.otherIncrement.toString() : "",
          reason: initialData.reason || "",
        });

        const basicInc = initialData.basicSalaryIncrement || 0;
        const houseInc = initialData.houseRentIncrement || 0;
        const travelInc = initialData.travelExpIncrement || 0;
        const otherInc = initialData.otherIncrement || 0;

        setRevisedInputs({
          basicSalaryIncrement: (previousBasic + basicInc).toFixed(2),
          houseRentIncrement: (previousHouseRent + houseInc).toFixed(2),
          travelExpIncrement: (previousTravel + travelInc).toFixed(2),
          otherIncrement: (previousOther + otherInc).toFixed(2),
        });

        setPctInputs({
          basicSalaryIncrement: previousBasic > 0 ? ((basicInc / previousBasic) * 100).toFixed(2) : "0.00",
          houseRentIncrement: previousHouseRent > 0 ? ((houseInc / previousHouseRent) * 100).toFixed(2) : "0.00",
          travelExpIncrement: previousTravel > 0 ? ((travelInc / previousTravel) * 100).toFixed(2) : "0.00",
          otherIncrement: previousOther > 0 ? ((otherInc / previousOther) * 100).toFixed(2) : "0.00",
        });
      } else if (employee) {
        const currentSalary = employee.salaryDetails?.totalSalary || 0;
        const today = new Date().toISOString().split('T')[0];
        setDateBaseline(today);
        setFormData({
          date: today,
          previousSalary: currentSalary,
          incrementAmount: 0,
          newSalary: currentSalary,
          basicSalaryIncrement: "",
          houseRentIncrement: "",
          travelExpIncrement: "",
          otherIncrement: "",
          reason: "",
        });

        setRevisedInputs({
          basicSalaryIncrement: previousBasic.toFixed(2),
          houseRentIncrement: previousHouseRent.toFixed(2),
          travelExpIncrement: previousTravel.toFixed(2),
          otherIncrement: previousOther.toFixed(2),
        });

        setPctInputs({
          basicSalaryIncrement: "0.00",
          houseRentIncrement: "0.00",
          travelExpIncrement: "0.00",
          otherIncrement: "0.00",
        });
      }
    }
  }, [isOpen, employee, initialData, previousBasic, previousHouseRent, previousTravel, previousOther]);

  const handleEarningIncrementChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      const basicAmt = parseFloat(field === "basicSalaryIncrement" ? value : prev.basicSalaryIncrement) || 0;
      const hraAmt = parseFloat(field === "houseRentIncrement" ? value : prev.houseRentIncrement) || 0;
      const travelAmt = parseFloat(field === "travelExpIncrement" ? value : prev.travelExpIncrement) || 0;
      const otherAmt = parseFloat(field === "otherIncrement" ? value : prev.otherIncrement) || 0;

      const totalInc = basicAmt + hraAmt + travelAmt + otherAmt;
      updated.incrementAmount = totalInc;
      updated.newSalary = prev.previousSalary + totalInc;

      return updated;
    });
  };

  const handleRevisedInputChange = (field, valString) => {
    setRevisedInputs(prev => ({ ...prev, [field]: valString }));

    let prevVal = 0;
    if (field === "basicSalaryIncrement") prevVal = previousBasic;
    else if (field === "houseRentIncrement") prevVal = previousHouseRent;
    else if (field === "travelExpIncrement") prevVal = previousTravel;
    else if (field === "otherIncrement") prevVal = previousOther;

    const parsedVal = parseFloat(valString);
    const incrementAmount = isNaN(parsedVal) ? 0 : parsedVal - prevVal;

    handleEarningIncrementChange(field, incrementAmount.toString());

    const computedPct = prevVal > 0 ? (incrementAmount / prevVal) * 100 : 0;
    setPctInputs(prev => ({
      ...prev,
      [field]: isNaN(parsedVal) ? "" : computedPct.toFixed(2)
    }));
  };

  const handlePctInputChange = (field, valString) => {
    setPctInputs(prev => ({ ...prev, [field]: valString }));

    let prevVal = 0;
    if (field === "basicSalaryIncrement") prevVal = previousBasic;
    else if (field === "houseRentIncrement") prevVal = previousHouseRent;
    else if (field === "travelExpIncrement") prevVal = previousTravel;
    else if (field === "otherIncrement") prevVal = previousOther;

    const parsedPct = parseFloat(valString);
    const incrementAmount = isNaN(parsedPct) ? 0 : prevVal * (parsedPct / 100);

    handleEarningIncrementChange(field, incrementAmount.toString());

    const computedRevised = prevVal + incrementAmount;
    setRevisedInputs(prev => ({
      ...prev,
      [field]: isNaN(parsedPct) ? "" : computedRevised.toFixed(2)
    }));
  };

  const handleDateOrReasonChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSubmit = {
        ...formData,
        basicSalaryIncrement: parseFloat(formData.basicSalaryIncrement) || 0,
        houseRentIncrement: parseFloat(formData.houseRentIncrement) || 0,
        travelExpIncrement: parseFloat(formData.travelExpIncrement) || 0,
        otherIncrement: parseFloat(formData.otherIncrement) || 0,
      };
      await onSubmit(dataToSubmit);
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className={styles.header}>
          <h2>{initialData ? "Edit Salary Increment" : "Add Salary Increment"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.topGrid}>
            <div className={styles.formGroup}>
              <label>Effective Date</label>
              <DateInput
                value={formData.date}
                defaultValue={dateBaseline}
                onChange={(e) => handleDateOrReasonChange("date", e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.earningsSection}>
            <h3 className={styles.earningsTitle}>Earnings Increments Breakdown</h3>
            <div className={styles.tableContainer}>
              <table className={styles.revisionTable}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Component</th>
                    <th style={{ textAlign: 'right' }}>Current Salary</th>
                    <th style={{ textAlign: 'center' }}>Revised Salary</th>
                    <th style={{ textAlign: 'center' }}>Revision %</th>
                  </tr>
                  <tr className={styles.totalRow}>
                    <td style={{ fontWeight: '700', textAlign: 'left' }}>TOTAL</td>
                    <td style={{ fontWeight: '700', textAlign: 'right' }}>
                      AED {formData.previousSalary ? formData.previousSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </td>
                    <td style={{ fontWeight: '700', textAlign: 'center', color: '#007aff' }}>
                      AED {formData.newSalary ? formData.newSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </td>
                    <td style={{ fontWeight: '700', textAlign: 'center', color: '#34C759' }}>
                      {(() => {
                        const prev = formData.previousSalary || 0;
                        const inc = formData.incrementAmount || 0;
                        if (prev === 0) return inc > 0 ? "100.00%" : "0.00%";
                        const pct = (inc / prev) * 100;
                        return `${pct.toFixed(2)} %`;
                      })()}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Basic Salary", field: "basicSalaryIncrement", previous: previousBasic },
                    { label: "House Rent Allowance (HRA)", field: "houseRentIncrement", previous: previousHouseRent },
                    { label: "Travel / Conveyance", field: "travelExpIncrement", previous: previousTravel },
                    { label: "Other Allowance", field: "otherIncrement", previous: previousOther }
                  ].map((row, idx) => {
                    const revisedVal = revisedInputs[row.field] || "";
                    const pctVal = pctInputs[row.field] || "";
                    const currentInc = parseFloat(formData[row.field]) || 0;
                    const calculatedPct = row.previous > 0 ? (currentInc / row.previous) * 100 : 0;

                    return (
                      <tr key={idx}>
                        <td className={styles.componentLabel}>{row.label}</td>
                        <td className={styles.currentVal}>
                          AED {row.previous.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={styles.inputCell}>
                          <div className={styles.inputWrapper}>
                            <span className={styles.currencyPrefix}>AED</span>
                            <input
                              type="number"
                              value={revisedVal}
                              onChange={(e) => handleRevisedInputChange(row.field, e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              className={styles.revisedInput}
                            />
                          </div>
                        </td>
                        <td className={styles.inputCell}>
                          <div className={styles.pctInputContainer}>
                            <div className={styles.inputWrapper}>
                              <input
                                type="number"
                                value={pctVal}
                                onChange={(e) => handlePctInputChange(row.field, e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                className={styles.pctInput}
                              />
                              <span className={styles.percentSuffix}>%</span>
                            </div>
                            <span className={styles.calculatedPctText}>
                              {calculatedPct.toFixed(2)} %
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Reason / Note</label>
            <textarea
              value={formData.reason}
              onChange={(e) => handleDateOrReasonChange("reason", e.target.value)}
              placeholder="Reason for increment"
              rows={3}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Saving..." : (initialData ? "Save Changes" : "Add Increment")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncrementModal;
