export type CategoryFeatureType = 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'MULTI_SELECT'
export type CategoryStatus = 'active' | 'hidden' | 'archived'

export type CategoryFeatureInput = {
  id: string
  name: string
  label: string
  type: CategoryFeatureType
  options?: string[]
  required?: boolean
  placeholder?: string
  unit?: string
  units?: string[]
  min?: number
  max?: number
  filterable?: boolean
  sortOrder?: number
}

type CategoryFeatureSeed = Omit<CategoryFeatureInput, 'id'> & { id?: string }

export type CategoryInput = {
  /** Стабильный ID. При переносе или переименовании категории задайте его явно в CATEGORY_TREE. */
  id: string
  parentId?: string
  slug: string
  name: string
  aliases?: string[]
  iconId?: string
  sortOrder: number
  status: CategoryStatus
  isSelectable: boolean
  version: number
  redirectToCategoryId?: string
  children?: CategoryInput[]
  categoryFeatures?: CategoryFeatureInput[]
  /**
   * Единицы измерения цены (значения enum Prisma PriceUnit — 'ITEM', 'TON',
   * 'KG', 'LITER', 'M3', 'BAG', 'HEAD', 'DOSE', 'RUNNING_METER', 'HA',
   * 'HOUR'), доступные при создании объявления в этой категории. Если не
   * задано явно в CATEGORY_TREE — подставляется автоматически в
   * materializeCategories() на основе набора categoryFeatures (см.
   * DEFAULT_PRICE_UNITS_BY_FEATURES ниже), с запасным вариантом ['ITEM'].
   */
  priceUnits: string[]
}

type CategorySeed = Omit<
  CategoryInput,
  | 'id'
  | 'parentId'
  | 'slug'
  | 'sortOrder'
  | 'status'
  | 'isSelectable'
  | 'version'
  | 'children'
  | 'categoryFeatures'
  | 'priceUnits'
> & {
  id?: string
  slug?: string
  sortOrder?: number
  status?: CategoryStatus
  isSelectable?: boolean
  version?: number
  children?: CategorySeed[]
  categoryFeatures?: CategoryFeatureSeed[]
  /** Необязательный ручной оверрайд — если не задан, будет выведен автоматически. */
  priceUnits?: string[]
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya'
}

function slugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .split('')
    .map(char => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/** Небольшой детерминированный хэш без внешних зависимостей. */
function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function materializeFeature(feature: CategoryFeatureSeed): CategoryFeatureInput {
  return {
    ...feature,
    id: feature.id ?? `feature_${stableHash(`${feature.name}:${feature.type}:${feature.label}`)}`,
    filterable: feature.filterable ?? true
  }
}

function materializeCategories(
  categories: CategorySeed[],
  parentPath: string[] = [],
  parentId?: string
): CategoryInput[] {
  return categories.map((category, index) => {
    const path = [...parentPath, category.name]
    const id = category.id ?? `cat_${stableHash(path.join(' > '))}`
    const children = category.children?.length ? materializeCategories(category.children, path, id) : []

    return {
      ...category,
      id,
      parentId,
      slug: category.slug ?? slugify(category.name),
      sortOrder: category.sortOrder ?? index,
      status: category.status ?? 'active',
      isSelectable: category.isSelectable ?? children.length === 0,
      version: category.version ?? 1,
      children,
      categoryFeatures: category.categoryFeatures?.map(materializeFeature),
      priceUnits: category.priceUnits ?? inferPriceUnits(category.categoryFeatures)
    }
  })
}

export type CategoryValidationIssue = {
  severity: 'error' | 'warning'
  code:
    | 'DUPLICATE_CATEGORY_NAME'
    | 'DUPLICATE_CATEGORY_SLUG'
    | 'DUPLICATE_CATEGORY_ID'
    | 'EMPTY_SLUG'
    | 'MISSING_FEATURES'
    | 'SELECT_WITHOUT_OPTIONS'
    | 'DUPLICATE_FEATURE_OPTION'
    | 'FEATURE_TYPE_CONFLICT'
    | 'NUMBER_WITHOUT_UNIT'
  path: string
  message: string
}

/** Проверяет дерево при сборке, в тестах или в миграционном скрипте. */
export function validateCategories(categories: CategoryInput[]): CategoryValidationIssue[] {
  const issues: CategoryValidationIssue[] = []
  const categoryIds = new Set<string>()
  const featureTypes = new Map<string, CategoryFeatureType>()

  const walk = (nodes: CategoryInput[], parentPath: string[] = []): void => {
    const names = new Set<string>()
    const slugs = new Set<string>()

    for (const category of nodes) {
      const path = [...parentPath, category.name]
      const pathLabel = path.join(' > ')
      const normalizedName = category.name.trim().toLocaleLowerCase('ru-RU')

      if (names.has(normalizedName)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_CATEGORY_NAME',
          path: pathLabel,
          message: `Повтор категории «${category.name}» внутри одного родителя.`
        })
      }
      names.add(normalizedName)

      if (!category.slug) {
        issues.push({ severity: 'error', code: 'EMPTY_SLUG', path: pathLabel, message: 'Пустой slug категории.' })
      } else if (slugs.has(category.slug)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_CATEGORY_SLUG',
          path: pathLabel,
          message: `Повтор slug «${category.slug}» внутри одного родителя.`
        })
      }
      slugs.add(category.slug)

      if (categoryIds.has(category.id)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_CATEGORY_ID',
          path: pathLabel,
          message: `Повтор ID категории «${category.id}».`
        })
      }
      categoryIds.add(category.id)

      const isLeaf = !category.children?.length
      if (isLeaf && !category.categoryFeatures?.length) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_FEATURES',
          path: pathLabel,
          message: 'У листовой категории отсутствуют характеристики.'
        })
      }

      for (const feature of category.categoryFeatures ?? []) {
        if ((feature.type === 'SELECT' || feature.type === 'MULTI_SELECT') && !feature.options?.length) {
          issues.push({
            severity: 'error',
            code: 'SELECT_WITHOUT_OPTIONS',
            path: pathLabel,
            message: `У характеристики «${feature.label}» отсутствуют варианты.`
          })
        }

        if (feature.options?.length) {
          const normalizedOptions = feature.options.map(option => option.trim().toLocaleLowerCase('ru-RU'))
          if (new Set(normalizedOptions).size !== normalizedOptions.length) {
            issues.push({
              severity: 'error',
              code: 'DUPLICATE_FEATURE_OPTION',
              path: pathLabel,
              message: `У характеристики «${feature.label}» повторяются варианты.`
            })
          }
        }

        const knownType = featureTypes.get(feature.name)
        if (knownType && knownType !== feature.type) {
          issues.push({
            severity: 'warning',
            code: 'FEATURE_TYPE_CONFLICT',
            path: pathLabel,
            message: `Ключ «${feature.name}» используется с типами ${knownType} и ${feature.type}.`
          })
        } else {
          featureTypes.set(feature.name, feature.type)
        }

        if (feature.type === 'NUMBER' && !feature.unit && !feature.units?.length) {
          issues.push({
            severity: 'warning',
            code: 'NUMBER_WITHOUT_UNIT',
            path: pathLabel,
            message: `Для числовой характеристики «${feature.label}» не задана единица измерения.`
          })
        }
      }

      if (category.children?.length) walk(category.children, path)
    }
  }

  walk(categories)
  return issues
}

export function assertCategoriesValid(categories: CategoryInput[]): void {
  const errors = validateCategories(categories).filter(issue => issue.severity === 'error')
  if (errors.length) {
    throw new Error(errors.map(issue => `${issue.path}: ${issue.message}`).join('\n'))
  }
}

const AGRO_CHEM_STANDARD = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'SELECT',
    options: ['Жидкая', 'Порошкообразная', 'Гранулированная', 'Гель', 'Таблетки', 'Газ'],
    required: true
  },
  { name: 'active_ingredient', label: 'Действующее вещество', type: 'TEXT', required: true },
  { name: 'concentration', label: 'Концентрация', type: 'TEXT' },
  { name: 'application_purpose', label: 'Назначение', type: 'TEXT', filterable: false },
  // Переименовано из 'crop': отдельный ключ от AGRO_SEED_FEATURES.crop —
  // там 'crop' означает культуру, КОТОРАЯ продаётся (семена), а здесь —
  // культуру, к которой ПРИМЕНЯЕТСЯ химикат. Разный смысл, общее имя поля
  // раньше приводило к тому, что одно и то же имя 'crop' было то
  // filterable, то нет в зависимости от категории.
  { name: 'target_crop', label: 'Культура применения', type: 'TEXT', filterable: false },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  // Уникальный номер госрегистрации конкретного препарата — не факт
  // фильтрации, справочное поле.
  { name: 'registration_number', label: 'Регистрационный номер', type: 'TEXT', filterable: false },
  {
    name: 'hazard_class',
    label: 'Класс опасности',
    type: 'SELECT',
    options: ['1 класс', '2 класс', '3 класс', '4 класс', 'Не указан']
  },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Канистра', 'Еврокуб (IBC)', 'Флакон/Бутылка', 'Мешки', 'Биг-бэг', 'Цистерна/Навалом']
  },
  { name: 'package_size', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['мл', 'л', 'г', 'кг'] }
] satisfies CategoryFeatureSeed[]

const AGRO_SOIL_FEATURES = [
  // Список вариантов ориентировочный — стоит свериться и поправить под
  // реальный ассортимент, прежде чем полагаться на него как на
  // окончательный.
  {
    name: 'soil_type',
    label: 'Тип грунта/субстрата',
    type: 'SELECT',
    options: [
      'Универсальный грунт',
      'Чернозём',
      'Торфяной грунт',
      'Грунт для рассады/цветов',
      'Кокосовый субстрат',
      'Песок',
      'Перлит/Вермикулит',
      'Компост',
      'Другое'
    ]
  },
  { name: 'composition', label: 'Состав', type: 'TEXT', filterable: false },
  { name: 'acidity', label: 'Кислотность (pH)', type: 'NUMBER', unit: 'pH', min: 0, max: 14 },
  {
    name: 'packaging_type',
    label: 'Упаковка',
    type: 'SELECT',
    options: ['Мешки', 'Биг-бэг/Биг-бэйл', 'Навалом/Самосвал']
  },
  { name: 'package_volume', label: 'Объём упаковки', type: 'NUMBER', units: ['л', 'м³'] }
] satisfies CategoryFeatureSeed[]

const AGRO_CLEAN_FEATURES = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'SELECT',
    options: ['Жидкая (концентрат)', 'Жидкая (готовый раствор)', 'Порошок', 'Таблетки/Брикеты'],
    required: true
  },
  { name: 'active_ingredient', label: 'Действующее вещество', type: 'TEXT' },
  { name: 'concentration', label: 'Концентрация', type: 'TEXT' },
  { name: 'application_purpose', label: 'Назначение/объект обработки', type: 'TEXT', filterable: false },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Флакон/Бутылка', 'Канистра', 'Бочка', 'Еврокуб', 'Мешок/Коробка']
  },
  { name: 'package_size', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['мл', 'л', 'г', 'кг'] }
] satisfies CategoryFeatureSeed[]

const FEED_HIGH_PROTEIN = [
  {
    name: 'animal_type',
    label: 'Предназначение',
    type: 'MULTI_SELECT',
    options: ['Коровы, быки', 'Овцы, козы', 'Лошади', 'Свиньи', 'Птица', 'Рыба', 'Универсальный']
  },
  { name: 'protein', label: 'Сырой протеин', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  { name: 'moisture', label: 'Влажность', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Упаковка',
    type: 'MULTI_SELECT',
    options: ['Мешки', 'Биг-бэг', 'Навалом/Автоцистерна', 'Канистра/Бочка']
  },
  { name: 'batch_weight', label: 'Объём партии', type: 'NUMBER', units: ['кг', 'т'] }
] satisfies CategoryFeatureSeed[]

const FEED_BULK_FEATURES = [
  { name: 'harvest_year', label: 'Год заготовки/урожая', type: 'NUMBER', unit: 'год' },
  { name: 'moisture', label: 'Влажность', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  {
    name: 'packaging_options',
    label: 'Упаковка/Форма',
    type: 'MULTI_SELECT',
    options: ['Рулоны', 'Тюки', 'Навалом/Кузов', 'В рукаве/Траншея']
  },
  { name: 'batch_weight', label: 'Объём партии', type: 'NUMBER', units: ['кг', 'т'] }
] satisfies CategoryFeatureSeed[]

const FEED_ADDITIVES = [
  {
    name: 'animal_type',
    label: 'Предназначение',
    type: 'MULTI_SELECT',
    options: ['Коровы, быки', 'Овцы, козы', 'Лошади', 'Свиньи', 'Птица', 'Рыба', 'Универсальный']
  },
  { name: 'active_ingredient', label: 'Состав/действующее вещество', type: 'TEXT' },
  {
    name: 'form',
    label: 'Форма',
    type: 'SELECT',
    options: ['Порошок', 'Гранулы', 'Жидкость', 'Блок/Лизунец', 'Паста', 'Другое']
  },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_type',
    label: 'Упаковка',
    type: 'SELECT',
    options: ['Мешки', 'Биг-бэг', 'Блоки/Лизунцы', 'Флаконы/Канистры']
  },
  { name: 'package_weight', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['г', 'кг', 'мл', 'л'] }
] satisfies CategoryFeatureSeed[]

const ENSILAGE_FEATURES = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'SELECT',
    options: ['Сухая (порошок/гранулы)', 'Жидкая (концентрат)'],
    required: true
  },
  { name: 'culture', label: 'Для какой культуры', type: 'TEXT' },
  { name: 'dosage', label: 'Норма внесения', type: 'TEXT' },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Канистра/Флакон', 'Пакет/Коробка', 'Ведро']
  },
  { name: 'package_size', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['г', 'кг', 'мл', 'л'] }
] satisfies CategoryFeatureSeed[]

const ANIMAL_FEED_EXTENDED = [
  {
    name: 'pet_type',
    label: 'Для кого',
    type: 'MULTI_SELECT',
    options: ['Собаки', 'Кошки', 'Универсальный (собаки и кошки)', 'Другие питомцы']
  },
  {
    name: 'feed_form',
    label: 'Форма корма',
    type: 'SELECT',
    options: ['Сухой корм', 'Влажный (паучи, консервы)', 'Лакомства', 'Заменитель молока']
  },
  {
    name: 'age_group',
    label: 'Возрастная группа',
    type: 'SELECT',
    options: ['Для котят/щенков', 'Для взрослых', 'Для пожилых', 'Универсальный']
  },
  { name: 'brand', label: 'Бренд', type: 'TEXT' },
  { name: 'package_weight', label: 'Масса упаковки', type: 'NUMBER', units: ['г', 'кг'] }
] satisfies CategoryFeatureSeed[]

const FEED_LIQUID_FEATURES = [
  { name: 'composition', label: 'Состав', type: 'TEXT', filterable: false },
  { name: 'dry_matter', label: 'Сухое вещество', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Автоцистерна', 'Еврокуб', 'Бочка', 'Канистра', 'Навалом/Налив']
  },
  { name: 'batch_volume', label: 'Объём партии', type: 'NUMBER', units: ['л', 'м³', 'т'] }
] satisfies CategoryFeatureSeed[]

export const EQUIP_BASE = [
  { name: 'brand', label: 'Производитель/бренд', type: 'TEXT' },
  { name: 'model', label: 'Модель', type: 'TEXT' },
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у', 'Восстановленное'],
    required: true
  },
  { name: 'year', label: 'Год выпуска', type: 'NUMBER', unit: 'год', min: 1900, max: 2100 },
  { name: 'country', label: 'Страна производства', type: 'TEXT' },
  { name: 'power', label: 'Мощность', type: 'NUMBER', units: ['кВт', 'л.с.'] },
  { name: 'performance', label: 'Производительность', type: 'TEXT' },
  { name: 'operating_hours', label: 'Наработка', type: 'NUMBER', unit: 'моточас' },
  { name: 'warranty', label: 'Гарантия', type: 'NUMBER', units: ['мес.', 'год'] },
  { name: 'commissioning', label: 'Пусконаладка', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

const EQUIP_PARTS = [
  { name: 'compatible_brand', label: 'Совместимая марка', type: 'TEXT', required: true },
  { name: 'compatible_model', label: 'Совместимая модель', type: 'TEXT', filterable: false },
  { name: 'part_number', label: 'Каталожный номер/артикул', type: 'TEXT', filterable: false },
  {
    name: 'part_origin',
    label: 'Тип запчасти',
    type: 'SELECT',
    options: ['Оригинал', 'Аналог', 'Восстановленная', 'Не указано']
  },
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у', 'Восстановленное'],
    required: true
  },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' }
] satisfies CategoryFeatureSeed[]

const FOOD_GROCERY = [
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  { name: 'country', label: 'Страна происхождения', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: ['Мешок', 'Биг-бэг', 'Пакет/Пачка', 'Коробка', 'Навалом/Бункер']
  },
  { name: 'package_weight', label: 'Масса упаковки', type: 'NUMBER', units: ['г', 'кг', 'т'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

const FOOD_DAIRY = [
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  { name: 'fat', label: 'Жирность', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'Пакет/Тетрапак',
      'Бутылка',
      'Пластиковая тара/Стакан',
      'Фляга/Цистерна',
      'Коробка/Монолит',
      'Вакуум/Плёнка',
      'Мешок/Биг-бэг'
    ]
  },
  { name: 'package_size', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['мл', 'л', 'г', 'кг'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', placeholder: 'Например, ГОСТ 31450-2013', filterable: false }
] satisfies CategoryFeatureSeed[]

export const FOOD_BASE = [
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  { name: 'country', label: 'Страна происхождения', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: ['Короб', 'Пакет/Мешок', 'Вакуум', 'Лоток/Коррекс', 'Навалом/Монолит']
  },
  { name: 'package_weight', label: 'Масса упаковки/партии', type: 'NUMBER', units: ['г', 'кг', 'т'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', placeholder: 'Например, ГОСТ 32125-2013', filterable: false }
] satisfies CategoryFeatureSeed[]

export const FOOD_MEAT = [
  { name: 'animal_species', label: 'Вид животного', type: 'TEXT' },
  { name: 'cut_type', label: 'Отруб/часть туши', type: 'TEXT' },
  {
    name: 'thermal_state',
    label: 'Термическое состояние',
    type: 'SELECT',
    options: ['Парное', 'Охлаждённое', 'Замороженное', 'Вяленое/Копчёное', 'Солёное'],
    required: true
  },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'В тушах/Полутушах/Четвертинах',
      'Навалом/Монолитный блок',
      'Вакуумная упаковка',
      'Лоток/МГС',
      'Короб/Гофрокороб',
      'Плёнка/Мешок'
    ]
  },
  { name: 'batch_weight', label: 'Масса партии', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

export const FOOD_FISH = [
  { name: 'fish_species', label: 'Вид рыбы/морепродукта', type: 'TEXT', required: true },
  {
    name: 'thermal_state',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Живая', 'Охлаждённая', 'Замороженная', 'Вяленая/Сушёная', 'Копчёная', 'Солёная', 'Готовый продукт'],
    required: true
  },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: ['Лёд/Контейнер', 'Вакуум', 'Лоток/МГС', 'Короб', 'Блок', 'Банка/Ведро', 'Навалом']
  },
  { name: 'batch_weight', label: 'Масса партии', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

export const FOOD_CANNED = [
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'Стеклянная банка',
      'Жестяная банка',
      'Реторт-пакет/Дой-пак',
      'Ламистер',
      'Пластиковая тара/Ведро',
      'Бутылка'
    ]
  },
  { name: 'package_weight', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['мл', 'л', 'г', 'кг'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

const FOOD_READY = [
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'Пакет/Коробка',
      'Бутылка/Банка',
      'Навалом',
      'Шоу-бокс/Дисплей',
      'Плёнка/Флоу-пак',
      'Ведро/Контейнер',
      'Дой-пак'
    ]
  },
  { name: 'package_weight', label: 'Масса/объём упаковки', type: 'NUMBER', units: ['мл', 'л', 'г', 'кг'] },
  { name: 'shelf_life', label: 'Срок годности', type: 'NUMBER', units: ['дн.', 'мес.'] },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

export const AGRO_RAW_FEATURES = [
  { name: 'variety', label: 'Сорт/гибрид', type: 'TEXT' },
  { name: 'quality_grade', label: 'Класс/сорт качества', type: 'TEXT' },
  { name: 'harvest_year', label: 'Год урожая', type: 'NUMBER', unit: 'год' },
  { name: 'moisture', label: 'Влажность', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  {
    name: 'packaging_options',
    label: 'Упаковка',
    type: 'MULTI_SELECT',
    options: ['Навалом/Насыпью', 'Биг-бэг', 'Мешки', 'Флекситанк/Цистерна']
  },
  { name: 'batch_weight', label: 'Объём партии', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'gost', label: 'ГОСТ/ТУ', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

const AGRO_FRESH_FEATURES = [
  { name: 'variety', label: 'Сорт/гибрид', type: 'TEXT' },
  { name: 'origin_country', label: 'Страна происхождения', type: 'TEXT' },
  { name: 'origin_region', label: 'Регион происхождения', type: 'TEXT' },
  {
    name: 'quality_class',
    label: 'Класс качества',
    type: 'SELECT',
    options: ['Экстра', '1 класс', '2 класс', 'Некалиброванное']
  },
  { name: 'harvest_year', label: 'Год урожая', type: 'NUMBER', unit: 'год' },
  { name: 'caliber', label: 'Калибр/размер', type: 'NUMBER', unit: 'мм' },
  {
    name: 'packaging_options',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Ящики', 'Сетки', 'Коробки', 'Навалом', 'Поддоны']
  },
  { name: 'batch_weight', label: 'Доступный объём', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'minimum_order', label: 'Минимальная партия', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'certified', label: 'Есть сертификаты/декларации', type: 'BOOLEAN' },
  { name: 'organic', label: 'Органическая продукция', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

const AGRO_HONEY_FEATURES = [
  {
    name: 'honey_type',
    label: 'Вид мёда',
    type: 'SELECT',
    options: [
      'Липовый',
      'Гречишный',
      'Акациевый',
      'Подсолнечниковый',
      'Цветочный (разнотравье)',
      'Каштановый',
      'Донниковый',
      'Кипрейный',
      'Таёжный',
      'Прочий'
    ]
  },
  { name: 'collection_year', label: 'Год сбора', type: 'NUMBER', unit: 'год' },
  {
    name: 'physical_state',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Жидкий', 'Кристаллизованный (севший)', 'Крем-мёд']
  },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Пластиковое ведро', 'Стеклянная банка', 'Фляга/Барабан', 'Куботейнер', 'В сотах (рамка)']
  },
  { name: 'package_weight', label: 'Масса упаковки', type: 'NUMBER', units: ['г', 'кг'] }
] satisfies CategoryFeatureSeed[]

const BEE_PRODUCT_FEATURES = [
  { name: 'collection_year', label: 'Год сбора/производства', type: 'NUMBER', unit: 'год' },
  { name: 'product_state', label: 'Форма/состояние продукта', type: 'TEXT' },
  { name: 'packaging_description', label: 'Упаковка', type: 'TEXT', filterable: false },
  { name: 'package_weight', label: 'Масса упаковки', type: 'NUMBER', units: ['г', 'кг'] },
  { name: 'laboratory_report', label: 'Есть лабораторный протокол', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

const BEE_WAX_FEATURES = [
  {
    name: 'wax_form',
    label: 'Форма воска',
    type: 'SELECT',
    options: ['Воск-сырец', 'Слиток', 'Гранулы', 'Вощина', 'Другое']
  },
  { name: 'grade', label: 'Сорт/качество', type: 'TEXT' },
  { name: 'packaging_description', label: 'Упаковка', type: 'TEXT', filterable: false },
  { name: 'batch_weight', label: 'Масса партии', type: 'NUMBER', units: ['кг', 'т'] }
] satisfies CategoryFeatureSeed[]

export const AGRO_GREEN_FEATURES = [
  {
    name: 'state',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Свежесрезанная', 'В горшочках (с корневой системой)', 'Замороженная', 'Сушеная']
  },
  {
    name: 'packaging_options',
    label: 'Упаковка / Тара',
    type: 'MULTI_SELECT',
    options: [
      'Пакет / Флоу-пак',
      'Коррекс / Пинетка',
      'Ящики (дерево / пластик)',
      'Коробки / Картон',
      'Сетки',
      'Навалом'
    ]
  }
] satisfies CategoryFeatureSeed[]

export const AGRO_MUSHROOM_FEATURES = [
  {
    name: 'physical_state',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Свежие', 'Замороженные (шоковая заморозка)', 'Сушёные', 'Солёные/Маринованные']
  },
  {
    name: 'origin_type',
    label: 'Происхождение',
    type: 'SELECT',
    options: ['Культивируемые (фермерские)', 'Дикорастущие (дикоросы)']
  },
  { name: 'species', label: 'Вид/сорт грибов', type: 'TEXT' },
  {
    name: 'packaging_options',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Ящики', 'Коробки/Картон', 'Коррекс/Пинетка', 'Мешки/Пакеты', 'Бочки/Банки']
  },
  { name: 'batch_weight', label: 'Масса партии', type: 'NUMBER', units: ['кг', 'т'] }
] satisfies CategoryFeatureSeed[]

const ANIMAL_FEATURES = [
  { name: 'breed', label: 'Порода', type: 'TEXT' },
  { name: 'sex', label: 'Пол', type: 'SELECT', options: ['Самец', 'Самка', 'Смешанная группа', 'Не указан'] },
  { name: 'age', label: 'Возраст', type: 'NUMBER', units: ['дн.', 'мес.', 'год'] },
  { name: 'weight', label: 'Средний вес одной головы', type: 'NUMBER', unit: 'кг' },
  { name: 'quantity', label: 'Количество голов', type: 'NUMBER', unit: 'шт.', min: 1 },
  {
    name: 'animal_purpose',
    label: 'Назначение',
    type: 'SELECT',
    options: ['Племенное', 'Молочное', 'Мясное', 'Рабочее', 'Откорм', 'Другое']
  },
  { name: 'vaccination', label: 'Вакцинация проведена', type: 'BOOLEAN' },
  { name: 'veterinary_documents', label: 'Ветеринарные документы', type: 'BOOLEAN' },
  { name: 'pedigree_documents', label: 'Племенные документы', type: 'BOOLEAN' },
  { name: 'delivery', label: 'Возможна доставка', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

export const POULTRY_FEATURES = [
  { name: 'breed', label: 'Порода/кросс', type: 'TEXT' },
  {
    name: 'item_type',
    label: 'Тип предложения',
    type: 'SELECT',
    options: ['Суточные цыплята', 'Молодняк/Подрощенные', 'Несушки', 'Бройлеры', 'Инкубационное яйцо'],
    required: true
  },
  { name: 'age', label: 'Возраст', type: 'NUMBER', units: ['дн.', 'нед.', 'мес.'] },
  { name: 'quantity', label: 'Количество', type: 'NUMBER', unit: 'шт.', min: 1 },
  { name: 'vaccination', label: 'Вакцинация проведена', type: 'BOOLEAN' },
  { name: 'veterinary_documents', label: 'Ветеринарные документы', type: 'BOOLEAN' },
  { name: 'delivery', label: 'Возможна доставка', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

export const BEES_FEATURES = [
  {
    name: 'bee_breed',
    label: 'Порода пчёл',
    type: 'SELECT',
    options: ['Карпатская', 'Карника', 'Среднерусская', 'Бакфаст', 'Кавказская', 'Прочая']
  },
  {
    name: 'item_type',
    label: 'Тип предложения',
    type: 'SELECT',
    options: ['Пчелопакет', 'Пчелосемья (с ульем)', 'Пчеломатка', 'Рой'],
    required: true
  },
  { name: 'quantity', label: 'Количество', type: 'NUMBER', unit: 'шт.', min: 1 },
  { name: 'queen_year', label: 'Год вывода матки', type: 'NUMBER', unit: 'год' },
  { name: 'veterinary_documents', label: 'Ветеринарные документы', type: 'BOOLEAN' },
  { name: 'delivery', label: 'Возможна доставка', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

export const FISH_FEATURES = [
  { name: 'fish_species', label: 'Вид рыбы', type: 'TEXT', placeholder: 'Карп, форель, осётр…', required: true },
  { name: 'weight', label: 'Средняя навеска/вес одной особи', type: 'NUMBER', units: ['г', 'кг'] },
  { name: 'stage', label: 'Стадия', type: 'SELECT', options: ['Икра', 'Личинка', 'Малёк', 'Годовик', 'Товарная рыба'] },
  { name: 'quantity', label: 'Количество', type: 'NUMBER', unit: 'шт.', min: 1 },
  { name: 'veterinary_documents', label: 'Ветеринарные документы', type: 'BOOLEAN' },
  { name: 'delivery', label: 'Возможна доставка', type: 'BOOLEAN' }
] satisfies CategoryFeatureSeed[]

const DEFAULT_FEATURES = [
  { name: 'grade', label: 'Состояние/сорт', type: 'TEXT' },
  { name: 'batch_weight', label: 'Объём партии', type: 'NUMBER', units: ['кг', 'т'] }
] satisfies CategoryFeatureSeed[]

const TECH_ATTACHED = [
  { name: 'brand', label: 'Производитель/бренд', type: 'TEXT' },
  { name: 'model', label: 'Модель', type: 'TEXT' },
  { name: 'year', label: 'Год выпуска', type: 'NUMBER', unit: 'год', min: 1900, max: 2100 },
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у', 'Восстановленное'],
    required: true
  },
  { name: 'working_width', label: 'Рабочая ширина', type: 'NUMBER', units: ['мм', 'м'] },
  { name: 'required_power', label: 'Требуемая мощность', type: 'NUMBER', units: ['кВт', 'л.с.'] },
  { name: 'operating_hours', label: 'Наработка', type: 'NUMBER', unit: 'моточас' }
] satisfies CategoryFeatureSeed[]

const TECH_PARTS = [
  { name: 'compatible_brand', label: 'Совместимая марка техники', type: 'TEXT', required: true },
  { name: 'compatible_model', label: 'Совместимая модель', type: 'TEXT', filterable: false },
  { name: 'part_number', label: 'Каталожный номер/артикул', type: 'TEXT', filterable: false },
  {
    name: 'part_origin',
    label: 'Тип запчасти',
    type: 'SELECT',
    options: ['Оригинал', 'Аналог', 'Восстановленная', 'Не указано']
  },
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у', 'Восстановленное'],
    required: true
  },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' }
] satisfies CategoryFeatureSeed[]

const PACKAGING_MATERIAL_FEATURES = [
  {
    name: 'material_type',
    label: 'Материал',
    type: 'SELECT',
    options: ['Пластик', 'Полиэтилен/Плёнка', 'Бумага/Картон', 'Дерево', 'Стекло', 'Металл', 'Ткань/Джут']
  },
  {
    name: 'dimensions',
    label: 'Размеры (Д×Ш×В)',
    type: 'TEXT',
    placeholder: 'Например, 1200×800×1000 мм',
    filterable: false
  },
  { name: 'capacity', label: 'Вместимость', type: 'NUMBER', units: ['мл', 'л', 'м³'] },
  { name: 'load_capacity', label: 'Допустимая масса', type: 'NUMBER', units: ['кг', 'т'] },
  { name: 'new_or_used', label: 'Состояние', type: 'SELECT', options: ['Новое', 'Б/у'] }
] satisfies CategoryFeatureSeed[]

// MATERIAL_FEATURES был удалён: набор нигде не применялся ни к одной
// категории (мёртвый код), а его material_type: TEXT дублировал/конфликтовал
// по смыслу с material_type: SELECT из PACKAGING_MATERIAL_FEATURES.

const OTHER_FUEL_FEATURES = [
  { name: 'fuel_type', label: 'Тип/Марка', type: 'TEXT' },
  {
    name: 'packaging_type',
    label: 'Упаковка',
    type: 'SELECT',
    options: ['Биг-бэг', 'Навалом', 'Сетки/Пакеты', 'Канистра/Бочка', 'В кузове']
  }
] satisfies CategoryFeatureSeed[]

const OTHER_GOODS_FEATURES = [
  { name: 'material_description', label: 'Материал', type: 'TEXT', filterable: false },
  { name: 'dimensions', label: 'Размеры / Толщина', type: 'TEXT', filterable: false },
  // Переименовано из 'origin': это то же самое поле "Производитель", что и
  // в остальных наборах — просто раньше называлось по-другому и было
  // независимым от общего ключа 'manufacturer'.
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' }
] satisfies CategoryFeatureSeed[]

const OTHER_WASTE_FEATURES = [
  { name: 'raw_type', label: 'Тип сырья', type: 'TEXT' },
  { name: 'batch_volume', label: 'Объём партии', type: 'NUMBER', units: ['кг', 'т', 'м³'] },
  { name: 'packaging_type', label: 'Упаковка', type: 'SELECT', options: ['Навалом', 'Биг-бэг', 'Мешки'] }
] satisfies CategoryFeatureSeed[]

const AGRO_TECHNICAL_FEATURES = [
  {
    name: 'processing_state',
    label: 'Состояние сырья',
    type: 'MULTI_SELECT',
    options: [
      'Свежее/Свежевыкопанное',
      'Высушенное (цельное)',
      'Измельченное/Резаное/Молотое',
      'Гранулированное (для хмеля/трав)',
      'Прессованное/В кипах/В рулонах',
      'Очищенное (семена)'
    ]
  },
  {
    name: 'packaging_options',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Биг-бэг', 'Мешки', 'Кипы/Киповые прессы', 'Картонные короба', 'Вакуумная упаковка/Фольга', 'Навалом']
  }
] satisfies CategoryFeatureSeed[]

const AGRO_INDUSTRIAL_RAW_FEATURES = [
  {
    name: 'raw_grade',
    label: 'Сорт / Класс / Грейд',
    type: 'SELECT',
    options: ['Высший сорт (Экстра)', '1 сорт', '2 сорт', '3 сорт', 'Несортированное']
  },
  {
    name: 'treatment_type',
    label: 'Способ обработки / Состояние',
    type: 'SELECT',
    options: [
      'Необработанное (сырьё)',
      'Мытое / Очищенное',
      'Мокросоленое',
      'Сухосоленое',
      'Сушеное (для растительного сырья)'
    ]
  },
  {
    name: 'packaging_type',
    label: 'Упаковка / Тара',
    type: 'SELECT',
    options: ['Прессованные тюки', 'Мешки (ПП/джут)', 'В бочках / Рассоле', 'Пакеты / Коробки', 'Навалом']
  }
] satisfies CategoryFeatureSeed[]

const AGRO_SEED_FEATURES = [
  { name: 'crop', label: 'Культура', type: 'TEXT', required: true },
  { name: 'variety', label: 'Сорт/гибрид', type: 'TEXT' },
  // Список вариантов ориентировочный (стандартная сортовая градация семян
  // в РФ) — стоит свериться и поправить под реальный ассортимент.
  {
    name: 'reproduction',
    label: 'Репродукция/поколение',
    type: 'SELECT',
    options: [
      'Оригинальные семена (ОС)',
      'Элитные семена (ЭС)',
      '1-я репродукция (РС1)',
      '2-я репродукция (РС2)',
      'Массовая репродукция (РСт)'
    ]
  },
  { name: 'harvest_year', label: 'Год урожая/производства', type: 'NUMBER', unit: 'год' },
  { name: 'germination', label: 'Всхожесть', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  { name: 'purity', label: 'Чистота', type: 'NUMBER', unit: '%', min: 0, max: 100 },
  { name: 'thousand_seed_weight', label: 'Масса 1000 семян', type: 'NUMBER', unit: 'г' },
  { name: 'treated', label: 'Протравлено/обработано', type: 'BOOLEAN' },
  { name: 'certificate', label: 'Есть сертификат', type: 'BOOLEAN' },
  {
    name: 'packaging_options',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Биг-бэги', 'Мешки (бумажные/ПП)', 'Навалом/Насыпью', 'Кассеты/Горшки', 'ОКС', 'ЗКС', 'Пакеты (фасовка)']
  },
  { name: 'batch_weight', label: 'Масса/количество партии', type: 'NUMBER', units: ['г', 'кг', 'т', 'шт.'] }
] satisfies CategoryFeatureSeed[]

const OTHER_DEFAULT_FEATURES = [
  { name: 'usage', label: 'Назначение', type: 'TEXT' },
  // Переименовано из 'origin' — тот же общий ключ 'manufacturer', что и
  // везде остальные (см. OTHER_GOODS_FEATURES).
  { name: 'manufacturer', label: 'Производитель/Бренд', type: 'TEXT' }
] satisfies CategoryFeatureSeed[]

// Значения — из enum Prisma PriceUnit ('ITEM' | 'TON' | 'KG' | 'LITER' |
// 'M3' | 'BAG' | 'HEAD' | 'DOSE' | 'RUNNING_METER' | 'HA' | 'HOUR'),
// см. server/prisma/schema.prisma. Ключи — ссылки на сами наборы фич
// (не строки), поэтому карта должна идти ПОСЛЕ объявления всех наборов
// фич выше и ДО того, как materializeCategories() реально выполнится
// (то есть до вызова CATEGORIES_DATA = materializeCategories(...) внизу
// файла) — сама функция materializeCategories объявлена раньше, но
// вызывается только в самом конце файла, так что порядок ок.
//
// Порядок значений в каждом списке — это и порядок вариантов в выпадающем
// списке при создании объявления, первое значение подставляется по
// умолчанию. Список ориентировочный — по каждой категории его можно
// переопределить вручную полем priceUnits прямо в CATEGORY_TREE.
const DEFAULT_PRICE_UNITS_BY_FEATURES = new Map<CategoryFeatureSeed[], string[]>([
  [AGRO_CHEM_STANDARD, ['KG', 'LITER', 'ITEM']],
  [AGRO_SOIL_FEATURES, ['KG', 'M3', 'ITEM']],
  [AGRO_CLEAN_FEATURES, ['LITER', 'KG', 'ITEM']],
  [FEED_HIGH_PROTEIN, ['KG', 'TON', 'BAG']],
  [FEED_BULK_FEATURES, ['TON', 'KG', 'BAG']],
  [FEED_ADDITIVES, ['KG', 'ITEM']],
  [ENSILAGE_FEATURES, ['LITER', 'KG', 'ITEM']],
  [ANIMAL_FEED_EXTENDED, ['ITEM', 'KG']],
  [FEED_LIQUID_FEATURES, ['LITER', 'TON']],
  [EQUIP_BASE, ['ITEM']],
  [EQUIP_PARTS, ['ITEM']],
  [FOOD_GROCERY, ['KG', 'TON', 'BAG', 'ITEM']],
  [FOOD_DAIRY, ['LITER', 'KG', 'ITEM']],
  [FOOD_BASE, ['KG', 'TON', 'ITEM']],
  [FOOD_MEAT, ['KG', 'TON']],
  [FOOD_FISH, ['KG', 'TON']],
  [FOOD_CANNED, ['ITEM']],
  [FOOD_READY, ['ITEM', 'KG']],
  [AGRO_RAW_FEATURES, ['TON', 'KG', 'BAG']],
  [AGRO_FRESH_FEATURES, ['KG', 'TON', 'ITEM']],
  [AGRO_HONEY_FEATURES, ['KG', 'ITEM']],
  [BEE_PRODUCT_FEATURES, ['KG', 'ITEM']],
  [BEE_WAX_FEATURES, ['KG']],
  [AGRO_GREEN_FEATURES, ['KG', 'ITEM']],
  [AGRO_MUSHROOM_FEATURES, ['KG', 'ITEM']],
  [ANIMAL_FEATURES, ['HEAD', 'ITEM']],
  [POULTRY_FEATURES, ['HEAD', 'ITEM']],
  [BEES_FEATURES, ['ITEM']],
  [FISH_FEATURES, ['ITEM', 'KG']],
  [DEFAULT_FEATURES, ['ITEM']],
  [TECH_ATTACHED, ['ITEM']],
  [TECH_PARTS, ['ITEM']],
  [PACKAGING_MATERIAL_FEATURES, ['ITEM']],
  [OTHER_FUEL_FEATURES, ['TON', 'KG', 'M3', 'ITEM']],
  [OTHER_GOODS_FEATURES, ['ITEM']],
  [OTHER_WASTE_FEATURES, ['TON', 'KG', 'M3']],
  [AGRO_TECHNICAL_FEATURES, ['TON', 'KG', 'BAG']],
  [AGRO_INDUSTRIAL_RAW_FEATURES, ['KG', 'ITEM']],
  [AGRO_SEED_FEATURES, ['KG', 'TON', 'DOSE', 'BAG']],
  [OTHER_DEFAULT_FEATURES, ['ITEM']]
])

function inferPriceUnits(categoryFeatures?: CategoryFeatureSeed[]): string[] {
  if (categoryFeatures && DEFAULT_PRICE_UNITS_BY_FEATURES.has(categoryFeatures)) {
    return DEFAULT_PRICE_UNITS_BY_FEATURES.get(categoryFeatures)!
  }
  return ['ITEM']
}

const CATEGORY_TREE = [
  {
    name: 'Агрохимия',
    iconId: 'FlaskConical',
    children: [
      { name: 'Биопрепараты', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Грунты', children: [], categoryFeatures: AGRO_SOIL_FEATURES },
      { name: 'Микроудобрения', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Минеральные удобрения', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Моющие и дезинфицирующие средства', children: [], categoryFeatures: AGRO_CLEAN_FEATURES },
      { name: 'Органические удобрения', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Органоминеральные удобрения', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Регуляторы роста', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Дезинсекция и дератизация', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Средства защиты растений', children: [], categoryFeatures: AGRO_CHEM_STANDARD }
    ]
  },
  {
    name: 'С/х животные и птица',
    aliases: ['Сельскохозяйственные животные, птица и аквакультура', 'Сельхозживотные'],
    iconId: 'Bird',
    children: [
      { name: 'Крупный рогатый скот (КРС)', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Свиньи', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Овцы и бараны', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Козы', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Лошади', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Сельхозптица', children: [], categoryFeatures: POULTRY_FEATURES },
      { name: 'Кролики', children: [], categoryFeatures: ANIMAL_FEATURES },
      {
        name: 'Пчёлы, пчелосемьи и пчеломатки',
        aliases: ['Пчеловодство', 'Пчелопакеты', 'Пчеломатки'],
        children: [],
        categoryFeatures: BEES_FEATURES
      },
      { name: 'Рыбопосадочный материал и малёк', children: [], categoryFeatures: FISH_FEATURES },
      {
        name: 'Другие сельскохозяйственные животные',
        aliases: ['Другие с/х животные'],
        children: [],
        categoryFeatures: ANIMAL_FEATURES
      }
    ]
  },
  {
    name: 'Корма и компоненты',
    aliases: ['Корма и кормовые компоненты', 'Корма для животных'],
    iconId: 'Wheat',
    children: [
      {
        name: 'Готовые корма и комбикорма',
        children: [
          { name: 'Комбикорма, зерносмеси', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Корма для рыб', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          {
            name: 'Корма для кошек и собак',
            aliases: ['Корма для кошек, собак'],
            children: [],
            categoryFeatures: ANIMAL_FEED_EXTENDED
          },
          { name: 'Корма экструдированные', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Жидкие корма', children: [], categoryFeatures: FEED_LIQUID_FEATURES },
          { name: 'Заменители цельного молока', children: [], categoryFeatures: FEED_HIGH_PROTEIN }
        ]
      },
      {
        name: 'Кормовое сырьё',
        children: [
          { name: 'Барда, пивная дробина', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Жмых, шрот, жом, патока', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Зерно фуражное', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Отруби', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Сено, солома, силос', children: [], categoryFeatures: FEED_BULK_FEATURES },
          { name: 'Кормовые корнеплоды', children: [], categoryFeatures: FEED_BULK_FEATURES },
          { name: 'Некондиционные продукты на корм', children: [], categoryFeatures: FEED_HIGH_PROTEIN }
        ]
      },
      {
        name: 'Белковые и минеральные компоненты',
        children: [
          { name: 'Мука мясокостная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука кровяная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука мясная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука перьевая', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука рыбная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука травяная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Кормовые дрожжи', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Соль кормовая', children: [], categoryFeatures: FEED_ADDITIVES }
        ]
      },
      {
        name: 'Добавки, премиксы и пробиотики',
        children: [
          { name: 'Кормовые добавки', children: [], categoryFeatures: FEED_ADDITIVES },
          { name: 'Ингредиенты для кормов', children: [], categoryFeatures: FEED_ADDITIVES },
          { name: 'Пробиотики', children: [], categoryFeatures: FEED_ADDITIVES }
        ]
      },
      {
        name: 'Силосование и консервация кормов',
        children: [
          {
            name: 'Средства для силосования',
            aliases: ['Для силосования'],
            children: [],
            categoryFeatures: ENSILAGE_FEATURES
          }
        ]
      },
      { name: 'Прочие корма', children: [], categoryFeatures: FEED_HIGH_PROTEIN }
    ]
  },
  {
    name: 'Оборудование',
    iconId: 'Wrench',
    children: [
      {
        name: 'Зерноперерабатывающее оборудование',
        children: [
          { name: 'Зерноочистительное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Зернопогрузчики, зернометатели', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Зерносушильное оборудование (зерносушилки)', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Зернотранспортное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Мукомольно-крупяное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Оборудование для анализа качества зерна', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Оборудование для хранения зерна', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Компрессорное и насосное оборудование', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Мясоперерабатывающее оборудование',
        children: [
          { name: 'Блокорезки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Волчки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти и расходные материалы', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Инъекторы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Клипсаторы, перекрутчики', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Коптильни, термокамеры, рамы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Котлетные автоматы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Куттеры', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Линии для разделки птицы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Льдогенераторы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Массажеры', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машины для нарезки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Модульные мясные цеха и мини-заводы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Мясорубки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для обработки субпродуктов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Оборудование для убоя', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пельменные аппараты', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пилы для разделки мяса', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Подвесные пути, подъемники', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пресса механической обвалки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее мясное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Станки для заточки ножей', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тендерайзеры', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Фаршемешалки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Шкуросъемные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Шпигорезки', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для животноводства',
        children: [
          { name: 'Весы для взвешивания животных', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Ветеринарное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Доильное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Домики и загоны для телят', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Клеточное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Климатическое оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машинки для стрижки животных', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Навозоуборочное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для кормления и поения', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Стойловое оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Электропастухи', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для молочной промышленности',
        children: [
          { name: 'Емкости для приемки и хранения', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Заквасочники', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти и комплектующие', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Модульные молочные заводы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Насосы пищевые молочные', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сгущенного молока', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сливочного масла и спредов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сухого молока', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сыра', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства творога', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пастеризаторы и охладители', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее молокоперерабатывающее оборудование', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для переработки овощей, фруктов, ягод',
        children: [
          { name: 'Линии для предпродажной подготовки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для варки, выпаривания, бланширования', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Оборудование для консервирования', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для мойки и подготовки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства паст, соков, пюре', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сахара', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для разделки, нарезки, шинковки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для сушки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Протирочные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Сортировщики и калибровщики', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Столы переборочные', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Для производства кормов', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Для производства продуктов питания',
        children: [
          { name: 'Варочно-жарочное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для консервирования продуктов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для масложирового производства', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для переработки рыбы и морепродуктов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для переработки яиц', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства безалкогольных напитков', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства готовых завтраков, чипсов, снеков', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства соусов, майонеза, кетчупов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства чая', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'По переработке зерновых продуктов', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'По переработке орехов, семечек', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для растениеводства',
        children: [
          { name: 'Климатические шкафы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Лабораторное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машины семяочистительные', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для гидропоники', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для грибоводства', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для контроля окружающей среды', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для полива и орошения', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для приготовления растворов удобрений', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для садоводства', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для цветоводства', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Посадочное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Протравливатели семян', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Теплицы', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Хлебопекарное и кондитерское оборудование',
        children: [
          { name: 'Глазировочные, дражировочные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Дозаторы начинок, шприцы, депозиторы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти для оборудования', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Миксеры, кремовзбивальные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Мукопросеиватели', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства макаронных изделий', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Отсадочные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Печи хлебопекарные', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестоделительные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестозакаточные, формующие машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестомесильные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестоокруглительные машины', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестораскатывающие машины', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Весоизмерительное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Емкостное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Моечное и санитарно-гигиеническое', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для переработки с/х отходов', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для птицеводства', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Для пчеловодства',
        children: [
          { name: 'Ульи и комплектующие', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Медогонки и оборудование для переработки мёда', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Для рыбоводства', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для складов и хранилищ', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Сушильное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Холодильное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Маркировочное и этикетировочное оборудование', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Оборудование для производства упаковки', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Упаковочное и фасовочное оборудование', children: [], categoryFeatures: EQUIP_BASE }
    ]
  },
  {
    name: 'Продукты переработки',
    iconId: 'Factory',
    children: [
      { name: 'Замороженные овощи и фрукты', children: [], categoryFeatures: FOOD_BASE },
      {
        name: 'Консервированные продукты',
        children: [
          { name: 'Грибы солёные, солено-отварные, маринованные', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы молочные', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы мясные', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы мясорастительные', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы овощные, соления, квашения', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы рыбные', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы фруктово-ягодные', children: [], categoryFeatures: FOOD_CANNED }
        ]
      },
      {
        name: 'Крупы и бобовые',
        children: [
          { name: 'Булгур, кускус', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Горох сушеный (целый, колотый)', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа гречневая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа киноа', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа кукурузная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа манная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа овсяная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа перловая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа полбяная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа пшеничная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа пшенная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа рисовая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа ячневая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Хлопья овсяные и зерновые', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Прочие бобовые (чечевица, фасоль, нут, маш)', children: [], categoryFeatures: FOOD_GROCERY }
        ]
      },
      { name: 'Масложировая продукция', children: [], categoryFeatures: FOOD_READY },
      {
        name: 'Молоко, молочные продукты',
        children: [
          { name: 'Йогурт', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кефир', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кумыс', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кисломолочные продукты', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Масло сливочное, пасты масляные', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молоко', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные десерты', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные коктейли', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные продукты для детей', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочный белок', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочный жир', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Мороженое', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Растительные заменители пищевого молока и сливок', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Ряженка', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сгущенное молоко', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сливки', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сметана', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сухое молоко, сухие натуральные сливки', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сыворотка', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сыры', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Творог и творожные изделия', children: [], categoryFeatures: FOOD_DAIRY }
        ]
      },
      {
        name: 'Мясо и мясные продукты',
        children: [
          { name: 'Баранина', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Говядина', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Готовые мясные продукты, полуфабрикаты', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Козлятина', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Конина', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Колбасные изделия и мясные деликатесы', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Кролик', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Птица', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Свинина', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Субпродукты', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Сырое сало (шпик), жир-сырец', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Фарш', children: [], categoryFeatures: FOOD_MEAT }
        ]
      },
      { name: 'Пряности, специи, приправы', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Сушёные овощи, фрукты, сухофрукты', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Чай, кофе, какао-напитки', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Экстракты растительные пищевые', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Безалкогольные напитки, соки, воды', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Изоляты, текстураты, соевые белки', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Какао-порошок, какао-бобы, кэроб', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Кондитерские изделия', children: [], categoryFeatures: FOOD_READY },
      { name: 'Крахмало-паточная продукция, сиропы', children: [], categoryFeatures: FOOD_BASE },
      { name: 'Макаронные изделия', children: [], categoryFeatures: FOOD_GROCERY },
      {
        name: 'Мука',
        children: [
          { name: 'Мука амарантовая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука гороховая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука грецкого ореха', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука гречневая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука из зародышей пшеницы', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука кукурузная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука кунжутная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука льняная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука нутовая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука овсяная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука ореховая', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука полбяная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука пшеничная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука расторопши', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука ржаная', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука рисовая', children: [], categoryFeatures: FOOD_GROCERY }
        ]
      },
      { name: 'Пасты, пюре', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Продукты быстрого приготовления', children: [], categoryFeatures: FOOD_READY },
      { name: 'Прочая пищевая продукция', children: [], categoryFeatures: FOOD_READY },
      {
        name: 'Рыба и морепродукты',
        children: [
          { name: 'Готовые рыбные продукты и полуфабрикаты', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Икра рыбы', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Моллюски и ракообразные', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Морская капуста, водоросли', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Прочие морепродукты', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба вяленая, сушеная', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба живая, охлаждённая', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба копчёная', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба свежемороженая', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба соленая', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыбные субпродукты', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Фарш рыбный', children: [], categoryFeatures: FOOD_FISH }
        ]
      },
      { name: 'Сахар', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Снековая продукция', children: [], categoryFeatures: FOOD_READY },
      { name: 'Солод', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Соусы, кетчуп, майонез', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Хлебобулочные изделия', children: [], categoryFeatures: FOOD_READY },
      { name: 'Яичный порошок, меланж', children: [], categoryFeatures: FOOD_GROCERY }
    ]
  },
  {
    name: 'Свежая сельхозпродукция',
    aliases: ['Продукты питания', 'Свежие продукты'],
    iconId: 'Apple',
    children: [
      { name: 'Грибы пищевые', children: [], categoryFeatures: AGRO_MUSHROOM_FEATURES },
      {
        name: 'Зелень, салатные культуры, травы',
        children: [
          { name: 'Базилик', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Кинза', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Лук зелёный (перо)', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Микрозелень', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Петрушка', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Рукола', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Салат листовой', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Укроп', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Шпинат', children: [], categoryFeatures: AGRO_GREEN_FEATURES }
        ]
      },
      {
        name: 'Овощи',
        children: [
          { name: 'Баклажаны', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Батат', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Кабачки', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Капуста белокочанная', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Капуста пекинская', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Капуста цветная и брокколи', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Картофель', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лук репчатый', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Морковь', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Огурцы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Пастернак', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Перец болгарский', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Перец острый', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Помидоры', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ревень', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Редис', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Редька', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сахарная кукуруза', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Свекла столовая', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сельдерей', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Топинамбур', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Тыква', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Фасоль стручковая', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Чеснок', children: [], categoryFeatures: AGRO_FRESH_FEATURES }
        ]
      },
      {
        name: 'Орехи и семечки',
        children: [
          { name: 'Арахис', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Бразильский орех', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Грецкий орех', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Каштаны', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кедровый орех', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кешью', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кокосовый орех', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Макадамия', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Миндаль', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Орех кола', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Пекан', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Семена тыквы', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фисташки', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фундук', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Прочие орехи', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Фрукты, ягоды',
        children: [
          { name: 'Абрикосы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Авокадо', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Айва', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Алыча', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ананасы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Апельсины', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Арбузы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Бананы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Барбарис', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Боярышник', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Брусника', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Виноград', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Вишня', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Годжи', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Голубика', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Гранат', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Грейпфрут', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Груши', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Гуава', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Дыни', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ежевика', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Жимолость', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Земляника', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Инжир', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ирга', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Калина', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Киви', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Клубника', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Клюква', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Крыжовник', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лайм', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лимоны', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Малина', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Манго', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Мандарины', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Маракуйя', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Можжевеловая ягода', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Морошка', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Нектарины', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Персики', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Облепиха', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Папайя', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Помело', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Рябина', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сливы', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Смородина', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Фейхоа', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Финики', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Хурма', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черёмуха', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черешня', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черника', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Шиповник', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Экзотические фрукты', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Яблоки', children: [], categoryFeatures: AGRO_FRESH_FEATURES }
        ]
      },
      {
        name: 'Яйцо',
        children: [],
        categoryFeatures: [
          {
            name: 'egg_category',
            label: 'Категория яйца',
            type: 'SELECT',
            options: ['С0', 'С1', 'С2', 'СВ', 'СП'],
            required: true
          }
        ]
      },
      {
        name: 'Мёд и продукция пчеловодства',
        children: [
          { name: 'Мёд натуральный (монофлорный, полифлорный)', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Мёд в сотах', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Перга, пыльца (обножка)', children: [], categoryFeatures: BEE_PRODUCT_FEATURES },
          { name: 'Прополис', children: [], categoryFeatures: BEE_PRODUCT_FEATURES },
          { name: 'Маточное молочко, трутневый гомогенат', children: [], categoryFeatures: BEE_PRODUCT_FEATURES },
          { name: 'Воск пчелиный', children: [], categoryFeatures: BEE_WAX_FEATURES }
        ]
      }
    ]
  },
  {
    name: 'Агрокультуры',
    aliases: ['Сельхозпродукция и растительное сырьё', 'Сельхозсырьё и агрокультуры'],
    iconId: 'Sprout',
    children: [
      {
        name: 'Зерно, зернобобовые',
        children: [
          { name: 'Бобы', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Горох', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Гречиха', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кукуруза', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Люпин', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Маш', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Нут', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Овёс', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Полба', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Просо', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Пшеница', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рожь', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Сорго', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Соя', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Тритикале', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фасоль', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Чечевица', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Ячмень', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Технические культуры',
        children: [
          { name: 'Анис', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Горчица', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Имбирь', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Конопля техническая', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Кориандр', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Лавровый лист', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Лекарственное растительное сырьё', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Лён технический/Лён-долгунец', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Мак', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Мята', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Прядильные культуры', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Сахарный тростник', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Сахарная свекла', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Стевия', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хлопчатник', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хмель', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хрен', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES }
        ]
      },
      {
        name: 'Масличные культуры',
        children: [
          { name: 'Горчица', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Конопля техническая', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кориандр', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Косточки облепихи', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кунжут', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Лён', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Подсолнечник', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рапс', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Расторопша', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Редька масличная', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рыжик', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Сафлор', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Семечки тыквенные', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Соя (соевые бобы)', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Тмин', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Чиа', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Прочее сырьё растительного происхождения',
        children: [
          { name: 'Лекарственные травы, дикоросы', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          {
            name: 'Семена цветов, газонных трав, декоративных культур',
            children: [],
            categoryFeatures: AGRO_RAW_FEATURES
          },
          {
            name: 'Сушёные цветы для кондитерских изделий и чая',
            children: [],
            categoryFeatures: DEFAULT_FEATURES
          }
        ]
      },
      {
        name: 'Семена, посевной материал',
        children: [
          { name: 'Мицелий, грибные блоки', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          {
            name: 'Семена зерновых и зернобобовых культур',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Семена кормовых, силосных и пастбищных трав',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          { name: 'Семена лекарственных растений', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена масличных культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Рассада овощных культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Саженцы деревьев и кустарников', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена бахчевых культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена деревьев и кустарников', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена медоносных растений', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена овощных культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена технических культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          {
            name: 'Семена, рассада и саженцы плодово-ягодных культур',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Семена, рассада, саженцы цветов и декоративных культур',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          }
        ]
      }
    ]
  },
  {
    name: 'С/х техника',
    aliases: ['Сельскохозяйственная техника'],
    iconId: 'Truck',
    children: [
      {
        name: 'Запчасти для сельхозтехники',
        children: [
          { name: 'Двигатели и узлы в сборе (КПП, мосты)', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для животноводческого и фермерского оборудования', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для кормозаготовительной техники', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для опрыскивателей', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для погрузчиков', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для посевной техники', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для почвообрабатывающей техники', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для прочих с/х полевых машин', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для с/х прицепов', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для тракторов', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для уборочной техники', children: [], categoryFeatures: TECH_PARTS }
        ]
      },
      { name: 'Кормозаготовительная техника', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Оборудование для тракторов и с/х транспорта',
        children: [
          { name: 'Бульдозерные отвалы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Грузозахватные механизмы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Грузоподъемное оборудование', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Грунторезы (баровое оборудование)', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Загрузочные шнеки', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Опрыскиватели', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Посевная техника', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Почвообрабатывающая техника',
        children: [
          { name: 'Бороны', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Глубокорыхлители', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Гребнеобразователи', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Камнеподборщики', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Канавокопатели', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Катки', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Комбинированные агрегаты', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Компакторы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Культиваторы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Лущильники', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Машины для формирования парников', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Мульчировщики', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Окучники', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Планировщики почвы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Пленкоукладчики', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Плуги', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Прополочные машины', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Фрезы', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Прицепы и полуприцепы', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для внесения удобрения', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Тракторы сельскохозяйственные', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Уборочная техника',
        children: [
          { name: 'Ботвоудалители', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Жатки', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Измельчитель соломы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Картофелекопатели', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Комбайны', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Лукокопатели', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Агродроны', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Грузовой с/х транспорт',
        children: [
          { name: 'Зерновозы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Кормовозы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Молоковозы', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Сельхозники', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Скотовозы', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Мини-техника, мотокультиваторы, мотоблоки', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Навигационные и контрольные системы', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Погрузчики', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Прочая с/х техника', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для животноводства', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для полива и орошения', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для садоводства', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для хранения зерна в рукавах', children: [], categoryFeatures: TECH_ATTACHED }
    ]
  },
  {
    name: 'Тара и упаковка',
    iconId: 'Box',
    children: [
      { name: 'Пластиковые емкости крупногабаритные', children: [], categoryFeatures: PACKAGING_MATERIAL_FEATURES },
      { name: 'Тара, упаковка', children: [], categoryFeatures: PACKAGING_MATERIAL_FEATURES },
      { name: 'Упаковочные материалы и сырьё', children: [], categoryFeatures: PACKAGING_MATERIAL_FEATURES }
    ]
  },
  {
    name: 'Животное сырьё',
    iconId: 'Shell',
    aliases: ['Сырьё животного происхождения', 'Техническое сырьё'],
    children: [
      { name: 'Натуральные оболочки', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Овечьи шкуры', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Перо, пух', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Шерсть', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Шкуры', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES }
    ]
  },
  {
    name: 'Прочее',
    iconId: 'EqualApproximately',
    children: [
      { name: 'Ангары и каркасно-тентовые конструкции', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
      { name: 'Веники и травы для бани', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
      { name: 'Горюче-смазочные материалы', children: [], categoryFeatures: OTHER_FUEL_FEATURES },
      {
        name: 'Пеллеты, дрова, топливные брикеты, уголь древесный',
        children: [],
        categoryFeatures: OTHER_FUEL_FEATURES
      },
      {
        name: 'Программное обеспечение АПК',
        children: [],
        categoryFeatures: [{ name: 'version', label: 'Версия', type: 'TEXT', filterable: false }]
      },
      { name: 'Прочие с/х товары', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
      { name: 'Различные товары для пищевой промышленности', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
      {
        name: 'Различные товары для сельского хозяйства',
        children: [
          { name: 'Амуниция для лошадей', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Ветеринарные и зоотехнические товары', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Влагомеры', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Кассеты и горшки для рассады', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Комплектующие', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Опрыскиватели садовые ручные', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Органический материал для мульчирования', children: [], categoryFeatures: OTHER_WASTE_FEATURES },
          { name: 'Подстилки для с/х животных', children: [], categoryFeatures: OTHER_WASTE_FEATURES },
          {
            name: 'Полимерные рукава для хранения сельхозпродукции',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          { name: 'Расходные материалы', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Садовый инвентарь', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Сеялки ручные', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Спецодежда', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Средства защиты от насекомых и грызунов', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Укрывной материал, пленка, агроткань', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          {
            name: 'Шпагат и сетка',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES,
            priceUnits: ['RUNNING_METER', 'ITEM']
          }
        ]
      },
      { name: 'С/х отходы и побочные продукты производства', children: [], categoryFeatures: OTHER_WASTE_FEATURES },
      {
        name: 'Книги, документация, аграрные издания',
        children: [],
        categoryFeatures: [{ name: 'author', label: 'Автор/Издательство', type: 'TEXT', filterable: false }]
      }
    ]
  }
] satisfies CategorySeed[]

export const CATEGORIES_DATA: CategoryInput[] = materializeCategories(CATEGORY_TREE)

/** Используйте в тестах/CI; ошибок уровня error после текущих исправлений быть не должно. */
export const CATEGORY_VALIDATION_ISSUES = validateCategories(CATEGORIES_DATA)
