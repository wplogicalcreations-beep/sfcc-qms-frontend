import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';
import { fmtDate } from '../../utils/helpers.jsx';

const CATEGORIES = [
  'Commercial / Financial',
  'Technical / Design',
  'Health, Safety & Environment',
  'Schedule / Programme',
  'Site & Ground Conditions',
  'Regulatory / Compliance',
  'Resource & Procurement',
  'Subcontractor / Supplier',
  'Client / Stakeholder',
  'Force Majeure',
];

const RISK_LEVELS = {
  Critical: { bg: 'bg-red-600', text: 'text-white', dot: 'bg-red-500' },
  High:     { bg: 'bg-orange-500', text: 'text-white', dot: 'bg-orange-400' },
  Medium:   { bg: 'bg-amber-400', text: 'text-slate-900', dot: 'bg-amber-400' },
  Low:      { bg: 'bg-green-500', text: 'text-white', dot: 'bg-green-400' },
};

const MATRIX_LABELS = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

function RiskBadge({ level }) {
  const c = RISK_LEVELS[level] || RISK_LEVELS.Low;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>{level}</span>;
}

export default function RiskModule({ project }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('risks');
  const allowEdit = canEdit('risks');
  const allowUpload = canUpload('risks');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list | matrix

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/risks?project_id=${project.id}`);
    setRisks(data);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const open = risks.filter(r => r.status === 'Open').length;
  const critical = risks.filter(r => r.risk_level === 'Critical').length;
  const high = risks.filter(r => r.risk_level === 'High').length;
  const closed = risks.filter(r => r.status === 'Closed').length;
  function handlePrint() {
    const stamp = new Date().toLocaleString();
    const rows = risks.map(r => `
      <tr>
        <td>${r.ref || '—'}</td><td>${r.title || '—'}</td><td>${r.category || '—'}</td><td>${r.likelihood ?? '—'}</td><td>${r.consequence ?? '—'}</td>
        <td>${r.risk_rating ?? '—'}</td><td>${r.risk_level || '—'}</td><td>${r.owner || '—'}</td><td>${r.status || '—'}</td><td>${fmtDate(r.review_date)}</td><td>${r.mitigation || '—'}</td>
      </tr>`).join('');
    const win = window.open('', '_blank', 'width=1200,height=900');
    win.document.write(`<!doctype html><html><head><title>Risk Register</title><style>@page{size:A4 landscape;margin:11mm 10mm}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:0}.print-page{width:100%;max-width:275mm;min-height:186mm;margin:0 auto;padding:3mm 2mm 5mm}.print-content{width:100%;overflow:hidden}.hdr{border-bottom:2px solid #1e3a8a;padding-bottom:6px;margin-bottom:8px}.brand{font-weight:800;color:#1e3a8a;font-size:14px}.note{font-size:10px;color:#475569}.foot{margin-top:10px;border-top:1px solid #94a3b8;padding-top:4px;font-size:10px;color:#64748b;display:flex;justify-content:space-between}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #94a3b8;padding:5px;vertical-align:top;overflow-wrap:anywhere}th{background:#e2e8f0;text-align:left}thead{display:table-header-group}.meta{font-size:11px;color:#475569;margin:6px 0 10px}.ref{font-family:monospace;white-space:nowrap}</style></head><body><div class="print-page print-page-landscape print-content"><div class="hdr"><div class="brand">SILVER FOUNDATION CONTRACTING COMPANY</div><div class="note">ISO 9001 / FIDIC · Risk Register</div><h1>Risk Register</h1></div><div class="meta">Project: ${project.name} | Project No: ${project.code || '—'} | Ref: RIS-${project.code || 'NA'}</div><div class="meta">Client: ${project.client || "—"} | Consultant: ${project.consultant || "—"} | Contractor: Silver Foundation Contracting Company</div><div class="meta">Issue Date: ${stamp.split(",")[0]} | Revision: R0 | Generated: ${stamp}</div><table><thead><tr><th>Reference</th><th>Title</th><th>Category</th><th>Likelihood</th><th>Consequence</th><th>Rating</th><th>Risk Level</th><th>Owner</th><th>Status</th><th>Review Date</th><th>Mitigation</th></tr></thead><tbody>${rows || '<tr><td colspan="11">No risks found</td></tr>'}</tbody></table><div class="foot"><span>Generated: ${stamp}</span><span>SFCC QMS Client Submission Copy</span></div></body></html>`);
    win.document.close(); setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  // Build heatmap matrix data
  function matrixCell(l, c2) {
    return risks.filter(r => r.likelihood === l && r.consequence === c2 && r.status === 'Open');
  }
  function cellColor(l, c2) {
    const rating = l * c2;
    if (rating >= 15) return 'bg-red-100 hover:bg-red-200';
    if (rating >= 10) return 'bg-orange-100 hover:bg-orange-200';
    if (rating >= 5)  return 'bg-amber-50 hover:bg-amber-100';
    return 'bg-green-50 hover:bg-green-100';
  }

  return (
    <div className="p-6">
      <div className="page-header bg-gradient-to-r from-[var(--qms-charcoal)] to-[var(--qms-graphite)] rounded-2xl border border-[color:color-mix(in_srgb,var(--qms-soft-gold)_45%,var(--qms-charcoal))] px-5 py-4 shadow-md">
        <div>
          <h1 className="page-title text-[var(--qms-sand)]">Risk Register</h1>
          <p className="text-xs text-[color:color-mix(in_srgb,var(--qms-sand)_82%,white)] mt-0.5">{project.name} · ISO 31000 Risk Management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary text-xs no-print">🖨 Print</button>
          <button onClick={() => setViewMode(viewMode === 'list' ? 'matrix' : 'list')} className="btn-secondary text-xs">
            {viewMode === 'list' ? '▦ Risk Matrix' : '≡ List View'}
          </button>
          <button onClick={() => allowCreate && setShowNew(true)} className="btn-primary">+ Add Risk</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="qms-kpi-grid mb-5">
        {[
          { l: 'Total Risks', v: risks.length, c: 'text-[var(--qms-charcoal)]', accent: 'border-l-[var(--qms-gold)]' },
          { l: 'Open', v: open, c: 'text-amber-700', accent: 'border-l-[var(--qms-soft-gold)]' },
          { l: 'Critical', v: critical, c: 'text-red-700', accent: 'border-l-red-600' },
          { l: 'High', v: high, c: 'text-red-600', accent: 'border-l-orange-500' },
          { l: 'Closed / Mitigated', v: closed, c: 'text-green-700', accent: 'border-l-green-600' },
        ].map(k => (
          <div key={k.l} className={`kpi-card bg-[color:color-mix(in_srgb,var(--qms-sand)_20%,white)] border-[color:color-mix(in_srgb,var(--qms-soft-gold)_52%,white)] border-l-4 ${k.accent}`}>
            <div className="text-xs text-[var(--qms-graphite)] uppercase tracking-wide leading-tight">{k.l}</div>
            <div className={`text-2xl font-black mt-1 ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {viewMode === 'matrix' ? (
        <RiskMatrix risks={risks} matrixCell={matrixCell} cellColor={cellColor} onSelect={setSelected} />
      ) : (
        <RiskList risks={risks} loading={loading} onSelect={setSelected} />
      )}

      {showNew && allowCreate && (
        <RiskModal project={project} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
      )}
      {selected && (
        <RiskModal project={project} risk={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }}
          onDelete={async () => { await api.delete(`/risks/${selected.id}`); setSelected(null); load(); }} />
      )}
    </div>
  );
}

// ── Risk Matrix Heatmap ───────────────────────────────────────────────────────

function RiskMatrix({ risks, matrixCell, cellColor, onSelect }) {
  return (
    <div className="card p-5">
      <div className="font-semibold text-slate-700 text-sm mb-4">Risk Probability & Impact Matrix (ISO 31000)</div>
      <div className="flex gap-4">
        {/* Y axis label */}
        <div className="flex items-center">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            LIKELIHOOD →
          </div>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-6 gap-1 text-xs">
            {/* Header row */}
            <div></div>
            {[1,2,3,4,5].map(c => (
              <div key={c} className="text-center font-semibold text-slate-500 pb-1">{MATRIX_LABELS[c]}</div>
            ))}
            {/* Matrix rows: likelihood 5 (top) to 1 (bottom) */}
            {[5,4,3,2,1].map(l => (
              <>
                <div key={`l${l}`} className="flex items-center justify-end pr-2 font-semibold text-slate-500">{MATRIX_LABELS[l]}</div>
                {[1,2,3,4,5].map(c => {
                  const items = matrixCell(l, c);
                  return (
                    <div key={`${l}-${c}`} className={`${cellColor(l,c)} rounded-lg p-2 min-h-14 border border-white/50 transition-colors`}>
                      <div className="text-xs font-bold text-slate-400 mb-1">{l*c}</div>
                      {items.map(r => (
                        <button key={r.id} onClick={() => onSelect(r)}
                          className="w-full text-left text-xs bg-white/70 hover:bg-white rounded px-1.5 py-0.5 mb-0.5 truncate font-medium text-slate-700 transition-colors">
                          {r.ref}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
          <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-wide mt-3">CONSEQUENCE →</div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 justify-center pl-2">
          {[['Critical', '≥15','bg-red-100'],['High', '10–14','bg-orange-100'],['Medium', '5–9','bg-amber-50'],['Low', '1–4','bg-green-50']].map(([l,r,c])=>(
            <div key={l} className="flex items-center gap-2 text-xs">
              <div className={`w-4 h-4 rounded ${c} border border-slate-200`}></div>
              <span className="text-slate-600 font-medium">{l}</span>
              <span className="text-slate-400">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Risk List ─────────────────────────────────────────────────────────────────

function RiskList({ risks, loading, onSelect }) {
  if (loading) return <div className="text-center text-slate-400 text-sm py-8">Loading risks...</div>;
  if (risks.length === 0) return (
    <div className="card p-12 text-center text-slate-400">
      <div className="text-4xl mb-3 opacity-20">⚠</div>
      <div className="font-medium text-sm">No risks registered yet</div>
    </div>
  );
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-[var(--qms-charcoal)] to-[var(--qms-graphite)] text-[var(--qms-sand)] border-b-2 border-[var(--qms-soft-gold)]">
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Reference</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Title</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Category</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold">Likelihood</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold">Consequence</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold">Rating</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Risk Level</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Owner</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Review Date</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r, i) => (
              <tr key={r.id} onClick={() => onSelect(r)} className={`border-b border-[color:color-mix(in_srgb,var(--qms-sand)_72%,white)] hover:bg-[color:color-mix(in_srgb,var(--qms-sand)_32%,white)] cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-[color:color-mix(in_srgb,var(--qms-sand)_14%,white)]' : 'bg-white'}`}>
                <td className="px-3 py-2.5 text-xs font-mono text-[var(--qms-gold)] font-semibold">{r.ref}</td>
                <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[200px]"><span className="truncate block">{r.title}</span></td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{r.category}</td>
                <td className="px-3 py-2.5 text-xs text-center font-bold text-slate-700">{r.likelihood}</td>
                <td className="px-3 py-2.5 text-xs text-center font-bold text-slate-700">{r.consequence}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center w-8 h-6 rounded font-bold text-xs text-white ${r.risk_rating >= 15 ? 'bg-red-600' : r.risk_rating >= 10 ? 'bg-orange-500' : r.risk_rating >= 5 ? 'bg-amber-400' : 'bg-green-500'}`}>
                    {r.risk_rating}
                  </span>
                </td>
                <td className="px-3 py-2.5"><RiskBadge level={r.risk_level} /></td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{r.owner || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    r.status === 'Closed'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : r.status === 'Mitigated'
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : r.status === 'In Progress'
                          ? 'bg-[color:color-mix(in_srgb,var(--qms-sand)_26%,white)] text-[var(--qms-graphite)] border border-[color:color-mix(in_srgb,var(--qms-gold)_42%,white)]'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDate(r.review_date)}</td>
                <td className="px-3 py-2.5">
                  <button onClick={e => { e.stopPropagation(); onSelect(r); }} className="text-xs text-[var(--qms-gold)] hover:text-[var(--qms-charcoal)] font-medium px-2 py-1 rounded hover:bg-[color:color-mix(in_srgb,var(--qms-sand)_35%,white)] transition-colors">Edit →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Risk Add/Edit Modal ───────────────────────────────────────────────────────

function RiskModal({ project, risk, onClose, onSaved, onDelete }) {
  const isEdit = !!risk;
  const [f, setF] = useState({
    title: risk?.title || '',
    category: risk?.category || 'Commercial / Financial',
    description: risk?.description || '',
    likelihood: risk?.likelihood || 3,
    consequence: risk?.consequence || 3,
    mitigation: risk?.mitigation || '',
    contingency: risk?.contingency || '',
    owner: risk?.owner || '',
    status: risk?.status || 'Open',
    review_date: risk?.review_date || '',
    residual_likelihood: risk?.residual_likelihood || 2,
    residual_consequence: risk?.residual_consequence || 2,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ff = (k, v) => setF(p => ({ ...p, [k]: v }));

  const rating = f.likelihood * f.consequence;
  const level = rating >= 15 ? 'Critical' : rating >= 10 ? 'High' : rating >= 5 ? 'Medium' : 'Low';
  const residualRating = f.residual_likelihood * f.residual_consequence;
  const residualLevel = residualRating >= 15 ? 'Critical' : residualRating >= 10 ? 'High' : residualRating >= 5 ? 'Medium' : 'Low';

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.patch(`/risks/${risk.id}`, { ...f, project_id: project.id });
      } else {
        await api.post('/risks', { ...f, project_id: project.id });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const ratingBg = rating >= 15 ? 'bg-red-600' : rating >= 10 ? 'bg-orange-500' : rating >= 5 ? 'bg-amber-400' : 'bg-green-500';
  const ratingText = rating >= 5 ? 'text-white' : 'text-slate-900';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{isEdit ? `Edit Risk — ${risk.ref}` : 'Register New Risk'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <form onSubmit={save} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

          <div>
            <label className="label">Risk Title *</label>
            <input className="input" value={f.title} onChange={e => ff('title', e.target.value)} required placeholder="Brief risk title..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="select" value={f.category} onChange={e => ff('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Risk Owner</label>
              <input className="input" value={f.owner} onChange={e => ff('owner', e.target.value)} placeholder="Responsible person..." />
            </div>
          </div>
          <div>
            <label className="label">Risk Description</label>
            <textarea className="input resize-none" rows={2} value={f.description} onChange={e => ff('description', e.target.value)} placeholder="Detailed description of the risk..." />
          </div>

          {/* Risk scoring */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="font-semibold text-slate-700 text-sm mb-3">Risk Scoring (Pre-Mitigation)</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Likelihood (1–5)</label>
                <input type="range" min="1" max="5" step="1" value={f.likelihood}
                  onChange={e => ff('likelihood', Number(e.target.value))} className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>Very Low</span><span className="font-bold text-slate-700">{f.likelihood}</span><span>Very High</span>
                </div>
              </div>
              <div>
                <label className="label">Consequence (1–5)</label>
                <input type="range" min="1" max="5" step="1" value={f.consequence}
                  onChange={e => ff('consequence', Number(e.target.value))} className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>Very Low</span><span className="font-bold text-slate-700">{f.consequence}</span><span>Very High</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="text-xs text-slate-500 mb-1">Risk Rating</div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${ratingBg}`}>
                  <span className={`text-2xl font-black ${ratingText}`}>{rating}</span>
                </div>
                <RiskBadge level={level} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Mitigation Measures</label>
            <textarea className="input resize-none" rows={2} value={f.mitigation} onChange={e => ff('mitigation', e.target.value)} placeholder="Actions to reduce likelihood or consequence..." />
          </div>
          <div>
            <label className="label">Contingency Plan</label>
            <textarea className="input resize-none" rows={2} value={f.contingency} onChange={e => ff('contingency', e.target.value)} placeholder="Actions if the risk materialises..." />
          </div>

          {/* Residual risk */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="font-semibold text-slate-700 text-sm mb-3">Residual Risk (Post-Mitigation)</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Residual Likelihood</label>
                <input type="range" min="1" max="5" step="1" value={f.residual_likelihood}
                  onChange={e => ff('residual_likelihood', Number(e.target.value))} className="w-full accent-green-600" />
                <div className="text-center text-xs font-bold text-slate-700">{f.residual_likelihood}</div>
              </div>
              <div>
                <label className="label">Residual Consequence</label>
                <input type="range" min="1" max="5" step="1" value={f.residual_consequence}
                  onChange={e => ff('residual_consequence', Number(e.target.value))} className="w-full accent-green-600" />
                <div className="text-center text-xs font-bold text-slate-700">{f.residual_consequence}</div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="text-xs text-slate-500 mb-1">Residual Rating</div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${residualRating >= 15 ? 'bg-red-600' : residualRating >= 10 ? 'bg-orange-500' : residualRating >= 5 ? 'bg-amber-400' : 'bg-green-500'}`}>
                  <span className="text-2xl font-black text-white">{residualRating}</span>
                </div>
                <RiskBadge level={residualLevel} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="select" value={f.status} onChange={e => ff('status', e.target.value)}>
                {['Open', 'Mitigated', 'Accepted', 'Transferred', 'Closed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Next Review Date</label>
              <input type="date" className="input" value={f.review_date} onChange={e => ff('review_date', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            {isEdit && onDelete ? (
              <button type="button" onClick={() => { if (confirm('Delete this risk?')) onDelete(); }} className="btn-danger text-xs">Delete Risk</button>
            ) : <div />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? 'Saving…' : isEdit ? 'Update Risk' : 'Register Risk'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
