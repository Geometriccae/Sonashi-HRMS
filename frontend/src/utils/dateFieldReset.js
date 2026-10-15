import { useRef, useEffect, useCallback } from "react";

/** Normalize to YYYY-MM-DD for form fields. */
export const normalizeDateFieldValue = (value) => {
  if (value == null || value === "") return "";
  try {
    return String(value).split("T")[0];
  } catch {
    return String(value);
  }
};

/**
 * Tracks the value Reset should restore to.
 * - defaultValue prop: explicit baseline (edit forms)
 * - otherwise: value on first mount (empty for add, loaded value for edit)
 */
export function useDateFieldBaseline(value, defaultValue) {
  const baselineRef = useRef(undefined);

  if (baselineRef.current === undefined) {
    baselineRef.current =
      defaultValue !== undefined
        ? normalizeDateFieldValue(defaultValue)
        : normalizeDateFieldValue(value);
  }

  useEffect(() => {
    if (defaultValue !== undefined) {
      baselineRef.current = normalizeDateFieldValue(defaultValue);
    }
  }, [defaultValue]);

  const getResetValue = useCallback(
    () => baselineRef.current ?? "",
    []
  );

  return getResetValue;
}

/** Imperative baseline for modals that use DatePickerModal directly. */
export function useSingleDateBaseline(initialValue = "") {
  const baselineRef = useRef(normalizeDateFieldValue(initialValue));

  const setBaseline = useCallback((value) => {
    baselineRef.current = normalizeDateFieldValue(value);
  }, []);

  const getResetValue = useCallback(() => baselineRef.current ?? "", []);

  return { setBaseline, getResetValue };
}

/** Named baselines for multi-field date pickers (e.g. start/end). */
export function useDateBaselines(initialMap = {}) {
  const baselineRef = useRef(
    Object.fromEntries(
      Object.entries(initialMap).map(([key, value]) => [
        key,
        normalizeDateFieldValue(value),
      ])
    )
  );

  const setBaseline = useCallback((key, value) => {
    baselineRef.current[key] = normalizeDateFieldValue(value);
  }, []);

  const setBaselines = useCallback((map) => {
    Object.entries(map).forEach(([key, value]) => {
      baselineRef.current[key] = normalizeDateFieldValue(value);
    });
  }, []);

  const getResetValue = useCallback((key) => baselineRef.current[key] ?? "", []);

  return { setBaseline, setBaselines, getResetValue };
}

/** Slice saved employee/client date fields for edit-form Reset baselines. */
export const savedRecordDateDefault = (record, field) => {
  if (!record?.[field]) return "";
  return normalizeDateFieldValue(record[field]);
};
