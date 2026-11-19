import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function isPortAvailable(port) {
  return new Promise(resolve => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}

let webPort = Number(process.env.VITE_PORT || 5173)
while (webPort < 5200 && !(await isPortAvailable(webPort))) webPort += 1
if (webPort >= 5200) throw new Error('No available local Vite port found between 5173 and 5199.')

const configuredOrigins = process.env.LOCAL_APP_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean) || []
const webOrigins = [`http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`]
const env = {
  ...process.env,
  VITE_PORT: String(webPort),
  LOCAL_APP_ORIGINS: [...new Set([...configuredOrigins, ...webOrigins])].join(','),
}
const children = [
  spawn(process.execPath, ['server/index.js'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', String(webPort)], { cwd: root, env, stdio: 'inherit' }),
]
let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  const active = children.filter(child => child.exitCode === null && child.signalCode === null)
  for (const child of active) child.kill()
  if (!active.length) return process.exit(code)
  const timeout = setTimeout(() => process.exit(code || 1), 3000)
  Promise.all(active.map(child => new Promise(resolve => child.once('exit', resolve))))
    .then(() => { clearTimeout(timeout); process.exit(code) })
}

for (const child of children) {
  child.on('error', error => {
    console.error('Local development process failed to start:', error.message)
    stopAll(1)
  })
  child.on('exit', code => {
    if (!stopping && code !== 0) stopAll(code || 1)
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
