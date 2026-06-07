import { useState, useEffect } from 'react';
import { Badge, TypeBadge, fmtDate, fmtSAR, WORKFLOW_STATUSES, APPROVAL_STATUSES, EVIDENCE_STATUSES } from '../utils/helpers.jsx';
import api from '../utils/api';
import FormViewer from './FormViewer.jsx';
import DocumentTypeForm from './DocumentTypeForm.jsx';
import FileUploader from './FileUploader.jsx';
import { canEdit, canApprove, canUpload, canPerform } from '../utils/permissions';
import { userSafeError } from '../utils/uiMessages';

export default function DocDrawer({ doc, project, onClose, onUpdated }) {
  const [tab, setTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [attachments, setAttachments] = useState(doc.attachments || []);
  const [stakeholders, setStakeholders] = useState([]);
  const [pdfActionLoading, setPdfActionLoading] = useState(null);
  const parsedFormData = (() => { try { return doc?.form_data ? JSON.parse(doc.form_data) : {}; } catch { return {}; } })();
  const projectInfo = [
    ['Project Name', project?.name], ['Project Code / No.', project?.code], ['Contract No.', project?.contract_no],
    ['Client / Employer', project?.client], ['Main Contractor', 'Silver Foundation Contracting Company'], ['Consultant', project?.consultant],
    ['PMC', project?.pmc], ['Location / Site', project?.location], ['Contract Value', project?.contract_value],
    ['Project Start Date', project?.start_date], ['Target Completion Date', project?.target_completion_date || project?.end_date]
  ];
  const [docForm, setDocForm] = useState(parsedFormData || {});
  const allowEdit = canEdit('documents');
  const allowApprove = canApprove('approvals');
  const allowUpload = canUpload('documents');
  const allowIssue = canPerform('documents.issue');
  const allowClose = canPerform('documents.close');

  useEffect(() => {
    if (project?.id) {
      api.get(`/projects/${project.id}/stakeholders`).then(r => setStakeholders(r.data)).catch(() => {});
    }
  }, [project?.id]);

  if (!doc) return null;

  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function updateField(field, value) {
    setSaving(true);
    try {
      await api.patch(`/documents/${doc.id}`, { [field]: value });
      const { data } = await api.get(`/documents/${doc.id}`);
      onUpdated?.(data);
      window.dispatchEvent(new CustomEvent('qms:notifications-refresh'));
      showToast('Updated successfully');
    } catch (e) {
      showToast(userSafeError(e, 'This record could not be saved. Please check the required fields and try again.'), 'error');
    } finally { setSaving(false); }
  }
  async function saveDocForm() {
    if (!allowEdit) return;
    await updateField('form_data', JSON.stringify(docForm || {}));
  }



  function extractFilenameFromDisposition(contentDisposition, fallbackRef) {
    const fallback = `${(fallbackRef || 'controlled-document').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
    if (!contentDisposition) return fallback;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback;
  }

  async function requestControlledPdf(mode) {
    try {
      setPdfActionLoading(mode);
      const pdfEndpointByType = {
        MS: 'material-submittal',
        DS: 'drawing-submittal',
        RFI: 'rfi',
        IR: 'inspection-request',
        NCR: 'ncr',
        TR: 'transmittal',
        SI: 'site-instruction',
      };
      const endpointSlug = pdfEndpointByType[doc.type];
      if (!endpointSlug) return showToast('PDF template not available for this document type.', 'error');
      const endpoint = `/pdf/documents/${doc.id}/${endpointSlug}`;
      const token = localStorage.getItem('sfcc_token');
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const response = await fetch(`${apiBase}${endpoint}?mode=${mode}`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const responseBuffer = await response.arrayBuffer();

      if (!response.ok) {
        const errorText = new TextDecoder().decode(new Uint8Array(responseBuffer));
        throw new Error(errorText || `Request failed with status ${response.status || 'unknown'}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        const errorText = new TextDecoder().decode(new Uint8Array(responseBuffer));
        throw new Error(errorText || 'Server did not return a PDF.');
      }

      const pdfBlob = new Blob([responseBuffer], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(pdfBlob);

      if (mode === 'view') {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
      } else {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = extractFilenameFromDisposition(response.headers.get('content-disposition'), doc.ref);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) return showToast('not authorized', 'error');
      if (status === 404) return showToast('document not found', 'error');
      const rawMessage = e?.message || '';
      let readable = rawMessage;
      try {
        const parsed = JSON.parse(rawMessage);
        readable = parsed?.error || rawMessage;
      } catch {}
      showToast(`PDF generation failed. Please check backend logs.${readable ? ` ${readable}` : ''}`, 'error');
    } finally {
      setPdfActionLoading(null);
    }
  }

  async function reloadAttachments() {
    const { data } = await api.get(`/documents/${doc.id}`);
    setAttachments(data.attachments || []);
    onUpdated?.(data);
    window.dispatchEvent(new CustomEvent('qms:notifications-refresh'));
    showToast('File uploaded');
  }

  const TABS = ['details', 'form-data', 'workflow', 'files', 'history'];

  return (
    <>
      <div className="doc-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="doc-drawer-panel">

          {/* Header */}
          <div className="doc-drawer-header px-5 py-4 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={doc.type} />
                  <span className="doc-ref-accent font-mono text-sm font-bold">{doc.ref}</span>
                </div>
                <div className="text-white font-semibold text-sm leading-tight">{doc.title}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {doc.discipline && <span className="doc-drawer-meta-pill">{doc.discipline}</span>}
                  {doc.area && <span className="doc-drawer-meta-pill">{doc.area}</span>}
                </div>
              </div>
              <button onClick={onClose} className="doc-drawer-close-btn" aria-label="Close drawer">✕</button>
            </div>
            <button onClick={() => setShowForm(true)}
              className="doc-btn doc-btn-gold mt-3 w-full flex items-center justify-center gap-2">
              📄 Open Full Form
            </button>
            <div className="mt-2 qms-responsive-grid">
              <button onClick={() => requestControlledPdf('view')} disabled={!!pdfActionLoading}
                className="doc-btn doc-btn-teal w-full disabled:bg-slate-400">
                {pdfActionLoading === 'view' ? 'Generating PDF…' : 'View PDF'}
              </button>
              <button onClick={() => requestControlledPdf('download')} disabled={!!pdfActionLoading}
                className="doc-btn doc-btn-deep w-full disabled:bg-slate-400">
                {pdfActionLoading === 'download' ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="doc-status-strip grid grid-cols-3 border-b border-slate-200 flex-shrink-0">
            {[['WORKFLOW', doc.workflow_status], ['APPROVAL', doc.approval_status], ['EVIDENCE', doc.evidence_status]].map(([label, val]) => (
              <div key={label} className="text-center py-2.5 border-r border-slate-200/70 last:border-r-0 px-2">
                <div className="text-slate-500 tracking-wider mb-1 text-[9px] font-semibold">{label}</div>
                <Badge value={val} />
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="doc-tabs-wrap flex gap-2 border-b border-slate-200 bg-white p-2 flex-shrink-0">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`qms-tab doc-tab capitalize relative ${tab === t ? 'qms-tab-active doc-tab-active' : ''}`}>
                {t === 'form-data' ? 'Form Data' : t}
                {t === 'files' && attachments.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--qms-gold)] text-white text-xs rounded-full flex items-center justify-center">{attachments.length}</span>
                )}
              </button>
            ))}
          </div>

          {toast && (
            <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-xs font-medium ${toast.type==='error'?'bg-red-50 text-red-700 border border-red-200':'bg-green-50 text-green-700 border border-green-200'}`}>
              {toast.msg}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'details' && (
              <div>
                <div className="qms-responsive-grid mb-4">
                  {[
                    ['Document Type', doc.type],
                    ['Discipline', doc.discipline || '—'],
                    ['Revision', doc.revision],
                    ['Area / Zone', doc.area || '—'],
                    ['Issue Date', fmtDate(doc.issue_date)],
                    ['Due Date', fmtDate(doc.due_date)],
                    ['Supplier', doc.supplier || '—'],
                    ['Severity', doc.severity || '—'],
                    doc.commercial_value > 0 ? ['Commercial Value', fmtSAR(doc.commercial_value)] : null,
                    doc.closed_date ? ['Closed Date', fmtDate(doc.closed_date)] : null,
                  ].filter(Boolean).map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">{label}</div>
                      <div className="text-sm font-semibold text-slate-800">{val}</div>
                    </div>
                  ))}
                </div>
                {doc.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">Notes / Spec Reference</div>
                    <div className="text-sm text-amber-900">{doc.notes}</div>
                  </div>
                )}
              </div>
            )}

            {tab === 'form-data' && (
              <div className="mt-1 border rounded-lg p-3 bg-white">
                {!allowEdit && <div className="qms-readonly-note mb-3">You have view-only permission for this form.</div>}
                <DocumentTypeForm
                  type={doc.type}
                  formData={docForm}
                  projectInfo={{ ...project, main_contractor: project?.main_contractor || 'Silver Foundation Contracting Company' }}
                  editable={allowEdit}
                  onChange={setDocForm}
                  onSave={saveDocForm}
                />
              </div>
            )}

            {tab === 'details' && doc.type === 'TR' && (
                  <div className="mt-4 border rounded-lg p-3 bg-white">
                    <div className="text-xs text-slate-500">Transmittal fields are available under the <b>Form Data</b> tab.</div>
                  </div>
            )}

            {tab === 'workflow' && (
              <div>
                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Workflow Status</div>
                  <div className="space-y-1.5">
                    {WORKFLOW_STATUSES.map(s => (
                      <button key={s} disabled={saving || !allowEdit} onClick={() => updateField('workflow_status', s)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg border-2 text-sm transition-colors ${doc.workflow_status===s?'border-[var(--qms-gold)] bg-[color:color-mix(in_srgb,var(--qms-sand)_45%,white)] text-[var(--qms-charcoal)] font-bold':'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}>
                        {doc.workflow_status===s&&'✓ '}{s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Formal Approval Status</div>
                  <div className="flex flex-wrap gap-2">
                    {APPROVAL_STATUSES.map(s => (
                      <button key={s} disabled={saving || !allowApprove} onClick={() => updateField('approval_status', s)}
                        className={`px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-colors ${doc.approval_status===s?'border-[var(--qms-gold)] bg-[var(--qms-gold)] text-white':'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Evidence Status</div>
                  <div className="flex flex-wrap gap-2">
                    {EVIDENCE_STATUSES.map(s => (
                      <button key={s} disabled={saving || !allowEdit} onClick={() => updateField('evidence_status', s)}
                        className={`px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-colors ${doc.evidence_status===s?'border-green-600 bg-green-600 text-white':'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'files' && (
              <FileUploader docId={doc.id} projectId={project?.id} attachments={attachments} onUploaded={reloadAttachments} allowUpload={allowUpload} />
            )}

            {tab === 'history' && (
              <div>
                {(doc.history || []).length === 0
                  ? <div className="text-slate-400 text-sm text-center py-8">No history</div>
                  : (doc.history || []).map((h, i) => (
                    <div key={i} className="flex gap-3 py-2.5 border-b border-slate-100">
                      <div className="text-xs text-slate-400 flex-shrink-0 w-24">{(h.timestamp || h.performed_at)?.slice(0,10)}</div>
                      <div className="text-xs text-slate-700 flex-1">
                        <div className="font-medium">{h.action}</div>
                        {(h.old_value || h.new_value) && (
                          <div className="text-slate-500">from <span className="font-mono">{h.old_value || '—'}</span> to <span className="font-mono">{h.new_value || '—'}</span></div>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">{h.user_name||'System'}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-4 flex gap-2 bg-white flex-shrink-0">
            <button onClick={() => updateField('workflow_status','Issued')} className="flex-1 text-xs font-semibold py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors" disabled={saving || !allowIssue}>
              Issue Controlled PDF
            </button>
            <button onClick={() => { updateField('workflow_status','Closed'); updateField('approval_status','Approved'); updateField('evidence_status','Verified'); }}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors" disabled={saving || !allowClose}>
              ✓ Approve & Close
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <FormViewer doc={doc} project={project} stakeholders={stakeholders} onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
