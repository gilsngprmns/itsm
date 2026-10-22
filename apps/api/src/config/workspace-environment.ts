import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function resolveWorkspaceEnvironmentFile(
  startDirectory: string,
): string {
  let directory = resolve(startDirectory)

  while (true) {
    if (existsSync(resolve(directory, 'pnpm-workspace.yaml'))) {
      return resolve(directory, '.env')
    }

    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error('Unable to locate the pnpm workspace root')
    }
    directory = parent
  }
}
