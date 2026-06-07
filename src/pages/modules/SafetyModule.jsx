import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import { Badge, fmtDate, SAFETY_TYPES, PERMIT_SUBTYPES } from '../../utils/helpers.jsx';

export default function SafetyModule({ project }) {
  const [records, setRecords] = useState([]);
  const [tab, setTab] = useState('Permit to Work');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('safety');
  const allowEdit = canEdit('safety');
  const allowUpload = canUpload('safety');
  const [newForm, setNewForm] = useState({ type:'Permit to Work', subtype:'Hot Work', title:'', area:'', responsible:'', valid_from:'', valid_to:'', notes:'' });

  const load = useCallback(async () => {
    const { data } = await api.get(`/safety?project_id=${project.id}`);
    setRecords(data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const tabRecs = records.filter(r => r.type === tab);
  const kpis = [
    { l:'Active Permits', v: records.filter(r=>r.type==='Permit to Work'&&r.status==='Active').length, c:'text-blue-700' },
    { l:'Expired / At Risk', v: records.filter(r=>r.status==='At Risk'||r.status==='Expired').length, c:'text-red-700' },
    { l:'Incidents', v: records.filter(r=>r.type==='Incident'||r.type==='Near Miss').length, c:'text-orange-600' },
    { l:'Total Records', v: records.length, c:'text-slate-700' },
  ];

  async function createRecord(e) {
    e.preventDefault();
    await api.post('/safety', { ...newForm, project_id: project.id });
    setShowNew(false);
    load();
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Safety Compliance Module</h1>
        <button onClick={() => allowCreate && setShowNew(true)} className="btn-primary">+ New Safety Record</button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.l} className="kpi-card"><div className="text-xs text-slate-400 uppercase tracking-wide">{k.l}</div><div className={`text-3xl font-black mt-1 ${k.c}`}>{k.v}</div></div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {SAFETY_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tab===t?'bg-blue-700 text-white border-blue-700':'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{t}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-700 text-sm">{tab} Records ({tabRecs.length})</span>
        </div>
        {loading ? <div className="p-8 text-center text-slate-400 text-sm">Loading...</div> :
          tabRecs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-3xl mb-2 opacity-20">◉</div>
              <div className="font-medium text-sm">No {tab} records yet</div>
              <button onClick={() => allowCreate && setShowNew(true)} className="mt-3 text-blue-600 text-sm hover:underline">Create the first record</button>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-slate-800 text-white"><th className="px-3 py-2 text-left text-xs font-semibold">Reference</th><th className="px-3 py-2 text-left text-xs font-semibold">Type / Subtype</th><th className="px-3 py-2 text-left text-xs font-semibold">Title</th><th className="px-3 py-2 text-left text-xs font-semibold">Area</th><th className="px-3 py-2 text-left text-xs font-semibold">Responsible</th><th className="px-3 py-2 text-left text-xs font-semibold">Valid To</th><th className="px-3 py-2 text-left text-xs font-semibold">Status</th></tr></thead>
              <tbody>{tabRecs.map((r,i)=>(
                <tr key={r.id} className={`border-b border-slate-50 hover:bg-blue-50 transition-colors ${i%2===1?'bg-slate-50/40':''}`}>
                  <td className="px-3 py-2.5 text-xs font-mono text-blue-600">{r.ref}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.subtype||r.type}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700 max-w-[160px] truncate">{r.title}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.area||'—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.responsible||'—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(r.valid_to)}</td>
                  <td className="px-3 py-2.5"><Badge value={r.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          )
        }
      </div>

      {showNew && allowCreate && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowNew(false);}}>
          <div className="modal-box max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">New Safety Record</h2>
              <button onClick={()=>setShowNew(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={createRecord} className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label><select className="select" value={newForm.type} onChange={e=>setNewForm(p=>({...p,type:e.target.value}))}>{SAFETY_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="label">Sub-type</label><select className="select" value={newForm.subtype} onChange={e=>setNewForm(p=>({...p,subtype:e.target.value}))}><option value="">Select...</option>{PERMIT_SUBTYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="label">Title *</label><input className="input" required value={newForm.title} onChange={e=>setNewForm(p=>({...p,title:e.target.value}))} placeholder="Brief description"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Area</label><input className="input" value={newForm.area} onChange={e=>setNewForm(p=>({...p,area:e.target.value}))} placeholder="Zone / Level"/></div>
                <div><label className="label">Responsible Person</label><input className="input" value={newForm.responsible} onChange={e=>setNewForm(p=>({...p,responsible:e.target.value}))} placeholder="Name"/></div>
                <div><label className="label">Valid From</label><input type="date" className="input" value={newForm.valid_from} onChange={e=>setNewForm(p=>({...p,valid_from:e.target.value}))}/></div>
                <div><label className="label">Valid To</label><input type="date" className="input" value={newForm.valid_to} onChange={e=>setNewForm(p=>({...p,valid_to:e.target.value}))}/></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={newForm.notes} onChange={e=>setNewForm(p=>({...p,notes:e.target.value}))}/></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setShowNew(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
