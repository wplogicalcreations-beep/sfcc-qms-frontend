import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { getCurrentUser } from '../utils/permissions';

const DEFAULT_CFG = { layout_version:'TR_VISUAL_V1', rows:10, show_project_fields:['project_name','project_no','contract_no','client','main_contractor','consultant','location','date_issued','discipline','pmc','response_due','area_zone'], show_document_columns:['no','reference','rev','title','copies','remarks'], signature_columns:['contractor','recipient','authorized'], footer_copies:['Original: Client / Employer','Copy: Consultant','Copy: Project Manager','Copy: Contractor QC File'], labels:{ clientLabel:'CLIENT / EMPLOYER', consultantLabel:'CONSULTANT / ENGINEER', companyName:'SILVER FOUNDATION CONTRACTING COMPANY', subtitle:'Engineering & Construction - Quality Management System', formTitle:'TRANSMITTAL' } };
const FIELD_OPTIONS = [
  { key: 'project_name', label: 'Project Name' }, { key: 'project_no', label: 'Project No.' }, { key: 'contract_no', label: 'Contract No.' },
  { key: 'client', label: 'Client / Employer' }, { key: 'main_contractor', label: 'Main Contractor' }, { key: 'consultant', label: 'Consultant' },
  { key: 'location', label: 'Location / Site' }, { key: 'date_issued', label: 'Date Issued' }, { key: 'discipline', label: 'Discipline' },
  { key: 'pmc', label: 'PMC' }, { key: 'response_due', label: 'Response Due' }, { key: 'area_zone', label: 'Area / Zone' }
];
const SAMPLE_DOC_TITLES = ['Shop Drawing Package','Material Submittal Package','Method Statement','Inspection Checklist','Test Report','Manufacturer Data Sheet','Compliance Statement','As-Built Drawing Package','O&M Manual','Warranty Certificate'];
const statusTone = (status) => status === 'Approved' ? 'chip-good' : status === 'Draft' ? 'chip-warn' : 'chip-muted';

export default function QmsTemplateLibrary() {
  const [items, setItems] = useState([]); const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [showArchived, setShowArchived] = useState(false); const [previewZoom, setPreviewZoom] = useState('fit');
  const role = (getCurrentUser()?.role || '').toLowerCase();
  const isAdmin = role === 'system_admin';

  const load = async () => {
    try { setLoading(true); setError(''); const { data } = await api.get('/qms-form-templates'); setItems(data || []); }
    catch (e) { setError(e?.response?.data?.error || 'Unable to load templates. Please refresh and try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = async (id) => { const { data } = await api.get(`/qms-form-templates/${id}`); const p = data.placeholders_json ? JSON.parse(data.placeholders_json) : {}; setSelected({ ...data, visual_config: { ...DEFAULT_CFG, ...p, labels: { ...DEFAULT_CFG.labels, ...(p.labels || {}) } } }); };
  const updateCfg = (patch) => setSelected((p) => ({ ...p, visual_config: { ...p.visual_config, ...patch } }));
  const save = async (statusOverride) => { const payload = { ...selected, status: statusOverride || selected.status, placeholders_json: JSON.stringify(selected.visual_config), template_key: 'controlled_transmittal_a4_v5', revision: 'R4', is_active: 1 }; await api.put(`/qms-form-templates/${selected.id}`, payload); await load(); await open(selected.id); alert(statusOverride === 'Approved' ? 'Template marked as approved.' : 'Draft saved.'); };
  const sample = async (id) => { const r = await api.post(`/qms-form-templates/${id}/sample-pdf`, {}, { responseType: 'blob' }); const u = URL.createObjectURL(r.data); window.open(u, '_blank'); };
  const resetToProfessionalDefault = () => {
    if (!selected) return;
    setSelected((prev) => ({
      ...prev,
      visual_config: DEFAULT_CFG,
    }));
  };

  const kpis = useMemo(() => ({ total: items.length, approved: items.filter((i) => i.status === 'Approved').length, active: items.filter((i) => Number(i.is_active) === 1).length, draft: items.filter((i) => i.status !== 'Approved' || Number(i.is_active) !== 1).length }), [items]);
  const activeTemplates = items.filter((i) => Number(i.is_active) === 1 && i.status === 'Approved');
  const archivedTemplates = items.filter((i) => !(Number(i.is_active) === 1 && i.status === 'Approved'));

  if (loading) return <div className='modern-page'><section className='modern-section qms-empty-state'>Loading controlled template library…</section></div>;
  if (error) return <div className='modern-page'><section className='modern-section qms-error-state'><h3>Template library unavailable</h3><p>{error}</p><button type='button' className='btn-secondary mt-3' onClick={load}>Retry</button></section></div>;

  return <div className='modern-page'>
    <section className='modern-hero'>
      <div><h1>Controlled QMS Form Templates</h1><p>Manage approved form templates used for controlled PDF generation.</p><p className='text-xs mt-2'>Templates control PDF layout only. Actual document data is entered from Document Control when creating or opening a document.</p></div>
      <div className='qms-action-row'>
        {selected && <button type='button' className='btn-primary' onClick={() => sample(selected.id)}>Generate Sample PDF</button>}
        {selected && <button type='button' className='btn-secondary' onClick={() => sample(selected.id)}>Open Full Preview</button>}
        <a className='btn-secondary inline-flex items-center' href='/dashboard'>Back to Dashboard</a>
      </div>
    </section>

    <section className='modern-kpi-grid'>{[
      ['Total Templates', kpis.total, 'All versions in library'], ['Approved', kpis.approved, 'Ready for controlled usage'], ['Active', kpis.active, 'Current approved version'], ['Draft / Inactive', kpis.draft, 'Needs review or archived']
    ].map(([label, val, helper]) => <div key={label} className='modern-kpi-card'><label>{label}</label><strong>{val}</strong><span>{helper}</span></div>)}</section>

    <section className='modern-section qms-table-scroll'>
      <h2 className='mb-3 font-semibold'>Current Active Templates</h2>
      {activeTemplates.length === 0 ? <div className='qms-empty-state'>No active approved template is available yet.</div> : <table className='qms-table'><thead><tr><th>Template Name</th><th>Document Type</th><th>Revision</th><th>Status</th><th>Active</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>{activeTemplates.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.document_type}</td><td>{t.revision}</td><td><span className={`modern-chip ${statusTone(t.status)}`}>{t.status}</span></td><td><span className='modern-chip chip-active'>{t.is_active ? 'Active':'Inactive'}</span></td><td>{new Date(t.updated_at).toLocaleString()}</td><td><div className='qms-action-row'><button type='button' className='btn-secondary' onClick={() => open(t.id)}>View Template</button><button type='button' className='btn-secondary' onClick={() => sample(t.id)}>Generate Sample PDF</button><button type='button' className='btn-primary' onClick={() => sample(t.id)}>Open Preview</button></div></td></tr>)}</tbody></table>}
    </section>

    <section className='modern-section qms-table-scroll'>
      <button type='button' className='qms-collapse-btn' onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide' : 'Show'} Version History / Archived Templates</button>
      {showArchived && <table className='qms-table mt-3'><thead><tr><th>Template Name</th><th>Document Type</th><th>Revision</th><th>Status</th><th>Active</th><th>Last Updated</th></tr></thead><tbody>{archivedTemplates.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.document_type}</td><td>{t.revision}</td><td><span className={`modern-chip ${statusTone(t.status)}`}>{t.status}</span></td><td><span className={`modern-chip ${t.is_active ? 'chip-active' : 'chip-muted'}`}>{t.is_active ? 'Active':'Inactive'}</span></td><td>{new Date(t.updated_at).toLocaleString()}</td></tr>)}</tbody></table>}
    </section>

    {selected && <section className='modern-section space-y-4'><h2>Visual Controlled-Form Template Builder</h2>
      <div className='qms-info-banner'>
        <p>Template Builder controls the approved PDF layout only. To fill actual project document data, open the document from Document Control.</p>
        <small>Project information is auto-filled from Project Setup. Document-specific fields are entered inside the document drawer.</small>
      </div>
      <div className='qms-builder-grid'>
        <div className='space-y-3'>
          <div className='modern-card space-y-2'><h3 className='font-semibold'>Template Metadata</h3><div className='qms-meta-grid text-xs'><div><b>Name:</b> {selected.title}</div><div><b>Doc Type:</b> {selected.document_type}</div><div><b>Revision:</b> R4</div><div><b>Status:</b> {selected.status}</div></div></div>
          <div className='modern-card space-y-2'><h3 className='font-semibold'>Template Header Settings</h3><p className='qms-builder-helper'>These settings affect the PDF template layout, not the live document values.</p><input className='input' value={selected.visual_config.labels.companyName} onChange={(e)=>updateCfg({labels:{...selected.visual_config.labels,companyName:e.target.value}})} /><input className='input' value={selected.visual_config.labels.subtitle} onChange={(e)=>updateCfg({labels:{...selected.visual_config.labels,subtitle:e.target.value}})} /><input className='input' value={selected.visual_config.labels.formTitle} onChange={(e)=>updateCfg({labels:{...selected.visual_config.labels,formTitle:e.target.value}})} /></div>
          <div className='modern-card space-y-2'><h3 className='font-semibold'>Fields Visible in PDF Layout</h3><p className='qms-builder-helper'>These settings affect the PDF template layout, not the live document values.</p><div className='qms-field-grid'>{FIELD_OPTIONS.map((f)=><label key={f.key} className='qms-field-chip'><input type='checkbox' checked={selected.visual_config.show_project_fields.includes(f.key)} onChange={() => { const s = new Set(selected.visual_config.show_project_fields); s.has(f.key) ? s.delete(f.key) : s.add(f.key); updateCfg({ show_project_fields: Array.from(s) }); }} /><span>{f.label}</span></label>)}</div></div>
          <div className='modern-card space-y-2'><h3 className='font-semibold'>PDF Table Layout Settings</h3><p className='qms-builder-helper'>These settings affect the PDF template layout, not the live document values.</p><div><label className='label'>Blank Rows Shown in PDF Table</label><select className='select' value={selected.visual_config.rows} onChange={(e)=>updateCfg({rows:Number(e.target.value)})}>{[10,11,12].map((n)=><option key={n}>{n}</option>)}</select></div></div>
        </div>
        <div className='modern-card'><div className='qms-preview-head'><div><h3 className='font-semibold'>Live Form Preview</h3><p>Approximate browser preview; final PDF generated from the same active template.</p></div><div className='qms-action-row'><button type='button' className={`btn-secondary text-xs ${previewZoom==='fit'?'active':''}`} onClick={() => setPreviewZoom('fit')}>Fit to Width</button><button type='button' className={`btn-secondary text-xs ${previewZoom==='75'?'active':''}`} onClick={() => setPreviewZoom('75')}>75%</button><button type='button' className={`btn-secondary text-xs ${previewZoom==='100'?'active':''}`} onClick={() => setPreviewZoom('100')}>100%</button><button type='button' className='btn-secondary text-xs' onClick={() => sample(selected.id)}>Open Large Preview</button><button type='button' className='btn-primary text-xs' onClick={() => sample(selected.id)}>Generate Sample PDF</button></div></div><div className='tr-live-preview-wrap'><div className={`tr-live-preview zoom-${previewZoom}`}>
          <div className='tr-pv-header'><div className='tr-pv-side'><b>CLIENT / EMPLOYER</b><span>ZIMMER</span></div><div className='tr-pv-center'><h4>{selected.visual_config.labels.companyName}</h4><p>{selected.visual_config.labels.subtitle}</p><h2>{selected.visual_config.labels.formTitle}</h2><small>Form No.: TR-FRM-001 | Revision: R4 | ISO 9001 Controlled Form</small></div><div className='tr-pv-side'><b>CONSULTANT / ENGINEER</b><span>BA</span></div></div>
          <div className='tr-pv-project'>{[['Project Name','ZIMMER HEAD OFFICE'],['Project No.','SFCC-2026-001'],['Contract No.','CNT-2026-TR-001'],['Client / Employer','ZIMMER'],['Main Contractor','SILVER FOUNDATION'],['Consultant','BA'],['Location / Site','RIYADH'],['Date Issued','2026-05-22'],['Discipline','Civil & Structural'],['PMC','BARRY'],['Response Due','2026-05-29'],['Area / Zone','HQ Zone A']].filter(([_, __], i) => selected.visual_config.show_project_fields.includes(FIELD_OPTIONS[i].key)).map(([k,v])=><div className='tr-pv-kv' key={k}><span className='k'>{k}</span><span>{v}</span></div>)}</div>
          <div className='tr-pv-sec'><label>1. TRANSMITTAL DETAILS</label><div className='tr-pv-details'>{[['Urgency','Routine'],['Purpose','For Review'],['From Company','Silver Foundation Contracting Co.'],['To Company','BA'],['Attention','Project Engineer'],['Subject','Sample Transmittal Submission']].map(([k,v])=><div key={k}><b>{k}</b><span>{v}</span></div>)}</div></div><div className='tr-pv-sec tr-doc'><label>2. TRANSMITTED DOCUMENTS</label><table><thead><tr><th>No.</th><th>Document No. / Reference</th><th>Rev.</th><th>Title / Description</th><th>Copies</th><th>Remarks</th></tr></thead><tbody>{Array.from({length:selected.visual_config.rows},(_,i)=><tr key={i}><td>{i+1}</td><td>{i<10?`SFCC-TR-2026-0${i+1}`:''}</td><td>{i<10?'R1':''}</td><td>{SAMPLE_DOC_TITLES[i] || ''}</td><td>{i<10?'1':''}</td><td>{i<10?'For review':''}</td></tr>)}</tbody></table></div><div className='tr-pv-comments'><div><b>Recipient Remarks / Comments</b></div><div><b>Contractor Response</b></div></div><div className='tr-pv-sign'><label>SIGNATURES & AUTHORIZATION</label><div className='cols'>{['Transmitted By / Contractor','Received By / Recipient','Authorized By'].map((s)=><div key={s}><h6>{s}</h6><p>Name & Title</p><p>Signature</p><p>Date</p><p>Stamp / Seal</p></div>)}</div></div><div className='tr-pv-foot'><span>☐ Original: Client / Employer &nbsp; ☐ Copy: Consultant &nbsp; ☐ Copy: Project Manager &nbsp; ☐ Copy: Contractor QC File</span><small>Template Engine: Professional DB Template TR v5</small></div>
        </div></div></div>
      </div>
      <div className='qms-action-row qms-builder-actions'>
        {isAdmin && (
          <button type='button' className='btn-secondary' onClick={() => save()}>
            Save Draft
          </button>
        )}
        {isAdmin && (
          <button type='button' className='btn-primary' onClick={() => save('Approved')}>
            Mark Approved
          </button>
        )}
        <button type='button' className='btn-secondary' onClick={() => sample(selected.id)}>
          Generate Sample PDF
        </button>
        <button
          type='button'
          className='btn-ghost'
          onClick={resetToProfessionalDefault}
        >
          Reset to Professional Default
        </button>
      </div>
    </section>}
  </div>;
}
