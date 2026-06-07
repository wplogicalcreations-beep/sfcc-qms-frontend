import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout.jsx';
import Dashboard from './modules/Dashboard.jsx';
import DocControl from './modules/DocControl.jsx';
import SliceModule from './modules/SliceModule.jsx';
import SafetyModule from './modules/SafetyModule.jsx';
import ApprovalsModule from './modules/ApprovalsModule.jsx';
import HandoverModule from './modules/HandoverModule.jsx';
import ReportsModule from './modules/ReportsModule.jsx';
import SetupModule from './modules/SetupModule.jsx';
import RiskModule from './modules/RiskModule.jsx';
import ScheduleModule from './modules/ScheduleModule.jsx';
import ProgressModule from './modules/ProgressModule.jsx';
import StakeholdersModule from './modules/StakeholdersModule.jsx';
import NCRModule from './modules/NCRModule.jsx';
import FollowUpsModule from './modules/FollowUpsModule.jsx';
import BackupRestore from './BackupRestore.jsx';
import { canView } from '../utils/permissions.js';

export default function ProjectWrapper() {
  const { projectId, module: mod } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${projectId}`)
      .then(r => { setProject(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading project...
      </div>
    </Layout>
  );

  if (!project) return (
    <Layout>
      <div className="p-6 text-red-500">Project not found.</div>
    </Layout>
  );


  if (!canView(mod === 'site-instructions' ? 'site-instructions' : mod)) return (
    <Layout project={project}>
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">You do not have permission to access this page.</h1>
        </div>
      </div>
    </Layout>
  );

  function renderModule() {
    switch (mod) {
      case 'dashboard':    return <Dashboard project={project} />;
      case 'setup':        return <SetupModule project={project} onUpdate={setProject} />;
      case 'stakeholders': return <StakeholdersModule project={project} />;
      case 'documents':    return <DocControl project={project} />;
      case 'submittals':   return <SliceModule project={project} types={['MS']} title="Material Submittals Register" />;
      case 'drawings':     return <SliceModule project={project} types={['DS']} title="Drawing Submittals Register" />;
      case 'rfi':          return <SliceModule project={project} types={['RFI']} title="Request for Information Register" />;
      case 'inspections':  return <SliceModule project={project} types={['IR']} title="Inspection Request Register" />;
      case 'ncr':          return <NCRModule project={project} />;
      case 'transmittals': return <SliceModule project={project} types={['TR']} title="Transmittals Register" />;
      case 'site-instructions': return <SliceModule project={project} types={['SI']} title="Site Instructions Register" />;
      case 'safety':       return <SafetyModule project={project} />;
      case 'approvals':    return <ApprovalsModule project={project} />;
      case 'handover':     return <HandoverModule project={project} />;
      case 'reports':      return <ReportsModule project={project} />;
      case 'schedule':     return <ScheduleModule project={project} />;
      case 'risks':        return <RiskModule project={project} />;
      case 'progress':     return <ProgressModule project={project} />;
      case 'followups':    return <FollowUpsModule project={project} />;
      case 'backup-restore': return <BackupRestore project={project} />;
      default:             return <Dashboard project={project} />;
    }
  }

  return <Layout project={project}>{renderModule()}</Layout>;
}
