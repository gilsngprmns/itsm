import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
type RequestWithId = Request & { requestId?: string }

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestWithId = request as RequestWithId
  const requestId = getRequestId(requestWithId) ?? randomUUID()
  requestWithId.requestId = requestId
  response.setHeader('X-Request-Id', requestId)
  next()
}

export function getRequestId(request: Request): string | null {
  const requestWithId = request as RequestWithId
  const value = requestWithId.requestId ?? request.headers['x-request-id']
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value)
    ? value
    : null
}
