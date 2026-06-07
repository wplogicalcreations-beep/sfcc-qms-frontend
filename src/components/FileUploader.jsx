import { useState, useRef } from 'react';
import api from '../utils/api';
import DocPreview from './DocPreview.jsx';
import { userSafeError } from '../utils/uiMessages';

export default function FileUploader({ docId, projectId, attachments = [], onUploaded, allowUpload = true }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const inputRef = useRef();

  async function handleFiles(files) {
    if (!files.length) return;
    setUploading(true); setError('');
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/documents/${docId}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      onUploaded?.();
    } catch (e) {
      setError(userSafeError(e, 'Upload failed. Please check the file and try again.'));
    } finally {
      setUploading(false);
    }
  }

  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function getIcon(filename) {
    if (!filename) return '📄';
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons = { pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', csv:'📗', jpg:'🖼', jpeg:'🖼', png:'🖼', webp:'🖼' };
    return icons[ext] || '📄';
  }

  return (
    <div className="mt-4">
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Evidence & Attachments</div>

      {/* Drop zone */}
      {allowUpload ? <div
        onDrop={e => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
      >
        <div className="text-2xl mb-1">📎</div>
        <div className="text-sm text-slate-500 font-medium">
          {uploading ? 'Uploading…' : 'Click or drag files here to upload'}
        </div>
        <div className="text-xs text-slate-400 mt-1">PDF, Word, Excel, CSV, JPG/PNG/WEBP — max 50MB each</div>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files))}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp" />
      </div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">Read-only access. Evidence upload is not permitted for your role.</div>}

      {error && <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {downloadError && <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{downloadError}</div>}

      {/* Files list */}
      {attachments.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-base flex-shrink-0">{getIcon(att.original_name)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-700 truncate">{att.original_name}</div>
                <div className="text-xs text-slate-400">{fmtSize(att.file_size)} · {att.uploaded_at?.slice(0,10)}</div>
              </div>
              <button
                onClick={() => setPreview(att)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                👁 Preview
              </button>
              <button
                onClick={async () => {
                  setDownloadError('');
                  try {
                    const token = localStorage.getItem('sfcc_token');
                    if (!token) throw new Error('You are not logged in. Please sign in again.');
                    const res = await fetch(`/api/documents/${docId}/attachments/${att.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'You do not have permission to download this file.' : 'Download failed.');
                    const blob = await res.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = objectUrl;
                    link.download = att.original_name;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(objectUrl);
                  } catch (e) {
                    setDownloadError(e.message || 'Download failed.');
                  }
                }}
                className="text-xs text-green-700 hover:text-green-900 font-semibold bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                ↓ Download
              </button>
            </div>
          ))}
        </div>
      ) : (
        !uploading && <div className="mt-2 text-xs text-slate-400 text-center">No files attached yet</div>
      )}

      {/* Preview modal */}
      {preview && (
        <DocPreview
          attachment={preview}
          docId={docId}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
