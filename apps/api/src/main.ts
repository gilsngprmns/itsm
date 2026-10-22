import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { SafeExceptionFilter } from './common/filters/safe-exception.filter'
import { requestIdMiddleware } from './common/request-id'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

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

  await app.listen(config.getOrThrow<number>('PORT'), '127.0.0.1')
}

void bootstrap()
