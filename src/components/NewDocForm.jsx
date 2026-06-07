import { useMemo, useState } from 'react';
import api from '../utils/api';
import { userSafeError, referenceConflictMessage } from '../utils/uiMessages';
import { DOC_TYPES } from '../utils/helpers.jsx';
import DocumentTypeForm from './DocumentTypeForm.jsx';

function documentSaveErrorMessage(error) {
  const message = error.response?.data?.error || error.message || '';
  if (/UNIQUE constraint failed: documents\.(?:project_id|type|ref)|document reference conflict|duplicate document reference/i.test(message)) {
    return referenceConflictMessage();
  }
  return userSafeError(error, 'This record could not be saved. Please check the required fields and try again.');
}


const DEFAULT_BY_TYPE = {
  TR: { urgency: 'Routine', purpose: 'For Review', response_required: 'No', transmitted_docs: [{ docNo:'', rev:'', title:'', copies:'1', remarks:'' }] },
  MS: { submittal_type:'', specification_ref:'', package_ref:'', date:'', contractor_notes:'', material_items: [{ catalogue_no:'', revision:'', material_description:'', manufacturer_supplier:'', country_of_origin:'', code:'', remarks:'' }] },
  DS: { drawing_register: [{ drawing_number:'', revision:'', title:'', scale:'', approval_code:'', remarks:'' }] },
  RFI: { rfi_category:'', priority:'', subject:'', area_zone:'', response_required_by:'', contract_clause:'', drawing_ref:'', specification_ref:'', information_requested:'', reason_background:'', proposed_solution:'', attachment_references:'', consultant_response:'', responded_by:'', response_date:'' },
  IR: { inspection_type:'', priority:'', requested_inspection_date:'', requested_time:'', area_zone:'', location:'', grid_reference:'', drawing_ref:'', specification_ref:'', method_statement_ref:'', test_package_ref:'', inspection_description:'', ready_for_inspection:'', contractor_statement:'', client_contractor_remarks:'', inspection_outcome:'', action_follow_up:'', action_required_by:'' },
  VO: { variation_items: [{ description:'', unit:'', quantity:'', unit_rate:'', amount:'' }] },
};

export default function NewDocForm({ projectId, project, onClose, onCreated, defaultType = 'Material Submittal' }) {
  const defaultCode = DOC_TYPES.find(t => t.label === defaultType)?.code || 'MS';
  const [typeCode, setTypeCode] = useState(defaultCode);
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState(project?.discipline || 'HVAC');
  const [formData, setFormData] = useState(DEFAULT_BY_TYPE[defaultCode] || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const projectInfo = useMemo(() => ({ ...project, main_contractor: project?.main_contractor || 'Silver Foundation Contracting Company' }), [project]);

  const onTypeChange = (nextCode) => {
    setTypeCode(nextCode);
    setFormData(DEFAULT_BY_TYPE[nextCode] || {});
  };

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        project_id: projectId,
        type: typeCode,
        discipline,
        title: title || `${DOC_TYPES.find(d => d.code === typeCode)?.label || typeCode} - ${project?.code || ''}`,
        description: formData.subject || formData.variation_description || formData.inspection_description || '',
        area: formData.area_zone || formData.location_zone || formData.location_area || project?.area || '',
        due_date: formData.response_due_date || formData.response_required_by || null,
        form_data: JSON.stringify(formData),
      };
      const { data } = await api.post('/documents', payload);
      onCreated?.(data);
    } catch (e) {
      setError(documentSaveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 bg-black/50 z-[9999] p-6 overflow-auto">
    <div className="max-w-6xl mx-auto bg-white rounded-xl p-4 space-y-4">
      <div className="flex gap-2 items-center">
        <h2 className="qms-title flex-1">+ New Document</h2>
        <button className="qms-button-secondary" onClick={onClose}>Cancel</button>
        <button className="qms-button-primary" disabled={saving} onClick={handleCreate}>{saving ? 'Saving…' : 'Save Document'}</button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
      <div className="qms-responsive-grid">
        <select className="qms-input" value={typeCode} onChange={e => onTypeChange(e.target.value)}>{DOC_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select>
        <input className="qms-input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <select className="qms-input" value={discipline} onChange={e => setDiscipline(e.target.value)}><option>HVAC</option><option>MEP</option><option>Electrical</option><option>Civil & Structural</option><option>Architectural</option><option>Plumbing & Drainage</option><option>Fire Fighting</option><option>ELV</option><option>Landscape</option></select>
      </div>
      <div className="qms-info-banner"><p>Reference number will be generated automatically after saving.</p><small>Reference is server-controlled; only system admin can override after creation.</small></div><DocumentTypeForm type={typeCode} formData={formData} projectInfo={projectInfo} editable onChange={setFormData} />
    </div>
  </div>;
}
