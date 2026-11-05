import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { configureApplication } from './configure-application'
import { isVercelRuntime } from './config/workspace-environment'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  configureApplication(app, config)

  const port = config.getOrThrow<number>('PORT')
  if (isVercelRuntime()) {
    await app.listen(port)
  } else {
    await app.listen(port, '0.0.0.0')
  }
}

void bootstrap()
