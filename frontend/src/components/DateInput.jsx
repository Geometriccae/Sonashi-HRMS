import React, { useState } from "react";
import DatePickerModal from "./DatePickerModal";

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
  placeholder = "dd/mm/yyyy",
  className = "",
  disabled = false,
  name,
  minYear,
  maxYear,
  style,
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date) => {
    if (onChange) {
      onChange({ target: { value: toYYYYMMDD(date), name } });
    }
  };

  return (
    <>
      <input
        type="text"
        readOnly
        className={className}
        style={{ ...style, cursor: disabled ? "not-allowed" : "pointer" }}
        value={formatDisplay(value)}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        onClick={() => !disabled && setOpen(true)}
      />
      <DatePickerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelectDate={handleSelect}
        selectedDate={value}
        minYear={minYear}
        maxYear={maxYear}
      />
    </>
  );
}

export default DateInput;
