import React, { useState } from "react";
import CreatableSelect from "react-select/creatable";

export default function ApprovalManagerSelect({
  value = [],
  onChange,
  options = [],
  onAdd,
  onEdit,
  onDelete,
  isManager = false,
  disabled = false,
  required = true,
}) {
  const [isManaging, setIsManaging] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const [editingItem, setEditingItem] = useState(null); // { originalValue, label, _id }
  const [editLabel, setEditLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  // Format options for react-select
  const selectOptions = options.map((opt) => {
    const val = typeof opt === "string" ? opt : (opt.value || opt.label || "");
    const lbl = typeof opt === "string" ? opt : (opt.label || opt.value || "");
    return { value: val, label: lbl };
  });

  const currentSelection = selectOptions.filter((opt) => selectedValues.includes(opt.value));

  const handleSelectChange = (selected) => {
    const newVals = selected ? selected.map((s) => s.value) : [];
    onChange(newVals);
  };

  const handleCreate = async (inputValue) => {
    const clean = (inputValue || "").trim();
    if (!clean) return;
    if (onAdd) {
      await onAdd(clean);
      if (!selectedValues.includes(clean)) {
        onChange([...selectedValues, clean]);
      }
    }
  };

  const handleQuickAdd = async (e) => {
    e?.preventDefault?.();
    const clean = (newManagerName || "").trim();
    if (!clean) return;
    if (onAdd) {
      await onAdd(clean);
      setNewManagerName("");
      // Automatically add to current selection if not already selected
      if (!selectedValues.includes(clean)) {
        onChange([...selectedValues, clean]);
      }
    }
  };

  const startEdit = (opt) => {
    setEditingItem(opt);
    setEditLabel(typeof opt === "string" ? opt : (opt.label || opt.value || ""));
  };

  const saveEdit = async () => {
    const clean = (editLabel || "").trim();
    if (!clean || !editingItem) return;
    if (onEdit) {
      await onEdit(editingItem, clean);
      // Update selectedValues if edited item was selected
      const origVal = typeof editingItem === "string" ? editingItem : (editingItem.value || editingItem.label);
      if (selectedValues.includes(origVal)) {
        onChange(selectedValues.map((v) => (v === origVal ? clean : v)));
      }
    }
    setEditingItem(null);
    setEditLabel("");
  };

  const confirmDelete = async (opt) => {
    if (onDelete) {
      await onDelete(opt);
      const delVal = typeof opt === "string" ? opt : (opt.value || opt.label);
      if (selectedValues.includes(delVal)) {
        onChange(selectedValues.filter((v) => v !== delVal));
      }
    }
    setDeleteConfirm(null);
  };

  return (
    <div style={{ width: "100%", marginBottom: "4px" }}>
      {/* Label and Manage Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <label
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Approval Manager {required && <span style={{ color: "#ef4444" }}>*</span>}</span>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>
            (Multiple managers allowed — any one approval finalizes)
          </span>
        </label>
        {isManager && (
          <button
            type="button"
            onClick={() => setIsManaging(!isManaging)}
            style={{
              background: isManaging ? "#e0f2fe" : "#f1f5f9",
              color: isManaging ? "#0284c7" : "#475569",
              border: `1px solid ${isManaging ? "#bae6fd" : "#cbd5e1"}`,
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            {isManaging ? "Close Manager Controls" : "Manage / Add Managers"}
          </button>
        )}
      </div>

      {/* React-Select Multi-Select */}
      <CreatableSelect
        isMulti
        isDisabled={disabled}
        options={selectOptions}
        value={currentSelection}
        onChange={handleSelectChange}
        onCreateOption={handleCreate}
        formatCreateLabel={(input) => `+ Add "${input}" as Approval Manager`}
        placeholder="Select one or more Approval Managers..."
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: "44px",
            borderRadius: "8px",
            borderColor: state.isFocused ? "#0284c7" : "#E2E8F0",
            boxShadow: state.isFocused ? "0 0 0 1px #0284c7" : "none",
            "&:hover": { borderColor: "#CBD5E1" },
            background: disabled ? "#f8fafc" : "#fff",
          }),
          multiValue: (base) => ({
            ...base,
            backgroundColor: "#e0f2fe",
            borderRadius: "6px",
            border: "1px solid #bae6fd",
          }),
          multiValueLabel: (base) => ({
            ...base,
            color: "#0369a1",
            fontWeight: "600",
            fontSize: "12px",
            padding: "2px 6px",
          }),
          multiValueRemove: (base) => ({
            ...base,
            color: "#0284c7",
            borderRadius: "0 5px 5px 0",
            ":hover": {
              backgroundColor: "#bae6fd",
              color: "#0369a1",
            },
          }),
          menuPortal: (base) => ({ ...base, zIndex: 999999 }),
        }}
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      />

      {/* Inline Manager Management Panel */}
      {isManaging && isManager && (
        <div
          style={{
            marginTop: "10px",
            padding: "12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#334155",
              marginBottom: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Approval Managers Directory & CRUD Controls</span>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>
              Add, rename, or remove managers from options
            </span>
          </div>

          {/* Quick Add Bar */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Enter new approval manager name..."
              value={newManagerName}
              onChange={(e) => setNewManagerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: "12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleQuickAdd}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "600",
                background: "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              + Add Manager
            </button>
          </div>

          {/* Manager Items List */}
          <div
            style={{
              maxHeight: "160px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingRight: "4px",
            }}
          >
            {options.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>
                No custom managers added yet.
              </div>
            ) : (
              options.map((opt, idx) => {
                const optVal = typeof opt === "string" ? opt : (opt.value || opt.label || "");
                const optLabel = typeof opt === "string" ? opt : (opt.label || opt.value || "");
                const isEditing = editingItem && (
                  (typeof editingItem === "string" && editingItem === optVal) ||
                  (editingItem._id && editingItem._id === opt._id) ||
                  (editingItem.value === optVal)
                );
                const isConfirmingDelete = deleteConfirm && (
                  (typeof deleteConfirm === "string" && deleteConfirm === optVal) ||
                  (deleteConfirm._id && deleteConfirm._id === opt._id) ||
                  (deleteConfirm.value === optVal)
                );

                if (isEditing) {
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        background: "#fff",
                        border: "1px solid #0284c7",
                        borderRadius: "6px",
                      }}
                    >
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === "Escape") {
                            setEditingItem(null);
                          }
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: "3px 6px",
                          fontSize: "12px",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        title="Save"
                        style={{
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        title="Cancel"
                        style={{
                          background: "#e2e8f0",
                          color: "#475569",
                          border: "none",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                }

                if (isConfirmingDelete) {
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "#b91c1c",
                      }}
                    >
                      <span>Delete "{optLabel}"?</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => confirmDelete(opt)}
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            cursor: "pointer",
                            fontWeight: "600",
                          }}
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          style={{
                            background: "#e2e8f0",
                            color: "#475569",
                            border: "none",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#334155",
                    }}
                  >
                    <span style={{ fontWeight: "500" }}>{optLabel}</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(opt)}
                          title="Edit"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(opt)}
                          title="Delete"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
