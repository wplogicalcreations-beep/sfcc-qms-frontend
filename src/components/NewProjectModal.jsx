import { useEffect, useState } from 'react';
import api from '../utils/api';
import { userSafeError } from '../utils/uiMessages';

const STEPS = ['Project', 'Stakeholders', 'Dates', 'Confirm'];

export default function NewProjectModal({ onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    code:'', name:'', client:'', consultant:'', pmc:'',
    location:'', sector:'', discipline:'', scope:'',
    contract_value:'', start_date:'', end_date:''
  });
  const ff = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const closeModal = () => {
    if (!saving) onClose?.();
  };

  async function submit() {
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/projects', { ...f, contract_value: Number(f.contract_value) || 0 });
      onCreated?.(data);
      closeModal();
    } catch (e) {
      setError(userSafeError(e, 'Project could not be created. Please check the required fields and try again.'));
      setStep(0);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay no-print" onClick={closeModal}>
      <div className="modal-box max-w-3xl w-[94vw] md:w-full rounded-2xl border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Create New Project</h2>
          <button onClick={closeModal} disabled={saving} className="text-slate-400 hover:text-slate-600 text-xl leading-none disabled:opacity-40">✕</button>
        </div>

        {/* Step bar */}
        <div className="flex gap-1.5 px-6 pt-5">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-[var(--qms-gold)]' : 'bg-slate-200'}`} />
          ))}
        </div>
        <div className="px-6 pt-1.5 pb-3 text-xs text-slate-500 font-medium">Step {step + 1} of {STEPS.length}: {STEPS[step]}</div>

        <div className="px-6 pb-5 space-y-3 max-h-[72vh] overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

          {step === 0 && <>
            <Field label="Project Code *" value={f.code} onChange={v => ff('code', v)} placeholder="e.g. SFCC-RYD-002" />
            <Field label="Project Name *" value={f.name} onChange={v => ff('name', v)} placeholder="e.g. Riyadh Office Fit-out" />
            <Field label="Location" value={f.location} onChange={v => ff('location', v)} placeholder="e.g. Riyadh, KSA" />
            <Field label="Sector / Type" value={f.sector} onChange={v => ff('sector', v)} placeholder="e.g. Commercial Fit-out" />
          </>}

          {step === 1 && <>
            <Field label="Client / Employer *" value={f.client} onChange={v => ff('client', v)} placeholder="Client name" />
            <Field label="Consultant / Designer" value={f.consultant} onChange={v => ff('consultant', v)} placeholder="Consultant name" />
            <Field label="Project Management Consultant" value={f.pmc} onChange={v => ff('pmc', v)} placeholder="PMC name" />
            <Field label="Discipline / Scope" value={f.discipline} onChange={v => ff('discipline', v)} placeholder="e.g. MEP / Fit-out" />
          </>}

          {step === 2 && <>
            <Field label="Contract Value (SAR)" value={f.contract_value} onChange={v => ff('contract_value', v)} type="number" placeholder="0" />
            <Field label="Start Date" value={f.start_date} onChange={v => ff('start_date', v)} type="date" />
            <Field label="End Date" value={f.end_date} onChange={v => ff('end_date', v)} type="date" />
            <div>
              <label className="label">Scope of Work</label>
              <textarea className="input resize-none" rows={2} value={f.scope} onChange={e => ff('scope', e.target.value)} placeholder="Brief scope description..." />
            </div>
          </>}

          {step === 3 && (
            <div className="space-y-2">
              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
                {Object.entries(f).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex">
                    <span className="text-slate-400 w-36 flex-shrink-0 text-xs capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-800">{k === 'contract_value' ? 'SAR ' + Number(v).toLocaleString() : v}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                On creation: all 15 module tabs, 7 document log registers (MSL, DSL, INS, RFIL, NCRL, TRL, master log), numbering counters, and handover checklist will be auto-generated.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between px-6 pb-5">
          <button onClick={() => step > 0 ? setStep(step - 1) : closeModal()} disabled={saving} className="btn-secondary disabled:opacity-50">
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          <button
            onClick={() => { if (step < 3) setStep(step + 1); else submit(); }}
            disabled={saving || (step === 0 && (!f.code || !f.name)) || (step === 1 && !f.client)}
            className="btn-primary disabled:opacity-50"
          >
            {step === 3 ? (saving ? 'Creating…' : 'Create Project →') : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
