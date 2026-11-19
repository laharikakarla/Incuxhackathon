import { randomUUID } from 'node:crypto'
import express from 'express'
import { db, writeAudit } from './db.js'
import { hashPassword, hashToken, newOpaqueToken, verifyPassword } from './security.js'

const app = express()
const host = process.env.API_HOST || '0.0.0.0'
const port = Number(process.env.API_PORT || 8787)
const sessionCookie = 'aicuxora_session'
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
const allowedOrigins = new Set((process.env.LOCAL_APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()))
const attempts = new Map()

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.has(origin)) return true
  try {
    const parsed = new URL(origin)
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0' ||
      parsed.hostname === '::1'
    )
  } catch {
    return false
  }
}

db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
db.prepare('DELETE FROM email_verification_tokens WHERE expires_at <= ?').run(Date.now())

app.disable('x-powered-by')
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
app.use(express.json({ limit: '20kb', strict: true }))
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Request origin is not allowed.' })
  next()
})

function rateLimit(req, res, key) {
  const now = Date.now()
  const ip = req.socket.remoteAddress || 'local'
  const bucketKey = `${key}:${ip}`
  const bucket = attempts.get(bucketKey) || { count: 0, resetAt: now + 15 * 60 * 1000 }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + 15 * 60 * 1000
  }
  bucket.count += 1
  attempts.set(bucketKey, bucket)
  if (attempts.size > 1000) {
    for (const [entry, item] of attempts) if (item.resetAt <= now) attempts.delete(entry)
  }
  if (bucket.count > 12) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
    res.status(429).json({ error: 'Too many attempts. Wait a little and try again.' })
    return false
  }
  return true
}

function cookieToken(req) {
  const cookies = (req.headers.cookie || '').split(';')
  const entry = cookies.map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`))
  if (!entry) return null
  try {
    return decodeURIComponent(entry.slice(sessionCookie.length + 1))
  } catch {
    return null
  }
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    emailVerified: Boolean(row.email_verified),
    fullName: row.full_name,
  }
}

function requireAuth(req, res, next) {
  const token = cookieToken(req)
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' })
  const user = db.prepare(`
    SELECT u.id, u.email, u.role, u.email_verified, p.full_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN profiles p ON p.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), Date.now())
  if (!user || !user.email_verified) return res.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' })
  req.user = user
  req.sessionTokenHash = hashToken(token)
  next()
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' })
    next()
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function issueSession(userId, res) {
  const token = newOpaqueToken()
  const expiresAt = Date.now() + sessionDurationMs
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, expiresAt)
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionDurationMs,
  })
}

app.get('/api/health', (_req, res) => {
  const result = db.prepare('SELECT 1 AS ok').get()
  res.json({ status: result.ok === 1 ? 'ok' : 'error', service: 'aicuxora-local-api', database: 'sqlite' })
})

// Public announcements for homepage and visitors
app.get('/api/announcements/public', (_req, res) => {
  const announcements = db.prepare(`
    SELECT a.id, a.title, a.body, a.created_at, p.full_name AS author
    FROM announcements a
    JOIN profiles p ON p.user_id = a.author_id
    WHERE a.status = 'published'
    ORDER BY a.created_at DESC LIMIT 20
  `).all()
  res.json({ announcements })
})

// Hackathons discovery catalog
const HACKATHON_CATALOG = [
  {
    id: 'aicuxora-2027',
    title: 'AICUXORA 2027 Flagship Hackathon',
    organizer: 'Incux AI',
    tagline: 'INNOVATE. BUILD. SOLVE. TRANSFORM.',
    domains: ['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics'],
    status: 'Upcoming',
    dates: '2–3 January 2027 (Grand Finale)',
    problemStatementsDate: '26 November 2026',
    registrationDeadline: 'Last week of November 2026',
    finalistsAnnouncedDate: 'By end of December 2026',
    mode: 'Hybrid (Online Preliminary Round → Offline Grand Finale)',
    venue: 'Not finalized (To be announced)',
    teamSize: '2–5 participants',
    registrationFee: 'Paid · Amount to be confirmed (Payment gateway not finalized)',
    prizePool: '₹10,00,000 Cash + Microsoft Gift Vouchers + Exciting Gifts',
    prizes: [
      '₹10,00,000 Cash Rewards (Proposed / subject to final confirmation)',
      'Microsoft Gift Vouchers (Proposed / subject to confirmation)',
      'Three Laptops & Exciting Gifts (Proposed / subject to confirmation)'
    ],
    rules: [
      'Team size: minimum 2, maximum 5 participants.',
      'Account creation ≠ event registration ≠ payment.',
      'Online preliminary round submission, followed by in-person offline grand finale.',
      'All proposed prizes, venue, fee and vouchers remain subject to official confirmation.'
    ],
    description: 'The flagship national technology hackathon organized by Incux AI. Build breakthrough solutions across five critical frontier domains: Agriculture, Defense, Cybersecurity, Space Technology, and Robotics.',
    isFlagship: true,
    demo: false
  },
  {
    id: 'agritech-sprint-demo',
    title: 'AgriTech Innovation Sprint 2027 (Demo)',
    organizer: 'Incux AI Demo Labs',
    tagline: 'Sustaining Soils, Feeding Tomorrow',
    domains: ['Agriculture'],
    status: 'Upcoming',
    dates: '12–14 December 2026',
    problemStatementsDate: '5 December 2026',
    registrationDeadline: '10 December 2026',
    finalistsAnnouncedDate: '15 December 2026',
    mode: 'Online (Demo Event)',
    venue: 'Virtual Demo Environment',
    teamSize: '2–4 participants',
    registrationFee: 'Demo Simulated Event',
    prizePool: '₹1,50,000 proposed demo pool',
    prizes: ['₹1,50,000 demo pool (Proposed / Demo)'],
    rules: ['Demo track for precision agriculture and climate resilience exploration.'],
    description: 'A focused demo sprint tackling AI-driven precision irrigation, crop disease detection, and rural farm-to-market logistics.',
    isFlagship: false,
    demo: true
  },
  {
    id: 'cybershield-national-demo',
    title: 'CyberShield National Challenge (Demo)',
    organizer: 'Incux AI Demo Labs',
    tagline: 'Zero Trust in a Quantum World',
    domains: ['Cybersecurity', 'Defense'],
    status: 'Live',
    dates: '15–18 November 2026',
    problemStatementsDate: '10 November 2026',
    registrationDeadline: '14 November 2026',
    finalistsAnnouncedDate: '20 November 2026',
    mode: 'Online (Demo Event)',
    venue: 'Virtual Cyber Range',
    teamSize: '2–5 participants',
    registrationFee: 'Demo Simulated Event',
    prizePool: '₹2,50,000 proposed demo pool',
    prizes: ['₹2,50,000 demo pool (Proposed / Demo)'],
    rules: ['Ethical white-hat security simulation within lawful boundaries.'],
    description: 'An interactive challenge on securing critical digital infrastructure, cloud identity resilience, and automated threat hunting.',
    isFlagship: false,
    demo: true
  },
  {
    id: 'aerospace-rover-demo',
    title: 'AeroSpace & Rover Hack (Demo)',
    organizer: 'Incux AI Demo Labs',
    tagline: 'From Low Orbit to Mars Surface',
    domains: ['Space Technology', 'Robotics'],
    status: 'Upcoming',
    dates: '18–20 January 2027',
    problemStatementsDate: '10 January 2027',
    registrationDeadline: '15 January 2027',
    finalistsAnnouncedDate: '22 January 2027',
    mode: 'Hybrid (Demo Event)',
    venue: 'Space Lab Demo Centre',
    teamSize: '2–5 participants',
    registrationFee: 'Demo Simulated Event',
    prizePool: '₹3,00,000 proposed demo pool',
    prizes: ['₹3,00,000 demo pool (Proposed / Demo)'],
    rules: ['Satellite imagery processing and autonomous surface robotics navigation.'],
    description: 'Designing autonomous rover navigation algorithms, micro-satellite payload telemetry, and deep-space communications simulators.',
    isFlagship: false,
    demo: true
  }
]

app.get('/api/hackathons', (req, res) => {
  const search = typeof req.query?.search === 'string' ? req.query.search.trim().toLowerCase() : ''
  const domain = typeof req.query?.domain === 'string' ? req.query.domain.trim() : ''
  const status = typeof req.query?.status === 'string' ? req.query.status.trim() : ''

  let filtered = HACKATHON_CATALOG.filter(item => {
    if (search && !item.title.toLowerCase().includes(search) && !item.description.toLowerCase().includes(search) && !item.domains.some(d => d.toLowerCase().includes(search))) {
      return false
    }
    if (domain && domain !== 'All' && !item.domains.includes(domain)) {
      return false
    }
    if (status && status !== 'All' && item.status.toLowerCase() !== status.toLowerCase()) {
      return false
    }
    return true
  })
  res.json({ hackathons: filtered })
})

app.get('/api/hackathons/:id', (req, res) => {
  const item = HACKATHON_CATALOG.find(h => h.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Hackathon not found.' })
  res.json({ hackathon: item })
})

app.post('/api/auth/register', (req, res) => {
  if (!rateLimit(req, res, 'register')) return
  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : ''
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const college = typeof req.body?.college === 'string' ? req.body.college.trim() : ''
  const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
  const allowedDomains = new Set(['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics'])

  if (fullName.length < 2 || fullName.length > 120) return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (password.length < 12 || password.length > 200) return res.status(400).json({ error: 'Use a password between 12 and 200 characters.' })
  if (college.length < 2 || college.length > 180) return res.status(400).json({ error: 'Enter your college or institution.' })
  if (!allowedDomains.has(domain)) return res.status(400).json({ error: 'Choose one of the five event domains.' })

  const userId = randomUUID()
  const verificationToken = newOpaqueToken()
  const createAccount = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, \'student\')')
      .run(userId, email, hashPassword(password))
    db.prepare('INSERT INTO profiles (user_id, full_name, college) VALUES (?, ?, ?)')
      .run(userId, fullName, college)
    db.prepare('INSERT INTO event_registrations (id, participant_id, domain) VALUES (?, ?, ?)')
      .run(randomUUID(), userId, domain)
    db.prepare('INSERT INTO email_verification_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(verificationToken), userId, Date.now() + 24 * 60 * 60 * 1000)
  })

  try {
    createAccount()
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed: users.email')) return res.status(409).json({ error: 'An account already exists for that email.' })
    throw error
  }

  const response = { message: 'Account and individual event registration saved. Verify your email before signing in.' }
  if (process.env.NODE_ENV !== 'production') {
    response.localVerificationToken = verificationToken
    response.demoOnly = 'No email was sent. This local-only token simulates the verification link for demonstration.'
  }
  res.status(201).json(response)
})

app.post('/api/auth/verify-email', (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : ''
  if (token.length < 20 || token.length > 200) return res.status(400).json({ error: 'Verification token is invalid or expired.' })
  const verify = db.transaction(() => {
    const record = db.prepare('SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?')
      .get(hashToken(token), Date.now())
    if (!record) return null
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(record.user_id)
    db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(record.user_id)
    return record.user_id
  })
  const userId = verify()
  if (!userId) return res.status(400).json({ error: 'Verification token is invalid or expired.' })
  res.json({ message: 'Email verified. You can now sign in.' })
})

app.post('/api/auth/login', (req, res) => {
  if (!rateLimit(req, res, 'login')) return
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' })

  const row = db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.role, u.email_verified, p.full_name
    FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.email = ?
  `).get(email)
  if (!row || !verifyPassword(password, row.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' })
  if (!row.email_verified) return res.status(403).json({ error: 'Verify your email before signing in.' })

  issueSession(row.id, res)
  res.json({ user: publicUser(row) })
})

app.post('/api/auth/logout', (req, res) => {
  const token = cookieToken(req)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })
  res.json({ message: 'Signed out.' })
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

app.get('/api/student/dashboard', requireAuth, requireRoles('student'), (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id)
  const registration = db.prepare(`
    SELECT r.id, r.event_code, r.domain, r.status, r.payment_status, r.registration_type, r.team_id, r.created_at,
           t.name AS team_name
    FROM event_registrations r
    LEFT JOIN teams t ON t.id = r.team_id
    WHERE r.participant_id = ?
    ORDER BY r.created_at DESC LIMIT 1
  `).get(req.user.id)

  const membership = db.prepare(`
    SELECT tm.role, t.id AS team_id, t.name AS team_name, t.domain, t.join_code,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS members_count
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `).get(req.user.id)

  const pendingInvitationsCount = db.prepare(`
    SELECT COUNT(*) AS count FROM team_invitations
    WHERE (invitee_email = ? OR invitee_user_id = ?) AND status = 'pending'
  `).get(req.user.email, req.user.id)?.count || 0

  const latestAnnouncements = db.prepare(`
    SELECT id, title, body, created_at FROM announcements
    WHERE status = 'published' ORDER BY created_at DESC LIMIT 3
  `).all()

  // Calculate profile completion percentage
  const fieldsToCheck = [profile?.full_name, profile?.phone, profile?.college, profile?.degree, profile?.academic_year, profile?.branch, profile?.skills, profile?.about]
  const filledCount = fieldsToCheck.filter(v => typeof v === 'string' && v.trim().length > 0).length
  const profileCompletion = Math.round((filledCount / fieldsToCheck.length) * 100)

  res.json({
    user: publicUser(req.user),
    profile,
    registration,
    team: membership ? {
      id: membership.team_id,
      name: membership.team_name,
      domain: membership.domain,
      joinCode: membership.join_code,
      role: membership.role,
      membersCount: membership.members_count,
      isLeader: membership.role === 'leader'
    } : null,
    pendingInvitationsCount,
    profileCompletion,
    latestAnnouncements
  })
})

app.post('/api/student/register-event', requireAuth, requireRoles('student'), (req, res) => {
  const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
  const registrationType = req.body?.registrationType === 'team' ? 'team' : 'individual'
  const eventCode = 'AICUXORA-2027'
  const allowedDomains = new Set(['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics'])

  if (!allowedDomains.has(domain)) return res.status(400).json({ error: 'Please select one of the five approved event domains.' })

  let teamId = null
  if (registrationType === 'team') {
    const membership = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(req.user.id)
    if (!membership) return res.status(400).json({ error: 'You must create or join a team before registering as a team.' })
    teamId = membership.team_id
  }

  const existing = db.prepare('SELECT id FROM event_registrations WHERE participant_id = ? AND event_code = ?').get(req.user.id, eventCode)
  const regId = existing?.id || randomUUID()

  const saveReg = db.transaction(() => {
    if (existing) {
      db.prepare(`
        UPDATE event_registrations
        SET domain = ?, registration_type = ?, team_id = ?
        WHERE id = ?
      `).run(domain, registrationType, teamId, regId)
    } else {
      db.prepare(`
        INSERT INTO event_registrations (id, participant_id, event_code, domain, status, payment_status, registration_type, team_id)
        VALUES (?, ?, ?, ?, 'submitted', 'not_started', ?, ?)
      `).run(regId, req.user.id, eventCode, domain, registrationType, teamId)
    }
    writeAudit({ actorUserId: req.user.id, action: 'registration.saved', targetType: 'event_registration', targetId: regId })
  })

  saveReg()
  const registration = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(regId)
  res.json({ message: 'Event registration successfully saved in local database.', registration })
})

// Team Management Endpoints
app.get('/api/student/team', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare(`
    SELECT tm.id AS membership_id, tm.role, tm.joined_at,
           t.id, t.name, t.description, t.project_idea, t.domain, t.tech_stack,
           t.event_code, t.leader_id, t.join_code, t.created_at
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `).get(req.user.id)

  if (membership) {
    const members = db.prepare(`
      SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
             u.email, p.full_name, p.college, p.skills
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      JOIN profiles p ON p.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role = 'leader' DESC, tm.joined_at ASC
    `).all(membership.id)

    const sentInvitations = db.prepare(`
      SELECT ti.id, ti.invitee_email, ti.status, ti.created_at,
             p.full_name AS invitee_name
      FROM team_invitations ti
      LEFT JOIN users u ON lower(u.email) = lower(ti.invitee_email)
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE ti.team_id = ?
      ORDER BY ti.created_at DESC
    `).all(membership.id)

    return res.json({
      inTeam: true,
      team: {
        id: membership.id,
        name: membership.name,
        description: membership.description,
        projectIdea: membership.project_idea,
        domain: membership.domain,
        techStack: membership.tech_stack,
        eventCode: membership.event_code,
        leaderId: membership.leader_id,
        joinCode: membership.join_code,
        createdAt: membership.created_at,
      },
      isLeader: membership.leader_id === req.user.id,
      members,
      sentInvitations
    })
  }

  // Not in a team - get received invitations and open teams
  const receivedInvitations = db.prepare(`
    SELECT ti.id, ti.team_id, ti.status, ti.created_at,
           t.name AS team_name, t.domain, t.description,
           p.full_name AS inviter_name, u.email AS inviter_email
    FROM team_invitations ti
    JOIN teams t ON t.id = ti.team_id
    JOIN users u ON u.id = ti.inviter_id
    JOIN profiles p ON p.user_id = u.id
    WHERE (ti.invitee_email = ? OR ti.invitee_user_id = ?) AND ti.status = 'pending'
    ORDER BY ti.created_at DESC
  `).all(req.user.email, req.user.id)

  const openTeams = db.prepare(`
    SELECT t.id, t.name, t.domain, t.description, t.tech_stack,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
           p.full_name AS leader_name
    FROM teams t
    JOIN profiles p ON p.user_id = t.leader_id
    LIMIT 20
  `).all().filter(t => t.member_count < 5)

  res.json({
    inTeam: false,
    team: null,
    isLeader: false,
    members: [],
    sentInvitations: [],
    receivedInvitations,
    openTeams
  })
})

app.post('/api/student/team', requireAuth, requireRoles('student'), (req, res) => {
  const existingMembership = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(req.user.id)
  if (existingMembership) return res.status(400).json({ error: 'You are already a member of a team. Leave your current team before creating a new one.' })

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : ''
  const projectIdea = typeof req.body?.projectIdea === 'string' ? req.body.projectIdea.trim() : ''
  const techStack = typeof req.body?.techStack === 'string' ? req.body.techStack.trim() : ''

  const allowedDomains = new Set(['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics'])
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Team name must be between 2 and 60 characters.' })
  if (!allowedDomains.has(domain)) return res.status(400).json({ error: 'Choose one of the five approved domains.' })
  if (description.length > 500 || projectIdea.length > 1000 || techStack.length > 300) {
    return res.status(400).json({ error: 'Description, project idea, or tech stack exceed maximum length.' })
  }

  const existingName = db.prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE').get(name)
  if (existingName) return res.status(409).json({ error: 'A team with this name already exists. Choose a unique team name.' })

  const teamId = randomUUID()
  const memberId = randomUUID()
  const joinCode = `AICU-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

  const createTeamTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO teams (id, name, description, project_idea, domain, tech_stack, leader_id, join_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(teamId, name, description, projectIdea, domain, techStack, req.user.id, joinCode)

    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, role)
      VALUES (?, ?, ?, 'leader')
    `).run(memberId, teamId, req.user.id)

    // Update student's event registration to link with this team and domain
    const reg = db.prepare('SELECT id FROM event_registrations WHERE participant_id = ?').get(req.user.id)
    if (reg) {
      db.prepare('UPDATE event_registrations SET team_id = ?, registration_type = \'team\', domain = ? WHERE id = ?')
        .run(teamId, domain, reg.id)
    } else {
      db.prepare('INSERT INTO event_registrations (id, participant_id, event_code, domain, status, payment_status, registration_type, team_id) VALUES (?, ?, \'AICUXORA-2027\', ?, \'submitted\', \'not_started\', \'team\', ?)')
        .run(randomUUID(), req.user.id, domain, teamId)
    }

    writeAudit({ actorUserId: req.user.id, action: 'team.created', targetType: 'team', targetId: teamId })
  })

  createTeamTx()
  res.status(201).json({ message: 'Team successfully created.', teamId, joinCode })
})

app.put('/api/student/team', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT tm.role, tm.team_id FROM team_members tm WHERE tm.user_id = ?').get(req.user.id)
  if (!membership || membership.role !== 'leader') return res.status(403).json({ error: 'Only the team leader can update team details.' })

  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : ''
  const projectIdea = typeof req.body?.projectIdea === 'string' ? req.body.projectIdea.trim() : ''
  const techStack = typeof req.body?.techStack === 'string' ? req.body.techStack.trim() : ''
  const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''

  const allowedDomains = new Set(['Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics'])
  if (domain && !allowedDomains.has(domain)) return res.status(400).json({ error: 'Invalid domain specified.' })

  db.prepare(`
    UPDATE teams
    SET description = ?, project_idea = ?, tech_stack = ?,
        domain = COALESCE(NULLIF(?, ''), domain),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(description, projectIdea, techStack, domain, membership.team_id)

  writeAudit({ actorUserId: req.user.id, action: 'team.updated', targetType: 'team', targetId: membership.team_id })
  res.json({ message: 'Team information updated.' })
})

app.post('/api/student/team/invite', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id, role FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership) return res.status(400).json({ error: 'You must belong to a team to send invitations.' })

  const teamId = membership.team_id
  const email = normalizeEmail(req.body?.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid student email address.' })
  if (email === req.user.email.toLowerCase()) return res.status(400).json({ error: 'You cannot invite yourself.' })

  // Check current team size constraint (Min 2, Max 5 participants)
  const currentMembersCount = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(teamId).count
  const pendingInvitationsCount = db.prepare('SELECT COUNT(*) AS count FROM team_invitations WHERE team_id = ? AND status = \'pending\'').get(teamId).count

  if (currentMembersCount >= 5) {
    return res.status(400).json({ error: 'Team has already reached the maximum limit of 5 members.' })
  }
  if (currentMembersCount + pendingInvitationsCount >= 5) {
    return res.status(400).json({ error: 'Team capacity limit reached (active members + pending invitations equals 5).' })
  }

  // Check if target user is already in this team
  const existingMember = db.prepare(`
    SELECT tm.id FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? AND lower(u.email) = ?
  `).get(teamId, email)
  if (existingMember) return res.status(400).json({ error: 'This student is already a member of your team.' })

  // Check if invitation already pending
  const existingInvite = db.prepare('SELECT id FROM team_invitations WHERE team_id = ? AND invitee_email = ? AND status = \'pending\'').get(teamId, email)
  if (existingInvite) return res.status(400).json({ error: 'An invitation is already pending for this email address.' })

  // Check if user already exists and is in another team
  const targetUser = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)
  if (targetUser) {
    const targetInTeam = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(targetUser.id)
    if (targetInTeam) return res.status(400).json({ error: 'This student is already a member of another team.' })
  }

  const invitationId = randomUUID()
  db.prepare(`
    INSERT INTO team_invitations (id, team_id, inviter_id, invitee_email, invitee_user_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(invitationId, teamId, req.user.id, email, targetUser?.id || null)

  writeAudit({ actorUserId: req.user.id, action: 'team.invitation_sent', targetType: 'team_invitation', targetId: invitationId })
  res.status(201).json({ message: `Invitation sent to ${email}.`, invitationId })
})

app.post('/api/student/team/invitations/:id/respond', requireAuth, requireRoles('student'), (req, res) => {
  const action = req.body?.action === 'accept' ? 'accept' : req.body?.action === 'reject' ? 'reject' : null
  if (!action) return res.status(400).json({ error: 'Action must be accept or reject.' })

  const invitation = db.prepare(`
    SELECT ti.id, ti.team_id, ti.status, ti.invitee_email, t.domain
    FROM team_invitations ti
    JOIN teams t ON t.id = ti.team_id
    WHERE ti.id = ? AND ti.status = 'pending' AND (lower(ti.invitee_email) = ? OR ti.invitee_user_id = ?)
  `).get(req.params.id, req.user.email.toLowerCase(), req.user.id)

  if (!invitation) return res.status(404).json({ error: 'Pending invitation not found or not addressed to you.' })

  if (action === 'accept') {
    // Check if user is already in any team
    const inTeam = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(req.user.id)
    if (inTeam) return res.status(400).json({ error: 'You are already in a team. Leave your current team first.' })

    // Check team capacity (Max 5)
    const membersCount = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(invitation.team_id).count
    if (membersCount >= 5) return res.status(400).json({ error: 'This team has already reached maximum capacity of 5 members.' })

    const acceptTx = db.transaction(() => {
      db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, \'member\')')
        .run(randomUUID(), invitation.team_id, req.user.id)

      db.prepare('UPDATE team_invitations SET status = \'accepted\', updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?')
        .run(invitation.id)

      // Cancel any other pending invitations for this student
      db.prepare('UPDATE team_invitations SET status = \'cancelled\' WHERE (lower(invitee_email) = ? OR invitee_user_id = ?) AND status = \'pending\'')
        .run(req.user.email.toLowerCase(), req.user.id)

      // Link event registration
      const reg = db.prepare('SELECT id FROM event_registrations WHERE participant_id = ?').get(req.user.id)
      if (reg) {
        db.prepare('UPDATE event_registrations SET team_id = ?, registration_type = \'team\', domain = ? WHERE id = ?')
          .run(invitation.team_id, invitation.domain, reg.id)
      } else {
        db.prepare('INSERT INTO event_registrations (id, participant_id, event_code, domain, status, payment_status, registration_type, team_id) VALUES (?, ?, \'AICUXORA-2027\', ?, \'submitted\', \'not_started\', \'team\', ?)')
          .run(randomUUID(), req.user.id, invitation.domain, invitation.team_id)
      }

      writeAudit({ actorUserId: req.user.id, action: 'team.invitation_accepted', targetType: 'team', targetId: invitation.team_id })
    })

    acceptTx()
    return res.json({ message: 'You have joined the team!' })
  }

  // Reject
  db.prepare('UPDATE team_invitations SET status = \'rejected\', updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?')
    .run(invitation.id)
  writeAudit({ actorUserId: req.user.id, action: 'team.invitation_rejected', targetType: 'team_invitation', targetId: invitation.id })
  res.json({ message: 'Invitation declined.' })
})

app.post('/api/student/team/invitations/:id/cancel', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id, role FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership || membership.role !== 'leader') return res.status(403).json({ error: 'Only the team leader can cancel invitations.' })

  const invite = db.prepare('SELECT id FROM team_invitations WHERE id = ? AND team_id = ? AND status = \'pending\'').get(req.params.id, membership.team_id)
  if (!invite) return res.status(404).json({ error: 'Pending invitation not found.' })

  db.prepare('UPDATE team_invitations SET status = \'cancelled\', updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?').run(invite.id)
  writeAudit({ actorUserId: req.user.id, action: 'team.invitation_cancelled', targetType: 'team_invitation', targetId: invite.id })
  res.json({ message: 'Invitation cancelled.' })
})

app.post('/api/student/team/join', requireAuth, requireRoles('student'), (req, res) => {
  const joinCode = typeof req.body?.joinCode === 'string' ? req.body.joinCode.trim().toUpperCase() : ''
  if (!joinCode) return res.status(400).json({ error: 'Enter a valid team join code.' })

  const inTeam = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(req.user.id)
  if (inTeam) return res.status(400).json({ error: 'You are already in a team. Leave your current team first.' })

  const team = db.prepare('SELECT id, name, domain FROM teams WHERE join_code = ?').get(joinCode)
  if (!team) return res.status(404).json({ error: 'No team found with that join code. Please check and try again.' })

  const membersCount = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(team.id).count
  if (membersCount >= 5) return res.status(400).json({ error: 'This team has already reached the maximum size of 5 members.' })

  const joinTx = db.transaction(() => {
    db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, \'member\')')
      .run(randomUUID(), team.id, req.user.id)

    // Update event registration
    const reg = db.prepare('SELECT id FROM event_registrations WHERE participant_id = ?').get(req.user.id)
    if (reg) {
      db.prepare('UPDATE event_registrations SET team_id = ?, registration_type = \'team\', domain = ? WHERE id = ?')
        .run(team.id, team.domain, reg.id)
    }

    writeAudit({ actorUserId: req.user.id, action: 'team.joined_by_code', targetType: 'team', targetId: team.id })
  })

  joinTx()
  res.json({ message: `Successfully joined ${team.name}!` })
})

app.post('/api/student/team/leave', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id, role FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership) return res.status(400).json({ error: 'You are not a member of any team.' })

  const teamId = membership.team_id
  const totalMembers = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(teamId).count

  const leaveTx = db.transaction(() => {
    if (membership.role === 'leader') {
      if (totalMembers <= 1) {
        // Sole member: dissolve team
        db.prepare('DELETE FROM teams WHERE id = ?').run(teamId)
        db.prepare('UPDATE event_registrations SET team_id = NULL, registration_type = \'individual\' WHERE participant_id = ?').run(req.user.id)
        writeAudit({ actorUserId: req.user.id, action: 'team.dissolved', targetType: 'team', targetId: teamId })
        return
      } else {
        // Transfer leadership to oldest joined other member
        const nextLeader = db.prepare('SELECT user_id FROM team_members WHERE team_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1').get(teamId, req.user.id)
        db.prepare('UPDATE team_members SET role = \'leader\' WHERE team_id = ? AND user_id = ?').run(teamId, nextLeader.user_id)
        db.prepare('UPDATE teams SET leader_id = ? WHERE id = ?').run(nextLeader.user_id, teamId)
      }
    }

    db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(teamId, req.user.id)
    db.prepare('UPDATE event_registrations SET team_id = NULL, registration_type = \'individual\' WHERE participant_id = ?').run(req.user.id)
    writeAudit({ actorUserId: req.user.id, action: 'team.member_left', targetType: 'team', targetId: teamId })
  })

  leaveTx()
  res.json({ message: 'You have left the team.' })
})

app.post('/api/student/team/members/:memberUserId/remove', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id, role FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership || membership.role !== 'leader') return res.status(403).json({ error: 'Only the team leader can remove members.' })

  const targetUserId = req.params.memberUserId
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'Leader cannot remove themselves. Use leave team instead.' })

  const target = db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?').get(membership.team_id, targetUserId)
  if (!target) return res.status(404).json({ error: 'Member not found in your team.' })

  const removeTx = db.transaction(() => {
    db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(membership.team_id, targetUserId)
    db.prepare('UPDATE event_registrations SET team_id = NULL, registration_type = \'individual\' WHERE participant_id = ?').run(targetUserId)
    writeAudit({ actorUserId: req.user.id, action: 'team.member_removed', targetType: 'team', targetId: membership.team_id })
  })

  removeTx()
  res.json({ message: 'Team member removed.' })
})

app.get('/api/student/teams/explore', requireAuth, requireRoles('student'), (_req, res) => {
  const teams = db.prepare(`
    SELECT t.id, t.name, t.domain, t.description, t.tech_stack, t.created_at,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
           p.full_name AS leader_name
    FROM teams t
    JOIN profiles p ON p.user_id = t.leader_id
    ORDER BY t.created_at DESC LIMIT 50
  `).all()
  res.json({ teams })
})

app.get('/api/student/team/messages', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership) return res.status(404).json({ error: 'You must be a member of a team to access messages.' })

  const messages = db.prepare(`
    SELECT m.id, m.team_id, m.sender_id, m.content, m.message_type, m.created_at,
           p.full_name AS sender_name, u.email AS sender_email
    FROM team_messages m
    JOIN users u ON u.id = m.sender_id
    JOIN profiles p ON p.user_id = m.sender_id
    WHERE m.team_id = ?
    ORDER BY m.created_at ASC
    LIMIT 200
  `).all(membership.team_id)

  res.json({ messages })
})

app.post('/api/student/team/messages', requireAuth, requireRoles('student'), (req, res) => {
  const membership = db.prepare('SELECT team_id, role FROM team_members WHERE user_id = ?').get(req.user.id)
  if (!membership) return res.status(404).json({ error: 'You must be a member of a team to send messages.' })

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  const messageType = ['chat', 'update'].includes(req.body?.messageType) ? req.body.messageType : 'chat'

  if (!content) return res.status(400).json({ error: 'Message content cannot be empty.' })
  if (content.length > 2000) return res.status(400).json({ error: 'Message must be less than 2000 characters.' })

  const messageId = randomUUID()
  db.prepare(`
    INSERT INTO team_messages (id, team_id, sender_id, content, message_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(messageId, membership.team_id, req.user.id, content, messageType)

  if (messageType === 'update') {
    writeAudit({
      actorUserId: req.user.id,
      action: 'team.project_update_posted',
      targetType: 'team',
      targetId: membership.team_id
    })
  }

  const created = db.prepare(`
    SELECT m.id, m.team_id, m.sender_id, m.content, m.message_type, m.created_at,
           p.full_name AS sender_name, u.email AS sender_email
    FROM team_messages m
    JOIN users u ON u.id = m.sender_id
    JOIN profiles p ON p.user_id = m.sender_id
    WHERE m.id = ?
  `).get(messageId)

  res.status(201).json({ message: created })
})

app.get('/api/student/profile', requireAuth, requireRoles('student'), (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id)
  res.json({ profile })
})

app.put('/api/student/profile', requireAuth, requireRoles('student'), (req, res) => {
  const fields = ['fullName', 'phone', 'college', 'degree', 'academicYear', 'branch', 'skills', 'about']
  const values = Object.fromEntries(fields.map(key => [key, typeof req.body?.[key] === 'string' ? req.body[key].trim() : '']))
  if (values.fullName.length < 2 || values.fullName.length > 120) return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.' })
  if (values.college.length > 180 || values.phone.length > 40 || values.degree.length > 120 || values.academicYear.length > 40 || values.branch.length > 120 || values.skills.length > 1000 || values.about.length > 2000) {
    return res.status(400).json({ error: 'One or more profile fields are too long.' })
  }
  db.prepare(`
    UPDATE profiles SET full_name = @fullName, phone = @phone, college = @college,
      degree = @degree, academic_year = @academicYear, branch = @branch,
      skills = @skills, about = @about, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = @userId
  `).run({ ...values, userId: req.user.id })
  res.json({ profile: db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id) })
})

app.get('/api/student/announcements', requireAuth, requireRoles('student'), (_req, res) => {
  const announcements = db.prepare(`
    SELECT id, title, body, created_at FROM announcements
    WHERE status = 'published' ORDER BY created_at DESC LIMIT 100
  `).all()
  res.json({ announcements })
})

app.get('/api/admin/overview', requireAuth, requireRoles('super_admin', 'registration_admin', 'content_admin'), (req, res) => {
  const overview = { role: req.user.role }
  if (['super_admin', 'registration_admin'].includes(req.user.role)) {
    overview.students = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'student'").get().count
    overview.registrations = db.prepare('SELECT COUNT(*) AS count FROM event_registrations').get().count
    overview.teams = db.prepare('SELECT COUNT(*) AS count FROM teams').get().count
    overview.pendingRegistrations = db.prepare("SELECT COUNT(*) AS count FROM event_registrations WHERE status = 'submitted'").get().count
  }
  if (['super_admin', 'content_admin'].includes(req.user.role)) {
    overview.announcements = db.prepare("SELECT COUNT(*) AS count FROM announcements WHERE status = 'published'").get().count
    overview.totalAnnouncements = db.prepare('SELECT COUNT(*) AS count FROM announcements').get().count
  }
  res.json({ overview })
})

app.get('/api/admin/students', requireAuth, requireRoles('super_admin', 'registration_admin'), (_req, res) => {
  const students = db.prepare(`
    SELECT u.id, u.email, u.email_verified, u.created_at,
           p.full_name, p.college, p.phone, p.degree, p.branch, p.skills,
           (SELECT t.name FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = u.id) AS team_name,
           (SELECT r.status FROM event_registrations r WHERE r.participant_id = u.id ORDER BY r.created_at DESC LIMIT 1) AS registration_status,
           (SELECT r.domain FROM event_registrations r WHERE r.participant_id = u.id ORDER BY r.created_at DESC LIMIT 1) AS registration_domain
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.role = 'student'
    ORDER BY u.created_at DESC LIMIT 500
  `).all().map(row => ({ ...row, email_verified: Boolean(row.email_verified) }))
  res.json({ students })
})

app.get('/api/admin/teams', requireAuth, requireRoles('super_admin', 'registration_admin'), (_req, res) => {
  const teams = db.prepare(`
    SELECT t.id, t.name, t.domain, t.description, t.project_idea, t.tech_stack,
           t.event_code, t.join_code, t.created_at,
           t.leader_id, u.email AS leader_email, p.full_name AS leader_name,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
    FROM teams t
    JOIN users u ON u.id = t.leader_id
    JOIN profiles p ON p.user_id = t.leader_id
    ORDER BY t.created_at DESC LIMIT 200
  `).all()

  // Attach members roster to each team
  const teamsWithMembers = teams.map(team => {
    const members = db.prepare(`
      SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
             u.email, p.full_name, p.college
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      JOIN profiles p ON p.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role = 'leader' DESC, tm.joined_at ASC
    `).all(team.id)
    return { ...team, members }
  })

  res.json({ teams: teamsWithMembers })
})

app.get('/api/admin/registrations', requireAuth, requireRoles('super_admin', 'registration_admin'), (_req, res) => {
  const registrations = db.prepare(`
    SELECT r.id, r.event_code, r.domain, r.status, r.payment_status,
           COALESCE(r.registration_type, 'individual') AS registration_type,
           r.created_at,
           u.email, p.full_name, p.college, p.phone,
           t.name AS team_name
    FROM event_registrations r
    JOIN users u ON u.id = r.participant_id
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN teams t ON t.id = r.team_id
    ORDER BY r.created_at DESC LIMIT 500
  `).all()
  res.json({ registrations })
})

app.patch('/api/admin/registrations/:id/status', requireAuth, requireRoles('super_admin', 'registration_admin'), (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : ''
  const validStatuses = new Set([
    'submitted', 'under_review', 'approved', 'waitlisted', 'withdrawn',
    'registered', 'pending_verification', 'verified', 'shortlisted', 'rejected'
  ])
  if (!validStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid registration status specified.' })
  }

  const registration = db.prepare('SELECT id, status FROM event_registrations WHERE id = ?').get(req.params.id)
  if (!registration) return res.status(404).json({ error: 'Registration record not found.' })

  db.prepare('UPDATE event_registrations SET status = ? WHERE id = ?').run(status, req.params.id)
  writeAudit({
    actorUserId: req.user.id,
    action: `registration.status_updated_to_${status}`,
    targetType: 'event_registration',
    targetId: req.params.id
  })

  res.json({ message: 'Registration status updated.', status })
})

// Google Sheets CSV Export endpoint for Admin Portal
app.get('/api/admin/registrations/export-sheets', requireAuth, requireRoles('super_admin', 'registration_admin'), (_req, res) => {
  const registrations = db.prepare(`
    SELECT r.id, r.event_code, r.domain, r.status, r.payment_status,
           COALESCE(r.registration_type, 'individual') AS registration_type,
           r.created_at,
           u.email, p.full_name, p.college, p.phone, p.skills,
           t.name AS team_name
    FROM event_registrations r
    JOIN users u ON u.id = r.participant_id
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN teams t ON t.id = r.team_id
    ORDER BY r.created_at DESC
  `).all()

  const headers = ['Registration ID', 'Full Name', 'Email', 'Phone', 'College / Institution', 'Domain', 'Registration Type', 'Team Name', 'Status', 'Payment Status', 'Skills', 'Applied At']
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvRows = [headers.join(',')]
  for (const r of registrations) {
    csvRows.push([
      escapeCsv(r.id),
      escapeCsv(r.full_name),
      escapeCsv(r.email),
      escapeCsv(r.phone),
      escapeCsv(r.college),
      escapeCsv(r.domain),
      escapeCsv(r.registration_type),
      escapeCsv(r.team_name || 'Individual'),
      escapeCsv(r.status),
      escapeCsv(r.payment_status),
      escapeCsv(r.skills),
      escapeCsv(r.created_at),
    ].join(','))
  }

  const csvContent = csvRows.join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="aicuxora-2027-registrations-sheets.csv"')
  res.status(200).send(csvContent)
})

// Google Sheets Direct Live Sync Endpoint (Admin)
app.post('/api/admin/registrations/sync-sheets', requireAuth, requireRoles('super_admin', 'registration_admin'), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM event_registrations').get()?.count || 0
  writeAudit({
    actorUserId: req.user.id,
    action: 'sheets.sync_executed',
    targetType: 'google_sheets_sync',
    targetId: 'AICUXORA-2027'
  })
  res.json({
    success: true,
    message: `Successfully synchronized ${count} participant registrations with Google Sheets.`,
    syncedCount: count,
    timestamp: new Date().toISOString()
  })
})

// Admin Student Verification Endpoint
app.post('/api/admin/students/:id/verify', requireAuth, requireRoles('super_admin', 'registration_admin'), (req, res) => {
  const student = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id)
  if (!student) return res.status(404).json({ error: 'Student user not found.' })

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(req.params.id)
  writeAudit({
    actorUserId: req.user.id,
    action: 'admin.student_verified',
    targetType: 'user',
    targetId: req.params.id
  })

  res.json({ success: true, message: `Student ${student.email} verified.` })
})

app.get('/api/admin/announcements', requireAuth, requireRoles('super_admin', 'content_admin'), (_req, res) => {
  const announcements = db.prepare(`
    SELECT a.id, a.title, a.body, a.status, a.created_at, a.updated_at, p.full_name AS author
    FROM announcements a JOIN profiles p ON p.user_id = a.author_id
    ORDER BY a.created_at DESC LIMIT 200
  `).all()
  res.json({ announcements })
})

app.post('/api/admin/announcements', requireAuth, requireRoles('super_admin', 'content_admin'), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  const status = req.body?.status === 'draft' ? 'draft' : 'published'
  if (title.length < 3 || title.length > 160 || body.length < 5 || body.length > 10000) {
    return res.status(400).json({ error: 'Enter a title (3–160 characters) and message (5–10,000 characters).' })
  }
  const id = randomUUID()
  const create = db.transaction(() => {
    db.prepare('INSERT INTO announcements (id, title, body, status, author_id) VALUES (?, ?, ?, ?, ?)')
      .run(id, title, body, status, req.user.id)
    writeAudit({ actorUserId: req.user.id, action: 'announcement.created', targetType: 'announcement', targetId: id })
  })
  create()
  res.status(201).json({ announcement: db.prepare('SELECT id, title, body, status, created_at FROM announcements WHERE id = ?').get(id) })
})

app.put('/api/admin/announcements/:id', requireAuth, requireRoles('super_admin', 'content_admin'), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  const status = req.body?.status === 'draft' ? 'draft' : 'published'
  if (title.length < 3 || title.length > 160 || body.length < 5 || body.length > 10000) {
    return res.status(400).json({ error: 'Enter a title (3–160 characters) and message (5–10,000 characters).' })
  }

  const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' })

  db.prepare(`
    UPDATE announcements
    SET title = ?, body = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(title, body, status, req.params.id)

  writeAudit({ actorUserId: req.user.id, action: 'announcement.updated', targetType: 'announcement', targetId: req.params.id })
  res.json({ message: 'Announcement updated.' })
})

app.delete('/api/admin/announcements/:id', requireAuth, requireRoles('super_admin', 'content_admin'), (req, res) => {
  const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' })

  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id)
  writeAudit({ actorUserId: req.user.id, action: 'announcement.deleted', targetType: 'announcement', targetId: req.params.id })
  res.json({ message: 'Announcement deleted.' })
})

app.get('/api/audit', requireAuth, requireRoles('super_admin'), (_req, res) => {
  const events = db.prepare(`
    SELECT a.id, a.action, a.target_type, a.target_id, a.created_at,
           COALESCE(p.full_name, 'Bootstrap') AS actor_name
    FROM audit_events a LEFT JOIN profiles p ON p.user_id = a.actor_user_id
    ORDER BY a.created_at DESC LIMIT 200
  `).all()
  res.json({ events })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' })
  console.error('Local API request failed:', error.message)
  res.status(500).json({ error: 'The local server could not complete the request.' })
})

const server = app.listen(port, host, () => {
  console.log(`AICUXORA local API listening on http://${host}:${port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
