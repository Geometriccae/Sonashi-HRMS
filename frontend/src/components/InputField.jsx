import React, { useState } from "react";
import "./InputField.css";
import "./DateInput.css";
import DatePickerModal from "./DatePickerModal";
import { DEFAULT_MIN_YEAR, getDefaultMaxYear } from "../utils/calendarNavUtils";
import { useDateFieldBaseline } from "../utils/dateFieldReset";

const formatDateDisplay = (value) => {
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

function InputField({
  label,
  placeholder,
  required = false,
  type = "text",
  value,
  onChange,
  isDropdown = false,
  options = [],
  hasError = false,
  disabled = false,
  name,
  inputMode,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = getDefaultMaxYear(),
  defaultValue,
  showReset = true,
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const getResetValue = useDateFieldBaseline(value, defaultValue);

  const applyDateValue = (nextValue) => {
    if (onChange) {
      onChange({ target: { value: nextValue, name } });
    }
  };

  const handleDateSelect = (date) => {
    applyDateValue(toYYYYMMDD(date));
    setDatePickerOpen(false);
  };

  const handleDateReset = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    applyDateValue(getResetValue());
    setDatePickerOpen(false);
  };

  return (
    <div className="input-field">
      <div className="input-label-container">
        <label className="input-label">
          {label} {required && <span style={{ color: "red", marginLeft: "4px" }}>*</span>}
        </label>
      </div>
      <div className={`input-container ${hasError ? "input-error" : ""} ${type === "date" ? "date-input-group-wrap" : ""}`}>
        {isDropdown ? (
          <div className="dropdown-field">
            <select
              className="dropdown-select"
              value={value}
              onChange={onChange}
              disabled={disabled}
              name={name}
            >
              <option value="">{placeholder}</option>
              {options.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="dropdown-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 6L8 10L12 6"
                  stroke="#98A1B0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        ) : type === "date" ? (
          <>
            <input
              type="text"
              className="input-field-input"
              readOnly
              placeholder={placeholder || "dd/mm/yyyy"}
              value={formatDateDisplay(value)}
              onClick={() => !disabled && setDatePickerOpen(true)}
              disabled={disabled}
              name={name}
              style={{ cursor: disabled ? "not-allowed" : "pointer" }}
            />
            {showReset && !disabled ? (
              <button
                type="button"
                className="date-reset-btn"
                title="Reset date"
                onClick={handleDateReset}
              >
                Reset
              </button>
            ) : null}
            <DatePickerModal
              isOpen={datePickerOpen}
              onClose={() => setDatePickerOpen(false)}
              onSelectDate={handleDateSelect}
              onReset={handleDateReset}
              selectedDate={value}
              minYear={minYear}
              maxYear={maxYear}
            />
          </>
        ) : (
          <input
            type={type}
            className="input-field-input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            name={name}
            inputMode={inputMode}
          />
        )}
      </div>
    </div>
  );
}

export default InputField;
