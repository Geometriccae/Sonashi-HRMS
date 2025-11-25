import React, { useState, useRef, useEffect } from "react";
import styles from "./Dropdown.module.css";

function Dropdown({
  label,
  placeholder = "Select option",
  required = false,
  value,
  onChange,
  options = [],
  hasError = false,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
    setSearchTerm("");
  };

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={styles.dropdownComponent} ref={dropdownRef}>
      {/* Label */}
      {label && (
        <div className={styles.labelContainer}>
          <label className={styles.label}>
            {label}
            {required && <span style={{ color: "red" }}> *</span>}
          </label>
        </div>
      )}

      {/* Dropdown Container */}
      <div
        className={`${styles.container} 
          ${isOpen ? styles.containerOpen : ""} 
          ${hasError ? styles.containerError : ""} 
          ${disabled ? styles.containerDisabled : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div
          className={`${styles.text} ${
            !selectedOption ? styles.placeholder : ""
          }`}
        >
          {displayText}
        </div>

        <div
          className={`${styles.arrow} ${isOpen ? styles.arrowUp : ""}`}
        >
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.menu}>
          {/* Search Input */}
          <div className={styles.searchContainer}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Options List */}
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  className={`${styles.option} ${
                    option.value === value ? styles.optionSelected : ""
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropdown;