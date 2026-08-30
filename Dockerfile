# NestJS API — прод-образ.
#
# База — debian-slim (bookworm), НЕ alpine. Причина: на сервере крутится
# @huggingface/transformers (ONNX Runtime — локальная модель эмбеддингов
# для семантического поиска категорий, см.
# src/libs/embeddings/embeddings.service.ts) — под musl (alpine) у ONNX
# Runtime исторически нестабильно: либо не собирается, либо падает
# рантайм-ошибками, которые тяжело диагностировать. Debian-slim немного
# тяжелее по размеру образа, но экономит именно тот вечер, когда деплой
# "просто не взлетает" без понятной причины.
#
# Один стейдж на сборку+рантайм (а не отдельный "тонкий" рантайм с
# --omit=dev) — специально: `prisma migrate deploy` тоже гоняем через этот
# же образ (см. DEPLOY.md), а CLI `prisma` лежит в devDependencies. Отдельно
# городить третий стейдж только ради экономии полутора сотен МБ в день
# деплоя смысла не было — простота и предсказуемость важнее.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Отдельным слоем — кэшируется, пока package*.json не меняются
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Российский корневой сертификат — нужен, чтобы Node доверял TLS у
# GigaChat/ЮKassa/DaData и т.п. (у них цепочка через Минцифры/ГОСТ, её нет
# в стандартном системном сторе). Без этой переменной такие интеграции
# упадут по TLS уже на проде, хотя локально всё работало — этот момент
# легко упустить при первом деплое.
ENV NODE_EXTRA_CA_CERTS=/app/certs/russian_trusted_root_ca.pem

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# prisma migrate deploy читает datasource.url из этого файла (см.
# комментарий выше и prisma.config.ts) — без него Prisma не находит
# строку подключения к базе и падает с 'datasource url is required',
# хотя переменная окружения POSTGRES_URI при этом реально задана.
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/certs ./certs

# Кэш ONNX-модели эмбеддингов (env.cacheDir в embeddings.service.ts =
# process.cwd()/.cache/transformers) — монтируется как volume в
# docker-compose.prod.yml, чтобы модель (несколько сотен МБ, тянется с
# HuggingFace Hub) скачивалась один раз, а не при каждом передеплое.
RUN mkdir -p /app/.cache/transformers

EXPOSE 4000
CMD ["node", "dist/main"]
