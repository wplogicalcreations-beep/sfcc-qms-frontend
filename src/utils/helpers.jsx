export const TYPES = ['MS','DS','RFI','IR','NCR','TR','VO','SI'];

// Full document type definitions — code ↔ label mapping
export const DOC_TYPES = [
  { code:'MS',  label:'Material Submittal' },
  { code:'DS',  label:'Drawing Submittal' },
  { code:'IR',  label:'Inspection Request' },
  { code:'RFI', label:'Request for Information' },
  { code:'NCR', label:'Non-Conformance Report' },
  { code:'TR',  label:'Transmittal' },
  { code:'VO',  label:'Variation Order' },
  { code:'SI',  label:'Site Instruction' },
];

const TYPE_ALIAS_TO_CODE = {
  ms: 'MS',
  'material submittal': 'MS',
  ds: 'DS',
  'drawing submittal': 'DS',
  rfi: 'RFI',
  'request for information': 'RFI',
  ir: 'IR',
  'inspection request': 'IR',
  ncr: 'NCR',
  'non-conformance report': 'NCR',
  'non conformance report': 'NCR',
  tr: 'TR',
  transmittal: 'TR',
  vo: 'VO',
  'variation order': 'VO',
  si: 'SI',
  'site instruction': 'SI',
};

const DISCIPLINE_ALIAS_TO_KEY = {
  architectural: 'ARCHITECTURAL',
  arch: 'ARCHITECTURAL',
  civil: 'CIVIL',
  'civil & structural': 'CIVIL',
  'civil and structural': 'CIVIL',
  structural: 'CIVIL',
  mechanical: 'MECHANICAL_HVAC',
  mech: 'MECHANICAL_HVAC',
  hvac: 'MECHANICAL_HVAC',
  'mechanical (hvac)': 'MECHANICAL_HVAC',
  electrical: 'ELECTRICAL',
  elec: 'ELECTRICAL',
  'electrical (lv/hv)': 'ELECTRICAL',
  'electrical (hv/lv)': 'ELECTRICAL',
  plumbing: 'PLUMBING',
  'plumbing & drainage': 'PLUMBING',
  'fire fighting': 'FIRE_FIGHTING',
  fire: 'FIRE_FIGHTING',
  elv: 'ELV_LOW_CURRENT',
  'extra low voltage (elv)': 'ELV_LOW_CURRENT',
  'elv / low current': 'ELV_LOW_CURRENT',
  landscape: 'LANDSCAPE',
  other: 'OTHER',
  general: 'OTHER',
};

export function normalizeTypeCode(input) {
  if (!input) return '';
  const normalized = String(input).trim();
  const direct = normalized.toUpperCase();
  if (DOC_TYPES.some(t => t.code === direct)) return direct;
  return TYPE_ALIAS_TO_CODE[normalized.toLowerCase()] || direct;
}

export function normalizeDiscipline(input) {
  if (!input) return '';
  const normalized = String(input).trim().toLowerCase();
  return DISCIPLINE_ALIAS_TO_KEY[normalized] || normalized.toUpperCase();
}

export function getTypeLabel(code) {
  return DOC_TYPES.find(t => t.code === code)?.label || code;
}

export const DISCIPLINES = [
  'Architectural',
  'Civil & Structural',
  'Mechanical (HVAC)',
  'Electrical (LV/HV)',
  'Plumbing & Drainage',
  'Fire Fighting',
  'Extra Low Voltage (ELV)',
  'Landscape',
  'Safety & HSE',
  'Quality Assurance',
  'General',
];
export const WORKFLOW_STATUSES = ['Draft','Ready for Issue','Issued','Under Review','Response Received','Closed','Superseded','Cancelled'];
export const APPROVAL_STATUSES = ['Not Submitted','Submitted','Approved','Approved as Noted','Revise and Resubmit','Rejected'];
export const EVIDENCE_STATUSES = ['No Evidence','Pending Upload','Uploaded','Verified'];
export const ROLES = ['admin','pm','qaqc','dc','engineer','hse','planning'];
export const SEVERITY = ['Minor','Major','Critical'];
export const PRIORITIES = ['Routine','Urgent','Critical'];
export const ROOT_CAUSES = ['Design Error','Material Defect','Workmanship','Method Statement Not Followed','Specification Non-compliance','Inspection Failure','Other'];
export const SAFETY_TYPES = ['Permit to Work','Toolbox Talk','Incident','Near Miss','Safety Inspection','Induction','Risk Assessment'];
export const PERMIT_SUBTYPES = ['Hot Work','Work at Height','Confined Space','Excavation','Lifting','Electrical Isolation','Cold Work'];

const BADGE_MAP = {
  'Draft': 'badge-draft',
  'Ready for Issue': 'badge-ready',
  'Issued': 'badge-issued',
  'Under Review': 'badge-review',
  'Response Received': 'badge-received',
  'Closed': 'badge-closed',
  'Superseded': 'badge-resubmit',
  'Cancelled': 'badge-rejected',
  'Not Submitted': 'badge-not-submitted',
  'Submitted': 'badge-submitted',
  'Approved': 'badge-approved',
  'Approved as Noted': 'badge-approved-noted',
  'Rejected': 'badge-rejected',
  'Revise and Resubmit': 'badge-resubmit',
  'No Evidence': 'badge-no-evidence',
  'Pending Upload': 'badge-pending',
  'Uploaded': 'badge-uploaded',
  'Verified': 'badge-verified',
  'Active': 'badge-active',
  'On Hold': 'badge-on-hold',
  'Expired': 'badge-rejected',
  'Minor': 'badge-minor',
  'Major': 'badge-major',
  'Critical': 'badge-critical',
};

export function Badge({ value, className = '' }) {
  const cls = BADGE_MAP[value] || 'bg-slate-100 text-slate-500';
  return <span className={`badge ${cls} ${className}`}>{value}</span>;
}

export function TypeBadge({ type }) {
  const colors = {
    MS:'bg-blue-600',DS:'bg-green-700',RFI:'bg-purple-700',
    IR:'bg-sky-600',NCR:'bg-red-700',TR:'bg-teal-700',VO:'bg-orange-700',SI:'bg-indigo-700'
  };
  return (
    <span title={getTypeLabel(type)} className={`inline-flex items-center justify-center min-w-8 h-5 px-1 rounded text-white text-xs font-bold ${colors[type]||'bg-slate-600'}`}>
      {type}
    </span>
  );
}

export function isOverdue(dueDate) {
  if (!dueDate) return false;
  return dueDate < new Date().toISOString().split('T')[0];
}

export function fmtDate(d) {
  if (!d) return '—';
  return d.slice(0, 10);
}

export function fmtSAR(n) {
  if (!n) return '—';
  return 'SAR ' + Number(n).toLocaleString('en-US');
}

export function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d) - Date.now()) / 86400000);
}
