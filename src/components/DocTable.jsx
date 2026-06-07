import { Badge, isOverdue, fmtDate, getTypeLabel } from '../utils/helpers.jsx';

export default function DocTable({ docs = [], onSelect }) {
  if (!docs.length) return <div className="qms-empty-state">No records found. Adjust filters or create a new document.</div>;

  return (
    <div className="qms-table-wrap">
      <div className="qms-table-scroll">
        <table className="qms-table qms-table-compact min-w-[1080px]">
          <thead>
            <tr>
              <th>Reference Number</th><th>Document Type</th><th>Discipline</th><th>Title / Description</th><th>Revision</th><th>Workflow Status</th><th>Approval Status</th><th>Evidence</th><th>Due Date</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} onClick={() => onSelect?.(d)} className="cursor-pointer">
                <td className="text-[var(--qms-gold)] font-mono text-xs font-semibold">{d.ref}</td>
                <td><span className="qms-chip bg-slate-100 text-slate-700">{getTypeLabel(d.type || d.doc_type || d.document_type)}</span></td>
                <td className="text-slate-500">{d.discipline || '—'}</td>
                <td className="max-w-[260px]"><span className="truncate block" title={d.title}>{d.title}</span></td>
                <td className="text-slate-500">{d.revision || '—'}</td>
                <td><Badge value={d.workflow_status} /></td>
                <td><Badge value={d.approval_status} /></td>
                <td><Badge value={d.evidence_status} /></td>
                <td>{d.due_date ? <span className={isOverdue(d.due_date) && d.workflow_status !== 'Closed' ? 'text-red-600 font-semibold' : 'text-slate-500'}>{fmtDate(d.due_date)}</span> : '—'}</td>
                <td><button onClick={e => { e.stopPropagation(); onSelect?.(d); }} className="qms-button-secondary py-1 px-2 text-xs">Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
