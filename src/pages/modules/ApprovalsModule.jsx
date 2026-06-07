import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { Badge, TypeBadge, fmtDate } from '../../utils/helpers.jsx';
import DocDrawer from '../../components/DocDrawer.jsx';
import { canApprove } from '../../utils/permissions';

export default function ApprovalsModule({ project }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const allowApprove = canApprove('approvals');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/documents?project_id=${project.id}&pageSize=300`);
    setDocs(data.data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function quickUpdate(id, changes) {
    const { data } = await api.patch(`/documents/${id}`, changes);
    setDocs(prev => prev.map(d => d.id === id ? data : d));
  }

  function handleUpdated(u) { setDocs(p => p.map(d => d.id === u.id ? u : d)); setSelected(u); }

  const pending = docs.filter(d => d.approval_status === 'Submitted');
  const missingEv = docs.filter(d => ['Approved','Approved as Noted'].includes(d.approval_status) && d.evidence_status === 'No Evidence');
  const all = docs.filter(d => d.approval_status !== 'Not Submitted');

  if (loading) return <div className="p-6 text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="page-title mb-5">Approvals & Signed Records — Evidence Verification</h1>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { l:'Submitted', v:docs.filter(d=>d.approval_status==='Submitted').length, c:'text-blue-700' },
          { l:'Approved', v:docs.filter(d=>['Approved','Approved as Noted'].includes(d.approval_status)).length, c:'text-green-700' },
          { l:'Rejected', v:docs.filter(d=>d.approval_status==='Rejected').length, c:'text-red-700' },
          { l:'Missing Evidence', v:missingEv.length, c:'text-orange-600' },
        ].map(k => (
          <div key={k.l} className="kpi-card"><div className="text-xs text-slate-400 uppercase tracking-wide">{k.l}</div><div className={`text-3xl font-black mt-1 ${k.c}`}>{k.v}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <div className="font-semibold text-slate-700 text-sm mb-3">Awaiting Formal Approval ({pending.length})</div>
          {pending.length === 0 ? <div className="text-slate-400 text-xs py-4 text-center">No pending approvals</div> :
            pending.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-50">
                <TypeBadge type={d.type} />
                <span className="text-xs flex-1 truncate">{d.title}</span>
                {allowApprove && <button onClick={() => quickUpdate(d.id, { approval_status:'Approved', evidence_status:'Pending Upload' })} className="text-xs text-green-700 font-semibold bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors">
                  Mark Approved
                </button>}
              </div>
            ))}
        </div>

        <div className="card p-4">
          <div className="font-semibold text-slate-700 text-sm mb-3">Missing Evidence ({missingEv.length})</div>
          {missingEv.length === 0 ? <div className="text-slate-400 text-xs py-4 text-center">All evidence collected ✓</div> :
            missingEv.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-50">
                <TypeBadge type={d.type} />
                <span className="text-xs flex-1 truncate">{d.title}</span>
                {allowApprove && <button onClick={() => quickUpdate(d.id, { evidence_status:'Uploaded' })} className="text-xs text-amber-700 font-semibold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors">
                  Upload Evidence
                </button>}
              </div>
            ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="qms-table-header px-4 py-3 text-sm font-semibold">Complete Approvals Register ({all.length} records)</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="qms-table-header-row"><th className="px-3 py-2 text-left text-xs font-semibold">Reference</th><th className="px-3 py-2 text-left text-xs font-semibold">Type</th><th className="px-3 py-2 text-left text-xs font-semibold">Title</th><th className="px-3 py-2 text-left text-xs font-semibold">Approval</th><th className="px-3 py-2 text-left text-xs font-semibold">Evidence</th><th className="px-3 py-2 text-left text-xs font-semibold">Issued</th></tr></thead>
            <tbody>
              {all.map((d, i) => (
                <tr key={d.id} onClick={() => setSelected(d)} className={`border-b border-slate-100 hover:bg-[color:color-mix(in_srgb,var(--qms-sand)_25%,white)] cursor-pointer transition-colors ${i%2===1?'bg-slate-50/40':''}`}>
                  <td className="px-3 py-2 text-xs font-mono text-[var(--qms-gold)]">{d.ref}</td>
                  <td className="px-3 py-2"><TypeBadge type={d.type} /></td>
                  <td className="px-3 py-2 text-xs max-w-[160px] truncate">{d.title}</td>
                  <td className="px-3 py-2"><span className="approval-status-chip"><Badge value={d.approval_status} /></span></td>
                  <td className="px-3 py-2"><span className="approval-status-chip"><Badge value={d.evidence_status} /></span></td>
                  <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(d.issue_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DocDrawer doc={selected} projectId={project.id} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
