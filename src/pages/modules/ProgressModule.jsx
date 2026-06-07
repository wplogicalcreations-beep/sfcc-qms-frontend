import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import { canCreate, canPerform, getCurrentUser, normalizeRole as normalizePermissionRole } from '../../utils/permissions';
import { fmtDate } from '../../utils/helpers.jsx';
import { userSafeError } from '../../utils/uiMessages';

if (import.meta.env.DEV) {
  console.info('[ProgressModule] loaded fixed Phase 24F build');
}

const TODAY = new Date().toISOString().slice(0, 10);
const PRINT_ORIENTATIONS = [
  ['portrait', 'Portrait'],
  ['landscape', 'Landscape'],
];
const SFCC_FOOTER_ADDRESS = 'Riyadh, Kingdom of Saudi Arabia';
const STATUS_OPTIONS = ['draft', 'issued', 'closed'];
const PERMISSION_CHECK_ERROR = 'Permission check could not be completed. Please refresh or contact System Admin.';
const DAILY_FIELDS = [];
const WEEKLY_FIELDS = [
  ['executive_weekly_summary', 'Executive weekly summary'],
  ['planned_vs_actual_progress_summary', 'Planned vs actual progress summary'],
  ['missing_evidence_overdue_follow_up', 'Missing evidence / overdue follow-up'],
  ['major_issues_constraints', 'Major issues / constraints'],
  ['decisions_required', 'Decisions required'],
  ['required_support', 'Required support'],
];

const WEATHER_CONDITIONS = ['Clear', 'Cloudy', 'Rain', 'Dust', 'Wind', 'Hot', 'Other'];
const SITE_CONDITIONS = ['Normal', 'Restricted', 'Delayed', 'Unsafe', 'Other'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const ISSUE_STATUS_OPTIONS = ['Open', 'In Progress', 'Closed'];
const GENERAL_STATUS_OPTIONS = ['On Track', 'In Progress', 'Delayed', 'On Hold', 'Completed'];
const DAILY_ACTIVITY_STATUS_OPTIONS = ['Completed Today', 'Ongoing', 'Delayed', 'On Hold', 'Planned / Not Started'];
const STANDARD_DISCIPLINES = ['Architectural / Fit-out', 'Civil', 'Structural', 'Mechanical', 'HVAC', 'Plumbing', 'Electrical', 'Fire Fighting', 'ELV / Low Current', 'ICT / Data', 'Security Systems', 'AV Systems', 'Lighting', 'Landscape', 'External Works', 'Furniture / FF&E', 'Graphics / Signage', 'Setworks / Exhibition', 'Testing & Commissioning', 'Handover / Closeout', 'General / Other'];
const DISCIPLINE_VALUE_LABELS = {
  arch: 'Architectural / Fit-out',
  architectural: 'Architectural / Fit-out',
  'fit-out': 'Architectural / Fit-out',
  fitout: 'Architectural / Fit-out',
  civil: 'Civil',
  structural: 'Structural',
  mech: 'Mechanical',
  mechanical: 'Mechanical',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  elec: 'Electrical',
  electrical: 'Electrical',
  ff: 'Fire Fighting',
  fire_fighting: 'Fire Fighting',
  elv: 'ELV / Low Current',
  low_current: 'ELV / Low Current',
  ict: 'ICT / Data',
  data: 'ICT / Data',
  security: 'Security Systems',
  security_systems: 'Security Systems',
  av: 'AV Systems',
  av_systems: 'AV Systems',
  lighting: 'Lighting',
  landscape: 'Landscape',
  external_works: 'External Works',
  external: 'External Works',
  furniture: 'Furniture / FF&E',
  ffe: 'Furniture / FF&E',
  'ff&e': 'Furniture / FF&E',
  graphics: 'Graphics / Signage',
  signage: 'Graphics / Signage',
  setworks: 'Setworks / Exhibition',
  exhibition: 'Setworks / Exhibition',
  testing_commissioning: 'Testing & Commissioning',
  testing_and_commissioning: 'Testing & Commissioning',
  t_and_c: 'Testing & Commissioning',
  project_closeout: 'Handover / Closeout',
  closeout: 'Handover / Closeout',
  handover: 'Handover / Closeout',
  general: 'General / Other',
  other: 'General / Other',
};
const OPTIONAL_SECTIONS = [
  ['manpower_summary', 'Manpower Summary'],
  ['equipment_summary', 'Equipment Summary'],
  ['safety_quality_observations', 'Safety / Quality Observations'],
];
const OPTIONAL_SECTION_KEYS = new Set(OPTIONAL_SECTIONS.map(([key]) => key));

const DAILY_TABLES = [
  { key: 'daily_activity_progress_details', title: 'Daily Activity / Progress Details', empty: 'No activity/progress details recorded.', columns: [
    ['area_location', 'Area / Location'], ['discipline_work_package', 'Discipline / Work Package', 'discipline'], ['activity_description', 'Activity Description', 'textarea'], ['planned_pct', 'Planned %', 'percent'], ['actual_pct', 'Actual %', 'percent'], ['activity_status', 'Activity Status', 'select', DAILY_ACTIVITY_STATUS_OPTIONS], ['target_completion_next_step', 'Target Completion / Next Step'], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'issues_constraints_delays', title: 'Issues / Constraints / Delays', empty: 'No items recorded.', columns: [
    ['issue_constraint', 'Issue / Constraint', 'textarea'], ['impact', 'Impact', 'textarea'], ['discipline_area', 'Discipline / Area', 'discipline'], ['required_action', 'Required Action', 'textarea'], ['priority', 'Priority', 'select', PRIORITY_OPTIONS], ['status', 'Status', 'select', ISSUE_STATUS_OPTIONS], ['target_date', 'Target Date', 'date'], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'next_day_plan', title: 'Next Day Plan', empty: 'No items recorded.', columns: [
    ['planned_activity', 'Planned Activity', 'textarea'], ['area_location', 'Area / Location'], ['discipline_work_package', 'Discipline / Work Package', 'discipline'], ['planned_pct', 'Planned %', 'percent'], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'material_delivery_use', title: 'Material Delivery / Use', empty: 'No items recorded.', columns: [
    ['material_description', 'Material Description', 'textarea'], ['quantity', 'Quantity', 'number'], ['unit', 'Unit'], ['used_delivered_pending', 'Used / Delivered / Pending', 'select', ['Used', 'Delivered', 'Pending']], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'site_instructions_received', title: 'Site Instructions Received', empty: 'No items recorded.', columns: [
    ['instruction_reference', 'Instruction Reference'], ['description', 'Description', 'textarea'], ['action_required', 'Action Required', 'textarea'], ['status', 'Status', 'select', GENERAL_STATUS_OPTIONS], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'required_follow_up', title: 'Required Follow-up', empty: 'No items recorded.', columns: [
    ['follow_up_item', 'Follow-up Item', 'textarea'], ['responsible_internal_team_person', 'Responsible Internal Team / Person'], ['target_date', 'Target Date', 'date'], ['status', 'Status', 'select', GENERAL_STATUS_OPTIONS], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'manpower_summary', title: 'Manpower Summary', empty: 'No items recorded.', columns: [
    ['category_trade', 'Category / Trade'], ['planned_manpower', 'Planned Manpower', 'number'], ['actual_manpower', 'Actual Manpower', 'number'], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'equipment_summary', title: 'Equipment Summary', empty: 'No items recorded.', columns: [
    ['equipment_type', 'Equipment Type'], ['quantity', 'Quantity', 'number'], ['working_standby_breakdown', 'Working / Standby / Breakdown', 'select', ['Working', 'Standby', 'Breakdown']], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'safety_quality_observations', title: 'Safety / Quality Observations', empty: 'No items recorded.', columns: [
    ['observation_type', 'Observation Type: Safety / Quality', 'select', ['Safety', 'Quality']], ['description', 'Description', 'textarea'], ['action_required', 'Action Required', 'textarea'], ['status', 'Status', 'select', GENERAL_STATUS_OPTIONS], ['remarks', 'Remarks', 'textarea'],
  ] },
];

const WEEKLY_TABLES = [
  { key: 'discipline_workstream_progress_summary', title: 'Weekly Progress by Discipline / Work Package', empty: 'No weekly progress by discipline items recorded.', columns: [
    ['discipline_work_package', 'Discipline / Work Package', 'discipline'], ['scope_activity_summary', 'Scope / Activity Summary', 'textarea'], ['planned_pct', 'Planned %', 'percent'], ['actual_pct', 'Actual %', 'percent'], ['weekly_achievement', 'Weekly Achievement', 'textarea'], ['issues_constraints', 'Issues / Constraints', 'textarea'], ['next_week_plan', 'Next Week Plan', 'textarea'], ['status', 'Status', 'select', GENERAL_STATUS_OPTIONS],
  ] },
  { key: 'key_achievements_this_week', title: 'Weekly Key Achievements', empty: 'No weekly key achievement items recorded.', columns: [
    ['achievement_completed_work', 'Achievement / Completed Work', 'textarea'], ['discipline_area', 'Discipline / Area', 'discipline'], ['progress_pct', 'Progress %', 'percent'], ['related_qms_document', 'Related QMS Document (optional)'], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'weekly_risks_constraints_decisions', title: 'Weekly Risks / Constraints / Decisions', empty: 'No weekly risk, constraint or decision items recorded.', columns: [
    ['risk_constraint_decision_required', 'Risk / Constraint / Decision Required', 'textarea'], ['impact', 'Impact', 'textarea'], ['required_decision_action', 'Required Decision / Action', 'textarea'], ['responsible_internal_owner', 'Responsible Internal Owner'], ['target_date', 'Target Date', 'date'], ['priority', 'Priority', 'select', PRIORITY_OPTIONS], ['status', 'Status', 'select', ISSUE_STATUS_OPTIONS], ['remarks', 'Remarks', 'textarea'],
  ] },
  { key: 'next_week_plan', title: 'Weekly Next Week Plan', empty: 'No next week plan items recorded.', columns: [
    ['planned_activity', 'Planned Activity', 'textarea'], ['discipline_work_package', 'Discipline / Work Package', 'discipline'], ['target_pct', 'Target %', 'percent'], ['remarks', 'Remarks', 'textarea'],
  ] },
];

const emptyFields = (type) => {
  const narrative = Object.fromEntries((type === 'weekly' ? WEEKLY_FIELDS : DAILY_FIELDS).map(([key]) => [key, '']));
  const tableDefaults = Object.fromEntries((type === 'weekly' ? WEEKLY_TABLES : DAILY_TABLES).map(({ key }) => [key, []]));
  const sectionVisibility = Object.fromEntries(OPTIONAL_SECTIONS.map(([key]) => [key, false]));
  return type === 'daily' ? { ...narrative, ...tableDefaults, weather_site_condition: weatherValue(), section_visibility: sectionVisibility, selected_inspection_ids: [], site_progress_photos: [] } : { ...narrative, ...tableDefaults, section_visibility: sectionVisibility, selected_inspection_ids: [], site_progress_photos: [] };
};
const clean = (value, fallback = 'Not recorded') => (value === null || value === undefined || value === '' ? fallback : value);
const percent = (value) => (value === null || value === undefined || value === '' ? 'Not recorded' : `${Number(value)}%`);
const displayPercent = (value, fallback = 'Not recorded') => (value === null || value === undefined || value === '' ? fallback : `${Number(value)}%`);
const asRows = (value) => Array.isArray(value) ? value : [];
const legacyText = (value) => typeof value === 'string' && value.trim() ? value : '';
const weatherValue = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : { weather_condition: '', temperature: '', site_condition: '', working_hours: '', remarks: '' });
const varianceTone = (value) => {
  if (value === null || value === undefined || value === '') return 'text-slate-500 bg-slate-50 border-slate-200';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 'text-slate-600 bg-slate-50 border-slate-200';
  return n > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200';
};
const statusLabel = (value) => String(value || 'draft').charAt(0).toUpperCase() + String(value || 'draft').slice(1);
const headerStatusLabel = (value) => (value ? statusLabel(value) : 'Not Set');

const DOC_TYPE_LABELS = {
  MS: 'Material Submittal',
  DS: 'Document Submittal',
  RFI: 'Request for Information',
  IR: 'Inspection Request',
  SI: 'Site Instruction',
  TR: 'Transmittal',
  NCR: 'Non-Conformance Report',
  VO: 'Variation Order',
  HC: 'Handover Certificate',
};
const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const documentTypeLabel = (type) => DOC_TYPE_LABELS[type] || clean(type);
const visibleReference = (...values) => values.find((value) => value && !isUuidLike(value)) || 'Not recorded';
const reportTypeLabel = (value) => value === 'weekly' ? 'Weekly Progress Report' : 'Daily Progress Report';
const dateRangeLabel = (report) => report.report_type === 'weekly' ? `${fmtDate(report.week_start)} → ${fmtDate(report.week_end)}` : fmtDate(report.report_date);
const headerDateRangeLabel = (report) => {
  if (report.report_type === 'weekly') {
    const start = report.week_start ? fmtDate(report.week_start) : 'Not Set';
    const end = report.week_end ? fmtDate(report.week_end) : 'Not Set';
    return `${start} → ${end}`;
  }
  return report.report_date ? fmtDate(report.report_date) : 'Not Set';
};
const reportingPeriodLabel = (report) => report.report_type === 'weekly' ? `Week ${clean(report.week_number, '-')}` : 'Daily reporting period';
const normalizeProgressRole = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'viewer';
  if (raw === 'document_controller' || raw === 'document controller' || raw === 'pmo') return 'pmo';
  if (raw === 'system admin' || raw === 'administrator' || raw === 'admin') return 'system_admin';
  if (raw === 'project manager') return 'project_manager';
  if (raw === 'qa/qc engineer' || raw === 'qa_qc_engineer') return 'qa_qc_engineer';
  if (raw === 'project engineer') return 'project_engineer';
  if (raw === 'site engineer') return 'site_engineer';
  if (raw === 'viewer') return 'viewer';
  try {
    return normalizePermissionRole(value);
  } catch {
    return 'viewer';
  }
};

function getProgressPermissionState() {
  try {
    const user = getCurrentUser();
    const currentUser = { ...user, role: normalizeProgressRole(user?.role) };
    return {
      currentUser,
      allowCreate: canCreate('progress', currentUser),
      allowEdit: canPerform('progress.edit_draft', currentUser),
      permissionError: '',
    };
  } catch {
    return { currentUser: { role: 'viewer' }, allowCreate: false, allowEdit: false, permissionError: PERMISSION_CHECK_ERROR };
  }
}

function defaultForm(project) {
  const user = getCurrentUser();
  return {
    project_id: project.id,
    report_type: 'daily',
    report_date: TODAY,
    week_start: TODAY,
    week_end: TODAY,
    week_number: '',
    prepared_by: user?.id || user?.name || user?.email || '',
    prepared_by_display: user?.name || user?.email || 'Internal user',
    workflow_status: 'draft',
    overall_pct: '',
    planned_progress: '',
    actual_progress: '',
    variance: '',
    schedule_status: '',
    risk_status: '',
    general_remarks: '',
    manual_schedule_remarks: '',
    fields: emptyFields('daily'),
    document_ids: [],
    schedule_item_ids: [],
    manual_schedule_references: [''],
  };
}

export default function ProgressModule({ project }) {
  const [reports, setReports] = useState([]);
  const [options, setOptions] = useState({ documents: [], schedule: [] });
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('daily');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [printPending, setPrintPending] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('portrait');
  const [printTargetOrientation, setPrintTargetOrientation] = useState('portrait');
  const printTargetRef = useRef(null);
  const [error, setError] = useState('');
  const { allowCreate, allowEdit, permissionError } = useMemo(() => getProgressPermissionState(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, optionsRes] = await Promise.all([
        api.get('/progress', { params: { project_id: project.id } }),
        api.get('/progress/options', { params: { project_id: project.id } }),
      ]);
      setReports(Array.isArray(reportRes.data) ? reportRes.data : []);
      setOptions(optionsRes.data || { documents: [], schedule: [] });
    } catch (err) {
      setError(userSafeError(err, 'Progress reports could not be loaded. Please refresh and try again.'));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPrintOrientation(activeType === 'weekly' ? 'landscape' : 'portrait');
  }, [activeType]);

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (report.report_type !== activeType) return false;
      if (statusFilter && report.workflow_status !== statusFilter) return false;
      if (!q) return true;
      return [report.report_no, report.project_name, report.prepared_by_name, report.workflow_status, report.report_date, report.week_start, report.week_end]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [reports, activeType, query, statusFilter]);

  const counts = useMemo(() => ({ daily: reports.filter((r) => r.report_type === 'daily').length, weekly: reports.filter((r) => r.report_type === 'weekly').length }), [reports]);

  async function openReport(report, mode = 'view') {
    try {
      const res = await api.get(`/progress/${report.id}`);
      if (mode === 'edit') {
        setError('');
        setEditing(res.data);
        setFormOpen(true);
      } else {
        setViewing(res.data);
      }
    } catch (err) {
      setError(userSafeError(err, 'Progress report could not be opened. Please try again.'));
    }
  }

  async function printReport(report, orientation = printOrientation) {
    if (!report?.id) return;
    const selectedOrientation = ['portrait', 'landscape'].includes(orientation) ? orientation : defaultPrintOrientation(report);
    try {
      setPrintPending(true);
      setPrintTargetOrientation(selectedOrientation);
      const res = await api.get(`/progress/${report.id}`);
      setPrintTarget(res.data);
    } catch (err) {
      setPrintPending(false);
      setError(userSafeError(err, 'Progress report could not be prepared for print. Please try again.'));
    }
  }

  useEffect(() => {
    if (!printPending || !printTarget) return undefined;
    let cancelled = false;
    const waitForImages = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const target = printTargetRef.current;
      if (!target) return;
      const loadingDeadline = Date.now() + 2500;
      while (target.querySelector('[data-progress-photo-loading="true"]') && Date.now() < loadingDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      const images = Array.from(target.querySelectorAll('img'));
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 1800);
        });
      }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!cancelled) {
        window.print();
        setPrintPending(false);
      }
    };
    waitForImages();
    return () => { cancelled = true; };
  }, [printPending, printTarget]);

  useEffect(() => {
    const clearPrintTarget = () => { setPrintTarget(null); setPrintPending(false); };
    window.addEventListener('afterprint', clearPrintTarget);
    return () => window.removeEventListener('afterprint', clearPrintTarget);
  }, []);

  return (
    <div className="p-6 space-y-5 bg-stone-50 min-h-full progress-reporting-module progress-print-root">
      <PrintStyles />
      <header className="progress-module-hero no-print">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Progress Reporting</p>
            <h1 className="text-2xl font-black text-white mt-1">Daily / Weekly Progress Report Log</h1>
            <p className="text-sm text-slate-300 mt-1">{project.name} · {project.code || 'No project code'} · manual Silver Foundation internal reporting workflow.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrintOrientationSelector value={printOrientation} onChange={setPrintOrientation} compact dark />
            <button className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white font-semibold text-sm" disabled={!filteredReports[0] || printPending} onClick={() => printReport(filteredReports[0], printOrientation)}>{printPending ? 'Preparing Print…' : 'Print'}</button>
            {allowCreate && <button className="px-4 py-2 rounded-xl bg-slate-900 text-amber-100 font-semibold text-sm shadow-sm border border-amber-300/40" onClick={() => { setError(''); setEditing(null); setFormOpen(true); }}>+ New Progress Report</button>}
          </div>
        </div>
      </header>

      {permissionError && <div className="no-print bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">{permissionError}</div>}
      {error && <div className="no-print bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <section className="grid md:grid-cols-2 gap-4 no-print">
        <button type="button" onClick={() => setActiveType('daily')} className={`text-left rounded-2xl border p-5 shadow-sm ${activeType === 'daily' ? 'bg-slate-900 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wide opacity-80">Log</p><h2 className="text-xl font-black">Daily Progress Reports</h2></div><span className="text-2xl font-black">{counts.daily}</span></div>
          <p className="text-sm mt-2 opacity-80">Formal daily records with manual site, QMS, safety, quality, manpower, equipment and next-day fields.</p>
        </button>
        <button type="button" onClick={() => setActiveType('weekly')} className={`text-left rounded-2xl border p-5 shadow-sm ${activeType === 'weekly' ? 'bg-slate-900 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex justify-between items-start"><div><p className="text-xs uppercase tracking-wide opacity-80">Log</p><h2 className="text-xl font-black">Weekly Progress Reports</h2></div><span className="text-2xl font-black">{counts.weekly}</span></div>
          <p className="text-sm mt-2 opacity-80">Formal weekly summaries with manual achievements, planned-vs-actual, QMS references and next-week planning.</p>
        </button>
      </section>

      <section className="progress-log-card no-print">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">{activeType === 'daily' ? 'Daily Progress Report Log' : 'Weekly Progress Report Log'}</h2>
            <p className="text-xs text-slate-500">Open, edit or print controlled progress reports without duplicating QMS documents or schedule records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search report no., prepared by, date..." className="w-72 max-w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <PrintOrientationSelector value={printOrientation} onChange={setPrintOrientation} compact />
          </div>
        </div>
        {loading ? <div className="p-8 text-center text-slate-400 text-sm">Loading progress report log...</div> : <ReportLogTable reports={filteredReports} onOpen={openReport} onPrint={printReport} allowEdit={allowEdit} />}
      </section>

      {formOpen && <ProgressReportForm project={project} report={editing} options={options} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={() => { window.dispatchEvent(new CustomEvent('qms:notifications-refresh')); setFormOpen(false); setEditing(null); load(); }} />}
      {viewing && <ProgressReportDetail project={project} report={viewing} onClose={() => setViewing(null)} onEdit={allowEdit ? () => { setError(''); setEditing(viewing); setViewing(null); setFormOpen(true); } : null} onPrint={(orientation) => printReport(viewing, orientation)} />}
      {printTarget && <div ref={printTargetRef} className={`progress-print-target progress-print-${printTargetOrientation}`} aria-hidden={!printPending}><FormalReport project={project} report={printTarget} fields={printTarget.report_type === 'weekly' ? WEEKLY_FIELDS : DAILY_FIELDS} orientation={printTargetOrientation} /></div>}
    </div>
  );
}

function ReportLogTable({ reports, onOpen, onPrint, allowEdit }) {
  if (!reports.length) {
    return <div className="p-10 text-center"><div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-2xl">＋</div><h3 className="mt-3 font-black text-slate-900">No progress reports recorded yet.</h3><p className="text-sm text-slate-500 mt-1">Create a new Daily or Weekly Progress Report.</p></div>;
  }
  return (
    <div className="overflow-x-auto progress-log-table-wrap">
      <table className="min-w-full text-sm progress-log-table">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Report No.', 'Report Type', 'Project', 'Report Date / Week Range', 'Reporting Period', 'Prepared By', 'Workflow Status', 'Progress %', 'QMS Documents', 'Schedule / Progress', 'Last Updated', 'Action'].map((h) => <th key={h} className="px-4 py-3 text-left font-bold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {reports.map((report) => <tr key={report.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{clean(report.report_no || report.ref)}</td>
            <td className="px-4 py-3 whitespace-nowrap">{report.report_type === 'weekly' ? 'Weekly' : 'Daily'}</td>
            <td className="px-4 py-3 whitespace-nowrap">{clean(report.project_name)}</td>
            <td className="px-4 py-3 whitespace-nowrap">{dateRangeLabel(report)}</td>
            <td className="px-4 py-3 whitespace-nowrap">{reportingPeriodLabel(report)}</td>
            <td className="px-4 py-3 whitespace-nowrap">{clean(report.prepared_by_name || report.prepared_by)}</td>
            <td className="px-4 py-3"><StatusChip status={report.workflow_status} /></td>
            <td className="px-4 py-3 whitespace-nowrap">{percent(report.overall_pct ?? report.actual_progress)}</td>
            <td className="px-4 py-3 text-center">{report.linked_qms_count || 0}</td>
            <td className="px-4 py-3 text-center">{report.linked_schedule_count || 0}</td>
            <td className="px-4 py-3 whitespace-nowrap">{fmtDate(report.updated_at)}</td>
            <td className="px-4 py-3 whitespace-nowrap"><div className="progress-log-actions"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(report, 'view'); }} className="progress-action-open">Open</button>{allowEdit && <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(report, 'edit'); }} className="progress-action-secondary">Edit</button>}<button type="button" onClick={(e) => { e.stopPropagation(); onPrint(report); }} className="progress-action-secondary">Print</button></div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ProgressReportForm({ project, report, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => reportToForm(project, report));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fields = form.report_type === 'weekly' ? WEEKLY_FIELDS : DAILY_FIELDS;
  const disciplineOptions = useMemo(() => buildDisciplineOptions(), []);

  function patch(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'report_type') next.fields = emptyFields(value);
      if (['planned_progress', 'actual_progress'].includes(key)) {
        const planned = Number(key === 'planned_progress' ? value : next.planned_progress);
        const actual = Number(key === 'actual_progress' ? value : next.actual_progress);
        next.variance = Number.isFinite(planned) && Number.isFinite(actual) ? String(actual - planned) : '';
      }
      return next;
    });
  }
  function patchField(key, value) { setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } })); }
  function updateWeather(key, value) { setForm((prev) => ({ ...prev, fields: { ...prev.fields, weather_site_condition: { ...weatherValue(prev.fields.weather_site_condition), [key]: value } } })); }
  function updateTableRows(key, rows) { setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: rows } })); }
  function setSectionVisible(key, visible) { setForm((prev) => ({ ...prev, fields: { ...prev.fields, section_visibility: { ...(prev.fields.section_visibility || {}), [key]: visible } } })); }
  function updateInspectionSelection(ids) { setForm((prev) => ({ ...prev, fields: { ...prev.fields, selected_inspection_ids: ids, inspection_selection_locked: true } })); }
  function updatePhotos(photos) { setForm((prev) => ({ ...prev, photos })); }
  function toggle(listKey, id) { setForm((prev) => { const set = new Set(prev[listKey]); set.has(id) ? set.delete(id) : set.add(id); return { ...prev, [listKey]: [...set] }; }); }
  async function submit(nextStatus = form.workflow_status) {
    setSaving(true); setError('');
    const pendingPhotos = (form.photos || []).filter((photo) => photo.file);
    const payload = { ...form, photos: undefined, workflow_status: nextStatus, manual_schedule_references: form.manual_schedule_references.filter((v) => v.trim()) };
    try {
      const res = report?.id ? await api.patch(`/progress/${report.id}`, payload) : await api.post('/progress', payload);
      const savedId = report?.id || res.data?.id;
      if (savedId) {
        await updateExistingProgressPhotoMetadata(savedId, (form.photos || []).filter((photo) => photo.id && !photo.file));
        if (pendingPhotos.length) await uploadProgressPhotos(savedId, pendingPhotos);
      }
      onSaved();
    }
    catch (err) { setError(userSafeError(err, 'Progress report could not be saved. Please check the required fields and try again.')); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3 md:p-6 no-print progress-workspace-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[1480px] h-[94vh] bg-white shadow-2xl overflow-y-auto rounded-2xl border border-amber-200/60 progress-workspace-panel">
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-amber-400/40 p-5 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Progress Report Preparation Workspace</p><h2 className="text-xl font-black text-white">{report?.id ? `Edit ${reportTypeLabel(form.report_type)}` : `New ${reportTypeLabel(form.report_type)}`}</h2><p className="text-sm text-slate-300">{project.name} · {project.code || 'No project code'} · full-screen controlled reporting workspace.</p></div><div className="flex flex-wrap items-center gap-2"><button disabled={saving} onClick={() => submit('draft')} className="btn-secondary bg-white/10 text-white border-white/20 hover:bg-white/20">Save Draft</button><button disabled={saving} onClick={() => submit('issued')} className="btn-warning">Issue Report</button><button disabled={saving} onClick={() => submit('closed')} className="btn-primary">Close Report</button><button onClick={onClose} className="btn-secondary bg-white/10 text-white border-white/20 hover:bg-white/20">Cancel / Close</button></div></div>
        <div className="p-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <Section title="Report identification"><div className="grid md:grid-cols-3 gap-3"><Select label="Report Type" value={form.report_type} onChange={(v) => patch('report_type', v)} options={[['daily', 'Daily Progress Report'], ['weekly', 'Weekly Progress Report']]} disabled={Boolean(report?.id)} /><ReadOnly label="Project name/code" value={`${project.name} / ${project.code || 'No code'}`} /><ReadOnly label="Report No." value={report?.report_no || 'Generated safely on save'} />{form.report_type === 'daily' ? <Input label="Report date" type="date" value={form.report_date} onChange={(v) => patch('report_date', v)} /> : <><Input label="Week start date" type="date" value={form.week_start} onChange={(v) => patch('week_start', v)} /><Input label="Week end date" type="date" value={form.week_end} onChange={(v) => patch('week_end', v)} /><Input label="Week number if available" value={form.week_number} onChange={(v) => patch('week_number', v)} /></>}<ReadOnly label="Prepared by / internal user" value={form.prepared_by_display || 'Internal user'} /><Select label="Report status" value={form.workflow_status} onChange={(v) => patch('workflow_status', v)} options={STATUS_OPTIONS.map((s) => [s, statusLabel(s)])} /></div></Section>
          <Section title="Progress, schedule and risk status"><div className="grid md:grid-cols-4 gap-3"><Input label="Overall progress %" type="number" value={form.overall_pct} onChange={(v) => patch('overall_pct', v)} /><Input label="Planned progress %" type="number" value={form.planned_progress} onChange={(v) => patch('planned_progress', v)} /><Input label="Actual progress %" type="number" value={form.actual_progress} onChange={(v) => patch('actual_progress', v)} /><Input label="Variance %" type="number" value={form.variance} onChange={(v) => patch('variance', v)} /><Input label="Schedule status" value={form.schedule_status} onChange={(v) => patch('schedule_status', v)} /><Input label="Risk status" value={form.risk_status} onChange={(v) => patch('risk_status', v)} /></div><Textarea label="General remarks" value={form.general_remarks} onChange={(v) => patch('general_remarks', v)} /></Section>
          <StructuredProgressFields type={form.report_type} fields={form.fields} project={project} reportDate={form.report_date} weekStart={form.week_start} weekEnd={form.week_end} inspections={options.inspections || []} disciplineOptions={disciplineOptions} onWeatherChange={updateWeather} onRowsChange={updateTableRows} onSectionVisible={setSectionVisible} onInspectionSelection={updateInspectionSelection} />
          {fields.length ? <Section title={form.report_type === 'weekly' ? 'Additional Weekly Narrative Fields' : 'Additional Daily Narrative Fields'}><div className="grid md:grid-cols-2 gap-3">{fields.map(([key, label]) => <Textarea key={key} label={label} value={typeof form.fields[key] === 'string' ? form.fields[key] : ''} onChange={(v) => patchField(key, v)} />)}</div></Section> : null}
          <PhotoUploadSection photos={form.photos || []} disciplineOptions={disciplineOptions} reportId={report?.id} onChange={updatePhotos} onDeleted={(id) => updatePhotos((form.photos || []).filter((photo) => photo.id !== id))} />
          <Section title="QMS Documents"><p className="text-xs text-slate-500 mb-3">Select existing QMS documents only. Records are associated with this progress report and not duplicated.</p><SelectableTable items={options.documents || []} selected={form.document_ids} onToggle={(id) => toggle('document_ids', id)} type="documents" /></Section>
          <Section title="Schedule / Progress References">{(options.schedule || []).length ? <SelectableTable items={options.schedule || []} selected={form.schedule_item_ids} onToggle={(id) => toggle('schedule_item_ids', id)} type="schedule" /> : <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">No schedule activities available.</div>}<Textarea label="Manual schedule/progress remarks" value={form.manual_schedule_remarks} onChange={(v) => patch('manual_schedule_remarks', v)} /><div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Manual schedule/progress references</label>{form.manual_schedule_references.map((ref, index) => <input key={index} value={ref} onChange={(e) => setForm((prev) => ({ ...prev, manual_schedule_references: prev.manual_schedule_references.map((v, i) => i === index ? e.target.value : v) }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Manual milestone/activity reference" />)}<button type="button" onClick={() => setForm((prev) => ({ ...prev, manual_schedule_references: [...prev.manual_schedule_references, ''] }))} className="text-sm font-semibold text-amber-700">+ Add manual reference</button></div></Section>
          <div className="sticky bottom-0 bg-white border-t border-slate-200 py-4 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-sm">Cancel</button><button disabled={saving} onClick={() => submit('draft')} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold text-sm">Save Draft</button><button disabled={saving} onClick={() => submit('issued')} className="px-4 py-2 rounded-xl bg-slate-900 text-amber-50 font-semibold text-sm">Issue Report</button><button disabled={saving} onClick={() => submit('closed')} className="btn-primary">Close Report</button></div>
        </div>
      </div>
    </div>
  );
}


function StructuredProgressFields({ type, fields, project, reportDate, weekStart, weekEnd, inspections, disciplineOptions, onWeatherChange, onRowsChange, onSectionVisible, onInspectionSelection }) {
  const tables = type === 'weekly' ? WEEKLY_TABLES : DAILY_TABLES;
  const visibleTables = tables.filter((table) => !OPTIONAL_SECTION_KEYS.has(table.key) || isSectionVisible(fields, table.key));
  const hiddenOptional = OPTIONAL_SECTIONS.filter(([key]) => !isSectionVisible(fields, key));
  return (
    <div className="space-y-5">
      {type === 'daily' && <WeatherSiteCard value={weatherValue(fields.weather_site_condition)} legacy={legacyText(fields.weather_site_condition)} project={project} reportDate={reportDate} onChange={onWeatherChange} />}
      {hiddenOptional.length ? <Section title="Optional report sections"><div className="flex flex-wrap gap-2">{hiddenOptional.map(([key, title]) => <button key={key} type="button" onClick={() => onSectionVisible(key, true)} className="px-3 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 text-sm font-bold">+ Add {title}</button>)}</div><p className="text-xs text-slate-500">Hidden optional sections are preserved in saved data and excluded from detail/print until added again.</p></Section> : null}
      {visibleTables.map((table) => <EditableItemTable key={table.key} config={table} rows={asRows(fields[table.key])} legacy={legacyText(fields[table.key])} disciplineOptions={disciplineOptions} onRemoveSection={OPTIONAL_SECTION_KEYS.has(table.key) ? () => onSectionVisible(table.key, false) : null} onChange={(rows) => onRowsChange(table.key, rows)} />)}
      <InspectionRequestSelector type={type} reportDate={reportDate} weekStart={weekStart} weekEnd={weekEnd} inspections={inspections} selectedIds={resolveInspectionSelection(fields, inspections, type, reportDate, weekStart, weekEnd)} onChange={onInspectionSelection} />
    </div>
  );
}

function WeatherSiteCard({ value, legacy, project, reportDate, onChange }) {
  const [autoMessage, setAutoMessage] = useState('');
  const projectLocation = project?.location || project?.address || '';
  const handleAutoFill = () => {
    setAutoMessage(`Weather auto-fill not configured${projectLocation ? ` for ${projectLocation}` : ''}${reportDate ? ` on ${reportDate}` : ''}. Enter weather/site conditions manually.`);
  };
  return (
    <Section title="Weather / Site Conditions" actions={<button type="button" onClick={handleAutoFill} className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold">Auto-fill Weather</button>}>
      <p className="text-xs text-slate-500">Use project location{projectLocation ? ` (${projectLocation})` : ''} and report date{reportDate ? ` (${reportDate})` : ''} when a configured weather service is available. Manual override remains available.</p>
      {autoMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 font-semibold">{autoMessage}</div>}
      <div className="grid md:grid-cols-5 gap-3">
        <Select label="Weather condition" value={value.weather_condition || ''} onChange={(v) => onChange('weather_condition', v)} options={[['', 'Not recorded'], ...WEATHER_CONDITIONS.map((v) => [v, v])]} />
        <Input label="Temperature" value={value.temperature || ''} onChange={(v) => onChange('temperature', v)} />
        <Select label="Site condition" value={value.site_condition || ''} onChange={(v) => onChange('site_condition', v)} options={[['', 'Not recorded'], ...SITE_CONDITIONS.map((v) => [v, v])]} />
        <Input label="Working hours" value={value.working_hours || ''} onChange={(v) => onChange('working_hours', v)} />
        <Input label="Remarks" value={value.remarks || ''} onChange={(v) => onChange('remarks', v)} />
      </div>
      {legacy && <LegacyNote title="Previously saved weather/site narrative" text={legacy} />}
    </Section>
  );
}

function EditableItemTable({ config, rows, legacy, disciplineOptions, onRemoveSection, onChange }) {
  const addRow = () => onChange([...rows, {}]);
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));
  const updateCell = (index, key, value) => {
    const next = rows.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [key]: value };
      if (['planned_pct', 'actual_pct'].includes(key)) {
        const planned = Number(key === 'planned_pct' ? value : updated.planned_pct);
        const actual = Number(key === 'actual_pct' ? value : updated.actual_pct);
        updated.variance_pct = Number.isFinite(planned) && Number.isFinite(actual) ? String(actual - planned) : (updated.variance_pct || '');
      }
      return updated;
    });
    onChange(next);
  };
  return (
    <Section title={config.title} actions={<div className="flex gap-2"><button type="button" onClick={addRow} className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-50 text-xs font-bold">+ Add Row</button>{onRemoveSection && <button type="button" onClick={onRemoveSection} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-bold">Remove Section</button>}</div>}>
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-[1100px] w-full text-xs progress-edit-table">
          <thead className="bg-slate-50 text-slate-600 uppercase"><tr><th className="p-2 border-b border-slate-200 text-left w-12">No.</th>{config.columns.map(([key, label]) => <th key={key} className="p-2 border-b border-slate-200 text-left min-w-36">{label}</th>)}<th className="p-2 border-b border-slate-200 text-left w-24">Action</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => <tr key={index} className="align-top border-t border-slate-100"><td className="p-2 font-bold text-slate-500">{index + 1}</td>{config.columns.map(([key, label, type, options]) => <td key={key} className="p-2"><EditableCell type={type} options={type === 'discipline' ? disciplineOptions : options} value={type === 'discipline' ? disciplineSelectValue(row[key]) : (row[key] || '')} label={label} isVariance={key === 'variance_pct'} onChange={(v) => updateCell(index, key, v)} /></td>)}<td className="p-2"><button type="button" onClick={() => removeRow(index)} className="px-2 py-1 rounded-lg border border-red-200 text-red-700 font-semibold">Remove</button></td></tr>) : <tr><td colSpan={config.columns.length + 2} className="p-5 text-center text-slate-500 bg-slate-50">{config.empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {legacy && <LegacyNote title="Previously saved narrative for this section" text={legacy} />}
    </Section>
  );
}

function EditableCell({ type, options = [], value, label, isVariance, onChange }) {
  const cls = `w-full min-w-32 px-2 py-1.5 rounded-lg border text-xs ${isVariance ? varianceTone(value) : 'border-slate-200'}`;
  if (type === 'discipline') return <select aria-label={label} value={disciplineSelectValue(value)} onChange={(e) => onChange(e.target.value)} className={`${cls} bg-white`}><option value="">Not recorded</option>{STANDARD_DISCIPLINES.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (type === 'select') return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} bg-white`}><option value="">Not recorded</option>{[...new Set((options || []).filter(Boolean))].map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (type === 'textarea') return <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />;
  if (type === 'percent') return <div className="relative"><input aria-label={label} type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} pr-6`} /><span className="absolute right-2 top-1.5 text-slate-400 font-bold">%</span></div>;
  return <input aria-label={label} type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
}

function LegacyNote({ title, text }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><div className="text-xs font-black uppercase text-amber-700">{title}</div><p className="mt-1 whitespace-pre-wrap text-amber-900">{text}</p></div>;
}


function disciplineKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s/&-]+/g, '_').replace(/__+/g, '_');
}

function normalizeDisciplineLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const allowed = STANDARD_DISCIPLINES.find((label) => label.toLowerCase() === raw.toLowerCase());
  return allowed || DISCIPLINE_VALUE_LABELS[disciplineKey(raw)] || raw;
}

function disciplineSelectValue(value) {
  const label = normalizeDisciplineLabel(value);
  return STANDARD_DISCIPLINES.includes(label) ? label : '';
}

function buildDisciplineOptions() {
  return STANDARD_DISCIPLINES;
}

function normalizeFields(type, savedFields = {}) {
  const fields = { ...emptyFields(type), ...savedFields };
  if (type === 'daily') {
    const existingCombined = asRows(fields.daily_activity_progress_details);
    if (!existingCombined.length) {
      fields.daily_activity_progress_details = mergeLegacyDailyActivityRows(fields);
    }
  }
  const visibility = { ...(fields.section_visibility || {}) };
  OPTIONAL_SECTIONS.forEach(([key]) => {
    if (asRows(fields[key]).length) visibility[key] = true;
    else if (visibility[key] === undefined) visibility[key] = false;
  });
  fields.section_visibility = visibility;
  if (!Array.isArray(fields.selected_inspection_ids)) fields.selected_inspection_ids = [];
  fields.inspection_selection_locked = Boolean(fields.inspection_selection_locked);
  return fields;
}


function mergeLegacyDailyActivityRows(fields) {
  const mapLegacy = (rows, fallbackStatus) => asRows(rows).map((row) => ({
    area_location: row.area_location || '',
    discipline_work_package: row.discipline_work_package || row.discipline || '',
    activity_description: row.activity_description || row.planned_activity || row.description || '',
    planned_pct: row.planned_pct ?? '',
    actual_pct: row.actual_pct ?? '',
    activity_status: row.activity_status || row.status || fallbackStatus,
    target_completion_next_step: row.target_completion_next_step || row.next_step || '',
    remarks: row.remarks || '',
  }));
  return [
    ...mapLegacy(fields.work_performed_today, 'Completed Today'),
    ...mapLegacy(fields.ongoing_activities, 'Ongoing'),
  ];
}

function isSectionVisible(fields, key) {
  if (!OPTIONAL_SECTION_KEYS.has(key)) return true;
  if (asRows(fields?.[key]).length) return true;
  return Boolean(fields?.section_visibility?.[key]);
}

function inspectionDate(inspection) {
  return (inspection.requested_date || inspection.issue_date || inspection.updated_at || inspection.created_at || '').slice(0, 10);
}

function inspectionsForPeriod(inspections, type, reportDate, weekStart, weekEnd) {
  return (inspections || []).filter((inspection) => {
    const date = inspectionDate(inspection);
    if (!date) return true;
    if (type === 'weekly') return (!weekStart || date >= weekStart) && (!weekEnd || date <= weekEnd);
    return !reportDate || date === reportDate;
  });
}

function resolveInspectionSelection(fields, inspections, type, reportDate, weekStart, weekEnd) {
  if (fields.inspection_selection_locked && Array.isArray(fields.selected_inspection_ids)) return fields.selected_inspection_ids;
  if (Array.isArray(fields.selected_inspection_ids) && fields.selected_inspection_ids.length) return fields.selected_inspection_ids;
  return inspectionsForPeriod(inspections, type, reportDate, weekStart, weekEnd).map((inspection) => inspection.id);
}

function inspectionTitle(inspection) {
  return visibleReference(inspection.ref, inspection.title);
}

async function uploadProgressPhotos(reportId, photos) {
  const data = new FormData();
  photos.forEach((photo) => {
    data.append('photos', photo.file);
    data.append('captions', photo.caption || '');
    data.append('area_locations', photo.area_location || '');
    data.append('disciplines', photo.discipline || '');
    data.append('taken_ats', photo.taken_at || '');
    data.append('remarks', photo.remarks || '');
  });
  await api.post(`/progress/${reportId}/photos`, data);
}


async function updateExistingProgressPhotoMetadata(reportId, photos) {
  await Promise.all((photos || []).map((photo) => api.patch(`/progress/${reportId}/photos/${photo.id}`, {
    caption: photo.caption || '',
    area_location: photo.area_location || '',
    discipline: photo.discipline || '',
    taken_at: photo.taken_at || '',
    remarks: photo.remarks || '',
  })));
}

function InspectionRequestSelector({ type, reportDate, weekStart, weekEnd, inspections, selectedIds, onChange }) {
  const periodMatches = inspectionsForPeriod(inspections, type, reportDate, weekStart, weekEnd);
  const selected = new Set(selectedIds || []);
  const visible = periodMatches.length ? periodMatches : inspections;
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  return (
    <Section title="Inspections Conducted">
      <p className="text-xs text-slate-500">Select real Inspection Request records from this project. Matching report-period inspections are selected automatically; no inspection records are duplicated.</p>
      {!visible.length ? <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">No inspection records found for this report period.</div> : <div className="overflow-x-auto border border-slate-200 rounded-xl"><table className="min-w-[1100px] w-full text-xs"><thead className="bg-slate-50 text-slate-600 uppercase"><tr>{['Include', 'IR Reference', 'Inspection Type / Title', 'Discipline', 'Location / Area', 'Requested Date', 'Inspection Status / Outcome', 'Approval Status', 'Evidence Status', 'Remarks'].map((h) => <th key={h} className="p-2 border-b text-left">{h}</th>)}</tr></thead><tbody>{visible.map((inspection) => <tr key={inspection.id} className="border-t border-slate-100"><td className="p-2"><input type="checkbox" checked={selected.has(inspection.id)} onChange={() => toggle(inspection.id)} /></td><td className="p-2 font-semibold">{visibleReference(inspection.ref)}</td><td className="p-2">{clean(inspection.title)}</td><td className="p-2">{clean(normalizeDisciplineLabel(inspection.discipline))}</td><td className="p-2">{clean(inspection.area)}</td><td className="p-2">{fmtDate(inspectionDate(inspection))}</td><td className="p-2">{clean(inspection.workflow_status)}</td><td className="p-2">{clean(inspection.approval_status)}</td><td className="p-2">{clean(inspection.evidence_status)}</td><td className="p-2">{clean(inspection.remarks || inspection.notes)}</td></tr>)}</tbody></table></div>}
    </Section>
  );
}

function InspectionPrintSection({ inspections }) {
  return <PrintSection title="Inspections Conducted">{inspections.length ? <div className="overflow-x-auto"><table className="w-full text-[11px] border border-slate-200 progress-print-table"><thead className="bg-slate-100"><tr>{['IR Reference', 'Inspection Type / Title', 'Discipline', 'Location / Area', 'Requested Date', 'Inspection Status / Outcome', 'Approval Status', 'Evidence Status', 'Remarks'].map((h) => <th key={h} className="p-1.5 border text-left">{h}</th>)}</tr></thead><tbody>{inspections.map((inspection) => <tr key={inspection.id}><td className="p-1.5 border font-semibold">{visibleReference(inspection.ref)}</td><td className="p-1.5 border">{clean(inspection.title)}</td><td className="p-1.5 border">{clean(normalizeDisciplineLabel(inspection.discipline))}</td><td className="p-1.5 border">{clean(inspection.area)}</td><td className="p-1.5 border">{fmtDate(inspectionDate(inspection))}</td><td className="p-1.5 border">{clean(inspection.workflow_status)}</td><td className="p-1.5 border">{clean(inspection.approval_status)}</td><td className="p-1.5 border">{clean(inspection.evidence_status)}</td><td className="p-1.5 border">{clean(inspection.remarks || inspection.notes)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No inspection records found for this report period.</p>}</PrintSection>;
}

function PhotoUploadSection({ photos, disciplineOptions, reportId, onChange, onDeleted }) {
  const addFiles = (files) => {
    const additions = Array.from(files || []).map((file) => ({ temp_id: `${Date.now()}-${file.name}-${Math.random()}`, file, original_name: file.name, preview_url: URL.createObjectURL(file), caption: '', area_location: '', discipline: '', taken_at: '', remarks: '' }));
    onChange([...(photos || []), ...additions]);
  };
  const update = (idx, key, value) => onChange(photos.map((photo, i) => i === idx ? { ...photo, [key]: value } : photo));
  const remove = async (idx) => {
    const photo = photos[idx];
    if (photo.id && reportId) {
      await api.delete(`/progress/${reportId}/photos/${photo.id}`);
      onDeleted(photo.id);
    } else {
      onChange(photos.filter((_, i) => i !== idx));
    }
  };
  return (
    <Section title="Site Progress Photos">
      <p className="text-xs text-slate-500">Upload site progress pictures with caption, location, discipline and remarks. Files are stored as report attachments, not inside fields JSON.</p>
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} className="block w-full text-sm" />
      {!photos.length ? <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">No site progress photos attached.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 progress-photo-grid">{photos.map((photo, idx) => <div key={photo.id || photo.temp_id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white progress-photo-card"><PhotoPreview photo={photo} reportId={reportId} /><div className="grid md:grid-cols-2 gap-2"><Input label="Caption / description" value={photo.caption || ''} onChange={(v) => update(idx, 'caption', v)} /><Input label="Area / location" value={photo.area_location || ''} onChange={(v) => update(idx, 'area_location', v)} /><label className="block"><span className="text-xs font-bold text-slate-500 uppercase">Discipline / Work Package</span><select value={disciplineSelectValue(photo.discipline)} onChange={(e) => update(idx, 'discipline', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"><option value="">Not recorded</option>{disciplineOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><Input label="Date / time" type="datetime-local" value={photo.taken_at || ''} onChange={(v) => update(idx, 'taken_at', v)} /></div><Textarea label="Remarks" value={photo.remarks || ''} onChange={(v) => update(idx, 'remarks', v)} /><button type="button" onClick={() => remove(idx)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-bold">Remove Photo</button></div>)}</div>}
    </Section>
  );
}

function PhotoPreview({ photo, reportId }) {
  const [objectUrl, setObjectUrl] = useState(photo.preview_url || '');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(!photo.preview_url && photo.id && reportId));
  useEffect(() => {
    if (photo.preview_url) { setObjectUrl(photo.preview_url); setFailed(false); setLoading(false); return undefined; }
    if (!photo.id || !reportId) { setObjectUrl(''); setLoading(false); return undefined; }
    let cancelled = false;
    let localUrl = '';
    setLoading(true);
    setFailed(false);
    const token = localStorage.getItem('sfcc_token');
    api.get(`/progress/${reportId}/photos/${photo.id}/view`, { responseType: 'blob', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(res.data);
        setObjectUrl(localUrl);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [photo.id, photo.preview_url, reportId]);
  if (!objectUrl || failed) return <div data-progress-photo-loading={loading ? 'true' : 'false'} className="progress-photo-placeholder rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-center text-sm text-slate-500 px-3">{loading ? 'Loading photo…' : clean(photo.original_name || photo.file_name, 'Photo preview unavailable')}</div>;
  return <img src={objectUrl} alt={photo.caption || photo.original_name || 'Progress photo'} className="progress-photo-image w-full object-cover rounded-lg border border-stone-200" onError={() => { setFailed(true); setLoading(false); }} />;
}

function PhotoMeta({ label, value }) {
  return <div><span className="font-bold text-slate-500">{label}: </span>{clean(value, 'Not Set')}</div>;
}

function PhotoGallery({ photos, reportId, printMode = false }) {
  return <PrintSection title="Site Progress Photos" className="progress-photo-section">{photos.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 progress-photo-grid progress-photo-print-grid">{photos.map((photo) => {
    const caption = photo.caption || photo.description || '';
    const fallbackName = photo.original_name || photo.file_name || photo.stored_name || '';
    return <figure key={photo.id || photo.stored_name || photo.original_name} className={`border border-stone-200 rounded-lg p-2 bg-white progress-photo-card ${printMode ? 'progress-photo-print' : ''}`}><PhotoPreview photo={photo} reportId={reportId} /><figcaption className="mt-2 text-[11px] space-y-1"><div className="font-bold text-stone-950">{clean(caption || fallbackName, 'Progress photo')}</div><PhotoMeta label="Area / Location" value={photo.area_location} /><PhotoMeta label="Discipline" value={normalizeDisciplineLabel(photo.discipline)} />{photo.taken_at && <PhotoMeta label="Date / Time" value={fmtDate(photo.taken_at)} />}{photo.remarks && <PhotoMeta label="Remarks" value={photo.remarks} />}{!caption && fallbackName && <div className="text-stone-500 break-all">{fallbackName}</div>}</figcaption></figure>;
  })}</div> : <p className="text-sm text-stone-500">No site progress photos attached.</p>}</PrintSection>;
}

function reportToForm(project, report) {
  const base = defaultForm(project);
  if (!report) return base;
  const type = report.report_type || 'daily';
  const fields = normalizeFields(type, report.fields || {});
  return { ...base, ...report, report_type: type, prepared_by: report.prepared_by || base.prepared_by, prepared_by_display: report.prepared_by_name || base.prepared_by_display, workflow_status: report.workflow_status || 'draft', fields, photos: report.photos || [], document_ids: (report.linked_documents || []).map((d) => d.id), schedule_item_ids: (report.linked_schedule_items || []).filter((s) => s.id).map((s) => s.id), manual_schedule_references: (report.linked_schedule_items || []).filter((s) => s.manual_reference).map((s) => s.manual_reference).concat(['']) };
}


function defaultPrintOrientation(report) {
  return report?.report_type === 'weekly' ? 'landscape' : 'portrait';
}

function displayOrNotSet(value) {
  return clean(value, 'Not Set');
}

function reportRevision(report) {
  return displayOrNotSet(report.revision || report.rev);
}

function projectValue(project, ...keys) {
  for (const key of keys) {
    if (project?.[key] !== undefined && project?.[key] !== null && String(project[key]).trim()) return project[key];
  }
  return '';
}

function mainWorkstream(project, report) {
  return report?.discipline || report?.main_workstream || projectValue(project, 'discipline', 'sector', 'type');
}

function stakeholderRows(project, report, generatedAt) {
  return [
    ['Report No.', report?.report_no || report?.ref],
    ['Revision', reportRevision(report)],
    ['Status', headerStatusLabel(report?.workflow_status)],
    ['Report Date / Week Range', headerDateRangeLabel(report)],
    ['Project Name', projectValue(project, 'name')],
    ['Project Code / Project No.', projectValue(project, 'code', 'project_no')],
    ['Client / Employer', projectValue(project, 'client', 'employer')],
    ['Main Contractor', projectValue(project, 'main_contractor')],
    ['Consultant', projectValue(project, 'consultant')],
    ['PMC', projectValue(project, 'pmc')],
    ['Location / Site', projectValue(project, 'location', 'site')],
    ['Contract No.', projectValue(project, 'contract_no')],
    ['Prepared By', report?.prepared_by_name || report?.prepared_by],
    ['Generated Date', generatedAt],
    ['Quality System', 'Quality Management System'],
    ['Discipline / Main Workstream', mainWorkstream(project, report)],
  ];
}

function PrintOrientationSelector({ value, onChange, compact = false, dark = false }) {
  return (
    <label className={`progress-orientation-control ${dark ? 'progress-orientation-control-dark' : ''} ${compact ? 'progress-orientation-control-compact' : ''}`}>
      <span>Print orientation</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PRINT_ORIENTATIONS.map(([orientation, label]) => <option key={orientation} value={orientation}>{label}</option>)}
      </select>
    </label>
  );
}

function ControlledProgressHeader({ project, report, generatedAt }) {
  const title = reportTypeLabel(report.report_type);
  const rows = stakeholderRows(project, report, generatedAt);
  return (
    <header className="progress-controlled-header controlled-progress-header">
      <div className="progress-controlled-titlebar">
        <div className="progress-controlled-brand">
          <div className="progress-brand-mark">SF</div>
          <div>
            <div className="progress-brand-name">Silver Foundation Contracting Company</div>
            <div className="progress-brand-subtitle">Quality Management System · Controlled Progress Report</div>
          </div>
        </div>
        <div className="progress-controlled-report-title">
          <h1>{title}</h1>
          <div className="progress-controlled-meta"><span>Report No. {displayOrNotSet(report.report_no || report.ref)}</span><span>Revision {reportRevision(report)}</span><span>Status {headerStatusLabel(report.workflow_status)}</span></div>
        </div>
      </div>
      <div className="progress-stakeholder-grid">
        {rows.map(([label, value]) => <div className="progress-stakeholder-cell" key={label}><span>{label}</span><strong>{displayOrNotSet(value)}</strong></div>)}
      </div>
    </header>
  );
}

function ControlledProgressFooter({ report, generatedAt }) {
  return (
    <footer className="progress-controlled-footer">
      <div><strong>Silver Foundation Contracting Company</strong><span>Engineering &amp; Construction – Quality Management System</span><span>{SFCC_FOOTER_ADDRESS}</span></div>
      <div><span>Generated by SFCC QMS Platform</span><span>{generatedAt}</span><span>Report No. {displayOrNotSet(report.report_no || report.ref)} · Page reference by PDF viewer</span></div>
    </footer>
  );
}

function ProgressReportDetail({ project, report, onClose, onEdit, onPrint }) {
  const fields = report.report_type === 'weekly' ? WEEKLY_FIELDS : DAILY_FIELDS;
  const [orientation, setOrientation] = useState(defaultPrintOrientation(report));
  return <div className="fixed inset-0 z-40 bg-slate-900/60 flex justify-center items-start overflow-y-auto p-4 progress-report-detail no-print" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><article className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden"><div className="bg-slate-900 px-5 py-4 flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4"><div><p className="text-amber-300 font-mono font-bold text-sm">{clean(report.report_no)}</p><h2 className="text-white font-black">Read-only {reportTypeLabel(report.report_type)}</h2><p className="text-xs text-slate-300 mt-1">View mode only. Use Edit for controlled changes or Print for the selected report.</p></div><div className="flex flex-wrap items-center gap-2"><PrintOrientationSelector value={orientation} onChange={setOrientation} compact dark /><button onClick={() => onPrint(orientation)} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold">Print</button>{onEdit && <button onClick={onEdit} className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-semibold">Edit</button>}<button onClick={onClose} className="text-white/60 text-2xl">×</button></div></div><FormalReport project={project} report={report} fields={fields} orientation={orientation} /></article></div>;
}

function FormalReport({ project, report, fields, orientation = defaultPrintOrientation(report) }) {
  const normalizedFields = normalizeFields(report.report_type, report.fields || {});
  const tables = (report.report_type === 'weekly' ? WEEKLY_TABLES : DAILY_TABLES).filter((table) => !OPTIONAL_SECTION_KEYS.has(table.key) || isSectionVisible(normalizedFields, table.key));
  const generatedAt = new Date().toLocaleString();
  return (
    <div className={`p-8 text-slate-900 print:p-0 progress-print-report controlled-progress-report progress-print-document progress-print-${orientation}`}>
      <ControlledProgressHeader project={project} report={report} generatedAt={generatedAt} />
      <PrintSection title="Progress Status Summary">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm progress-summary-grid"><PrintInfo label="Overall" value={percent(report.overall_pct)} /><PrintInfo label="Planned" value={percent(report.planned_progress)} /><PrintInfo label="Actual" value={percent(report.actual_progress)} /><PrintInfo label="Variance" value={percent(report.variance)} /><PrintInfo label="Schedule status" value={clean(report.schedule_status, 'Not Set')} /><PrintInfo label="Risk status" value={clean(report.risk_status, 'Not Set')} /></div>
      </PrintSection>
      {report.report_type === 'daily' && <WeatherPrintSection value={normalizedFields.weather_site_condition} />}
      <PrintSection title="Progress / General Remarks"><p>{clean(report.general_remarks, 'Not Set')}</p></PrintSection>
      {fields.length ? <div className="grid md:grid-cols-2 gap-3 progress-narrative-grid">{fields.map(([key, label]) => <PrintSection key={key} title={label}><p className="whitespace-pre-wrap">{clean(typeof normalizedFields[key] === 'string' ? normalizedFields[key] : '', 'Not Set')}</p></PrintSection>)}</div> : null}
      {tables.map((table) => <ItemizedPrintSection key={table.key} config={table} value={normalizedFields[table.key]} />)}
      <InspectionPrintSection inspections={report.inspections || []} />
      <PrintSection title="QMS Documents"><QmsDocumentsTable docs={report.linked_documents || []} /></PrintSection>
      <PrintSection title="Schedule / Progress References"><ScheduleReferencesTable items={report.linked_schedule_items || []} remarks={report.manual_schedule_remarks} /></PrintSection>
      <PhotoGallery photos={report.photos || []} reportId={report.id} printMode />
      <ControlledProgressFooter report={report} generatedAt={generatedAt} />
    </div>
  );
}

function WeatherPrintSection({ value }) {
  const legacy = legacyText(value);
  const weather = weatherValue(value);
  return <PrintSection title="Weather / Site Conditions"><div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs"><PrintInfo label="Weather" value={clean(weather.weather_condition)} /><PrintInfo label="Temperature" value={clean(weather.temperature)} /><PrintInfo label="Site condition" value={clean(weather.site_condition)} /><PrintInfo label="Working hours" value={clean(weather.working_hours)} /><PrintInfo label="Remarks" value={clean(weather.remarks)} /></div>{legacy && <p className="mt-2 whitespace-pre-wrap text-sm">{legacy}</p>}</PrintSection>;
}

function ItemizedPrintSection({ config, value }) {
  const rows = asRows(value);
  const legacy = legacyText(value);
  return <PrintSection title={config.title}>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-[11px] border border-slate-200 progress-print-table"><thead className="bg-slate-100"><tr><th className="p-1.5 border text-left">No.</th>{config.columns.map(([key, label]) => <th key={key} className="p-1.5 border text-left">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td className="p-1.5 border font-semibold">{index + 1}</td>{config.columns.map(([key, label, type]) => <td key={key} className={`p-1.5 border align-top ${key === 'variance_pct' ? varianceTone(row[key]) : ''}`}>{type === 'percent' ? displayPercent(row[key], 'Not recorded') : type === 'discipline' ? clean(normalizeDisciplineLabel(row[key])) : clean(row[key])}</td>)}</tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">{config.empty || 'No items recorded.'}</p>}{legacy && <p className="mt-2 whitespace-pre-wrap text-sm">{legacy}</p>}</PrintSection>;
}
function QmsDocumentsTable({ docs }) {
  if (!docs.length) return <p className="text-sm text-slate-500">No QMS documents recorded.</p>;
  return <table className="w-full text-xs border border-slate-200"><thead className="bg-slate-100"><tr>{['Reference', 'Document Type', 'Revision', 'Workflow Status', 'Approval Status'].map((h) => <th key={h} className="p-2 border text-left">{h}</th>)}</tr></thead><tbody>{docs.map((d) => <tr key={d.id}><td className="p-2 border font-semibold">{visibleReference(d.ref, d.title)}</td><td className="p-2 border">{documentTypeLabel(d.type)}</td><td className="p-2 border">{clean(d.revision)}</td><td className="p-2 border">{clean(d.workflow_status)}</td><td className="p-2 border">{clean(d.approval_status)}</td></tr>)}</tbody></table>;
}
function ScheduleReferencesTable({ items, remarks }) {
  if (!items.length && !remarks) return <p className="text-sm text-slate-500">No schedule/progress references recorded.</p>;
  return <div className="space-y-3">{items.length ? <table className="w-full text-xs border border-slate-200"><thead className="bg-slate-100"><tr>{['Activity / Reference', 'Planned %', 'Actual %', 'Status'].map((h) => <th key={h} className="p-2 border text-left">{h}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.link_id}><td className="p-2 border font-semibold">{visibleReference(item.activity_name, item.manual_reference, item.activity_id)}</td><td className="p-2 border">{percent(item.planned_progress)}</td><td className="p-2 border">{percent(item.actual_progress)}</td><td className="p-2 border">{clean(item.status)}</td></tr>)}</tbody></table> : null}{remarks && <p className="text-sm whitespace-pre-wrap">{remarks}</p>}</div>;
}
function SelectableTable({ items, selected, onToggle, type }) { if (!items.length) return <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">{type === 'schedule' ? 'No schedule activities available.' : 'No QMS documents available for selection.'}</div>; return <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl"><table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="p-3 w-10"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} /></td>{type === 'documents' ? <><td className="p-3 font-semibold">{visibleReference(item.ref, item.title)}</td><td className="p-3">{documentTypeLabel(item.type)}</td><td className="p-3 text-slate-500">{item.revision}</td><td className="p-3 text-slate-500">{item.workflow_status} / {item.approval_status}</td></> : <><td className="p-3 font-semibold">{visibleReference(item.activity_name, item.activity_id)}</td><td className="p-3 text-slate-500">{isUuidLike(item.activity_id) ? 'No activity ID' : clean(item.activity_id, 'No activity ID')}</td><td className="p-3 text-slate-500">Actual {percent(item.progress_percent)}</td><td className="p-3 text-slate-500">{item.status}</td></>}</tr>)}</tbody></table></div>; }
function Section({ title, children, actions }) { return <section className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-900">{title}</h3>{actions}</div>{children}</section>; }
function StatusChip({ status }) { const s = status || 'draft'; const cls = s === 'closed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : s === 'issued' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'; return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${cls}`}>{statusLabel(s)}</span>; }
function Input({ label, value, onChange, type = 'text' }) { return <label className="block"><span className="text-xs font-bold text-slate-500 uppercase">{label}</span><input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></label>; }
function Textarea({ label, value, onChange }) { return <label className="block"><span className="text-xs font-bold text-slate-500 uppercase">{label}</span><textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="Manual entry" /></label>; }
function Select({ label, value, onChange, options, disabled = false }) { return <label className="block"><span className="text-xs font-bold text-slate-500 uppercase">{label}</span><select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white disabled:bg-slate-100">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function ReadOnly({ label, value }) { return <div><span className="text-xs font-bold text-slate-500 uppercase">{label}</span><div className="mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold">{clean(value)}</div></div>; }
function PrintInfo({ label, value }) { return <div className="border border-slate-200 rounded-lg p-3"><div className="text-[10px] uppercase font-bold text-slate-500">{label}</div><div className="font-semibold">{value}</div></div>; }
function PrintSection({ title, children, className = '' }) { return <section className={`border border-slate-200 rounded-lg p-3 mb-3 progress-print-section ${className}`}><h3 className="text-xs uppercase font-black text-slate-900 mb-2">{title}</h3>{children}</section>; }
function PrintStyles() { return <style>{`
.progress-print-target{position:fixed;left:-10000px;top:0;width:210mm;background:#fff;z-index:-1}
.progress-print-target.progress-print-landscape{width:297mm}
.progress-print-portrait{page:progressPortrait}
.progress-print-landscape{page:progressLandscape}
@page progressPortrait{size:A4 portrait;margin:12mm}
@page progressLandscape{size:A4 landscape;margin:12mm}
@media print{
  html,body,#root{width:auto!important;height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important}
  body *{visibility:hidden!important}
  .progress-print-target,.progress-print-target *{visibility:visible!important}
  .progress-print-target,.controlled-progress-report,.progress-print-document,.controlled-progress-header{display:block!important;visibility:visible!important}
  .progress-reporting-module,.progress-print-root,.progress-print-target,.controlled-progress-report,.progress-print-document,.progress-print-report{display:block!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;position:static!important;transform:none!important;background:#fff!important}
  .progress-print-landscape,.progress-print-portrait{transform:none!important;writing-mode:horizontal-tb!important}
  .progress-reporting-module{padding:0!important}
  .progress-print-target{left:auto!important;top:auto!important;z-index:auto!important}
  .progress-print-target .progress-print-report{display:block!important;padding:0!important;font-family:Arial,Helvetica,sans-serif!important;font-size:8.6pt!important;line-height:1.32!important;color:#1f2937!important}
  .no-print,.progress-screen-content,.progress-module-hero,.progress-log-card,.progress-report-detail,.progress-workspace-panel,button[aria-label]{display:none!important}
  .progress-print-section{break-inside:auto;page-break-inside:auto;margin-bottom:3mm!important;padding:2.2mm!important;border:.25mm solid #d9d0c0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important}
  .progress-print-section>h3{break-after:avoid;page-break-after:avoid;margin:0 0 1.4mm!important;padding:0 0 1mm!important;border-bottom:.25mm solid #d9a64f!important;color:#1f2937!important;font-size:8.8pt!important;letter-spacing:.05em!important}
  .progress-summary-grid,.progress-narrative-grid{gap:2mm!important}
  table{page-break-inside:auto;width:100%!important;border-collapse:collapse!important;table-layout:auto!important}
  thead{display:table-header-group!important}
  tr{break-inside:avoid;page-break-inside:avoid;page-break-after:auto}
  th,td{padding:1.15mm 1.05mm!important;border:.2mm solid #d7cbbb!important;vertical-align:top!important;white-space:normal!important;overflow-wrap:anywhere!important;font-weight:400!important;color:#1f2937!important}
  th{background:#f3eee5!important;color:#374151!important;font-weight:700!important}
  .progress-print-table{font-size:7.3pt!important}
  .progress-print-landscape .progress-print-table{font-size:7.6pt!important}
  .progress-photo-section{break-before:auto;page-break-before:auto}
  .progress-photo-print-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm!important;align-items:start!important}
  .progress-print-landscape .progress-photo-print-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  .progress-photo-print{break-inside:avoid;page-break-inside:avoid;margin:0!important;padding:1.6mm!important;border:.25mm solid #d9d0c0!important;border-radius:0!important;box-shadow:none!important}
  .progress-photo-print .progress-photo-image,.progress-photo-print .progress-photo-placeholder{width:100%!important;height:45mm!important;max-height:45mm!important;min-height:0!important;object-fit:cover!important;border-radius:0!important}
  .progress-print-landscape .progress-photo-print .progress-photo-image,.progress-print-landscape .progress-photo-print .progress-photo-placeholder{height:40mm!important;max-height:40mm!important}
  .progress-photo-print figcaption{font-size:7.1pt!important;line-height:1.22!important;margin-top:1.2mm!important}
  .progress-controlled-header,.controlled-progress-header{display:block!important;visibility:visible!important;break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid;margin-bottom:4mm!important;overflow:visible!important;position:static!important;transform:none!important}
  .progress-controlled-titlebar,.progress-controlled-brand,.progress-controlled-report-title,.progress-stakeholder-grid,.progress-stakeholder-cell{visibility:visible!important}
  .progress-controlled-titlebar{display:grid!important;grid-template-columns:1.05fr .95fr!important;padding:3mm!important;color:#fff!important;background:linear-gradient(135deg,#111827 0%,#1f2937 72%,#3b3322 100%)!important;border-bottom:3px solid #d9a64f!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .progress-stakeholder-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;background:#fff!important}
  .progress-stakeholder-cell{display:block!important;min-height:0!important;padding:1.5mm 1.8mm!important;background:#fff!important;border-right:.2mm solid #e5e7eb!important;border-bottom:.2mm solid #e5e7eb!important}
  .progress-stakeholder-cell:nth-child(8n+1),.progress-stakeholder-cell:nth-child(8n+2),.progress-stakeholder-cell:nth-child(8n+3),.progress-stakeholder-cell:nth-child(8n+4){background:#fbf7ef!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .progress-controlled-footer{break-before:auto;page-break-before:auto;break-inside:avoid;page-break-inside:avoid}
}
`}</style>; }
