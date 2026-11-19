import { useCallback, useEffect, useState, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowRight,
  Bell,
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  Mail,
  Plus,
  ShieldCheck,
  Users,
  Copy,
  Trash2,
  Edit2,
  LogOut,
  UserPlus,
  Send,
  X,
  Sparkles,
  Search,
  Calendar,
  Layers,
  MessageSquare
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../context/ToastContext'

const domains = ['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics']

function EmptyState({ icon: Icon, title, description }: { icon: typeof Bell; title: string; description: string }) {
  return (
    <div className="portal-empty">
      <Icon size={24} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function PortalPageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="portal-page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

// ==========================================
// STUDENT PAGES
// ==========================================

export function StudentDashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<{
    profile?: Record<string, string>
    registration?: {
      id: string
      domain: string
      status: string
      payment_status: string
      registration_type?: string
      team_name?: string
    } | null
    team?: {
      id: string
      name: string
      domain: string
      role: string
      membersCount: number
      isLeader: boolean
      joinCode?: string
    } | null
    profileCompletion?: number
    pendingInvitationsCount?: number
    latestAnnouncements?: Array<{ id: string; title: string; body: string; created_at: string }>
  } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(() => {
    api<typeof dashboard>('/api/student/dashboard')
      .then(res => {
        setDashboard(res)
        setLoading(false)
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const completion = dashboard?.profileCompletion ?? 0
  const regStatus = dashboard?.registration?.status || 'Not registered'
  const regDomain = dashboard?.registration?.domain || 'None selected'

  if (loading) {
    return (
      <div className="portal-page">
        <p role="status">Loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow="AICUXORA 2027 · STUDENT DASHBOARD"
        title={`Welcome back, ${user?.fullName || 'Student'}`}
        description="Monitor your challenge status, team formation, announcements, and upcoming competition deadlines."
        action={
          <div className="flex gap-2">
            <Button to="/explore" variant="secondary">
              Explore Hackathons
            </Button>
            <Button to="/student/team">
              <Users size={15} /> Manage Team
            </Button>
          </div>
        }
      />

      {error && <p role="alert" className="form-notice">{error}</p>}

      {/* Pending Invitations Alert */}
      {(dashboard?.pendingInvitationsCount || 0) > 0 && (
        <div className="pending-invites-banner">
          <Mail size={18} />
          <div>
            <strong>You have {dashboard?.pendingInvitationsCount} pending team invitation(s)!</strong>
            <span>Review and respond in your Team & Invitations workspace.</span>
          </div>
          <Button to="/student/team" variant="secondary">
            View Invitations <ArrowRight size={14} />
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="portal-stats">
        <Card>
          <span>PROFILE COMPLETION</span>
          <strong>{completion}%</strong>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${completion}%` }} />
          </div>
          <small>{completion === 100 ? 'Profile complete' : <Link to="/student/profile">Complete remaining fields →</Link>}</small>
        </Card>

        <Card>
          <span>REGISTRATION STATUS</span>
          <strong className="capitalize">{regStatus.replace('_', ' ')}</strong>
          <small>{regDomain} · {dashboard?.registration?.registration_type || 'individual'}</small>
        </Card>

        <Card>
          <span>MY TEAM</span>
          <strong>{dashboard?.team ? dashboard.team.name : 'No Team'}</strong>
          <small>
            {dashboard?.team
              ? `${dashboard.team.membersCount}/5 members · ${dashboard.team.role === 'leader' ? 'Team Leader' : 'Member'}`
              : 'Min 2, Max 5 members'}
          </small>
        </Card>

        <Card>
          <span>PAYMENT STATUS</span>
          <strong>Not started</strong>
          <small>Fee TBD · Gateway coming soon</small>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="portal-content-grid">
        {/* Next Steps Checklist */}
        <Card className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <p className="eyebrow">Milestone Progress</p>
              <h2>Preparation Checklist</h2>
            </div>
            <Clock3 size={19} />
          </div>

          <ol className="portal-checklist">
            <li>
              <span>01</span>
              <div>
                <b>Student Profile & Verification</b>
                <p>
                  {user?.emailVerified ? 'Your account email is verified.' : 'Verify your email.'} {completion}% profile details filled.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <b>Hackathon & Domain Selection</b>
                <p>
                  {dashboard?.registration
                    ? `Registered for ${dashboard.registration.domain} (${dashboard.registration.status}).`
                    : 'Select your preferred domain in the Hackathon Discovery catalog.'}
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <b>Team Formation (2–5 Participants)</b>
                <p>
                  {dashboard?.team
                    ? `Active in team "${dashboard.team.name}" with ${dashboard.team.membersCount} participant(s). ${dashboard.team.membersCount < 2 ? '⚠️ Need at least 1 more member to meet minimum team size of 2.' : '✓ Meets team size requirement.'}`
                    : 'You have not joined a team yet. Create a team or join via invite code.'}
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <b>Problem Statements Release</b>
                <p>Official challenge briefs release 26 November 2026. Online preliminary round submissions will follow.</p>
              </div>
            </li>
          </ol>
        </Card>

        {/* Recent Announcements & Deadlines */}
        <div className="flex flex-col gap-4">
          <Card className="portal-panel">
            <div className="portal-panel-head">
              <div>
                <p className="eyebrow">Latest Updates</p>
                <h2>Official Announcements</h2>
              </div>
              <Bell size={19} />
            </div>

            {(!dashboard?.latestAnnouncements || dashboard.latestAnnouncements.length === 0) ? (
              <EmptyState icon={Bell} title="No announcements yet" description="Published updates will appear here." />
            ) : (
              <div className="dashboard-announcements-list">
                {dashboard.latestAnnouncements.map(a => (
                  <article key={a.id} className="dash-announcement-item">
                    <span className="ann-date">{new Date(a.created_at).toLocaleDateString()}</span>
                    <h4>{a.title}</h4>
                    <p className="portal-muted">{a.body.slice(0, 120)}...</p>
                  </article>
                ))}
                <Link to="/student/announcements" className="text-link">
                  View all announcements <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Card>

          <Card className="portal-panel">
            <div className="portal-panel-head">
              <div>
                <p className="eyebrow">Important Dates</p>
                <h2>Timeline Reminders</h2>
              </div>
              <Calendar size={19} />
            </div>
            <ul className="timeline-mini-list">
              <li>
                <span>26 Nov 2026</span>
                <b>Problem Statements Release</b>
              </li>
              <li>
                <span>Late Nov 2026</span>
                <b>Registration Deadline</b>
              </li>
              <li>
                <span>End Dec 2026</span>
                <b>Finalists Announced</b>
              </li>
              <li>
                <span>2–3 Jan 2027</span>
                <b>Offline Grand Finale</b>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function StudentProfilePage() {
  const { showToast } = useToast()
  const [profile, setProfile] = useState<Record<string, string>>({
    fullName: '',
    phone: '',
    college: '',
    degree: '',
    academicYear: '',
    branch: '',
    skills: '',
    about: '',
  })
  const [message, setMessage] = useState('Loading profile…')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api<{ profile: Record<string, string> }>('/api/student/profile')
      .then(result => {
        setProfile({
          fullName: result.profile.full_name || '',
          phone: result.profile.phone || '',
          college: result.profile.college || '',
          degree: result.profile.degree || '',
          academicYear: result.profile.academic_year || '',
          branch: result.profile.branch || '',
          skills: result.profile.skills || '',
          about: result.profile.about || '',
        })
        setMessage('')
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Could not load profile.'))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('Saving…')
    try {
      const result = await api<{ profile: Record<string, string> }>('/api/student/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      })
      setProfile(current => ({
        ...current,
        fullName: result.profile.full_name,
        college: result.profile.college,
      }))
      setMessage('Profile saved successfully in local database.')
      showToast('Profile updated successfully!', 'success')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Could not save profile.'
      setMessage(errMsg)
      showToast(errMsg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: string, label: string, placeholder = '', type = 'text') => (
    <label className="portal-field" key={key}>
      {label}
      <input
        type={type}
        placeholder={placeholder}
        value={profile[key] || ''}
        onChange={event => setProfile(current => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  )

  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow="STUDENT PORTAL · ACCOUNT"
        title="My Profile"
        description="Maintain your personal and academic details. Profile information helps prospective team members and judges evaluate team composition."
      />

      <Card className="portal-panel">
        <form onSubmit={handleSave}>
          <div className="portal-profile-banner">
            <div className="portal-avatar">
              {profile.fullName.slice(0, 1).toUpperCase() || 'S'}
            </div>
            <div>
              <h2>{profile.fullName || 'Student profile'}</h2>
              <p>{profile.college ? `${profile.college} · ` : ''}Saved in local SQLite database</p>
            </div>
          </div>

          <div className="portal-form-grid">
            {field('fullName', 'Full name *', 'e.g. Sreenitya Nakka')}
            {field('phone', 'Phone number', 'e.g. +91 98765 43210', 'tel')}
            {field('college', 'College / Institution *', 'e.g. IIT Bombay / NIT Warangal')}
            {field('degree', 'Degree / Course', 'e.g. B.Tech / B.E / M.Tech')}
            {field('academicYear', 'Academic year', 'e.g. 3rd Year / 2024–2028')}
            {field('branch', 'Branch / Department', 'e.g. Computer Science / Robotics')}
            <label className="portal-field full-col">
              Skills (Comma-separated)
              <textarea
                rows={2}
                placeholder="e.g. Python, ROS, PyTorch, React, Embedded C, Drone Navigation"
                value={profile.skills}
                onChange={event => setProfile(current => ({ ...current, skills: event.target.value }))}
              />
            </label>
            <label className="portal-field full-col">
              About / Bio
              <textarea
                rows={3}
                placeholder="Briefly describe your interests, hackathon experience, or frontier tech aspirations..."
                value={profile.about}
                onChange={event => setProfile(current => ({ ...current, about: event.target.value }))}
              />
            </label>
          </div>

          <div className="profile-form-footer">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving changes…' : 'Save profile'}
            </Button>
            {message && <p className="form-notice" role="status">{message}</p>}
          </div>
        </form>
      </Card>
    </div>
  )
}

// ==========================================
// HIGH PRIORITY: TEAM MANAGEMENT WORKFLOW
// ==========================================

interface TeamChatMessage {
  id: string
  team_id: string
  sender_id: string
  content: string
  message_type: 'chat' | 'update' | 'system'
  created_at: string
  sender_name: string
  sender_email: string
}

function TeamWorkspaceChat({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [messages, setMessages] = useState<TeamChatMessage[]>([])
  const [content, setContent] = useState('')
  const [messageType, setMessageType] = useState<'chat' | 'update'>('chat')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(() => {
    api<{ messages: TeamChatMessage[] }>('/api/student/team/messages')
      .then(res => {
        setMessages(res.messages || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3500)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return

    setSending(true)
    const tempMsg: TeamChatMessage = {
      id: 'temp-' + Date.now(),
      team_id: teamId,
      sender_id: user?.id || '',
      content: trimmed,
      message_type: messageType,
      created_at: new Date().toISOString(),
      sender_name: user?.fullName || 'You',
      sender_email: user?.email || '',
    }
    setMessages(prev => [...prev, tempMsg])
    setContent('')

    try {
      await api('/api/student/team/messages', {
        method: 'POST',
        body: JSON.stringify({ content: trimmed, messageType }),
      })
      fetchMessages()
      if (messageType === 'update') {
        showToast('Project update posted to team workspace!', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send message.', 'error')
      fetchMessages()
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="portal-panel team-chat-panel portal-section-gap">
      <div className="portal-panel-head">
        <div>
          <p className="eyebrow">Collaboration Space</p>
          <h2>Team Workspace & Live Chat</h2>
          <small className="portal-muted">Private messaging & project milestone tracking for {teamName}</small>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-pulse-badge">
            <span className="live-dot" /> Live Polling
          </span>
        </div>
      </div>

      <div className="team-chat-feed">
        {loading && messages.length === 0 && <p className="portal-muted p-4">Loading team conversation…</p>}
        {!loading && messages.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-semibold">No messages yet in this team</p>
            <small>Start collaborating! Share repository links, discuss problem statements, or plan your development milestones.</small>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === user?.id
          return (
            <div
              key={m.id}
              className={`team-chat-bubble-wrap ${isMe ? 'my-bubble' : 'peer-bubble'} ${m.message_type === 'update' ? 'project-update-bubble' : ''}`}
            >
              <div className="chat-meta-row">
                <span className="chat-sender-name">
                  {m.sender_name} {isMe && <span className="badge badge-you">You</span>}
                </span>
                {m.message_type === 'update' && (
                  <span className="badge badge-domain text-[10px]">Project Milestone</span>
                )}
                <span className="chat-time-tag">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="team-chat-bubble-body">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={chatScrollRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="team-chat-composer">
        <div className="composer-toolbar">
          <button
            type="button"
            className={`composer-type-btn ${messageType === 'chat' ? 'active' : ''}`}
            onClick={() => setMessageType('chat')}
          >
            💬 Team Message
          </button>
          <button
            type="button"
            className={`composer-type-btn ${messageType === 'update' ? 'active' : ''}`}
            onClick={() => setMessageType('update')}
          >
            🚀 Milestone / Update
          </button>
        </div>
        <div className="composer-input-row">
          <textarea
            rows={2}
            placeholder={messageType === 'update' ? 'Share a major milestone (e.g. GitHub repo link, architecture doc ready)...' : 'Type a message to your team...'}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
          />
          <button type="submit" disabled={sending || !content.trim()} className="button button-primary send-chat-btn">
            <Send size={15} /> Send
          </button>
        </div>
      </form>
    </Card>
  )
}

export function StudentTeamPage() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [teamData, setTeamData] = useState<{
    inTeam: boolean
    team: {
      id: string
      name: string
      description: string
      projectIdea: string
      domain: string
      techStack: string
      eventCode: string
      leaderId: string
      joinCode: string
      createdAt: string
    } | null
    isLeader: boolean
    members: Array<{
      id: string
      user_id: string
      role: 'leader' | 'member'
      joined_at: string
      email: string
      full_name: string
      college: string
      skills: string
    }>
    sentInvitations: Array<{
      id: string
      invitee_email: string
      status: string
      created_at: string
      invitee_name?: string
    }>
    receivedInvitations: Array<{
      id: string
      team_id: string
      team_name: string
      domain: string
      description: string
      inviter_name: string
      inviter_email: string
      created_at: string
    }>
    openTeams: Array<{
      id: string
      name: string
      domain: string
      description: string
      tech_stack: string
      member_count: number
      leader_name: string
    }>
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Team Form
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDomain, setTeamDomain] = useState('Agriculture')
  const [teamDesc, setTeamDesc] = useState('')
  const [teamIdea, setTeamIdea] = useState('')
  const [teamStack, setTeamStack] = useState('')
  const [submittingTeam, setSubmittingTeam] = useState(false)

  // Join by Code Form
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [joiningCode, setJoiningCode] = useState(false)

  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Edit Team Details Form
  const [showEditModal, setShowEditModal] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editIdea, setEditIdea] = useState('')
  const [editStack, setEditStack] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadTeamData = useCallback(() => {
    api<typeof teamData>('/api/student/team')
      .then(res => {
        setTeamData(res)
        if (res?.team) {
          setEditDesc(res.team.description)
          setEditIdea(res.team.projectIdea)
          setEditStack(res.team.techStack)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Could not load team.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadTeamData()
  }, [loadTeamData])

  // Handle Team Creation
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingTeam(true)
    try {
      await api('/api/student/team', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName,
          domain: teamDomain,
          description: teamDesc,
          projectIdea: teamIdea,
          techStack: teamStack,
        }),
      })
      showToast(`Team "${teamName}" created successfully!`, 'success')
      setShowCreateModal(false)
      setTeamName('')
      setTeamDesc('')
      setTeamIdea('')
      setTeamStack('')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create team.', 'error')
    } finally {
      setSubmittingTeam(false)
    }
  }

  // Handle Join by Code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return
    setJoiningCode(true)
    try {
      const res = await api<{ message: string }>('/api/student/team/join', {
        method: 'POST',
        body: JSON.stringify({ joinCode: joinCodeInput.trim() }),
      })
      showToast(res.message, 'success')
      setJoinCodeInput('')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to join team.', 'error')
    } finally {
      setJoiningCode(false)
    }
  }

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSendingInvite(true)
    try {
      const res = await api<{ message: string }>('/api/student/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      showToast(res.message, 'success')
      setInviteEmail('')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invitation failed.', 'error')
    } finally {
      setSendingInvite(false)
    }
  }

  // Handle Respond to Invitation
  const handleRespondInvitation = async (invitationId: string, action: 'accept' | 'reject') => {
    try {
      const res = await api<{ message: string }>(`/api/student/team/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      showToast(res.message, action === 'accept' ? 'success' : 'info')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to respond.', 'error')
    }
  }

  // Handle Cancel Invitation
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await api(`/api/student/team/invitations/${invitationId}/cancel`, {
        method: 'POST',
      })
      showToast('Invitation cancelled.', 'info')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not cancel invitation.', 'error')
    }
  }

  // Handle Remove Member
  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) return
    try {
      await api(`/api/student/team/members/${targetUserId}/remove`, {
        method: 'POST',
      })
      showToast(`${memberName} removed from the team.`, 'info')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove member.', 'error')
    }
  }

  // Handle Leave Team
  const handleLeaveTeam = async () => {
    const isLeader = teamData?.isLeader
    const memberCount = teamData?.members.length || 0
    let promptMsg = 'Are you sure you want to leave this team?'
    if (isLeader) {
      if (memberCount <= 1) {
        promptMsg = 'As the only member and leader, leaving will dissolve this team. Proceed?'
      } else {
        promptMsg = 'As the leader, leaving will transfer leadership to another member. Proceed?'
      }
    }
    if (!window.confirm(promptMsg)) return

    try {
      await api('/api/student/team/leave', { method: 'POST' })
      showToast('You have left the team.', 'info')
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to leave team.', 'error')
    }
  }

  // Handle Edit Team Info
  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      await api('/api/student/team', {
        method: 'PUT',
        body: JSON.stringify({
          description: editDesc,
          projectIdea: editIdea,
          techStack: editStack,
        }),
      })
      showToast('Team information updated.', 'success')
      setShowEditModal(false)
      loadTeamData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update team.', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return (
      <div className="portal-page">
        <p role="status">Loading team workspace…</p>
      </div>
    )
  }

  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow="AICUXORA 2027 · COLLABORATION"
        title="Team & Invitations"
        description="Collaborate in 2–5 participant teams across the five frontier domains. Manage rosters, send teammate invites, or join via secure code."
        action={
          !teamData?.inTeam ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} /> Create a Team
            </button>
          ) : (
            <div className="flex gap-2">
              {teamData.isLeader && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowEditModal(true)}
                >
                  <Edit2 size={14} /> Edit Team Details
                </button>
              )}
              <button
                type="button"
                className="button button-ghost text-rose-400"
                onClick={handleLeaveTeam}
              >
                <LogOut size={14} /> Leave Team
              </button>
            </div>
          )
        }
      />

      {error && <p role="alert" className="form-notice">{error}</p>}

      {/* CASE A: USER IS IN A TEAM */}
      {teamData?.inTeam && teamData.team && (
        <div className="team-workspace">
          {/* Team Banner Card */}
          <Card className="portal-panel team-hero-card">
            <div className="team-header-top">
              <div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-domain">{teamData.team.domain}</span>
                  {teamData.isLeader && <span className="badge badge-flagship">TEAM LEADER</span>}
                </div>
                <h2>{teamData.team.name}</h2>
                <p className="portal-muted">{teamData.team.description || 'No description provided.'}</p>
              </div>

              <div className="team-code-badge">
                <span className="code-label">JOIN CODE:</span>
                <strong className="code-value">{teamData.team.joinCode}</strong>
                <button
                  type="button"
                  className="code-copy-btn"
                  title="Copy join code"
                  onClick={() => {
                    if (teamData.team?.joinCode) {
                      navigator.clipboard.writeText(teamData.team.joinCode)
                      showToast(`Join code ${teamData.team.joinCode} copied!`, 'info')
                    }
                  }}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Team Size Status Rule Meter */}
            <div className="team-size-meter-box">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-xs">
                  Team Size: {teamData.members.length} / 5 participants
                </span>
                <span className={`text-xs font-bold ${teamData.members.length >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {teamData.members.length >= 2
                    ? '✓ Meets Minimum Rule (2–5 members)'
                    : '⚠️ Minimum 2 members required!'}
                </span>
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${(teamData.members.length / 5) * 100}%`,
                    background: teamData.members.length >= 2 ? '#8bd66e' : '#ffd34f',
                  }}
                />
              </div>
            </div>

            {/* Extra Info Pills */}
            <div className="team-extra-meta">
              {teamData.team.projectIdea && (
                <div className="meta-pill">
                  <b>Project Idea:</b> <span>{teamData.team.projectIdea}</span>
                </div>
              )}
              {teamData.team.techStack && (
                <div className="meta-pill">
                  <b>Tech Stack:</b> <span>{teamData.team.techStack}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Members Roster & Invite Section */}
          <div className="portal-content-grid portal-section-gap">
            {/* Team Members List */}
            <Card className="portal-panel">
              <div className="portal-panel-head">
                <div>
                  <p className="eyebrow">Roster</p>
                  <h2>Team Members ({teamData.members.length})</h2>
                </div>
                <Users size={19} />
              </div>

              <div className="member-list">
                {teamData.members.map(m => (
                  <div key={m.id} className="member-item">
                    <div className="member-avatar">
                      {m.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <div className="flex items-center gap-2">
                        <b>{m.full_name}</b>
                        {m.role === 'leader' ? (
                          <span className="badge badge-leader">Leader</span>
                        ) : (
                          <span className="badge badge-member">Member</span>
                        )}
                        {m.user_id === user?.id && <span className="badge badge-you">You</span>}
                      </div>
                      <small className="portal-muted">{m.college || 'Institution not specified'} · {m.email}</small>
                      {m.skills && <small className="member-skills">Skills: {m.skills}</small>}
                    </div>

                    {teamData.isLeader && m.role !== 'leader' && (
                      <button
                        type="button"
                        className="member-remove-btn"
                        title="Remove member"
                        onClick={() => handleRemoveMember(m.user_id, m.full_name)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Invite Teammates Section */}
            <div className="flex flex-col gap-4">
              <Card className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <p className="eyebrow">Recruitment</p>
                    <h2>Invite Teammates</h2>
                  </div>
                  <UserPlus size={19} />
                </div>

                {teamData.members.length >= 5 ? (
                  <p className="form-notice">
                    This team has reached the maximum capacity of 5 members.
                  </p>
                ) : (
                  <form onSubmit={handleSendInvite} className="invite-form">
                    <label className="portal-field">
                      Student Email Address
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="teammate@college.edu"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          required
                        />
                        <button
                          type="submit"
                          className="button button-primary"
                          disabled={sendingInvite}
                        >
                          <Send size={14} /> {sendingInvite ? 'Sending…' : 'Invite'}
                        </button>
                      </div>
                    </label>
                    <small className="portal-muted">
                      Invited students will see the invitation upon logging in. Maximum team size: 5 members.
                    </small>
                  </form>
                )}
              </Card>

              {/* Sent Pending Invitations */}
              <Card className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <p className="eyebrow">Outbox</p>
                    <h2>Sent Invitations</h2>
                  </div>
                  <Mail size={19} />
                </div>

                {teamData.sentInvitations.length === 0 ? (
                  <p className="portal-muted text-xs">No pending outgoing invitations.</p>
                ) : (
                  <div className="sent-invites-list">
                    {teamData.sentInvitations.map(inv => (
                      <div key={inv.id} className="sent-invite-item">
                        <div>
                          <b>{inv.invitee_email}</b>
                          <small className="portal-muted">
                            Status: <span className="capitalize font-semibold">{inv.status}</span> · {new Date(inv.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        {teamData.isLeader && inv.status === 'pending' && (
                          <button
                            type="button"
                            className="button button-ghost text-xs"
                            onClick={() => handleCancelInvitation(inv.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Integrated Team Workspace & Live Chat (plan.md §9) */}
          <TeamWorkspaceChat teamId={teamData.team.id} teamName={teamData.team.name} />
        </div>
      )}

      {/* CASE B: USER IS NOT IN A TEAM */}
      {!teamData?.inTeam && (
        <div className="no-team-workspace">
          {/* Invitations Received Alert */}
          {teamData?.receivedInvitations && teamData.receivedInvitations.length > 0 && (
            <Card className="portal-panel received-invites-card">
              <div className="portal-panel-head">
                <div>
                  <p className="eyebrow">Direct Invites</p>
                  <h2>Invitations Received ({teamData.receivedInvitations.length})</h2>
                </div>
                <Mail size={20} />
              </div>

              <div className="received-invites-grid">
                {teamData.receivedInvitations.map(inv => (
                  <div key={inv.id} className="received-invite-item">
                    <div>
                      <span className="badge badge-domain mb-1">{inv.domain}</span>
                      <h3>{inv.team_name}</h3>
                      <p className="portal-muted">{inv.description || 'No description'}</p>
                      <small className="portal-muted">
                        Invited by <b>{inv.inviter_name}</b> ({inv.inviter_email})
                      </small>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => handleRespondInvitation(inv.id, 'accept')}
                      >
                        Accept & Join
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => handleRespondInvitation(inv.id, 'reject')}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="portal-content-grid portal-section-gap">
            {/* Create Team Card */}
            <Card className="portal-panel">
              <p className="eyebrow">Start a New Team</p>
              <h2>Create a Team</h2>
              <p className="portal-muted mb-4">
                Be the leader of your project. Pick a challenge domain, name your team, and invite 1–4 peers.
              </p>
              <div className="portal-rule">
                <Users size={18} />
                <span>
                  Team Rule: <b>2–5 members</b>
                </span>
              </div>
              <button
                type="button"
                className="button button-primary full-button"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> Create Team Form
              </button>
            </Card>

            {/* Join Team via Code Card */}
            <Card className="portal-panel">
              <p className="eyebrow">Got an invite code?</p>
              <h2>Join Team with Code</h2>
              <p className="portal-muted mb-4">
                Enter the unique join code provided by your team leader (e.g. AICU-XXXXX).
              </p>
              <form onSubmit={handleJoinByCode} className="join-code-form">
                <label className="portal-field">
                  Team Join Code
                  <input
                    type="text"
                    placeholder="e.g. AICU-AB123"
                    value={joinCodeInput}
                    onChange={e => setJoinCodeInput(e.target.value)}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="button button-secondary full-button"
                  disabled={joiningCode}
                >
                  {joiningCode ? 'Joining…' : 'Join Team'}
                </button>
              </form>
            </Card>
          </div>

          {/* Directory of Open Teams */}
          {teamData?.openTeams && teamData.openTeams.length > 0 && (
            <Card className="portal-panel portal-section-gap">
              <div className="portal-panel-head">
                <div>
                  <p className="eyebrow">Discovery</p>
                  <h2>Explore Open Teams Seeking Members</h2>
                </div>
                <Search size={18} />
              </div>

              <div className="open-teams-grid">
                {teamData.openTeams.map(t => (
                  <div key={t.id} className="open-team-chip">
                    <div className="flex justify-between items-start">
                      <h4>{t.name}</h4>
                      <span className="badge badge-domain">{t.domain}</span>
                    </div>
                    <p className="portal-muted text-xs line-clamp-2">
                      {t.description || 'No description provided.'}
                    </p>
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                      <span>Leader: {t.leader_name}</span>
                      <span>{t.member_count} / 5 members</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create Team Modal Dialog */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content-card small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">TEAM MANAGEMENT</p>
                <h2>Create Your Team</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div className="modal-form-body">
                <label className="portal-field">
                  Team Name * (2–60 characters)
                  <input
                    type="text"
                    placeholder="e.g. AeroGenesis Rovers"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={60}
                  />
                </label>

                <label className="portal-field">
                  Domain *
                  <select
                    value={teamDomain}
                    onChange={e => setTeamDomain(e.target.value)}
                    required
                  >
                    {domains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>

                <label className="portal-field">
                  Team Description
                  <textarea
                    rows={2}
                    placeholder="Brief summary of your team's focus..."
                    value={teamDesc}
                    onChange={e => setTeamDesc(e.target.value)}
                  />
                </label>

                <label className="portal-field">
                  Project Idea / Approach
                  <textarea
                    rows={2}
                    placeholder="Initial concepts or solution idea..."
                    value={teamIdea}
                    onChange={e => setTeamIdea(e.target.value)}
                  />
                </label>

                <label className="portal-field">
                  Planned Tech Stack
                  <input
                    type="text"
                    placeholder="e.g. Python, ROS, React, OpenCV"
                    value={teamStack}
                    onChange={e => setTeamStack(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingTeam}
                >
                  {submittingTeam ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal Dialog */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content-card small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">TEAM LEADER SETTINGS</p>
                <h2>Edit Team Details</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditTeam}>
              <div className="modal-form-body">
                <label className="portal-field">
                  Description
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                  />
                </label>

                <label className="portal-field">
                  Project Idea
                  <textarea
                    rows={3}
                    value={editIdea}
                    onChange={e => setEditIdea(e.target.value)}
                  />
                </label>

                <label className="portal-field">
                  Tech Stack
                  <input
                    type="text"
                    value={editStack}
                    onChange={e => setEditStack(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<
    Array<{ id: string; title: string; body: string; created_at: string }>
  >([])
  const [message, setMessage] = useState('Loading announcements…')

  useEffect(() => {
    void api<{ announcements: Array<{ id: string; title: string; body: string; created_at: string }> }>(
      '/api/student/announcements'
    )
      .then(result => {
        setAnnouncements(result.announcements)
        setMessage('')
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Could not load announcements.'))
  }, [])

  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow="AICUXORA 2027 · NOTIFICATIONS"
        title="Event Announcements"
        description="Official updates published by Incux AI administrators. Check back regularly for deadline notices and problem statement releases."
      />
      <Card className="portal-panel">
        {message && <p role="status">{message}</p>}
        {announcements.length === 0 && !message && (
          <EmptyState
            icon={Bell}
            title="No announcements yet"
            description="Official event announcements published by administrators will appear here."
          />
        )}
        <div className="announcements-feed">
          {announcements.map(item => (
            <article className="announcement-article" key={item.id}>
              <div className="flex justify-between items-center mb-1">
                <p className="eyebrow">{new Date(item.created_at).toLocaleDateString()}</p>
                <span className="badge badge-published">Official</span>
              </div>
              <h2>{item.title}</h2>
              <p className="portal-muted whitespace-pre-wrap">{item.body}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function StudentSubmissionsPage() {
  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow="AICUXORA 2027 · DELIVERABLES"
        title="Project Submissions"
        description="Submit your preliminary round artifacts, design decks, and code repositories after official problem statement release on 26 November 2026."
      />

      <div className="portal-stats">
        <Card>
          <span>SUBMISSION STATUS</span>
          <strong>Pending Release</strong>
          <small>Opens 26 November 2026</small>
        </Card>
        <Card>
          <span>ROUND</span>
          <strong>Preliminary</strong>
          <small>Online Build & Review</small>
        </Card>
        <Card>
          <span>FINALE DATES</span>
          <strong>2–3 Jan 2027</strong>
          <small>Offline Grand Finale</small>
        </Card>
      </div>

      <Card className="portal-panel portal-section-gap">
        <div className="portal-panel-head">
          <div>
            <p className="eyebrow">Submission Timeline</p>
            <h2>Submission Lifecycle</h2>
          </div>
          <FileText size={19} />
        </div>
        <div className="submission-steps">
          <div className="active">
            <span>1</span>
            <b>Problem Release (26 Nov)</b>
          </div>
          <i />
          <div>
            <span>2</span>
            <b>Team Draft</b>
          </div>
          <i />
          <div>
            <span>3</span>
            <b>Final Submission</b>
          </div>
          <i />
          <div>
            <span>4</span>
            <b>Review & Selection</b>
          </div>
        </div>

        <div className="notice-box mt-4">
          <Sparkles size={16} />
          <div>
            <strong>Submissions Open on 26 November 2026</strong>
            <p className="portal-muted">
              Teams will submit GitHub repository URLs, demonstration video links, and project presentation PDFs. Complete your team formation in the meantime.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ==========================================
// AUTH PAGES
// ==========================================

const authEmailSchema = z.object({ email: z.string().email('Enter a valid email address') })
type AuthEmail = z.infer<typeof authEmailSchema>

export function EmailVerificationPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [message, setMessage] = useState(
    token
      ? 'Use the button below to verify your local demo account.'
      : 'No verification token was provided. Local signup provides a one-time link because no external email service is configured.'
  )
  const [verified, setVerified] = useState(false)

  return (
    <div className="auth-state-page container">
      <Card className="auth-state-card">
        <span className="auth-state-icon">
          <Mail />
        </span>
        <p className="eyebrow">EMAIL VERIFICATION · LOCAL DEMO</p>
        <h1>Verify your email</h1>
        <p className="portal-muted">
          This local demo does not send external email. Click below to simulate email verification and activate your local student account.
        </p>

        {token && !verified && (
          <Button
            type="button"
            onClick={async () => {
              try {
                const result = await api<{ message: string }>('/api/auth/verify-email', {
                  method: 'POST',
                  body: JSON.stringify({ token }),
                })
                setMessage(result.message)
                setVerified(true)
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'Verification failed.')
              }
            }}
          >
            Verify local demo account
          </Button>
        )}

        <p role="status" className="form-notice">
          {message}
        </p>

        <div className="auth-state-actions">
          <Button to="/login" variant="secondary">
            Go to login
          </Button>
          <Button to="/register">Create another account</Button>
        </div>
      </Card>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [notice, setNotice] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthEmail>({ resolver: zodResolver(authEmailSchema) })

  return (
    <div className="auth-state-page container">
      <Card className="auth-state-card">
        <span className="auth-state-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Forgot password?</h1>
        <p className="portal-muted">
          External email delivery is not integrated in this local demonstration MVP.
        </p>
        <form onSubmit={handleSubmit(() => setNotice('Simulated notice: in a production deployment, a reset link is delivered to your verified mailbox.'))} noValidate>
          <label className="field-label" htmlFor="forgot-email">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && (
            <span className="field-error" role="alert">
              {errors.email.message}
            </span>
          )}
          <button className="button button-primary full-button" type="submit">
            Request recovery
          </button>
          {notice && <p className="form-notice" role="status">{notice}</p>}
        </form>
        <Link className="text-link mt-4" to="/login">
          Return to login
        </Link>
      </Card>
    </div>
  )
}

export function ResetPasswordPage() {
  return (
    <div className="auth-state-page container">
      <Card className="auth-state-card">
        <span className="auth-state-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">PASSWORD RESET</p>
        <h1>Set a new password</h1>
        <p className="portal-muted">
          Password reset via email token will be available in production after email provider configuration.
        </p>
        <Link className="text-link mt-4" to="/login">
          Return to login
        </Link>
      </Card>
    </div>
  )
}

// ==========================================
// ADMIN WORKSPACE PAGES
// ==========================================

const adminSections: Record<string, { title: string; description: string }> = {
  students: {
    title: 'Student management',
    description: 'Inspect verified student profiles, colleges, registrations, and team memberships stored in local SQLite.',
  },
  registrations: {
    title: 'Registration management',
    description: 'Review individual and team registrations across domains. Update statuses with server-side audit logs.',
  },
  teams: {
    title: 'Team management',
    description: 'Review teams, member rosters, join codes, and enforce the 2–5 member participation policy.',
  },
  domains: {
    title: 'Domain management',
    description: 'The five approved AICUXORA 2027 challenge domains.',
  },
  prizes: {
    title: 'Prize management',
    description: 'Proposed rewards under review (subject to final confirmation).',
  },
  event: {
    title: 'Event information',
    description: 'Timeline, venue, and fee status.',
  },
  announcements: {
    title: 'Announcement management',
    description: 'Create, edit, toggle publish/draft, and delete event announcements.',
  },
  faqs: {
    title: 'FAQ management',
    description: 'Frequently asked questions presented on public and student pages.',
  },
  audit: {
    title: 'Activity & audit log',
    description: 'Immutable server audit events recorded for bootstrap, teams, registrations, and announcements.',
  },
}

export function AdminDashboardPage() {
  return <AdminWorkspacePage overview />
}

export function AdminWorkspacePage({ overview = false }: { overview?: boolean }) {
  const location = useLocation()
  const { user } = useAuth()
  const [overviewData, setOverviewData] = useState<{
    students?: number
    registrations?: number
    teams?: number
    pendingRegistrations?: number
    announcements?: number
    totalAnnouncements?: number
  } | null>(null)
  const [overviewError, setOverviewError] = useState('')

  useEffect(() => {
    if (overview) {
      void api<{ overview: typeof overviewData }>('/api/admin/overview')
        .then(result => setOverviewData(result.overview))
        .catch(error => setOverviewError(error instanceof Error ? error.message : 'Could not load admin overview.'))
    }
  }, [overview])

  const key = location.pathname.split('/').filter(Boolean)[1] ?? ''
  const section = adminSections[key]
  const title = overview || !key ? 'Admin Overview' : section?.title ?? 'Administration'
  const description =
    overview || !key
      ? 'AICUXORA 2027 local administration console.'
      : section?.description ?? 'Administration workspace.'

  return (
    <div className="portal-page">
      <PortalPageTitle
        eyebrow={`AICUXORA 2027 · ${user?.role.toUpperCase()}`}
        title={title}
        description={description}
      />

      {overview ? (
        <>
          <div className="portal-stats">
            <Card>
              <span>TOTAL STUDENTS</span>
              <strong>{overviewData?.students ?? '—'}</strong>
              <small>Local SQLite accounts</small>
            </Card>

            <Card>
              <span>REGISTRATIONS</span>
              <strong>{overviewData?.registrations ?? '—'}</strong>
              <small>{overviewData?.pendingRegistrations ?? 0} submitted / pending</small>
            </Card>

            <Card>
              <span>TEAMS FORMED</span>
              <strong>{overviewData?.teams ?? '—'}</strong>
              <small>Local competition teams</small>
            </Card>

            <Card>
              <span>ANNOUNCEMENTS</span>
              <strong>{overviewData?.announcements ?? '—'}</strong>
              <small>Published updates</small>
            </Card>
          </div>

          {overviewError && <p className="form-notice" role="alert">{overviewError}</p>}

          <div className="admin-quick-links portal-section-gap">
            <Card className="portal-panel">
              <div className="portal-panel-head">
                <div>
                  <p className="eyebrow">Quick Workflows</p>
                  <h2>Administrative Actions</h2>
                </div>
                <ShieldCheck size={19} />
              </div>
              <div className="admin-quick-grid">
                <Link to="/admin/students" className="admin-quick-card">
                  <Users size={18} />
                  <div>
                    <b>Manage Students</b>
                    <span>View profiles & colleges</span>
                  </div>
                </Link>
                <Link to="/admin/registrations" className="admin-quick-card">
                  <FileText size={18} />
                  <div>
                    <b>Review Registrations</b>
                    <span>Update statuses & domains</span>
                  </div>
                </Link>
                <Link to="/admin/teams" className="admin-quick-card">
                  <Layers size={18} />
                  <div>
                    <b>Review Teams</b>
                    <span>Inspect rosters & join codes</span>
                  </div>
                </Link>
                <Link to="/admin/announcements" className="admin-quick-card">
                  <Bell size={18} />
                  <div>
                    <b>Publish Updates</b>
                    <span>Manage announcements</span>
                  </div>
                </Link>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <AdminSectionContent section={key} />
      )}
    </div>
  )
}

function AdminSectionContent({ section }: { section: string }) {
  if (section === 'students') return <AdminStudents />
  if (section === 'registrations') return <AdminRegistrations />
  if (section === 'teams') return <AdminTeams />
  if (section === 'announcements') return <AdminAnnouncements />
  if (section === 'audit') return <AdminAudit />
  if (section === 'domains') {
    return (
      <Card className="portal-panel">
        <div className="portal-panel-head">
          <div>
            <p className="eyebrow">Active Challenge Tracks</p>
            <h2>Five Official Domains</h2>
          </div>
        </div>
        <ul className="admin-domain-list">
          {domains.map(name => (
            <li key={name}>
              <span>
                <Check size={16} /> {name}
              </span>
              <span className="portal-status">Active on Public Platform</span>
            </li>
          ))}
        </ul>
      </Card>
    )
  }
  if (section === 'prizes') {
    return (
      <Card className="portal-panel">
        <p className="eyebrow">Proposed Rewards</p>
        <h2>Subject to Official Confirmation</h2>
        <div className="admin-detail-list">
          <p>
            <span>Proposed Prize Pool</span>
            <b>₹10,00,000</b>
          </p>
          <p>
            <span>Proposed Hardware</span>
            <b>Three laptops</b>
          </p>
          <p>
            <span>Proposed Extras</span>
            <b>Cash prizes & Microsoft vouchers</b>
          </p>
          <p>
            <span>Confirmation Status</span>
            <b>Pending final sponsor/organizer sign-off</b>
          </p>
        </div>
      </Card>
    )
  }
  if (section === 'event') {
    return (
      <Card className="portal-panel">
        <p className="eyebrow">Official Event Details</p>
        <div className="admin-detail-list">
          <p>
            <span>Event Name</span>
            <b>AICUXORA 2027</b>
          </p>
          <p>
            <span>Organizer</span>
            <b>IncuX AI</b>
          </p>
          <p>
            <span>Tagline</span>
            <b>INNOVATE. BUILD. SOLVE. TRANSFORM.</b>
          </p>
          <p>
            <span>Format</span>
            <b>Online preliminary round → offline grand finale</b>
          </p>
          <p>
            <span>Grand Finale</span>
            <b>2–3 January 2027</b>
          </p>
          <p>
            <span>Venue</span>
            <b>Not finalized (To be announced)</b>
          </p>
          <p>
            <span>Registration Fee</span>
            <b>Paid · Amount not finalized</b>
          </p>
        </div>
      </Card>
    )
  }
  return (
    <Card className="portal-panel">
      <EmptyState icon={FileText} title="Section" description="This section is configured for demonstration." />
    </Card>
  )
}

function AdminStudents() {
  const { showToast } = useToast()
  const [students, setStudents] = useState<
    Array<{
      id: string
      email: string
      email_verified: boolean
      created_at: string
      full_name: string
      college: string
      phone?: string
      skills?: string
      team_name?: string
      registration_status?: string
      registration_domain?: string
    }>
  >([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadStudents = useCallback(() => {
    api<{ students: typeof students }>('/api/admin/students')
      .then(res => {
        setStudents(res.students)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleVerifyStudent = async (studentId: string, email: string) => {
    try {
      await api(`/api/admin/students/${studentId}/verify`, { method: 'POST' })
      showToast(`Student ${email} verified successfully!`, 'success')
      loadStudents()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not verify student.', 'error')
    }
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.college.toLowerCase().includes(q)
    )
  })

  return (
    <Card className="portal-panel">
      <div className="portal-panel-head">
        <div>
          <p className="eyebrow">Database Records</p>
          <h2>Registered Students ({filtered.length})</h2>
        </div>
        <div className="portal-search-row">
          <input
            type="search"
            placeholder="Search student, email, college..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && <p role="status">Loading student records…</p>}
      {!loading && filtered.length === 0 && (
        <EmptyState icon={Users} title="No students found" description="No students match your query." />
      )}

      <div className="portal-record-list">
        {filtered.map(s => (
          <article key={s.id} className="portal-record">
            <div className="flex justify-between items-start">
              <div>
                <h3>{s.full_name}</h3>
                <small className="portal-muted">{s.email} · {s.college || 'Institution not specified'}</small>
              </div>
              <span className={`badge ${s.email_verified ? 'badge-published' : 'badge-demo'}`}>
                {s.email_verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <b>Team:</b> {s.team_name || 'No team'}
                </div>
                <div>
                  <b>Registration:</b> {s.registration_domain || 'None'} ({s.registration_status || 'not submitted'})
                </div>
              </div>
              {!s.email_verified && (
                <button
                  type="button"
                  className="btn-status-quick verify"
                  title="Verify student email"
                  onClick={() => handleVerifyStudent(s.id, s.email)}
                >
                  <Check size={12} /> Verify Account
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </Card>
  )
}

function AdminRegistrations() {
  const { showToast } = useToast()
  const [registrations, setRegistrations] = useState<
    Array<{
      id: string
      event_code: string
      domain: string
      status: string
      payment_status: string
      registration_type: string
      created_at: string
      email: string
      full_name: string
      college: string
      phone: string
      team_name?: string
    }>
  >([])
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const [syncingSheets, setSyncingSheets] = useState(false)

  const loadRegs = useCallback(() => {
    api<{ registrations: typeof registrations }>('/api/admin/registrations')
      .then(res => {
        setRegistrations(res.registrations)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRegs()
  }, [loadRegs])

  const handleSyncSheets = async () => {
    setSyncingSheets(true)
    try {
      const res = await api<{ message: string; syncedCount: number }>('/api/admin/registrations/sync-sheets', {
        method: 'POST',
      })
      showToast(res.message, 'success')
      loadRegs()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Sheets sync failed.', 'error')
    } finally {
      setSyncingSheets(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api(`/api/admin/registrations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      showToast(`Registration status updated to ${newStatus}.`, 'success')
      loadRegs()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error')
    }
  }

  const filtered = registrations.filter(r => {
    const q = search.toLowerCase()
    const matchesSearch =
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.team_name && r.team_name.toLowerCase().includes(q))
    const matchesDomain = filterDomain === 'All' || r.domain === filterDomain
    const matchesStatus = filterStatus === 'All' || r.status === filterStatus
    return matchesSearch && matchesDomain && matchesStatus
  })

  return (
    <Card className="portal-panel">
      <div className="portal-panel-head">
        <div>
          <p className="eyebrow">Competition Applications</p>
          <h2>Event Registrations ({filtered.length})</h2>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            type="button"
            className="button button-secondary text-xs flex items-center gap-1"
            onClick={handleSyncSheets}
            disabled={syncingSheets}
          >
            <Sparkles size={13} /> {syncingSheets ? 'Syncing...' : 'Sync Google Sheets'}
          </button>
          <a
            href="/api/admin/registrations/export-sheets"
            download="aicuxora-2027-registrations-sheets.csv"
            className="button button-primary text-xs flex items-center gap-1"
          >
            <FileText size={13} /> Export to Google Sheets (CSV)
          </a>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="admin-filter-bar">
        <input
          type="search"
          placeholder="Search by student or team..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
          <option value="All">All Domains</option>
          {domains.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="registered">Registered</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="verified">Verified</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {loading && <p role="status">Loading registrations…</p>}
      {!loading && filtered.length === 0 && (
        <EmptyState icon={FileText} title="No registrations found" description="No matching registration records." />
      )}

      <div className="portal-record-list mt-4">
        {filtered.map(r => (
          <article key={r.id} className="portal-record">
            <div className="flex justify-between items-start">
              <div>
                <h3>{r.full_name}</h3>
                <small className="portal-muted">{r.email} · {r.college || 'Institution not specified'}</small>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-domain">{r.domain}</span>
                <span className="badge badge-member">{r.registration_type}</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800 flex-wrap gap-2">
              <div className="text-xs text-slate-300">
                {r.team_name ? (
                  <span>Team: <b>{r.team_name}</b></span>
                ) : (
                  <span>Individual Registration</span>
                )}
                <span className="ml-3 text-slate-500">
                  Applied: {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 mr-2">
                  <button
                    type="button"
                    className="btn-status-quick shortlist"
                    title="Shortlist applicant"
                    onClick={() => handleStatusChange(r.id, 'shortlisted')}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    className="btn-status-quick verify"
                    title="Mark applicant verified"
                    onClick={() => handleStatusChange(r.id, 'verified')}
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    className="btn-status-quick reject"
                    title="Reject applicant"
                    onClick={() => handleStatusChange(r.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>

                <label className="text-xs font-semibold text-slate-400">Status:</label>
                <select
                  className="status-select"
                  value={r.status}
                  onChange={e => handleStatusChange(r.id, e.target.value)}
                >
                  <option value="submitted">Submitted</option>
                  <option value="registered">Registered</option>
                  <option value="pending_verification">Pending Verification</option>
                  <option value="verified">Verified</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="waitlisted">Waitlisted</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Card>
  )
}

function AdminTeams() {
  const [teams, setTeams] = useState<
    Array<{
      id: string
      name: string
      domain: string
      description: string
      leader_name: string
      leader_email: string
      join_code: string
      member_count: number
      created_at: string
      members: Array<{
        id: string
        full_name: string
        email: string
        college: string
        role: string
      }>
    }>
  >([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ teams: typeof teams }>('/api/admin/teams')
      .then(res => {
        setTeams(res.teams)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = teams.filter(t => {
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q) ||
      t.leader_name.toLowerCase().includes(q)
    )
  })

  return (
    <Card className="portal-panel">
      <div className="portal-panel-head">
        <div>
          <p className="eyebrow">Collaboration Roster</p>
          <h2>All Teams ({filtered.length})</h2>
        </div>
        <input
          type="search"
          placeholder="Search team or leader..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && <p role="status">Loading teams…</p>}
      {!loading && filtered.length === 0 && (
        <EmptyState icon={Users} title="No teams found" description="No teams have been created yet." />
      )}

      <div className="portal-record-list mt-3">
        {filtered.map(t => (
          <article key={t.id} className="portal-record">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3>{t.name}</h3>
                  <span className="badge badge-domain">{t.domain}</span>
                </div>
                <small className="portal-muted">
                  Leader: <b>{t.leader_name}</b> ({t.leader_email}) · Join Code: <code>{t.join_code}</code>
                </small>
              </div>
              <span className={`badge ${t.member_count >= 2 ? 'badge-published' : 'badge-demo'}`}>
                {t.member_count} / 5 members
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Roster: </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {t.members.map(m => (
                  <span key={m.id} className="badge badge-member">
                    {m.full_name} ({m.role})
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Card>
  )
}

function AdminAnnouncements() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<
    Array<{ id: string; title: string; body: string; status: string; created_at: string }>
  >([])
  const [message, setMessage] = useState('')
  const [editingItem, setEditingItem] = useState<{ id: string; title: string; body: string; status: string } | null>(null)

  const load = useCallback(() => {
    api<{ announcements: typeof rows }>('/api/admin/announcements')
      .then(res => setRows(res.announcements || []))
      .catch(err => setMessage(err instanceof Error ? err.message : 'Could not load.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setMessage('Publishing…')
    try {
      await api('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          body: form.get('body'),
          status: form.get('status'),
        }),
      })
      e.currentTarget.reset()
      showToast('Announcement saved and published.', 'success')
      setMessage('')
      load()
    } catch (err) {
      const errStr = err instanceof Error ? err.message : 'Failed to publish.'
      setMessage(errStr)
      showToast(errStr, 'error')
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete announcement "${title}"?`)) return
    try {
      await api(`/api/admin/announcements/${id}`, { method: 'DELETE' })
      showToast('Announcement deleted.', 'info')
      load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete.', 'error')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    try {
      await api(`/api/admin/announcements/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingItem),
      })
      showToast('Announcement updated.', 'success')
      setEditingItem(null)
      load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update.', 'error')
    }
  }

  return (
    <div>
      <Card className="portal-panel">
        <p className="eyebrow">Content Publishing</p>
        <h2>Create an Announcement</h2>
        <form onSubmit={handleCreate}>
          <label className="portal-field">
            Title
            <input name="title" required minLength={3} maxLength={160} placeholder="e.g. Problem Statements Schedule Finalized" />
          </label>
          <label className="portal-field">
            Message
            <textarea
              name="body"
              rows={4}
              required
              minLength={5}
              maxLength={10000}
              placeholder="Full announcement body for participants..."
            />
          </label>
          <label className="portal-field">
            Status
            <select name="status" defaultValue="published">
              <option value="published">Publish Immediately</option>
              <option value="draft">Save as Draft</option>
            </select>
          </label>
          <Button type="submit">Publish Update</Button>
        </form>
        {message && <p role="status" className="form-notice">{message}</p>}
      </Card>

      <Card className="portal-panel portal-section-gap">
        <div className="portal-panel-head">
          <div>
            <p className="eyebrow">Archive</p>
            <h2>Published & Draft Announcements ({rows.length})</h2>
          </div>
          <Bell size={18} />
        </div>

        <div className="portal-record-list">
          {rows.map(item => (
            <article className="portal-record" key={item.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${item.status === 'published' ? 'badge-published' : 'badge-demo'}`}>
                      {item.status}
                    </span>
                    <small className="portal-muted">{new Date(item.created_at).toLocaleDateString()}</small>
                  </div>
                  <h3 className="mt-1">{item.title}</h3>
                  <p className="portal-muted whitespace-pre-wrap">{item.body}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button button-ghost text-xs"
                    onClick={() => setEditingItem(item)}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="button button-ghost text-xs text-rose-400"
                    onClick={() => handleDelete(item.id, item.title)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!rows.length && <EmptyState icon={Bell} title="No announcements" description="Create the first announcement above." />}
        </div>
      </Card>

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div className="modal-content-card small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Announcement</h2>
              <button type="button" className="modal-close" onClick={() => setEditingItem(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-form-body">
                <label className="portal-field">
                  Title
                  <input
                    value={editingItem.title}
                    onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                    required
                  />
                </label>
                <label className="portal-field">
                  Message
                  <textarea
                    rows={5}
                    value={editingItem.body}
                    onChange={e => setEditingItem({ ...editingItem, body: e.target.value })}
                    required
                  />
                </label>
                <label className="portal-field">
                  Status
                  <select
                    value={editingItem.status}
                    onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="button button-ghost" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminAudit() {
  const [events, setEvents] = useState<
    Array<{
      id: string
      action: string
      target_type: string
      target_id: string
      actor_name: string
      created_at: string
    }>
  >([])
  const [message, setMessage] = useState('Loading audit events…')

  useEffect(() => {
    void api<{ events: typeof events }>('/api/audit')
      .then(result => {
        setEvents(result.events)
        setMessage('')
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Could not load audit events.'))
  }, [])

  return (
    <Card className="portal-panel">
      <div className="portal-panel-head">
        <div>
          <p className="eyebrow">Immutable Trail</p>
          <h2>Server Audit Log ({events.length})</h2>
        </div>
        <ShieldCheck size={18} />
      </div>
      {message && <p role="status">{message}</p>}
      <div className="portal-record-list">
        {events.map(event => (
          <article className="portal-record" key={event.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-emerald-400 text-xs">
                  {event.action}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Actor: <b>{event.actor_name}</b> · Target: {event.target_type} ({event.target_id})
                </p>
              </div>
              <small className="text-slate-500 text-xs">
                {new Date(event.created_at).toLocaleString()}
              </small>
            </div>
          </article>
        ))}
        {!events.length && !message && (
          <EmptyState icon={FileText} title="No audit events" description="Audit actions will appear here." />
        )}
      </div>
    </Card>
  )
}
