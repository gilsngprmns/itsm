import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'
import { validateEnvironment } from '../config/validate-environment'
import {
  resolveWorkspaceEnvironmentFile,
  shouldLoadWorkspaceEnvironmentFile,
} from '../config/workspace-environment'
import { createDatabaseOptions } from './database-options'

const environmentFile = shouldLoadWorkspaceEnvironmentFile()
  ? resolveWorkspaceEnvironmentFile(__dirname)
  : undefined
if (environmentFile) {
  loadEnv({ path: environmentFile })
}

const environment = validateEnvironment(process.env)
const databaseUrl = environment.DATABASE_URL

if (typeof databaseUrl !== 'string') {
  throw new Error('DATABASE_URL must be configured')
}

export default new DataSource(createDatabaseOptions(databaseUrl, 30_000))
