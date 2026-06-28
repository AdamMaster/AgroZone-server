import { Injectable } from '@nestjs/common'
import { RedisService } from '@/redis/redis.service'

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  }

  async set<T>(key: string, value: T, ttl: number, tags: string[] = []) {
    const data = JSON.stringify(value)

    await this.redis.set(key, data, ttl)

    for (const tag of tags) {
      await this.redis.getClient().sAdd(`cache:tag:${tag}`, key)
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    const tagKey = `cache:tag:${tag}`

    const keys = await this.redis.getClient().sMembers(tagKey)

    if (keys.length > 0) {
      await this.redis.getClient().del(keys)
    }

    await this.redis.getClient().del(tagKey)
  }
}
