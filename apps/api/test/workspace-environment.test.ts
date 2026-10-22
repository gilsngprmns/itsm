import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveWorkspaceEnvironmentFile } from '../src/config/workspace-environment'

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
})
