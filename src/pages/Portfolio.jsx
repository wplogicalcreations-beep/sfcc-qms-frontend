import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { fmtSAR, fmtDate } from '../utils/helpers.jsx';
import NewProjectModal from '../components/NewProjectModal.jsx';
import { canCreate, getCurrentUser } from '../utils/permissions';

const STATUS_COLOR = {
  good: 'chip-good',
  warn: 'chip-warn',
  bad: 'chip-bad',
  neutral: 'chip-neutral',
};

const KPI_ACCENTS = {
  'Active Projects': 'kpi-accent-active',
  'Completed Projects': 'kpi-accent-completed',
  'Total Issued Documents': 'kpi-accent-docs',
  'Open Actions': 'kpi-accent-actions',
  'Total Contract Value': 'kpi-accent-contract',
  'Average Progress': 'kpi-accent-progress',
  'High Risk Projects': 'kpi-accent-risk',
};

const getStatusTone = (value = '') => {
  const v = String(value).toLowerCase();
  if (v.includes('delay') || v.includes('critical') || v.includes('high') || v.includes('over')) return 'bad';
  if (v.includes('warn') || v.includes('risk') || v.includes('medium') || v.includes('hold')) return 'warn';
  if (v.includes('track') || v.includes('low') || v.includes('adequate') || v.includes('budget')) return 'good';
  return 'neutral';
};

const clampPercent = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const isCompletedProject = (project = {}) => String(project.status || '').toLowerCase().includes('complete');
const resolveProjectProgress = (project = {}) => {
  if (isCompletedProject(project)) return 100;
  const actualProgress = Number(project.actual_progress);
  if (Number.isFinite(actualProgress) && actualProgress > 0) return clampPercent(Math.round(actualProgress));

  const scheduleProgress = Number(project.schedule_avg_progress);
  if (Number.isFinite(scheduleProgress) && Number(project.schedule_activity_count || 0) > 0) return clampPercent(Math.round(scheduleProgress));

  const latestReportProgress = Number(project.latest_report_progress);
  if (Number.isFinite(latestReportProgress)) return clampPercent(Math.round(latestReportProgress));

  const calculated = Number(project.calculated_progress);
  if (Number.isFinite(calculated)) return clampPercent(Math.round(calculated));

  return 0;
};

const normalizeHealthValue = (value) => {
  const text = String(value || '').trim();
  return text || 'Not Set';
};

const resolveScheduleStatus = (project = {}) => {
  if (String(project.schedule_status || '').trim()) return normalizeHealthValue(project.schedule_status);
  if (String(project.calculated_schedule_status || '').trim()) return normalizeHealthValue(project.calculated_schedule_status);
  const count = Number(project.schedule_activity_count || 0);
  const overdue = Number(project.overdue_activity_count || 0);
  const avgProgress = Number(project.schedule_avg_progress || 0);
  if (count <= 0) return 'Not Set';
  if (overdue > 0) return 'Delayed';
  if (avgProgress >= 30) return 'On Track';
  return 'At Risk';
};

const resolveBudgetStatus = (project = {}) => {
  if (String(project.budget_status || '').trim()) return normalizeHealthValue(project.budget_status);
  if (String(project.calculated_budget_status || '').trim()) return normalizeHealthValue(project.calculated_budget_status);
  const planned = Number(project.planned_budget);
  const actual = Number(project.actual_cost);
  const forecast = Number(project.forecast_cost);
  if (!Number.isFinite(planned) || planned <= 0) return 'Not Set';
  if ((Number.isFinite(forecast) && forecast > planned) || (Number.isFinite(actual) && actual > planned)) return 'Over Budget';
  return 'On Budget';
};

const resolveResourceStatus = (project = {}) => {
  if (String(project.resource_status || '').trim()) return normalizeHealthValue(project.resource_status);
  return 'Not Set';
};

const resolveRiskStatus = (project = {}) => {
  if (String(project.risk_status || '').trim()) return normalizeHealthValue(project.risk_status);
  if (String(project.calculated_risk_status || '').trim()) return normalizeHealthValue(project.calculated_risk_status);
  const openRisks = Number(project.open_risk_count || 0);
  const highRisks = Number(project.high_risk_count || 0);
  const mediumRisks = Number(project.medium_risk_count || 0);
  if (openRisks <= 0) return 'Not Set';
  if (highRisks > 0) return 'High';
  if (mediumRisks > 0) return 'Medium';
  return 'Low';
};

const resolveRemainingWork = (project = {}) => {
  const targetDate = project.target_completion_date || project.end_date || project.latest_schedule_finish || project.portfolio_timeline_end || null;
  if (!targetDate) return { targetDate: null, label: 'Target date not set', tone: 'neutral' };

  const endUtc = new Date(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(endUtc.getTime())) return { targetDate: null, label: 'Target date not set', tone: 'neutral' };

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const remainingDays = Math.ceil((endUtc.getTime() - todayUtc.getTime()) / 86400000);

  if (remainingDays > 0) {
    return { targetDate, remainingDays, label: `${remainingDays} days remaining`, tone: remainingDays <= 14 ? 'warn' : 'good' };
  }
  if (remainingDays === 0) return { targetDate, remainingDays, label: 'Due today', tone: 'warn' };
  return { targetDate, remainingDays, label: `${Math.abs(remainingDays)} days overdue`, tone: 'bad' };
};

const getProgressBarColor = (progress) => {
  if (progress >= 100) return '#22A06B';
  if (progress >= 71) return '#14B8A6';
  if (progress >= 31) return '#3B82F6';
  return '#F59E0B';
};

const formatGeneratedAt = () => new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const fmtPortfolioSAR = (value) => `SAR ${Number(value || 0).toLocaleString('en-US')}`;

const EMPTY_BACKEND_SUMMARY = {
  activeProjects: 0,
  completedProjects: 0,
  issuedDocuments: 0,
  openActions: 0,
  totalContractValue: 0,
  averageProgress: 0,
  highRiskProjects: 0,
};

function PortfolioPrintReport({ projects, active, summaries, issueRows, printedBy, valueOr }) {
  const kpis = [
    ['Active Projects', summaries.activeProjects],
    ['Completed Projects', summaries.completedProjects],
    ['Total Issued Documents', summaries.issuedDocs],
    ['Open Actions', summaries.openActions],
    ['Total Contract Value', fmtPortfolioSAR(summaries.totalCV)],
    ['Average Progress', `${summaries.avgProgress}%`],
    ['High Risk Projects', summaries.highRisk],
  ];

  const financialRows = active.filter((p) => Number(p.planned_budget || 0) || Number(p.actual_cost || 0) || Number(p.forecast_cost || 0));

  return <section className="dashboard-print-report portfolio-print-report" aria-label="Portfolio Dashboard Report">
    <header className="dashboard-print-header">
      <div>
        <p className="dashboard-print-company">SILVER FOUNDATION CONTRACTING COMPANY</p>
        <p className="dashboard-print-system">Quality Management System</p>
      </div>
      <div className="dashboard-print-title-block">
        <h1>Portfolio Dashboard Report</h1>
        <p>Generated: {formatGeneratedAt()}</p>
        <p>Printed by: {printedBy || 'Not available'}</p>
      </div>
    </header>

    <section className="dashboard-print-section print-break-avoid">
      <h2>Portfolio Summary</h2>
      <div className="dashboard-print-kpi-grid">
        {kpis.map(([label, value]) => <div className="dashboard-print-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </section>

    <section className="dashboard-print-section">
      <h2>Project Portfolio</h2>
      <table className="dashboard-print-table portfolio-print-table">
        <thead><tr><th>Project Name</th><th>Project Code</th><th>Client</th><th>Location</th><th>Sector / Type</th><th>Contract Value</th><th>Progress %</th><th>Risk</th><th>Schedule Status</th><th>Status</th></tr></thead>
        <tbody>
          {projects.length === 0 ? <tr><td colSpan="10" className="dashboard-print-empty">No projects available.</td></tr> : projects.map((p) => <tr key={p.id || `${p.code || p.name}`}>
            <td>{valueOr(p.name, '—')}</td>
            <td>{valueOr(p.code, '—')}</td>
            <td>{valueOr(p.client_name || p.client, '—')}</td>
            <td>{valueOr(p.location, '—')}</td>
            <td>{valueOr(p.sector || p.project_type, '—')}</td>
            <td>{p.contract_value ? fmtSAR(p.contract_value) : 'Not set'}</td>
            <td>{resolveProjectProgress(p)}%</td>
            <td>{valueOr(resolveRiskStatus(p), 'Not Set')}</td>
            <td>{valueOr(resolveScheduleStatus(p), 'Not Set')}</td>
            <td>{valueOr(p.status, 'Not set')}</td>
          </tr>)}
        </tbody>
      </table>
    </section>

    <section className="dashboard-print-two-col">
      <div className="dashboard-print-section">
        <h2>Project Health Overview</h2>
        <table className="dashboard-print-table">
          <thead><tr><th>Project</th><th>Schedule</th><th>Budget</th><th>Resource</th><th>Risk</th></tr></thead>
          <tbody>{active.length === 0 ? <tr><td colSpan="5" className="dashboard-print-empty">No active project health records.</td></tr> : active.map((p) => <tr key={p.id || p.code}><td>{valueOr(p.name, '—')}</td><td>{resolveScheduleStatus(p)}</td><td>{resolveBudgetStatus(p)}</td><td>{resolveResourceStatus(p)}</td><td>{resolveRiskStatus(p)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="dashboard-print-section">
        <h2>Financial Analysis Summary</h2>
        <table className="dashboard-print-table">
          <thead><tr><th>Project</th><th>Planned</th><th>Actual</th><th>Forecast</th><th>Variance</th></tr></thead>
          <tbody>{financialRows.length === 0 ? <tr><td colSpan="5" className="dashboard-print-empty">No financial data available.</td></tr> : financialRows.map((p) => { const planned = Number(p.planned_budget || 0); const actual = Number(p.actual_cost || 0); const forecast = Number(p.forecast_cost || 0); return <tr key={p.id || p.code}><td>{valueOr(p.name, '—')}</td><td>{fmtSAR(planned)}</td><td>{fmtSAR(actual)}</td><td>{fmtSAR(forecast)}</td><td>{fmtSAR(forecast - planned)}</td></tr>; })}</tbody>
        </table>
      </div>
    </section>

    <section className="dashboard-print-section">
      <h2>Phase Remaining Work Summary</h2>
      <table className="dashboard-print-table">
        <thead><tr><th>Project</th><th>Code</th><th>Target Date</th><th>Remaining Work</th><th>Progress</th></tr></thead>
        <tbody>{active.length === 0 ? <tr><td colSpan="5" className="dashboard-print-empty">No active project schedule records.</td></tr> : active.map((p) => { const remaining = resolveRemainingWork(p); return <tr key={p.id || p.code}><td>{valueOr(p.name, '—')}</td><td>{valueOr(p.code, '—')}</td><td>{remaining.targetDate ? fmtDate(remaining.targetDate) : 'Not set'}</td><td>{remaining.label}</td><td>{resolveProjectProgress(p)}%</td></tr>; })}</tbody>
      </table>
    </section>

    <section className="dashboard-print-section">
      <h2>Open Actions Summary</h2>
      <table className="dashboard-print-table">
        <thead><tr><th>Project</th><th>Action</th><th>Responsible</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
        <tbody>{issueRows.length === 0 ? <tr><td colSpan="6" className="dashboard-print-empty">No open issues or actions recorded.</td></tr> : issueRows.map((r, i) => <tr key={`${r.source}-${r.projectId || 'portfolio'}-${i}`}><td>{r.project || '—'}</td><td>{r.action || r.title || '—'}</td><td>{r.responsible || 'Not set'}</td><td>{r.priority || 'Not set'}</td><td>{r.dueDate ? fmtDate(r.dueDate) : 'Not set'}</td><td>{r.status || 'Open'}</td></tr>)}</tbody>
      </table>
    </section>
  </section>;
}

export default function Portfolio() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [dashboardActions, setDashboardActions] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(EMPTY_BACKEND_SUMMARY);
  const nav = useNavigate();
  const canCreateProject = canCreate('portfolio');
  const printedBy = getCurrentUser()?.name || getCurrentUser()?.email || '';

  async function load() {
    setLoading(true);
    const requests = [
      api.get('/projects'),
      api.get('/projects/summary'),
      api.get('/projects/issues-actions-summary'),
    ];
    const results = await Promise.all(requests);
    const [{ data: projectsData }, { data: summaryData }, { data: followupActions }] = results;
    setProjects(projectsData || []);
    setDashboardSummary({ ...EMPTY_BACKEND_SUMMARY, ...(summaryData || {}) });
    setDashboardActions(followupActions || []);
    setLoading(false);
  }


  useEffect(() => { load(); }, []);

  const completed = projects.filter((p) => { const st = String(p.status || '').toLowerCase(); return st.includes('complete') || st.includes('closed'); });
  const active = projects.filter((p) => String(p.status || 'Active').trim().toLowerCase() === 'active');

  const summaries = useMemo(() => ({
    issuedDocs: Number(dashboardSummary.issuedDocuments || 0),
    openActions: Number(dashboardSummary.openActions || 0),
    totalCV: Number(dashboardSummary.totalContractValue || 0),
    avgProgress: Number(dashboardSummary.averageProgress || 0),
    highRisk: Number(dashboardSummary.highRiskProjects || 0),
    activeProjects: Number(dashboardSummary.activeProjects || 0),
    completedProjects: Number(dashboardSummary.completedProjects || 0),
  }), [dashboardSummary]);

  const priorityRank = { Critical: 0, High: 1, Medium: 2, Low: 3, 'Not Set': 4 };
  const followupSortDate = (value, fallback = Number.MAX_SAFE_INTEGER) => {
    if (!value) return fallback;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? fallback : t;
  };

  const followupItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (dashboardActions || []).map((row) => {
      const dueTs = followupSortDate(row.due_date);
      const normalizedStatus = String(row.status || 'Open').trim() || 'Open';
      const isOverdue = dueTs !== Number.MAX_SAFE_INTEGER && dueTs < today.getTime() && !['completed', 'cancelled', 'closed'].includes(normalizedStatus.toLowerCase());
      return {
        source: 'followup',
        projectId: row.project_id,
        project: row.project_name || '—',
        code: row.project_code || '—',
        title: row.title || '',
        action: row.action_required || row.title || 'Open follow-up',
        responsible: row.responsible_person || 'Not set',
        priority: row.priority || 'Not Set',
        dueDate: row.due_date || null,
        status: isOverdue ? 'Overdue' : normalizedStatus,
        comments: row.comment || '',
        createdAt: row.created_at || null,
        isOverdue,
      };
    });
  }, [dashboardActions]);

  const fallbackIssueRows = useMemo(() => active.flatMap((p) => {
    const issues = String(p.key_issues || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const actions = String(p.pending_actions || '').split('\n').map((x) => x.trim()).filter(Boolean);
    return [
      ...issues.map((issue) => ({
        source: 'project_field', projectId: p.id, project: p.name, code: p.code, title: 'Key Issue', action: issue,
        status: 'Open', priority: p.risk_status || 'Not Set', responsible: p.project_manager || 'Not set', dueDate: p.target_completion_date || p.end_date || null, comments: 'From project key issues', createdAt: p.updated_at || p.created_at || null, isOverdue: false,
      })),
      ...actions.map((issue) => ({
        source: 'project_field', projectId: p.id, project: p.name, code: p.code, title: 'Pending Action', action: issue,
        status: 'Open', priority: 'Not Set', responsible: p.project_manager || 'Not set', dueDate: p.target_completion_date || p.end_date || null, comments: 'From project pending actions', createdAt: p.updated_at || p.created_at || null, isOverdue: false,
      })),
    ];
  }), [active]);

  const issueRows = useMemo(() => {
    const sourceRows = followupItems.length > 0 ? followupItems : fallbackIssueRows;
    return sourceRows.slice().sort((a, b) => {
      const overdueDelta = Number(b.isOverdue) - Number(a.isOverdue);
      if (overdueDelta !== 0) return overdueDelta;
      const priorityDelta = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
      if (priorityDelta !== 0) return priorityDelta;
      const dueDelta = followupSortDate(a.dueDate) - followupSortDate(b.dueDate);
      if (dueDelta !== 0) return dueDelta;
      return followupSortDate(b.createdAt, 0) - followupSortDate(a.createdAt, 0);
    });
  }, [followupItems, fallbackIssueRows]);

  const visibleIssueRows = issueRows.slice(0, 8);
  const extraIssueCount = Math.max(0, issueRows.length - visibleIssueRows.length);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">Loading projects...</div>;

  const getProjectRouteId = (project) => project?.id || project?.project_id || project?.projectId || null;
  const openProject = (project) => {
    const routeProjectId = getProjectRouteId(project);
    if (!routeProjectId) {
      return;
    }
    nav(`/project/${routeProjectId}/dashboard`);
  };
  const valueOr = (value, fallback = 'Not set') => (value === null || value === undefined || value === '' ? fallback : value);
  const getStatusBadgeClass = (status = '') => {
    const v = String(status).toLowerCase();
    if (v.includes('active')) return 'chip-active';
    if (v.includes('complete')) return 'chip-completed';
    if (v.includes('hold')) return 'chip-onhold';
    if (v.includes('delay') || v.includes('critical')) return 'chip-critical';
    return 'chip-neutral';
  };

  return <div className="premium-portfolio-page print-wrap dashboard-print-root">
    <PortfolioPrintReport projects={projects} active={active} summaries={summaries} issueRows={issueRows} printedBy={printedBy} valueOr={valueOr} />
    <div className="dashboard-screen-content">
    <header className="premium-hero no-print">
      <div>
        <p className="premium-hero-kicker">PROJECTS OVERVIEW</p>
        <h1>Projects Dashboard</h1>
        <p className="premium-hero-subtitle">Live view of active projects, documents, actions, progress, and risks.</p>
              </div>
      <div className="premium-actions-row">
        <button onClick={() => window.print()} className="btn-secondary">Print</button>
        {canCreateProject && <button onClick={() => setShowNew(true)} className="btn-primary">+ New Project</button>}
      </div>
    </header>

    <section className="premium-section">
      <div className="premium-kpi-grid qms-kpi-grid">
        {[
          ['Active Projects', summaries.activeProjects],
          ['Completed Projects', summaries.completedProjects],
          ['Total Issued Documents', summaries.issuedDocs],
          ['Open Actions', summaries.openActions],
          ['Total Contract Value', fmtPortfolioSAR(summaries.totalCV)],
          ['Average Progress', `${summaries.avgProgress}%`],
          ['High Risk Projects', summaries.highRisk],
        ].map(([label, value]) => {
          const kpiSupportLines = {
            'Active Projects': 'Currently in execution',
            'Completed Projects': 'Successfully closed',
            'Total Issued Documents': 'Issued controlled records',
            'Open Actions': 'Pending follow-ups',
            'Total Contract Value': 'Approved project value',
            'Average Progress': 'Across active projects',
            'High Risk Projects': 'Needs management attention',
          };

          return <div className={`premium-kpi-card ${KPI_ACCENTS[label] || ''}`} key={label}>
            <div className="premium-kpi-accent" />
            <label>{label}</label>
            <strong>{value}</strong>
            <p className="premium-kpi-support">{kpiSupportLines[label]}</p>
          </div>;
        })}
      </div>
    </section>

    <section className="premium-section premium-accent-section no-print">
      <div className="premium-section-head"><div className="premium-section-title-wrap"><h2>Project Access</h2></div><small>{projects.length} total projects</small></div>
      <div className="premium-project-grid qms-card-grid">
        {projects.map((p) => {
          const progress = resolveProjectProgress(p);
          const progressColor = getProgressBarColor(progress);
          const routeProjectId = getProjectRouteId(p);
          return <article key={routeProjectId || `${p.code || p.name || 'project'}-${progress}`} className="premium-project-card">
            <div className="premium-project-head">
              <div className="premium-project-title-pill">
                <h3>{valueOr(p.name, '—')}</h3>
                <p>{valueOr(p.code, '—')}</p>
              </div>
              <span className={`modern-chip ${getStatusBadgeClass(p.status)}`}>{valueOr(p.status, 'Not set')}</span>
            </div>
            <div className="premium-project-meta">
              <p><b>Client:</b> {valueOr(p.client_name || p.client)}</p>
              <p><b>Location:</b> {valueOr(p.location)}</p>
              <p><b>Sector / Type:</b> {valueOr(p.sector || p.project_type)}</p>
              <p><b>Contract Value:</b> {p.contract_value ? fmtSAR(p.contract_value) : 'Not set'}</p>
            </div>
            <div className="premium-progress-wrap">
              <div className="modern-progress"><div style={{ width: `${progress}%`, backgroundColor: progressColor }} /></div>
              <div className="premium-progress-label"><span>Progress</span><b>{progress}%</b></div>
            </div>
            <div className="premium-chip-row qms-action-row">
              <span className={`modern-chip ${STATUS_COLOR[getStatusTone(p.risk_status)]}`}>Risk: {valueOr(p.risk_status)}</span>
              <span className={`modern-chip ${STATUS_COLOR[getStatusTone(p.schedule_status)]}`}>Schedule: {valueOr(p.schedule_status)}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openProject(p);
              }}
              disabled={!routeProjectId}
              className="btn-secondary premium-open-btn w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Open Project
            </button>
            {!routeProjectId && (
              <p className="mt-2 text-xs text-red-600">Project ID missing. Cannot open project.</p>
            )}
          </article>;
        })}
      </div>
    </section>

    <section className="premium-dashboard-grid">
      <article className="premium-section premium-accent-section">
        <div className="premium-section-title-wrap"><h2>Project Health Overview</h2><p className="premium-section-subtitle">Current status signals by active project.</p></div>
        <div className="space-y-3 mt-3">
          {active.map((p) => {
            const progress = resolveProjectProgress(p);
            const progressColor = getProgressBarColor(progress);
            return <div className="premium-health-row" key={p.id}>
              <div>
                <b>{valueOr(p.name, '—')}</b>
                <p>{valueOr(p.code, '—')} · Delivery: {fmtDate(p.target_completion_date || p.end_date)}</p>
              </div>
              <div className="premium-chip-row qms-action-row">
                {[['Schedule', resolveScheduleStatus(p)], ['Budget', resolveBudgetStatus(p)], ['Resource', resolveResourceStatus(p)], ['Risk', resolveRiskStatus(p)]].map(([label, value]) => <span key={label} className={`modern-chip ${STATUS_COLOR[getStatusTone(value)]}`}>{label}: {valueOr(value, 'Not Set')}</span>)}
              </div>
              <div><div className="modern-progress"><div style={{ width: `${progress}%`, backgroundColor: progressColor }} /></div><p className="premium-mini-note">{progress}% complete</p></div>
            </div>;
          })}
          {active.length === 0 && <div className="qms-empty-state">No records</div>}
        </div>
      </article>

      <article className="premium-section premium-accent-section">
        <div className="premium-section-title-wrap"><h2>Financial Analysis</h2><p className="premium-section-subtitle">Planned, actual and forecast cost profiles.</p></div>
        <div className="space-y-3 mt-3">
          {active.map((p) => {
            const planned = Number(p.planned_budget || 0);
            const actual = Number(p.actual_cost || 0);
            const forecast = Number(p.forecast_cost || 0);
            const hasData = planned || actual || forecast;
            const max = Math.max(planned, actual, forecast, 1);
            const variance = hasData ? forecast - planned : null;
            return <div className="premium-finance-card" key={p.id}>
              <div className="flex justify-between gap-2"><b>{valueOr(p.name, '—')}</b><span className="premium-mini-note">Variance: {variance === null ? 'Not set' : fmtSAR(variance)}</span></div>
              {hasData ? [['Planned', planned, 'bg-[var(--qms-graphite)]'], ['Actual', actual, 'bg-[var(--qms-gold)]'], ['Forecast', forecast, 'bg-[var(--qms-soft-gold)]']].map(([label, amount, color]) => <div key={label} className="mt-2 text-xs">
                <div className="flex justify-between"><span>{label}</span><span>{fmtSAR(amount)}</span></div>
                <div className="modern-progress"><div className={color} style={{ width: `${Math.max((amount / max) * 100, amount === 0 ? 4 : 0)}%` }} /></div>
              </div>) : <p className="premium-mini-note mt-2">Not set</p>}
            </div>;
          })}
          {active.length === 0 && <div className="qms-empty-state">No records</div>}
        </div>
      </article>

      <article className="premium-section premium-accent-section">
        <div className="premium-section-title-wrap"><h2>Phase Remaining Work</h2><p className="premium-section-subtitle">Remaining execution effort toward target completion.</p></div>
        <div className="space-y-3 mt-3">
          {active.map((p) => {
            const progress = resolveProjectProgress(p);
            const remaining = resolveRemainingWork(p);
            const tone = remaining.tone === 'bad' ? 'bg-[#DC2626]' : remaining.tone === 'warn' ? 'bg-[var(--qms-gold)]' : remaining.tone === 'neutral' ? 'bg-slate-400' : 'bg-[var(--qms-graphite)]';
            return <div className="premium-finance-card" key={p.id}>
              <div className="flex justify-between text-xs"><b>{valueOr(p.name, '—')}</b><span>{valueOr(p.code, '—')}</span></div>
              <p className="premium-mini-note">Target date: {remaining.targetDate ? fmtDate(remaining.targetDate) : 'Target date not set'}</p>
              <p className={`premium-mini-note ${remaining.tone === 'bad' ? 'text-red-600' : remaining.tone === 'warn' ? 'text-amber-600' : remaining.tone === 'neutral' ? 'text-slate-500' : 'text-emerald-600'}`}>{remaining.label}</p>
              <div className="modern-progress mt-2"><div className={tone} style={{ width: `${Math.max(progress, 6)}%` }} /></div>
            </div>;
          })}
          {active.length === 0 && <div className="qms-empty-state">No records</div>}
        </div>
      </article>
    </section>

    <section className="premium-section premium-accent-section">
      <div className="premium-section-title-wrap"><h2>Projects Timeline</h2><p className="premium-section-subtitle">Planned project windows across the annual timeline.</p></div>
      <div className="premium-timeline">
        <div className="premium-timeline-months">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => <span key={m}>{m}</span>)}
        </div>
        {active.map((p) => {
          const s = new Date(p.portfolio_timeline_start || p.start_date || Date.now());
          const e = new Date(p.portfolio_timeline_end || p.target_completion_date || p.end_date || Date.now());
          const startMonth = Math.max(0, Math.min(11, s.getUTCMonth()));
          const endMonth = Math.max(startMonth, Math.min(11, e.getUTCMonth()));
          const left = (startMonth / 12) * 100;
          const width = ((endMonth - startMonth + 1) / 12) * 100;
          return <div key={p.id} className="premium-timeline-row">
            <div className="premium-timeline-name"><b>{valueOr(p.name, '—')}</b><span>{valueOr(p.code, '—')}</span></div>
            <div className="premium-timeline-track"><div className="premium-timeline-bar" style={{ left: `${left}%`, width: `${width}%` }} /></div>
          </div>;
        })}
        {active.length === 0 && <div className="qms-empty-state mt-3">No records</div>}
      </div>
    </section>

    <section className="premium-section premium-accent-section">
      <div className="premium-section-title-wrap"><h2>Issues / Actions Summary</h2><p className="premium-section-subtitle">Top open concerns and pending follow-up actions.</p></div>
      {issueRows.length === 0 ? <div className="qms-empty-state mt-3">No issues or pending actions recorded.</div> : <>
        <div className="premium-issues-table mt-3">
          {visibleIssueRows.map((r, i) => <div key={`${r.source}-${r.projectId || 'p'}-${i}`} className="premium-issue-row">
            <div><b>{r.project || '—'}</b><p>{r.code || '—'}</p></div>
            <div><b>{valueOr(r.title, 'Issue')}</b><p>{valueOr(r.action, 'No records')}</p></div>
            <span className={`modern-chip ${r.priority === 'Critical' ? 'chip-bad' : r.priority === 'High' ? 'chip-warn' : r.priority === 'Medium' ? 'chip-warn' : 'chip-good'}`}>{valueOr(r.priority, 'Not set')}</span>
            <div>{valueOr(r.responsible, 'Not set')}</div>
            <div>{r.dueDate ? fmtDate(r.dueDate) : 'Not set'}</div>
            <span className={`modern-chip ${r.status === 'Overdue' ? 'chip-bad' : r.status === 'In Progress' ? 'chip-neutral' : r.status === 'Waiting' ? 'chip-warn' : 'chip-warn'}`}>{valueOr(r.status, '—')}</span>
            <div>{valueOr(r.comments, '—')}</div>
          </div>)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {extraIssueCount > 0 ? <p className="premium-mini-note">+ {extraIssueCount} more actions</p> : <span />}
          <button className="btn-secondary" type="button" onClick={() => {
            const firstProjectId = visibleIssueRows.find((x) => x.projectId)?.projectId;
            if (firstProjectId) nav(`/project/${firstProjectId}/dashboard`);
          }}>Open Follow-Ups</button>
        </div>
      </>}
    </section>

    {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={() => { load(); }} />}
    </div>
  </div>;
}
