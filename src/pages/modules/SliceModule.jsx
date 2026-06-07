import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import { isOverdue, DOC_TYPES } from '../../utils/helpers.jsx';
import DocTable from '../../components/DocTable.jsx';
import DocDrawer from '../../components/DocDrawer.jsx';
import NewDocForm from '../../components/NewDocForm.jsx';

export default function SliceModule({ project, types, title }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('submittals');
  const allowEdit = canEdit('submittals');
  const allowUpload = canUpload('submittals');

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      types.map(t => api.get(`/documents?project_id=${project.id}&type=${t}&pageSize=200`))
    );
    setDocs(results.flatMap(r => r.data.data));
    setLoading(false);
  }, [project.id, types.join(',')]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(u) {
    setDocs(prev => prev.map(d => d.id === u.id ? u : d));
    setSelected(u);
  }

  const open     = docs.filter(d => d.workflow_status !== 'Closed').length;
  const approved = docs.filter(d => ['Approved','Approved as Noted'].includes(d.approval_status)).length;
  const overdue  = docs.filter(d => isOverdue(d.due_date) && d.workflow_status !== 'Closed').length;

  // Map type code to full form label so the form opens on the right tab
  const defaultTypeLabel = DOC_TYPES.find(t => t.code === types[0])?.label || 'Material Submittal';

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <button onClick={() => allowCreate && setShowNew(true)} className="btn-primary">+ New {defaultTypeLabel}</button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[{l:'Total',v:docs.length,c:'text-blue-700'},{l:'Open',v:open,c:'text-orange-600'},{l:'Approved',v:approved,c:'text-green-700'},{l:'Overdue',v:overdue,c:'text-red-600'}].map(k=>(
          <div key={k.l} className="kpi-card">
            <div className="text-xs text-slate-400 uppercase tracking-wide">{k.l}</div>
            <div className={`text-3xl font-black mt-1 ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {loading ? <div className="text-slate-400 text-sm text-center py-8">Loading...</div> : <DocTable docs={docs} onSelect={setSelected} />}

      {selected && <DocDrawer doc={selected} project={project} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
      {showNew && allowCreate && <NewDocForm projectId={project.id} project={project} defaultType={defaultTypeLabel} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
