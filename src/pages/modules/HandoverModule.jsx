import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../utils/api';
import { canPerform, getCurrentUser, normalizeRole } from '../../utils/permissions';

const DISCIPLINES = [
  { key: 'arch', label: 'Architectural' },
  { key: 'civil', label: 'Civil & Structural' },
  { key: 'mech', label: 'Mechanical (HVAC)' },
  { key: 'elec', label: 'Electrical' },
  { key: 'plumbing', label: 'Plumbing & Drainage' },
  { key: 'ff', label: 'Fire Fighting' },
  { key: 'elv', label: 'Extra Low Voltage (ELV)' },
  { key: 'landscape', label: 'Landscape' },
];
const HANDOVER_PACKAGES = ['As-Built Drawings', 'Approved Material Submittals', 'Approved Shop Drawings', 'Inspection Records', 'Testing & Commissioning Records', 'Operation & Maintenance Manual', 'Warranty Certificates', 'Final Evidence / Photos'];
const SNAG_STATUSES = ['Open', 'In Progress', 'Rectified', 'Verified', 'Closed'];
const SNAG_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const makeKey = (discipline, packageName) => `${discipline}::${packageName}`;
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const currentUserName = () => getCurrentUser()?.name || getCurrentUser()?.email || 'Current User';

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeDiscipline = (value) => {
  const text = normalizeText(value);
  const match = DISCIPLINES.find((d) => text === d.key || text === normalizeText(d.label) || text.includes(normalizeText(d.label)));
  return match?.key || text || 'general';
};
const APPROVED_DOCUMENT_STATUSES = new Set(['approved', 'approved as noted']);
const READY_ITEM_STATUSES = new Set(['approved', 'closed', 'verified']);
const UPLOADED_ITEM_STATUSES = new Set(['uploaded', 'in_review', 'approved', 'closed', 'verified']);
const isApprovedDocument = (doc) => APPROVED_DOCUMENT_STATUSES.has(normalizeText(doc?.approval_status));
const isVerifiedDocument = (doc) => normalizeText(doc?.evidence_status) === 'verified';
const documentHasEvidence = (doc) => Number(doc?.attachment_count || 0) > 0 || !['', 'no evidence', 'not recorded'].includes(normalizeText(doc?.evidence_status));
const packageDocumentMatcher = (packageName) => {
  const pkg = normalizeText(packageName);
  return (doc) => {
    const type = normalizeText(doc?.type);
    const title = normalizeText(`${doc?.title || ''} ${doc?.description || ''} ${doc?.notes || ''} ${doc?.ref || ''}`);
    if (pkg === 'approved material submittals') return type === 'ms' || title.includes('material submittal');
    if (pkg === 'approved shop drawings') return type === 'ds' || title.includes('shop drawing');
    if (pkg === 'inspection records') return type === 'ir' || title.includes('inspection');
    if (pkg === 'as built drawings') return title.includes('as built') || title.includes('asbuilt');
    if (pkg === 'testing commissioning records') return title.includes('testing') || title.includes('commissioning') || title.includes('t c record');
    if (pkg === 'operation maintenance manual') return title.includes('operation maintenance') || title.includes('maintenance manual') || title.includes('o m manual') || title.includes('om manual');
    if (pkg === 'warranty certificates') return title.includes('warranty');
    if (pkg === 'final evidence photos') return title.includes('final evidence') || title.includes('photo') || title.includes('closeout evidence');
    return false;
  };
};

const DEFAULT_CERT_BODY = `The project works have been completed in accordance with the approved internal scope records, specifications, drawings, approvals, and applicable contract requirements. This controlled QMS record confirms internal completion status, closeout documentation readiness, and any listed outstanding items or exceptions before final external handover evidence is retained.`;

function nextSnagNumber(project, snags) {
  const next = snags.length + 1;
  return `${project.code || 'PRJ'}-SNAG-${String(next).padStart(3, '0')}`;
}

function statusTone(value = '') {
  const normalized = String(value).toLowerCase();
  if (['approved', 'closed', 'issued', 'verified', 'evidence uploaded', 'uploaded'].some((v) => normalized.includes(v))) return 'success';
  if (['open', 'critical', 'rejected'].some((v) => normalized.includes(v))) return 'danger';
  if (['pending', 'draft', 'in progress', 'review', 'not approved'].some((v) => normalized.includes(v))) return 'warning';
  return 'neutral';
}

function prettyStatus(value) {
  if (value === undefined || value === null || value === '') return 'Not Recorded';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSnagStatus(value) {
  const normalized = normalizeText(value || 'Open');
  if (normalized === 'open') return 'Open';
  if (normalized === 'in progress' || normalized === 'inprogress') return 'In Progress';
  if (normalized === 'rectified') return 'Rectified';
  if (normalized === 'closed') return 'Closed';
  if (normalized === 'verified') return 'Verified';
  return '';
}

function isSnagRecord(item) {
  const category = normalizeText(item?.category);
  const packageName = normalizeText(item?.package_name || item?.package);
  return ['snag item', 'snagging', 'punch item', 'punch list'].includes(category)
    || packageName === 'snag punch item'
    || packageName === 'snag item'
    || packageName === 'punch item';
}

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="handover-progress"><span style={{ width: `${pct}%` }} /></div>;
}

function StatusChip({ children, tone }) {
  return <span className={`handover-status-chip ${tone || statusTone(children)}`}>{children}</span>;
}

function FieldValue({ label, value, chip }) {
  const display = value === undefined || value === null || value === '' ? 'Not recorded' : value;
  return <div className="handover-field-value"><span>{label}</span>{chip ? <StatusChip>{display === 'Not recorded' ? 'Not Recorded' : display}</StatusChip> : <strong>{display}</strong>}</div>;
}

export default function HandoverModule({ project }) {
  const [items, setItems] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDisc, setSelectedDisc] = useState('all');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snagFilters, setSnagFilters] = useState({ status: '', discipline: '', priority: '', search: '' });
  const currentUser = useMemo(() => ({ ...getCurrentUser(), role: normalizeRole(getCurrentUser()?.role) }), []);
  const canEdit = canPerform('documents.edit_draft', currentUser);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [hov, docRes] = await Promise.all([
        api.get('/handover', { params: { project_id: project.id } }),
        api.get('/documents', { params: { project_id: project.id, pageSize: 300 } }),
      ]);
      setItems(Array.isArray(hov.data) ? hov.data : []);
      setDocs(docRes.data?.data || []);
    } catch {
      setError('Unable to load handover and closeout data. Please refresh or contact the system administrator.');
    } finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const byKey = new Map(items.map((it) => [makeKey(it.discipline, it.package_name), it]));
  const standardItems = items.filter((i) => (i.category || 'standard') === 'standard' && i.package_name !== 'Insurance Documents');
  const snagRegister = Array.from(new Map(items.filter(isSnagRecord).map((item) => [item.id, item])).values());
  const certificateItem = items.find((i) => (i.category || '') === 'certificate' || i.package_name === 'Project Completion Certificate');
  const isApplicable = (item) => Number(item?.is_applicable ?? 1) === 1;
  const applicableStandardItems = standardItems.filter(isApplicable);
  const docsByDiscipline = useMemo(() => docs.reduce((acc, doc) => {
    const key = normalizeDiscipline(doc.discipline);
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {}), [docs]);
  const getLinkedDocs = useCallback((item) => {
    if (!item) return [];
    const matcher = packageDocumentMatcher(item.package_name);
    return (docsByDiscipline[normalizeDiscipline(item.discipline)] || []).filter(matcher);
  }, [docsByDiscipline]);
  const getEvidenceState = useCallback((item) => {
    if (!isApplicable(item)) return { status: 'Not Applicable', isReady: true, hasUploadedEvidence: false, linkedDocs: [] };
    const itemStatus = normalizeText(item?.status);
    const linkedDocs = getLinkedDocs(item);
    const readyDoc = linkedDocs.find((doc) => isApprovedDocument(doc) || isVerifiedDocument(doc));
    const evidenceDoc = linkedDocs.find(documentHasEvidence);
    const hasUploadedEvidence = Boolean(item?.attachment_id || evidenceDoc);
    const isReady = READY_ITEM_STATUSES.has(itemStatus) || Boolean(readyDoc);
    let status = 'Pending';
    if (isReady) status = readyDoc && !READY_ITEM_STATUSES.has(itemStatus) ? 'Approved Document Linked' : prettyStatus(item?.status || 'approved');
    else if (hasUploadedEvidence || UPLOADED_ITEM_STATUSES.has(itemStatus)) status = 'Uploaded';
    return { status, isReady, hasUploadedEvidence, linkedDocs };
  }, [getLinkedDocs]);
  const getStandardItemsForDiscipline = (discKey) => HANDOVER_PACKAGES.map((label) => byKey.get(makeKey(discKey, label))).filter(Boolean);
  const getDiscStats = (discKey) => {
    const applicable = getStandardItemsForDiscipline(discKey).filter(isApplicable);
    const approved = applicable.filter((i) => getEvidenceState(i).isReady).length;
    return { applicable: applicable.length, approved, pending: applicable.length - approved, pct: applicable.length ? Math.round((approved / applicable.length) * 100) : 0 };
  };
  const disciplineStats = DISCIPLINES.map((d) => getDiscStats(d.key));
  const readinessCount = applicableStandardItems.filter((i) => getEvidenceState(i).isReady).length;
  const packageCompletenessCount = readinessCount;
  const totalCloseoutItems = applicableStandardItems.length;
  const missingEvidence = applicableStandardItems.filter((i) => !getEvidenceState(i).isReady).length;
  const docPct = totalCloseoutItems ? Math.round((readinessCount / totalCloseoutItems) * 100) : 0;
  const pkgPct = totalCloseoutItems ? Math.round((packageCompletenessCount / totalCloseoutItems) * 100) : 0;
  const disciplinesReady = disciplineStats.filter((stats) => stats.applicable > 0 && stats.pct === 100).length;
  const overallPct = totalCloseoutItems ? Math.round(((docPct + pkgPct) / 2)) : 0;
  const snagCounts = snagRegister.reduce((acc, snag) => {
    const status = normalizeSnagStatus(snag.status);
    acc.Total += 1;
    if (status === 'Open' || status === 'In Progress') acc.Open += 1;
    if (status === 'In Progress') acc['In Progress'] += 1;
    if (status === 'Rectified') acc.Rectified += 1;
    if (status === 'Closed' || status === 'Verified') acc.Closed += 1;
    return acc;
  }, { Total: 0, Open: 0, 'In Progress': 0, Rectified: 0, Closed: 0 });
  const completionStatus = certificateItem?.certificate_issued ? 'Issued' : (certificateItem ? 'Draft' : 'Not Recorded');
  const handoverCertStatus = certificateItem?.certificate_uploaded ? 'Evidence Uploaded' : (certificateItem?.handover_status || 'Not Recorded');
  const filteredSnags = snagRegister.filter((snag) => {
    const haystack = [snag.snag_item_no, snag.area_location, snag.discipline, snag.description, snag.remarks, snag.responsible_owner, snag.evidence_reference].join(' ').toLowerCase();
    return (!snagFilters.status || snag.status === snagFilters.status)
      && (!snagFilters.discipline || snag.discipline === snagFilters.discipline)
      && (!snagFilters.priority || snag.priority === snagFilters.priority)
      && (!snagFilters.search || haystack.includes(snagFilters.search.toLowerCase()));
  });
  const filteredDiscs = selectedDisc === 'all' ? DISCIPLINES : DISCIPLINES.filter((d) => d.key === selectedDisc);

  const saveItem = async (item, patch) => {
    if (!canEdit || !item) return item;
    setIsSaving(true); setError('');
    try {
      const res = await api.patch(`/handover/${item.id}`, patch);
      setItems((prev) => prev.map((it) => (it.id === res.data.id ? res.data : it)));
      return res.data;
    } catch {
      setError('Unable to save the closeout update. Please verify the entry and try again.');
      throw new Error('Unable to save the closeout update.');
    } finally { setIsSaving(false); }
  };

  const createSnag = async () => {
    if (!canEdit) return;
    setIsSaving(true); setError('');
    try {
      const res = await api.post('/handover', {
        project_id: project.id,
        discipline: 'general',
        package_name: 'Snag / Punch Item',
        category: 'snag_item',
        status: 'Open',
        snag_item_no: nextSnagNumber(project, snagRegister),
        priority: 'Medium',
        responsible_owner: currentUserName(),
        remarks: '',
      });
      setItems((prev) => [...prev, res.data]);
    } catch {
      setError('Unable to add the snag item. Please try again.');
    } finally { setIsSaving(false); }
  };

  const createCertificate = async () => {
    if (!canEdit || certificateItem) return;
    setIsSaving(true); setError('');
    try {
      const res = await api.post('/handover', {
        project_id: project.id,
        discipline: 'project_closeout',
        package_name: 'Project Completion Certificate',
        category: 'certificate',
        status: 'pending',
        certificate_issued: 0,
        certificate_approved: 'Not Approved',
        certificate_uploaded: 0,
        project_name: project.name || '',
        project_code: project.code || '',
        contractor_name: project.main_contractor || 'Silver Foundation Contracting Company',
        certificate_issue_date: new Date().toISOString().slice(0, 10),
        prepared_by: currentUserName(),
        handover_status: 'In Progress',
        certificate_body_text: DEFAULT_CERT_BODY,
      });
      setItems((prev) => [...prev, res.data]);
    } catch {
      setError('Unable to create the completion certificate draft. Please try again.');
    } finally { setIsSaving(false); }
  };

  const initializeCloseoutItems = async () => {
    if (!canEdit) return;
    setIsSaving(true); setError('');
    try {
      const res = await api.post('/handover/initialize', { project_id: project.id });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setError('Unable to initialize the standard closeout items. Please try again.');
    } finally { setIsSaving(false); }
  };

  const generateCertificatePdf = async () => {
    if (!certificateItem) return;
    try {
      const res = await api.get(`/pdf/handover/${project.id}/completion-certificate`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch {
      setError('Unable to open the completion certificate preview. Please try again.');
    }
  };

  const markClosed = async () => {
    if (!certificateItem || !window.confirm('Mark this project as Closed?')) return;
    setIsSaving(true); setError('');
    try { await api.patch(`/projects/${project.id}`, { status: 'Closed' }); await load(); }
    catch { setError('Unable to close the project. Please verify certificate readiness and try again.'); }
    finally { setIsSaving(false); }
  };

  if (loading) return <div className="handover-loading"><div className="handover-loading-card"><span />Loading handover closeout control center...</div></div>;

  return <div className="handover-page handover-modern">
    {error && <div className="handover-error">{error}</div>}
    {!canEdit && <div className="qms-readonly-banner mb-4">Read-only access: create, edit, issue, and upload actions are hidden for this role.</div>}

    <header className="handover-hero">
      <div className="handover-hero-main">
        <div className="handover-eyebrow">Internal QMS Closeout Control</div>
        <h1>Handover & Closeout Control</h1>
        <p>Internal closeout readiness, snag tracking, certificates, and final evidence control.</p>
        <div className="handover-project-pill"><strong>{project.name || 'Not recorded'}</strong><span>{project.code || 'No project code'}</span></div>
      </div>
      <div className="handover-hero-side">
        <div className="handover-hero-indicators">
          <FieldValue label="Overall Handover" value={`${overallPct}%`} />
          <FieldValue label="Open Snags" value={snagCounts.Open || 0} />
          <FieldValue label="Completion Certificate" value={completionStatus} chip />
          <FieldValue label="Handover Certificate" value={handoverCertStatus} chip />
        </div>
        <div className="handover-hero-actions">
          <button type="button" onClick={load} className="handover-btn secondary" disabled={isSaving}>Refresh</button>
          {canEdit && <button type="button" className="handover-btn primary" disabled={isSaving} onClick={createSnag}>Add Snag Item</button>}
          {canEdit && !certificateItem && <button type="button" className="handover-btn gold" disabled={isSaving} onClick={createCertificate}>Create Completion Certificate</button>}
        </div>
      </div>
    </header>

    <KpiStrip
      totalCloseoutItems={totalCloseoutItems}
      snagCounts={snagCounts}
      completionStatus={completionStatus}
      handoverCertStatus={handoverCertStatus}
      missingEvidence={missingEvidence}
    />

    <ExecutiveSummary
      overallPct={overallPct}
      docPct={docPct}
      pkgPct={pkgPct}
      disciplinesReady={disciplinesReady}
      disciplineTotal={DISCIPLINES.length}
      verifiedDocs={readinessCount}
      docsTotal={totalCloseoutItems}
      pkgApproved={packageCompletenessCount}
      pkgTotal={totalCloseoutItems}
    />

    <HandoverItems
      selectedDisc={selectedDisc}
      setSelectedDisc={setSelectedDisc}
      filteredDiscs={filteredDiscs}
      byKey={byKey}
      getDiscStats={getDiscStats}
      isApplicable={isApplicable}
      getEvidenceState={getEvidenceState}
      saveItem={saveItem}
      canEdit={canEdit}
      isSaving={isSaving}
      onInitialize={initializeCloseoutItems}
      hasStandardItems={standardItems.length > 0}
    />

    <SnagSection snags={filteredSnags} counts={snagCounts} filters={snagFilters} setFilters={setSnagFilters} onAdd={createSnag} onSave={saveItem} canEdit={canEdit} isSaving={isSaving} />
    <CompletionCertificate item={certificateItem} project={project} snags={snagRegister} saveItem={saveItem} canEdit={canEdit} isSaving={isSaving} onMarkClosed={markClosed} load={load} onCreate={createCertificate} onPreview={generateCertificatePdf} />
    <HandoverCertificate item={certificateItem} saveItem={saveItem} canEdit={canEdit} isSaving={isSaving} load={load} onPreview={generateCertificatePdf} />
  </div>;
}

function KpiStrip({ totalCloseoutItems, snagCounts, completionStatus, handoverCertStatus, missingEvidence }) {
  const kpis = [
    ['Total Closeout Items', totalCloseoutItems, 'neutral', 'Applicable'],
    ['Open Snags', snagCounts.Open || 0, (snagCounts.Open || 0) ? 'danger' : 'success', (snagCounts.Open || 0) ? 'Open' : 'Closed'],
    ['Rectified Snags', snagCounts.Rectified || 0, 'warning', 'Rectified'],
    ['Closed Snags', snagCounts.Closed || 0, 'success', 'Closed'],
    ['Completion Certificate', completionStatus, statusTone(completionStatus), completionStatus],
    ['Handover Certificate', handoverCertStatus, statusTone(handoverCertStatus), handoverCertStatus],
    ['Missing Evidence / Pending Docs', missingEvidence, missingEvidence ? 'warning' : 'success', missingEvidence ? 'Pending' : 'Closed'],
  ];
  return <section className="handover-kpi-strip">{kpis.map(([label, value, tone, chip]) => <div key={label} className="handover-kpi-card"><span>{label}</span><strong>{value}</strong><StatusChip tone={tone}>{chip}</StatusChip></div>)}</section>;
}

function ExecutiveSummary({ overallPct, docPct, pkgPct, disciplinesReady, disciplineTotal, verifiedDocs, docsTotal, pkgApproved, pkgTotal }) {
  const rows = [
    ['Overall Handover %', overallPct, `${disciplinesReady} of ${disciplineTotal} disciplines ready`],
    ['Document Readiness %', docPct, `${verifiedDocs} of ${docsTotal} applicable closeout documents ready`],
    ['Package Completeness %', pkgPct, `${pkgApproved} of ${pkgTotal} applicable packages approved or verified`],
  ];
  return <section className="handover-premium-card handover-summary-panel">
    <div className="handover-premium-title"><h3>Handover Dashboard / Summary</h3><p>Executive internal readiness panel for project closeout governance.</p></div>
    <div className="handover-summary-grid">
      {rows.map(([label, pct, note]) => <div className="handover-summary-metric" key={label}><div><span>{label}</span><strong>{pct}%</strong></div><ProgressBar value={pct} /><p>{note}</p></div>)}
      <div className="handover-summary-ready"><span>Disciplines Ready</span><strong>{disciplinesReady} / {disciplineTotal}</strong><p>Disciplines at 100% applicable package readiness.</p></div>
    </div>
  </section>;
}

function HandoverItems({ selectedDisc, setSelectedDisc, filteredDiscs, byKey, getDiscStats, isApplicable, getEvidenceState, saveItem, canEdit, isSaving, onInitialize, hasStandardItems }) {
  return <section className="handover-premium-card">
    <div className="handover-section-title-row"><div className="handover-premium-title"><h3>Handover Items / Closeout Requirements</h3><p>Final documents and evidence packages by discipline with internal approval status.</p></div>{canEdit && !hasStandardItems && <button type="button" className="handover-btn secondary" disabled={isSaving} onClick={onInitialize}>Initialize Closeout Items</button>}</div>
    <div className="handover-discipline-chips">
      <button type="button" onClick={() => setSelectedDisc('all')} className={`handover-chip ${selectedDisc === 'all' ? 'active' : ''}`}>All Disciplines</button>
      {DISCIPLINES.map((d) => <button type="button" key={d.key} onClick={() => setSelectedDisc(d.key)} className={`handover-chip ${selectedDisc === d.key ? 'active' : ''}`}><span>{d.label}</span><b>{getDiscStats(d.key).pct}%</b></button>)}
    </div>
    {filteredDiscs.length ? filteredDiscs.map((disc) => {
      const stats = getDiscStats(disc.key);
      const rows = HANDOVER_PACKAGES.map((label) => byKey.get(makeKey(disc.key, label))).filter(Boolean);
      return <section key={disc.key} className="handover-discipline-card">
        <div className="handover-discipline-head"><div><h3>{disc.label}</h3><div className="handover-discipline-sub">{stats.pct}% ready · {stats.approved}/{stats.applicable} applicable packages ready</div></div><div className="handover-discipline-metrics"><span>Applicable {stats.applicable}</span><span>Approved {stats.approved}</span><span>Pending {stats.pending}</span></div></div>
        <ProgressBar value={stats.pct} />
        {rows.length ? <div className="handover-items-table-wrap"><table className="handover-items-table"><thead><tr><th>Item</th><th>Required Evidence</th><th>Status</th><th>Action</th></tr></thead><tbody>{HANDOVER_PACKAGES.map((label) => {
          const item = byKey.get(makeKey(disc.key, label));
          if (!item) return null;
          const applicable = isApplicable(item);
          const evidenceState = getEvidenceState(item);
          const linkedDoc = evidenceState.linkedDocs.find((doc) => isApprovedDocument(doc) || isVerifiedDocument(doc)) || evidenceState.linkedDocs[0];
          const evidenceLabel = !applicable ? 'Not applicable' : item.attachment_id ? 'Evidence uploaded' : linkedDoc ? `Linked: ${linkedDoc.ref || linkedDoc.title}` : 'Evidence not recorded';
          return <tr key={label} className={!applicable ? 'is-muted' : ''}><td><span className="handover-item-name">{label}</span><small>{item.remarks || 'No remarks recorded'}</small></td><td><StatusChip tone={applicable ? 'neutral' : 'warning'}>{applicable ? 'Applicable' : 'Not Applicable'}</StatusChip><small>{evidenceLabel}</small></td><td><StatusChip>{evidenceState.status}</StatusChip></td><td>{canEdit ? <div className="handover-table-actions"><div className="handover-applicability"><button type="button" className={`app-toggle ${applicable ? 'active' : ''}`} disabled={isSaving} onClick={() => saveItem(item, { is_applicable: 1, status: item.status === 'not_applicable' ? 'pending' : item.status })}>Applicable</button><button type="button" className={`app-toggle ${!applicable ? 'active not-app' : 'not-app'}`} disabled={isSaving} onClick={() => saveItem(item, { is_applicable: 0, status: 'not_applicable' })}>N/A</button></div><select className="handover-select" disabled={isSaving || !applicable} value={applicable ? (item.status || 'pending') : 'not_applicable'} onChange={(e) => saveItem(item, { status: e.target.value, approved_by: e.target.value === 'approved' ? currentUserName() : item.approved_by, approved_date: e.target.value === 'approved' ? new Date().toISOString() : item.approved_date })}><option value="pending">Pending</option><option value="uploaded">Uploaded</option><option value="in_review">In Review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="not_applicable">Not Applicable</option><option value="closed">Closed</option></select><HandoverUpload item={item} onSave={saveItem} disabled={isSaving || !applicable} canRead /></div> : <span className="handover-action-placeholder">Read only</span>}</td></tr>;
        })}</tbody></table></div> : <div className="handover-empty-state">No closeout requirement items are recorded for this discipline.</div>}
      </section>;
    }) : <div className="handover-empty-state">No handover disciplines are available.</div>}
  </section>;
}

function SnagSection({ snags, counts, filters, setFilters, onAdd, onSave, canEdit, isSaving }) {
  return <section className="handover-premium-card">
    <div className="handover-section-title-row"><div className="handover-premium-title"><h3>Snag List / Punch List</h3><p>Professional tracking register for defects, rectification, internal owners, evidence, and closure remarks.</p></div>{canEdit && <button type="button" className="handover-btn primary" disabled={isSaving} onClick={onAdd}>Add Snag Item</button>}</div>
    <div className="handover-summary-chips">{['Total', 'Open', 'In Progress', 'Rectified', 'Closed'].map((key) => <span key={key}><b>{counts[key] || 0}</b>{key}</span>)}</div>
    <div className="handover-filter-bar"><select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">All Statuses</option>{SNAG_STATUSES.map((s) => <option key={s}>{s}</option>)}</select><select value={filters.discipline} onChange={(e) => setFilters((f) => ({ ...f, discipline: e.target.value }))}><option value="">All Disciplines</option><option value="general">General / Other</option>{DISCIPLINES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select><select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}><option value="">All Priorities</option>{SNAG_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select><input type="search" placeholder="Search snags, owners, locations..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></div>
    <div className="handover-table-shell"><table className="handover-register-table"><thead><tr><th>No.</th><th>Area / Location</th><th>Discipline / Work Package</th><th>Description</th><th>Priority</th><th>Responsible Internal Owner</th><th>Target Date</th><th>Status</th><th>Evidence</th><th>Remarks</th><th>Action</th></tr></thead><tbody>{snags.length ? snags.map((snag) => <tr key={snag.id}><EditableCell item={snag} field="snag_item_no" onSave={onSave} disabled={!canEdit || isSaving} displayClass="handover-normal-text" /><EditableCell item={snag} field="area_location" onSave={onSave} disabled={!canEdit || isSaving} /><td><SelectCell value={snag.discipline || 'general'} disabled={!canEdit || isSaving} onChange={(value) => onSave(snag, { discipline: value })} options={[['general', 'General / Other'], ...DISCIPLINES.map((d) => [d.key, d.label])]} /></td><EditableCell item={snag} field="description" fallbackField="remarks" onSave={onSave} disabled={!canEdit || isSaving} textarea /><td><SelectCell value={snag.priority || 'Medium'} disabled={!canEdit || isSaving} onChange={(value) => onSave(snag, { priority: value })} options={SNAG_PRIORITIES.map((p) => [p, p])} chipTone={snag.priority === 'Critical' || snag.priority === 'High' ? 'danger' : 'warning'} /></td><EditableCell item={snag} field="responsible_owner" onSave={onSave} disabled={!canEdit || isSaving} /><EditableCell item={snag} field="target_date" onSave={onSave} disabled={!canEdit || isSaving} type="date" /><td><SelectCell value={snag.status || 'Open'} disabled={!canEdit || isSaving} onChange={(value) => onSave(snag, { status: value })} options={SNAG_STATUSES.map((s) => [s, s])} /></td><EditableCell item={snag} field="evidence_reference" onSave={onSave} disabled={!canEdit || isSaving} /><EditableCell item={snag} field="remarks" onSave={onSave} disabled={!canEdit || isSaving} textarea /><td><span className="handover-action-placeholder">{canEdit ? 'Edit inline' : 'Read only'}</span></td></tr>) : <tr><td className="handover-empty-cell" colSpan="11">No snag / punch items recorded. Use “Add Snag Item” when defects or pending works are identified.</td></tr>}</tbody></table></div>
  </section>;
}

function SelectCell({ value, options, disabled, onChange, chipTone }) {
  if (disabled) return <StatusChip tone={chipTone}>{prettyStatus(value)}</StatusChip>;
  return <select className="handover-cell-control" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}</select>;
}

function EditableCell({ item, field, fallbackField, onSave, disabled, textarea = false, type = 'text', displayClass = '' }) {
  const value = item[field] ?? (fallbackField ? item[fallbackField] : '') ?? '';
  if (disabled) return <td><span className={displayClass}>{type === 'date' ? fmtDate(value) : (value || 'Not recorded')}</span></td>;
  const props = { className: 'handover-cell-control', defaultValue: value, disabled, onBlur: (e) => e.target.value !== value && onSave(item, { [field]: e.target.value }) };
  return <td>{textarea ? <textarea {...props} rows="2" /> : <input {...props} type={type} />}</td>;
}

function CompletionCertificate({ item, project, snags, saveItem, canEdit, isSaving, onMarkClosed, load, onCreate, onPreview }) {
  if (!item) return <section className="handover-premium-card"><div className="handover-certificate-empty"><div><div className="handover-premium-title"><h3>Completion Certificate</h3><p>No Completion Certificate has been created for this project yet.</p></div><p>Create a controlled internal certificate draft when closeout records are ready for certification.</p></div>{canEdit && <button type="button" className="handover-btn gold" disabled={isSaving} onClick={onCreate}>Create Completion Certificate</button>}</div></section>;
  const snagSummary = `Total: ${snags.length}; Open: ${snags.filter((s) => s.status === 'Open').length}; In Progress: ${snags.filter((s) => s.status === 'In Progress').length}; Rectified: ${snags.filter((s) => s.status === 'Rectified').length}; Closed: ${snags.filter((s) => s.status === 'Closed').length}`;
  const auto = { project_name: project.name || '', project_code: project.code || '', client_name: project.client || '', contractor_name: project.main_contractor || 'Silver Foundation Contracting Company', site_location: project.location || '', contract_number: project.contract_no || '', certificate_issue_date: item.certificate_issue_date || new Date().toISOString().slice(0, 10), snag_status_summary: item.snag_status_summary || snagSummary, handover_status: item.handover_status || 'In Progress', prepared_by: item.prepared_by || currentUserName() };
  const canClose = Number(item.certificate_issued || 0) === 1 && Number(item.certificate_uploaded || 0) === 1 && (item.certificate_approved || 'Not Approved') === 'Approved';
  const status = Number(item.certificate_issued || 0) ? 'Issued' : 'Draft';
  const renderField = ([field, label, type = 'text', rows = 2]) => {
    const value = item[field] || auto[field] || '';
    const savePatch = (nextValue) => nextValue !== value && saveItem(item, { [field]: nextValue });
    return <label key={field} className={type === 'textarea' ? 'handover-cert-field span-2' : 'handover-cert-field'}>{label}{type === 'textarea'
      ? <textarea rows={rows} defaultValue={value} disabled={isSaving || !canEdit} onBlur={(e) => savePatch(e.target.value)} />
      : <input type={type === 'date' ? 'date' : 'text'} defaultValue={value} disabled={isSaving || !canEdit} onBlur={(e) => savePatch(e.target.value)} />}</label>;
  };
  const projectFields = [['project_name','Project Name'], ['project_code','Project Code'], ['client_name','Client / Employer'], ['contractor_name','Main Contractor'], ['site_location','Location'], ['contract_number','Contract No.']];
  const detailFields = [['certificate_title','Completion Certificate No.'], ['certificate_issue_date','Certificate Date','date'], ['handover_status','Handover Status']];
  const narrativeFields = [['scope_completed_summary','Scope Completed Summary','textarea',3], ['outstanding_items','Outstanding Items / Exceptions','textarea',3], ['snag_status_summary','Snag Status Summary','textarea',3], ['certificate_remarks','Remarks','textarea',3], ['signed_evidence_reference','Signed / Approved Evidence Ref.']];
  return <section className="handover-premium-card">
    <div className="handover-cert-header"><div className="handover-premium-title"><h3>Completion Certificate</h3><p>Controlled internal QMS completion workflow for certificate drafting, issue, print preview, and signed evidence retention.</p></div><StatusChip>{status}</StatusChip></div>
    <div className="handover-cert-overview"><FieldValue label="Certificate No." value={item.certificate_title || 'Not recorded'} /><FieldValue label="Certificate Date" value={fmtDate(item.certificate_issue_date || auto.certificate_issue_date)} /><FieldValue label="Prepared By" value={item.prepared_by || auto.prepared_by} /><FieldValue label="Approved Internally By" value={item.internally_approved_by || 'Not recorded'} /><FieldValue label="Internal Approval" value={item.certificate_approved || 'Not Approved'} chip /><FieldValue label="Signed Evidence" value={item.certificate_uploaded ? 'Uploaded' : 'Not Recorded'} chip /></div>
    <div className="handover-cert-layout">
      <div className="handover-cert-block"><h4>Project Information</h4><div className="handover-cert-grid">{projectFields.map(renderField)}</div></div>
      <div className="handover-cert-block"><h4>Certificate Details</h4><div className="handover-cert-grid">{detailFields.map(renderField)}<label className="handover-cert-field">Issue Status<select value={status} disabled={isSaving || !canEdit} onChange={(e) => saveItem(item, { certificate_issued: e.target.value === 'Issued' ? 1 : 0, certificate_issue_date: e.target.value === 'Issued' ? new Date().toISOString().slice(0, 10) : item.certificate_issue_date })}><option>Draft</option><option>Issued</option></select></label><label className="handover-cert-field">Internal Approval Status<select value={item.certificate_approved || 'Not Approved'} disabled={isSaving || !canEdit} onChange={(e) => saveItem(item, { certificate_approved: e.target.value })}><option>Not Approved</option><option>Approved</option><option>Rejected</option></select></label></div></div>
      <div className="handover-cert-block"><h4>Narrative Fields</h4><div className="handover-cert-grid narrative">{narrativeFields.map(renderField)}</div></div>
      <label className="handover-body-field">Editable Certificate Body Text<textarea defaultValue={item.certificate_body_text || DEFAULT_CERT_BODY} disabled={!canEdit || isSaving} onBlur={(e) => e.target.value !== (item.certificate_body_text || DEFAULT_CERT_BODY) && saveItem(item, { certificate_body_text: e.target.value })} /></label>
    </div>
    <div className="handover-workflow-actions">{canEdit && <button type="button" className="handover-btn secondary" disabled={isSaving} onClick={() => saveItem(item, { certificate_body_text: item.certificate_body_text || DEFAULT_CERT_BODY, snag_status_summary: item.snag_status_summary || snagSummary, prepared_by: item.prepared_by || currentUserName() })}>Save Draft</button>}{canEdit && <button type="button" className="handover-btn gold" disabled={isSaving} onClick={() => saveItem(item, { certificate_issued: 1, certificate_issue_date: new Date().toISOString().slice(0, 10) })}>Issue Certificate</button>}<button type="button" className="handover-btn secondary" onClick={onPreview}>Print / Preview</button><HandoverUpload item={item} onSave={saveItem} disabled={isSaving || !canEdit} label="Upload Signed Evidence" forceCertificate load={load} canRead />{canEdit && <button type="button" className="handover-btn secondary" disabled={!canClose || isSaving} onClick={onMarkClosed}>Mark Project Closed</button>}</div>
  </section>;
}

function HandoverCertificate({ item, saveItem, canEdit, isSaving, load, onPreview }) {
  return <section className="handover-premium-card"><div className="handover-cert-header"><div className="handover-premium-title"><h3>Handover Certificate</h3><p>Final handover certificate status and signed evidence control remain linked to the existing certificate workflow.</p></div><StatusChip>{item?.certificate_uploaded ? 'Evidence Uploaded' : 'Not Recorded'}</StatusChip></div>
    {item ? <div className="handover-cert-overview"><FieldValue label="Handover Certificate No." value={item.certificate_title || 'Not recorded'} /><FieldValue label="Certificate Date" value={fmtDate(item.certificate_issue_date)} /><FieldValue label="Final Handover Status" value={item.handover_status || 'Not recorded'} chip /><FieldValue label="Evidence Upload Status" value={item.certificate_uploaded ? 'Uploaded' : 'Not Recorded'} chip /><div className="handover-inline-actions"><button type="button" className="handover-btn secondary" onClick={onPreview}>Open / Preview</button><button type="button" className="handover-btn secondary" onClick={onPreview}>Print</button><HandoverUpload item={item} onSave={saveItem} disabled={isSaving || !canEdit} label="Upload Signed Evidence" forceCertificate load={load} canRead /></div></div> : <div className="handover-empty-state">Handover certificate details are not recorded yet.</div>}
  </section>;
}



function HandoverUpload({ item, onSave, disabled, label = 'Upload document', canRead = false, forceCertificate = false, load }) {
  const fileRef = useRef();
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);
  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file || !item) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadError(''); setBusy(true);
    try {
      const res = await api.post(`/handover/${item.id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await onSave(item, { status: item.category === 'snagging' ? (item.status || 'Open') : 'uploaded', uploaded_by: currentUserName(), upload_date: res.data?.upload_date || new Date().toISOString(), ...(forceCertificate ? { certificate_uploaded: 1, certificate_upload_date: new Date().toISOString() } : {}) });
      if (load) await load();
    } catch { setUploadError('Unable to upload the evidence file. Please try again.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function openAttachment(download=false) {
    if (!canRead) return;
    setUploadError(''); setBusy(true);
    try {
      const res = await api.get(`/handover/${item.id}/file/${download ? 'download' : 'view'}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (download) { const a = document.createElement('a'); a.href = url; a.download = 'handover-document'; document.body.appendChild(a); a.click(); a.remove(); }
      else { window.open(url, '_blank', 'noopener,noreferrer'); }
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch { setUploadError('Unable to open the evidence file.'); }
    finally { setBusy(false); }
  }
  if (!item) return <span className="text-xs text-slate-400">n/a</span>;
  const hasAttachment = Boolean(item.attachment_id || item.certificate_attachment_id);
  return <div className="handover-actions"><div className="handover-action-wrap">{!disabled && <><button type="button" disabled={busy} onClick={() => fileRef.current.click()} className="handover-upload-btn">{label}</button><input ref={fileRef} type="file" className="hidden" onChange={handleFile} /></>}{hasAttachment && canRead && <><button type="button" disabled={busy} className="handover-link-btn" onClick={() => openAttachment(false)}>View</button><button type="button" disabled={busy} className="handover-link-btn" onClick={() => openAttachment(true)}>Download</button></>}{disabled && !hasAttachment && <span className="handover-action-placeholder">No evidence</span>}</div>{uploadError && <div className="text-[11px] text-red-600 mt-1">{uploadError}</div>}</div>;
}
