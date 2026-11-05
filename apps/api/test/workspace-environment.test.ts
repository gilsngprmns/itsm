import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isVercelRuntime,
  resolveWorkspaceEnvironmentFile,
  shouldLoadWorkspaceEnvironmentFile,
} from '../src/config/workspace-environment'

describe('workspace environment file resolution', () => {
  it.each(['apps/api/src', 'apps/api/dist/src', 'apps/api/dist/database'])(
    'resolves the repository .env from %s',
    (relativeDirectory) => {
      expect(
        resolveWorkspaceEnvironmentFile(
          resolve(process.cwd(), relativeDirectory),
        ),
      ).toBe(resolve(process.cwd(), '../../.env'))
    },
  )

  it('returns no environment file when the workspace marker is absent', () => {
    const directory = mkdtempSync(join(tmpdir(), 'itsm-vercel-runtime-'))
    try {
      expect(resolveWorkspaceEnvironmentFile(directory)).toBeUndefined()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('identifies Vercel runtime and preview environments', () => {
    expect(isVercelRuntime({ VERCEL: '1' })).toBe(true)
    expect(isVercelRuntime({ VERCEL_ENV: 'preview' })).toBe(true)
    expect(isVercelRuntime({ NODE_ENV: 'production' })).toBe(false)
    expect(isVercelRuntime({ NODE_ENV: 'development' })).toBe(false)
  })

  it('loads the workspace env file only for local non-production runs', () => {
    expect(
      shouldLoadWorkspaceEnvironmentFile({ NODE_ENV: 'development' }),
    ).toBe(true)
    expect(shouldLoadWorkspaceEnvironmentFile({ NODE_ENV: 'production' })).toBe(
      false,
    )
    expect(
      shouldLoadWorkspaceEnvironmentFile({
        NODE_ENV: 'development',
        VERCEL: '1',
      }),
    ).toBe(false)
  })
})
