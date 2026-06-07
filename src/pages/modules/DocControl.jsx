import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import { DOC_TYPES, WORKFLOW_STATUSES, APPROVAL_STATUSES, normalizeTypeCode, normalizeDiscipline } from '../../utils/helpers.jsx';
import DocTable from '../../components/DocTable.jsx';
import DocDrawer from '../../components/DocDrawer.jsx';
import NewDocForm from '../../components/NewDocForm.jsx';
import { canCreate } from '../../utils/permissions';

export default function DocControl({ project }) {
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type:'', workflow_status:'', approval_status:'', discipline:'', q:'' });
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('documents');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ project_id: project.id, pageSize: 200 });
    const { data } = await api.get(`/documents?${params}`);
    setDocs(data.data);
    setTotal(data.total);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(updated) {
    setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    setSelected(updated);
  }

  const ff = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const filteredDocs = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return docs.filter(doc => {
      const docType = normalizeTypeCode(doc.type || doc.doc_type || doc.document_type);
      const typeOk = !filters.type || docType === filters.type;

      const docDiscipline = normalizeDiscipline(doc.discipline || doc.discipline_name || doc.discipline_code);
      const selectedDiscipline = normalizeDiscipline(filters.discipline);
      const disciplineOk = !filters.discipline || docDiscipline === selectedDiscipline;

      const workflowOk = !filters.workflow_status || doc.workflow_status === filters.workflow_status;
      const approvalOk = !filters.approval_status || doc.approval_status === filters.approval_status;

      const searchable = [doc.ref, doc.title, doc.description, doc.type, doc.doc_type, doc.document_type, doc.discipline, doc.discipline_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const searchOk = !q || searchable.includes(q);

      return typeOk && disciplineOk && workflowOk && approvalOk && searchOk;
    });
  }, [docs, filters]);

  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-title">Document Control Center</h1>
          <p className="qms-subtitle">Master log for all controlled project records</p>
        </div>
        {allowCreate && <button onClick={() => setShowNew(true)} className="qms-button-primary">+ New Document</button>}
      </div>

      <div className="qms-section mb-4">
        <div className="qms-toolbar">
          <input className="qms-input flex-1 min-w-[220px]" placeholder="Search reference number, type, or title..." value={filters.q} onChange={e => ff('q', e.target.value)} />
          {[
            ['type', DOC_TYPES, 'All Types'],
            ['workflow_status', WORKFLOW_STATUSES, 'Workflow'],
            ['approval_status', APPROVAL_STATUSES, 'Approval'],
            ['discipline', ['Architectural','Civil','Mechanical (HVAC)','Electrical','Plumbing','Fire Fighting','ELV / Low Current','Landscape','Other'], 'All Disciplines'],
          ].map(([key, opts, placeholder]) => (
            <select key={key} className="qms-input w-44" value={filters[key]} onChange={e => ff(key, e.target.value)}>
              <option value="">{placeholder}</option>
              {opts.map(o => {
                if (key === 'type') return <option key={o.code} value={o.code}>{o.label}</option>;
                return <option key={o} value={o}>{o}</option>;
              })}
            </select>
          ))}
          {Object.values(filters).some(v => v) && (
            <button onClick={() => setFilters({ type:'', workflow_status:'', approval_status:'', discipline:'', q:'' })} className="qms-button-secondary">Clear</button>
          )}
        </div>
      </div>

      {loading ? <div className="qms-empty-state">Loading documents...</div> : <><DocTable docs={filteredDocs} onSelect={setSelected} /><div className="text-xs text-slate-400 mt-2">{filteredDocs.length} of {total} records</div></>}

      {selected && <DocDrawer doc={selected} project={project} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
      {showNew && allowCreate && <NewDocForm projectId={project.id} project={project} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
