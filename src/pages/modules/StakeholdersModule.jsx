import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import { canManageProjectStakeholders } from '../../utils/permissions';

const LOGO_SLOTS = [
  { key: 'sfcc', label: 'SFCC Logo' },
  { key: 'client', label: 'Client Logo' },
  { key: 'consultant', label: 'Consultant Logo' },
  { key: 'pmc', label: 'PMC Logo' },
];

const ROLES = ['Client / Employer','Consultant / Engineer','PMC','Main Contractor','Contractor','Subcontractor','Supplier','Approver','Recipient','Witness / Other'];

export default function StakeholdersModule({ project, user }) {
  const canEdit = canManageProjectStakeholders(user, project);
  const [stakeholders, setStakeholders] = useState([]);
  const [logos, setLogos] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyLogoType, setBusyLogoType] = useState('');
  const [error, setError] = useState('');
  const [tableMessage, setTableMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [logoLoadErrors, setLogoLoadErrors] = useState({});

  const [logoPreviewUrls, setLogoPreviewUrls] = useState({});

  const resolveLogoPreview = async (slotKey, logo) => {
    if (!logo?.view_url) return null;
    try {
      const response = await api.get(logo.view_url.replace('/api', ''), { responseType: 'blob' });
      if (!response?.data) return null;
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.warn(`[Stakeholders] Logo preview load failed | slot=${slotKey} | src=${logo.view_url}`);
      return null;
    }
  };

  const defaultForm = useMemo(() => ({ role: ROLES[0], company_name: '', contact_person: '', email: '', phone: '', address: '', is_default_for_role: false, active: true }), []);
  const [form, setForm] = useState(defaultForm);
  const fileInputs = useRef({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, l] = await Promise.all([api.get(`/projects/${project.id}/stakeholders`), api.get(`/projects/${project.id}/logos`)]);
      setStakeholders(Array.isArray(s.data) ? s.data : []);
      setLogos(l.data || {});
      setLogoLoadErrors({});
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load stakeholders and logos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project.id]);


  useEffect(() => {
    let mounted = true;
    const previousUrls = Object.values(logoPreviewUrls).filter(Boolean);
    const build = async () => {
      const entries = await Promise.all(LOGO_SLOTS.map(async (slot) => [slot.key, await resolveLogoPreview(slot.key, logos[slot.key]) ]));
      if (!mounted) return;
      const next = Object.fromEntries(entries);
      setLogoPreviewUrls(next);
    };
    build();
    return () => {
      mounted = false;
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [logos]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Stakeholders permissions:', { role: user?.role || '', canEdit });
    }
  }, [user?.role, canEdit]);

  const startCreate = () => { setEditing(null); setForm(defaultForm); setShowModal(true); setTableMessage(''); };
  const startEdit = (s) => { setEditing(s); setForm({ ...defaultForm, ...s, is_default_for_role: !!s.is_default_for_role, active: !!s.active }); setShowModal(true); setTableMessage(''); };

  const submit = async (e) => {
    e.preventDefault();
    setTableMessage('');
    try {
      if (editing) await api.patch(`/projects/${project.id}/stakeholders/${editing.id}`, form);
      else await api.post(`/projects/${project.id}/stakeholders`, form);
      setShowModal(false);
      setEditing(null);
      setForm(defaultForm);
      await load();
    } catch (err) {
      setTableMessage(err?.response?.data?.error || 'Failed to save stakeholder.');
    }
  };

  const uploadLogo = async (logoType, file) => {
    if (!file) return;
    setBusyLogoType(logoType);
    setError('');
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post(`/projects/${project.id}/logos/${logoType}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || `Failed to upload ${logoType} logo.`);
    } finally {
      setBusyLogoType('');
      if (fileInputs.current[logoType]) fileInputs.current[logoType].value = '';
    }
  };

  const removeLogo = async (logoType) => {
    setBusyLogoType(logoType);
    setError('');
    try {
      await api.delete(`/projects/${project.id}/logos/${logoType}`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || `Failed to remove ${logoType} logo.`);
    } finally {
      setBusyLogoType('');
    }
  };

  const setRoleDefault = async (stakeholder) => {
    setTableMessage('');
    try {
      await api.patch(`/projects/${project.id}/stakeholders/${stakeholder.id}`, { is_default_for_role: true });
      await load();
    } catch (e) {
      setTableMessage(e?.response?.data?.error || 'Failed to set default stakeholder.');
    }
  };

  const deactivateStakeholder = async (id) => {
    setTableMessage('');
    try {
      await api.delete(`/projects/${project.id}/stakeholders/${id}`);
      await load();
    } catch (e) {
      setTableMessage(e?.response?.data?.error || 'Failed to remove stakeholder.');
    }
  };

  if (loading) return <div className="p-6 text-slate-300">Loading stakeholders and logos...</div>;

  return <div className="p-6 space-y-6 stakeholders-module">
    {!!error && <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-800">Project Logos</h3>
        {!canEdit && <span className="text-xs text-slate-500">You have view-only access.</span>}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {LOGO_SLOTS.map((slot) => {
          const logo = logos[slot.key];
          const loadingLogo = busyLogoType === slot.key;
          return <div key={slot.key} className="logo-slot-card border border-slate-200 rounded-lg p-3 bg-white">
            <div className="text-sm font-semibold text-slate-700 mb-2">{slot.label}</div>
            <div className="h-28 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden mb-2">
              {logoPreviewUrls[slot.key] && !logoLoadErrors[slot.key] ? <img src={logoPreviewUrls[slot.key]} alt={slot.label} className="logo-img" onError={() => { console.warn(`[Stakeholders] Logo preview image render failed | slot=${slot.key} | src=${logoPreviewUrls[slot.key]}`); setLogoLoadErrors((prev) => ({ ...prev, [slot.key]: true })); }} /> : (slot.key === 'sfcc' && !logo ? <img src="/silver-foundation-logo.png" alt="SFCC fallback" className="logo-img opacity-60" onError={() => setLogoLoadErrors((prev) => ({ ...prev, [slot.key]: true }))}/> : (logo ? <span className="text-xs text-slate-500">Logo uploaded but preview unavailable</span> : <span className="text-xs text-slate-500">No logo uploaded</span>))}
            </div>
            <div className="text-[11px] text-slate-500 mb-2">{logo ? `${logo.original_filename} (${Math.round((logo.size_bytes || 0) / 1024)} KB)` : 'Accepted: PNG, JPG, JPEG, WEBP · Max 5MB'}</div>
            <div className="flex gap-2 flex-wrap">
              {canEdit && <>
                <input ref={(el) => { fileInputs.current[slot.key] = el; }} type="file" className="hidden" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => uploadLogo(slot.key, e.target.files?.[0])} />
                <button type="button" className="btn-secondary text-xs" disabled={loadingLogo} onClick={() => fileInputs.current[slot.key]?.click()}>{loadingLogo ? 'Uploading...' : (logo ? 'Change' : 'Upload Logo')}</button>
                {logo && <button type="button" className="btn-secondary text-xs" disabled={loadingLogo} onClick={() => removeLogo(slot.key)}>{loadingLogo ? 'Working...' : 'Remove'}</button>}
              </>}
              {!canEdit && logo?.view_url && <a href={logo.view_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">View</a>}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-800">Stakeholders & Contacts</h3>
        {canEdit ? <button className="btn-primary" onClick={startCreate}>+ Add Stakeholder</button> : <span className="text-xs text-slate-500">You have view-only access.</span>}
      </div>
      {!!tableMessage && <div className="rounded border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm mb-3">{tableMessage}</div>}
      {stakeholders.length === 0 ? <div className="rounded border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">No stakeholders added yet. Add Client, Consultant, PMC, and project contacts to drive document headers and approvals.</div> :
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-slate-600 border-b border-slate-200"><th className="py-2">Role</th><th>Company</th><th>Contact Person</th><th>Email</th><th>Phone</th><th>Default</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
        <tbody>
          {stakeholders.map((s) => <tr key={s.id} className="border-b border-slate-100">
            <td className="py-2">{s.role}</td><td>{s.company_name || '—'}</td><td>{s.contact_person || '—'}</td><td>{s.email || '—'}</td><td>{s.phone || '—'}</td><td>{s.is_default_for_role ? 'Yes' : 'No'}</td><td>{s.active ? 'Active' : 'Inactive'}</td>
            <td className="text-right space-x-2">{canEdit && <>
              <button className="text-amber-700" onClick={() => startEdit(s)}>Edit</button>
              {!s.is_default_for_role && s.active ? <button className="text-slate-700" onClick={() => setRoleDefault(s)}>Set Default</button> : null}
              {s.active ? <button className="text-red-600" onClick={() => deactivateStakeholder(s.id)}>Remove</button> : null}
            </>}</td>
          </tr>)}
        </tbody>
      </table></div>}
    </section>

    {showModal && canEdit && <div className="fixed inset-0 z-30 bg-slate-900/40 flex items-center justify-center p-4">
      <form className="card w-full max-w-2xl p-5 space-y-3" onSubmit={submit}>
        <h4 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Stakeholder' : 'Add Stakeholder'}</h4>
        <div className="grid md:grid-cols-2 gap-3">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <input className="input" placeholder="Company Name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
          <input className="input" placeholder="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-700">
          <label><input type="checkbox" checked={!!form.is_default_for_role} onChange={(e) => setForm({ ...form, is_default_for_role: e.target.checked })} /> <span className="ml-1">Default for Role</span></label>
          <label><input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> <span className="ml-1">Active</span></label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary">Save Stakeholder</button>
        </div>
      </form>
    </div>}
  </div>;
}
