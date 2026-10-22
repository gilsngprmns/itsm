import type { Request } from 'express'
import type { EntityManager } from 'typeorm'
import { getRequestId } from './request-id'

export async function writeAuditLog(
  manager: EntityManager,
  request: Request,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): Promise<void> {
  await manager.query(
    `INSERT INTO public.audit_logs
       (actor_id, action, entity_type, entity_id, old_values, new_values,
        request_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::inet, $9)`,
    [
      actorId,
      action,
      entityType,
      entityId,
      oldValues === null ? null : JSON.stringify(oldValues),
      newValues === null ? null : JSON.stringify(newValues),
      getRequestId(request),
      request.ip || null,
      getUserAgent(request),
    ],
  )
}

export function getPostgresErrorCode(error: unknown): string | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error) ||
    typeof error.driverError !== 'object' ||
    error.driverError === null ||
    !('code' in error.driverError) ||
    typeof error.driverError.code !== 'string'
  ) {
    return null
  }

  return error.driverError.code
}

function getUserAgent(request: Request): string | null {
  const value = request.headers['user-agent']
  return typeof value === 'string' ? value.slice(0, 512) : null
}
