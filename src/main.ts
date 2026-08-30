import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import cookieParser from 'cookie-parser'
import { ValidationPipe } from '@nestjs/common'
import { ms, StringValue } from './libs/common/utils/ms.util'
import { parseBoolean } from './libs/common/utils/parse-boolean.util'
import { assertSecureSessionConfig } from './libs/common/utils/assert-secure-session-config.util'
import IORedis from 'ioredis'
import session from 'express-session'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'
import compression from 'compression'
;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  const config = app.get(ConfigService)

  assertSecureSessionConfig(config)

  const redisClient = createClient({ url: config.getOrThrow('REDIS_URI') })
  await redisClient.connect()

  redisClient.on('connect', () => console.log('✅ Redis connected'))
  redisClient.on('error', err => console.error('❌ Redis error:', err))

  app.use(compression())

  app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')))

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  )

  app.use(
    session({
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      name: config.getOrThrow<string>('SESSION_NAME'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        domain: config.getOrThrow<string>('SESSION_DOMAIN'),
        maxAge: ms(config.getOrThrow<StringValue>('SESSION_MAX_AGE')),
        httpOnly: parseBoolean(config.getOrThrow<string>('SESSION_HTTP_ONLY')),
        secure: parseBoolean(config.getOrThrow<string>('SESSION_SECURE')),
        sameSite: 'lax'
      },
      store: new RedisStore({
        client: redisClient,
        prefix: config.getOrThrow<string>('SESSION_FOLDER')
        // disableTouch: false,
        // disableTTL: false
      })
    })
  )

  app.enableCors({
    origin: config.getOrThrow<string>('ALLOWED_ORIGIN'),
    credentials: true,
    exposedHeaders: ['set-cookie']
  })

  app.enableShutdownHooks()

  await app.listen(config.getOrThrow<number>('APPLICATION_PORT'))
}
void bootstrap()
