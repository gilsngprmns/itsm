import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { getRequestId } from '../request-id'

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      response.status(status).json(exception.getResponse())
      return
    }

    const errorCode = getErrorCode(exception)
    this.logger.error(
      `Unhandled request error (code: ${errorCode}, requestId: ${getRequestId(request) ?? 'unknown'}, method: ${request.method}, path: ${request.path})`,
    )
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    })
  }
}

function getErrorCode(exception: unknown): string {
  if (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    typeof exception.code === 'string'
  ) {
    return exception.code
  }
  return 'unknown'
}
