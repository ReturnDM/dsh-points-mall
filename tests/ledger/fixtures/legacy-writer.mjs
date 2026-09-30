/** Historical CLI writer protocol fixture: sync lock, token owner, tmp/rename append. */
import { openSync, closeSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'

const [dataDir, title] = process.argv.slice(2)
const lockPath = join(dataDir, '.ledger.lock')
const owner = { pid: process.pid, host: hostname(), token: randomUUID() }
const deadline = Date.now() + 5000
while (true) {
  try {
    const descriptor = openSync(lockPath, 'wx')
    try { writeFileSync(descriptor, JSON.stringify(owner), 'utf8') }
    finally { closeSync(descriptor) }
    break
  } catch (error) {
    if (error.code !== 'EEXIST' || Date.now() > deadline) throw error
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
  }
}
try {
  const time = new Date().toISOString()
  const entry = { id: randomUUID(), time, type: 'earn', title, points: 5, exp: 5 }
  const folder = join(dataDir, 'ledger', time.slice(0, 7))
  mkdirSync(folder, { recursive: true })
  const path = join(folder, `${entry.id}.json`)
  writeFileSync(`${path}.tmp`, JSON.stringify(entry) + '\n', 'utf8')
  renameSync(`${path}.tmp`, path)
} finally {
  if (JSON.parse(readFileSync(lockPath, 'utf8')).token === owner.token) unlinkSync(lockPath)
}
