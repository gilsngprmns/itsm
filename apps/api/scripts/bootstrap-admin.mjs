import argon2 from 'argon2'
import { config } from 'dotenv'
import pg from 'pg'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const envResult = config({
  path: resolve(scriptDirectory, '../../../.env'),
})

if (envResult.error || !process.env.DATABASE_URL) {
  console.error('Unable to load DATABASE_URL from the repository root .env.')
  process.exit(1)
}

const databaseUrl = new URL(process.env.DATABASE_URL)
if (decodeURIComponent(databaseUrl.pathname.slice(1)) !== 'it_db') {
  console.error(
    'Admin bootstrap is restricted to the configured it_db database.',
  )
  process.exit(1)
}

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
  console.error('Run this command from an interactive terminal.')
  process.exit(1)
}

function promptLine(label) {
  return new Promise((resolvePrompt) => {
    process.stdout.write(label)
    let value = ''
    const onData = (chunk) => {
      const input = chunk.toString('utf8')
      if (input === '\u0003') {
        process.stdin.off('data', onData)
        process.stdout.write('\n')
        resolvePrompt(null)
        return
      }
      if (input === '\r' || input === '\n') {
        process.stdin.off('data', onData)
        process.stdout.write('\n')
        resolvePrompt(value)
        return
      }
      if (input === '\u007f' || input === '\b') {
        value = value.slice(0, -1)
        return
      }
      if (isPrintable(input)) value += input
    }
    process.stdin.on('data', onData)
    process.stdin.resume()
  })
}

function promptHidden(label) {
  return new Promise((resolvePrompt) => {
    process.stdout.write(label)
    let value = ''
    const onData = (chunk) => {
      const input = chunk.toString('utf8')
      if (input === '\u0003') {
        process.stdin.off('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolvePrompt(null)
        return
      }
      if (input === '\r' || input === '\n') {
        process.stdin.off('data', onData)
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdout.write('\n')
        resolvePrompt(value)
        return
      }
      if (input === '\u007f' || input === '\b') {
        value = value.slice(0, -1)
        return
      }
      if (isPrintable(input)) value += input
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function isPrintable(input) {
  for (const character of input) {
    const code = character.charCodeAt(0)
    if (code < 32 || code === 127) return false
  }
  return true
}

const fullName = (await promptLine('Admin full name: '))?.trim()
const email = (await promptLine('Admin email: '))?.trim().toLowerCase()
const password = await promptHidden('Password (min 12 characters): ')
const confirmation = await promptHidden('Confirm password: ')

if (!fullName || fullName.length > 200 || !email || email.length > 254) {
  console.error('A valid full name and email are required.')
  process.exit(1)
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Enter a valid email address.')
  process.exit(1)
}
if (!password || password.length < 12 || password.length > 128) {
  console.error('Password must be between 12 and 128 characters.')
  process.exit(1)
}
if (password !== confirmation) {
  console.error('Passwords do not match.')
  process.exit(1)
}

const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
})
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 1,
})

try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(71034003, 1)')

    const existingAdmin = await client.query(
      `SELECT 1
       FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       JOIN public.users u ON u.id = ur.user_id
       WHERE r.code = 'ADMIN'
         AND u.is_active = true
         AND u.deleted_at IS NULL
       LIMIT 1`,
    )
    if (existingAdmin.rowCount) {
      throw new Error('An active administrator already exists.')
    }

    const duplicate = await client.query(
      `SELECT 1 FROM public.users
       WHERE lower(email) = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    )
    if (duplicate.rowCount) {
      throw new Error('An account with this email already exists.')
    }

    const role = await client.query(
      `SELECT id FROM public.roles WHERE code = 'ADMIN' LIMIT 1`,
    )
    if (!role.rowCount) {
      throw new Error(
        'The existing ADMIN role was not found; no account was created.',
      )
    }

    const inserted = await client.query(
      `INSERT INTO public.users (full_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [fullName, email, passwordHash],
    )
    const userId = inserted.rows[0].id

    await client.query(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [userId, role.rows[0].id],
    )
    await client.query(
      `INSERT INTO public.audit_logs
         (actor_id, action, entity_type, entity_id)
       VALUES ($1, 'auth.admin_bootstrap', 'auth', $1)`,
      [userId],
    )
    await client.query('COMMIT')
    console.log('Initial administrator created successfully.')
  } catch (error) {
    await client.query('ROLLBACK')
    if (
      error instanceof Error &&
      (error.message.startsWith('An active') ||
        error.message.startsWith('An account') ||
        error.message.startsWith('The existing'))
    ) {
      console.error(error.message)
    } else {
      console.error('Admin bootstrap failed; no account was committed.')
    }
    process.exitCode = 1
  } finally {
    client.release()
  }
} catch (error) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'unknown'
  console.error(`Unable to connect to the configured database (code: ${code}).`)
  process.exitCode = 1
} finally {
  await pool.end()
}
