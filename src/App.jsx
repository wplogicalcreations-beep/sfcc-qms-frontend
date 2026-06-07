import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Portfolio from './pages/Portfolio';
import QmsTemplateLibrary from './pages/QmsTemplateLibrary';
import BackupRestore from './pages/BackupRestore';
import UsersAccess from './pages/UsersAccess';
import { normalizeRole } from './utils/permissions';
import ProjectWrapper from './pages/ProjectWrapper';
import Layout from './components/Layout';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-[#f4f1eb] text-sm font-medium text-slate-500">Loading platform…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  const role = normalizeRole(user?.role);
  const isAdmin = role === 'system_admin';
  if (loading) return <div className="flex h-screen items-center justify-center bg-[#f4f1eb] text-sm font-medium text-slate-500">Loading platform…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Unauthorized />;
  return children;
}

function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f1eb] p-6">
      <div className="max-w-md rounded-2xl border border-[color:color-mix(in_srgb,var(--qms-sand)_60%,white)] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--qms-gold)]">Access Restricted</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--qms-charcoal)]">You do not have permission to access this page.</h1>
        <p className="mt-3 text-sm text-slate-600">If this access is required for internal testing, contact the System Admin to review your role and project assignment.</p>
      </div>
    </div>
  );
}

function PortfolioPage() {
  return (
    <Layout>
      <Portfolio />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><PortfolioPage /></Protected>} />
          <Route path="/admin/qms-form-templates" element={<Protected><Layout><QmsTemplateLibrary /></Layout></Protected>} />
          <Route path="/admin/backup-restore" element={<AdminOnly><Layout><BackupRestore /></Layout></AdminOnly>} />
          <Route path="/admin/users-access" element={<AdminOnly><Layout><UsersAccess /></Layout></AdminOnly>} />
          <Route path="/project/:projectId/:module" element={<Protected><ProjectWrapper /></Protected>} />
          <Route path="/project/:projectId" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
