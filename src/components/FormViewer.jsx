import { useState, useRef, useEffect } from 'react';
import api from '../utils/api';

const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; background:#fff; padding:0; }
  @page { size: A4 portrait; margin: 12mm 11mm; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #888; padding: 2px 3px; vertical-align: top; font-size: 7.5pt; word-break: break-word; overflow-wrap: break-word; }
  th { background: #dce6f1 !important; font-weight: bold; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .navy { background: #1a3a6b !important; color: #fff !important; font-weight: bold; padding: 2px 5px; font-size: 8pt; margin-top: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lbl { background: #f0f4f8 !important; font-weight: bold; font-size: 7pt; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sig-hdr { background: #1a3a6b !important; color: #fff !important; font-weight: bold; padding: 2px 4px; font-size: 7pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .dist { font-size: 7.5pt; margin-top: 3px; padding-top: 2px; border-top: 1px solid #888; display: flex; gap: 10px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .qms-form-print-page { width: 100%; min-height: auto; margin: 0 auto; }
  .qms-form-print-body { width: 100%; min-height: auto; padding: 9mm; border: none; }
  .qms-form-table { width: 100%; table-layout: fixed; margin-top: 2px; }
  .qms-doc-print-root { width: 100%; max-width: none; margin: 0 auto; padding: 0; transform: none; zoom: 1; box-sizing: border-box; }
  .qms-doc-print-page { width: 100%; min-height: auto; padding: 9mm; box-sizing: border-box; border: none; }
  .qms-doc-print-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .qms-doc-print-section { break-inside: avoid; page-break-inside: avoid; }
  .qms-doc-print-signatures { break-inside: avoid; page-break-inside: avoid; }
  .qms-form-header { margin-bottom: 2px; }
  .qms-form-signature { break-inside: avoid; page-break-inside: avoid; margin-top: 4px; }
  .qms-form-copy-row { break-inside: avoid; page-break-inside: avoid; }
`;

export default function FormViewer({ doc, project, stakeholders = [], onClose }) {
  const printRef = useRef();
  const [stakeList, setStakeList] = useState(stakeholders);

  useEffect(() => {
    if (!stakeholders.length && project?.id) {
      api.get(`/projects/${project.id}/stakeholders`).then(r => setStakeList(r.data)).catch(() => {});
    }
  }, [project?.id]);

  // Parse stored form_data if available
  let formData = {};
  try {
    if (doc.form_data) formData = JSON.parse(doc.form_data);
  } catch(e) {}

  const hdr = formData.hdr || {};
  const msItems = formData.msItems || [];
  const dsItems = formData.dsItems || [];
  const trItems = formData.trItems || [];
  const voItems = formData.voItems || [];
  const ir = formData.ir || {};
  const rfi = formData.rfi || {};
  const ncr = formData.ncr || {};
  const vo = formData.vo || {};

  // Get stakeholder info
  const getStake = (type) => stakeList.find(s => s.type === type || s.role?.toLowerCase().includes(type.toLowerCase()));
  const clientStake = getStake('Client');
  const consultantStake = getStake('Consultant');

  function handlePrint() {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${doc.ref}</title><style>${PRINT_CSS}</style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }

  const typeLabel = {
    MS: 'MATERIAL SUBMITTAL',
    DS: 'DRAWING SUBMITTAL',
    IR: 'INSPECTION REQUEST',
    RFI: 'REQUEST FOR INFORMATION',
    NCR: 'NON-CONFORMANCE REPORT (NCR)',
    TR: 'TRANSMITTAL',
    VO: 'VARIATION ORDER',
  }[doc.type] || doc.type;
  const isQmsSubmittal = doc.type === 'MS' || doc.type === 'DS';

  const S = {
    cell: { border:'1px solid #888', padding:'2px 3px', verticalAlign:'top', fontSize:'7.5pt', wordBreak:'break-word' },
    lbl:  { border:'1px solid #888', padding:'2px 3px', background:'#f0f4f8', fontWeight:'bold', fontSize:'7pt', whiteSpace:'nowrap', verticalAlign:'middle' },
    th:   { border:'1px solid #888', padding:'2px 3px', background:'#dce6f1', fontWeight:'bold', fontSize:'7.5pt', textAlign:'left' },
    navy: { background:'#1a3a6b', color:'#fff', fontWeight:'bold', padding:'2px 5px', fontSize:'8pt', marginTop:'4px' },
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
        {/* Toolbar */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1">
            <span className="text-amber-400 font-mono font-bold text-sm">{doc.ref}</span>
            <span className="text-slate-400 mx-2">·</span>
            <span className="text-white text-sm">{doc.title}</span>
          </div>
          <button onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
            🖨 Print / Save PDF
          </button>
          <button onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            ✕ Close
          </button>
        </div>

        {/* Form preview */}
        <div className="flex-1 overflow-y-auto bg-slate-300 p-5">
          <div ref={printRef} className={`qms-form-print-page ${isQmsSubmittal ? 'qms-doc-print-root' : ''}`} style={{width:'188mm', minHeight:'273mm', background:'#fff', padding:'6mm 7mm 8mm', margin:'0 auto', boxShadow:'0 4px 24px rgba(0,0,0,0.2)', fontFamily:'Arial, sans-serif', fontSize:'8pt', color:'#000'}}>
            <div className={`qms-form-print-body ${isQmsSubmittal ? 'qms-doc-print-page' : ''}`}>

            {/* LETTERHEAD */}
            <table className="qms-form-header" style={{width:'100%', borderCollapse:'collapse', marginBottom:'2px'}}>
              <tbody>
                <tr>
                  <td style={{width:'20%', border:'1px solid #000', padding:'4px', textAlign:'center', fontSize:'7.5pt', color:'#555'}}>
                    <div style={{fontSize:'6.5pt', color:'#888'}}>CLIENT / EMPLOYER</div>
                    <div style={{fontWeight:'bold', fontSize:'8pt', color:'#222', marginTop:'1px'}}>
                      {clientStake?.name || project?.client || '—'}
                    </div>
                  </td>
                  <td style={{width:'60%', border:'1px solid #000', padding:'5px', textAlign:'center'}}>
                    <div style={{fontWeight:'bold', fontSize:'10pt', letterSpacing:'1px', color:'#1a3a6b'}}>SILVER FOUNDATION CONTRACTING COMPANY</div>
                    <div style={{fontSize:'7pt', color:'#555', marginTop:'1px'}}>Engineering & Construction · Quality Management System</div>
                    <div style={{fontWeight:'bold', fontSize:'13pt', color:'#1a3a6b', borderTop:'1px solid #ccc', marginTop:'3px', paddingTop:'3px', letterSpacing:'0.5px'}}>
                      {typeLabel}
                    </div>
                  </td>
                  <td style={{width:'20%', border:'1px solid #000', padding:'4px', textAlign:'center', fontSize:'7.5pt', color:'#555'}}>
                    <div style={{fontSize:'6.5pt', color:'#888'}}>CONSULTANT / ENGINEER</div>
                    <div style={{fontWeight:'bold', fontSize:'8pt', color:'#222', marginTop:'1px'}}>
                      {consultantStake?.name || project?.consultant || '—'}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{border:'1px solid #000', padding:'1px 5px', fontSize:'6.5pt', color:'#666', textAlign:'right'}}>
                    Form No.: SFCC-QMS-{doc.type}-001 &nbsp;|&nbsp; Rev: {doc.revision||'R0'} &nbsp;|&nbsp; ISO 9001 / FIDIC
                  </td>
                </tr>
              </tbody>
            </table>

            {/* PROJECT INFO */}
            <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'2px', tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'16%'}} /><col style={{width:'25%'}} />
                <col style={{width:'14%'}} /><col style={{width:'18%'}} />
                <col style={{width:'12%'}} /><col style={{width:'15%'}} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={S.lbl}>PROJECT NAME</td><td style={S.cell}><strong>{project?.name||''}</strong></td>
                  <td style={S.lbl}>PROJECT NO.</td><td style={S.cell}>{project?.code||''}</td>
                  <td style={S.lbl}>CONTRACT NO.</td><td style={S.cell}></td>
                </tr>
                <tr>
                  <td style={S.lbl}>CLIENT / EMPLOYER</td><td style={S.cell}>{clientStake?.name||project?.client||''}</td>
                  <td style={S.lbl}>MAIN CONTRACTOR</td><td style={S.cell}>Silver Foundation Contracting Co.</td>
                  <td style={S.lbl}>CONSULTANT</td><td style={S.cell}>{consultantStake?.name||project?.consultant||''}</td>
                </tr>
                <tr>
                  <td style={S.lbl}>LOCATION / SITE</td><td style={S.cell}>{project?.location||''}</td>
                  <td style={S.lbl}>DATE ISSUED</td><td style={S.cell}>{hdr.issue_date||doc.issue_date||''}</td>
                  <td style={S.lbl}>DISCIPLINE</td><td style={S.cell}>{doc.discipline||hdr.discipline||''}</td>
                </tr>
                <tr>
                  <td style={S.lbl}>PMC</td><td style={S.cell}>{project?.pmc||''}</td>
                  <td style={S.lbl}>RESPONSE DUE</td><td style={S.cell}>{hdr.due_date||doc.due_date||''}</td>
                  <td style={S.lbl}>AREA / ZONE</td><td style={S.cell}>{hdr.area||doc.area||''}</td>
                </tr>
                <tr>
                  <td style={S.lbl}>REF. NO.</td>
                  <td colSpan={5} style={S.cell}><strong>{doc.ref}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* FORM BODY */}
            {doc.type === 'MS'  && <MSView  items={msItems} doc={doc} hdr={hdr} S={S} />}
            {doc.type === 'DS'  && <DSView  items={dsItems} doc={doc} hdr={hdr} S={S} />}
            {doc.type === 'IR'  && <IRView  data={ir}  doc={doc} hdr={hdr} S={S} />}
            {doc.type === 'RFI' && <RFIView data={rfi} doc={doc} hdr={hdr} S={S} />}
            {doc.type === 'NCR' && <NCRView data={ncr} doc={doc} hdr={hdr} S={S} />}
            {doc.type === 'TR'  && <TRView  items={trItems} doc={doc} hdr={hdr} S={S} project={project} />}
            {doc.type === 'VO'  && <VOView  data={vo} items={voItems} doc={doc} hdr={hdr} S={S} />}

            <SigBlock type={doc.type} S={S} />
            <DistRow />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── SHARED ───────────────────────────────────────────────────────────────────

function Sec({ n, title, sub='' }) {
  return (
    <div style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',padding:'2px 5px',fontSize:'8pt',marginTop:'4px'}}>
      {n}.&nbsp;&nbsp;{title.toUpperCase()}{sub&&<span style={{fontWeight:'normal',fontSize:'7pt'}}> · {sub}</span>}
    </div>
  );
}

function ApprCodes({ S }) {
  return (
    <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
      <tbody><tr>
        {[['A','Approved As Submitted'],['B','Approved As Noted'],['C','Not Approved / Resubmit'],['D','Disapproved'],['E','For Information Only']].map(([c,l])=>(
          <td key={c} style={{border:'1px solid #888',padding:'2px 3px',fontSize:'7pt'}}>
            <strong style={{color:'#1a3a6b'}}>{c}</strong> — {l}
          </td>
        ))}
      </tr></tbody>
    </table>
  );
}

function SigBlock({ type, S }) {
  const parties = {
    MS: ['SUBMITTED BY (Contractor)','REVIEWED BY (Consultant)','APPROVED BY (Client)'],
    DS: ['SUBMITTED BY (Contractor)','REVIEWED BY (Consultant)','APPROVED BY (Client)'],
    IR: ['CONTRACTOR — QC Inspector','CONSULTANT — Resident Engineer','CLIENT — Representative'],
    RFI:['SUBMITTED BY (Contractor)','REVIEWED BY (Consultant)','AUTHORIZED BY (Client)'],
    NCR:['PROJECT MANAGER / QC Engineer','CONTRACTOR Representative',"CLIENT'S Representative"],
    TR: ['TRANSMITTED BY (Contractor)','RECEIVED BY (Recipient)','AUTHORIZED BY'],
    VO: ['PREPARED BY (Contractor)','REVIEWED BY (Consultant)','APPROVED BY (Client)'],
  }[type] || [];
  return (
    <>
      <div className="qms-form-signature qms-doc-print-signatures" style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',padding:'2px 5px',fontSize:'8pt',marginTop:'4px'}}>SIGNATURES & AUTHORIZATION</div>
      <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
        <tbody><tr>
          {parties.map((p,i)=>(
            <td key={i} style={{border:'1px solid #888',padding:0,verticalAlign:'top',width:`${100/parties.length}%`}}>
              <div style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',padding:'2px 4px',fontSize:'7pt'}}>{p}</div>
              <div style={{padding:'2px 4px'}}>
                {['Name & Title','Signature','Date','Stamp / Seal'].map(f=>(
                  <div key={f} style={{display:'flex',borderBottom:'1px solid #eee',padding:'1px 0',alignItems:'center'}}>
                    <span style={{fontWeight:'bold',fontSize:'6.5pt',minWidth:'65px',color:'#555'}}>{f}:</span>
                    <span style={{flex:1,borderBottom:'1px solid #bbb',minHeight:'12px'}}></span>
                  </div>
                ))}
              </div>
            </td>
          ))}
        </tr></tbody>
      </table>
    </>
  );
}

function DistRow() {
  return (
    <div className="qms-form-copy-row qms-doc-print-section" style={{marginTop:'3px',display:'flex',gap:'10px',fontSize:'7.5pt',padding:'2px 0',borderTop:'1px solid #888'}}>
      {['Original: Client / Employer','Copy: Consultant','Copy: Project Manager','Copy: Contractor QC File'].map(d=>(
        <span key={d} style={{display:'inline-flex',alignItems:'center',gap:'3px'}}>
          <span style={{display:'inline-block',width:'8px',height:'8px',border:'1px solid #000',flexShrink:0}}></span>{d}
        </span>
      ))}
    </div>
  );
}

function TwoCol({ leftLabel, rightVal, S }) {
  return (
    <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
      <tbody>
        <tr>
          <td style={{width:'50%',border:'1px solid #888',padding:0,verticalAlign:'top'}}>
            <div style={{background:'#f0f4f8',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt',borderBottom:'1px solid #ccc'}}>{leftLabel}</div>
            <div style={{minHeight:'55px',padding:'4px 5px'}}></div>
          </td>
          <td style={{width:'50%',border:'1px solid #888',padding:0,verticalAlign:'top'}}>
            <div style={{background:'#f0f4f8',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt',borderBottom:'1px solid #ccc'}}>CONTRACTOR NOTES / REMARKS</div>
            <div style={{minHeight:'55px',padding:'4px 5px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>{rightVal||''}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── MATERIAL SUBMITTAL ───────────────────────────────────────────────────────
function MSView({ items, doc, hdr, S }) {
  // Get actual individual rows from stored form_data
  const storedRows = Array.isArray(items) ? items : [];
  // Filter out any row that has the collapsed title "(+ X more items)" pattern
  const cleanRows = storedRows.filter(r => r.desc && !r.desc.match(/\(\+\s*\d+\s*more/));
  // If no clean rows but we have stored rows with collapsed text, try to recover
  const displayRows = cleanRows.length > 0 ? cleanRows : 
    storedRows.length > 0 ? storedRows :
    [{ desc: doc.title?.replace(/\s*\(\+\s*\d+\s*more.*?\)/,'') || '', manufacturer: doc.supplier || '', origin: '' }];
  // Always show filled rows PLUS empty rows up to minimum 10
  const minRows = Math.max(10, displayRows.length);
  const allRows = [...displayRows];
  while (allRows.length < minRows) allRows.push({ desc:'', manufacturer:'', origin:'' });

  return (
    <>
      <Sec n="1" title="Submittal Information" />
      <table className="qms-form-table qms-doc-print-table" style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'20%'}}/><col style={{width:'30%'}}/><col style={{width:'20%'}}/><col style={{width:'30%'}}/></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>SUBMITTAL TYPE</td><td style={S.cell}>Material Submittal</td>
            <td style={S.lbl}>SPECIFICATION REF.</td><td style={S.cell}>{hdr.specRef||hdr.notes||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>PACKAGE REF.</td><td style={S.cell}>{hdr.notes||''}</td>
            <td style={S.lbl}>SUBMITTAL TYPE</td><td style={S.cell}>Material Submittal</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Material Submittal Items" />
      <table className="qms-form-table qms-doc-print-table" style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'4%'}}/><col style={{width:'18%'}}/><col style={{width:'5%'}}/><col /><col style={{width:'18%'}}/><col style={{width:'10%'}}/><col style={{width:'6%'}}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{...S.th,textAlign:'center'}}>No.</th>
            <th style={S.th}>Submittal No.</th>
            <th style={{...S.th,textAlign:'center'}}>Rev.</th>
            <th style={S.th}>Material Description / Specification</th>
            <th style={S.th}>Manufacturer / Supplier</th>
            <th style={S.th}>Origin</th>
            <th style={{...S.th,textAlign:'center'}}>Code</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((it, i) => (
            <tr key={i} style={{minHeight:'16px'}}>
              <td style={{...S.cell,textAlign:'center',background:'#f5f5f5',fontWeight:'bold'}}>{i+1}</td>
              <td style={{...S.cell,fontSize:'7pt'}}>{it.submittalNo||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.rev||''}</td>
              <td style={S.cell}>{it.desc||''}</td>
              <td style={S.cell}>{it.manufacturer||''}</td>
              <td style={S.cell}>{it.origin||''}</td>
              <td style={{...S.cell,textAlign:'center'}}></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Sec n="3" title="Approval Codes Reference" />
      <ApprCodes S={S} />
      <TwoCol leftLabel="CLIENT / CONSULTANT REVIEW COMMENTS" rightVal="" S={S} />
    </>
  );
}

// ── DRAWING SUBMITTAL ────────────────────────────────────────────────────────
function DSView({ items, doc, hdr, S }) {
  const rows = items.filter ? items : [];
  const displayRows = rows.length > 0 ? rows : [{ dwgNo: doc.ref, rev: doc.revision||'R0', title: doc.title, scale:'' }];
  const allRows = [...displayRows];
  while (allRows.length < 8) allRows.push({ dwgNo:'', rev:'', title:'', scale:'' });

  return (
    <>
      <Sec n="1" title="Submittal Information" />
      <table className="qms-form-table qms-doc-print-table" style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'20%'}}/><col style={{width:'30%'}}/><col style={{width:'20%'}}/><col style={{width:'30%'}}/></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>SUBMITTAL NO.</td><td style={S.cell}>{doc.ref}</td>
            <td style={S.lbl}>DRAWING STAGE</td><td style={S.cell}>{hdr.drawingStage||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Drawing Register" />
      <table className="qms-form-table qms-doc-print-table" style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'4%'}}/><col style={{width:'22%'}}/><col style={{width:'7%'}}/><col /><col style={{width:'8%'}}/><col style={{width:'9%'}}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{...S.th,textAlign:'center'}}>No.</th>
            <th style={S.th}>Drawing Number</th>
            <th style={{...S.th,textAlign:'center'}}>Rev.</th>
            <th style={S.th}>Drawing Title / Description</th>
            <th style={{...S.th,textAlign:'center'}}>Scale</th>
            <th style={{...S.th,textAlign:'center'}}>Appr. Code</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((it, i) => (
            <tr key={i}>
              <td style={{...S.cell,textAlign:'center',background:'#f5f5f5',fontWeight:'bold'}}>{i+1}</td>
              <td style={{...S.cell,fontSize:'7pt'}}>{it.dwgNo||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.rev||''}</td>
              <td style={S.cell}>{it.title||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.scale||''}</td>
              <td style={{...S.cell,textAlign:'center'}}></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Sec n="3" title="Approval Codes Reference" />
      <ApprCodes S={S} />
      <TwoCol leftLabel="CLIENT / CONSULTANT REVIEW COMMENTS" rightVal="" S={S} />
    </>
  );
}

// ── INSPECTION REQUEST ───────────────────────────────────────────────────────
function IRView({ data, doc, hdr, S }) {
  const attachItems = ['Sketch / Location Plan / Drawings','Test Certificate(s)','Inspection Checklist','Method Statement','Photographs / Site Evidence'];
  return (
    <>
      <Sec n="1" title="Inspection Request Details" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'14%'}}/><col style={{width:'22%'}}/><col style={{width:'12%'}}/><col style={{width:'16%'}}/>
          <col style={{width:'14%'}}/><col style={{width:'22%'}}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>INSPECTION TYPE</td>
            <td style={S.cell}>{data.inspType||doc.title||''}</td>
            <td style={S.lbl}>PRIORITY</td>
            <td style={S.cell}>{hdr.priority||'Routine'}</td>
            <td style={S.lbl}>DATE OF INSPECTION</td>
            <td style={S.cell}>{hdr.due_date||doc.due_date||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>AREA / ZONE</td>
            <td style={S.cell}>{hdr.area||doc.area||''}</td>
            <td style={S.lbl}>GRID REF.</td>
            <td style={S.cell}>{data.gridRef||''}</td>
            <td style={S.lbl}>DRAWING REF.</td>
            <td style={S.cell}>{data.drawingRef||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>REQUESTED TIME</td>
            <td style={S.cell}>{data.requestedTime||''}</td>
            <td style={S.lbl}>NOTICE (HRS)</td>
            <td style={S.cell}>{data.noticePeriod||'24'}</td>
            <td style={S.lbl}>SPEC. REF.</td>
            <td style={S.cell}>{data.specRef||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Inspection Description" />
      <div style={{border:'1px solid #888',minHeight:'50px',padding:'3px 5px',marginTop:'2px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>
        {data.description||doc.description||''}
      </div>
      <Sec n="3" title="Test Package & Attachments" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'22%'}}/><col style={{width:'28%'}}/><col style={{width:'22%'}}/><col style={{width:'28%'}}/></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>TEST PACKAGE REF.</td><td style={S.cell}>{data.testPkgRef||''}</td>
            <td style={S.lbl}>METHOD STATEMENT REF.</td><td style={S.cell}>{data.msRef||''}</td>
          </tr>
        </tbody>
      </table>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'7.5pt',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col /><col style={{width:'55px'}}/><col style={{width:'180px'}}/></colgroup>
        <thead>
          <tr>
            <th style={S.th}>Attachment / Document</th>
            <th style={{...S.th,textAlign:'center'}}>Enclosed</th>
            <th style={S.th}>File Reference / Remarks</th>
          </tr>
        </thead>
        <tbody>
          {attachItems.map((item, idx) => {
            const keyMap = ['sketch','testCert','checklist','ms','photos'];
            const checked = data.checks?.[keyMap[idx]] || false;
            return (
              <tr key={item}>
                <td style={S.cell}>{item}</td>
                <td style={{...S.cell,textAlign:'center'}}>{checked?'☑':'☐'}</td>
                <td style={S.cell}></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Sec n="4" title="Readiness Confirmation" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'22%'}}/><col style={{width:'18%'}}/><col style={{width:'22%'}}/><col /></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>READY FOR INSPECTION</td>
            <td style={S.cell}>
              {data.readyYes?'☑':'☐'} Yes &nbsp; {data.readyNo?'☑':'☐'} No
            </td>
            <td style={S.lbl}>CONTRACTOR STATEMENT</td>
            <td style={S.cell}>{data.readiness||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="5" title="Client & Contractor Remarks" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <tbody>
          <tr>
            <td style={{width:'50%',border:'1px solid #888',padding:0,verticalAlign:'top'}}>
              <div style={{background:'#f0f4f8',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt'}}>CLIENT'S COMMENTS / OBSERVATIONS</div>
              <div style={{minHeight:'28px',padding:'3px 4px'}}></div>
            </td>
            <td style={{width:'50%',border:'1px solid #888',padding:0,verticalAlign:'top'}}>
              <div style={{background:'#f0f4f8',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt'}}>CONTRACTOR'S RESPONSE / REMARKS</div>
              <div style={{minHeight:'28px',padding:'3px 4px'}}></div>
            </td>
          </tr>
        </tbody>
      </table>
      <Sec n="6" title="Inspection Outcome" />
      <div style={{border:'1px solid #888',padding:'4px 5px',marginTop:'2px',fontSize:'7.5pt',display:'flex',gap:'16px'}}>
        {data.outcomePass?'☑':'☐'} <strong>Passed</strong> &nbsp;&nbsp;
        {data.outcomeNote?'☑':'☐'} <strong>Passed with Comments</strong> &nbsp;&nbsp;
        {data.outcomeFail?'☑':'☐'} <strong>Failed — Re-inspection Required</strong>
      </div>
    </>
  );
}

// ── REQUEST FOR INFORMATION ──────────────────────────────────────────────────
function RFIView({ data, doc, hdr, S }) {
  const attachItems = ['Sketch / Location Plan','Photograph(s)','Drawing Extract','Specification Clause Extract'];
  return (
    <>
      <Sec n="1" title="RFI Details" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'14%'}}/><col style={{width:'22%'}}/><col style={{width:'16%'}}/><col style={{width:'14%'}}/><col style={{width:'12%'}}/><col style={{width:'22%'}}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>RFI REF. NO.</td>
            <td style={S.cell}>{doc.ref}</td>
            <td style={S.lbl}>DATE OF ISSUE</td>
            <td style={S.cell}>{hdr.issue_date||doc.issue_date||''}</td>
            <td style={S.lbl}>RESPONSE BY</td>
            <td style={S.cell}>{hdr.due_date||doc.due_date||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>RFI CATEGORY</td>
            <td style={S.cell}>{data.category||''}</td>
            <td style={S.lbl}>PRIORITY</td>
            <td style={S.cell}>{hdr.priority||'Routine'}</td>
            <td style={S.lbl}>AREA / ZONE</td>
            <td style={S.cell}>{hdr.area||doc.area||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>FROM (COMPANY)</td>
            <td style={S.cell}>Silver Foundation Contracting Co.</td>
            <td style={S.lbl}>TO (COMPANY)</td>
            <td style={S.cell}>{data.toCompany||''}</td>
            <td style={S.lbl}>ATTENTION</td>
            <td style={S.cell}>{data.attention||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>DRAWING REF.</td>
            <td style={S.cell}>{data.drawingRef||''}</td>
            <td style={S.lbl}>SPEC. REF.</td>
            <td style={S.cell}>{data.specRef||''}</td>
            <td style={S.lbl}>CONTRACT CLAUSE</td>
            <td style={S.cell}>{hdr.contractClause||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Information Requested" />
      <div style={{border:'1px solid #888',minHeight:'55px',padding:'3px 5px',marginTop:'2px',fontSize:'7.5pt'}}>
        <div style={{fontSize:'7pt',color:'#555',marginBottom:'2px'}}>Describe clearly — reference contract clause / spec section / drawing number:</div>
        <div style={{whiteSpace:'pre-wrap'}}>{data.question||doc.description||doc.title||''}</div>
      </div>
      <Sec n="3" title="Attachments" />
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'7.5pt',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col /><col style={{width:'55px'}}/><col style={{width:'180px'}}/></colgroup>
        <thead>
          <tr>
            <th style={S.th}>Attachment / Document</th>
            <th style={{...S.th,textAlign:'center'}}>Enclosed</th>
            <th style={S.th}>File Reference / Remarks</th>
          </tr>
        </thead>
        <tbody>
          {attachItems.map((item, idx) => {
            const keyMap = ['sketch','photos','drawingExt','specExt'];
            const checked = data.checks?.[keyMap[idx]] || false;
            return (
              <tr key={item}>
                <td style={S.cell}>{item}</td>
                <td style={{...S.cell,textAlign:'center'}}>{checked?'☑':'☐'}</td>
                <td style={S.cell}></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Sec n="4" title="Response / Clarification (For Consultant Use)" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'18%'}}/><col style={{width:'32%'}}/><col style={{width:'18%'}}/><col /></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>DATE OF RESPONSE</td><td style={S.cell}></td>
            <td style={S.lbl}>RESPONDED BY</td><td style={S.cell}></td>
          </tr>
          <tr><td colSpan={4} style={{...S.cell,minHeight:'35px',padding:'3px 5px'}}></td></tr>
        </tbody>
      </table>
    </>
  );
}

// ── NON-CONFORMANCE REPORT ───────────────────────────────────────────────────
function NCRView({ data, doc, hdr, S }) {
  return (
    <>
      <div style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',fontSize:'8pt',padding:'2px 5px',marginTop:'4px'}}>
        PART 1 — NON-CONFORMITY IDENTIFICATION <span style={{fontWeight:'normal',fontSize:'7pt'}}> · Completed by Project Manager / Engineer</span>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'14%'}}/><col style={{width:'20%'}}/><col style={{width:'14%'}}/><col style={{width:'20%'}}/>
          <col style={{width:'14%'}}/><col style={{width:'18%'}}/>
        </colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>PRIORITY</td><td style={S.cell}>{hdr.priority||'Routine'}</td>
            <td style={S.lbl}>SEVERITY</td><td style={S.cell}>{data.severity||doc.severity||''}</td>
            <td style={S.lbl}>NCR STATUS</td><td style={S.cell}>{doc.workflow_status||'Open'}</td>
          </tr>
          <tr>
            <td style={S.lbl}>SCOPE OF NON-CONFORMITY</td><td colSpan={5} style={S.cell}>{data.scope||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>DRAWING / SPEC. REF.</td><td colSpan={2} style={S.cell}>{data.drawingSpec||''}</td>
            <td style={S.lbl}>LOCATION / ZONE</td><td colSpan={2} style={S.cell}>{hdr.area||doc.area||''}</td>
          </tr>
        </tbody>
      </table>
      <div style={{background:'#f0f4f8',border:'1px solid #888',borderBottom:'none',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt',marginTop:'2px'}}>DESCRIPTION OF NON-CONFORMITY & ACTION REQUIRED</div>
      <div style={{border:'1px solid #888',minHeight:'50px',padding:'3px 5px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>
        {data.description||doc.description||doc.title||''}
      </div>
      <div style={{fontSize:'7.5pt',padding:'2px 0',borderTop:'1px solid #eee',marginTop:'2px'}}>
        <strong>Signed by Project Manager / Engineer:</strong> <span style={{display:'inline-block',width:'150px',borderBottom:'1px solid #aaa'}}></span>
        &nbsp;&nbsp;<strong>Date:</strong> <span style={{display:'inline-block',width:'70px',borderBottom:'1px solid #aaa'}}></span>
      </div>
      <div style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',fontSize:'8pt',padding:'2px 5px',marginTop:'4px'}}>PART 2 — CONTRACTOR RESPONSE & CORRECTIVE ACTION PLAN</div>
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'22%'}}/><col style={{width:'28%'}}/><col style={{width:'20%'}}/><col /></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>PROPOSED COMPLETION DATE</td><td style={S.cell}>{data.proposedDate||''}</td>
            <td style={S.lbl}>ROOT CAUSE CATEGORY</td><td style={S.cell}>{data.rootCause||''}</td>
          </tr>
        </tbody>
      </table>
      <div style={{background:'#f0f4f8',border:'1px solid #888',borderBottom:'none',padding:'2px 4px',fontWeight:'bold',fontSize:'7pt',marginTop:'2px'}}>PROPOSED CORRECTIVE ACTION</div>
      <div style={{border:'1px solid #888',minHeight:'45px',padding:'3px 5px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>{data.correctiveAction||''}</div>
      <div style={{background:'#1a3a6b',color:'#fff',fontWeight:'bold',fontSize:'8pt',padding:'2px 5px',marginTop:'4px'}}>PART 3 — VERIFICATION & CLOSURE (For Quality Control Use)</div>
      <div style={{border:'1px solid #888',minHeight:'30px',padding:'3px 5px',marginTop:'2px'}}></div>
      <div style={{fontSize:'7.5pt',display:'flex',gap:'12px',marginTop:'2px',padding:'2px 0',borderTop:'1px solid #eee'}}>
        <span><strong>Action Taken:</strong> &nbsp;☐ Accepted &nbsp;&nbsp;☐ Rejected</span>
        <span><strong>Completed Date:</strong> <span style={{display:'inline-block',width:'70px',borderBottom:'1px solid #aaa'}}></span></span>
        <span><strong>NCR Closure Date:</strong> <span style={{display:'inline-block',width:'70px',borderBottom:'1px solid #aaa'}}></span></span>
      </div>
    </>
  );
}

// ── TRANSMITTAL ──────────────────────────────────────────────────────────────
function TRView({ items, doc, hdr, S, project }) {
  const rows = items.filter ? items : [];
  const displayRows = rows.length > 0 ? rows : [{ docNo: doc.ref, rev: doc.revision||'R0', title: doc.title, copies:'1', remarks:'' }];
  const allRows = [...displayRows];
  while (allRows.length < 6) allRows.push({ docNo:'', rev:'', title:'', copies:'', remarks:'' });

  return (
    <>
      <Sec n="1" title="Transmittal Details" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'12%'}}/><col style={{width:'22%'}}/><col style={{width:'12%'}}/><col /></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>URGENCY</td><td style={S.cell}>{hdr.priority||'Routine'}</td>
            <td style={S.lbl}>PURPOSE</td><td style={S.cell}>{hdr.purpose||''}</td>
          </tr>
          <tr>
            <td style={S.lbl}>FROM (COMPANY)</td><td style={S.cell}>Silver Foundation Contracting Co.</td>
            <td style={S.lbl}>TO (COMPANY)</td><td style={S.cell}>{project?.consultant||project?.client||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Transmitted Documents" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'4%'}}/><col style={{width:'22%'}}/><col style={{width:'6%'}}/><col /><col style={{width:'7%'}}/><col style={{width:'14%'}}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{...S.th,textAlign:'center'}}>No.</th>
            <th style={S.th}>Document No. / Reference</th>
            <th style={{...S.th,textAlign:'center'}}>Rev.</th>
            <th style={S.th}>Title / Description</th>
            <th style={{...S.th,textAlign:'center'}}>Copies</th>
            <th style={S.th}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((it, i) => (
            <tr key={i}>
              <td style={{...S.cell,textAlign:'center',background:'#f5f5f5',fontWeight:'bold'}}>{i+1}</td>
              <td style={{...S.cell,fontSize:'7pt'}}>{it.docNo||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.rev||''}</td>
              <td style={S.cell}>{it.title||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.copies||''}</td>
              <td style={S.cell}>{it.remarks||''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── VARIATION ORDER ──────────────────────────────────────────────────────────
function VOView({ data, items, doc, hdr, S }) {
  const rows = items.filter ? items : [];
  const allRows = [...rows];
  while (allRows.length < 5) allRows.push({ desc:'', unit:'', qty:'', rate:'', amount:'' });
  const voTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <>
      <Sec n="1" title="Variation Details" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'14%'}}/><col style={{width:'36%'}}/><col style={{width:'14%'}}/><col /></colgroup>
        <tbody>
          <tr>
            <td style={S.lbl}>VARIATION TYPE</td><td style={S.cell}>{data.voType||''}</td>
            <td style={S.lbl}>DISCIPLINE</td><td style={S.cell}>{hdr.discipline||doc.discipline||''}</td>
          </tr>
        </tbody>
      </table>
      <Sec n="2" title="Variation Description" />
      <div style={{border:'1px solid #888',minHeight:'35px',padding:'3px 5px',marginTop:'2px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>{data.description||doc.description||doc.title||''}</div>
      <Sec n="3" title="Reason for Change / Justification" />
      <div style={{border:'1px solid #888',minHeight:'25px',padding:'3px 5px',marginTop:'2px',fontSize:'7.5pt',whiteSpace:'pre-wrap'}}>{data.justification||''}</div>
      <Sec n="4" title="Variation Items Breakdown" />
      <table style={{width:'100%',borderCollapse:'collapse',marginTop:'2px',tableLayout:'fixed'}}>
        <colgroup><col style={{width:'4%'}}/><col /><col style={{width:'10%'}}/><col style={{width:'8%'}}/><col style={{width:'13%'}}/><col style={{width:'13%'}}/></colgroup>
        <thead>
          <tr>
            <th style={{...S.th,textAlign:'center'}}>No.</th>
            <th style={S.th}>Description of Work / Item</th>
            <th style={{...S.th,textAlign:'center'}}>Unit</th>
            <th style={{...S.th,textAlign:'center'}}>Qty</th>
            <th style={{...S.th,textAlign:'center'}}>Unit Rate (SAR)</th>
            <th style={{...S.th,textAlign:'right'}}>Amount (SAR)</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((it, i) => (
            <tr key={i}>
              <td style={{...S.cell,textAlign:'center',background:'#f5f5f5',fontWeight:'bold'}}>{i+1}</td>
              <td style={S.cell}>{it.desc||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.unit||''}</td>
              <td style={{...S.cell,textAlign:'center'}}>{it.qty||''}</td>
              <td style={{...S.cell,textAlign:'right'}}>{it.rate||''}</td>
              <td style={{...S.cell,textAlign:'right',fontWeight:it.amount?'bold':'normal'}}>{it.amount?parseFloat(it.amount).toLocaleString('en-US',{minimumFractionDigits:2}):''}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{border:'1px solid #888',padding:'2px 4px',fontWeight:'bold',background:'#dce6f1',textAlign:'right',fontSize:'7.5pt'}}>TOTAL VARIATION AMOUNT (SAR)</td>
            <td style={{border:'1px solid #888',padding:'2px 4px',fontWeight:'bold',textAlign:'right',fontSize:'8pt'}}>{voTotal>0?voTotal.toLocaleString('en-US',{minimumFractionDigits:2}):''}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
