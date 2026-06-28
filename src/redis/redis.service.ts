import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, RedisClientType } from 'redis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client!: RedisClientType

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.getOrThrow<string>('REDIS_HOST')
    const port = this.configService.getOrThrow<string>('REDIS_PORT')
    const password = this.configService.get<string>('REDIS_PASSWORD')

    this.client = createClient({
      url: `redis://${host}:${port}`,
      password: password || undefined
    })

    this.client.on('connect', () => {
      this.logger.log('Redis connected')
    })

    this.client.on('error', err => {
      this.logger.error('Redis error', err)
    })

    await this.client.connect()
  }

  getClient(): RedisClientType {
    return this.client
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key)
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value)

    if (ttlSeconds) {
      await this.client.set(key, data, {
        EX: ttlSeconds
      })
    } else {
      await this.client.set(key, data)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async onModuleDestroy() {
    await this.client.quit()
  }
}
