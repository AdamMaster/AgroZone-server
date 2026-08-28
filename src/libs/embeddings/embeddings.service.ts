import { join } from 'node:path'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { env, pipeline } from '@huggingface/transformers'

// Мультиязычная модель под семантический поиск категорий, понимает русский
// из коробки, обучена без разметки конкретно под наш проект. Крутится прямо
// на нашем сервере через ONNX (пакет @huggingface/transformers) — никуда
// наружу не стучится, поэтому бесплатно и не зависит от блокировок внешних
// AI-провайдеров в России (отказались от GigaChat/Яндекса именно из-за
// этого).
//
// Версия -small (384 измерения) на практике не знала, что "Туи" — это
// растение, и путала с не связанными категориями (см. обсуждение с
// пользователем — тест на "Туи" вернул "Мука нутовая" и "Тара и упаковка").
// -base (768 измерений) заметно больше и умнее по "знаниям о мире" ценой
// более высокой нагрузки на CPU/RAM — берём её как следующую попытку перед
// тем как вручную дописывать синонимы в description категорий (ручной путь
// не масштабируется — категорий с узкой лексикой в агропроме много).
//
// У e5-моделей асимметричная схема "запрос/документ", как мы изначально
// хотели сделать через отдельные doc/query-модели у Яндекса — только тут
// это не отдельные модели, а текстовый префикс перед одной и той же
// моделью: "passage: " для того, что индексируем (категории), "query: "
// для того, что ищем (ввод пользователя). См. getCategoryEmbedding(s) /
// getQueryEmbedding ниже — перепутать префиксы легко и результат от этого
// заметно хуже, так что не убирать.
const MODEL_NAME = 'Xenova/multilingual-e5-base'

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name)
  // Тип пайплайна не выносим отдельно — держим any: библиотека сама не
  // экспортирует стабильное имя типа под конкретно feature-extraction
  // пайплайн, а гадать и на ходу подгонять сигнатуру смысла нет.
  private extractor: any = null
  private loadingPromise: Promise<any> | null = null

  async onModuleInit() {
    // Прогреваем модель сразу при старте сервера — иначе первый же поиск
    // категории после деплоя/рестарта будет ждать несколько секунд, пока
    // модель скачается (при самом первом запуске) или загрузится в память
    // из уже скачанного кэша на диске.
    await this.getExtractor()

    this.logger.log(`Модель эмбеддингов (${MODEL_NAME}) загружена и готова`)
  }

  /** Эмбеддинги категорий — для precompute-скрипта, можно сразу пачкой. */
  async getCategoryEmbeddings(texts: string[]): Promise<number[][]> {
    return this.embed(texts.map(text => `passage: ${text}`))
  }

  async getCategoryEmbedding(text: string): Promise<number[]> {
    const [vector] = await this.getCategoryEmbeddings([text])

    return vector
  }

  /** Эмбеддинг поискового запроса пользователя — для живого поиска. */
  async getQueryEmbedding(text: string): Promise<number[]> {
    const [vector] = await this.embed([`query: ${text}`])

    return vector
  }

  private async embed(prefixedTexts: string[]): Promise<number[][]> {
    if (prefixedTexts.length === 0) return []

    const extractor = await this.getExtractor()

    const output = await extractor(prefixedTexts, { pooling: 'mean', normalize: true })

    return output.tolist() as number[][]
  }

  private async getExtractor(): Promise<any> {
    if (this.extractor) return this.extractor

    if (!this.loadingPromise) {
      // Сама модель (сотня мегабайт) качается и кэшируется на диск при
      // самом первом запуске, дальше уже переиспользуется из кэша — не с
      // нуля при каждом рестарте сервера. Кэш держим в проекте, а не внутри
      // node_modules, чтобы не потерять его при переустановке зависимостей
      // (см. .gitignore — сам кэш в git не кладём, слишком тяжёлый).
      env.cacheDir = join(process.cwd(), '.cache', 'transformers')

      // Модель качается напрямую с Hugging Face, а доступ к нему из России
      // нестабильный (см. обсуждение с пользователем) — логируем прогресс,
      // чтобы по консоли было видно "качается, столько-то %", а не гадать,
      // завис процесс или просто медленно тянет.
      this.loadingPromise = pipeline('feature-extraction', MODEL_NAME, {
        progress_callback: (progress: any) => {
          if (progress?.status === 'progress') {
            const percent = Math.round(progress.progress ?? 0)

            this.logger.log(`Скачивание модели эмбеддингов: ${progress.file} — ${percent}%`)
          } else if (progress?.status === 'done') {
            this.logger.log(`Файл модели готов: ${progress.file}`)
          }
        }
      })
    }

    this.extractor = await this.loadingPromise

    return this.extractor
  }
}
