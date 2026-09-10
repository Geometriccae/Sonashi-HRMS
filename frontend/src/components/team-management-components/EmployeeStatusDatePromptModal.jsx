import React from "react";
import DateInput from "../DateInput";
import { ACTIVE_OPTIONS } from "../../constants/employeeDropdownOptions";

/**
 * Notice / Provision / exit date step for Employee Status.
 * Extracted from the Team Management Employee Status column so Employee
 * Details opens the same calendar dialog and uses the same fields.
 */
function EmployeeStatusDatePromptModal({
  prompt,
  saving = false,
  periodResetSaving = false,
  onChange,
  onCancel,
  onConfirm,
  onReset,
}) {
  if (!prompt) return null;

  const nameInitials = prompt.employeeItem?.employeeName
    ? prompt.employeeItem.employeeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EE";
  const mode = prompt.mode || "exit";
  const isEdit = Boolean(prompt.isEdit);
  const busy = saving || periodResetSaving;
  const statusLabel =
    ACTIVE_OPTIONS.find((o) => o.value === prompt.newStatus)?.label ||
    prompt.newStatus;
  const title =
    mode === "notice"
      ? (isEdit ? "Edit Notice Period" : "Set Notice Period")
      : mode === "provision"
        ? (isEdit ? "Edit Provision Period" : "Set Provision Period")
        : "Update Employee Status";
  const description =
    mode === "notice"
      ? <>Please {isEdit ? "update" : "set"} notice period dates for <strong style={{ color: "#334155" }}>{prompt.employeeItem.employeeName}</strong>.</>
      : mode === "provision"
        ? <>Please {isEdit ? "update" : "set"} provision period dates for <strong style={{ color: "#334155" }}>{prompt.employeeItem.employeeName}</strong>.</>
        : <>Please select the last working day for <strong style={{ color: "#334155" }}>{prompt.employeeItem.employeeName}</strong>.</>;
  const dateInputStyle = {
    border: "2px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
    color: "#0f172a",
    fontWeight: "600",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100001,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px"
      }}
      onClick={onCancel}
    >
      <style>{`
        @keyframes statusPromptFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes statusPromptSpin {
          to { transform: rotate(360deg); }
        }
        .status-prompt-date:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
        }
      `}</style>
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "36px",
          width: "440px",
          maxWidth: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(239, 68, 68, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          position: "relative",
          overflow: "hidden",
          border: "1px solid #f1f5f9",
          animation: "statusPromptFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          textAlign: "left"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "6px",
          background: "linear-gradient(90deg, #ef4444, #f97316, #eab308)"
        }} />

        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            position: "absolute",
            top: "20px", right: "20px",
            background: "#f1f5f9", border: "none",
            width: "32px", height: "32px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", color: "#64748b",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
            transition: "all 0.2s ease",
            lineHeight: 1
          }}
          onMouseEnter={(e) => { if (!saving) { e.target.style.background = "#e2e8f0"; e.target.style.color = "#0f172a"; } }}
          onMouseLeave={(e) => { if (!saving) { e.target.style.background = "#f1f5f9"; e.target.style.color = "#64748b"; } }}
        >&times;</button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px", marginTop: "10px" }}>
          <div style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fee2e2, #fecaca)",
            color: "#dc2626",
            fontSize: "22px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 16px rgba(220, 38, 38, 0.12)"
          }}>
            {nameInitials}
          </div>
          <h3 style={{ margin: "10px 0 2px", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
            {description}
          </p>
        </div>

        <div style={{
          background: "#fef2f2",
          borderRadius: "16px",
          padding: "14px 18px",
          border: "1px solid #fecaca",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Changing Status to:
          </span>
          <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #fee2e2, #fecaca)",
              color: "#991b1b",
              fontSize: "13px",
              fontWeight: "800",
              boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              border: "1px solid #fca5a525"
            }}>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 0 2px #ef444425"
              }} />
              {statusLabel}
            </span>
          </div>
        </div>

        {mode === "notice" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Notice Period Start Date
              </label>
              <DateInput
                value={prompt.noticePeriodStartDate || ""}
                className="status-prompt-date"
                onChange={(e) => onChange({ noticePeriodStartDate: e.target.value })}
                style={dateInputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Notice Period End Date / Last Working Day
              </label>
              <DateInput
                value={prompt.noticePeriodEndDate || ""}
                className="status-prompt-date"
                onChange={(e) => onChange({ noticePeriodEndDate: e.target.value })}
                style={dateInputStyle}
              />
            </div>
          </>
        )}

        {mode === "provision" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Provision Period Start Date
              </label>
              <DateInput
                value={prompt.provisionPeriodStartDate || ""}
                className="status-prompt-date"
                onChange={(e) => onChange({ provisionPeriodStartDate: e.target.value })}
                style={dateInputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Provision Period End Date
              </label>
              <DateInput
                value={prompt.provisionPeriodEndDate || ""}
                className="status-prompt-date"
                onChange={(e) => onChange({ provisionPeriodEndDate: e.target.value })}
                style={dateInputStyle}
              />
            </div>
          </>
        )}

        {mode === "exit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Last Working Day
            </label>
            <DateInput
              value={prompt.lastWorkingDay || ""}
              className="status-prompt-date"
              onChange={(e) => onChange({ lastWorkingDay: e.target.value })}
              style={dateInputStyle}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px", flexWrap: "wrap" }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "2px solid #e2e8f0",
              background: "#fff",
              color: "#64748b",
              fontWeight: "700",
              fontSize: "14px",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { if (!busy) { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; } }}
            onMouseLeave={(e) => { if (!busy) { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; } }}
          >
            Cancel
          </button>
          {isEdit && (mode === "notice" || mode === "provision") && onReset && (
            <button
              onClick={onReset}
              disabled={busy}
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                border: "2px solid #fecaca",
                background: "#fff",
                color: "#dc2626",
                fontWeight: "700",
                fontSize: "14px",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { if (!busy) { e.target.style.background = "#fef2f2"; e.target.style.borderColor = "#fca5a5"; } }}
              onMouseLeave={(e) => { if (!busy) { e.target.style.background = "#fff"; e.target.style.borderColor = "#fecaca"; } }}
            >
              Reset
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              background: busy ? "#94a3b8" : "linear-gradient(135deg, #dc2626, #ef4444)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              cursor: busy ? "not-allowed" : "pointer",
              boxShadow: busy ? "none" : "0 4px 12px rgba(220, 38, 38, 0.25)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              minWidth: "120px"
            }}
            onMouseEnter={(e) => { if (!busy) { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.35)"; } }}
            onMouseLeave={(e) => { if (!busy) { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.25)"; } }}
          >
            {saving && (
              <span
                style={{
                  width: "14px",
                  height: "14px",
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "statusPromptSpin 0.7s linear infinite"
                }}
              />
            )}
            {saving ? "Saving..." : (isEdit ? "Save Changes" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmployeeStatusDatePromptModal;
