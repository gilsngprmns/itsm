type Environment = Record<string, unknown>

export interface ValidatedEnvironment extends Environment {
  NODE_ENV: string
  PORT: number
  DATABASE_URL: string
  CORS_ORIGINS: string
  PUBLIC_WEB_URL?: string
  SESSION_COOKIE_NAME: string
  AUTH_SESSION_TTL_MINUTES: number
}

export function validateEnvironment(
  environment: Environment,
): ValidatedEnvironment {
  const nodeEnv = readString(environment, 'NODE_ENV')
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  const rawPort = readString(environment, 'PORT', '3000')
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const sessionCookieName = readString(
    environment,
    'SESSION_COOKIE_NAME',
    'itsm_session',
  )
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionCookieName)) {
    throw new Error('SESSION_COOKIE_NAME contains invalid characters')
  }

  const rawSessionTtl = readString(
    environment,
    'AUTH_SESSION_TTL_MINUTES',
    '480',
  )
  const sessionTtl = Number(rawSessionTtl)
  if (!Number.isInteger(sessionTtl) || sessionTtl < 5 || sessionTtl > 1440) {
    throw new Error(
      'AUTH_SESSION_TTL_MINUTES must be an integer between 5 and 1440',
    )
  }

  const databaseUrl = readString(environment, 'DATABASE_URL')
  let parsedDatabaseUrl: URL
  try {
    parsedDatabaseUrl = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL')
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol) ||
    !parsedDatabaseUrl.hostname
  ) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL')
  }
  try {
    decodeURIComponent(parsedDatabaseUrl.username)
    decodeURIComponent(parsedDatabaseUrl.password)
    decodeURIComponent(parsedDatabaseUrl.pathname.slice(1))
  } catch {
    throw new Error('DATABASE_URL must use valid URL encoding')
  }
  if (!parsedDatabaseUrl.pathname || parsedDatabaseUrl.pathname === '/') {
    throw new Error('DATABASE_URL must include a database name')
  }
  if (parsedDatabaseUrl.hash) {
    throw new Error('DATABASE_URL must not include a URL fragment')
  }

  const origins = readString(
    environment,
    'CORS_ORIGINS',
    nodeEnv === 'production' ? undefined : 'http://localhost:5173',
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))

  if (
    origins.length === 0 ||
    origins.some((origin) => !isAllowedOrigin(origin))
  ) {
    throw new Error('CORS_ORIGINS must contain explicit HTTP or HTTPS origins')
  }
  if (
    nodeEnv === 'production' &&
    origins.some((origin) => new URL(origin).protocol !== 'https:')
  ) {
    throw new Error('CORS_ORIGINS must use HTTPS in production')
  }

  const publicWebUrl = readOptionalString(environment, 'PUBLIC_WEB_URL')
  if (publicWebUrl && !isAllowedOrigin(publicWebUrl)) {
    throw new Error('PUBLIC_WEB_URL must be an explicit HTTP or HTTPS origin')
  }
  if (
    publicWebUrl &&
    nodeEnv === 'production' &&
    !publicWebUrl.startsWith('https://')
  ) {
    throw new Error('PUBLIC_WEB_URL must use HTTPS in production')
  }

  return {
    ...environment,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: origins.join(','),
    ...(publicWebUrl ? { PUBLIC_WEB_URL: publicWebUrl } : {}),
    SESSION_COOKIE_NAME: sessionCookieName,
    AUTH_SESSION_TTL_MINUTES: sessionTtl,
  }
}

function readOptionalString(
  environment: Environment,
  key: string,
): string | undefined {
  const value = environment[key]
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().replace(/\/$/, '')
    : undefined
}

function readString(
  environment: Environment,
  key: string,
  defaultValue?: string,
): string {
  const value = environment[key]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  throw new Error(`${key} is required`)
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin || origin === '*') {
    return false
  }

  try {
    const parsedOrigin = new URL(origin)
    return (
      ['http:', 'https:'].includes(parsedOrigin.protocol) &&
      !parsedOrigin.username &&
      !parsedOrigin.password &&
      parsedOrigin.origin === origin.replace(/\/$/, '')
    )
  } catch {
    return false
  }
}
