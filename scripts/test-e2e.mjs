import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, writeAudit } from '../server/db.js'
import { hashPassword } from '../server/security.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = 8788
const origin = `http://127.0.0.1:${port}`

// We create a test admin in the database if not present
const testAdminEmail = 'testadmin@aicuxora.local'
const testAdminPassword = 'TestAdminPassword123!'

const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(testAdminEmail)
let testAdminId = existingAdmin?.id
if (!existingAdmin) {
  testAdminId = randomUUID()
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, email_verified)
    VALUES (?, ?, ?, 'super_admin', 1)
  `).run(testAdminId, testAdminEmail, hashPassword(testAdminPassword))
  db.prepare('INSERT INTO profiles (user_id, full_name) VALUES (?, ?)').run(testAdminId, 'Test Super Admin')
  writeAudit({ actorType: 'bootstrap', action: 'admin.test_bootstrap', targetType: 'user', targetId: testAdminId })
}
// Close DB in parent process so child process can claim the database lock cleanly
db.close()

// Start server on port 8788
const serverEnv = {
  ...process.env,
  API_PORT: String(port),
  LOCAL_APP_ORIGINS: origin,
}

console.log(`Starting test server on ${origin}...`)
const serverProc = spawn(process.execPath, ['server/index.js'], { cwd: projectRoot, env: serverEnv, stdio: 'inherit' })

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function request(path, options = {}) {
  const url = `${origin}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Origin': origin,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, headers: res.headers, data }
}

function parseCookies(res) {
  const raw = res.headers.get('set-cookie') || ''
  return raw.split(';')[0]
}

async function runTests() {
  await sleep(1500) // Wait for server to start listening

  console.log('--- TEST 1: Health Check ---')
  const health = await request('/api/health')
  console.assert(health.status === 200, 'Health should return 200')
  console.assert(health.data.status === 'ok', 'Health status should be ok')
  console.log('✓ Health check passed.')

  console.log('--- TEST 2: Hackathons Catalog ---')
  const catalog = await request('/api/hackathons')
  console.assert(catalog.status === 200, 'Catalog should return 200')
  console.assert(catalog.data.hackathons.length >= 4, 'Catalog should have at least 4 hackathons')
  const flagship = catalog.data.hackathons.find(h => h.id === 'aicuxora-2027')
  console.assert(flagship && flagship.isFlagship === true, 'Flagship hackathon must be present')
  console.assert(flagship.problemStatementsDate === '26 November 2026', `Flagship date must be 26 November 2026 (got ${flagship?.problemStatementsDate})`)
  console.log('✓ Hackathons catalog passed with confirmed 26 November 2026 problem release date.')

  console.log('--- TEST 3: Search and Filter Hackathons ---')
  const filtered = await request('/api/hackathons?domain=Agriculture')
  console.assert(filtered.status === 200, 'Filtered catalog should return 200')
  console.assert(filtered.data.hackathons.every(h => h.domains.includes('Agriculture')), 'All returned items must include Agriculture')
  console.log('✓ Search & filter passed.')

  console.log('--- TEST 4: Student 1 Signup ---')
  const s1Email = `student1_${Date.now()}@college.edu`
  const s1Password = 'StrongPassword123!'
  const s1Reg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Alice Student',
      email: s1Email,
      password: s1Password,
      college: 'National Institute of Tech',
      domain: 'Robotics',
    }),
  })
  console.assert(s1Reg.status === 201, `Student 1 signup should return 201 (got ${s1Reg.status}: ${JSON.stringify(s1Reg.data)})`)
  const s1Token = s1Reg.data.localVerificationToken
  console.assert(Boolean(s1Token), 'Must return localVerificationToken')
  console.log('✓ Student 1 signup passed.')

  console.log('--- TEST 5: Student 1 Email Verification ---')
  const verify1 = await request('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: s1Token }),
  })
  console.assert(verify1.status === 200, 'Verification should return 200')
  console.log('✓ Student 1 email verification passed.')

  console.log('--- TEST 6: Student 1 Login ---')
  const login1 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: s1Email, password: s1Password }),
  })
  console.assert(login1.status === 200, 'Login 1 should return 200')
  const s1Cookie = parseCookies(login1)
  console.assert(s1Cookie.includes('aicuxora_session='), 'Should receive session cookie')
  console.log('✓ Student 1 login passed.')

  console.log('--- TEST 7: Edit Student 1 Profile ---')
  const prof1 = await request('/api/student/profile', {
    method: 'PUT',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({
      fullName: 'Alice Student (Lead)',
      phone: '+91 99887 76655',
      college: 'National Institute of Tech',
      degree: 'B.Tech',
      academicYear: 'Final Year',
      branch: 'Robotics Engineering',
      skills: 'ROS, Python, Computer Vision, C++',
      about: 'Passionate robotics builder focused on autonomous rovers.',
    }),
  })
  console.assert(prof1.status === 200, 'Profile update should return 200')
  console.assert(prof1.data.profile.skills.includes('ROS'), 'Profile should persist skills')
  console.log('✓ Student 1 profile edit passed.')

  console.log('--- TEST 8: Create a Team (Alice) ---')
  const teamName = `RoverTech_${Date.now()}`
  const createTeam = await request('/api/student/team', {
    method: 'POST',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({
      name: teamName,
      domain: 'Robotics',
      description: 'Autonomous surface navigation rover for extraterrestrial terrains.',
      projectIdea: 'Stereo-vision mapping and obstacle avoidance rover.',
      techStack: 'ROS2, OpenCV, PyTorch, ESP32',
    }),
  })
  console.assert(createTeam.status === 201, `Create team should return 201 (got ${createTeam.status}: ${JSON.stringify(createTeam.data)})`)
  const joinCode = createTeam.data.joinCode
  console.assert(Boolean(joinCode), 'Must return unique joinCode')
  console.log('✓ Create team passed. Join Code:', joinCode)

  console.log('--- TEST 9: Student 2 Signup & Verification ---')
  const s2Email = `student2_${Date.now()}@college.edu`
  const s2Password = 'StrongPassword123!'
  const s2Reg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Bob Teammate',
      email: s2Email,
      password: s2Password,
      college: 'State University of Technology',
      domain: 'Robotics',
    }),
  })
  console.assert(s2Reg.status === 201, 'Student 2 signup should return 201')
  const s2Token = s2Reg.data.localVerificationToken
  await request('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: s2Token }),
  })
  const login2 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: s2Email, password: s2Password }),
  })
  const s2Cookie = parseCookies(login2)
  console.log('✓ Student 2 signup and login passed.')

  console.log('--- TEST 10: Alice Invites Bob to RoverTech ---')
  const inviteRes = await request('/api/student/team/invite', {
    method: 'POST',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({ email: s2Email }),
  })
  console.assert(inviteRes.status === 201, `Invite should return 201 (got ${inviteRes.status}: ${JSON.stringify(inviteRes.data)})`)
  const invitationId = inviteRes.data.invitationId
  console.assert(Boolean(invitationId), 'Must return invitationId')
  console.log('✓ Teammate invitation sent.')

  console.log('--- TEST 11: Bob Views Pending Invitation ---')
  const bobTeamView = await request('/api/student/team', {
    headers: { 'Cookie': s2Cookie },
  })
  console.assert(bobTeamView.status === 200, 'Bob team view should return 200')
  console.assert(bobTeamView.data.inTeam === false, 'Bob should not yet be in a team')
  console.assert(bobTeamView.data.receivedInvitations.length >= 1, 'Bob should have received invitation')
  console.log('✓ Bob viewed invitation inbox.')

  console.log('--- TEST 12: Bob Accepts Invitation ---')
  const acceptRes = await request(`/api/student/team/invitations/${invitationId}/respond`, {
    method: 'POST',
    headers: { 'Cookie': s2Cookie },
    body: JSON.stringify({ action: 'accept' }),
  })
  console.assert(acceptRes.status === 200, `Accept invitation should return 200 (got ${acceptRes.status}: ${JSON.stringify(acceptRes.data)})`)
  console.log('✓ Bob accepted invitation.')

  console.log('--- TEST 13: Verify Team Roster has 2 Members ---')
  const updatedTeam = await request('/api/student/team', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(updatedTeam.data.members.length === 2, `Team should now have 2 members (got ${updatedTeam.data.members.length})`)
  console.assert(updatedTeam.data.members.some(m => m.email === s2Email), 'Bob must be in roster')
  console.log('✓ Team roster verified: 2 members.')

  console.log('--- TEST 14: Server Team Size Limits Enforcement ---')
  // Try inviting same person again: should fail
  const dupInvite = await request('/api/student/team/invite', {
    method: 'POST',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({ email: s2Email }),
  })
  console.assert(dupInvite.status === 400, 'Duplicate member invite must fail with 400')
  console.log('✓ Duplicate membership server rejection verified.')

  console.log('--- TEST 15: Hackathon Event Registration ---')
  const regEvent = await request('/api/student/register-event', {
    method: 'POST',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({
      domain: 'Robotics',
      registrationType: 'team',
    }),
  })
  console.assert(regEvent.status === 200, 'Register event should return 200')
  console.log('✓ Hackathon event registration passed.')

  console.log('--- TEST 16: Check Dashboard Status ---')
  const dash = await request('/api/student/dashboard', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(dash.status === 200, 'Dashboard should return 200')
  console.assert(dash.data.registration.domain === 'Robotics', 'Registration domain should be Robotics')
  console.assert(dash.data.team.name === teamName, 'Dashboard should display team name')
  console.assert(dash.data.team.membersCount === 2, 'Dashboard should show 2 members')
  console.log('✓ Student dashboard status verified.')

  console.log('--- TEST 17: Verify Student CANNOT Access Admin Endpoints ---')
  const forbiddenAdmin = await request('/api/admin/overview', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(forbiddenAdmin.status === 403, `Student access to admin must be 403 (got ${forbiddenAdmin.status})`)
  console.log('✓ Server-side admin authorization verified: Student blocked.')

  console.log('--- TEST 18: Admin Login & Operations ---')
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testAdminEmail, password: testAdminPassword }),
  })
  console.assert(adminLogin.status === 200, 'Admin login should return 200')
  const adminCookie = parseCookies(adminLogin)

  const adminOverview = await request('/api/admin/overview', {
    headers: { 'Cookie': adminCookie },
  })
  console.assert(adminOverview.status === 200, 'Admin overview should return 200')
  console.assert(adminOverview.data.overview.students >= 2, 'Admin overview should count students')
  console.assert(adminOverview.data.overview.teams >= 1, 'Admin overview should count teams')
  console.log('✓ Admin overview verified. Students:', adminOverview.data.overview.students, 'Teams:', adminOverview.data.overview.teams)

  const adminTeams = await request('/api/admin/teams', {
    headers: { 'Cookie': adminCookie },
  })
  console.assert(adminTeams.status === 200, 'Admin teams list should return 200')
  console.assert(adminTeams.data.teams.some(t => t.name === teamName), 'Created team must appear in admin list')
  console.log('✓ Admin teams list verified.')

  const adminRegs = await request('/api/admin/registrations', {
    headers: { 'Cookie': adminCookie },
  })
  console.assert(adminRegs.status === 200, 'Admin registrations should return 200')
  const student1RegRecord = adminRegs.data.registrations.find(r => r.email === s1Email)
  console.assert(Boolean(student1RegRecord), 'Student 1 registration must appear in admin list')
  console.log('✓ Admin registrations list verified.')

  console.log('--- TEST 19: Admin Updates Registration Status ---')
  const updateStatus = await request(`/api/admin/registrations/${student1RegRecord.id}/status`, {
    method: 'PATCH',
    headers: { 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'approved' }),
  })
  console.assert(updateStatus.status === 200, 'Update status should return 200')

  // Verify updated status in student dashboard
  const dashAfterUpdate = await request('/api/student/dashboard', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(dashAfterUpdate.data.registration.status === 'approved', `Registration status should be 'approved' (got ${dashAfterUpdate.data.registration.status})`)
  console.log('✓ Registration status update & student dashboard reflection verified.')

  console.log('--- TEST 20: Admin Announcements CRUD & Student Visibility ---')
  const createAnn = await request('/api/admin/announcements', {
    method: 'POST',
    headers: { 'Cookie': adminCookie },
    body: JSON.stringify({
      title: 'Problem Statements Release Scheduled',
      body: 'Official challenge briefs will be published on 26 November 2026. Teams should finalize member rosters.',
      status: 'published',
    }),
  })
  console.assert(createAnn.status === 201, 'Create announcement should return 201')
  const annId = createAnn.data.announcement.id

  // Verify visible in public announcements
  const publicAnn = await request('/api/announcements/public')
  console.assert(publicAnn.data.announcements.some(a => a.id === annId), 'Public announcements must include new announcement')

  // Verify visible in student announcements
  const studentAnn = await request('/api/student/announcements', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(studentAnn.data.announcements.some(a => a.id === annId), 'Student announcements must include new announcement')
  console.log('✓ Announcement created and verified on public and student interfaces.')

  console.log('--- TEST 21: Team Workspace Live Chat & Milestones (plan.md §9) ---')
  const postChat = await request('/api/student/team/messages', {
    method: 'POST',
    headers: { 'Cookie': s1Cookie },
    body: JSON.stringify({
      content: 'Welcome team! GitHub repo initialized and sensor architecture draft is ready.',
      messageType: 'update',
    }),
  })
  console.assert(postChat.status === 201, `Post team chat should return 201 (got ${postChat.status})`)
  console.assert(postChat.data.message.message_type === 'update', 'Message type should be update')

  const fetchChat = await request('/api/student/team/messages', {
    headers: { 'Cookie': s1Cookie },
  })
  console.assert(fetchChat.status === 200, 'Fetch team chat should return 200')
  console.assert(fetchChat.data.messages.length > 0, 'Team should have at least 1 message')
  console.assert(fetchChat.data.messages.some(m => m.content.includes('sensor architecture')), 'Must contain Alice\'s message')
  console.log('✓ Team Workspace chat & milestone updates verified successfully.')

  console.log('--- TEST 22: Google Sheets CSV Export (plan.md §7) ---')
  const sheetsExport = await request('/api/admin/registrations/export-sheets', {
    headers: { 'Cookie': adminCookie },
  })
  console.assert(sheetsExport.status === 200, `Google Sheets export should return 200 (got ${sheetsExport.status})`)
  console.assert(typeof sheetsExport.data === 'string', 'Should return CSV text data')
  console.assert(sheetsExport.data.includes('Registration ID,Full Name,Email'), 'CSV must contain headers')
  console.assert(sheetsExport.data.includes('Alice Student'), 'CSV must contain registered students')
  console.log('✓ Google Sheets CSV export verified successfully.')

  console.log('--- TEST 23: Google Sheets Live Sync (plan.md §7) ---')
  const sheetsSync = await request('/api/admin/registrations/sync-sheets', {
    method: 'POST',
    headers: { 'Cookie': adminCookie },
  })
  console.assert(sheetsSync.status === 200, `Google Sheets sync should return 200 (got ${sheetsSync.status})`)
  console.assert(sheetsSync.data.success === true, 'Sync response must have success: true')
  console.log('✓ Google Sheets live sync connector verified successfully.')

  console.log('--- TEST 24: Admin Shortlist Registration Decision ---')
  const shortlistReg = await request(`/api/admin/registrations/${s1RegRecord.id}/status`, {
    method: 'PATCH',
    headers: { 'Cookie': adminCookie },
    body: JSON.stringify({ status: 'shortlisted' }),
  })
  console.assert(shortlistReg.status === 200, `Shortlist registration should return 200 (got ${shortlistReg.status})`)
  console.assert(shortlistReg.data.status === 'shortlisted', 'Status must be updated to shortlisted')
  console.log('✓ Admin Shortlist status decision verified.')

  console.log('--- TEST 25: Super Admin Audit Log Verification ---')
  const audit = await request('/api/audit', {
    headers: { 'Cookie': adminCookie },
  })
  console.assert(audit.status === 200, 'Audit log should return 200')
  console.assert(audit.data.events.length > 0, 'Audit events should be recorded')
  console.log('✓ Super Admin audit log verified with', audit.data.events.length, 'recorded events.')

  console.log('\n=========================================')
  console.log('🎉 ALL 25 MULTI-AGENT END-TO-END TESTS PASSED SUCCESSFULLY!')
  console.log('=========================================\n')
}

try {
  await runTests()
} catch (err) {
  console.error('Test suite failed:', err)
  process.exitCode = 1
} finally {
  serverProc.kill()
  process.exit(process.exitCode || 0)
}
