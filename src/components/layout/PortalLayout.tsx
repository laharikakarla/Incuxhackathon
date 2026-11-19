import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, ClipboardList, FileText, LayoutDashboard, ShieldCheck, Users, UserRound, Settings, Megaphone, BriefcaseBusiness } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { ChatbotWidget } from '../shared/ChatbotWidget'
import { ThemeToggle } from '../ui/ThemeToggle'

const studentLinks = [
  { to: '/student', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/student/profile', label: 'My profile', icon: UserRound },
  { to: '/student/team', label: 'Team & invitations', icon: Users },
  { to: '/student/announcements', label: 'Announcements', icon: Bell },
  { to: '/student/submissions', label: 'Submissions', icon: FileText },
]
const adminLinks = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/registrations', label: 'Registrations', icon: ClipboardList },
  { to: '/admin/teams', label: 'Teams', icon: BriefcaseBusiness },
  { to: '/admin/domains', label: 'Domains', icon: ShieldCheck },
  { to: '/admin/prizes', label: 'Prizes', icon: Settings },
  { to: '/admin/event', label: 'Event information', icon: FileText },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/faqs', label: 'FAQs', icon: Bell },
  { to: '/admin/invitations', label: 'Admin invitations', icon: UserRound },
  { to: '/admin/permissions', label: 'Roles & permissions', icon: ShieldCheck },
  { to: '/admin/audit', label: 'Activity & audit', icon: ClipboardList },
]

export function PortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, error, signOut } = useAuth()
  const admin = location.pathname.startsWith('/admin')
  const links = admin ? adminLinks : studentLinks
  if (loading) return <main className="auth-state-page container"><p role="status">Checking your local session…</p></main>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (admin && user.role === 'student') return <Navigate to="/student" replace />
  if (!admin && user.role !== 'student') return <Navigate to="/admin" replace />
  const title = admin ? 'Admin interface' : 'Student portal'
  return <div className="portal-shell">
    <header className="portal-topbar">
      <Link to="/" className="brand portal-brand" aria-label="AICUXORA home"><img className="brand-logo" src="/assets/brand/incux-ai-logo.jpeg" alt="IncuX AI" /><span className="brand-text">AICUXORA <b>2027</b><small>BY INCUX AI</small></span></Link>
      <div className="portal-top-actions"><ThemeToggle /><span className="portal-mode">{title} · local</span><span className="portal-mode">{user.fullName}</span><button type="button" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button><Link to="/"><ArrowLeft size={15} /> Public website</Link></div>
    </header>
    {error && <div className="portal-preview-alert" role="alert"><ShieldCheck size={18} /><div><strong>Backend connection issue</strong><span>{error}</span></div></div>}
    <div className="portal-preview-alert" role="status"><ShieldCheck size={18} /><div><strong>Local MVP</strong><span>Authentication, profile, registration, announcements and selected admin reads use local SQLite. Team, submission, payment, and advanced admin workflows remain previews.</span></div></div>
    <div className="portal-body">
      <aside className="portal-sidebar"><p className="portal-sidebar-label">{admin ? 'ADMINISTRATION' : 'PARTICIPANT'}</p><nav aria-label={title + ' navigation'}>{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => 'portal-nav-link' + (isActive ? ' active' : '')}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav><div className="portal-sidebar-footer">AICUXORA 2027<br /><span>Local interface preview</span></div></aside>
      <main className="portal-main"><Outlet /></main>
    </div>
    <ChatbotWidget />
  </div>
}

