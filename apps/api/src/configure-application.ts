import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SafeExceptionFilter } from './common/filters/safe-exception.filter'
import { requestIdMiddleware } from './common/request-id'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

export function configureApplication(
  app: INestApplication,
  config: ConfigService,
): void {
  app.setGlobalPrefix('api/v1')
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(','),
    credentials: true,
  })
  app.use(requestIdMiddleware)
  app.use(cookieParser())
  app.use(helmet())
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new SafeExceptionFilter())
}
