import { describe, expect, it } from 'vitest'
import { validateEnvironment } from '../src/config/validate-environment'

const validEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:replace-me@127.0.0.1:5432/it_db',
}

describe('validateEnvironment', () => {
  it('applies development defaults when NODE_ENV is explicit', () => {
    expect(
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'development' }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: 'http://localhost:5173',
    })
  })

  it('requires NODE_ENV rather than silently defaulting to development', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: undefined,
        DATABASE_URL: 'postgres://localhost/it_db',
      }),
    ).toThrow('NODE_ENV is required')
  })

  it('rejects wildcard CORS origins', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS must contain explicit HTTP or HTTPS origins')
  })

  it('requires explicit HTTPS origins in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow('CORS_ORIGINS is required')

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'http://localhost:5173',
      }),
    ).toThrow('CORS_ORIGINS must use HTTPS in production')
  })

  it('accepts explicitly configured HTTPS origins in production', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://itsm.example.com',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://itsm.example.com',
    })
  })

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'https://example.test/db',
      }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL')
  })

  it('accepts a URL-encoded password and preserves the it_db target', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:pa%40ss@127.0.0.1:5432/it_db',
      }).DATABASE_URL,
    ).toBe('postgresql://postgres:pa%40ss@127.0.0.1:5432/it_db')
  })

  it('rejects malformed URL encoding without exposing the connection string', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:secret%2@127.0.0.1:5432/it_db',
      }),
    ).toThrow('DATABASE_URL must use valid URL encoding')
  })

  it('requires an explicit database name', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:secret@127.0.0.1:5432/',
      }),
    ).toThrow('DATABASE_URL must include a database name')
  })
})
