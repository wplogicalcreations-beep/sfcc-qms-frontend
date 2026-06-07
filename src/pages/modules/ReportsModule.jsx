import { useMemo, useState, useEffect } from 'react';
import api from '../../utils/api';
import { fmtDate } from '../../utils/helpers.jsx';
import { canPerform } from '../../utils/permissions';
import { userSafeError } from '../../utils/uiMessages';

const REGISTER_CONFIG = [
  { id: 'document-control', icon: '📚', shortName: 'Document Control', name: 'Document Control Register', description: 'Controlled documents, revisions, workflow status, and ownership.' },
  { id: 'submittal', icon: '📦', shortName: 'Submittals', name: 'Submittal Register', description: 'Material and design submittals with approval milestones.' },
  { id: 'rfi', icon: '❔', shortName: 'RFIs', name: 'RFI Register', description: 'Open questions, response priorities, due dates, and closure.' },
  { id: 'inspection', icon: '🧾', shortName: 'Inspections', name: 'Inspection Request Register', description: 'Inspection requests, locations, outcomes, and evidence status.' },
  { id: 'evidence', icon: '✅', shortName: 'Evidence', name: 'Evidence / Approval Register', description: 'Approval and evidence readiness across issued records.' },
  { id: 'followup', icon: '⚠️', shortName: 'Follow-Up', name: 'Overdue / Pending Follow-Up Register', description: 'Overdue, missing evidence, and pending approval actions.' },
];

const SUBMITTAL_TYPES = new Set(['MS', 'DS']);

const DOCUMENT_TYPE_LABELS = {
  MS: 'Material Submittal',
  DS: 'Drawing Submittal',
  RFI: 'Request for Information',
  IR: 'Inspection Request',
  SI: 'Site Instruction',
  TR: 'Transmittal',
  NCR: 'Non-Conformance Report',
  VO: 'Variation Order',
  PR: 'Progress Report',
  HOC: 'Handover Certificate',
  HANDOVER: 'Handover Certificate',
};
const DOCUMENT_TYPE_OPTIONS = ['MS', 'DS', 'RFI', 'IR', 'SI', 'TR', 'NCR', 'VO'];
const RESET_FILTERS = {
  type: 'ALL',
  discipline: 'ALL',
  workflow_status: 'ALL',
  approval_status: 'ALL',
  evidence_status: 'ALL',
  from: '',
  to: '',
  q: '',
};

export default function ReportsModule({ project }) {
  const [selected, setSelected] = useState(REGISTER_CONFIG[0].id);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(RESET_FILTERS);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api.get(`/documents?project_id=${project.id}&pageSize=1000`)
      .then((response) => {
        if (cancelled) return;
        setDocs(response.data?.data || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(userSafeError(e, 'Reports/Register data could not be loaded. Please refresh and try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [project.id]);

  const uniqueOptions = useMemo(() => {
    const values = { type: new Set(), discipline: new Set(), workflow_status: new Set(), approval_status: new Set(), evidence_status: new Set() };
    docs.forEach((d) => {
      ['type', 'discipline', 'workflow_status', 'approval_status', 'evidence_status'].forEach((k) => {
        if (d[k]) values[k].add(d[k]);
      });
    });
    const entries = Object.entries(values).map(([k, set]) => {
      const optionValues = k === 'type'
        ? ['ALL', ...DOCUMENT_TYPE_OPTIONS, ...Array.from(set).filter((v) => !DOCUMENT_TYPE_OPTIONS.includes(v)).sort()]
        : ['ALL', ...Array.from(set).sort()];
      return [k, optionValues];
    });
    return Object.fromEntries(entries);
  }, [docs]);

  const registerRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      'document-control': docs,
      submittal: docs.filter((d) => SUBMITTAL_TYPES.has(d.type)),
      rfi: docs.filter((d) => d.type === 'RFI'),
      inspection: docs.filter((d) => d.type === 'IR'),
      evidence: docs.filter((d) => d.approval_status !== 'Not Submitted' || d.evidence_status !== 'No Evidence'),
      followup: docs.filter((d) => {
        const overdue = d.due_date && d.due_date < today && !['Closed', 'Superseded', 'Cancelled'].includes(d.workflow_status);
        const pendingEvidence = ['Issued', 'Under Review', 'Response Received'].includes(d.workflow_status) && ['No Evidence', 'Pending Upload'].includes(d.evidence_status);
        const pendingApproval = ['Submitted', 'Revise and Resubmit'].includes(d.approval_status);
        return overdue || pendingEvidence || pendingApproval;
      }),
    };
  }, [docs]);

  const filteredRows = useMemo(() => {
    const rows = registerRows[selected] || [];
    return rows.filter((r) => {
      if (filters.type !== 'ALL' && r.type !== filters.type) return false;
      if (filters.discipline !== 'ALL' && r.discipline !== filters.discipline) return false;
      if (filters.workflow_status !== 'ALL' && r.workflow_status !== filters.workflow_status) return false;
      if (filters.approval_status !== 'ALL' && r.approval_status !== filters.approval_status) return false;
      if (filters.evidence_status !== 'ALL' && r.evidence_status !== filters.evidence_status) return false;
      if (filters.from && (!r.issue_date || r.issue_date < filters.from)) return false;
      if (filters.to && (!r.issue_date || r.issue_date > filters.to)) return false;
      if (filters.q) {
        const hay = `${r.ref || ''} ${r.title || ''} ${r.description || ''}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [filters, registerRows, selected]);

  function exportCsv() {
    const columns = getColumns(selected);
    const header = columns.map((c) => c.label).join(',');
    const body = filteredRows.map((row) => columns.map((c) => csvEscape(valueForColumn(selected, c.key, row))).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${project.code || project.id}-${selected}-register.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const totals = useMemo(() => {
    const rows = filteredRows;
    return {
      total: rows.length,
      overdue: rows.filter((d) => d.due_date && d.due_date < new Date().toISOString().slice(0, 10) && !['Closed', 'Superseded', 'Cancelled'].includes(d.workflow_status)).length,
      missingEvidence: rows.filter((d) => ['No Evidence', 'Pending Upload'].includes(d.evidence_status)).length,
      approved: rows.filter((d) => ['Approved', 'Approved as Noted'].includes(d.approval_status)).length,
      pending: rows.filter((d) => ['Draft', 'Issued', 'Under Review', 'Submitted', 'Revise and Resubmit'].includes(d.workflow_status) || ['Submitted', 'Revise and Resubmit', 'Not Submitted'].includes(d.approval_status)).length,
    };
  }, [filteredRows]);

  const canExportCsv = canPerform('reports.export_csv');
  const canPrintRegister = canPerform('reports.print');
  const selectedRegister = REGISTER_CONFIG.find((r) => r.id === selected);
  const generatedOn = new Date().toISOString().slice(0, 10);
  const sourceRowCount = registerRows[selected]?.length || 0;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => value && value !== RESET_FILTERS[key]);
  const filterSummary = useMemo(() => {
    const tokens = [];
    if (filters.type !== 'ALL') tokens.push(`Type: ${documentTypeLabel(filters.type)}`);
    if (filters.discipline !== 'ALL') tokens.push(`Discipline: ${filters.discipline}`);
    if (filters.workflow_status !== 'ALL') tokens.push(`Workflow: ${filters.workflow_status}`);
    if (filters.approval_status !== 'ALL') tokens.push(`Approval: ${filters.approval_status}`);
    if (filters.evidence_status !== 'ALL') tokens.push(`Evidence: ${filters.evidence_status}`);
    if (filters.from) tokens.push(`Issued From: ${fmtDate(filters.from)}`);
    if (filters.to) tokens.push(`Issued To: ${fmtDate(filters.to)}`);
    if (filters.q) tokens.push(`Search: “${filters.q}”`);
    return tokens.length ? tokens.join(' | ') : 'No active filters';
  }, [filters]);

  return (
    <div className="reports-page print-wrap reports-print-root">
      <div className="reports-hero no-print">
        <div className="reports-hero-copy">
          <div className="reports-eyebrow">Executive register suite</div>
          <h1>Reports & Registers</h1>
          <p>{project.name || 'Project'}{project.code ? ` · ${project.code}` : ''}</p>
          <div className="reports-hero-meta">
            <span>Generated {fmtDate(generatedOn)}</span>
            <span>{docs.length} source records</span>
            <span>{selectedRegister?.name}</span>
          </div>
        </div>
        <div className="reports-actions">
          {canExportCsv && <button onClick={exportCsv} className="reports-action-btn">Export CSV</button>}
          {canPrintRegister && <button onClick={() => window.print()} className="reports-action-btn reports-action-primary">Print</button>}
        </div>
      </div>

      <OfficialPrintReport
        project={project}
        register={selected}
        selectedRegister={selectedRegister}
        rows={filteredRows}
        totals={totals}
        generatedOn={generatedOn}
        filterSummary={filterSummary}
      />

      <div className="reports-layout">
        <aside className="reports-sidebar no-print">
          <RegisterSelector selected={selected} onSelect={setSelected} rowsByRegister={registerRows} />
        </aside>

        <main className="reports-main-card">
          <div className="reports-register-head no-print">
            <div>
              <div className="reports-register-kicker">Active register</div>
              <h2>{selectedRegister?.name}</h2>
              <p>{selectedRegister?.description}</p>
            </div>
            <div className="reports-register-count">
              <strong>{filteredRows.length}</strong>
              <span>visible rows</span>
            </div>
          </div>

          <FilterBar options={uniqueOptions} filters={filters} onChange={setFilters} />

          <div className="reports-kpi-grid no-print">
            <SummaryCard label="Total Rows" value={totals.total} tone="blue" hint="Current filtered view" />
            <SummaryCard label="Overdue" value={totals.overdue} tone="red" hint="Due date passed" />
            <SummaryCard label="Missing Evidence" value={totals.missingEvidence} tone="amber" hint="No or pending upload" />
            <SummaryCard label="Approved" value={totals.approved} tone="green" hint="Approved records" />
            <SummaryCard label="Pending / Draft" value={totals.pending} tone="slate" hint="Needs workflow action" />
          </div>

          {loading && <RegisterState icon="⏳" title="Loading register data" message="Preparing the latest project records for this report." />}
          {!!error && !loading && <RegisterState icon="⚠️" title="Unable to load reports" message={error} tone="error" />}
          {!loading && !error && (
            <RegisterTable
              register={selected}
              rows={filteredRows}
              hasActiveFilters={hasActiveFilters}
              sourceRowCount={sourceRowCount}
              onResetFilters={() => setFilters(RESET_FILTERS)}
            />
          )}
          <footer className="reports-print-footer print-only-section"><span>Generated by SFCC QMS Platform</span><span>Internal register report · {fmtDate(generatedOn)}</span></footer>
        </main>
      </div>
    </div>
  );
}


function OfficialPrintReport({ project, register, selectedRegister, rows, totals, generatedOn, filterSummary }) {
  const columns = getColumns(register, true);
  return (
    <section className="reports-official-print print-only-section" aria-label="Official print register report">
      <header className="reports-official-header">
        <div className="reports-brand-block reports-brand-block-text-only">
          <div className="reports-brand-copy">
            <strong>SILVER FOUNDATION CONTRACTING COMPANY</strong>
            <span>Quality Management System</span>
            <em>Internal QMS Register</em>
          </div>
        </div>
        <div className="reports-print-meta">
          <h2>{selectedRegister?.name || 'Register Report'}</h2>
          <div><span>Project:</span> {project.name || '—'}</div>
          <div><span>Code:</span> {project.code || '—'}</div>
          <div><span>Generated:</span> {fmtDate(generatedOn)}</div>
        </div>
      </header>

      <div className="reports-filter-summary"><span>Applied Filters:</span> {filterSummary}</div>

      <div className="reports-print-summary" aria-label="Register print summary">
        <div><span>Total Rows</span><strong>{totals.total}</strong></div>
        <div><span>Overdue</span><strong>{totals.overdue}</strong></div>
        <div><span>Missing Evidence</span><strong>{totals.missingEvidence}</strong></div>
        <div><span>Approved</span><strong>{totals.approved}</strong></div>
        <div><span>Pending / Draft</span><strong>{totals.pending}</strong></div>
      </div>

      <table className="reports-official-table">
        <colgroup>{columns.map((c) => <col key={c.key} className={`reports-official-col-${c.key}`} />)}</colgroup>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, i) => (
            <tr key={`official-print-${row.id || row.ref || i}`}>
              {columns.map((c) => (
                <td key={c.key} className={`reports-official-cell reports-official-cell-${c.key}`}>
                  <StatusAwareCell col={c.key} value={valueForColumn(register, c.key, row)} row={row} printMode />
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="reports-official-empty">No records available for this register.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function RegisterSelector({ selected, onSelect, rowsByRegister }) {
  return (
    <div className="register-selector-panel">
      <div className="register-selector-title">
        <span>Register Navigation</span>
        <small>{REGISTER_CONFIG.length} views</small>
      </div>
      <div className="register-selector-list">
        {REGISTER_CONFIG.map((r) => {
          const active = selected === r.id;
          return (
            <button key={r.id} onClick={() => onSelect(r.id)} className={`register-selector-item ${active ? 'active' : ''}`}>
              <span className="register-icon" aria-hidden="true">{r.icon}</span>
              <span className="register-copy">
                <strong>{r.shortName}</strong>
                <small>{r.description}</small>
              </span>
              <span className="register-count">{rowsByRegister[r.id]?.length || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, hint }) {
  return (
    <div className={`reports-kpi-card tone-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small>{hint}</small>
    </div>
  );
}

function FilterBar({ options, filters, onChange }) {
  const selectFields = [
    ['type', 'Type'], ['discipline', 'Discipline'], ['workflow_status', 'Workflow'], ['approval_status', 'Approval'], ['evidence_status', 'Evidence'],
  ];
  return (
    <div className="reports-filter-card no-print">
      <div className="reports-filter-head">
        <div>
          <strong>Filter register data</strong>
          <span>Refine the active register without affecting CSV or print output.</span>
        </div>
        <button onClick={() => onChange(RESET_FILTERS)} className="reports-reset-btn">Reset filters</button>
      </div>
      <div className="reports-filter-grid">
        {selectFields.map(([key, label]) => (
          <label key={key} className="reports-field">
            <span>{label}</span>
            <select value={filters[key]} onChange={(e) => onChange((prev) => ({ ...prev, [key]: e.target.value }))}>
              {(options[key] || ['ALL']).map((v) => <option key={v} value={v}>{optionLabel(key, label, v)}</option>)}
            </select>
          </label>
        ))}
        <label className="reports-field reports-search-field">
          <span>Search</span>
          <input value={filters.q} onChange={(e) => onChange((prev) => ({ ...prev, q: e.target.value }))} placeholder="Search reference, title, or description" />
        </label>
        <label className="reports-field">
          <span>Issued from</span>
          <input type="date" value={filters.from} onChange={(e) => onChange((prev) => ({ ...prev, from: e.target.value }))} />
        </label>
        <label className="reports-field">
          <span>Issued to</span>
          <input type="date" value={filters.to} onChange={(e) => onChange((prev) => ({ ...prev, to: e.target.value }))} />
        </label>
      </div>
    </div>
  );
}

function RegisterTable({ register, rows, hasActiveFilters, sourceRowCount, onResetFilters }) {
  const columns = getColumns(register, false);
  if (!rows.length) {
    const filteredOut = hasActiveFilters && sourceRowCount > 0;
    return (
      <RegisterState
        icon={filteredOut ? '🔎' : '📄'}
        title={filteredOut ? 'No records match these filters' : 'No records in this register yet'}
        message={filteredOut ? 'Adjust or reset the filter toolbar to widen the register results.' : 'Records will appear here when this register has applicable project documents.'}
        action={filteredOut ? <button onClick={onResetFilters} className="reports-reset-btn">Reset filters</button> : null}
      />
    );
  }
  return (
    <div className="reports-table-shell">
      <div className="reports-table-toolbar no-print">
        <div>
          <strong>Register rows</strong>
          <span>Horizontally scroll to review all professional register fields.</span>
        </div>
        <span>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
      </div>
      <div className="reports-table-wrap">
        <table className="reports-table screen-table" style={{ minWidth: tableMinWidth(columns) }}>
          <colgroup>{columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => (
            <tr key={row.id || `${row.ref}-${i}`}>
              {columns.map((c) => <td key={c.key} className={`reports-cell reports-cell-${c.key} ${c.wrap ? 'wrap' : 'nowrap'}`}><StatusAwareCell col={c.key} value={valueForColumn(register, c.key, row)} row={row} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function RegisterState({ icon, title, message, action, tone = 'neutral' }) {
  return (
    <div className={`reports-state reports-state-${tone}`}>
      <div className="reports-state-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

function StatusAwareCell({ col, value, row, printMode = false }) {
  if (col === 'action') {
    return <span className="reports-open-link">Open</span>;
  }
  if (col === 'ref') {
    return <span className="reports-ref" title={value || '—'}>{value || '—'}</span>;
  }
  if (col === 'title') {
    const title = value || '—';
    const description = row?.description && row.description !== row.title ? row.description : '';
    return (
      <span className="reports-title-cell" title={description || title}>
        <strong>{title}</strong>
        {description && !printMode && <small>{description}</small>}
      </span>
    );
  }
  if (col === 'owner') {
    return <span className="reports-owner" title={value || '—'}>{value || '—'}</span>;
  }
  if (['workflow_status', 'approval_status', 'evidence_status', 'overdue_flag', 'closure_status', 'severity'].includes(col)) {
    return <span className={`reports-status-chip ${statusClass(value, col)}`} title={value || '—'}>{value || '—'}</span>;
  }
  return <span className="reports-plain" title={value || '—'}>{value || '—'}</span>;
}

function getColumns(register, printMode = false) {
  const base = [
    { key: 'ref', label: 'Reference', width: '210px' },
    { key: 'type', label: 'Document Type', width: '190px' },
    { key: 'title', label: 'Title / Description', width: '360px', wrap: true },
    { key: 'discipline', label: 'Discipline', width: '140px' },
    { key: 'revision', label: 'Revision', width: '90px' },
    { key: 'workflow_status', label: 'Workflow', width: '140px' },
    { key: 'approval_status', label: 'Approval', width: '150px' },
    { key: 'evidence_status', label: 'Evidence', width: '150px' },
    { key: 'issue_date', label: 'Issued', width: '120px' },
    { key: 'due_date', label: 'Response Due', width: '130px' },
    { key: 'updated_at', label: 'Last Updated', width: '130px' },
    { key: 'owner', label: 'Internal Owner', width: '170px' },
  ];
  const registerColumns = {
    submittal: [
      { key: 'ref', label: 'Submittal Ref', width: '210px' }, { key: 'type', label: 'Document Type', width: '190px' }, { key: 'title', label: 'Submittal Title / Description', width: '380px', wrap: true }, { key: 'discipline', label: 'Discipline', width: '140px' },
      { key: 'revision', label: 'Revision', width: '90px' }, { key: 'approval_status', label: 'Approval', width: '150px' }, { key: 'workflow_status', label: 'Workflow', width: '140px' }, { key: 'evidence_status', label: 'Evidence', width: '150px' },
      { key: 'issue_date', label: 'Submitted', width: '120px' }, { key: 'due_date', label: 'Response Due', width: '130px' }, { key: 'owner', label: 'Internal Owner', width: '170px' },
    ],
    rfi: [
      { key: 'ref', label: 'RFI Reference', width: '210px' }, { key: 'title', label: 'Subject / Query', width: '420px', wrap: true }, { key: 'discipline', label: 'Discipline', width: '140px' }, { key: 'severity', label: 'Priority', width: '120px' },
      { key: 'workflow_status', label: 'Status', width: '140px' }, { key: 'due_date', label: 'Response Due', width: '130px' }, { key: 'overdue_flag', label: 'Overdue', width: '110px' }, { key: 'closure_status', label: 'Closure', width: '120px' }, { key: 'owner', label: 'Responsible Owner', width: '180px' },
    ],
    inspection: [
      { key: 'ref', label: 'IR Reference', width: '210px' }, { key: 'title', label: 'Inspection Type / Description', width: '360px', wrap: true }, { key: 'issue_date', label: 'Requested Date', width: '130px' }, { key: 'area', label: 'Location / Area', width: '190px', wrap: true },
      { key: 'workflow_status', label: 'Inspection Status', width: '160px' }, { key: 'approval_status', label: 'Outcome', width: '150px' }, { key: 'evidence_status', label: 'Evidence Status', width: '150px' }, { key: 'owner', label: 'Internal Owner', width: '170px' },
    ],
    evidence: [
      { key: 'ref', label: 'Linked Reference', width: '210px' }, { key: 'title', label: 'Record Title', width: '380px', wrap: true }, { key: 'type', label: 'Document Type', width: '190px' }, { key: 'approval_status', label: 'Approval Status', width: '160px' },
      { key: 'evidence_status', label: 'Evidence Status', width: '160px' }, { key: 'updated_at', label: 'Evidence Upload / Last Update', width: '180px' }, { key: 'owner', label: 'Internal Owner', width: '170px' },
    ],
    followup: [
      { key: 'ref', label: 'Reference', width: '210px' }, { key: 'title', label: 'Action Item / Title', width: '360px', wrap: true }, { key: 'workflow_status', label: 'Workflow', width: '140px' }, { key: 'approval_status', label: 'Approval', width: '150px' },
      { key: 'evidence_status', label: 'Evidence', width: '150px' }, { key: 'due_date', label: 'Due Date', width: '130px' }, { key: 'overdue_flag', label: 'Overdue', width: '110px' }, { key: 'owner', label: 'Responsible Owner', width: '180px' }, { key: 'followup_reason', label: 'Follow-up Required', width: '260px', wrap: true },
    ],
  };
  const columns = registerColumns[register] || base;
  if (printMode) return getPrintColumns(register);
  return [...columns, { key: 'action', label: 'Action', width: '100px' }];
}

function getPrintColumns(register) {
  const shared = {
    ref: { key: 'ref', label: 'Reference' },
    type: { key: 'type', label: 'Document Type' },
    title: { key: 'title', label: 'Title / Description', wrap: true },
    discipline: { key: 'discipline', label: 'Discipline' },
    revision: { key: 'revision', label: 'Rev.' },
    workflow: { key: 'workflow_status', label: 'Workflow' },
    approval: { key: 'approval_status', label: 'Approval' },
    approvalResponse: { key: 'approval_status', label: 'Approval / Response' },
    evidence: { key: 'evidence_status', label: 'Evidence' },
    issued: { key: 'issue_date', label: 'Issued' },
    due: { key: 'due_date', label: 'Due' },
  };

  const printColumns = {
    'document-control': [shared.ref, shared.type, shared.title, shared.discipline, shared.revision, shared.workflow, shared.approval, shared.evidence, shared.issued, shared.due],
    submittal: [shared.ref, shared.type, shared.title, shared.discipline, shared.revision, shared.workflow, shared.approval, shared.evidence, shared.issued, shared.due],
    rfi: [shared.ref, { ...shared.title, label: 'Title / Subject' }, shared.discipline, shared.workflow, shared.approvalResponse, shared.issued, shared.due],
    inspection: [shared.ref, { ...shared.title, label: 'Title / Inspection' }, shared.discipline, { ...shared.workflow, label: 'Workflow / Outcome' }, shared.evidence, shared.issued, shared.due],
    evidence: [shared.ref, shared.type, shared.title, shared.approval, shared.evidence, shared.issued, shared.due],
    followup: [shared.ref, shared.type, shared.title, shared.workflow, shared.approval, shared.evidence, shared.due],
  };

  return printColumns[register] || printColumns['document-control'];
}

function valueForColumn(register, key, row) {
  const today = new Date().toISOString().slice(0, 10);
  if (key === 'title') return row.title || row.description;
  if (key === 'updated_at') return fmtDate(row.updated_at);
  if (key === 'issue_date' || key === 'due_date') return fmtDate(row[key]);
  if (key === 'owner') return readableOwner(row);
  if (key === 'type') return documentTypeLabel(row.type);
  if (key === 'action') return 'Open';
  if (key === 'overdue_flag') return row.due_date && row.due_date < today && !['Closed', 'Superseded', 'Cancelled'].includes(row.workflow_status) ? 'Yes' : 'No';
  if (key === 'closure_status') return row.workflow_status === 'Closed' ? 'Closed' : 'Open';
  if (key === 'followup_reason') {
    if (row.due_date && row.due_date < today && !['Closed', 'Superseded', 'Cancelled'].includes(row.workflow_status)) return 'Response due date passed';
    if (['Issued', 'Under Review', 'Response Received'].includes(row.workflow_status) && ['No Evidence', 'Pending Upload'].includes(row.evidence_status)) return 'Issued/submitted without evidence';
    if (['Submitted', 'Revise and Resubmit'].includes(row.approval_status)) return 'Pending approval/status update';
    return 'Internal follow-up required';
  }
  return row[key];
}



function normalizeDocumentTypeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function documentTypeLabel(value) {
  const normalized = normalizeDocumentTypeCode(value);
  if (!normalized) return '—';
  return DOCUMENT_TYPE_LABELS[normalized] || String(value).trim();
}

function optionLabel(key, label, value) {
  if (value === 'ALL') return key === 'type' ? 'All Types' : `All ${label}`;
  if (key === 'type') return documentTypeLabel(value);
  return value;
}

function readableOwner(row) {
  const name = row?.owner_name || row?.created_by_name || row?.internal_owner_name || row?.owner?.name;
  if (name) return name;
  const role = row?.owner_role || row?.created_by_role || row?.internal_owner_role || row?.owner?.role;
  if (role) return role;
  const rawOwner = row?.created_by || row?.owner_id || row?.internal_owner;
  if (!rawOwner) return 'Internal Team';
  if (typeof rawOwner === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawOwner)) return 'Internal Team';
  return rawOwner;
}

function statusClass(value, col) {
  const text = String(value || '').toLowerCase();
  if (col === 'overdue_flag' && text === 'yes') return 'status-danger';
  if (col === 'overdue_flag' && text === 'no') return 'status-success';
  if (['approved', 'approved as noted', 'verified', 'closed', 'low'].includes(text)) return 'status-success';
  if (['rejected', 'revise and resubmit', 'no evidence', 'high', 'critical'].includes(text)) return 'status-danger';
  if (['submitted', 'under review', 'pending upload', 'issued', 'medium'].includes(text)) return 'status-warning';
  if (['draft', 'not submitted', 'open'].includes(text)) return 'status-neutral';
  return 'status-info';
}

function tableMinWidth(columns) {
  const total = columns.reduce((sum, c) => sum + Number.parseInt(c.width, 10), 0);
  return `${Math.max(total, 1300)}px`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
