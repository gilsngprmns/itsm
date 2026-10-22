import { ArgumentsHost, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SafeExceptionFilter } from '../src/common/filters/safe-exception.filter'

afterEach(() => vi.restoreAllMocks())

describe('SafeExceptionFilter', () => {
  it('returns a generic response and logs no internal error details', () => {
    const status = vi.fn().mockReturnThis()
    const json = vi.fn()
    const response = { status, json } as unknown as Response
    const request = {
      method: 'GET',
      path: '/api/v1/admin',
      requestId: 'request-123',
      headers: {},
    } as unknown as Request
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    const filter = new SafeExceptionFilter()

    filter.catch(new Error('database password must not leak'), host)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    })
    expect(logger.mock.calls[0][0]).toContain('requestId: request-123')
    expect(JSON.stringify(logger.mock.calls)).not.toContain('database password')
  })
})
