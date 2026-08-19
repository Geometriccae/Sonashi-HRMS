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
  onAdd,
  onDelete,
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
    const extra = [option.employeeId, option.name, option.emailId, option.mobile, option.employeeNumber]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !search || label.toLowerCase().includes(search) || extra.includes(search);
    if (!matchesSearch) return false;
    if (option.hideUnlessSearch && !search) return false;
    return true;
  });

  const selectedOption = safeOptions.find((opt) => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const [isAdding, setIsAdding] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // stores the option to delete

  const handleAdd = async () => {
    if (!newOptionLabel.trim() || !onAdd) return;
    try {
      await onAdd(newOptionLabel.trim());
      setNewOptionLabel("");
      setIsAdding(false);
    } catch (err) {
      console.error("Error adding option:", err);
    }
  };

  const confirmDelete = (e, option) => {
    e.stopPropagation();
    setDeleteConfirmation(option);
  };

  const handleDelete = async () => {
    if (!deleteConfirmation || !onDelete) return;
    try {
      await onDelete(deleteConfirmation);
      setDeleteConfirmation(null);
    } catch (err) {
      console.error("Error deleting option:", err);
    }
  };

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
        zIndex: 1000001,
      }}
    >
      {/* Delete Confirmation Overlay */}
      {deleteConfirmation && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>Delete "{deleteConfirmation.label}"?</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteConfirmation(null)}>No</button>
              <button className={styles.confirmDeleteBtn} onClick={handleDelete}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Add Input */}
      <div className={styles.searchContainer}>
        {isAdding ? (
          <div className={styles.addInputWrapper}>
            <input
              type="text"
              placeholder="Enter new option..."
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            <button className={styles.addTickBtn} onClick={handleAdd} title="Save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <button className={styles.addCancelBtn} onClick={() => { setIsAdding(false); setNewOptionLabel(""); }} title="Cancel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ) : (
          <div className={styles.searchInputWrapper}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            {onAdd && (
              <button className={styles.addBtn} onClick={() => setIsAdding(true)} title="Add New">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Options List */}
      <div className={styles.optionsList}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => (
            <div
              key={index}
              className={`${styles.option} ${option.value === value ? styles.optionSelected : ""}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {onDelete && option.value !== "" && (
                <button className={styles.deleteBtn} onClick={(e) => confirmDelete(e, option)} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
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
          className={`${styles.text} ${!selectedOption ? styles.placeholder : ""
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