/** Internal addresses stored when email was left blank (unique-index workaround). */
export const PLACEHOLDER_EMAIL_HOST = "import.hrms.placeholder";

export function isPlaceholderEmployeeEmail(emailId) {
  if (emailId == null || String(emailId).trim() === "") return true;
  return String(emailId).trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_HOST}`);
}

export function employeeEmailDisplayState(emailId, emptyText = "Not provided") {
  if (isPlaceholderEmployeeEmail(emailId)) {
    return { isEmpty: true, text: emptyText };
  }
  return { isEmpty: false, text: String(emailId).trim() };
}

export function displayEmployeeEmail(emailId, emptyText = "Not provided") {
  return employeeEmailDisplayState(emailId, emptyText).text;
}
