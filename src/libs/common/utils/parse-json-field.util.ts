// Поле `features` объявления приходит строкой при multipart/form-data
// (файлы + JSON вперемешку), поэтому его нужно распарсить вручную через
// @Transform. Раньше это делалось голым JSON.parse(value) — если клиент
// (или кто угодно, кто дёрнет API напрямую) присылал невалидный JSON,
// JSON.parse кидал необработанное исключение, и запрос падал с
// технической 500 ошибкой вместо понятной ошибки валидации.
//
// Здесь при невалидном JSON строка возвращается как есть — тогда её
// "поймает" следующий валидатор (@IsObject) и вернёт обычную,
// человекочитаемую 400-ошибку валидации.
export function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
