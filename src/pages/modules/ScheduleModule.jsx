import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import { canCreate, canEdit, canUpload } from '../../utils/permissions';

const TODAY = new Date().toISOString().split('T')[0];

export default function ScheduleModule({ project }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [viewMode, setViewMode] = useState('table'); // table | gantt
  const [editId, setEditId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const allowCreate = canCreate('schedule');
  const allowEdit = canEdit('schedule');
  const allowUpload = canUpload('schedule');
  const [newTask, setNewTask] = useState({ wbs: '', activityId: '', name: '', start: '', finish: '', duration: '', percent: 0, status: 'Not Started', responsible: '', remarks: '' });
  const fileRef = useRef();


  const storageKey = `schedule_fallback_${project.id}`;

  function normalizeTask(raw = {}) {
    return {
      id: raw.id,
      project_id: raw.project_id || project.id,
      wbs: raw.wbs || '',
      activity_id: raw.activity_id || '',
      name: raw.activity_name || raw.name || '',
      start: raw.planned_start || raw.start || '',
      finish: raw.planned_finish || raw.finish || '',
      duration: raw.duration_days ?? raw.duration ?? '',
      percent: Number(raw.progress_percent ?? raw.percent ?? 0),
      status: raw.status,
      responsible: raw.responsible_person || raw.responsible || '',
      remarks: raw.remarks || '',
      source: raw.source || 'manual',
      sort_order: raw.sort_order,
    };
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const { data } = await api.get(`/schedule?project_id=${project.id}`);
      const mapped = (data || []).map(normalizeTask);
      setTasks(mapped);
      localStorage.setItem(storageKey, JSON.stringify(mapped));
      setError('');
      setSuccess('');
    } catch (err) {
      const fallback = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setTasks(fallback);
      setError('Failed to load schedule from server. Showing local fallback if available.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTasks(); }, [project.id]);

  function parseXerSections(text) {
    const lines = text.split(/\r?\n/);
    const sections = {};
    let currentSection = null;

    for (const rawLine of lines) {
      if (!rawLine) continue;
      if (!rawLine.startsWith('%')) continue;
      const marker = rawLine.slice(0, 2);
      const payload = rawLine.slice(2).replace(/^	/, '');
      const cols = payload.split('	');

      if (marker === '%T') {
        currentSection = cols[0]?.trim() || null;
        if (currentSection && !sections[currentSection]) sections[currentSection] = { fields: [], rows: [] };
        continue;
      }
      if (!currentSection || !sections[currentSection]) continue;

      if (marker === '%F') {
        sections[currentSection].fields = cols.map(c => c.trim());
        continue;
      }

      if (marker === '%R') {
        const { fields } = sections[currentSection];
        const row = {};
        const count = Math.max(fields.length, cols.length);
        for (let i = 0; i < count; i += 1) {
          const key = fields[i] || `extra_${i + 1}`;
          row[key] = cols[i] ?? '';
        }
        sections[currentSection].rows.push(row);
      }
    }

    return sections;
  }

  function findSection(sections = {}, candidates = []) {
    const names = Object.keys(sections);
    const lowered = names.map((name) => ({ name, lower: name.toLowerCase() }));
    for (const candidate of candidates) {
      const hit = lowered.find((entry) => entry.lower === candidate.toLowerCase());
      if (hit) return hit.name;
    }
    for (const candidate of candidates) {
      const hit = lowered.find((entry) => entry.lower.includes(candidate.toLowerCase()));
      if (hit) return hit.name;
    }
    return null;
  }

  function pickFieldCaseInsensitive(fields = [], candidates = []) {
    const lowered = fields.map((field) => ({ field, lower: field.toLowerCase() }));
    for (const candidate of candidates) {
      const hit = lowered.find((entry) => entry.lower === candidate.toLowerCase());
      if (hit) return hit.field;
    }
    return null;
  }

  function parseXER(text) {
    const sections = parseXerSections(text);
    const sectionNames = Object.keys(sections);
    const wbsSectionName = findSection(sections, ['WBS', 'PROJWBS', 'TASKWBS', 'WBSNODE', 'PROJECT', 'PROJ']);
    const taskSectionName = findSection(sections, ['TASK']) || 'TASK';
    const wbsSection = wbsSectionName ? sections[wbsSectionName] : { fields: [], rows: [] };
    const taskSection = sections[taskSectionName] || { fields: [], rows: [] };

    const taskWbsRefField = pickFieldCaseInsensitive(taskSection.fields, ['wbs_id', 'proj_wbs_id', 'task_wbs', 'wbs_code', 'wbs_name', 'wbs_short_name', 'parent_wbs_id']);
    const wbsIdField = pickFieldCaseInsensitive(wbsSection.fields, ['wbs_id', 'proj_wbs_id']);
    const wbsShortField = pickFieldCaseInsensitive(wbsSection.fields, ['wbs_short_name', 'wbs_code']);
    const wbsNameField = pickFieldCaseInsensitive(wbsSection.fields, ['wbs_name']);
    const parentWbsField = pickFieldCaseInsensitive(wbsSection.fields, ['parent_wbs_id']);

    console.log('[schedule-import:xer] detected section names', sectionNames);
    sectionNames.forEach((name) => {
      const info = sections[name] || { fields: [], rows: [] };
      console.log('[schedule-import:xer] section profile', {
        name,
        fieldCount: info.fields.length,
        firstFields: info.fields.slice(0, 10),
        rowCount: info.rows.length,
      });
    });
    console.info('[schedule-import:xer] TASK sample', taskSection.rows.slice(0, 3));

    const wbsById = new Map();
    const wbsParentById = new Map();
    wbsSection.rows.forEach((row) => {
      const id = String(row[wbsIdField || ''] || '').trim();
      if (!id) return;
      const shortName = String(row[wbsShortField || ''] || '').trim();
      const longName = String(row[wbsNameField || ''] || '').trim();
      wbsById.set(id, shortName || longName || '');
      wbsParentById.set(id, String(row[parentWbsField || ''] || '').trim());
    });

    const resolveWbs = (row = {}) => {
      const ref = String(row[taskWbsRefField || ''] || '').trim();
      if (!ref) return '';
      if (wbsById.has(ref)) {
        const base = wbsById.get(ref) || '';
        const parentId = wbsParentById.get(ref);
        const parent = parentId ? wbsById.get(parentId) : '';
        return parent && parent !== base ? `${parent} / ${base}` : base;
      }
      if (taskWbsRefField && ['wbs_name', 'wbs_short_name', 'wbs_code', 'task_wbs'].includes(taskWbsRefField.toLowerCase())) return ref;
      return '';
    };

    const parsedTasks = taskSection.rows.map((obj, idx) => {
      if (!obj.task_name) return null;
      return {
        id: obj.task_id || String(idx + 1),
        wbs: resolveWbs(obj),
        name: obj.task_name,
        activity_id: obj.task_code || obj.task_id || '',
        start: (obj.act_start_date || obj.early_start_date || obj.target_start_date || '').slice(0, 10),
        finish: (obj.act_end_date || obj.early_end_date || obj.target_end_date || '').slice(0, 10),
        duration: obj.target_drtn_hr_cnt ? Math.round(Number(obj.target_drtn_hr_cnt) / 8) : '',
        percent: Math.min(100, Math.max(0, Math.round(Number(obj.phys_complete_pct || 0)))),
        responsible: '',
        remarks: '',
      };
    }).filter(Boolean);

    const withWbsCount = parsedTasks.filter((t) => t.wbs).length;
    const noWbsSection = !wbsSectionName;
    if (noWbsSection) console.info('[schedule-import:xer] No WBS section was found in this XER file. Activities were imported without WBS.');

    return { tasks: parsedTasks, diagnostics: { withWbsCount, noWbsSection } };
  }

  function parseMSP(text) {
    const parsed = [];
    const matches = text.matchAll(/<Task>([\s\S]*?)<\/Task>/g);
    for (const m of matches) {
      const t = m[1];
      const get = tag => { const x = t.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`)); return x ? x[1] : ''; };
      const name = get('Name');
      if (!name || name.includes('Project Summary')) continue;
      parsed.push({
        id: get('UID'),
        wbs: get('WBS') || get('OutlineNumber') || '',
        name,
        start: get('Start')?.slice(0, 10) || '',
        finish: get('Finish')?.slice(0, 10) || '',
        duration: get('Duration')?.match(/\d+/)?.[0] || '',
        percent: Math.min(100, Math.max(0, Number(get('PercentComplete') || 0))),
        responsible: '',
        remarks: '',
      });
    }
    return parsed;
  }


  function normalizeDateInput(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function firstValue(obj = {}, keys = []) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
    }
    return null;
  }

  function normalizeImportedActivityRow(row = {}, index = 0, source = 'imported') {
    const wbs = firstValue(row, ['WBS Code', 'wbs', 'wbs_code', 'WBS', 'wbs_short_name']);
    const activityId = firstValue(row, ['Activity ID', 'task_code', 'activity_id', 'activityId', 'id', 'task_id']);
    const rawName = firstValue(row, ['Activity Name', 'task_name', 'name', 'activity_name', 'Name']);
    const activityName = rawName || activityId || wbs;
    if (!activityName) return null;

    const durationRaw = firstValue(row, ['Duration', 'remain_drtn_hr_cnt', 'duration_days', 'duration']);
    const progressRaw = firstValue(row, ['Percent Complete', 'progress', 'progress_percent', 'Progress', 'percentComplete']);
    const remarks = firstValue(row, ['remarks', 'Remarks', 'notes']);
    const responsible = firstValue(row, ['responsible_person', 'Responsible', 'responsible', 'owner']);

    return {
      wbs: wbs || null,
      activity_id: activityId || null,
      activity_name: activityName,
      planned_start: normalizeDateInput(firstValue(row, ['Start', 'target_start_date', 'planned_start', 'startDate', 'start'])),
      planned_finish: normalizeDateInput(firstValue(row, ['Finish', 'target_end_date', 'planned_finish', 'finishDate', 'finish'])),
      duration_days: Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null,
      progress_percent: Math.max(0, Math.min(100, Number(progressRaw || 0))),
      status: firstValue(row, ['status']) || 'Not Started',
      responsible_person: responsible || '',
      remarks: remarks || '',
      source,
      sort_order: index,
    };
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setError(''); setSuccess(''); setFileName(file.name);
    try {
      const text = await file.text();
      const ext = file.name.toLowerCase();
      let parsed = [];
      let fileType = '';
      if (ext.endsWith('.xer')) { const r = parseXER(text); parsed = r.tasks; fileType = 'xer'; var xerDiagnostics = r.diagnostics; }
      else if (ext.endsWith('.xml')) { parsed = parseMSP(text); fileType = 'xml'; }
      else if (ext.endsWith('.csv')) { setError('CSV schedule import is not yet implemented. Please upload XER or XML.'); setImporting(false); return; }
      else { setError('Unsupported file type. Upload Primavera .xer, MS Project .xml, or supported .csv'); setImporting(false); return; }

      const activities = parsed
        .map((row, i) => normalizeImportedActivityRow(row, i, fileType))
        .filter(Boolean);

      const payload = { project_id: project.id, replace: true, activities };
      console.info('[schedule-import] parsed', {
        fileType,
        parsedActivitiesCount: parsed.length,
        firstParsedActivity: parsed[0] || null,
        payload,
      });

      if (!activities.length) {
        setError('No valid schedule activities found in this file.');
      } else {
        const { data } = await api.post('/schedule/import', payload);
        await loadTasks();
        const importedCount = data?.imported || activities.length;
        const withWbsCount = activities.filter(a => a.wbs).length;
        const wbsNote = withWbsCount > 0
          ? ` WBS imported for ${withWbsCount} of ${importedCount} activities.`
          : (xerDiagnostics?.noWbsSection
            ? ' No WBS section was found in this XER file. Activities were imported without WBS.'
            : ' WBS values were not found in this XER file.');
        setSuccess(`Imported ${importedCount} schedule activities.${wbsNote}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid schedule import data');
    } finally { setImporting(false); }
  }

  async function updatePct(id, pct) {
    const percent = Math.min(100, Math.max(0, Number(pct)));
    try {
      await api.patch(`/schedule/${id}`, { progress_percent: percent });
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update schedule progress');
    }
    setEditId(null);
  }


  const complete = tasks.filter(t => t.percent === 100).length;
  const inProgress = tasks.filter(t => t.percent > 0 && t.percent < 100).length;
  const overdue = tasks.filter(t => t.finish && t.finish < TODAY && t.percent < 100).length;
  const notStarted = tasks.filter(t => t.percent === 0).length;

  // Gantt date range
  const datedTasks = tasks.filter(t => t.start && t.finish);
  const noDateTasks = tasks.filter(t => !t.start || !t.finish);
  const starts = datedTasks.map(t => new Date(t.start));
  const ends = datedTasks.map(t => new Date(t.finish));
  const minDate = starts.length ? new Date(Math.min(...starts)) : new Date();
  const maxDate = ends.length ? new Date(Math.max(...ends)) : new Date(Date.now() + 30 * 86400000);
  const totalDays = Math.max(1, Math.round((maxDate - minDate) / 86400000) + 1);
  const timelineTicks = Array.from({ length: totalDays }, (_, i) => {
    const day = new Date(minDate);
    day.setDate(minDate.getDate() + i);
    return day;
  });
  const groupedTasks = tasks.reduce((acc, task) => {
    const key = String(task.wbs || '').trim() || 'No WBS';
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const groupedTaskEntries = Object.entries(groupedTasks);
  const groupedTasksForTable = groupedTaskEntries.flatMap(([groupName, groupItems]) => [{ isGroupHeader: true, groupName }, ...groupItems]);
  const groupedTasksForGantt = groupedTaskEntries.flatMap(([groupName, groupItems]) => [{ isGroupHeader: true, groupName }, ...groupItems]);
  const weekTicks = timelineTicks.filter((d, idx) => idx === 0 || d.getDay() === 1);
  const monthTicks = timelineTicks.filter((d, idx) => idx === 0 || d.getDate() === 1);
  const dayColumnWidth = Math.max(14, Math.min(26, Math.round(1600 / Math.max(totalDays, 1))));
  const timelineCanvasWidth = Math.max(totalDays * dayColumnWidth, 1100);
  const leftPaneWidth = 680;
  const leftColumnsTemplate = '80px 85px 1fr 95px 95px 80px';

  function getProjectField(keys = []) {
    for (const key of keys) {
      const value = project?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return '—';
  }

  function formatDateLabel(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }


  function taskStatus(task) {
    if (task.percent >= 100) return 'Complete';
    if (task.status === 'On Hold') return 'On Hold';
    if (task.finish && task.finish < TODAY && task.percent < 100) return 'Overdue';
    if (task.percent > 0) return 'In Progress';
    return 'Not Started';
  }

  async function createTask(e) {
    e.preventDefault();
    if (!newTask.name) return;
    try {
      await api.post('/schedule', {
        project_id: project.id,
        wbs: newTask.wbs || null,
        activity_id: newTask.activityId || null,
        activity_name: newTask.name,
        planned_start: newTask.start || null,
        planned_finish: newTask.finish || null,
        duration_days: newTask.duration ? Number(newTask.duration) : null,
        progress_percent: Number(newTask.percent) || 0,
        status: newTask.status || 'Not Started',
        responsible_person: newTask.responsible || '',
        remarks: newTask.remarks || '',
        source: 'manual',
      });
      await loadTasks();
      setNewTask({ wbs: '', activityId: '', name: '', start: '', finish: '', duration: '', percent: 0, status: 'Not Started', responsible: '', remarks: '' });
      setShowNew(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save task');
    }
  }

  function dayOffset(dateText) {
    if (!dateText) return 0;
    const dt = new Date(dateText);
    return Math.max(0, Math.round((dt - minDate) / 86400000));
  }
  function barStyle(task) {
    if (!task.start || !task.finish) return { left: '0%', width: '0%', milestone: false };
    const s = new Date(task.start);
    const f = new Date(task.finish);
    const finish = f < s ? s : f;
    const left = dayOffset(task.start) * dayColumnWidth;
    const durationDays = Math.max(0, Math.round((finish - s) / 86400000) + 1);
    const width = Math.max(durationDays * dayColumnWidth, 12);
    const milestone = durationDays <= 1;
    return { left: `${left}px`, width: `${width}px`, milestone };
  }
  function statusColor(task) {
    const st = taskStatus(task);
    if (st === 'Complete') return '#16a34a';
    if (st === 'In Progress') return '#2563eb';
    if (st === 'Overdue') return '#dc2626';
    if (st === 'On Hold') return '#d97706';
    return '#64748b';
  }
  function timelineGeometry(task, width = timelineCanvasWidth) {
    if (!task?.start || !task?.finish) return null;
    const start = new Date(task.start);
    const finishRaw = new Date(task.finish);
    if (Number.isNaN(start.getTime()) || Number.isNaN(finishRaw.getTime())) return null;
    const finish = finishRaw < start ? start : finishRaw;
    const timelineStartMs = minDate.getTime();
    const total = Math.max(totalDays, 1);
    const startDay = Math.max(0, Math.round((start.getTime() - timelineStartMs) / 86400000));
    const spanDays = Math.max(0, Math.round((finish.getTime() - start.getTime()) / 86400000));
    const left = (startDay / total) * width;
    const rawWidth = (spanDays / total) * width;
    const milestone = spanDays <= 0;
    const barWidth = milestone ? 0 : Math.max(6, rawWidth);
    const progressWidth = Math.max(0, Math.min(barWidth, barWidth * ((Number(task.percent || 0)) / 100)));
    return { left, barWidth, progressWidth, milestone };
  }

  async function handlePrint(mode = 'table') {
    const reportType = mode === 'gantt' ? 'gantt' : 'table';
    try {
      setError('');
      const res = await api.get(`/pdf/schedule/${project.id}/${reportType}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (!blob.size) throw new Error('Empty PDF response');
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `programme-schedule-${reportType}-${project.code || project.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      let backendError = '';
      const blob = err?.response?.data;
      if (blob instanceof Blob) {
        try {
          const txt = await blob.text();
          const parsed = JSON.parse(txt);
          backendError = parsed?.error || '';
        } catch (_) {
          backendError = '';
        }
      }
      setError(backendError || `Failed to generate Schedule ${reportType === 'gantt' ? 'Gantt' : 'Table'} PDF. Please try again.`);
    }
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Programme & Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">Import from Primavera P6 (.xer) or Microsoft Project (.xml) — view as table or Gantt chart</p>
        </div>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {['table','gantt'].map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${viewMode===m?'bg-blue-700 text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {m === 'table' ? '≡ Table' : '▤ Gantt'}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => handlePrint('table')} className="btn-secondary no-print">🖨 Print Table</button>
          <button onClick={() => handlePrint('gantt')} className="btn-secondary no-print">🖨 Print Gantt</button>
          <button onClick={() => allowCreate && setShowNew(true)} className="btn-secondary">+ Add Task</button>
          <button onClick={() => fileRef.current.click()} className="btn-primary">📥 Import Schedule</button>
          <input ref={fileRef} type="file" accept=".xer,.xml,.csv" className="hidden" onChange={handleFile} />
        </div>
      </div>


      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4">{success}</div>}

      {loading ? (<div className="card p-6 text-sm text-slate-500">Loading schedule activities...</div>) : tasks.length === 0 ? (
        /* Empty state */
        <div className="card overflow-hidden">
          <div className="bg-slate-800 p-8 text-center">
            <div className="text-5xl mb-4 opacity-30">▤</div>
            <div className="text-white font-bold text-lg mb-2">No Schedule Imported</div>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">Import your project schedule to view activities, track progress, and identify overdue tasks.</p>
            <button onClick={() => fileRef.current.click()} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-3 rounded-xl text-sm transition-colors">
              📥 Import Schedule File
            </button>
          </div>
          <div className="qms-kpi-grid divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="p-5">
              <div className="font-bold text-slate-700 text-sm mb-2">Primavera P6 — XER Format</div>
              <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                <li>Open your project in Primavera P6</li>
                <li>File → Export → Primavera PM (XER)</li>
                <li>Select your project and export</li>
                <li>Upload the .xer file here</li>
              </ol>
            </div>
            <div className="p-5">
              <div className="font-bold text-slate-700 text-sm mb-2">Microsoft Project — XML Format</div>
              <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                <li>Open your .mpp file in MS Project</li>
                <li>File → Save As → XML Format (.xml)</li>
                <li>Save the file to your computer</li>
                <li>Upload the .xml file here</li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Import success banner */}
          <div className="flex items-center gap-3 mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <div className="flex-1">
              <span className="text-green-700 text-sm font-semibold">{fileName}</span>
              <span className="text-green-600 text-xs ml-2">— {tasks.length} activities imported</span>
            </div>
            <button onClick={() => fileRef.current.click()} className="text-xs text-blue-600 font-semibold hover:underline">↻ Re-import</button>
            <button onClick={async () => { try { await Promise.all(tasks.map(t => api.delete(`/schedule/${t.id}`))); await loadTasks(); setFileName(''); } catch (err) { setError(err.response?.data?.error || 'Failed to remove imported schedule'); } }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
          </div>

          {/* KPIs */}
          <div className="qms-kpi-grid mb-4">
            {[
              { l:'Total Activities', v:tasks.length, c:'text-blue-700' },
              { l:'Completed', v:complete, c:'text-green-700' },
              { l:'In Progress', v:inProgress, c:'text-amber-600' },
              { l:'Not Started', v:notStarted, c:'text-slate-500' },
              { l:'Overdue', v:overdue, c:'text-red-600' },
            ].map(k=>(
              <div key={k.l} className="kpi-card"><div className="text-xs text-slate-400 uppercase tracking-wide leading-tight">{k.l}</div><div className={`text-2xl font-black mt-1 ${k.c}`}>{k.v}</div></div>
            ))}
          </div>

          {/* TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-sm">Activity List — {tasks.length} tasks</span>
                <span className="text-xs text-slate-400">Click % to update progress</span>
              </div>
              <div className="qms-table-scroll">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-28">WBS</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-24">Activity ID</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Activity Name / Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-24">Planned Start</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-24">Planned Finish</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold w-14">Days</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-36">Progress</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-24">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold w-32">Responsible</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedTasksForTable.slice(0, 330).map((t, i) => {
                      if (t.isGroupHeader) {
                        return (
                          <tr key={`group-${t.groupName}-${i}`} className="bg-slate-100/80">
                            <td className="px-3 py-2 text-xs font-semibold text-slate-700" colSpan={10}>{t.groupName}</td>
                          </tr>
                        );
                      }
                      const isOver = t.finish && t.finish < TODAY && t.percent < 100;
                      const isEditing = editId === t.id;
                      return (
                        <tr key={t.id} className={`border-b border-slate-100 transition-colors ${i%2===1?'bg-slate-50/40':''} ${isOver?'bg-red-50/30':''}`}>
                          <td className="px-3 py-2 text-xs text-slate-500 font-mono max-w-28"><span className="block truncate" title={t.wbs || ''}>{t.wbs || '—'}</span></td>
                          <td className="px-3 py-2 text-xs text-slate-500 font-mono">{t.activity_id || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 max-w-xs"><span className="truncate block" title={t.name}>{t.name}</span></td>
                          <td className="px-3 py-2 text-xs text-slate-500">{t.start||'—'}</td>
                          <td className={`px-3 py-2 text-xs font-medium ${isOver?'text-red-600':'text-slate-500'}`}>{t.finish||'—'}{isOver?' ⚠':''}</td>
                          <td className="px-3 py-2 text-xs text-slate-400 text-center">{t.duration||''}</td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input type="number" min="0" max="100" defaultValue={t.percent}
                                  className="w-14 text-xs border border-blue-400 rounded px-1.5 py-0.5 outline-none"
                                  onKeyDown={e => { if (e.key==='Enter') updatePct(t.id, e.target.value); if (e.key==='Escape') setEditId(null); }}
                                  autoFocus
                                />
                                <span className="text-xs text-slate-400">%</span>
                                <button onClick={e => { const inp = e.target.previousElementSibling.previousElementSibling; updatePct(t.id, inp.value); }}
                                  className="text-xs text-green-600 font-bold">✓</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => { setEditId(t.id); }}>
                                <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                  <div className={`rounded-full h-1.5 ${t.percent===100?'bg-green-500':t.percent>0?'bg-blue-500':'bg-slate-300'}`} style={{width:`${t.percent}%`}} />
                                </div>
                                <span className="text-xs text-slate-600 font-medium group-hover:text-blue-600 transition-colors">{t.percent}%</span>
                                <span className="text-xs text-slate-300 group-hover:text-blue-400 transition-colors">✏</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.percent===100?'bg-green-100 text-green-700':t.percent>0?'bg-blue-100 text-blue-700':isOver?'bg-red-100 text-red-700':'bg-slate-100 text-slate-500'}`}>
                              {taskStatus(t)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{t.responsible || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500 max-w-xs"><span className="truncate block" title={t.remarks || ''}>{t.remarks || '—'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {groupedTasksForTable.length > 330 && <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-t">Showing first 300 of {tasks.length} activities (plus WBS group headers)</div>}
              </div>
            </div>
          )}

          {/* GANTT VIEW */}
          {viewMode === 'gantt' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm">Gantt Chart — {tasks.length} activities</div>
              {!datedTasks.length && <div className="px-4 py-4 text-sm text-slate-500 border-b border-slate-100">No valid dated activities available for timeline bars.</div>}
              <div className="qms-table-scroll">
                <div style={{ minWidth: `${leftPaneWidth + timelineCanvasWidth}px` }}>
                  <div className="grid bg-slate-800 text-white text-xs sticky top-0 z-10" style={{ gridTemplateColumns: `${leftPaneWidth}px ${timelineCanvasWidth}px` }}>
                    <div className="grid border-r border-slate-700" style={{ gridTemplateColumns: leftColumnsTemplate }}>
                      <div className="px-2 py-2 font-semibold border-r border-slate-700">WBS</div>
                      <div className="px-2 py-2 font-semibold border-r border-slate-700">Activity ID</div>
                      <div className="px-2 py-2 font-semibold border-r border-slate-700">Activity Name</div><div className="px-2 py-2 font-semibold border-r border-slate-700">Planned Start</div><div className="px-2 py-2 font-semibold border-r border-slate-700">Planned Finish</div><div className="px-2 py-2 font-semibold border-r border-slate-700">Duration</div><div className="px-2 py-2 font-semibold">Progress %</div>
                    </div>
                    <div className="px-3 py-2 font-semibold">Timeline ({minDate.toISOString().slice(0,10)} → {maxDate.toISOString().slice(0,10)})</div>
                  </div>
                  <div className="grid bg-slate-100 border-b border-slate-200 text-[10px]" style={{ gridTemplateColumns: `${leftPaneWidth}px ${timelineCanvasWidth}px` }}>
                    <div className="border-r border-slate-200" />
                    <div className="relative h-8">
                      {monthTicks.map((d, i) => (
                        <span key={`${d.toISOString()}-${i}`} className="absolute top-1 text-[9px] text-slate-600 -translate-x-1/2" style={{ left: `${dayOffset(d.toISOString().slice(0, 10)) * dayColumnWidth}px` }}>
                          {d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid bg-slate-50 border-b border-slate-200 text-[10px]" style={{ gridTemplateColumns: `${leftPaneWidth}px ${timelineCanvasWidth}px` }}>
                    <div className="border-r border-slate-200" />
                    <div className="relative h-5">
                      {weekTicks.map((d, i) => (
                        <span key={`wk-${d.toISOString()}-${i}`} className="absolute top-0 text-[9px] text-slate-400 -translate-x-1/2" style={{ left: `${dayOffset(d.toISOString().slice(0, 10)) * dayColumnWidth}px` }}>
                          {d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Tasks */}
                  {groupedTasksForGantt.slice(0, 130).map((t, i) => {
                    if (t.isGroupHeader) {
                      return (
                        <div key={`gantt-group-${t.groupName}-${i}`} className="grid border-b border-slate-200 bg-slate-100/90 items-center" style={{ height: '30px', gridTemplateColumns: `${leftPaneWidth}px ${timelineCanvasWidth}px` }}>
                          <div className="px-2 text-xs font-semibold text-slate-700 border-r border-slate-200">{t.groupName}</div>
                          <div className="bg-slate-50" />
                        </div>
                      );
                    }
                    const bs = barStyle(t);
                    const isOver = t.finish && t.finish < TODAY && t.percent < 100;
                    return (
                      <div key={t.id} className={`grid border-b border-slate-100 items-center ${i%2===1?'bg-slate-50/40':''} ${isOver?'bg-red-50/20':''}`} style={{height:'34px', gridTemplateColumns: `${leftPaneWidth}px ${timelineCanvasWidth}px`}}>
                        <div className="grid h-full border-r border-slate-100" style={{ gridTemplateColumns: leftColumnsTemplate }}>
                          <div className="px-2 text-xs text-slate-700 truncate border-r border-slate-100 flex items-center" title={t.wbs || ''}>{t.wbs || '—'}</div>
                          <div className="px-2 text-xs text-slate-600 font-mono truncate border-r border-slate-100 flex items-center" title={t.activity_id || ''}>{t.activity_id || '—'}</div>
                          <div className="px-2 text-xs text-slate-700 truncate border-r border-slate-100 flex items-center" title={t.name}>{t.name}</div><div className="px-2 text-xs text-slate-500 border-r border-slate-100 flex items-center">{t.start || '—'}</div><div className="px-2 text-xs text-slate-500 border-r border-slate-100 flex items-center">{t.finish || '—'}</div><div className="px-2 text-xs text-slate-500 border-r border-slate-100 flex items-center">{t.duration || '—'}</div><div className="px-2 text-xs text-slate-600 flex items-center">{t.percent ?? 0}%</div>
                        </div>
                        <div className="relative h-full" style={{ backgroundImage: 'linear-gradient(to right, #dbe4ef 1px, transparent 1px)', backgroundSize: `${dayColumnWidth}px 100%` }}>
                          {t.start && t.finish ? (
                            bs.milestone
                              ? <span className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45" style={{ left: bs.left, background: statusColor(t) }} />
                              : <><div className="absolute top-1/2 -translate-y-1/2 rounded-md" style={{ ...bs, height: '14px', background: statusColor(t) }} /><div className="absolute top-1/2 -translate-y-1/2 rounded-md bg-amber-300/90" style={{ left: bs.left, height: '10px', width: `${Math.max(0, Math.round((Number(t.percent || 0) / 100) * parseFloat(bs.width)))}px` }} /></>
                          ) : <span className="text-[10px] text-slate-400 px-2">No dates</span>}
                        </div>
                      </div>
                    );
                  })}
                  {groupedTasksForGantt.length > 130 && <div className="px-4 py-2 text-xs text-slate-400 border-t bg-slate-50">Gantt shows first 100 activities (plus WBS group headers). Use Table view for full list.</div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showNew && allowCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal-box max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Add Schedule Task</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={createTask} className="px-6 py-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Activity Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-600">WBS</label><input className="input" value={newTask.wbs} onChange={e => setNewTask(p => ({...p, wbs: e.target.value}))} /></div>
                  <div><label className="text-xs text-slate-600">Activity ID</label><input className="input" value={newTask.activityId} onChange={e => setNewTask(p => ({...p, activityId: e.target.value}))} /></div>
                </div>
                <div className="mt-3"><label className="text-xs text-slate-600">Activity Name / Activity Description</label>
              <input className="input" placeholder="Enter activity description" value={newTask.name} onChange={e => setNewTask(p => ({...p, name: e.target.value}))} required /></div></div>
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Dates & Progress</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-600">Planned Start Date</label><input type="date" className="input" value={newTask.start} onChange={e => setNewTask(p => ({...p, start: e.target.value}))} /></div>
                <div><label className="text-xs text-slate-600">Planned Finish Date</label><input type="date" className="input" value={newTask.finish} onChange={e => setNewTask(p => ({...p, finish: e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-600">Duration Days</label><input type="number" min="0" className="input" value={newTask.duration} onChange={e => setNewTask(p => ({...p, duration: e.target.value}))} placeholder="Duration" /></div>
                <div><label className="text-xs text-slate-600">Progress %</label><input type="number" min="0" max="100" className="input" value={newTask.percent} onChange={e => setNewTask(p => ({...p, percent: e.target.value}))} /></div>
                <div><label className="text-xs text-slate-600">Status</label><select className="input" value={newTask.status} onChange={e => setNewTask(p => ({...p, status: e.target.value}))}><option>Not Started</option><option>In Progress</option><option>Complete</option><option>On Hold</option><option>Overdue</option></select></div></div></div>
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Responsibility / Remarks</h3>
                <div><label className="text-xs text-slate-600">Responsible Person</label><input className="input" value={newTask.responsible} onChange={e => setNewTask(p => ({...p, responsible: e.target.value}))} placeholder="Responsible person" /></div>
              </div>
              <div className="mt-3"><label className="text-xs text-slate-600">Remarks</label><textarea className="input resize-none" rows={2} value={newTask.remarks} onChange={e => setNewTask(p => ({...p, remarks: e.target.value}))} placeholder="Remarks" /></div>
              <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button><button className="btn-primary" type="submit">Save Task</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
