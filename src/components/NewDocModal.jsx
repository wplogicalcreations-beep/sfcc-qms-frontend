import { useState } from 'react';
import { TYPES, DISCIPLINES, SEVERITY, getTypeLabel } from '../utils/helpers.jsx';
import api from '../utils/api';
import { userSafeError, referenceConflictMessage } from '../utils/uiMessages';

function documentSaveErrorMessage(error) {
  const message = error.response?.data?.error || error.message || '';
  if (/UNIQUE constraint failed: documents\.(?:project_id|type|ref)|document reference conflict|duplicate document reference/i.test(message)) {
    return referenceConflictMessage();
  }
  return userSafeError(error, 'This record could not be saved. Please check the required fields and try again.');
}


export default function NewDocModal({ projectId, onClose, onCreated }) {
  const [f, setF] = useState({ type:'MS', discipline:'Mech', title:'', supplier:'', area:'', severity:'', due_date:'', notes:'', commercial_value:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ff = (k, v) => setF(p => ({ ...p, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return setError('Title is required');
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/documents', { ...f, project_id: projectId, commercial_value: f.commercial_value ? Number(f.commercial_value) : 0 });
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(documentSaveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">New Controlled Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Document Type *</label>
              <select className="select" value={f.type} onChange={e => ff('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Discipline *</label>
              <select className="select" value={f.discipline} onChange={e => ff('discipline', e.target.value)}>
                {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Title / Description *</label>
            <input className="input" value={f.title} onChange={e => ff('title', e.target.value)} placeholder="e.g. VRF Outdoor Unit — Daikin 20TR" autoFocus />
          </div>

          {f.type === 'MS' && (
            <div>
              <label className="label">Supplier / Manufacturer</label>
              <input className="input" value={f.supplier} onChange={e => ff('supplier', e.target.value)} placeholder="e.g. Daikin ME, ABB, Schneider" />
            </div>
          )}

          {f.type === 'NCR' && (
            <div>
              <label className="label">Severity</label>
              <select className="select" value={f.severity} onChange={e => ff('severity', e.target.value)}>
                <option value="">Select severity</option>
                {SEVERITY.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {f.type === 'VO' && (
            <div>
              <label className="label">Commercial Value (SAR)</label>
              <input type="number" className="input" value={f.commercial_value} onChange={e => ff('commercial_value', e.target.value)} placeholder="0" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Area / Zone</label>
              <input className="input" value={f.area} onChange={e => ff('area', e.target.value)} placeholder="e.g. Zone A, Level 3" />
            </div>
            <div>
              <label className="label">Response Due Date</label>
              <input type="date" className="input" value={f.due_date} onChange={e => ff('due_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Notes / Spec Reference</label>
            <textarea className="input resize-none" rows={2} value={f.notes} onChange={e => ff('notes', e.target.value)} placeholder="Specification clause, drawing reference, notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
