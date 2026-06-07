import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import DocTable from '../../components/DocTable.jsx';
import DocDrawer from '../../components/DocDrawer.jsx';
import NewDocForm from '../../components/NewDocForm.jsx';

export default function NCRModule({ project }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('ncr');
  const allowEdit = canEdit('ncr');
  const allowUpload = canUpload('ncr');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/documents?project_id=${project.id}&type=NCR&pageSize=200`);
    setDocs(data.data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(u) { setDocs(p => p.map(d => d.id === u.id ? u : d)); setSelected(u); }

  const open  = docs.filter(d => d.workflow_status !== 'Closed').length;
  const major = docs.filter(d => ['Major','Critical'].includes(d.severity)).length;

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Non-Conformance Reports — NCR / CAPA</h1>
        <button onClick={() => allowCreate && setShowNew(true)} className="bg-red-700 hover:bg-red-800 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          + Raise Non-Conformance Report
        </button>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 font-medium">
        Evidence Rule: No Non-Conformance Report may be closed without verified corrective action evidence confirmed by an authorized Quality Control Engineer.
      </div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[{l:'Total Non-Conformances',v:docs.length,c:'text-blue-700'},{l:'Open',v:open,c:'text-orange-600'},{l:'Major / Critical',v:major,c:'text-red-700'},{l:'Closed',v:docs.length-open,c:'text-green-700'}].map(k=>(
          <div key={k.l} className="kpi-card">
            <div className="text-xs text-slate-400 uppercase tracking-wide leading-tight">{k.l}</div>
            <div className={`text-3xl font-black mt-1 ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      {loading ? <div className="text-slate-400 text-sm text-center py-8">Loading...</div> : <DocTable docs={docs} onSelect={setSelected} />}
      {selected && <DocDrawer doc={selected} project={project} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
      {showNew && allowCreate && <NewDocForm projectId={project.id} project={project} defaultType="Non-Conformance Report" onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
