import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configureApplication } from './configure-application'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  configureApplication(app, config)

  await app.listen(config.getOrThrow<number>('PORT'), '127.0.0.1')
}

void bootstrap()
