import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { ROLES, getRoleLabel, normalizeRole } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';
import { userSafeError, userSafeLoadError } from '../utils/uiMessages';

const emptyForm = { name: '', email: '', password: '', role: 'viewer', status: 'active', project_ids: [] };

export default function UsersAccess() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const roleOptions = useMemo(() => ROLES, []);
  const isSystemAdmin = normalizeRole(currentUser?.role) === 'system_admin';
  const selectedUser = users.find((u) => u.id === editingId) || null;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [userRes, projectRes] = await Promise.all([api.get('/auth/users'), api.get('/projects')]);
      setUsers(userRes.data || []);
      setProjects(projectRes.data || []);
    } catch (err) {
      setError(userSafeLoadError(err, 'Users & Access could not be loaded. Please refresh and try again.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditingId('');
    setForm(emptyForm);
    setMessage('');
    setError('');
  }

  function startEdit(user) {
    setEditingId(user.id);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'viewer',
      status: user.status || (user.is_active ? 'active' : 'inactive'),
      project_ids: user.project_ids || [],
    });
    setMessage('');
    setError('');
  }

  function toggleProject(projectId) {
    setForm((prev) => {
      const ids = new Set(prev.project_ids || []);
      if (ids.has(projectId)) ids.delete(projectId);
      else ids.add(projectId);
      return { ...prev, project_ids: [...ids] };
    });
  }



  function openDelete(user) {
    setDeleteTarget(user);
    setMessage('');
    setError('');
  }

  function closeDelete() {
    if (!deleting) setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      setError('You cannot delete your own active account.');
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    setMessage('');
    setError('');
    try {
      const { data } = await api.delete(`/auth/users/${deleteTarget.id}`);
      await load();
      if (editingId === deleteTarget.id) {
        setEditingId('');
        setForm(emptyForm);
      }
      if (data?.status === 'deactivated_due_to_history') {
        setMessage('User deactivated to preserve system history. User has existing system records and was deactivated instead of deleted to preserve audit history.');
      } else {
        setMessage('User deleted successfully.');
      }
      setDeleteTarget(null);
    } catch (err) {
      const status = err?.response?.status;
      const apiError = err?.response?.data?.error;
      if (status === 403) setError('Only System Admin can delete users.');
      else if (status === 404) setError('User not found. Refresh the users list and try again.');
      else if (apiError && !/SQLITE|constraint|syntax/i.test(apiError)) setError(apiError);
      else setError('This user could not be deleted safely. Please refresh and try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = { ...form, email: form.email.trim().toLowerCase() };
      if (editingId && !payload.password) delete payload.password;
      if (editingId) await api.patch(`/auth/users/${editingId}`, payload);
      else await api.post('/auth/users', payload);
      await load();
      const successMessage = editingId ? 'User access updated.' : 'Internal user created. Share the temporary password through an approved internal channel.';
      startCreate();
      setMessage(successMessage);
    } catch (err) {
      setError(userSafeError(err, 'This user record could not be saved. Please check the required fields and try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qms-page-shell">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--qms-gold)]">System Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--qms-charcoal)]">Users & Access</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Manage internal Silver Foundation email-based users, roles, active status, and project membership. Passwords are never displayed after saving.</p>
        </div>
        <button className="btn-secondary" onClick={startCreate}>+ New User</button>
      </div>

      <div className="qms-alert-warning">
        No email invitation or self-service password reset is implemented in this phase. System Admin sets an initial temporary password and communicates it outside the platform.
      </div>

      {error && <div className="qms-alert-danger">{error}</div>}
      {message && <div className="qms-alert-success">{message}</div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)]">
        <section className="qms-table-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--qms-sand)_42%,white)] bg-[color:color-mix(in_srgb,var(--qms-sand)_18%,white)] px-5 py-4">
            <div>
              <div className="text-base font-bold text-[var(--qms-charcoal)]">Internal Users</div>
              <p className="mt-1 text-xs text-slate-500">Active, inactive, and project-assigned internal platform accounts.</p>
            </div>
            <span className="qms-chip bg-white text-[var(--qms-charcoal)] shadow-sm">{users.length} users</span>
          </div>
          {loading ? <div className="qms-empty-state m-4">Loading internal users…</div> : (
            <div className="overflow-auto p-3">
              <table className="qms-table-professional w-full min-w-[920px] overflow-hidden rounded-xl">
                <thead className="bg-[var(--qms-charcoal)] text-[var(--qms-sand)]">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Name</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Email</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Role</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map((u, index) => <tr key={u.id} className={`${index % 2 === 1 ? 'bg-slate-50/55' : 'bg-white'} transition-colors hover:bg-[color:color-mix(in_srgb,var(--qms-sand)_18%,white)]`}>
                    <td className="px-5 py-4 align-middle">
                      <div className="font-semibold text-slate-950">{u.name}</div>
                      {u.id === currentUser?.id && <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--qms-gold)]">Current admin</div>}
                    </td>
                    <td className="px-5 py-4 align-middle text-sm text-slate-600"><span className="block max-w-[280px] truncate" title={u.email}>{u.email}</span></td>
                    <td className="px-5 py-4 align-middle"><span className="qms-chip border border-[color:color-mix(in_srgb,var(--qms-gold)_35%,white)] bg-[color:color-mix(in_srgb,var(--qms-soft-gold)_20%,white)] px-2.5 py-1 text-[11px] font-semibold text-[var(--qms-charcoal)]">{u.role_label || getRoleLabel(u.role)}</span></td>
                    <td className="px-5 py-4 align-middle"><span className={`qms-chip px-2.5 py-1 text-[11px] font-semibold ${u.status === 'active' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-slate-100 text-slate-600'}`}>{u.status}</span></td>
                    <td className="px-5 py-4 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <button className="btn-secondary min-w-[64px] px-3 py-1.5 text-xs" onClick={() => startEdit(u)}>Edit</button>
                        {isSystemAdmin && u.id !== currentUser?.id && (
                          <button className="btn-danger min-w-[72px] px-3 py-1.5 text-xs" onClick={() => openDelete(u)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>)}
                  {users.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">No internal users found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form onSubmit={save} className="qms-form-card xl:sticky xl:top-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{selectedUser ? 'Edit Internal User' : 'Create Internal User'}</h2>
            <p className="text-xs text-slate-500">Allowed roles are limited to internal Silver Foundation roles. PMO replaces the legacy document control role.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Name<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="block text-sm font-medium text-slate-700">Email<input className="input mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="block text-sm font-medium text-slate-700">Role<select className="input mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>{roleOptions.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select></label>
          <label className="block text-sm font-medium text-slate-700">Status<select className="input mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="block text-sm font-medium text-slate-700">{selectedUser ? 'New Password (optional)' : 'Temporary Password'}<input className="input mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!selectedUser} minLength={8} autoComplete="new-password" /></label>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Assigned Project Access</div>
            <div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              {projects.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={(form.project_ids || []).includes(p.id)} onChange={() => toggleProject(p.id)} /> <span>{p.code} — {p.name}</span></label>)}
              {projects.length === 0 && <div className="text-xs text-slate-500">No projects available.</div>}
            </div>
            <p className="mt-1 text-xs text-slate-500">All-project roles keep portfolio access through the permission matrix; assignments remain available for viewer and current membership-based access.</p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : (selectedUser ? 'Save Changes' : 'Create User')}</button>
            {selectedUser && <button type="button" className="btn-secondary" onClick={startCreate}>Cancel</button>}
          </div>
        </form>
      </div>


      {isSystemAdmin && (
        <section className="qms-form-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qms-gold)]">Internal rollout readiness</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--qms-charcoal)]">Internal Testing Checklist</h2>
              <p className="mt-1 text-sm text-slate-600">Use this lightweight checklist during Silver Foundation internal QA. It is intentionally static and does not create testing records or sample data.</p>
            </div>
            <span className="qms-chip bg-slate-100 text-slate-600">System Admin only</span>
          </div>
          <div className="qms-checklist-grid">
            {['Project access', 'Document creation', 'Document issue/close', 'Evidence upload', 'Notifications', 'Reports/Register export and print', 'Progress Report create/print/photos', 'Backup export/restore dry-run', 'User role access test', 'Viewer read-only test'].map((item, index) => (
              <div key={item} className="qms-checklist-item"><span className="qms-checklist-number">{index + 1}</span>{item}</div>
            ))}
          </div>
        </section>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-950">Delete user</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this user? If this user has existing project records, the system may deactivate the user instead to preserve history.
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{deleteTarget.name}</div>
              <div>{deleteTarget.email}</div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeDelete} disabled={deleting}>Cancel</button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete User'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
