import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { fmtSAR, fmtDate } from '../../utils/helpers.jsx';
import { getCurrentUser } from '../../utils/permissions';

const chipTone = (v = '') => {
  const t = String(v).toLowerCase();
  if (t.includes('critical') || t.includes('over') || t.includes('delay') || t.includes('high')) return 'chip-bad';
  if (t.includes('warn') || t.includes('medium') || t.includes('pending')) return 'chip-warn';
  if (t.includes('complete') || t.includes('approved') || t.includes('on track') || t.includes('low')) return 'chip-good';
  return 'chip-neutral';
};


const TODAY = new Date().toISOString().slice(0, 10);

function normalizeScheduleStatus(status = '') {
  const value = String(status || '').trim().toLowerCase();
  if (['complete', 'completed'].includes(value)) return 'completed';
  if (value === 'in progress') return 'in_progress';
  if (value === 'not started') return 'not_started';
  if (value === 'overdue') return 'overdue';
  if (value === 'on hold') return 'on_hold';
  return value;
}

function toProgressPercent(activity = {}) {
  const n = Number(activity.progress_percent ?? activity.percent ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function buildScheduleSummary(activities = []) {
  const summary = {
    total: activities.length,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    overdue: 0,
    avgProgress: 0,
    plannedProgress: null,
  };
  if (!activities.length) return summary;

  let progressSum = 0;
  const starts = [];
  const finishes = [];

  activities.forEach((activity) => {
    const progress = toProgressPercent(activity);
    const normalizedStatus = normalizeScheduleStatus(activity.status);
    const finish = activity.planned_finish || activity.finish;
    const start = activity.planned_start || activity.start;

    progressSum += progress;
    if (start) starts.push(start);
    if (finish) finishes.push(finish);

    if (progress >= 100 || normalizedStatus === 'completed') summary.completed += 1;
    else if (progress > 0 && progress < 100) summary.inProgress += 1;
    else summary.notStarted += 1;

    if (finish && finish < TODAY && progress < 100) summary.overdue += 1;
  });

  summary.avgProgress = Math.round(progressSum / activities.length);

  if (starts.length && finishes.length) {
    const minStart = new Date(starts.sort()[0]);
    const maxFinish = new Date(finishes.sort()[finishes.length - 1]);
    if (!Number.isNaN(minStart.getTime()) && !Number.isNaN(maxFinish.getTime()) && maxFinish >= minStart) {
      const today = new Date(TODAY);
      const totalDays = Math.max(1, Math.round((maxFinish - minStart) / 86400000));
      const elapsedDays = Math.round((today - minStart) / 86400000);
      const rawProgress = (elapsedDays / totalDays) * 100;
      summary.plannedProgress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    }
  }

  return summary;
}

const kpiStyles = {
  'Total Documents': 'dashboard-kpi-docs',
  'Pending Approvals': 'dashboard-kpi-approvals',
  'Open Follow-Ups': 'dashboard-kpi-followups',
  'Open Risks': 'dashboard-kpi-risks',
  'Overdue Activities': 'dashboard-kpi-overdue',
  'Latest Progress %': 'dashboard-kpi-progress',
};

const formatGeneratedAt = () => new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const valueOr = (value, fallback = '—') => (value === null || value === undefined || value === '' ? fallback : value);

function ProjectDashboardPrintReport({ project, insights, risks, followups, notifications, scheduleSummary, resolvedLatestProgress, latestProgressReport, completedCount, pendingCount, overdueCount, variance }) {
  const printedBy = getCurrentUser()?.name || getCurrentUser()?.email || 'Not available';
  const openRisks = insights?.risks?.open ?? risks.filter((r) => r.status !== 'Closed').length;
  const highCriticalRisks = insights?.risks?.highCritical ?? risks.filter((r) => /high|critical/i.test(r.risk_level || r.level || r.severity || '')).length;
  const documentRows = [
    ['Material Submittal', insights?.byType?.MS || 0],
    ['Drawing Submittal', insights?.byType?.DS || 0],
    ['Request for Information', insights?.byType?.RFI || 0],
    ['Inspection Request', insights?.byType?.IR || 0],
    ['Non-Conformance Report', insights?.byType?.NCR || 0],
    ['Transmittal', insights?.byType?.TR || 0],
    ['Site Instruction', insights?.byType?.SI || 0],
  ];
  const approvalRows = [
    ['Approved', insights?.approved || 0],
    ['Pending / Open', insights?.open || 0],
    ['Pending Approvals', insights?.pendingApprovals ?? insights?.open ?? 0],
    ['Pending Evidence', insights?.missingEvidence || 0],
    ['Rejected / Resubmission', insights?.rejected || 0],
    ['Overdue / Pending Follow-Up', insights?.overdue || overdueCount],
  ];
  const notificationRows = notifications.slice(0, 6);

  return <section className="dashboard-print-report project-dashboard-print-report" aria-label="Project Dashboard Report">
    <header className="dashboard-print-header">
      <div>
        <p className="dashboard-print-company">SILVER FOUNDATION CONTRACTING COMPANY</p>
        <p className="dashboard-print-system">Quality Management System</p>
      </div>
      <div className="dashboard-print-title-block">
        <h1>Project Dashboard Report</h1>
        <p>Generated: {formatGeneratedAt()}</p>
        <p>Printed by: {printedBy}</p>
      </div>
    </header>

    <section className="dashboard-print-section print-break-avoid">
      <h2>Project Information</h2>
      <div className="dashboard-print-meta-grid">
        <div><span>Project Name</span><strong>{valueOr(project.name)}</strong></div>
        <div><span>Project Code</span><strong>{valueOr(project.code)}</strong></div>
        <div><span>Client</span><strong>{valueOr(project.client || project.client_name)}</strong></div>
        <div><span>Location</span><strong>{valueOr(project.location)}</strong></div>
      </div>
    </section>

    <section className="dashboard-print-section print-break-avoid">
      <h2>Project Summary</h2>
      <div className="dashboard-print-kpi-grid">
        <div className="dashboard-print-kpi"><span>Contract Value</span><strong>{fmtSAR(project.contract_value)}</strong></div>
        <div className="dashboard-print-kpi"><span>Current Progress</span><strong>{resolvedLatestProgress ?? 0}%</strong></div>
        <div className="dashboard-print-kpi"><span>Risk Status</span><strong>{project.risk_status || (highCriticalRisks ? 'High / Critical' : openRisks ? 'Open Risks' : 'Not set')}</strong></div>
        <div className="dashboard-print-kpi"><span>Schedule Status</span><strong>{project.schedule_status || (scheduleSummary.overdue ? 'Overdue' : 'Not set')}</strong></div>
        <div className="dashboard-print-kpi"><span>Budget Status</span><strong>{project.budget_status || (variance > 0 ? 'Over Budget' : 'On Budget')}</strong></div>
        <div className="dashboard-print-kpi"><span>Resource Status</span><strong>{project.resource_status || 'Not set'}</strong></div>
      </div>
    </section>



    <section className="dashboard-print-section print-break-avoid">
      <h2>Progress Reporting Summary</h2>
      <div className="dashboard-print-kpi-grid dashboard-print-kpi-grid-compact">
        <div className="dashboard-print-kpi"><span>Latest Progress Report</span><strong>{latestProgressReport?.report_date ? fmtDate(latestProgressReport.report_date) : 'Not recorded'}</strong></div>
        <div className="dashboard-print-kpi"><span>Report Reference</span><strong>{latestProgressReport?.ref || 'Not recorded'}</strong></div>
        <div className="dashboard-print-kpi"><span>Planned Progress</span><strong>{project.planned_progress != null ? `${project.planned_progress}%` : (scheduleSummary.plannedProgress == null ? 'Not recorded' : `${scheduleSummary.plannedProgress}%`)}</strong></div>
        <div className="dashboard-print-kpi"><span>Actual Progress</span><strong>{resolvedLatestProgress ?? 'Not recorded'}%</strong></div>
        <div className="dashboard-print-kpi"><span>Schedule Variance</span><strong>{scheduleSummary.plannedProgress == null ? 'Not recorded' : `${(resolvedLatestProgress ?? 0) - scheduleSummary.plannedProgress > 0 ? '+' : ''}${(resolvedLatestProgress ?? 0) - scheduleSummary.plannedProgress}%`}</strong></div>
        <div className="dashboard-print-kpi"><span>Open Actions</span><strong>{pendingCount}</strong></div>
        <div className="dashboard-print-kpi"><span>Overdue Actions</span><strong>{overdueCount}</strong></div>
        <div className="dashboard-print-kpi"><span>Pending Evidence</span><strong>{insights?.missingEvidence ?? 'Not recorded'}</strong></div>
      </div>
    </section>

    <section className="dashboard-print-section print-break-avoid">
      <h2>Document / QMS Summary</h2>
      <div className="dashboard-print-kpi-grid dashboard-print-kpi-grid-compact">
        <div className="dashboard-print-kpi"><span>Total Documents</span><strong>{insights?.total || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Issued Documents</span><strong>{insights?.issued || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Draft Documents</span><strong>{insights?.draft || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Pending Evidence</span><strong>{insights?.missingEvidence || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Approved</span><strong>{insights?.approved || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Rejected</span><strong>{insights?.rejected || 0}</strong></div>
        <div className="dashboard-print-kpi"><span>Overdue / Follow-Up</span><strong>{insights?.overdue || overdueCount}</strong></div>
      </div>
    </section>

    <section className="dashboard-print-section print-break-avoid">
      <h2>Action / Follow-Up Summary</h2>
      <div className="dashboard-print-kpi-grid dashboard-print-kpi-grid-compact">
        <div className="dashboard-print-kpi"><span>Open Actions</span><strong>{pendingCount}</strong></div>
        <div className="dashboard-print-kpi"><span>Overdue Items</span><strong>{overdueCount}</strong></div>
        <div className="dashboard-print-kpi"><span>Completed Follow-Ups</span><strong>{completedCount}</strong></div>
        <div className="dashboard-print-kpi"><span>Recent Notifications</span><strong>{notifications.length}</strong></div>
      </div>
    </section>

    <section className="dashboard-print-two-col">
      <div className="dashboard-print-section">
        <h2>Document Status Summary by Type</h2>
        <table className="dashboard-print-table"><thead><tr><th>Document Type</th><th>Total</th></tr></thead><tbody>{documentRows.map(([label, total]) => <tr key={label}><td>{label}</td><td>{total}</td></tr>)}</tbody></table>
      </div>
      <div className="dashboard-print-section">
        <h2>Approval / Evidence Status Summary</h2>
        <table className="dashboard-print-table"><thead><tr><th>Status</th><th>Total</th></tr></thead><tbody>{approvalRows.map(([label, total]) => <tr key={label}><td>{label}</td><td>{total}</td></tr>)}</tbody></table>
      </div>
    </section>

    <section className="dashboard-print-section">
      <h2>Open Actions / Follow-Up List</h2>
      <table className="dashboard-print-table">
        <thead><tr><th>No.</th><th>Action / Issue</th><th>Responsible</th><th>Priority</th><th>Due Date</th><th>Status</th><th>Comment / Update</th></tr></thead>
        <tbody>{followups.length === 0 ? <tr><td colSpan="7" className="dashboard-print-empty">No open follow-ups recorded.</td></tr> : followups.slice(0, 12).map((f, i) => <tr key={f.id || `${f.title}-${i}`}><td>{i + 1}</td><td>{f.title || f.action_required || '—'}</td><td>{f.responsible_person || 'Not set'}</td><td>{f.priority || 'Medium'}</td><td>{fmtDate(f.due_date)}</td><td>{f.status || 'Open'}</td><td>{f.comment || f.notes || '—'}</td></tr>)}</tbody>
      </table>
    </section>

    <section className="dashboard-print-two-col">
      <div className="dashboard-print-section">
        <h2>Risk / Health Status Summary</h2>
        <table className="dashboard-print-table"><tbody><tr><th>Total Risks</th><td>{insights?.risks?.total ?? risks.length}</td></tr><tr><th>Open Risks</th><td>{openRisks}</td></tr><tr><th>High / Critical</th><td>{highCriticalRisks}</td></tr><tr><th>Mitigated / Closed</th><td>{insights?.risks?.closed ?? risks.filter((r) => r.status === 'Closed' || /mitigated/i.test(r.status || '')).length}</td></tr><tr><th>Schedule Overdue</th><td>{scheduleSummary.overdue}</td></tr></tbody></table>
      </div>
      <div className="dashboard-print-section">
        <h2>Recent Notifications / Follow-Ups</h2>
        <table className="dashboard-print-table"><thead><tr><th>Notification</th><th>Due</th><th>Severity</th></tr></thead><tbody>{notificationRows.length === 0 ? <tr><td colSpan="3" className="dashboard-print-empty">No recent notifications.</td></tr> : notificationRows.map((n, i) => <tr key={n.id || `${n.title}-${i}`}><td>{n.title || 'Notification'}</td><td>{fmtDate(n.due_date)}</td><td>{n.severity || '—'}</td></tr>)}</tbody></table>
      </div>
    </section>
  </section>;
}


export default function Dashboard({ project }) {
  const [insights, setInsights] = useState(null);
  const [risks, setRisks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followups, setFollowups] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${project.id}/insights`), api.get(`/risks?project_id=${project.id}`), api.get(`/progress?project_id=${project.id}`), api.get(`/followups?project_id=${project.id}`), api.get(`/schedule?project_id=${project.id}`), api.get(`/notifications?project_id=${project.id}&limit=12`),
    ]).then(([ins, r, p, f, s, n]) => {
      setInsights(ins.data); setRisks(r.data || []); setProgress(p.data || []); setFollowups(f.data || []); setSchedule(s.data || []); setNotifications(n.data || []); setLoading(false);
    }).catch(() => {
      setLoadError('Unable to load dashboard data right now.');
      setLoading(false);
    });
  }, [project.id]);

  const lastProgress = useMemo(() => progress[0], [progress]);
  const scheduleSummary = useMemo(() => buildScheduleSummary(schedule), [schedule]);
  const latestProgressValue = lastProgress?.overall_pct ?? lastProgress?.overall_progress ?? lastProgress?.progress_percent ?? lastProgress?.progress ?? insights?.latestProgress?.overall_pct;
  const resolvedLatestProgress = Number.isFinite(Number(latestProgressValue))
    ? Math.round(Number(latestProgressValue))
    : scheduleSummary.avgProgress;
  const variance = (Number(project.forecast_cost) || Number(project.actual_cost || 0)) - Number(project.planned_budget || 0);
  const pendingCount = followups.filter((f) => !['Completed', 'Cancelled'].includes(f.status)).length;
  const completedCount = followups.filter((f) => f.status === 'Completed').length;
  const overdueCount = followups.filter((f) => !['Completed', 'Cancelled'].includes(f.status) && f.due_date && f.due_date < new Date().toISOString().slice(0, 10)).length;

  if (loading) return <div className="p-6 text-slate-400 text-sm">Loading dashboard...</div>;
  if (loadError) return <div className="p-6 text-red-600 text-sm">{loadError}</div>;

  const kpis = [
    ['Total Documents', insights?.total || 0, 'All controlled records'],
    ['Pending Approvals', insights?.pendingApprovals ?? insights?.open ?? 0, 'Awaiting closure or decision'],
    ['Open Follow-Ups', pendingCount, 'Execution actions in progress'],
    ['Open Risks', insights?.risks?.open ?? risks.filter((r) => r.status !== 'Closed').length, 'Active in risk register'],
    ['Overdue Activities', scheduleSummary.overdue, 'Past due and still open'],
    ['Latest Progress %', `${resolvedLatestProgress ?? 0}%`, latestProgressValue != null ? 'Current field progress report' : 'Derived from schedule activities'],
  ];

  return <div className="modern-page dashboard-page print-wrap dashboard-print-root">
    <ProjectDashboardPrintReport project={project} insights={insights} risks={risks} followups={followups} notifications={notifications} scheduleSummary={scheduleSummary} resolvedLatestProgress={resolvedLatestProgress} latestProgressReport={lastProgress} completedCount={completedCount} pendingCount={pendingCount} overdueCount={overdueCount} variance={variance} />
    <div className="dashboard-screen-content">
    <section className="modern-hero dashboard-hero no-print">
      <div>
        <p className="dashboard-hero-kicker">Project dashboard</p>
        <h1>{project.name || 'Project Status Report Highlights'}</h1>
        <p>Executive command view for delivery, controls, cost, and quality.</p>
      </div>
      <div className="dashboard-hero-actions">
        <span className="dashboard-code-pill">{project.code || 'No code'}</span>
        <button onClick={() => window.print()} className="btn-secondary">Print</button>
      </div>
    </section>

    <section className="modern-section modern-card dashboard-project-card">
      <div className="qms-responsive-grid text-sm">
        <div>
          <p className="dashboard-section-subtitle">Project information</p>
          <h2 className="font-semibold text-lg">{project.name || '—'}</h2>
          <p className="text-slate-500">{project.code || '—'}</p>
        </div>
        <div className="space-y-1 text-xs"><p><b>Client:</b> {project.client || project.client_name || '—'}</p><p><b>Location:</b> {project.location || '—'}</p><p><b>Project Manager:</b> {project.project_manager || '—'}</p></div>
        <div className="space-y-1 text-xs"><p><b>Contract Value:</b> {fmtSAR(project.contract_value)}</p><p><b>Start:</b> {fmtDate(project.start_date)}</p><p><b>Target Completion:</b> {fmtDate(project.target_completion_date || project.end_date)}</p></div>
      </div>
      <div className="modern-progress mt-3"><div style={{ width: `${Math.max(0, Math.min(100, Number(project.actual_progress ?? project.progress ?? 0)))}%` }} /></div>
    </section>

    <section className="modern-kpi-grid qms-kpi-grid mt-3">{kpis.map(([l, v, helper]) => <div className={`modern-kpi-card dashboard-kpi-card ${kpiStyles[l] || ''}`} key={l}><label>{l}</label><strong>{v}</strong><span>{helper}</span></div>)}</section>

    <section className="modern-dashboard-grid mt-3">
      <div className="modern-section dashboard-section-card"><div className="dashboard-section-head"><h2>Project Health Panel</h2><small>Status snapshot</small></div><div className="flex flex-wrap gap-2 mt-3">{[['Schedule', project.schedule_status], ['Budget', project.budget_status], ['Resource', project.resource_status], ['Risk', project.risk_status]].map(([l, v]) => <span key={l} className={`modern-chip ${chipTone(v)}`}>{l}: {v || 'Not set'}</span>)}</div></div>
      <div className="modern-section dashboard-section-card"><div className="dashboard-section-head"><h2>Risk Panel</h2><small>Exposure overview</small></div><div className="qms-card-grid text-sm mt-3"><div className="modern-card p-3 dashboard-mini-card"><b>Total risks</b><p>{insights?.risks?.total ?? risks.length}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>High/Critical</b><p>{insights?.risks?.highCritical ?? risks.filter((r) => /high|critical/i.test(r.risk_level || r.level || r.severity || '')).length}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Open</b><p>{insights?.risks?.open ?? risks.filter((r) => r.status !== 'Closed').length}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Mitigated/Closed</b><p>{insights?.risks?.closed ?? risks.filter((r) => r.status === 'Closed' || /mitigated/i.test(r.status || '')).length}</p></div></div></div>
    </section>



    <section className="modern-section mt-3 dashboard-section-card"><div className="dashboard-section-head"><h2>Workflow Alerts</h2><small>Unread, pending, overdue, recent outcomes</small></div><div className="qms-kpi-grid mt-3 text-xs"><div className="modern-card p-2 dashboard-doc-chip"><p>Unread</p><b>{notifications.filter((n)=>n.status==='unread').length}</b></div><div className="modern-card p-2 dashboard-doc-chip"><p>Pending Reviews</p><b>{notifications.filter((n)=>/review|action required/i.test(n.title)).length}</b></div><div className="modern-card p-2 dashboard-doc-chip"><p>Overdue</p><b>{notifications.filter((n)=>n.severity==='critical' || /overdue/i.test(n.title)).length}</b></div><div className="modern-card p-2 dashboard-doc-chip"><p>Approvals/Rejections</p><b>{notifications.filter((n)=>/approved|rejected|resubmission/i.test(n.title)).length}</b></div></div><div className="space-y-2 mt-3">{notifications.length === 0 ? <div className="text-xs text-slate-500">No notifications yet.</div> : notifications.slice(0,5).map((n)=><div key={n.id} className="modern-issue-row"><div><b>{n.title}</b><p className="text-xs text-slate-500">{n.message}</p></div><div>{fmtDate(n.due_date)}</div><span className={`modern-chip ${chipTone(n.severity)}`}>{n.severity}</span></div>)}</div></section>
    <section className="modern-section mt-3 dashboard-section-card"><div className="dashboard-section-head"><h2>Document Control Summary</h2><small>Compact live totals</small></div><div className="qms-kpi-grid mt-3 text-xs">{[['Material Submittal', insights?.byType?.MS || 0], ['Drawing Submittal', insights?.byType?.DS || 0], ['Request for Information', insights?.byType?.RFI || 0], ['Inspection Request', insights?.byType?.IR || 0], ['Non-Conformance Report', insights?.byType?.NCR || 0], ['Transmittal', insights?.byType?.TR || 0], ['Site Instruction', insights?.byType?.SI || 0], ['Approved', insights?.approved || 0], ['Pending', insights?.open || 0], ['Missing Evidence', insights?.missingEvidence || 0], ['Overdue', insights?.overdue || 0]].map(([k, v]) => <div key={k} className="modern-card p-2 dashboard-doc-chip"><p>{k}</p><b>{v}</b></div>)}</div></section>

    <section className="modern-section mt-3 dashboard-section-card dashboard-followups-panel"><div className="dashboard-section-head"><h2>Project Execution Follow-Ups</h2><small>Action-required tracker</small></div><div className="dashboard-followup-counters text-xs mt-2"><span>Total Follow-Ups: <b>{insights?.followups?.total ?? followups.length}</b></span><span>Completed: <b>{insights?.followups?.completed ?? completedCount}</b></span><span>Pending: <b>{insights?.followups?.pending ?? pendingCount}</b></span><span>Overdue: <b>{insights?.followups?.overdue ?? overdueCount}</b></span></div><div className="space-y-2 mt-3">{followups.slice(0, 5).map((f) => <div key={f.id} className="modern-issue-row dashboard-followup-row"><div><b>{f.title}</b><p className="text-xs text-slate-500">Responsible: {f.responsible_person || 'Not set'}</p></div><div>{f.action_required || '—'}</div><div>{fmtDate(f.created_at)}</div><div>{fmtDate(f.due_date)}</div><span className={`modern-chip ${chipTone(f.status)}`}>{f.status || 'Open'}</span><span className={`modern-chip ${chipTone(f.priority)}`}>{f.priority || 'Medium'}</span></div>)}</div><a href={`/project/${project.id}/followups`} className="btn-secondary text-xs font-semibold mt-3 inline-block">Open Follow-Ups</a></section>

    <section className="modern-dashboard-grid mt-3">
      <div className="modern-section dashboard-section-card"><div className="dashboard-section-head"><h2>Budget / Cost Panel</h2><small>Financial track</small></div><div className="mt-3 text-xs space-y-2">{[['Planned', Number(project.planned_budget || 0), 'bg-[var(--qms-gold)]'], ['Actual', Number(project.actual_cost || 0), 'bg-[var(--qms-graphite)]'], ['Forecast', Number(project.forecast_cost || project.actual_cost || 0), 'bg-[var(--qms-soft-gold)]']].map(([n, v, c]) => <div key={n}><div className="flex justify-between"><span>{n}</span><span>{fmtSAR(v)}</span></div><div className="modern-progress"><div className={c} style={{ width: `${Math.min(100, (v / Math.max(1, Number(project.planned_budget || v))) * 100)}%` }} /></div></div>)}<p className={variance > 0 ? 'text-red-600' : 'text-green-600'}>Variance: {fmtSAR(variance)}</p></div></div>
      <div className="modern-section dashboard-section-card"><div className="dashboard-section-head"><h2>Schedule / Progress Panel</h2><small>Execution status</small></div><div className="qms-card-grid mt-3 text-sm"><div className="modern-card p-3 dashboard-mini-card"><b>Planned Progress</b><p>{scheduleSummary.plannedProgress == null ? '—' : `${scheduleSummary.plannedProgress}%`}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Actual Progress</b><p>{`${insights?.schedule?.actualProgress ?? scheduleSummary.avgProgress ?? 0}%`}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Total Activities</b><p>{insights?.schedule?.total ?? scheduleSummary.total}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Completed Activities</b><p>{insights?.schedule?.completed ?? scheduleSummary.completed}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>In Progress</b><p>{insights?.schedule?.inProgress ?? scheduleSummary.inProgress}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Not Started</b><p>{insights?.schedule?.notStarted ?? scheduleSummary.notStarted}</p></div><div className="modern-card p-3 dashboard-mini-card"><b>Overdue</b><p>{insights?.schedule?.overdue ?? scheduleSummary.overdue}</p></div></div><p className="text-xs text-slate-500 mt-2">Latest report: {fmtDate(lastProgress?.report_date)}</p></div>
    </section>

    <section className="modern-section mt-3 dashboard-section-card"><div className="dashboard-section-head"><h2>Task / Issue Register</h2><small>Recent update log</small></div><div className="modern-table mt-3"><div className="modern-issue-row font-semibold text-xs uppercase"><div>No.</div><div>Task / Issue</div><div>Owner</div><div>Due</div><div>Status</div><div>Comment / Update</div></div>{followups.slice(0, 8).map((f, i) => <div key={f.id} className="modern-issue-row dashboard-followup-row"><div>{i + 1}</div><div>{f.title || f.action_required || '—'}</div><div>{f.responsible_person || '—'}</div><div>{fmtDate(f.due_date)}</div><div><span className={`modern-chip ${chipTone(f.status)}`}>{f.status || 'Open'}</span></div><div>{f.comment || f.notes || '—'}</div></div>)}</div></section>
    </div>
  </div>;
}
