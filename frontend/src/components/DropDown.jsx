import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  id: menuIdProp,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const coordsRef = useRef({ top: 0, left: 0, width: 252 });
  const menuId = menuIdProp != null && menuIdProp !== "" ? String(menuIdProp) : (label || "default");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        const menu = document.getElementById(`dropdown-menu-${menuId}`);
        if (menu && menu.contains(event.target)) return;
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuId]);

  // Reset position when closed so next open doesn't reuse old coords
  useEffect(() => {
    if (!isOpen) setCoords({ top: 0, left: 0, width: 0 });
  }, [isOpen]);

  // Update position when opening (defer so modal layout is ready; only show menu when position is valid)
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    let cancelled = false;
    const updatePosition = () => {
      if (cancelled) return;
      const container = dropdownRef.current?.querySelector(`.${styles.container}`);
      if (container) {
        const rect = container.getBoundingClientRect();
        setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 252) });
      }
    };

    // Defer so dropdown renders and modal layout is complete (fixes wrong position / "upload-like" appearance)
    const raf = requestAnimationFrame(() => {
      updatePosition();
    });

    const handleScrollOrResize = (e) => {
      const menu = document.getElementById(`dropdown-menu-${menuId}`);
      if (e.type === "scroll" && menu && (e.target === menu || menu.contains(e.target))) return;
      setIsOpen(false);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, menuId]);

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

  const safeOptions = Array.isArray(options) ? options : [];
  const search = (searchTerm || "").toLowerCase();
  const filteredOptions = safeOptions.filter((option) => {
    if (!option) return false;
    const label = option.label != null ? String(option.label) : "";
    return label.toLowerCase().includes(search);
  });

  const selectedOption = safeOptions.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const pos = coords.width > 0 ? coords : coordsRef.current;
  const dropdownMenu = (
    <div
      id={`dropdown-menu-${menuId}`}
      className={styles.menu}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width || 252,
        zIndex: 99999,
      }}
    >
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
  );

  return (
    <div className={styles.dropdownComponent} ref={dropdownRef}>
      {/* Label */}
      {label && (
        <div className={styles.labelContainer}>
          <label className={styles.label}>
            {label}
            {required && <span style={{ color: "red", marginLeft: "4px" }}>*</span>}
          </label>
        </div>
      )}

      {/* Dropdown Container - use currentTarget for position so menu opens below this field (not top-left) */}
      <div
        className={`${styles.container} 
          ${isOpen ? styles.containerOpen : ""} 
          ${hasError ? styles.containerError : ""} 
          ${disabled ? styles.containerDisabled : ""}`}
        onClick={(e) => {
          if (disabled) return;
          if (!isOpen) {
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            coordsRef.current = {
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 252),
            };
          }
          setIsOpen(!isOpen);
        }}
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

      {/* Dropdown Menu Portal - show when open (position from coords or coordsRef) */}
      {isOpen && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

export default Dropdown;