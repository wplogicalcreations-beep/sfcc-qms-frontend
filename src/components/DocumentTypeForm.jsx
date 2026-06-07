import React from 'react';

const NOT_SET = 'Not Set';

const OFFICIAL_FIELDS = [
  ['Project Name', 'name'],
  ['Project Code / Project No.', 'code'],
  ['Contract No.', 'contract_no'],
  ['Client / Employer', 'client'],
  ['Main Contractor', 'main_contractor'],
  ['Consultant', 'consultant'],
  ['PMC', 'pmc'],
  ['Location / Site', 'location'],
  ['Discipline', 'discipline'],
  ['Area / Zone', 'area'],
];

const TYPES = {
  TR: 'Transmittal', MS: 'Material Submittal', DS: 'Drawing Submittal', RFI: 'Request for Information',
  IR: 'Inspection Request', NCR: 'Non-Conformance Report', SI: 'Site Instruction', VO: 'Variation Order'
};

function RowTable({ columns, rows, onRowChange, onAddRow, onRemoveRow, editable }) {
  return <div className="space-y-2">
    {rows.map((row, idx) => <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length + (editable ? 1 : 0)}, minmax(0, 1fr))` }}>
      {columns.map(c => <input key={c.key} disabled={!editable} className="qms-input" placeholder={c.label} value={row[c.key] || ''} onChange={e => onRowChange(idx, c.key, e.target.value)} />)}
      {editable && <button type="button" className="qms-button-secondary" onClick={() => onRemoveRow(idx)}>Remove Row</button>}
    </div>)}
    {editable && <button type="button" className="qms-button-secondary" onClick={onAddRow}>Add Row</button>}
  </div>;
}

export default function DocumentTypeForm({ type, formData, projectInfo, editable, onChange, onSave }) {
  const data = formData || {};
  const set = (k, v) => onChange({ ...data, [k]: v });
  const setRow = (key, idx, field, value) => {
    const rows = Array.isArray(data[key]) ? [...data[key]] : [];
    rows[idx] = { ...(rows[idx] || {}), [field]: value };
    set(key, rows);
  };
  const addRow = (key, seed) => set(key, [...(Array.isArray(data[key]) ? data[key] : []), seed]);
  const removeRow = (key, idx) => set(key, (data[key] || []).filter((_, i) => i !== idx));

  const getRfiValue = (...keys) => {
    for (const key of keys) {
      const value = data?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };

  const setRfiValue = (canonicalKey, aliases = []) => (value) => {
    const next = { ...data, [canonicalKey]: value };
    aliases.forEach((alias) => {
      if (data?.[alias] !== undefined) next[alias] = value;
    });
    onChange(next);
  };
  const getIrValue = (...keys) => {
    for (const key of keys) {
      const value = data?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };
  const setIrValue = (canonicalKey, aliases = []) => (value) => {
    const next = { ...data, [canonicalKey]: value };
    aliases.forEach((alias) => {
      if (data?.[alias] !== undefined) next[alias] = value;
    });
    onChange(next);
  };
  const msItems = (Array.isArray(data.material_items) ? data.material_items : []).map((item = {}) => ({
    catalogue_no: item.catalogue_no || item.submittal_no || '',
    revision: item.revision || '',
    material_description: item.material_description || item.description || '',
    manufacturer_supplier: item.manufacturer_supplier || item.manufacturer || item.supplier_manufacturer || '',
    country_of_origin: item.country_of_origin || item.origin || '',
    code: item.code || item.code_model || '',
    remarks: item.remarks || '',
  }));

  return <div className="space-y-4">
    <div className="qms-section">
      <h3 className="qms-title text-base">Project Official Information</h3>
      <p className="qms-subtitle">Auto-filled from project setup (read-only).</p>
      <div className="qms-responsive-grid">
        {OFFICIAL_FIELDS.map(([label, key]) => <div key={key} className="bg-slate-50 rounded-lg p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-sm font-semibold">{projectInfo?.[key] || NOT_SET}</div></div>)}
      </div>
    </div>
    <div className="qms-section">
      <h3 className="qms-title text-base">{TYPES[type] || type} Form Data</h3>
      {type === 'TR' && <>
        <div className="qms-responsive-grid">{[['urgency','Urgency'],['purpose','Purpose'],['to_company','To Company / Recipient'],['attention','Attention'],['subject','Subject'],['response_required','Response Required'],['response_due_date','Response Due Date']].map(([k,l]) => <input key={k} className="qms-input" disabled={!editable} placeholder={l} type={k.includes('date') ? 'date' : 'text'} value={data[k] || ''} onChange={e=>set(k, e.target.value)} />)}</div>
        <RowTable editable={editable} rows={data.transmitted_docs || []} onRowChange={(i,f,v)=>setRow('transmitted_docs',i,f,v)} onAddRow={()=>addRow('transmitted_docs',{docNo:'',rev:'',title:'',copies:'1',remarks:''})} onRemoveRow={i=>removeRow('transmitted_docs',i)} columns={[{key:'docNo',label:'Document No. / Reference'},{key:'rev',label:'Revision'},{key:'title',label:'Title / Description'},{key:'copies',label:'Copies'},{key:'remarks',label:'Remarks'}]} />
        <textarea className="qms-input" disabled={!editable} placeholder="Recipient Remarks / Comments" value={data.remarks || ''} onChange={e=>set('remarks', e.target.value)} />
        <textarea className="qms-input" disabled={!editable} placeholder="Contractor Response" value={data.contractor_response || ''} onChange={e=>set('contractor_response', e.target.value)} />
      </>}
      {type === 'MS' && <div className="space-y-4">
        <section className="ms-form-card"><h4 className="ms-form-heading">Section 1: Submittal Information</h4><div className="qms-responsive-grid"><select className="qms-input" disabled={!editable} value={data.submittal_type || ''} onChange={e=>set('submittal_type',e.target.value)}><option value="">Submittal Type</option>{['Material Submittal','Sample Submittal','Product Data','Technical Data Sheet','Catalogue','Mock-up','Prequalification','Method Statement','Test Report','Other'].map((option)=><option key={option} value={option}>{option}</option>)}{!!data.submittal_type && !['Material Submittal','Sample Submittal','Product Data','Technical Data Sheet','Catalogue','Mock-up','Prequalification','Method Statement','Test Report','Other'].includes(data.submittal_type) && <option value={data.submittal_type}>{data.submittal_type}</option>}</select><input className="qms-input" disabled={!editable} placeholder="Specification Ref." value={data.specification_ref || data.specification_reference || data.spec_reference || ''} onChange={e=>set('specification_ref',e.target.value)} /><select className="qms-input" disabled={!editable} value={data.package_ref || data.package_reference || data.discipline || projectInfo?.discipline || ''} onChange={e=>set('package_ref',e.target.value)}><option value="">Package Ref.</option>{[...new Set([data.discipline,projectInfo?.discipline,'HVAC','Electrical','Plumbing','Fire Fighting','ELV','Civil','Architectural','Structural','Landscape','General','Other'].filter(Boolean))].map((option)=><option key={option} value={option}>{option}</option>)}{!!(data.package_ref || data.package_reference) && !['HVAC','Electrical','Plumbing','Fire Fighting','ELV','Civil','Architectural','Structural','Landscape','General','Other',data.discipline,projectInfo?.discipline].filter(Boolean).includes(data.package_ref || data.package_reference) && <option value={data.package_ref || data.package_reference}>{data.package_ref || data.package_reference}</option>}</select></div></section>
        <section className="ms-form-card"><div className="flex items-center justify-between gap-3"><h4 className="ms-form-heading">Section 2: Material Submittal Items</h4>{editable && <button type="button" className="qms-button-secondary" onClick={()=>addRow('material_items',{catalogue_no:'',revision:'',material_description:'',manufacturer_supplier:'',country_of_origin:'',code:'',remarks:''})}>+ Add Material Item</button>}</div><div className="ms-table-wrap"><table className="ms-items-table"><thead><tr><th>No.</th><th>Catalogue No.</th><th>Material Description / Specification</th><th>Manufacturer / Supplier</th><th>Country of Origin</th><th>Rev.</th><th>Code</th><th>Remarks</th>{editable && <th>Action</th>}</tr></thead><tbody>{(msItems.length ? msItems : [{catalogue_no:'',revision:'',material_description:'',manufacturer_supplier:'',country_of_origin:'',code:'',remarks:''}]).map((row,idx)=><tr key={idx}><td className="ms-row-number">{idx + 1}</td>{[['catalogue_no','Catalogue No.'],['material_description','Material Description / Specification'],['manufacturer_supplier','Manufacturer / Supplier'],['country_of_origin','Country of Origin'],['revision','Rev.'],['code','Code'],['remarks','Remarks']].map(([field,label])=><td key={field} className={['catalogue_no','manufacturer_supplier','country_of_origin','revision','code'].includes(field) ? 'ms-cell-center' : ''}><input disabled={!editable} className={`qms-input ${['catalogue_no','manufacturer_supplier','country_of_origin','revision','code'].includes(field) ? 'ms-input-center' : ''}`} placeholder={label} value={row[field]||''} onChange={e=>setRow('material_items',idx,field,e.target.value)} /></td>)}{editable&&<td><button type="button" className="qms-button-secondary ms-remove-btn" onClick={()=>removeRow('material_items',idx)}>Remove</button></td>}</tr>)}</tbody></table></div></section>
        <section className="ms-form-card"><h4 className="ms-form-heading">Contractor Notes / Remarks</h4><textarea className="qms-input min-h-[88px]" disabled={!editable} placeholder="Contractor Notes / Remarks" value={data.contractor_notes || ''} onChange={e=>set('contractor_notes',e.target.value)} /></section>
      </div>}
      {type === 'DS' && <><div className="qms-responsive-grid">{[['submittal_type','Submittal Type'],['drawing_stage','Drawing Stage']].map(([k,l]) => <input key={k} className="qms-input" disabled={!editable} placeholder={l} value={data[k]||''} onChange={e=>set(k,e.target.value)} />)}</div><RowTable editable={editable} rows={data.drawing_register||[]} onRowChange={(i,f,v)=>setRow('drawing_register',i,f,v)} onAddRow={()=>addRow('drawing_register',{drawing_number:'',revision:'',title:'',scale:'',approval_code:'',remarks:''})} onRemoveRow={i=>removeRow('drawing_register',i)} columns={[{key:'drawing_number',label:'Drawing Number'},{key:'revision',label:'Revision'},{key:'title',label:'Drawing Title / Description'},{key:'scale',label:'Scale'},{key:'approval_code',label:'Approval Code'},{key:'remarks',label:'Remarks'}]} /><textarea className="qms-input" disabled={!editable} placeholder="Contractor Notes / Remarks" value={data.contractor_notes || ''} onChange={e=>set('contractor_notes',e.target.value)} /></>}
      {type === 'RFI' && <div className="rfi-form-layout">
        <section className="rfi-form-card">
          <h4 className="rfi-form-heading">A. RFI Details</h4>
          <div className="qms-responsive-grid">
            <input className="qms-input" disabled={!editable} placeholder="RFI Category" value={getRfiValue('rfi_category')} onChange={e=>setRfiValue('rfi_category')(e.target.value)} />
            <input className="qms-input" disabled={!editable} placeholder="Priority" value={getRfiValue('priority')} onChange={e=>setRfiValue('priority')(e.target.value)} />
            <input className="qms-input" disabled={!editable} placeholder="Subject" value={getRfiValue('subject')} onChange={e=>setRfiValue('subject')(e.target.value)} />
            <input className="qms-input" disabled={!editable} placeholder="Area / Zone" value={getRfiValue('area_zone')} onChange={e=>setRfiValue('area_zone')(e.target.value)} />
            <input type="date" className="qms-input" disabled={!editable} value={getRfiValue('response_required_by', 'requiredResponseDate')} onChange={e=>setRfiValue('response_required_by', ['requiredResponseDate'])(e.target.value)} />
          </div>
        </section>
        <section className="rfi-form-card"><h4 className="rfi-form-heading">B. References</h4><div className="qms-responsive-grid">
          <input className="qms-input" disabled={!editable} placeholder="Contract Clause / Standard" value={getRfiValue('contract_clause')} onChange={e=>setRfiValue('contract_clause')(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Drawing Reference" value={getRfiValue('drawing_ref', 'drawing_reference')} onChange={e=>setRfiValue('drawing_ref', ['drawing_reference'])(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Specification Reference" value={getRfiValue('specification_ref', 'spec_reference')} onChange={e=>setRfiValue('specification_ref', ['spec_reference'])(e.target.value)} />
        </div></section>
        <section className="rfi-form-card"><h4 className="rfi-form-heading">C. Information Requested</h4><div className="space-y-3">
          <textarea rows={4} className="qms-input rfi-textarea" disabled={!editable} placeholder="Information Requested" value={getRfiValue('information_requested', 'requested_information')} onChange={e=>setRfiValue('information_requested', ['requested_information'])(e.target.value)} />
          <textarea rows={3} className="qms-input rfi-textarea" disabled={!editable} placeholder="Reason / Background" value={getRfiValue('reason_background')} onChange={e=>setRfiValue('reason_background')(e.target.value)} />
          <textarea rows={3} className="qms-input rfi-textarea" disabled={!editable} placeholder="Proposed Solution / Contractor Recommendation" value={getRfiValue('proposed_solution', 'contractor_recommendation')} onChange={e=>setRfiValue('proposed_solution', ['contractor_recommendation'])(e.target.value)} />
        </div></section>
        <section className="rfi-form-card"><h4 className="rfi-form-heading">D. Attachments</h4><textarea rows={3} className="qms-input rfi-textarea" disabled={!editable} placeholder="Attachment References" value={getRfiValue('attachment_references', 'attachments')} onChange={e=>setRfiValue('attachment_references', ['attachments'])(e.target.value)} /></section>
        <section className="rfi-form-card"><h4 className="rfi-form-heading">E. Consultant Response / Clarification</h4><div className="space-y-3">
          <textarea rows={3} className="qms-input rfi-textarea" disabled={!editable} placeholder="Consultant Response / Clarification" value={getRfiValue('consultant_response', 'response_clarification')} onChange={e=>setRfiValue('consultant_response', ['response_clarification'])(e.target.value)} />
          <div className="qms-responsive-grid">
            <input className="qms-input" disabled={!editable} placeholder="Responded By" value={getRfiValue('responded_by')} onChange={e=>setRfiValue('responded_by')(e.target.value)} />
            <input type="date" className="qms-input" disabled={!editable} value={getRfiValue('response_date')} onChange={e=>setRfiValue('response_date')(e.target.value)} />
          </div>
        </div></section>
      </div>}
      {type === 'IR' && <div className="ir-form-layout">
        <section className="ir-form-card"><h4 className="ir-form-heading">A. Inspection Details</h4><div className="qms-responsive-grid">
          <input className="qms-input" disabled={!editable} placeholder="Inspection Type" value={getIrValue('inspection_type')} onChange={e=>setIrValue('inspection_type')(e.target.value)} />
          <input type="date" className="qms-input" disabled={!editable} value={getIrValue('requested_inspection_date','date_of_inspection')} onChange={e=>setIrValue('requested_inspection_date',['date_of_inspection'])(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Requested Time" value={getIrValue('requested_time')} onChange={e=>setIrValue('requested_time')(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Location / Area" value={getIrValue('location') || getIrValue('area_zone')} onChange={e=>setIrValue('location',['area_zone'])(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Drawing Reference" value={getIrValue('drawing_ref','drawing_reference')} onChange={e=>setIrValue('drawing_ref',['drawing_reference'])(e.target.value)} />
        </div></section>
        <section className="ir-form-card"><h4 className="ir-form-heading">B. Inspection Description</h4>
          <textarea rows={3} className="qms-input ir-textarea" disabled={!editable} placeholder="Inspection Description" value={getIrValue('inspection_description')} onChange={e=>setIrValue('inspection_description')(e.target.value)} />
        </section>
        <section className="ir-form-card"><h4 className="ir-form-heading">C. Test Package &amp; Attachments</h4><div className="qms-responsive-grid">
          <input className="qms-input" disabled={!editable} placeholder="Checklist / Test Package" value={getIrValue('test_package_ref','test_package_reference')} onChange={e=>setIrValue('test_package_ref',['test_package_reference'])(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Method Statement Reference" value={getIrValue('method_statement_ref','method_statement_reference')} onChange={e=>setIrValue('method_statement_ref',['method_statement_reference'])(e.target.value)} />
          <textarea rows={2} className="qms-input ir-textarea" disabled={!editable} placeholder="Attachment References" value={getIrValue('attachment_references','attachments')} onChange={e=>setIrValue('attachment_references',['attachments'])(e.target.value)} />
        </div></section>
        <section className="ir-form-card"><h4 className="ir-form-heading">D. Readiness Confirmation</h4><div className="space-y-3">
          <select className="qms-input" disabled={!editable} value={getIrValue('ready_for_inspection')} onChange={e=>setIrValue('ready_for_inspection')(e.target.value)}><option value="">Ready for Inspection</option><option value="Yes">Yes</option><option value="No">No</option></select>
        </div></section>
        <section className="ir-form-card"><h4 className="ir-form-heading">E. Client &amp; Contractor Remarks</h4>
          <textarea rows={4} className="qms-input ir-textarea" disabled={!editable} placeholder="Client / Contractor Remarks" value={getIrValue('client_contractor_remarks','client_consultant_remarks','contractor_remarks','remarks','inspection_remarks')} onChange={e=>setIrValue('client_contractor_remarks',['client_consultant_remarks','remarks'])(e.target.value)} />
        </section>
        <section className="ir-form-card"><h4 className="ir-form-heading">F. Inspection Outcome / Status</h4><div className="space-y-3">
          <select className="qms-input" disabled={!editable} value={getIrValue('inspection_outcome','outcome')} onChange={e=>setIrValue('inspection_outcome',['outcome'])(e.target.value)}>
            <option value="">Inspection Outcome</option><option value="Approved">Approved</option><option value="Approved as Noted">Approved as Noted</option><option value="Rejected">Rejected</option><option value="Rectify & Resubmit / Re-inspection Required">Rectify &amp; Resubmit / Re-inspection Required</option>
          </select>
          <textarea rows={2} className="qms-input ir-textarea" disabled={!editable} placeholder="Action / Follow-up" value={getIrValue('action_follow_up','follow_up_action')} onChange={e=>setIrValue('action_follow_up',['follow_up_action'])(e.target.value)} />
          <input className="qms-input" disabled={!editable} placeholder="Action Required By / Responsible" value={getIrValue('action_required_by')} onChange={e=>setIrValue('action_required_by')(e.target.value)} />
        </div></section>
      </div>}
      {type === 'NCR' && <div className="qms-responsive-grid">{[['priority','Priority'],['severity','Severity'],['ncr_status','NCR Status'],['scope','Scope of Non-Conformity'],['drawing_spec_no','Drawing / Spec No.'],['location_zone','Location / Zone'],['description_action_required','Description of Non-Conformity and Action Required'],['root_cause_category','Root Cause Category'],['proposed_corrective_action','Proposed Corrective Action'],['preventive_action','Preventive Action'],['responsible_person','Responsible Person'],['target_closure_date','Target Closure Date'],['verification_notes','Verification / Closure Notes'],['action_taken','Action Taken'],['completion_date','Completion Date'],['ncr_closure_date','NCR Closure Date']].map(([k,l]) => <input key={k} type={k.includes('date')?'date':'text'} className="qms-input" disabled={!editable} placeholder={l} value={data[k]||''} onChange={e=>set(k,e.target.value)} />)}</div>}
      {type === 'SI' && <div className="qms-responsive-grid">{[['instruction_direction','Instruction Direction'],['issued_by','Issued By'],['issued_to','Issued To'],['subject','Subject'],['discipline','Discipline'],['location_area','Location / Area'],['instruction_description','Instruction Description'],['required_action','Required Action'],['response_required','Response Required'],['response_due_date','Response Due Date'],['acknowledgement_response','Acknowledgement / Contractor Response']].map(([k,l]) => <input key={k} type={k.includes('date')?'date':'text'} className="qms-input" disabled={!editable} placeholder={l} value={data[k]||''} onChange={e=>set(k,e.target.value)} />)}</div>}
      {type === 'VO' && <><div className="qms-responsive-grid">{[['variation_type','Variation Type'],['discipline','Discipline'],['variation_description','Variation Description'],['reason_for_change','Reason for Change / Justification'],['total_variation_amount','Total Variation Amount'],['commercial_notes','Commercial Notes']].map(([k,l]) => <input key={k} className="qms-input" disabled={!editable} placeholder={l} value={data[k]||''} onChange={e=>set(k,e.target.value)} />)}</div><RowTable editable={editable} rows={data.variation_items||[]} onRowChange={(i,f,v)=>setRow('variation_items',i,f,v)} onAddRow={()=>addRow('variation_items',{description:'',unit:'',quantity:'',unit_rate:'',amount:''})} onRemoveRow={i=>removeRow('variation_items',i)} columns={[{key:'description',label:'Description of Work / Item'},{key:'unit',label:'Unit'},{key:'quantity',label:'Quantity'},{key:'unit_rate',label:'Unit Rate'},{key:'amount',label:'Amount'}]} /></>}
      {editable && onSave && <button type="button" className="qms-button-primary" onClick={onSave}>Save Form Data</button>}
    </div>
  </div>;
}
