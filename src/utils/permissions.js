export const ROLES = [
  { code: 'system_admin', label: 'System Admin' },
  { code: 'project_manager', label: 'Project Manager' },
  { code: 'pmo', label: 'PMO' },
  { code: 'qa_qc_engineer', label: 'QA/QC Engineer' },
  { code: 'project_engineer', label: 'Project Engineer' },
  { code: 'site_engineer', label: 'Site Engineer' },
  { code: 'viewer', label: 'Viewer' },
];

export const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.code, r.label]));

const LEGACY_ROLE_MAP = {
  admin: 'system_admin',
  administrator: 'system_admin',
  'system admin': 'system_admin',
  system_admin: 'system_admin',
  document_controller: 'pmo',
  'document controller': 'pmo',
  'document-controller': 'pmo',
  pmo: 'pmo',
  'project manager': 'project_manager',
  project_manager: 'project_manager',
  'qa/qc engineer': 'qa_qc_engineer',
  'qa qc engineer': 'qa_qc_engineer',
  qa_qc_engineer: 'qa_qc_engineer',
  engineer: 'project_engineer',
  'project engineer': 'project_engineer',
  project_engineer: 'project_engineer',
  'site engineer': 'site_engineer',
  site_engineer: 'site_engineer',
  hse_officer: 'site_engineer',
  viewer: 'viewer',
  approver: 'qa_qc_engineer',
};

export function normalizeRole(role) {
  if (role === undefined || role === null) return 'viewer';
  const normalized = String(role).trim().toLowerCase();
  if (!normalized) return 'viewer';
  const canonical = normalized.replace(/[\s-]+/g, '_');
  const spaced = normalized.replace(/[\s_-]+/g, ' ');
  const resolved = LEGACY_ROLE_MAP[normalized] || LEGACY_ROLE_MAP[canonical] || LEGACY_ROLE_MAP[spaced] || canonical;
  return ROLE_LABELS[resolved] ? resolved : 'viewer';
}

export function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || 'Viewer';
}

export const PERMISSION_MATRIX = {
  'projects.view': { system_admin: 'All Projects', project_manager: 'All Projects', pmo: 'All Projects', qa_qc_engineer: 'All Projects', project_engineer: 'All Projects', site_engineer: 'Yes', viewer: 'Assigned' },
  'projects.create': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'No', viewer: 'No' },
  'projects.edit': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'No', viewer: 'Read Only' },
  'projects.team': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Read Only', viewer: 'Read Only' },
  'dashboard.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Read Only' },
  'dashboard.print': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'No', viewer: 'No' },
  'documents.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Read Only' },
  'documents.create': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'documents.edit_draft': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'documents.issue': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'documents.close': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
  'evidence.upload': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'evidence.verify': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'No', viewer: 'No' },
  'reports.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Read Only' },
  'reports.export_csv': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
  'reports.print': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'No', site_engineer: 'Yes', viewer: 'No' },
  'progress.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Read Only' },
  'progress.create': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'progress.edit_draft': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'progress.issue': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'progress.close': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'progress.photos_upload': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'inspections.create': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'ncr.create': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'No', viewer: 'No' },
  'schedule.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Read Only' },
  'schedule.edit': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'All Projects', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'No' },
  'notifications.view': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'Yes', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Yes' },
  'notifications.mark_read': { system_admin: 'Yes', project_manager: 'Yes', pmo: 'Yes', qa_qc_engineer: 'Yes', project_engineer: 'Yes', site_engineer: 'Yes', viewer: 'Yes' },
  'admin.backup_restore': { system_admin: 'Yes', project_manager: 'No', pmo: 'No', qa_qc_engineer: 'No', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
  'admin.users_manage': { system_admin: 'Yes', project_manager: 'No', pmo: 'No', qa_qc_engineer: 'No', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
  'admin.roles_manage': { system_admin: 'Yes', project_manager: 'No', pmo: 'No', qa_qc_engineer: 'No', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
  'admin.settings': { system_admin: 'Yes', project_manager: 'No', pmo: 'No', qa_qc_engineer: 'No', project_engineer: 'No', site_engineer: 'No', viewer: 'No' },
};

const MODULE_PERMISSION_MAP = {
  portfolio: 'projects.view',
  dashboard: 'dashboard.view',
  setup: 'projects.view',
  stakeholders: 'projects.team',
  documents: 'documents.view',
  submittals: 'documents.view',
  drawings: 'documents.view',
  rfi: 'documents.view',
  inspections: 'documents.view',
  ncr: 'documents.view',
  transmittals: 'documents.view',
  site_instructions: 'documents.view',
  'site-instructions': 'documents.view',
  safety: 'schedule.view',
  schedule: 'schedule.view',
  risks: 'schedule.view',
  progress: 'progress.view',
  followups: 'schedule.view',
  approvals: 'documents.view',
  handover: 'documents.view',
  reports: 'reports.view',
  backup_restore: 'admin.backup_restore',
  'backup-restore': 'admin.backup_restore',
  users_access: 'admin.users_manage',
};

const CREATE_PERMISSION_MAP = {
  portfolio: 'projects.create',
  setup: 'projects.edit',
  stakeholders: 'projects.team',
  documents: 'documents.create',
  submittals: 'documents.create',
  drawings: 'documents.create',
  rfi: 'documents.create',
  inspections: 'inspections.create',
  ncr: 'ncr.create',
  transmittals: 'documents.create',
  site_instructions: 'documents.create',
  'site-instructions': 'documents.create',
  schedule: 'schedule.edit',
  risks: 'schedule.edit',
  progress: 'progress.create',
  followups: 'schedule.edit',
  approvals: 'evidence.verify',
  reports_export: 'reports.export_csv',
  reports_print: 'reports.print',
};

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('sfcc_user') || '{}') || {};
  } catch {
    return {};
  }
};
export const getCurrentRole = () => normalizeRole(getCurrentUser()?.role);

export function permissionValue(permissionKey, user = getCurrentUser()) {
  const role = normalizeRole(user?.role);
  return PERMISSION_MATRIX[permissionKey]?.[role] || 'No';
}

export function canPerform(permissionKey, user = getCurrentUser(), { readOnlyOk = false } = {}) {
  const value = permissionValue(permissionKey, user);
  if (readOnlyOk) return ['Yes', 'Read Only', 'Assigned', 'All Projects', 'Restricted'].includes(value);
  return ['Yes', 'All Projects', 'Restricted'].includes(value);
}

export function canView(moduleName, user = getCurrentUser()) {
  return canPerform(MODULE_PERMISSION_MAP[moduleName] || moduleName, user, { readOnlyOk: true });
}

export function canCreate(moduleName, user = getCurrentUser()) {
  return canPerform(CREATE_PERMISSION_MAP[moduleName] || MODULE_PERMISSION_MAP[moduleName] || moduleName, user);
}

export function canEdit(moduleName, user = getCurrentUser()) { return canCreate(moduleName, user); }
export function canDelete(moduleName, user = getCurrentUser()) { return canCreate(moduleName, user); }
export function canUpload(moduleName, user = getCurrentUser()) {
  if (['documents', 'submittals', 'drawings', 'rfi', 'inspections', 'ncr', 'transmittals', 'site_instructions', 'site-instructions'].includes(moduleName)) return canPerform('evidence.upload', user);
  if (moduleName === 'progress') return canPerform('progress.photos_upload', user);
  return canCreate(moduleName, user);
}
export function canApprove(moduleName, user = getCurrentUser()) { return canPerform('evidence.verify', user) || canCreate(moduleName, user); }

export function canManageProjectStakeholders(user = getCurrentUser()) {
  return canPerform('projects.team', user);
}
