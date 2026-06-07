import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import { Badge, TypeBadge, fmtDate } from '../../utils/helpers.jsx';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import DocDrawer from '../../components/DocDrawer.jsx';
import NewDocModal from '../../components/NewDocModal.jsx';

const DRAWING_STAGES = ['IFC', 'For Review', 'For Approval', 'For Construction', 'As-Built', 'Shop Drawing', 'Fabrication Drawing'];
const SCALES = ['1:50','1:100','1:200','1:500','1:1000','NTS','Various'];

export default function DrawingsModule({ project }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('drawings');
  const allowEdit = canEdit('drawings');
  const allowUpload = canUpload('drawings');
  const [stageFilter, setStageFilter] = useState('');
  const [discFilter, setDiscFilter] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/documents?project_id=${project.id}&type=DS&pageSize=300`);
    setDocs(data.data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(u) { setDocs(p => p.map(d => d.id === u.id ? u : d)); setSelected(u); }

  const filtered = docs.filter(d => {
    if (discFilter && d.discipline !== discFilter) return false;
    if (q && !d.title.toLowerCase().includes(q.toLowerCase()) && !d.ref.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const disciplines = [...new Set(docs.map(d => d.discipline).filter(Boolean))];
  const approvedCount = docs.filter(d => ['Approved','Approved as Noted'].includes(d.approval_status)).length;
  const ifcCount = docs.filter(d => d.workflow_status === 'Closed').length;

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drawings Register — DS / IFC / As-Built</h1>
          <p className="text-xs text-slate-500 mt-0.5">ISO 9001 / FIDIC · Drawing Submittal Log</p>
        </div>
        <button onClick={() => allowCreate && setShowNew(true)} className="btn-primary">+ New Drawing Submittal</button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { l:'Total Drawings', v:docs.length, c:'text-blue-700' },
          { l:'IFC / Approved', v:approvedCount, c:'text-green-700' },
          { l:'As-Built Closed', v:ifcCount, c:'text-slate-700' },
          { l:'Under Review', v:docs.filter(d=>d.workflow_status==='Issued').length, c:'text-orange-600' },
          { l:'Pending Submission', v:docs.filter(d=>d.approval_status==='Not Submitted').length, c:'text-red-600' },
        ].map(k => (
          <div key={k.l} className="kpi-card"><div className="text-xs text-slate-400 uppercase tracking-wide leading-tight">{k.l}</div><div className={`text-2xl font-black mt-1 ${k.c}`}>{k.v}</div></div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input className="input flex-1 max-w-64" placeholder="Search drawing no. or title..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="select w-36" value={discFilter} onChange={e => setDiscFilter(e.target.value)}>
          <option value="">All Disciplines</option>
          {disciplines.map(d => <option key={d}>{d}</option>)}
        </select>
        {(q || discFilter) && <button onClick={() => { setQ(''); setDiscFilter(''); }} className="btn-ghost text-red-500 text-xs">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700 text-sm">Drawing Submittal Register ({filtered.length} records)</span>
          <button onClick={() => window.print()} className="btn-secondary text-xs py-1.5">🖨 Print Register</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-4xl mb-3 opacity-20">▭</div>
            <div className="font-medium text-sm">No drawings registered yet</div>
            <button onClick={() => allowCreate && setShowNew(true)} className="mt-3 text-blue-600 text-sm hover:underline">Submit the first drawing</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Drawing No.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Rev.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Discipline</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Title / Description</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Area</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Workflow</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Approval</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Issued</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Evidence</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors ${i%2===1?'bg-slate-50/40':''}`}>
                    <td className="px-3 py-2.5 text-xs font-mono text-blue-700 font-medium whitespace-nowrap">{d.ref}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{d.revision}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{d.discipline}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[200px]"><span className="truncate block">{d.title}</span></td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{d.area||'—'}</td>
                    <td className="px-3 py-2.5"><Badge value={d.workflow_status} /></td>
                    <td className="px-3 py-2.5"><Badge value={d.approval_status} /></td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDate(d.issue_date)}</td>
                    <td className="px-3 py-2.5"><Badge value={d.evidence_status} /></td>
                    <td className="px-3 py-2.5">
                      <button onClick={e => { e.stopPropagation(); setSelected(d); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">Open →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DocDrawer doc={selected} project={project} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
      {showNew && allowCreate && <NewDocModal projectId={project.id} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
