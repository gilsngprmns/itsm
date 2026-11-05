import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function resolveWorkspaceEnvironmentFile(
  startDirectory: string,
): string | undefined {
  let directory = resolve(startDirectory)

  while (true) {
    if (existsSync(resolve(directory, 'pnpm-workspace.yaml'))) {
      return resolve(directory, '.env')
    }

    const parent = dirname(directory)
    if (parent === directory) {
      return undefined
    }
    directory = parent
  }
}

export function isVercelRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.VERCEL === '1' || environment.VERCEL_ENV !== undefined
}

export function shouldLoadWorkspaceEnvironmentFile(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.NODE_ENV !== 'production' && !isVercelRuntime(environment)
}
