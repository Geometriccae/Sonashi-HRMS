import React, { useState } from "react";
import CreatableSelect from "react-select/creatable";

export default function ReportingManagerSelect({
  value = "",
  onChange,
  options = [],
  onAdd,
  onEdit,
  onDelete,
  isManager = true,
  disabled = false,
  required = false,
  label = "Reporting Manager",
  placeholder = "Select reporting manager",
}) {
  const [isManaging, setIsManaging] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");
  const [editingItem, setEditingItem] = useState(null); // { originalValue, label, _id }
  const [editLabel, setEditLabel] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Format options for react-select
  const selectOptions = options.map((opt) => {
    const val = typeof opt === "string" ? opt : (opt.value || opt.label || "");
    const lbl = typeof opt === "string" ? opt : (opt.label || opt.value || "");
    return { value: val, label: lbl, _id: opt._id };
  });

  const currentValue = (value || "").trim();
  const selectedOption = currentValue
    ? selectOptions.find((opt) => opt.value.toLowerCase() === currentValue.toLowerCase()) || {
        value: currentValue,
        label: currentValue,
      }
    : null;

  const handleSelectChange = (selected) => {
    onChange(selected ? selected.value : "");
  };

  const handleCreate = async (inputValue) => {
    const clean = (inputValue || "").trim();
    if (!clean) return;
    if (onAdd) {
      await onAdd(clean);
      onChange(clean);
    }
  };

  const handleQuickAdd = async (e) => {
    e?.preventDefault?.();
    const clean = (newManagerName || "").trim();
    if (!clean) return;
    if (onAdd) {
      await onAdd(clean);
      setNewManagerName("");
      onChange(clean);
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
      const origVal = typeof editingItem === "string" ? editingItem : (editingItem.value || editingItem.label);
      if (currentValue.toLowerCase() === String(origVal).toLowerCase()) {
        onChange(clean);
      }
    }
    setEditingItem(null);
    setEditLabel("");
  };

  const confirmDelete = async (opt) => {
    if (onDelete) {
      await onDelete(opt);
      const delVal = typeof opt === "string" ? opt : (opt.value || opt.label);
      if (currentValue.toLowerCase() === String(delVal).toLowerCase()) {
        onChange("");
      }
    }
    setDeleteConfirm(null);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Label and Manage Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <label
          style={{
            color: "#7a8699",
            fontSize: "14px",
            fontWeight: "400",
            lineHeight: "1.29",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            margin: 0,
          }}
        >
          <span>{label}</span>
          {required && <span style={{ color: "red" }}>*</span>}
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
              padding: "3px 8px",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
            title="Add, edit, or delete reporting managers"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            {isManaging ? "Close Controls" : "+ Add / Manage"}
          </button>
        )}
      </div>

      {/* Creatable Single-Select */}
      <CreatableSelect
        isClearable
        isDisabled={disabled}
        options={selectOptions}
        value={selectedOption}
        onChange={handleSelectChange}
        onCreateOption={handleCreate}
        placeholder={placeholder}
        formatCreateLabel={(input) => `+ Add "${input}" as Reporting Manager`}
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: "40px",
            height: "40px",
            borderRadius: "4px",
            borderColor: state.isFocused ? "#000" : "#c2c7d0",
            boxShadow: "none",
            "&:hover": { borderColor: "#98a1b0" },
            background: disabled ? "#f5f5f5" : "#fff",
            fontSize: "15px",
          }),
          valueContainer: (base) => ({
            ...base,
            padding: "0 10px",
          }),
          singleValue: (base) => ({
            ...base,
            color: "#000",
            fontWeight: "400",
          }),
          placeholder: (base) => ({
            ...base,
            color: "#b3b9c4",
            fontSize: "14px",
          }),
          menuPortal: (base) => ({ ...base, zIndex: 999999 }),
        }}
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      />

      {/* Inline Manager Management Panel */}
      {isManaging && isManager && (
        <div
          style={{
            marginTop: "6px",
            padding: "10px",
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
            <span>Reporting Managers Directory</span>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>
              Add, rename, or remove managers
            </span>
          </div>

          {/* Quick Add Bar */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Enter new reporting manager name..."
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
                background: "#fff",
              }}
            />
            <button
              type="button"
              onClick={handleQuickAdd}
              style={{
                padding: "6px 12px",
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
              maxHeight: "150px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingRight: "2px",
            }}
          >
            {selectOptions.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>
                No custom reporting managers added yet.
              </div>
            ) : (
              selectOptions.map((opt, idx) => {
                const optVal = opt.value;
                const optLabel = opt.label;
                const isEditing =
                  editingItem &&
                  ((typeof editingItem === "string" && editingItem === optVal) ||
                    (editingItem._id && editingItem._id === opt._id) ||
                    editingItem.value === optVal);
                const isConfirmingDelete =
                  deleteConfirm &&
                  ((typeof deleteConfirm === "string" && deleteConfirm === optVal) ||
                    (deleteConfirm._id && deleteConfirm._id === opt._id) ||
                    deleteConfirm.value === optVal);

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
                          fontSize: "12px",
                          padding: "2px 6px",
                          border: "none",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        style={{
                          background: "#16a34a",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        style={{
                          background: "#e2e8f0",
                          color: "#475569",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
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
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: "600" }}>
                        Delete "{optLabel}"?
                      </span>
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
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Yes
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
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          No
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
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#1e293b", fontWeight: "500" }}>
                      {optLabel}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(opt)}
                        style={{
                          background: "#f1f5f9",
                          color: "#0284c7",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                        title="Edit manager name"
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(opt)}
                        style={{
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                        title="Delete manager"
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                      </button>
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
