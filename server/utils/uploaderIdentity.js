/**
 * Snapshot of the authenticated uploader for document records.
 * Display values are frozen at upload time so later viewers do not
 * rewrite "Uploaded by" to their own identity.
 */

const ROLE_LABELS = {
  admin: 'Admin',
  hr: 'HR',
  hod: 'Head of Department',
  viewer: 'Viewer',
  authorize_user: 'Authorize User',
  sales_executive: 'Sales Executive',
  sales_lead: 'Sales Lead',
  managing_director: 'Managing Director',
  director: 'Director',
  accounts_manager: 'Accounts Manager',
  chartering_manager: 'Chartering Manager',
  business_development_manager: 'Business Development Manager',
  office_assistance: 'Office Assistance',
  executive_post_fixture: 'Executive Post Fixture',
  operations_pricing_manager: 'Operations Pricing Manager',
  operations_executive: 'Operations Executive',
};

const PLACEHOLDER_UPLOADER_NAMES = new Set(['current user', 'unknown', '']);

function formatRoleLabel(role) {
  const raw = String(role || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  // Already a human label (e.g. "Sales Executive") — keep as saved.
  if (/[A-Z\s]/.test(raw) && !raw.includes('_')) return raw;
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildUploaderFields(user) {
  if (!user) {
    return {
      uploaderId: null,
      uploadedBy: '',
      userRole: '',
    };
  }
  const id = user._id || user.id || null;
  return {
    uploaderId: id || null,
    uploadedBy: String(user.username || '').trim(),
    userRole: formatRoleLabel(user.role),
  };
}

/**
 * Resolve display fields for a stored document.
 * Prefer immutable uploaderId → User; fall back to saved strings.
 * Rewrite known placeholder names when a real user reference exists.
 */
function resolveUploaderDisplay(doc) {
  const uploader =
    doc?.uploaderId && typeof doc.uploaderId === 'object' ? doc.uploaderId : null;

  let uploadedBy = String(uploader?.username || doc?.uploadedBy || '').trim();
  let userRole = formatRoleLabel(uploader?.role || doc?.userRole || '');

  if (uploader?.username) {
    uploadedBy = String(uploader.username).trim();
    userRole = formatRoleLabel(uploader.role || doc?.userRole || '');
    return { uploadedBy, userRole };
  }

  // Legacy client uploads stored hardcoded placeholders with no user link.
  if (PLACEHOLDER_UPLOADER_NAMES.has(uploadedBy.toLowerCase())) {
    return { uploadedBy: '', userRole: '' };
  }

  return { uploadedBy, userRole };
}

module.exports = {
  ROLE_LABELS,
  formatRoleLabel,
  buildUploaderFields,
  resolveUploaderDisplay,
};
