import React from "react";
import DateInput from "../DateInput";
import { formatVacationStatus } from "../../utils/vacationStatusDisplay";

/**
 * The vacation date-selection step of a status change.
 *
 * Extracted verbatim from the Team Management status column so Employee Master /
 * Employee Profile open the same dialog instead of a second implementation. The
 * prompt state comes from buildVacationDatePrompt and the save from
 * applyVacationStatusChange, so every screen shares one flow.
 *
 * @param prompt  state from buildVacationDatePrompt (null hides the modal)
 * @param onChange(patch)  merges into the prompt state
 */
function VacationDatePromptModal({ prompt, saving = false, onChange, onCancel, onConfirm }) {
  if (!prompt) return null;

  const nameInitials = prompt.employeeItem?.employeeName
    ? prompt.employeeItem.employeeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "EE";

  const getStatusLabelAndStyle = (status) => {
    const style = {
      "On Vacation": { bg: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#1e3a8a", dot: "#3b82f6" },
      "Vacation Approved": { bg: "linear-gradient(135deg, #ede9fe, #ddd6fe)", color: "#4c1d95", dot: "#7c3aed" },
      "Vacation Pending": { bg: "linear-gradient(135deg, #fef9c3, #fde68a)", color: "#713f12", dot: "#f59e0b" },
    }[status] || { bg: "#f8fafc", color: "#334155", dot: "#64748b" };
    return { label: formatVacationStatus(status) || status, ...style };
  };

  const statusCfg = getStatusLabelAndStyle(prompt.newStatus);

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

  const fields = [
    { label: prompt.label, valueKey: "dateValue" },
    prompt.secondaryFieldKey
      ? { label: prompt.secondaryLabel, valueKey: "secondaryDateValue" }
      : null,
    prompt.tertiaryFieldKey
      ? { label: prompt.tertiaryLabel, valueKey: "tertiaryDateValue" }
      : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100001,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onCancel}
    >
      <style>{`
        @keyframes datePromptFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes datePromptSpin {
          to { transform: rotate(360deg); }
        }
        .premium-input-date:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
        }
      `}</style>
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "36px",
          width: "440px",
          maxWidth: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(79, 70, 229, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          position: "relative",
          overflow: "hidden",
          border: "1px solid #f1f5f9",
          animation: "datePromptFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          textAlign: "left",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #4f46e5, #8b5cf6, #ec4899)",
          }}
        />

        {/* Close Button */}
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "#f1f5f9",
            border: "none",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: "#64748b",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
            transition: "all 0.2s ease",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.target.style.background = "#e2e8f0";
              e.target.style.color = "#0f172a";
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              e.target.style.background = "#f1f5f9";
              e.target.style.color = "#64748b";
            }
          }}
        >
          &times;
        </button>

        {/* Avatar & Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "8px",
            marginTop: "10px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ede9fe, #c7d2fe)",
              color: "#4f46e5",
              fontSize: "22px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 16px rgba(79, 70, 229, 0.12)",
            }}
          >
            {nameInitials}
          </div>
          <h3 style={{ margin: "10px 0 2px", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
            {prompt.secondaryFieldKey ? "Set Vacation Dates" : `Set ${prompt.label}`}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
            Please select the vacation-related date{prompt.secondaryFieldKey ? "s" : ""} for{" "}
            <strong style={{ color: "#334155" }}>{prompt.employeeItem?.employeeName}</strong>.
          </p>
        </div>

        {/* Status Badge Visual Transition Indicator */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: "16px",
            padding: "14px 18px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Updating Status to:
            </span>
          </div>
          <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "999px",
                background: statusCfg.bg,
                color: statusCfg.color,
                fontSize: "13px",
                fontWeight: "800",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                border: `1px solid ${statusCfg.dot}25`,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: statusCfg.dot,
                  boxShadow: `0 0 0 2px ${statusCfg.dot}25`,
                }}
              />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Date Input Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {fields.map((field) => (
            <div key={field.valueKey} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Select {field.label}
              </label>
              <DateInput
                value={prompt[field.valueKey]}
                className="premium-input-date"
                onChange={(e) => onChange?.({ [field.valueKey]: e.target.value })}
                style={dateInputStyle}
              />
            </div>
          ))}
        </div>

        {/* Footer Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "2px solid #e2e8f0",
              background: "#fff",
              color: "#64748b",
              fontWeight: "700",
              fontSize: "14px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.target.style.background = "#f8fafc";
                e.target.style.borderColor = "#cbd5e1";
                e.target.style.color = "#475569";
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.target.style.background = "#fff";
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.color = "#64748b";
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              background: saving ? "#94a3b8" : "linear-gradient(135deg, #4f46e5, #6366f1)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : "0 4px 12px rgba(79, 70, 229, 0.25)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              minWidth: "120px",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 6px 16px rgba(79, 70, 229, 0.35)";
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.target.style.transform = "none";
                e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.25)";
              }
            }}
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
                  animation: "datePromptSpin 0.7s linear infinite",
                }}
              />
            )}
            {saving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VacationDatePromptModal;
