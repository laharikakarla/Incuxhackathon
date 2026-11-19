import { randomUUID } from 'node:crypto'
import { db, writeAudit } from './db.js'
import { hashPassword } from './security.js'

function prompt(label, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal.'))
      return
    }
    let value = ''
    process.stdout.write(label)
    const finish = (error) => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      if (error) reject(error)
      else {
        process.stdout.write('\n')
        resolve(value)
      }
    }
    const onData = (input) => {
      for (const byte of input) {
        if (byte === 3) return finish(new Error('Cancelled.'))
        if (byte === 13 || byte === 10) return finish()
        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1)
          if (!hidden) process.stdout.write('\b \b')
          continue
        }
        if (byte >= 32 && byte <= 126) {
          value += String.fromCharCode(byte)
          process.stdout.write(hidden ? '*' : String.fromCharCode(byte))
        }
      }
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

try {
  console.log('Create a local AICUXORA administrator. The password is hidden while typed.')
  const fullName = (await prompt('Administrator name: ')).trim()
  const email = (await prompt('Administrator email: ')).trim().toLowerCase()
  const role = (await prompt('Role (super_admin / registration_admin / content_admin): ')).trim()
  const password = await prompt('Password (minimum 12 characters): ', { hidden: true })
  const allowedRoles = new Set(['super_admin', 'registration_admin', 'content_admin'])
  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowedRoles.has(role) || password.length < 12 || password.length > 200) {
    throw new Error('Input is invalid. Check the name, email, role, and password length.')
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new Error('An account already exists for that email.')

  const id = randomUUID()
  const create = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, 1)')
      .run(id, email, hashPassword(password), role)
    db.prepare('INSERT INTO profiles (user_id, full_name) VALUES (?, ?)').run(id, fullName)
    writeAudit({ actorType: 'bootstrap', action: 'admin.bootstrap_created', targetType: 'user', targetId: id })
  })
  create()
  console.log(`Administrator created for ${email} with role ${role}. No password was displayed.`)
} catch (error) {
  console.error(`Administrator setup failed: ${error.message}`)
  process.exitCode = 1
} finally {
  db.close()
  process.stdin.pause()
}
