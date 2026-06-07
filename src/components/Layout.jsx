import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { canView as canViewModule, getRoleLabel, normalizeRole } from '../utils/permissions';
import { userSafeError } from '../utils/uiMessages';

const BellIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4c-.4-.4-.6-.9-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 0 0 4 0" />
  </svg>
);

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',                group: 'project' },
  { id: 'setup',        label: 'Project Setup',            group: 'project' },
  { id: 'stakeholders', label: 'Stakeholders',             group: 'project' },
  { id: 'documents',    label: 'Document Control',         group: 'docs' },
  { id: 'submittals',   label: 'Material Submittals',      group: 'docs' },
  { id: 'drawings',     label: 'Drawing Submittals',       group: 'docs' },
  { id: 'rfi',          label: 'Requests for Information', group: 'docs' },
  { id: 'inspections',  label: 'Inspection Requests',      group: 'docs' },
  { id: 'ncr',          label: 'Non-Conformance Reports',  group: 'docs' },
  { id: 'transmittals', label: 'Transmittals',             group: 'docs' },
  { id: 'site-instructions', label: 'Site Instructions',      group: 'docs' },
  { id: 'safety',       label: 'Safety & Compliance',      group: 'safety' },
  { id: 'schedule',     label: 'Programme / Schedule',     group: 'technical' },
  { id: 'risks',        label: 'Risk Register',            group: 'technical' },
  { id: 'progress',     label: 'Progress Reports',         group: 'technical' },
  { id: 'followups',    label: 'Project Execution Follow-Ups', group: 'technical' },
  { id: 'approvals',    label: 'Approvals Register',       group: 'control' },
  { id: 'handover',     label: 'Handover & Closeout',      group: 'control' },
  { id: 'reports',      label: 'Reports & Exports',        group: 'control' },
  { id: 'backup-restore', label: 'Backup & Restore',       group: 'control', adminOnly: true },
];

const MODULE_PERMISSIONS = {
  dashboard: 'project:read',
  setup: 'project:read',
  stakeholders: 'stakeholders:read',
  documents: 'documents:read',
  submittals: 'documents:read',
  drawings: 'documents:read',
  rfi: 'documents:read',
  inspections: 'documents:read',
  ncr: 'documents:read',
  transmittals: 'documents:read',
  'site-instructions': 'documents:read',
  safety: 'safety:read',
  schedule: 'project:read',
  risks: 'risks:read',
  progress: 'progress:read',
  followups: 'project:read',
  approvals: 'approvals:view',
  handover: 'handover:read',
  reports: 'project:read',
  'backup-restore': 'admin:backup',
};

const ROLE_PERMISSIONS = {
  system_admin: ['*'],
  admin: ['*'],
  project_manager: ['project:read', 'documents:read', 'safety:read', 'progress:read', 'risks:read', 'stakeholders:read', 'handover:read', 'approvals:view'],
  qa_qc_engineer: ['project:read', 'documents:read', 'progress:read', 'risks:read', 'stakeholders:read', 'handover:read'],
  pmo: ['project:read', 'documents:read', 'stakeholders:read', 'handover:read', 'approvals:view'],
  project_engineer: ['project:read', 'documents:read', 'progress:read', 'risks:read', 'stakeholders:read', 'handover:read'],
  site_engineer: ['project:read', 'safety:read', 'risks:read', 'documents:read', 'stakeholders:read', 'handover:read'],
  viewer: ['project:read', 'documents:read', 'safety:read', 'progress:read', 'risks:read', 'stakeholders:read', 'handover:read'],
};

const GROUPS = {
  project: 'PROJECT',
  docs: 'DOCUMENT CONTROL',
  safety: 'SAFETY',
  technical: 'TECHNICAL',
  control: 'CONTROL & CLOSEOUT',
};

const Icon = ({ children, className = 'sidebar-icon-svg' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    {children}
  </svg>
);

const ICONS = {
  layoutDashboard: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></>,
  settings: <><path d="M11.99 2.75a1 1 0 0 1 .98.83l.22 1.47a6.7 6.7 0 0 1 1.5.62l1.21-.86a1 1 0 0 1 1.28.1l1.72 1.72a1 1 0 0 1 .1 1.28l-.86 1.21c.24.48.44.98.6 1.5l1.48.22a1 1 0 0 1 .83.98v2.43a1 1 0 0 1-.83.98l-1.47.22a6.7 6.7 0 0 1-.62 1.5l.86 1.21a1 1 0 0 1-.1 1.28l-1.72 1.72a1 1 0 0 1-1.28.1l-1.21-.86a6.7 6.7 0 0 1-1.5.6l-.22 1.48a1 1 0 0 1-.98.83H9.57a1 1 0 0 1-.98-.83l-.22-1.47a6.7 6.7 0 0 1-1.5-.62l-1.21.86a1 1 0 0 1-1.28-.1l-1.72-1.72a1 1 0 0 1-.1-1.28l.86-1.21a6.7 6.7 0 0 1-.6-1.5l-1.48-.22a1 1 0 0 1-.83-.98V9.57a1 1 0 0 1 .83-.98l1.47-.22c.16-.52.37-1.02.62-1.5l-.86-1.21a1 1 0 0 1 .1-1.28L4.38 2.66a1 1 0 0 1 1.28-.1l1.21.86c.48-.24.98-.44 1.5-.6l.22-1.48a1 1 0 0 1 .98-.83h2.42Zm-1.2 6.1a3.5 3.5 0 1 0 0 7.01 3.5 3.5 0 0 0 0-7Z"/></>,
  users: <><path d="M16 13a4 4 0 1 0-3.99-4A4 4 0 0 0 16 13ZM8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.79-6 4v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1c0-2.21-2.7-4-6-4Zm8.02 1.02c1.73.3 3.98 1.34 3.98 2.98v1a1 1 0 0 1-1 1h-3.42c.27-.4.42-.88.42-1.4v-.6c0-1.17-.37-2.22-.98-2.98Z"/></>,
  folderOpen: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4.22c.66 0 1.3.26 1.77.73l.8.77H18.5A2.5 2.5 0 0 1 21 9v1H7.2a2 2 0 0 0-1.9 1.37L3 18.3V7.5ZM6.25 12h15.47a1.3 1.3 0 0 1 1.24 1.67l-2.03 6.5A2.5 2.5 0 0 1 18.54 22H4.73a1.8 1.8 0 0 1-1.72-2.34l2.03-6.5A2.5 2.5 0 0 1 6.25 12Z"/></>,
  package: <><path d="M11.06 2.74a2 2 0 0 1 1.88 0l6.5 3.58A2 2 0 0 1 20.5 8.1v7.8a2 2 0 0 1-1.06 1.78l-6.5 3.58a2 2 0 0 1-1.88 0l-6.5-3.58A2 2 0 0 1 3.5 15.9V8.1a2 2 0 0 1 1.06-1.78l6.5-3.58ZM5.9 8.22 12 11.6l6.1-3.38L12 4.84 5.9 8.22Zm7.1 11.5 5-2.75v-5.2l-5 2.76v5.2Zm-2 0v-5.2l-5-2.76v5.2l5 2.75Z"/></>,
  fileStack: <><path d="M7 2a2 2 0 0 0-2 2v12h2V4h7v5h5v7h2V8.41a2 2 0 0 0-.59-1.42l-3.4-3.4A2 2 0 0 0 15.59 3H7Z"/><path d="M3 8a2 2 0 0 1 2-2h9v2H5v10h10v2H5a2 2 0 0 1-2-2V8Z"/><rect x="8" y="11" width="8" height="1.8" rx=".9"/><rect x="8" y="14.8" width="8" height="1.8" rx=".9"/></>,
  messageCircleQuestion: <><path d="M12 3a9 9 0 0 0-7.58 13.86L3 21l4.3-1.4A9 9 0 1 0 12 3Zm-.1 12.7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm1.23-3.92-.57.38c-.53.35-.66.57-.66 1.04v.3h-1.9v-.38c0-1.16.39-1.87 1.43-2.53l.53-.34c.47-.3.7-.6.7-1.08 0-.67-.5-1.14-1.28-1.14-.8 0-1.34.46-1.5 1.29H8.03c.15-1.94 1.56-3.02 3.53-3.02 2.07 0 3.35 1.17 3.35 2.83 0 1.05-.48 1.77-1.78 2.64Z"/></>,
  clipboardCheck: <><path d="M9 3a2 2 0 0 0-2 2v1H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V5a2 2 0 0 0-2-2H9Zm1.7 9.2 1.8 1.8 3.8-3.8 1.4 1.4-5.2 5.2-3.2-3.2 1.4-1.4Z"/></>,
  triangleAlert: <><path d="M10.56 3.62a1.7 1.7 0 0 1 2.88 0l8.03 13.9A1.7 1.7 0 0 1 19.99 20H4.01a1.7 1.7 0 0 1-1.48-2.48l8.03-13.9ZM11 9v4h2V9h-2Zm0 6v2h2v-2h-2Z"/></>,
  send: <><path d="M2.6 10.9 20.5 3.6c1.07-.43 2.05.55 1.62 1.62l-7.28 17.9a1.1 1.1 0 0 1-2.06-.02l-2.35-6.23-6.23-2.35a1.1 1.1 0 0 1-.02-2.06Z"/></>,
  clipboardList: <><path d="M9 3a2 2 0 0 0-2 2v1H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V5a2 2 0 0 0-2-2H9Z"/><rect x="8" y="10" width="8" height="1.6" rx=".8"/><rect x="8" y="13.8" width="8" height="1.6" rx=".8"/><rect x="8" y="17.6" width="6" height="1.6" rx=".8"/></>,
  shieldCheck: <><path d="M12 2 4.5 5v6.5c0 5.2 3.33 9.9 7.5 10.5 4.17-.6 7.5-5.3 7.5-10.5V5L12 2Zm-1.1 12.2L8.7 12l-1.4 1.4 3.6 3.6 5.8-5.8-1.4-1.4-4.4 4.4Z"/></>,
  calendarDays: <><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2Z"/><path d="M5 4h14a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm0 5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9H5Z"/></>,
  alertTriangle: <><path d="M10.56 3.62a1.7 1.7 0 0 1 2.88 0l8.03 13.9A1.7 1.7 0 0 1 19.99 20H4.01a1.7 1.7 0 0 1-1.48-2.48l8.03-13.9ZM11 9v4h2V9h-2Zm0 6v2h2v-2h-2Z"/></>,
  barChart3: <><path d="M4 20h16v2H2V4h2v16Z"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="11.5" y="8" width="3" height="10" rx="1"/><rect x="16" y="5" width="3" height="13" rx="1"/></>,
  checkCircle2: <><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.1 13.2L7.7 12l-1.4 1.4 4.6 4.6 6.8-6.8-1.4-1.4-5.4 5.4Z"/></>,
  badgeCheck: <><path d="m11.2 2.8.8-.8.8.8 1.14 1.14 1.58-.12.12 1.58 1.14 1.14 1.57.12-.12 1.58 1.14 1.14-.8.8.8.8-1.14 1.14.12 1.58-1.57.12-1.14 1.14-.12 1.58-1.58-.12-1.14 1.14-.8.8-.8-.8-1.14-1.14-1.58.12-.12-1.58-1.14-1.14-1.57-.12.12-1.58L2.2 12l.8-.8-.8-.8 1.14-1.14-.12-1.58 1.57-.12L5.95 6.4l.12-1.58 1.58.12L8.8 3.8l.8-.8.8.8 1.14 1.14Z"/><path d="m9.2 12 1.7 1.7 3.9-3.9 1.4 1.4-5.3 5.3-3.1-3.1 1.4-1.4Z" fill="#2A2B2A"/></>,
  packageCheck: <><path d="M11.06 2.74a2 2 0 0 1 1.88 0l6.5 3.58A2 2 0 0 1 20.5 8.1v7.8a2 2 0 0 1-1.06 1.78l-6.5 3.58a2 2 0 0 1-1.88 0l-6.5-3.58A2 2 0 0 1 3.5 15.9V8.1a2 2 0 0 1 1.06-1.78l6.5-3.58Z"/><path d="m9.1 13.5 1.5 1.5 3.6-3.6 1.2 1.2-4.8 4.8-2.7-2.7 1.2-1.2Z" fill="#2A2B2A"/></>,
  fileBarChart: <><path d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.8a2 2 0 0 0-.59-1.41l-3.8-3.8A2 2 0 0 0 13.2 3H7Z"/><rect x="8" y="14" width="2.2" height="4" rx=".7" fill="#2A2B2A"/><rect x="11.4" y="11" width="2.2" height="7" rx=".7" fill="#2A2B2A"/><rect x="14.8" y="13" width="2.2" height="5" rx=".7" fill="#2A2B2A"/></>,
};

const GROUP_ICON_MAP = {
  project: 'folderOpen',
  docs: 'fileStack',
  safety: 'shieldCheck',
  technical: 'calendarDays',
  control: 'checkCircle2',
};

const GROUP_COLOR_MAP = {
  project: 'icon-blue',
  docs: 'icon-cyan',
  safety: 'icon-amber',
  technical: 'icon-indigo',
  control: 'icon-emerald',
};

const MODULE_ICON_MAP = {
  dashboard: 'layoutDashboard',
  setup: 'settings',
  stakeholders: 'users',
  documents: 'folderOpen',
  submittals: 'package',
  drawings: 'fileStack',
  rfi: 'messageCircleQuestion',
  inspections: 'clipboardCheck',
  ncr: 'triangleAlert',
  transmittals: 'send',
  'site-instructions': 'clipboardList',
  safety: 'shieldCheck',
  schedule: 'calendarDays',
  risks: 'alertTriangle',
  progress: 'barChart3',
  followups: 'badgeCheck',
  approvals: 'packageCheck',
  handover: 'checkCircle2',
  reports: 'fileBarChart',
  'backup-restore': 'settings',
};

const MODULE_COLOR_MAP = {
  dashboard: 'icon-blue',
  setup: 'icon-gold',
  stakeholders: 'icon-indigo',
  documents: 'icon-cyan',
  submittals: 'icon-gold',
  drawings: 'icon-blue',
  rfi: 'icon-indigo',
  inspections: 'icon-green',
  ncr: 'icon-red',
  transmittals: 'icon-blue',
  'site-instructions': 'icon-amber',
  safety: 'icon-amber',
  schedule: 'icon-indigo',
  risks: 'icon-red',
  progress: 'icon-green',
  followups: 'icon-emerald',
  approvals: 'icon-green',
  handover: 'icon-emerald',
  reports: 'icon-graphite',
  'backup-restore': 'icon-amber',
};

const FALLBACK_ICON = 'folderOpen';

const DEFAULT_OPEN_GROUPS = {
  project: true,
  docs: true,
  safety: true,
  technical: true,
  control: true,
};


export default function Layout({ children, project }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { projectId } = useParams();
  const nav = useNavigate();
  const [userMenu, setUserMenu] = useState(false);
  const [openGroups, setOpenGroups] = useState(DEFAULT_OPEN_GROUPS);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const currentMod = location.pathname.split('/').pop();
  const isProject = !!projectId;

  const effectiveRole = normalizeRole(user?.role);
  const isSystemAdmin = effectiveRole === 'system_admin';

  useEffect(() => {
    const activeItem = NAV.find((n) => n.id === currentMod || (n.id === 'dashboard' && currentMod === projectId));
    if (!activeItem) return;
    setOpenGroups((prev) => ({ ...prev, [activeItem.group]: true }));
  }, [currentMod, projectId]);


  const refreshNotifications = async () => {
    try {
      const [c, list] = await Promise.all([api.get('/notifications/unread-count'), api.get('/notifications?limit=8')]);
      setUnread(c.data?.unread || 0);
      setNotifications(list.data || []);
      setNotificationError('');
    } catch (err) {
      setNotificationError(userSafeError(err, 'Notifications could not be loaded. Please try again.'));
      throw err;
    }
  };

  useEffect(() => {
    let active = true;
    refreshNotifications().catch(() => {
      if (!active) return;
    });
    const onRefresh = () => active && refreshNotifications().catch(() => {});
    window.addEventListener('qms:notifications-refresh', onRefresh);
    return () => { active = false; window.removeEventListener('qms:notifications-refresh', onRefresh); };
  }, [location.pathname]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read', read_at: new Date().toISOString() } : n)));
      setUnread((v) => Math.max(0, v - 1));
      setNotificationError('');
    } catch (err) {
      setNotificationError(userSafeError(err, 'Notification could not be marked as read. Please try again.'));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read', read_at: n.read_at || new Date().toISOString() })));
      setUnread(0);
      setNotificationError('');
    } catch (err) {
      setNotificationError(userSafeError(err, 'Notifications could not be marked as read. Please try again.'));
    }
  };

  const sendDebugTestNotification = async () => {
    setNotificationError('');
    try {
      await api.post('/notifications/debug-test');
      await refreshNotifications();
    } catch (err) {
      setNotificationError(userSafeError(err, 'Failed to send test notification.'));
      console.error('Notification debug-test failed:', err);
    }
  };
  const canView = (moduleId) => {
    const item = NAV.find((n) => n.id === moduleId);
    if (item?.adminOnly && !isSystemAdmin) return false;
    return canViewModule(moduleId, user);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="qms-shell-header text-white h-14 flex items-center px-4 gap-3 flex-shrink-0 z-30 relative">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--qms-gold)]/80 to-transparent" />
        <Link to="/" className="qms-brand-link flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <img
            src="/silver-foundation-logo.png"
            alt="Silver Foundation"
            className="h-9 w-auto max-w-[168px] object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="text-xs text-[color:color-mix(in_srgb,var(--qms-sand)_88%,white)] font-semibold tracking-wide truncate hidden sm:block">
            Quality Management System
          </span>
        </Link>

        <div className="w-px h-5 bg-white/20" />

        {isProject && project ? (
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-slate-200/75 hover:text-white transition-colors text-xs">Projects</Link>
            <span className="text-slate-300/60">›</span>
            <span className="font-semibold text-white truncate max-w-48">{project.name}</span>
            <span className="qms-project-pill hidden md:block">{project.code}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-100/95 font-medium tracking-wide">Projects</span>
        )}

        <div className="flex-1" />

        <div className="relative flex items-center gap-2">
          <button
            onClick={async () => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) await refreshNotifications().catch(() => {});
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/5 text-slate-100 shadow-sm transition-colors hover:bg-white/15 hover:border-white/40"
            title="Notifications"
            aria-label="Notifications"
          >
            <BellIcon className="h-4.5 w-4.5" />
            {unread > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full leading-[18px] text-center font-semibold">{unread > 99 ? '99+' : unread}</span>}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--qms-sand)_55%,white)] bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--qms-sand)_35%,white)] bg-[var(--qms-charcoal)] px-4 py-3 text-sm font-semibold text-[var(--qms-sand)]">
                <span>Notifications</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/85">{unread > 0 ? `${unread} unread` : 'All caught up'}</span>
              </div>
              <div className="max-h-96 overflow-auto">
                {isSystemAdmin && (
                  <div className="border-b border-slate-100 bg-[color:color-mix(in_srgb,var(--qms-sand)_18%,white)] px-3 py-2">
                    <button className="btn-secondary w-full px-2 py-1.5 text-xs" onClick={sendDebugTestNotification}>Send test notification</button>
                    {notificationError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{notificationError}</div>}
                  </div>
                )}
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No notifications to review.</div>
                ) : notifications.map((n) => (
                  <div key={n.id} className={`border-b border-slate-100 p-3 text-xs ${n.status === 'unread' ? 'bg-[color:color-mix(in_srgb,var(--qms-sand)_16%,white)]' : 'bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <b className="min-w-0 text-sm leading-5 text-[var(--qms-charcoal)] break-words">{n.title}</b>
                      <span className="qms-chip bg-slate-100 text-[10px] uppercase text-slate-600">{n.severity || 'info'}</span>
                    </div>
                    <div className="mt-1 whitespace-normal break-words leading-5 text-slate-600">{n.message}</div>
                    <div className="mt-2 text-[11px] text-slate-400">{(n.created_at || '').slice(0,10)} {n.due_date ? `• Due ${n.due_date}` : ''}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.action_url && <a className="btn-secondary px-2 py-1 text-xs" href={n.action_url}>Open</a>}
                      {n.status === 'unread' && <button className="btn-ghost px-2 py-1 text-xs text-emerald-700" onClick={() => markRead(n.id)}>Mark read</button>}
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full border-t border-slate-100 py-2 text-xs font-semibold text-[var(--qms-charcoal)] hover:bg-[color:color-mix(in_srgb,var(--qms-sand)_18%,white)]" onClick={markAllRead}>Mark all as read</button>
            </div>
          )}
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-[color:color-mix(in_srgb,var(--qms-soft-gold)_35%,transparent)]"
          >
            <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,var(--qms-soft-gold),var(--qms-gold))] text-[var(--qms-charcoal)] flex items-center justify-center text-xs font-bold shadow-[0_0_0_1px_rgba(255,255,255,0.24)]">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm text-slate-100/90 hidden md:block">{user?.name}</span>
            <span className="text-slate-300/90 text-xs">▾</span>
          </button>
          {userMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-slate-100 w-48 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
                <div className="text-xs text-slate-500">{getRoleLabel(effectiveRole)}</div>
              </div>
              {isSystemAdmin && (
                <>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      nav('/admin/users-access');
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Users & Access
                  </button>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      nav('/admin/backup-restore');
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Backup & Restore
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setUserMenu(false);
                  logout();
                  nav('/login');
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isProject && (
          <nav className="qms-sidebar-shell w-64 flex-shrink-0 overflow-y-auto overflow-x-hidden">
            {Object.entries(GROUPS).map(([gid, glabel]) => {
              const items = NAV.filter((n) => n.group === gid && canView(n.id));
              if (!items.length) return null;
              const hasActive = items.some((n) => currentMod === n.id || (n.id === 'dashboard' && currentMod === projectId));
              const isOpen = openGroups[gid] ?? hasActive;
              return (
                <div key={gid} className={`px-2 py-1.5 sidebar-group-shell ${hasActive ? 'sidebar-group-active' : ''} ${isOpen && !hasActive ? 'sidebar-group-expanded' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [gid]: !isOpen }))}
                    className={`group sidebar-category-button w-full flex items-center justify-between rounded-lg px-2.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-all ${hasActive ? 'sidebar-category-button-active' : 'sidebar-category-button-inactive'}`}
                  >
                    <span className="sidebar-category-meta">
                      <span className={`sidebar-category-icon sidebar-category-icon-${gid} ${GROUP_COLOR_MAP[gid] || 'icon-graphite'} ${hasActive ? 'sidebar-category-icon-active' : ''}`} aria-hidden="true"><Icon>{ICONS[GROUP_ICON_MAP[gid] || FALLBACK_ICON]}</Icon></span>
                      <span className="sidebar-category-title">{glabel}</span>
                    </span>
                    <span
                      className={`sidebar-category-chevron flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  <div className={`sidebar-group-panel ${isOpen ? 'sidebar-group-open' : 'sidebar-group-closed'}`}>
                    <div className="space-y-1 pt-1">
                    {items.map((n) => {
                      const isActive = currentMod === n.id || (n.id === 'dashboard' && currentMod === projectId);
                      return (
                        <Link
                          key={n.id}
                          to={`/project/${projectId}/${n.id}`}
                          className={`sidebar-module-link w-full flex items-center rounded-r-lg px-3.5 py-2.5 text-[14px] leading-[1.45] font-medium transition-all cursor-pointer border-l-4 ${isActive ? 'sidebar-module-link-active' : 'sidebar-module-link-inactive'}`}
                        >
                          <span className={`sidebar-module-icon ${MODULE_COLOR_MAP[n.id] || 'icon-graphite'} ${isActive ? 'sidebar-module-icon-active' : ''}`} aria-hidden="true"><Icon>{ICONS[MODULE_ICON_MAP[n.id] || FALLBACK_ICON]}</Icon></span>
                          <span className="truncate">{n.label}</span>
                        </Link>
                      );
                    })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="h-4" />
          </nav>
        )}

        <main className="flex-1 overflow-y-auto bg-[var(--color-page-bg)]">{children}</main>
      </div>
    </div>
  );
}
