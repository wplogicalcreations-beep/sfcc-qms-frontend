import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { canPerform } from '../../utils/permissions';
import { userSafeError } from '../../utils/uiMessages';

function Field({ label, value, onChange, disabled, type = 'text' }) {
  return <div><label className="label">{label}</label><input disabled={disabled} type={type} className="input" value={value ?? ''} onChange={onChange} /></div>;
}

export default function SetupModule({ project, onUpdate }) {
  const { user } = useAuth();
  const canEdit = canPerform('projects.edit', user);
  const [f, setF] = useState({ ...project });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { setF({ ...project }); }, [project.id]);
  const ff = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/projects/${project.id}`, f);
      onUpdate?.(data);
      setMsg('Settings saved successfully');
    } catch (e) { setMsg(userSafeError(e, 'Project settings could not be saved. Please check required fields and try again.')); } finally { setSaving(false); }
  }

  return (
    <div className="qms-page-shell"><h1 className="page-title mb-5">Project Setup & Configuration</h1>{!canEdit && <div className="qms-readonly-banner mb-4">Viewer/read-only access: project setup fields are displayed for reference only.</div>}<form onSubmit={save} className="qms-responsive-grid gap-4">
      <div className="card p-5 space-y-3"><h2 className="text-sm font-bold text-slate-700 uppercase">Basic Project Information</h2><Field label="Project Name" value={f.name} onChange={(e)=>ff('name', e.target.value)} disabled={!canEdit} /><Field label="Project Code" value={f.code} onChange={(e)=>ff('code', e.target.value)} disabled={!canEdit} /><Field label="Project Manager" value={f.project_manager} onChange={(e)=>ff('project_manager', e.target.value)} disabled={!canEdit} /><Field label="Client" value={f.client} onChange={(e)=>ff('client', e.target.value)} disabled={!canEdit} /><Field label="Consultant" value={f.consultant} onChange={(e)=>ff('consultant', e.target.value)} disabled={!canEdit} /><Field label="Location" value={f.location} onChange={(e)=>ff('location', e.target.value)} disabled={!canEdit} /><Field label="Target Completion Date" value={f.target_completion_date} onChange={(e)=>ff('target_completion_date', e.target.value)} disabled={!canEdit} type="date" /></div>
      <div className="space-y-4">
        <div className="card p-5 space-y-3"><h2 className="text-sm font-bold text-slate-700 uppercase">Financial Information</h2><Field label="Contract Value" value={f.contract_value} onChange={(e)=>ff('contract_value', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Planned Budget" value={f.planned_budget} onChange={(e)=>ff('planned_budget', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Actual Cost" value={f.actual_cost} onChange={(e)=>ff('actual_cost', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Forecast Cost" value={f.forecast_cost} onChange={(e)=>ff('forecast_cost', Number(e.target.value))} disabled={!canEdit} type="number" /><div><label className="label">Budget Status</label><select disabled={!canEdit} className="select" value={f.budget_status||''} onChange={e=>ff('budget_status',e.target.value)}>{['On Budget','Warning','Over Budget'].map(v=><option key={v}>{v}</option>)}</select></div></div>
        <div className="card p-5 space-y-3"><h2 className="text-sm font-bold text-slate-700 uppercase">Progress & Schedule</h2><Field label="Start Date" value={f.start_date} onChange={(e)=>ff('start_date', e.target.value)} disabled={!canEdit} type="date" /><Field label="End Date" value={f.end_date} onChange={(e)=>ff('end_date', e.target.value)} disabled={!canEdit} type="date" /><Field label="Planned Progress (%)" value={f.planned_progress} onChange={(e)=>ff('planned_progress', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Actual Progress (%)" value={f.actual_progress} onChange={(e)=>ff('actual_progress', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Phase Remaining Days" value={f.phase_remaining_days} onChange={(e)=>ff('phase_remaining_days', Number(e.target.value))} disabled={!canEdit} type="number" /><Field label="Projects Timeline Start" value={f.portfolio_timeline_start} onChange={(e)=>ff('portfolio_timeline_start', e.target.value)} disabled={!canEdit} type="date" /><Field label="Projects Timeline End" value={f.portfolio_timeline_end} onChange={(e)=>ff('portfolio_timeline_end', e.target.value)} disabled={!canEdit} type="date" /><div><label className="label">Schedule Status</label><input disabled={!canEdit} className="input" value={f.schedule_status||''} onChange={e=>ff('schedule_status',e.target.value)} /></div></div>
        <div className="card p-5 space-y-3"><h2 className="text-sm font-bold text-slate-700 uppercase">Risks / Resources & Notes</h2><Field label="Resource Status" value={f.resource_status} onChange={(e)=>ff('resource_status', e.target.value)} disabled={!canEdit} /><Field label="Risk Status" value={f.risk_status} onChange={(e)=>ff('risk_status', e.target.value)} disabled={!canEdit} /><div><label className="label">Project Execution Follow-Ups / Management Notes</label><textarea disabled={!canEdit} className="input" rows={2} value={f.key_highlights||''} onChange={e=>ff('key_highlights',e.target.value)} /></div><div><label className="label">Key Issues</label><textarea disabled={!canEdit} className="input" rows={2} value={f.key_issues||''} onChange={e=>ff('key_issues',e.target.value)} /></div><div><label className="label">Pending Decisions</label><textarea disabled={!canEdit} className="input" rows={2} value={f.pending_decisions||''} onChange={e=>ff('pending_decisions',e.target.value)} /></div><div><label className="label">Pending Actions</label><textarea disabled={!canEdit} className="input" rows={2} value={f.pending_actions||''} onChange={e=>ff('pending_actions',e.target.value)} /></div></div>
        {msg && <div className={`qms-alert ${msg.includes('successfully') ? 'qms-alert-success' : 'qms-alert-danger'}`}>{msg}</div>}
        <button disabled={saving || !canEdit} className="w-full btn-primary disabled:opacity-50">{canEdit ? (saving?'Saving…':'Save Project Settings') : 'Read-only access'}</button>
      </div>
    </form></div>
  );
}
