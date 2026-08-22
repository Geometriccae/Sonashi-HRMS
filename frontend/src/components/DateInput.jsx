import React, { useState } from "react";
import DatePickerModal from "./DatePickerModal";
import { useDateFieldBaseline } from "../utils/dateFieldReset";
import "./DateInput.css";

const formatDisplay = (value) => {
  if (!value) return "";
  try {
    const [y, m, d] = String(value).split("T")[0].split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
};

const toYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

function DateInput({
  value = "",
  onChange,
  defaultValue,
  placeholder = "dd/mm/yyyy",
  className = "",
  disabled = false,
  showReset = true,
  name,
  minYear,
  maxYear,
  style,
}) {
  const [open, setOpen] = useState(false);
  const getResetValue = useDateFieldBaseline(value, defaultValue);

  const applyValue = (nextValue) => {
    if (onChange) {
      onChange({ target: { value: nextValue, name } });
    }
  };

  const handleSelect = (date) => {
    applyValue(toYYYYMMDD(date));
  };

  const handleReset = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    applyValue(getResetValue());
    setOpen(false);
  };

  return (
    <div className="date-input-group" style={style}>
      <input
        type="text"
        readOnly
        className={`date-input-field ${className}`.trim()}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
        value={formatDisplay(value)}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        onClick={() => !disabled && setOpen(true)}
      />
      {showReset && !disabled ? (
        <button
          type="button"
          className="date-reset-btn"
          title="Reset date"
          onClick={handleReset}
        >
          Reset
        </button>
      ) : null}
      <DatePickerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelectDate={handleSelect}
        onReset={handleReset}
        selectedDate={value}
        minYear={minYear}
        maxYear={maxYear}
      />
    </div>
  );
}

export default DateInput;
