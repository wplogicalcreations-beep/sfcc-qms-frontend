import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { userSafeError } from '../utils/uiMessages';
import { normalizeRole } from '../utils/permissions';

const FILE_LIMITATION = 'This backup includes database records and file references. Physical uploaded files must be backed up from the uploads folder unless ZIP backup is implemented.';

function CountTable({ counts = {}, title }) {
  const rows = Object.entries(counts);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">{title}</div>
      <div className="max-h-72 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No records to display.</div>
        ) : rows.map(([table, count]) => (
          <div key={table} className="flex items-center justify-between px-4 py-2 text-sm border-b border-slate-50 last:border-0">
            <span className="font-mono text-slate-700">{table}</span>
            <span className="font-semibold text-slate-900">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ result }) {
  if (!result) return null;
  const imported = result.imported_counts || {};
  const skipped = result.skipped_counts || {};
  const duplicates = result.duplicate_details || result.duplicates || [];
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Result Summary</h2>
          <p className="text-sm text-slate-500">{result.mode === 'dry_run' || result.dry_run ? 'Dry-run validation only. No data was changed.' : 'Safe import completed without destructive overwrite or reset.'}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${(result.ok ?? (result.valid && result.error_count === 0)) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {(result.ok ?? (result.valid && result.error_count === 0)) ? 'Complete' : 'Needs attention'}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-emerald-50 p-4"><div className="text-xs uppercase tracking-wide text-emerald-700">Imported / Would import</div><div className="text-2xl font-bold text-emerald-900">{Object.values(imported).reduce((a, b) => a + Number(b || 0), 0)}</div></div>
        <div className="rounded-xl bg-amber-50 p-4"><div className="text-xs uppercase tracking-wide text-amber-700">Skipped</div><div className="text-2xl font-bold text-amber-900">{Object.values(skipped).reduce((a, b) => a + Number(b || 0), 0)}</div></div>
        <div className="rounded-xl bg-blue-50 p-4"><div className="text-xs uppercase tracking-wide text-blue-700">Warnings</div><div className="text-2xl font-bold text-blue-900">{result.warning_count || 0}</div></div>
        <div className="rounded-xl bg-red-50 p-4"><div className="text-xs uppercase tracking-wide text-red-700">Errors</div><div className="text-2xl font-bold text-red-900">{result.error_count || 0}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CountTable title="Imported / Dry-run importable counts" counts={imported} />
        <CountTable title="Skipped counts" counts={skipped} />
      </div>
      {(result.warnings || []).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold mb-2">Warnings</div>
          <ul className="list-disc pl-5 space-y-1">{result.warnings.map((warning, idx) => <li key={`${warning}-${idx}`}>{warning}</li>)}</ul>
        </div>
      )}
      {(result.errors || []).length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold mb-2">Errors</div>
          <ul className="list-disc pl-5 space-y-1">{result.errors.map((error, idx) => <li key={`${error}-${idx}`}>{error}</li>)}</ul>
        </div>
      )}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-semibold mb-2">Duplicate handling</div>
          <div className="max-h-48 overflow-auto space-y-1">
            {duplicates.slice(0, 100).map((dup, idx) => (
              <div key={`${dup.table}-${dup.id}-${idx}`}><span className="font-mono">{dup.table}</span> — {dup.id || 'unknown'} — {dup.reason}</div>
            ))}
            {duplicates.length > 100 && <div className="text-slate-500">Showing first 100 duplicates.</div>}
          </div>
        </div>
      )}
    </section>
  );
}

export default function BackupRestore({ project }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(project?.id || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const isAdmin = normalizeRole(user?.role) === 'system_admin';
  const selectedFileName = useMemo(() => file?.name || 'No file selected', [file]);

  useEffect(() => {
    if (project?.id) setProjectId(project.id);
  }, [project?.id]);

  if (!isAdmin) {
    return (
      <div className="qms-page-shell">
        <div className="qms-form-card text-red-800">
          <h1 className="text-xl font-bold">Access restricted</h1>
          <p className="mt-2 text-sm">Backup & Restore is available to System Admin users only.</p>
          <button className="btn-danger mt-4" onClick={() => navigate('/')}>Return to Projects</button>
        </div>
      </div>
    );
  }

  async function downloadBackup(url) {
    setError('');
    setBusy(url);
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || 'sfcc-qms-backup.json';
      const href = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(userSafeError(err, 'Backup export failed. Please try again or contact System Admin.'));
    } finally {
      setBusy('');
    }
  }

  function makeFormData(extra = {}) {
    const fd = new FormData();
    fd.append('backup', file);
    Object.entries(extra).forEach(([key, value]) => fd.append(key, value));
    return fd;
  }

  async function validate() {
    if (!file) return setError('Select a backup JSON file first.');
    setError('');
    setBusy('validate');
    setResult(null);
    try {
      const { data } = await api.post('/admin/backup/validate', makeFormData(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data.preview);
      setResult(data.valid ? null : { valid: false, dry_run: true, warnings: data.warnings || [], errors: data.errors || [], warning_count: data.warnings?.length || 0, error_count: data.errors?.length || 0 });
    } catch (err) {
      setError(userSafeError(err, 'Backup validation failed. Please confirm the file is a valid SFCC QMS backup JSON.'));
    } finally {
      setBusy('');
    }
  }

  async function restore(dryRun) {
    if (!file) return setError('Select a backup JSON file first.');
    if (!dryRun && !window.confirm('Confirm safe import? This will skip duplicates and will not delete, reset, or overwrite existing data.')) return;
    setError('');
    setBusy(dryRun ? 'dry-run' : 'restore');
    try {
      const { data } = await api.post('/admin/backup/restore', makeFormData({ dry_run: String(dryRun), confirm: dryRun ? 'false' : 'true' }), { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data.preview || preview);
      setResult(data);
    } catch (err) {
      const responseData = err?.response?.data;
      if (responseData && (responseData.imported_counts || responseData.skipped_counts || responseData.errors || responseData.warnings)) {
        setResult(responseData);
        setPreview(responseData.preview || preview);
        setError(userSafeError({ response: { data: { error: responseData.error || responseData.errors?.[0] } } }, 'Restore completed with issues. Review the result summary below.'));
      } else {
        setError(userSafeError(err, 'Restore operation failed. Please validate the backup and try again.'));
      }
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="qms-page-shell">
      <section className="qms-form-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--qms-gold)]">Internal system administration</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--qms-charcoal)]">Backup & Restore</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Create JSON backups, validate backup files, run dry-run checks, and perform safe imports that skip duplicates without destructive overwrite, database reset, or data deletion.</p>
          </div>
          <div className="qms-alert-warning max-w-md">
            <div className="font-semibold">Warning</div>
            <div>Backup/restore affects system data and is restricted to System Admin users.</div>
          </div>
        </div>
      </section>

      {error && <div className="qms-alert-danger font-medium">{error}</div>}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="qms-form-card">
          <h2 className="text-lg font-bold text-slate-900">Export backups</h2>
          <p className="mt-1 text-sm text-slate-500">Exports include platform database records, metadata, table counts, and file/photo/evidence references.</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="font-semibold text-slate-900">Full System Backup</div>
              <p className="mt-1 text-sm text-slate-600">Includes all major SQLite QMS tables such as projects, users, documents, history, attachments, notifications, numbering counters, progress reports, schedule records, risks, follow-ups, and templates.</p>
              <button disabled={!!busy} onClick={() => downloadBackup('/admin/backup/full')} className="btn-primary mt-3">{busy === '/admin/backup/full' ? 'Exporting…' : 'Export Full System Backup'}</button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="font-semibold text-slate-900">Current Project Backup</div>
              {project && <div className="mt-1 text-xs font-semibold text-blue-700">Current project: {project.name} ({project.code})</div>}
              <p className="mt-1 text-sm text-slate-600">Includes project-linked records only, including documents, attachments metadata, progress reports/photos, QMS links, schedule links, schedule records, risks, follow-ups, stakeholders, and safe numbering counters.</p>
              <div className="mt-3 flex gap-2">
                <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Paste project ID" className="input flex-1" />
                <button disabled={!!busy || !projectId.trim()} onClick={() => downloadBackup(`/admin/backup/project/${encodeURIComponent(projectId.trim())}`)} className="btn-primary">{busy.startsWith('/admin/backup/project') ? 'Exporting…' : 'Export Project'}</button>
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="font-semibold">File limitation</div>
              <p className="mt-1">{FILE_LIMITATION}</p>
            </div>
          </div>
        </div>

        <div className="qms-form-card">
          <h2 className="text-lg font-bold text-slate-900">Restore / import foundation</h2>
          <p className="mt-1 text-sm text-slate-500">Upload a JSON backup, validate structure, preview contents, run a dry-run, then import only after confirmation.</p>
          <div className="mt-4 space-y-4">
            <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
              <span className="font-semibold text-slate-800">Upload Backup JSON</span>
              <input type="file" accept=".json,application/json" className="mt-3 block w-full text-sm" onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                if (selected && (!selected.name.toLowerCase().endsWith('.json') || selected.size > 15 * 1024 * 1024)) {
                  setError('Select a .json backup file no larger than 15 MB.');
                  setFile(null);
                  e.target.value = '';
                  return;
                }
                setError('');
                setFile(selected);
                setPreview(null);
                setResult(null);
              }} />
              <span className="mt-2 block text-slate-500">{selectedFileName}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={!!busy || !file} onClick={validate} className="btn-secondary">{busy === 'validate' ? 'Validating…' : 'Validate Backup'}</button>
              <button disabled={!!busy || !file} onClick={() => restore(true)} className="btn-warning">{busy === 'dry-run' ? 'Checking…' : 'Dry Run / Validate'}</button>
              <button disabled={!!busy || !file || !preview} onClick={() => restore(false)} className="btn-danger">{busy === 'restore' ? 'Importing…' : 'Restore / Import'}</button>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Safe import skips duplicates by primary ID or known reference. It does not reset the database, delete existing records, overwrite active data, or intentionally alter numbering counters already present.
            </div>
          </div>
        </div>
      </section>

      {preview && (
        <section className="qms-form-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Backup Preview</h2>
              <p className="mt-1 text-sm text-slate-500">Review included tables and record counts before running import.</p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-slate-500">Version:</span> <b>{preview.backup_version}</b></div>
              <div><span className="text-slate-500">Scope:</span> <b>{preview.backup_scope}</b></div>
              <div><span className="text-slate-500">Generated:</span> <b>{preview.generated_at}</b></div>
              <div><span className="text-slate-500">Tables:</span> <b>{preview.table_count}</b></div>
              {preview.project_name && <div className="sm:col-span-2"><span className="text-slate-500">Project:</span> <b>{preview.project_name} ({preview.project_code})</b></div>}
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <CountTable title="Included tables / record counts" counts={preview.record_counts} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Warnings / limitations</div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {(preview.limitations || []).map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}
                {(preview.notes || []).map((item, idx) => <li key={`note-${idx}`}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <ResultPanel result={result} />
    </div>
  );
}
