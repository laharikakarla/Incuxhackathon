import initSqlJs from 'sql.js'
import { randomUUID } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = path.resolve(process.env.AICUXORA_DATA_DIR || path.join(projectRoot, '.local'))
mkdirSync(dataDirectory, { recursive: true })
const databaseFile = path.join(dataDirectory, 'aicuxora.sqlite')
const lockFile = `${databaseFile}.lock`
const wasmFile = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url))

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false
  try { process.kill(pid, 0); return true } catch (error) { return error.code !== 'ESRCH' }
}

function claimDatabaseLock() {
  while (true) {
    try {
      const descriptor = openSync(lockFile, 'wx')
      writeSync(descriptor, `${process.pid}\n`)
      closeSync(descriptor)
      return
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const ownerPid = Number.parseInt(readFileSync(lockFile, 'utf8'), 10)
      if (isProcessRunning(ownerPid)) throw new Error('The local database is already open in another process. Stop the AICUXORA app before running local admin setup.')
      try { unlinkSync(lockFile) } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw unlinkError }
    }
  }
}

claimDatabaseLock()
const SQL = await initSqlJs({ locateFile: file => file.endsWith('.wasm') ? wasmFile : file })
const raw = new SQL.Database(existsSync(databaseFile) ? readFileSync(databaseFile) : undefined)
raw.run('PRAGMA foreign_keys = ON')

function persist() {
  const pendingFile = `${databaseFile}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(pendingFile, Buffer.from(raw.export()))
  try {
    if (existsSync(databaseFile)) {
      copyFileSync(pendingFile, databaseFile)
      unlinkSync(pendingFile)
    } else {
      renameSync(pendingFile, databaseFile)
    }
  } catch (error) {
    try { unlinkSync(pendingFile) } catch { /* leave cleanup to the next local startup */ }
    throw error
  }
}

let transactionDepth = 0

class Statement {
  constructor(sql) { this.sql = sql }

  execute(parameters, mode) {
    const statement = raw.prepare(this.sql)
    try {
      if (parameters.length === 1 && parameters[0] && typeof parameters[0] === 'object' && !Array.isArray(parameters[0])) {
        const bindings = Object.fromEntries(Object.entries(parameters[0]).map(([key, value]) => [key.startsWith('@') || key.startsWith(':') || key.startsWith('$') ? key : `@${key}`, value]))
        statement.bind(bindings)
      } else if (parameters.length) {
        statement.bind(parameters.length === 1 && Array.isArray(parameters[0]) ? parameters[0] : parameters)
      }

      if (mode === 'get') return statement.step() ? statement.getAsObject() : undefined
      if (mode === 'all') {
        const rows = []
        while (statement.step()) rows.push(statement.getAsObject())
        return rows
      }

      while (statement.step()) { /* consume any RETURNING rows */ }
      const changes = raw.getRowsModified()
      if (transactionDepth === 0) persist()
      return { changes }
    } finally {
      statement.free()
    }
  }

  run(...parameters) { return this.execute(parameters, 'run') }
  get(...parameters) { return this.execute(parameters, 'get') }
  all(...parameters) { return this.execute(parameters, 'all') }
}

export const db = {
  prepare(sql) { return new Statement(sql) },
  exec(sql) {
    raw.exec(sql)
    if (transactionDepth === 0) persist()
  },
  transaction(callback) {
    return (...args) => {
      raw.run('BEGIN IMMEDIATE')
      transactionDepth += 1
      let result
      try {
        result = callback(...args)
        raw.run('COMMIT')
        transactionDepth -= 1
      } catch (error) {
        try { raw.run('ROLLBACK') } catch { /* transaction may already have ended */ }
        transactionDepth -= 1
        throw error
      }
      persist()
      return result
    }
  },
  close() {
    persist()
    raw.close()
    try {
      if (Number.parseInt(readFileSync(lockFile, 'utf8'), 10) === process.pid) unlinkSync(lockFile)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  },
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'super_admin', 'registration_admin', 'content_admin')),
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    college TEXT NOT NULL DEFAULT '',
    degree TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    about TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_code TEXT NOT NULL DEFAULT 'AICUXORA-2027',
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'waitlisted', 'withdrawn')),
    payment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (payment_status IN ('not_started', 'pending', 'paid', 'failed', 'refunded')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(participant_id, event_code)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    author_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS announcements_status_date_idx ON announcements(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'bootstrap')),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at DESC);

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    project_idea TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL,
    tech_stack TEXT NOT NULL DEFAULT '',
    event_code TEXT NOT NULL DEFAULT 'AICUXORA-2027',
    leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    join_code TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS teams_domain_idx ON teams(domain);

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(team_id, user_id),
    UNIQUE(user_id)
  );
  CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members(user_id);

  CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    inviter_id TEXT NOT NULL REFERENCES users(id),
    invitee_email TEXT NOT NULL COLLATE NOCASE,
    invitee_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS team_invitations_email_idx ON team_invitations(invitee_email, status);
  CREATE INDEX IF NOT EXISTS team_invitations_team_idx ON team_invitations(team_id, status);

  CREATE TABLE IF NOT EXISTS team_messages (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'chat' CHECK (message_type IN ('chat', 'update', 'system')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS team_messages_team_idx ON team_messages(team_id, created_at ASC);
`)

// Safe additive migration for event_registrations
try {
  const regCols = db.prepare("PRAGMA table_info(event_registrations)").all().map(c => c.name)
  if (!regCols.includes('team_id')) {
    db.exec("ALTER TABLE event_registrations ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE SET NULL")
  }
  if (!regCols.includes('registration_type')) {
    db.exec("ALTER TABLE event_registrations ADD COLUMN registration_type TEXT NOT NULL DEFAULT 'individual'")
  }

  // Safe migration for expanded registration status values
  const tableDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='event_registrations'").get()?.sql || ''
  if (tableDef.includes("'waitlisted', 'withdrawn')")) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE event_registrations_v2 (
          id TEXT PRIMARY KEY,
          participant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_code TEXT NOT NULL DEFAULT 'AICUXORA-2027',
          domain TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'waitlisted', 'withdrawn', 'registered', 'pending_verification', 'verified', 'shortlisted', 'rejected')),
          payment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (payment_status IN ('not_started', 'pending', 'paid', 'failed', 'refunded')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
          registration_type TEXT NOT NULL DEFAULT 'individual',
          UNIQUE(participant_id, event_code)
        );
        INSERT INTO event_registrations_v2 (id, participant_id, event_code, domain, status, payment_status, created_at, team_id, registration_type)
        SELECT id, participant_id, event_code, domain, status, payment_status, created_at, team_id, registration_type FROM event_registrations;
        DROP TABLE event_registrations;
        ALTER TABLE event_registrations_v2 RENAME TO event_registrations;
      `)
    })()
  }
} catch (migErr) {
  console.warn('Migration note for event_registrations:', migErr.message)
}

export function writeAudit({ actorUserId = null, actorType = 'user', action, targetType, targetId }) {
  db.prepare(`
    INSERT INTO audit_events (id, actor_user_id, actor_type, action, target_type, target_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), actorUserId, actorType, action, targetType, targetId)
}
