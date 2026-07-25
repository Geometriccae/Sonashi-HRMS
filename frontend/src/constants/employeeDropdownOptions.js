export const ACTIVE_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "Active", label: "Active (Working Employee)" },
  { value: "InActive", label: "Inactive (Non-Working Employee)" },
];

/** Four selectable company codes for employee assignment */
export const COMPANY_CODE_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "CC01", label: "Company Code 1 (CC01)" },
  { value: "CC02", label: "Company Code 2 (CC02)" },
  { value: "CC03", label: "Company Code 3 (CC03)" },
  { value: "CC04", label: "Company Code 4 (CC04)" },
];

export const ATTENDANCE_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "Onsite", label: "Onsite" },
  { value: "Leave", label: "Leave" },
];

export const VACATION_STATUS_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "Onsite", label: "Onsite" },
  { value: "On Vacation", label: "On vacation" },
  { value: "Vacation Approved", label: "Returned back from vacation" },
  { value: "Vacation Pending", label: "Yet to go" },
];

export const GENDER_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  { value: "", label: "-Select-" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Sister", label: "Sister" },
  { value: "Brother", label: "Brother" },
  { value: "Wife", label: "Wife" },
  { value: "Husband", label: "Husband" },
  { value: "Friend", label: "Friend" },
  { value: "Other", label: "Other" },
];

export const ROLE_OPTIONS_DEFAULT = [
  { value: "", label: "-Select-" },
  { value: "MANAGING DIRECTOR", label: "MANAGING DIRECTOR" },
  { value: "DRIVER", label: "DRIVER" },
  { value: "SALES MANAGER", label: "SALES MANAGER" },
  { value: "OVERSEAS SALES MANAGER", label: "OVERSEAS SALES MANAGER" },
  { value: "SALES EXECUTIVE", label: "SALES EXECUTIVE" },
  { value: "WAREHOUSE MANAGER", label: "WAREHOUSE MANAGER" },
  { value: "CUSTOMER SERVICE MANAGER", label: "CUSTOMER SERVICE MANAGER" },
  { value: "LABOUR", label: "LABOUR" },
  { value: "WAREHOUSE INCHARGE", label: "WAREHOUSE INCHARGE" },
  { value: "TECHNICIAN", label: "TECHNICIAN" },
  { value: "MERCHANDISER", label: "MERCHANDISER" },
  { value: "PACKER", label: "PACKER" },
  { value: "PURCHASE MANAGER", label: "PURCHASE MANAGER" },
  { value: "ONLINE SALES MANAGER", label: "ONLINE SALES MANAGER" },
  { value: "SENIOR ACCOUNTANT", label: "SENIOR ACCOUNTANT" },
  { value: "HELPER/LABOR", label: "HELPER/LABOR" },
  { value: "MADAM SON", label: "MADAM SON" },
  { value: "MADAM DRIVER", label: "MADAM DRIVER" },
  { value: "ONLINE SALES", label: "ONLINE SALES" },
  { value: "GRV SECTION", label: "GRV SECTION" },
  { value: "STOCK FILLER", label: "STOCK FILLER" },
  { value: "SPARE PARTS", label: "SPARE PARTS" },
  { value: "LOGISTICS", label: "LOGISTICS" },
  { value: "SERVICE/GRV", label: "SERVICE/GRV" },
  { value: "KAILASH SIR STAFF", label: "KAILASH SIR STAFF" },
  { value: "HUMAN RESOURCES MANAGER", label: "HUMAN RESOURCES MANAGER" },
  { value: "MADAM STAFF", label: "MADAM STAFF" },
  { value: "PURCHASING REPRESENTATIVE", label: "PURCHASING REPRESENTATIVE" },
  { value: "ACCOUNTANT", label: "ACCOUNTANT" },
  { value: "DATA ENTRY", label: "DATA ENTRY" },
  { value: "OFFICE BOY", label: "OFFICE BOY" },
];

export const DEPARTMENT_OPTIONS_DEFAULT = [
  { value: "", label: "-Select-" },
  { value: "PROMOTERS", label: "PROMOTERS" },
  { value: "OFFICE STAFF", label: "OFFICE STAFF" },
  { value: "WAREHOUSE", label: "WAREHOUSE" },
  { value: "CUSTOMER SERVICE", label: "CUSTOMER SERVICE" },
  { value: "KAILASH SIR STAFF", label: "KAILASH SIR STAFF" },
  { value: "MADAM STAFF", label: "MADAM STAFF" },
  { value: "SALES", label: "SALES" },
  { value: "MADAM DRIVER", label: "MADAM DRIVER" },
  { value: "SHOP", label: "SHOP" },
];

export function mergeWithDynamicOptions(defaultOptions, values) {
  const map = new Map();
  for (const opt of defaultOptions || []) {
    if (!opt || opt.value == null) continue;
    map.set(String(opt.value).toLowerCase(), { value: opt.value, label: opt.label });
  }
  for (const raw of values || []) {
    const val = String(raw || "").trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { value: val, label: val });
    }
  }
  // Preserve default order first, append new values after.
  const defaults = (defaultOptions || []).filter(Boolean);
  const appended = [];
  for (const [k, opt] of map.entries()) {
    const existsInDefaults = defaults.some((d) => String(d.value).toLowerCase() === k);
    if (!existsInDefaults) appended.push(opt);
  }
  appended.sort((a, b) => a.label.localeCompare(b.label));
  return [...defaults, ...appended];
}

export function ensureOptionWithValue(options, value) {
  const val = String(value || "").trim();
  if (!val) return options || [];
  const exists = (options || []).some((o) => String(o.value).toLowerCase() === val.toLowerCase());
  if (exists) return options || [];
  return [...(options || []), { value: val, label: val }];
}

