import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Agent, fetch as undiciFetch } from 'undici'

interface GigaChatTokenResponse {
  access_token: string
  expires_at?: number
}

interface GigaChatEmbeddingsResponse {
  object: string
  model: string
  data: { object: string; embedding: number[]; index: number }[]
}

interface GigaChatCompletionsResponse {
  choices: { message: { role: string; content: string } }[]
}

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const EMBEDDINGS_URL = 'https://api.giga.chat/v1/embeddings'
const COMPLETIONS_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions'

// Базовая модель "GigaChat" — она в бесплатном тарифе для физлиц (в отличие
// от Embeddings, см. обсуждение с пользователем), нам для генерации коротких
// обогащённых описаний категорий больше и не нужно.
const COMPLETIONS_MODEL = 'GigaChat'

// Токен по докам живёт 30 минут — обновляем немного заранее (за 5 минут до
// протухания), чтобы не словить 401 из-за сетевой задержки между проверкой
// кэша и самим запросом. Точный формат поля expires_at в ответе (абсолютное
// unix-время в мс или что-то ещё) в открытой документации не расписан —
// вместо того чтобы гадать и парсить его, держим свой собственный таймер на
// заведомо безопасные 25 минут. Само поле всё равно логируем при первом
// реальном запросе — если окажется, что токен живёт дольше/короче, поправим.
const ASSUMED_TOKEN_LIFETIME_MS = 25 * 60 * 1000

@Injectable()
export class GigaChatService {
  private readonly logger = new Logger(GigaChatService.name)
  private readonly agent: Agent
  private cachedToken: { accessToken: string; expiresAt: number } | null = null
  private tokenRefreshPromise: Promise<string> | null = null

  constructor(private readonly configService: ConfigService) {
    // У GigaChat сертификаты выпущены НУЦ Минцифры — обычные системные
    // доверенные CA их не знают, и без явного указания этого корневого
    // сертификата запросы к *.sberbank.ru/*.giga.chat падают с
    // "self-signed certificate in certificate chain" (см. обсуждение с
    // пользователем и https://developers.sber.ru/docs/ru/gigachat/certificates).
    // NODE_EXTRA_CA_CERTS тут не годится — Node читает эту переменную только
    // в момент самого старта процесса, а .env у нас грузится уже внутри
    // приложения через ConfigModule, то есть было бы поздно. Поэтому
    // сертификат подключаем явно через undici Agent на каждый запрос к
    // GigaChat, а не полагаемся на переменные окружения запуска.
    const caCertPath = join(process.cwd(), 'certs', 'russian_trusted_root_ca.pem')

    this.agent = new Agent({
      connect: { ca: readFileSync(caCertPath) }
    })
  }

  /**
   * Эмбеддинги для списка текстов, одним запросом (используется в
   * precompute-скрипте — дешевле по токенам и по времени, чем дёргать
   * GigaChat по одному тексту за раз).
   */
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const accessToken = await this.getAccessToken()

    let response: Awaited<ReturnType<typeof undiciFetch>>

    try {
      response = await undiciFetch(EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ model: 'Embeddings', input: texts }),
        dispatcher: this.agent
      })
    } catch (error) {
      this.logger.error('GigaChat Embeddings недоступен', error as Error)

      throw new InternalServerErrorException('Не удалось получить эмбеддинг от GigaChat. Попробуйте чуть позже.')
    }

    const data = (await response.json().catch(() => null)) as GigaChatEmbeddingsResponse | null

    if (!response.ok || !data?.data?.length) {
      this.logger.error(`GigaChat Embeddings вернул ошибку: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException('GigaChat вернул ошибку при получении эмбеддинга')
    }

    // На всякий случай сортируем по index — вдруг порядок в ответе когда-то
    // перестанет совпадать с порядком input.
    return [...data.data].sort((a, b) => a.index - b.index).map(item => item.embedding)
  }

  async getEmbedding(text: string): Promise<number[]> {
    const [vector] = await this.getEmbeddings([text])

    return vector
  }

  /**
   * Генерация текста через GigaChat (не эмбеддинги — обычный чат-комплишн,
   * бесплатный для физлиц). Используется в enrich-category-descriptions —
   * скрипт разово просит GigaChat перечислить обиходные названия/сорта/виды
   * для каждой категории, чтобы не набирать их руками (см. обсуждение с
   * пользователем: "Да какие нахуй синонимы? Ты будешь вручную писать..." —
   * так вот, не мы, а GigaChat).
   */
  async generateText(prompt: string): Promise<string> {
    const accessToken = await this.getAccessToken()

    let response: Awaited<ReturnType<typeof undiciFetch>>

    try {
      response = await undiciFetch(COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          model: COMPLETIONS_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        }),
        dispatcher: this.agent
      })
    } catch (error) {
      this.logger.error('GigaChat Completions недоступен', error as Error)

      throw new InternalServerErrorException('Не удалось получить ответ от GigaChat. Попробуйте чуть позже.')
    }

    const data = (await response.json().catch(() => null)) as GigaChatCompletionsResponse | null

    const content = data?.choices?.[0]?.message?.content

    if (!response.ok || !content) {
      this.logger.error(`GigaChat Completions вернул ошибку: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException('GigaChat вернул ошибку при генерации текста')
    }

    return content.trim()
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken
    }

    // Если несколько запросов одновременно обнаружат протухший кэш — не
    // долбим GigaChat параллельными запросами токена, а ждём один общий.
    if (!this.tokenRefreshPromise) {
      this.tokenRefreshPromise = this.requestNewToken().finally(() => {
        this.tokenRefreshPromise = null
      })
    }

    return this.tokenRefreshPromise
  }

  private async requestNewToken(): Promise<string> {
    const authKey = this.configService.getOrThrow<string>('GIGACHAT_AUTH_KEY')
    const scope = this.configService.getOrThrow<string>('GIGACHAT_SCOPE')

    let response: Awaited<ReturnType<typeof undiciFetch>>

    try {
      response = await undiciFetch(OAUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${authKey}`,
          RqUID: randomUUID()
        },
        body: new URLSearchParams({ scope }),
        dispatcher: this.agent
      })
    } catch (error) {
      this.logger.error('GigaChat OAuth недоступен', error as Error)

      throw new InternalServerErrorException('Не удалось получить токен доступа GigaChat')
    }

    const data = (await response.json().catch(() => null)) as GigaChatTokenResponse | null

    if (!response.ok || !data?.access_token) {
      this.logger.error(`GigaChat OAuth не удался: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException('Не удалось авторизоваться в GigaChat')
    }

    this.logger.debug(`GigaChat OAuth: получен новый токен, expires_at из ответа = ${data.expires_at}`)

    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + ASSUMED_TOKEN_LIFETIME_MS
    }

    return data.access_token
  }
}
