import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { getRequestId, requestIdMiddleware } from '../src/common/request-id'

function runMiddleware(header?: string) {
  const request = {
    headers: header === undefined ? {} : { 'x-request-id': header },
  } as Request & { requestId?: string }
  const setHeader = vi.fn()
  const next = vi.fn() as NextFunction

  requestIdMiddleware(request, { setHeader } as unknown as Response, next)

  return { request, setHeader, next }
}

describe('request ID middleware', () => {
  it('preserves a safe client request ID and returns it in the response', () => {
    const { request, setHeader, next } = runMiddleware('request-123')

    expect(request.requestId).toBe('request-123')
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'request-123')
    expect(getRequestId(request)).toBe('request-123')
    expect(next).toHaveBeenCalledOnce()
  })

  it('replaces invalid request IDs with a generated UUID', () => {
    const { request, setHeader } = runMiddleware('forged\r\nheader')

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', request.requestId)
    expect(getRequestId(request)).toBe(request.requestId)
  })
})
