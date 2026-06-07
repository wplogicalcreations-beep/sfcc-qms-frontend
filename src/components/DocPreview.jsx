import { useEffect, useState } from 'react';

export default function DocPreview({ attachment, docId, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [error, setError] = useState('');

  if (!attachment) return null;

  const ext = attachment.original_name.split('.').pop()?.toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDwg = ['dwg','dxf'].includes(ext);
  const url = `/api/documents/${docId}/attachments/${attachment.id}/download`;

  useEffect(() => {
    let objectUrl = '';
    const token = localStorage.getItem('sfcc_token');
    if (!token) { setError('You are not logged in. Please sign in again.'); return; }

    async function loadFile() {
      try {
        setError('');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'You do not have permission to access this file.' : 'Failed to load file preview.');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (e) {
        setError(e.message || 'Failed to load file preview.');
      }
    }

    loadFile();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  const fileIcon = isPdf ? '📕' : isImage ? '🖼' : isDwg ? '📐' : ext === 'xlsx' || ext === 'xls' ? '📗' : ext === 'docx' || ext === 'doc' ? '📘' : '📄';

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:10000,display:'flex',flexDirection:'column'}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      {/* Header */}
      <div style={{background:'#0f172a',color:'#fff',padding:'10px 16px',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
        <span style={{fontSize:'20px'}}>{fileIcon}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:'bold',fontSize:'13px'}}>{attachment.original_name}</div>
          <div style={{fontSize:'11px',color:'#94a3b8'}}>{fmtSize(attachment.file_size)} · Uploaded {attachment.uploaded_at?.slice(0,10)}</div>
        </div>
        <a href={fileUrl || '#'} download={attachment.original_name}
          style={{background:'#2563eb',color:'#fff',fontWeight:'bold',fontSize:'12px',padding:'6px 14px',borderRadius:'7px',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'5px'}}>
          ↓ Download
        </a>
        <button onClick={onClose}
          style={{background:'#334155',color:'#fff',fontWeight:'bold',fontSize:'13px',padding:'6px 12px',borderRadius:'7px',border:'none',cursor:'pointer'}}>
          ✕ Close
        </button>
      </div>

      {/* Preview area */}
      <div style={{flex:1,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:'#1e293b',padding:'16px'}}>
        {error ? (<div style={{color:'#fecaca',fontSize:'14px',background:'#7f1d1d',padding:'10px 14px',borderRadius:'8px'}}>{error}</div>) : isImage ? (
          <img src={fileUrl} alt={attachment.original_name}
            style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:'8px',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}
            onLoad={()=>setLoaded(true)} />
        ) : isPdf ? (
          <div style={{width:'100%',height:'100%',position:'relative'}}>
            {!loaded && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:'14px'}}>
                Loading PDF preview...
              </div>
            )}
            <iframe
              src={fileUrl ? `${fileUrl}#toolbar=1&navpanes=0` : ''}
              style={{width:'100%',height:'100%',border:'none',borderRadius:'8px'}}
              onLoad={()=>setLoaded(true)}
              title={attachment.original_name}
            />
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:'16px',padding:'40px',textAlign:'center',maxWidth:'400px'}}>
            <div style={{fontSize:'64px',marginBottom:'16px'}}>{fileIcon}</div>
            <div style={{fontWeight:'bold',fontSize:'16px',color:'#1e293b',marginBottom:'8px'}}>{attachment.original_name}</div>
            <div style={{color:'#64748b',fontSize:'13px',marginBottom:'24px'}}>{fmtSize(attachment.file_size)}</div>
            <p style={{color:'#94a3b8',fontSize:'12px',marginBottom:'20px'}}>
              {isDwg ? 'DWG/DXF files cannot be previewed in the browser. Download to open in AutoCAD or a DWG viewer.' :
               'This file type cannot be previewed in the browser.'}
            </p>
            <a href={fileUrl || '#'} download={attachment.original_name}
              style={{background:'#2563eb',color:'#fff',fontWeight:'bold',fontSize:'13px',padding:'10px 24px',borderRadius:'9px',textDecoration:'none',display:'inline-block'}}>
              ↓ Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
