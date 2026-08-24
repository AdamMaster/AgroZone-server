import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@/generated/prisma/client'

import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg(
      new Pool({
        connectionString: process.env.POSTGRES_URI
      })
    )

    // Логирование каждого SQL-запроса (log: 'query') отключено и в деве, и
    // в проде — оно засоряет консоль и добавляет лишнюю нагрузку без
    // практической пользы в повседневной разработке. Если понадобится
    // подебажить конкретный запрос, 'query' можно включить точечно здесь.
    super({ adapter, log: ['warn', 'error'] })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
