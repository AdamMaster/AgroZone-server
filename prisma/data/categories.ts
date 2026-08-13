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
  { name: 'target_crop', label: 'Культура применения', type: 'TEXT', filterable: false },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
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

const AGRO_SAPLING_FEATURES = [
  { name: 'crop', label: 'Культура/порода', type: 'TEXT', required: true },
  { name: 'variety', label: 'Сорт', type: 'TEXT' },
  { name: 'rootstock', label: 'Подвой', type: 'TEXT', filterable: false },
  { name: 'age', label: 'Возраст саженца', type: 'NUMBER', unit: 'лет' },
  { name: 'height', label: 'Высота', type: 'NUMBER', units: ['см', 'м'] },
  {
    name: 'root_system',
    label: 'Корневая система',
    type: 'SELECT',
    options: ['Открытая (ОКС)', 'Закрытая, в контейнере (ЗКС)', 'С комом земли'],
    required: true
  },
  { name: 'container_volume', label: 'Объём контейнера', type: 'NUMBER', unit: 'л' },
  {
    name: 'planting_season',
    label: 'Сезон посадки',
    type: 'MULTI_SELECT',
    options: ['Весна', 'Осень', 'Круглый год (в контейнере)']
  },
  { name: 'nursery', label: 'Питомник/производитель', type: 'TEXT' },
  { name: 'certificate', label: 'Есть сортовой/карантинный сертификат', type: 'BOOLEAN' },
  { name: 'quantity', label: 'Количество', type: 'NUMBER', unit: 'шт.', min: 1 }
] satisfies CategoryFeatureSeed[]

const OTHER_DEFAULT_FEATURES = [
  { name: 'usage', label: 'Назначение', type: 'TEXT' },
  { name: 'manufacturer', label: 'Производитель/Бренд', type: 'TEXT' }
] satisfies CategoryFeatureSeed[]

const VET_MED_STANDARD = [
  {
    name: 'animal_type',
    label: 'Вид животных',
    type: 'MULTI_SELECT',
    options: ['КРС', 'Свиньи', 'Овцы, козы', 'Лошади', 'Птица', 'Кролики', 'Пчёлы', 'Рыба', 'Универсальный']
  },
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'SELECT',
    options: [
      'Раствор для инъекций',
      'Таблетки',
      'Порошок',
      'Суспензия',
      'Гель/Мазь',
      'Капли',
      'Аэрозоль/Спрей',
      'Болюсы',
      'Премикс',
      'Другое'
    ],
    required: true
  },
  { name: 'active_ingredient', label: 'Действующее вещество', type: 'TEXT', required: true },
  { name: 'dosage', label: 'Дозировка/Способ применения', type: 'TEXT', filterable: false },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  { name: 'registration_number', label: 'Регистрационный номер', type: 'TEXT', filterable: false },
  { name: 'prescription_required', label: 'Отпускается по рецепту', type: 'BOOLEAN' },
  { name: 'expiry_date', label: 'Срок годности', type: 'TEXT', filterable: false },
  {
    name: 'packaging_type',
    label: 'Упаковка/Тара',
    type: 'SELECT',
    options: ['Флакон', 'Ампулы', 'Блистер', 'Пачка/Коробка', 'Канистра', 'Мешок', 'Другое']
  },
  {
    name: 'package_size',
    label: 'Масса/объём/количество упаковки',
    type: 'NUMBER',
    units: ['мл', 'л', 'г', 'кг', 'шт.']
  }
] satisfies CategoryFeatureSeed[]

const REAL_ESTATE_LAND_FEATURES = [
  // Сознательно минимальный набор полей — по образцу Авито (Недвижимость →
  // Земельные участки) и agroserver.ru: обе площадки НЕ структурируют тип
  // почвы, обременения, инфраструктуру, назначение земли отдельными полями,
  // всё остаётся в свободном описании. Тип использования — короткий список
  // по образцу тега у Авито ("10 сот. (ИЖС)"), а не полный официальный
  // классификатор ВРИ (там 60+ пунктов — избыточно для формы объявления).
  { name: 'area', label: 'Площадь', type: 'NUMBER', units: ['Га', 'Сотка', 'м²'], required: true },
  {
    name: 'land_use_type',
    label: 'Тип использования',
    type: 'SELECT',
    options: ['ИЖС', 'ЛПХ', 'КФХ', 'Земли сельхозназначения', 'Садоводство/СНТ', 'Прочее']
  },
  { name: 'deal_type', label: 'Тип сделки', type: 'SELECT', options: ['Продажа', 'Аренда'], required: true },
  { name: 'cadastral_number', label: 'Кадастровый номер', type: 'TEXT', filterable: false }
] satisfies CategoryFeatureSeed[]

const VET_CONSUMABLES_FEATURES = [
  {
    name: 'item_type',
    label: 'Тип товара',
    type: 'SELECT',
    options: ['Шприцы', 'Иглы', 'Катетеры/Канюли', 'Перевязочные материалы', 'Одноразовые перчатки', 'Другое'],
    required: true
  },
  {
    name: 'animal_type',
    label: 'Вид животных',
    type: 'MULTI_SELECT',
    options: ['КРС', 'Свиньи', 'Овцы, козы', 'Лошади', 'Птица', 'Кролики', 'Пчёлы', 'Рыба', 'Универсальный']
  },
  { name: 'size', label: 'Типоразмер/объём', type: 'TEXT' },
  { name: 'manufacturer', label: 'Производитель', type: 'TEXT' },
  {
    name: 'packaging_type',
    label: 'Упаковка',
    type: 'SELECT',
    options: ['Поштучно', 'Упаковка', 'Коробка', 'Блок']
  },
  { name: 'quantity_per_pack', label: 'Количество в упаковке', type: 'NUMBER', unit: 'шт.' }
] satisfies CategoryFeatureSeed[]

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
  [AGRO_SAPLING_FEATURES, ['ITEM']],
  [OTHER_DEFAULT_FEATURES, ['ITEM']],
  [VET_MED_STANDARD, ['ITEM', 'DOSE', 'KG', 'LITER']],
  [VET_CONSUMABLES_FEATURES, ['ITEM', 'BAG']]
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
    id: 'cat_0jo0tv4',
    iconId: 'FlaskConical',
    children: [
      { name: 'Биопрепараты', id: 'cat_0hcxiwr', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Грунты', id: 'cat_11h0ntu', children: [], categoryFeatures: AGRO_SOIL_FEATURES },
      { name: 'Микроудобрения', id: 'cat_1dmwsqf', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Минеральные удобрения', id: 'cat_06jcd9j', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      {
        name: 'Моющие и дезинфицирующие средства',
        id: 'cat_134mucl',
        children: [],
        categoryFeatures: AGRO_CLEAN_FEATURES
      },
      { name: 'Органические удобрения', id: 'cat_1hrek7v', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Органоминеральные удобрения', id: 'cat_0070v9p', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Регуляторы роста', id: 'cat_0inw257', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Дезинсекция и дератизация', id: 'cat_0mx0jqn', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Средства защиты растений', id: 'cat_0jjjycq', children: [], categoryFeatures: AGRO_CHEM_STANDARD }
    ]
  },
  {
    name: 'С/х животные и птица',
    id: 'cat_157gz92',
    aliases: ['Сельскохозяйственные животные, птица и аквакультура', 'Сельхозживотные'],
    iconId: 'Bird',
    children: [
      { name: 'Крупный рогатый скот (КРС)', id: 'cat_0v9u8md', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Свиньи', id: 'cat_1ir8arw', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Овцы и бараны', id: 'cat_085p4hk', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Козы', id: 'cat_1iv91fq', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Лошади', id: 'cat_08jlumt', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Сельхозптица', id: 'cat_1cf6mzs', children: [], categoryFeatures: POULTRY_FEATURES },
      { name: 'Кролики', id: 'cat_1rlh4fd', children: [], categoryFeatures: ANIMAL_FEATURES },
      {
        name: 'Пчёлы, пчелосемьи и пчеломатки',
        id: 'cat_1jwshhn',
        aliases: ['Пчеловодство', 'Пчелопакеты', 'Пчеломатки'],
        children: [],
        categoryFeatures: BEES_FEATURES
      },
      { name: 'Рыбопосадочный материал и малёк', id: 'cat_11uo9em', children: [], categoryFeatures: FISH_FEATURES },
      {
        name: 'Другие сельскохозяйственные животные',
        id: 'cat_026yvmi',
        aliases: ['Другие с/х животные'],
        children: [],
        categoryFeatures: ANIMAL_FEATURES
      }
    ]
  },
  {
    name: 'Ветеринария',
    id: 'cat_1rb9vs9',
    aliases: ['Ветпрепараты', 'Ветеринарные препараты', 'Зоотовары'],
    iconId: 'Syringe',
    children: [
      { name: 'Вакцины', id: 'cat_1ns3f59', children: [], categoryFeatures: VET_MED_STANDARD },
      {
        name: 'Антибиотики и противомикробные препараты',
        id: 'cat_1ohcyxo',
        children: [],
        categoryFeatures: VET_MED_STANDARD
      },
      { name: 'Антипаразитарные средства', id: 'cat_0ep3uii', children: [], categoryFeatures: VET_MED_STANDARD },
      {
        name: 'Витамины, минералы и лечебные добавки',
        id: 'cat_072wci4',
        children: [],
        categoryFeatures: VET_MED_STANDARD
      },
      {
        name: 'Гормональные и репродуктивные препараты',
        id: 'cat_1yuqgbv',
        children: [],
        categoryFeatures: VET_MED_STANDARD
      },
      {
        name: 'Обезболивающие и противовоспалительные',
        id: 'cat_0tozcu1',
        children: [],
        categoryFeatures: VET_MED_STANDARD
      },
      {
        name: 'Дезинфицирующие средства для животноводческих помещений',
        id: 'cat_1br1ual',
        children: [],
        categoryFeatures: AGRO_CLEAN_FEATURES
      },
      {
        name: 'Инфузионные растворы и препараты для инъекций',
        id: 'cat_1ed4ocz',
        children: [],
        categoryFeatures: VET_MED_STANDARD
      },
      {
        name: 'Расходные материалы',
        id: 'cat_0gbvkad',
        aliases: ['Ветеринарные расходные материалы'],
        children: [],
        categoryFeatures: VET_CONSUMABLES_FEATURES
      },
      { name: 'Прочие ветпрепараты', id: 'cat_0ya7zj7', children: [], categoryFeatures: VET_MED_STANDARD }
    ]
  },
  {
    name: 'Корма и компоненты',
    id: 'cat_16k707o',
    aliases: ['Корма и кормовые компоненты', 'Корма для животных'],
    iconId: 'Wheat',
    children: [
      {
        name: 'Готовые корма и комбикорма',
        id: 'cat_0mlwoim',
        children: [
          { name: 'Комбикорма, зерносмеси', id: 'cat_09ifvxj', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Корма для рыб', id: 'cat_11bu5s2', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          {
            name: 'Корма для кошек и собак',
            id: 'cat_117k4fl',
            aliases: ['Корма для кошек, собак'],
            children: [],
            categoryFeatures: ANIMAL_FEED_EXTENDED
          },
          { name: 'Корма экструдированные', id: 'cat_01prdg7', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Жидкие корма', id: 'cat_1q6sgf3', children: [], categoryFeatures: FEED_LIQUID_FEATURES },
          { name: 'Заменители цельного молока', id: 'cat_0zyqqke', children: [], categoryFeatures: FEED_HIGH_PROTEIN }
        ]
      },
      {
        name: 'Кормовое сырьё',
        id: 'cat_17jgwuw',
        children: [
          { name: 'Барда, пивная дробина', id: 'cat_14t1224', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Жмых, шрот, жом, патока', id: 'cat_0duhpr9', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Зерно фуражное', id: 'cat_1x4xjf6', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Отруби', id: 'cat_0f6lqia', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Сено, солома, силос', id: 'cat_143qdak', children: [], categoryFeatures: FEED_BULK_FEATURES },
          { name: 'Кормовые корнеплоды', id: 'cat_1pcg4ux', children: [], categoryFeatures: FEED_BULK_FEATURES },
          {
            name: 'Некондиционные продукты на корм',
            id: 'cat_1qg7msh',
            children: [],
            categoryFeatures: FEED_HIGH_PROTEIN
          }
        ]
      },
      {
        name: 'Белковые и минеральные компоненты',
        id: 'cat_13rm8mq',
        children: [
          { name: 'Мука мясокостная', id: 'cat_1z009fa', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука кровяная', id: 'cat_1lrofi2', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука мясная', id: 'cat_1xl6lxz', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука перьевая', id: 'cat_1yq33bb', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука рыбная', id: 'cat_10pqfdj', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Мука травяная', id: 'cat_1p0fsng', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Кормовые дрожжи', id: 'cat_09ppzhy', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
          { name: 'Соль кормовая', id: 'cat_1lr8gh5', children: [], categoryFeatures: FEED_ADDITIVES }
        ]
      },
      {
        name: 'Добавки, премиксы и пробиотики',
        id: 'cat_1efebmd',
        children: [
          { name: 'Кормовые добавки', id: 'cat_1wltahs', children: [], categoryFeatures: FEED_ADDITIVES },
          { name: 'Ингредиенты для кормов', id: 'cat_1xb66p1', children: [], categoryFeatures: FEED_ADDITIVES },
          { name: 'Пробиотики', id: 'cat_0arml3x', children: [], categoryFeatures: FEED_ADDITIVES }
        ]
      },
      {
        name: 'Силосование и консервация кормов',
        id: 'cat_12jo06z',
        children: [
          {
            name: 'Средства для силосования',
            id: 'cat_1btmuyl',
            aliases: ['Для силосования'],
            children: [],
            categoryFeatures: ENSILAGE_FEATURES
          }
        ]
      },
      { name: 'Прочие корма', id: 'cat_02cax95', children: [], categoryFeatures: FEED_HIGH_PROTEIN }
    ]
  },
  {
    name: 'Оборудование',
    id: 'cat_0x5sbm5',
    iconId: 'Wrench',
    children: [
      {
        name: 'Зерноперерабатывающее оборудование',
        id: 'cat_0x86zdo',
        children: [
          { name: 'Зерноочистительное оборудование', id: 'cat_1267uqj', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Зернопогрузчики, зернометатели', id: 'cat_10krk0k', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Зерносушильное оборудование (зерносушилки)',
            id: 'cat_0elmm51',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Зернотранспортное оборудование', id: 'cat_0ui9gha', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Мукомольно-крупяное оборудование', id: 'cat_1mbj7xv', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Оборудование для анализа качества зерна',
            id: 'cat_0dng2e9',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Оборудование для хранения зерна', id: 'cat_0gzuj5c', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', id: 'cat_1jz7zio', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Компрессорное и насосное оборудование', id: 'cat_01kjjy8', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Мясоперерабатывающее оборудование',
        id: 'cat_0tav5xh',
        children: [
          { name: 'Блокорезки', id: 'cat_0y1qast', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Волчки', id: 'cat_01slc9x', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти и расходные материалы', id: 'cat_0eih9mn', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Инъекторы', id: 'cat_1g91g7y', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Клипсаторы, перекрутчики', id: 'cat_1ydvho6', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Коптильни, термокамеры, рамы', id: 'cat_1uc0x7u', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Котлетные автоматы', id: 'cat_0w4cuil', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Куттеры', id: 'cat_0xqgnvw', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Линии для разделки птицы', id: 'cat_1bgvfo0', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Льдогенераторы', id: 'cat_17yyow7', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Массажеры', id: 'cat_1d4v36l', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машины для нарезки', id: 'cat_1b0lihu', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Модульные мясные цеха и мини-заводы',
            id: 'cat_1l1k0gz',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Мясорубки', id: 'cat_1d4355v', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для обработки субпродуктов', id: 'cat_194lfiq', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Оборудование для убоя', id: 'cat_06w3w5i', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пельменные аппараты', id: 'cat_0h1ffrc', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пилы для разделки мяса', id: 'cat_05z4pkp', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Подвесные пути, подъемники', id: 'cat_07m0ruc', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пресса механической обвалки', id: 'cat_1sexpcc', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее мясное оборудование', id: 'cat_1a7nuhh', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Станки для заточки ножей', id: 'cat_0kbjl9i', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тендерайзеры', id: 'cat_1sd6hae', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Фаршемешалки', id: 'cat_1dud0mi', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Шкуросъемные машины', id: 'cat_07v3byp', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Шпигорезки', id: 'cat_0s43lgl', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для животноводства',
        id: 'cat_0uz0tc7',
        children: [
          { name: 'Весы для взвешивания животных', id: 'cat_1191s81', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Ветеринарное оборудование', id: 'cat_1ftnokg', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Доильное оборудование', id: 'cat_1alnvl2', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Домики и загоны для телят', id: 'cat_11ts7p2', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Клеточное оборудование', id: 'cat_03bes0m', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Климатическое оборудование', id: 'cat_0vtvho0', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машинки для стрижки животных', id: 'cat_1k5p77u', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Навозоуборочное оборудование', id: 'cat_02tyi9c', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для кормления и поения', id: 'cat_11jlvst', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Стойловое оборудование', id: 'cat_0c2hm81', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Электропастухи', id: 'cat_0e9ofo8', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для молочной промышленности',
        id: 'cat_0ycv4g4',
        children: [
          { name: 'Емкости для приемки и хранения', id: 'cat_07upmmt', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Заквасочники', id: 'cat_189rqva', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти и комплектующие', id: 'cat_0bl67li', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Модульные молочные заводы', id: 'cat_0y05s1q', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Насосы пищевые молочные', id: 'cat_18vyzj0', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сгущенного молока', id: 'cat_1dt8ytu', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для производства сливочного масла и спредов',
            id: 'cat_1anp28z',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Для производства сухого молока', id: 'cat_1uw6sz0', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сыра', id: 'cat_11ynejx', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства творога', id: 'cat_0ey4jas', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Пастеризаторы и охладители', id: 'cat_0a8y9i9', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Прочее молокоперерабатывающее оборудование',
            id: 'cat_10f1jhx',
            children: [],
            categoryFeatures: EQUIP_BASE
          }
        ]
      },
      {
        name: 'Для переработки овощей, фруктов, ягод',
        id: 'cat_1erlpm1',
        children: [
          { name: 'Линии для предпродажной подготовки', id: 'cat_18ge3po', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для варки, выпаривания, бланширования',
            id: 'cat_1hqghlm',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Оборудование для консервирования', id: 'cat_1utns82', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для мойки и подготовки', id: 'cat_17g4c08', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства паст, соков, пюре', id: 'cat_1ogpl89', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для производства сахара', id: 'cat_0fxxpa8', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для разделки, нарезки, шинковки', id: 'cat_034m69i', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для сушки', id: 'cat_1py0jwb', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Протирочные машины', id: 'cat_16ltrb4', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', id: 'cat_0rhhrtt', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Сортировщики и калибровщики', id: 'cat_0zu5fza', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Столы переборочные', id: 'cat_182p1as', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Для производства кормов', id: 'cat_1ycnt1w', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Для производства продуктов питания',
        id: 'cat_0ktt4hr',
        children: [
          { name: 'Варочно-жарочное оборудование', id: 'cat_0fs9lsp', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для консервирования продуктов', id: 'cat_11hr5jk', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для масложирового производства', id: 'cat_1rhv2yj', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для переработки рыбы и морепродуктов',
            id: 'cat_0eb709l',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Для переработки яиц', id: 'cat_0odmz9w', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для производства безалкогольных напитков',
            id: 'cat_1mp7g8x',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          {
            name: 'Для производства готовых завтраков, чипсов, снеков',
            id: 'cat_0kqwsxu',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          {
            name: 'Для производства соусов, майонеза, кетчупов',
            id: 'cat_0wlyeyf',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Для производства чая', id: 'cat_0du9n3i', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'По переработке зерновых продуктов', id: 'cat_16j86si', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'По переработке орехов, семечек', id: 'cat_0njy3v4', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Для растениеводства',
        id: 'cat_0c53ce6',
        children: [
          { name: 'Климатические шкафы', id: 'cat_0nyy37c', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Лабораторное оборудование', id: 'cat_03ktlcu', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машины семяочистительные', id: 'cat_02jwrte', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для гидропоники', id: 'cat_0xdrt3j', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для грибоводства', id: 'cat_1184h15', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для контроля окружающей среды', id: 'cat_1xmfsme', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для полива и орошения', id: 'cat_1nbzrfh', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для приготовления растворов удобрений',
            id: 'cat_1b636p0',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Для садоводства', id: 'cat_0bqr2ii', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для цветоводства', id: 'cat_0iub1be', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Посадочное оборудование', id: 'cat_0iuv3rx', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Протравливатели семян', id: 'cat_0l4y9fa', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Теплицы', id: 'cat_1g26x1i', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      {
        name: 'Хлебопекарное и кондитерское оборудование',
        id: 'cat_12s9vc7',
        children: [
          {
            name: 'Глазировочные, дражировочные машины',
            id: 'cat_1fh5hzy',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          {
            name: 'Дозаторы начинок, шприцы, депозиторы',
            id: 'cat_0krmpy0',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Запчасти для оборудования', id: 'cat_0mfcatl', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Миксеры, кремовзбивальные машины', id: 'cat_1x93cct', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Мукопросеиватели', id: 'cat_0agu2j9', children: [], categoryFeatures: EQUIP_BASE },
          {
            name: 'Для производства макаронных изделий',
            id: 'cat_0cwgfo0',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Отсадочные машины', id: 'cat_08k2y1g', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Печи хлебопекарные', id: 'cat_179b77p', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Прочее оборудование', id: 'cat_12w7jpn', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестоделительные машины', id: 'cat_0oxatmy', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестозакаточные, формующие машины', id: 'cat_1u71jrb', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестомесильные машины', id: 'cat_1x3aisl', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестоокруглительные машины', id: 'cat_0lcz0eh', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Тестораскатывающие машины', id: 'cat_1q6vhr7', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Весоизмерительное', id: 'cat_1sg54nb', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Емкостное', id: 'cat_0dgu93v', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Моечное и санитарно-гигиеническое', id: 'cat_1878n6b', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для переработки с/х отходов', id: 'cat_0shylhr', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для птицеводства', id: 'cat_1kh028g', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Для пчеловодства',
        id: 'cat_19kor32',
        children: [
          { name: 'Ульи и комплектующие', id: 'cat_1qktnpu', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          {
            name: 'Медогонки и оборудование для переработки мёда',
            id: 'cat_1h00i18',
            children: [],
            categoryFeatures: EQUIP_BASE
          },
          { name: 'Прочее оборудование', id: 'cat_13jzr1i', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Для рыбоводства', id: 'cat_0bjuehy', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для складов и хранилищ', id: 'cat_0vq6l83', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Сушильное', id: 'cat_1qiw8t4', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Холодильное', id: 'cat_1ra8dd6', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Маркировочное и этикетировочное оборудование',
        id: 'cat_1sr462l',
        children: [],
        categoryFeatures: EQUIP_BASE
      },
      { name: 'Оборудование для производства упаковки', id: 'cat_1aoame0', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Упаковочное и фасовочное оборудование', id: 'cat_1wez252', children: [], categoryFeatures: EQUIP_BASE }
    ]
  },
  {
    name: 'Продукты переработки',
    id: 'cat_0o7ofkm',
    iconId: 'Factory',
    children: [
      { name: 'Замороженные овощи и фрукты', id: 'cat_0x8n8vv', children: [], categoryFeatures: FOOD_BASE },
      {
        name: 'Консервированные продукты',
        id: 'cat_18kkn2q',
        children: [
          {
            name: 'Грибы солёные, солено-отварные, маринованные',
            id: 'cat_0wt0wvk',
            children: [],
            categoryFeatures: FOOD_CANNED
          },
          { name: 'Консервы молочные', id: 'cat_1dkw97f', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы мясные', id: 'cat_0zlshpz', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы мясорастительные', id: 'cat_1co2low', children: [], categoryFeatures: FOOD_CANNED },
          {
            name: 'Консервы овощные, соления, квашения',
            id: 'cat_0brh0fo',
            children: [],
            categoryFeatures: FOOD_CANNED
          },
          { name: 'Консервы рыбные', id: 'cat_0of1v0n', children: [], categoryFeatures: FOOD_CANNED },
          { name: 'Консервы фруктово-ягодные', id: 'cat_11q3g5j', children: [], categoryFeatures: FOOD_CANNED }
        ]
      },
      {
        name: 'Крупы и бобовые',
        id: 'cat_0r4735v',
        children: [
          { name: 'Булгур, кускус', id: 'cat_18tizcm', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Горох сушеный (целый, колотый)', id: 'cat_087tdjx', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа гречневая', id: 'cat_0s0ief1', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа киноа', id: 'cat_0v7zcm6', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа кукурузная', id: 'cat_1szm2cr', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа манная', id: 'cat_0iggkc0', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа овсяная', id: 'cat_0lono8j', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа перловая', id: 'cat_1kv4x1v', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа полбяная', id: 'cat_1xoh8pf', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа пшеничная', id: 'cat_1tgp0pb', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа пшенная', id: 'cat_1hc3150', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа рисовая', id: 'cat_0fmctmz', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Крупа ячневая', id: 'cat_07w3fse', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Хлопья овсяные и зерновые', id: 'cat_055rfhx', children: [], categoryFeatures: FOOD_GROCERY },
          {
            name: 'Прочие бобовые (чечевица, фасоль, нут, маш)',
            id: 'cat_0051qg3',
            children: [],
            categoryFeatures: FOOD_GROCERY
          }
        ]
      },
      { name: 'Масложировая продукция', id: 'cat_1ht4nyi', children: [], categoryFeatures: FOOD_READY },
      {
        name: 'Молочные продукты',
        id: 'cat_1f8acr3',
        children: [
          { name: 'Йогурт', id: 'cat_06foxzk', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кефир', id: 'cat_0drchyi', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кумыс', id: 'cat_1y1qsok', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кисломолочные продукты', id: 'cat_0b5yn8d', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Масло сливочное, пасты масляные', id: 'cat_01my04p', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молоко', id: 'cat_1oeu6m8', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные десерты', id: 'cat_1ne5hw4', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные коктейли', id: 'cat_0lrz5kh', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочные продукты для детей', id: 'cat_1tkrst4', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочный белок', id: 'cat_1jg2vhr', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Молочный жир', id: 'cat_1np298a', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Мороженое', id: 'cat_0xckxgk', children: [], categoryFeatures: FOOD_DAIRY },
          {
            name: 'Растительные заменители пищевого молока и сливок',
            id: 'cat_1cipgrd',
            children: [],
            categoryFeatures: FOOD_DAIRY
          },
          { name: 'Ряженка', id: 'cat_19wp3hc', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сгущенное молоко', id: 'cat_19e3ji8', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сливки', id: 'cat_0uqhci7', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сметана', id: 'cat_1e4irry', children: [], categoryFeatures: FOOD_DAIRY },
          {
            name: 'Сухое молоко, сухие натуральные сливки',
            id: 'cat_1hm2hlm',
            children: [],
            categoryFeatures: FOOD_DAIRY
          },
          { name: 'Сыворотка', id: 'cat_0101aov', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Сыры', id: 'cat_0ka7lyq', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Творог и творожные изделия', id: 'cat_1a45kl1', children: [], categoryFeatures: FOOD_DAIRY }
        ]
      },
      {
        name: 'Мясо и мясные продукты',
        id: 'cat_1lieiao',
        children: [
          { name: 'Баранина', id: 'cat_0bdia8v', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Говядина', id: 'cat_0q9u2f9', children: [], categoryFeatures: FOOD_MEAT },
          {
            name: 'Готовые мясные продукты, полуфабрикаты',
            id: 'cat_094vcd8',
            children: [],
            categoryFeatures: FOOD_MEAT
          },
          { name: 'Козлятина', id: 'cat_0x49d8a', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Конина', id: 'cat_02e2546', children: [], categoryFeatures: FOOD_MEAT },
          {
            name: 'Колбасные изделия и мясные деликатесы',
            id: 'cat_0jsk680',
            children: [],
            categoryFeatures: FOOD_MEAT
          },
          { name: 'Кролик', id: 'cat_0mqnt59', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Птица', id: 'cat_11py8cf', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Свинина', id: 'cat_1d60fe7', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Субпродукты', id: 'cat_0o4wq56', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Сырое сало (шпик), жир-сырец', id: 'cat_171xb33', children: [], categoryFeatures: FOOD_MEAT },
          { name: 'Фарш', id: 'cat_0ehvtia', children: [], categoryFeatures: FOOD_MEAT }
        ]
      },
      { name: 'Пряности, специи, приправы', id: 'cat_14gaaqi', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Сушёные овощи, фрукты, сухофрукты', id: 'cat_0ilnm76', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Чай, кофе, какао-напитки', id: 'cat_02ejdeq', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Экстракты растительные пищевые', id: 'cat_07ii45g', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Безалкогольные напитки, соки, воды', id: 'cat_14kwtft', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Изоляты, текстураты, соевые белки', id: 'cat_1usdrs9', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Какао-порошок, какао-бобы, кэроб', id: 'cat_1kzzueq', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Кондитерские изделия', id: 'cat_0bqao0g', children: [], categoryFeatures: FOOD_READY },
      { name: 'Крахмало-паточная продукция, сиропы', id: 'cat_1k63nfz', children: [], categoryFeatures: FOOD_BASE },
      { name: 'Макаронные изделия', id: 'cat_06yp324', children: [], categoryFeatures: FOOD_GROCERY },
      {
        name: 'Мука',
        id: 'cat_1ptgrij',
        children: [
          { name: 'Мука амарантовая', id: 'cat_1adlv1e', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука гороховая', id: 'cat_1yt9573', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука грецкого ореха', id: 'cat_0g9wash', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука гречневая', id: 'cat_1tdbef4', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука из зародышей пшеницы', id: 'cat_14eczyn', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука кукурузная', id: 'cat_0szarc0', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука кунжутная', id: 'cat_0eennb1', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука льняная', id: 'cat_0teogk7', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука нутовая', id: 'cat_1b4cf2f', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука овсяная', id: 'cat_1o32j72', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука ореховая', id: 'cat_1qmtwtp', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука полбяная', id: 'cat_1gio414', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука пшеничная', id: 'cat_0d5ibu6', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука расторопши', id: 'cat_1cxc1va', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука ржаная', id: 'cat_1bbdsio', children: [], categoryFeatures: FOOD_GROCERY },
          { name: 'Мука рисовая', id: 'cat_0xfj7be', children: [], categoryFeatures: FOOD_GROCERY }
        ]
      },
      { name: 'Пасты, пюре', id: 'cat_1tb9kij', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Продукты быстрого приготовления', id: 'cat_1by04ct', children: [], categoryFeatures: FOOD_READY },
      { name: 'Прочая пищевая продукция', id: 'cat_131epti', children: [], categoryFeatures: FOOD_READY },
      {
        name: 'Рыба и морепродукты',
        id: 'cat_0cw9tgq',
        children: [
          {
            name: 'Готовые рыбные продукты и полуфабрикаты',
            id: 'cat_060tjc4',
            children: [],
            categoryFeatures: FOOD_FISH
          },
          { name: 'Икра рыбы', id: 'cat_09vzt23', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Моллюски и ракообразные', id: 'cat_1127w0o', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Морская капуста, водоросли', id: 'cat_1xxlijr', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Прочие морепродукты', id: 'cat_13oki8z', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба вяленая, сушеная', id: 'cat_0z3rjq6', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба живая, охлаждённая', id: 'cat_05cprr7', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба копчёная', id: 'cat_00iv7u5', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба свежемороженая', id: 'cat_0eoptbs', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыба соленая', id: 'cat_05ta2xf', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Рыбные субпродукты', id: 'cat_0gqvavb', children: [], categoryFeatures: FOOD_FISH },
          { name: 'Фарш рыбный', id: 'cat_0j5woj7', children: [], categoryFeatures: FOOD_FISH }
        ]
      },
      { name: 'Сахар', id: 'cat_09ly9uo', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Снековая продукция', id: 'cat_1xvbkpn', children: [], categoryFeatures: FOOD_READY },
      { name: 'Солод', id: 'cat_0fg18i2', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Соусы, кетчуп, майонез', id: 'cat_048gjwq', children: [], categoryFeatures: FOOD_CANNED },
      { name: 'Хлебобулочные изделия', id: 'cat_0lqh3en', children: [], categoryFeatures: FOOD_READY },
      { name: 'Яичный порошок, меланж', id: 'cat_1c60ue9', children: [], categoryFeatures: FOOD_GROCERY }
    ]
  },
  {
    name: 'Свежая сельхозпродукция',
    id: 'cat_052ud0i',
    aliases: ['Продукты питания', 'Свежие продукты'],
    iconId: 'Apple',
    children: [
      { name: 'Грибы пищевые', id: 'cat_0o79fu8', children: [], categoryFeatures: AGRO_MUSHROOM_FEATURES },
      {
        name: 'Зелень, салатные культуры, травы',
        id: 'cat_0fffom1',
        children: [
          { name: 'Базилик', id: 'cat_1w3gz06', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Кинза', id: 'cat_1rkp3fl', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Лук зелёный (перо)', id: 'cat_1j97q8l', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Микрозелень', id: 'cat_0lx6sh6', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Петрушка', id: 'cat_1hiolyq', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Рукола', id: 'cat_1z0c8kn', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Салат листовой', id: 'cat_0lifuwk', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Укроп', id: 'cat_07ue3an', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Шпинат', id: 'cat_0bf43a5', children: [], categoryFeatures: AGRO_GREEN_FEATURES }
        ]
      },
      {
        name: 'Овощи',
        id: 'cat_0mbqycj',
        children: [
          { name: 'Баклажаны', id: 'cat_01smflp', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Батат', id: 'cat_0er2qyi', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Кабачки', id: 'cat_1qxozdn', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Капуста белокочанная', id: 'cat_1429kfn', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Капуста пекинская', id: 'cat_01ytrgz', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          {
            name: 'Капуста цветная и брокколи',
            id: 'cat_10pzif3',
            children: [],
            categoryFeatures: AGRO_FRESH_FEATURES
          },
          { name: 'Картофель', id: 'cat_1gs2dw7', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лук репчатый', id: 'cat_1mqk3yg', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Морковь', id: 'cat_1lcfzd9', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Огурцы', id: 'cat_1enxy04', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Пастернак', id: 'cat_1qm3omj', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Перец болгарский', id: 'cat_0pq66uz', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Перец острый', id: 'cat_1i4au99', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Помидоры', id: 'cat_0e3pwnl', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ревень', id: 'cat_0p30ulk', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Редис', id: 'cat_1gz9nbz', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Редька', id: 'cat_0hjcwky', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сахарная кукуруза', id: 'cat_0mxrdqt', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Свекла столовая', id: 'cat_1allj51', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сельдерей', id: 'cat_0ynb6jx', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Топинамбур', id: 'cat_1bb388h', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Тыква', id: 'cat_1d7wlco', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Фасоль стручковая', id: 'cat_0cq8tv3', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Чеснок', id: 'cat_0mmm80p', children: [], categoryFeatures: AGRO_FRESH_FEATURES }
        ]
      },
      {
        name: 'Орехи и семечки',
        id: 'cat_0zkcdxk',
        children: [
          { name: 'Арахис', id: 'cat_1x0uk0y', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Бразильский орех', id: 'cat_08nn1g3', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Грецкий орех', id: 'cat_03z9m0h', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Каштаны', id: 'cat_1fttldi', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кедровый орех', id: 'cat_05hgenl', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кешью', id: 'cat_1pluf2j', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кокосовый орех', id: 'cat_10y3mbv', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Макадамия', id: 'cat_08pv2h9', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Миндаль', id: 'cat_0lzm79i', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Орех кола', id: 'cat_1yhtjhd', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Пекан', id: 'cat_0g1jdhz', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Семена тыквы', id: 'cat_0zjfh26', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фисташки', id: 'cat_1xe0vwj', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фундук', id: 'cat_0skf4n3', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Прочие орехи', id: 'cat_12m32pd', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Фрукты, ягоды',
        id: 'cat_1mzwnm3',
        children: [
          { name: 'Абрикосы', id: 'cat_01wc55w', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Авокадо', id: 'cat_1f4un0x', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Айва', id: 'cat_1ktn8ye', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Алыча', id: 'cat_1wy16hw', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ананасы', id: 'cat_0ovomul', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Апельсины', id: 'cat_1jjy8kv', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Арбузы', id: 'cat_1ni48fx', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Бананы', id: 'cat_0wlt41f', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Барбарис', id: 'cat_1q5sz7y', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Боярышник', id: 'cat_1eko779', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Брусника', id: 'cat_1if0qad', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Виноград', id: 'cat_1c33ry5', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Вишня', id: 'cat_11n1hyr', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Годжи', id: 'cat_1wstkzs', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Голубика', id: 'cat_1d340an', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Гранат', id: 'cat_1g5jlwx', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Грейпфрут', id: 'cat_0o22lqq', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Груши', id: 'cat_0a7lc3x', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Гуава', id: 'cat_1pdr19p', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Дыни', id: 'cat_0gj915n', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ежевика', id: 'cat_1tubs67', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Жимолость', id: 'cat_02b7j0v', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Земляника', id: 'cat_12x1fms', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Инжир', id: 'cat_1xtfm9m', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Ирга', id: 'cat_1djpfn8', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Калина', id: 'cat_1e10bar', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Киви', id: 'cat_0id5rdb', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Клубника', id: 'cat_18z6b5v', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Клюква', id: 'cat_0xo56oe', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Крыжовник', id: 'cat_1q6gint', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лайм', id: 'cat_0mf8ojt', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Лимоны', id: 'cat_0uyalki', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Малина', id: 'cat_1q1rjvp', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Манго', id: 'cat_0owq1vz', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Мандарины', id: 'cat_13ohhf2', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Маракуйя', id: 'cat_0ujoi0s', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Можжевеловая ягода', id: 'cat_1tmpvkf', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Морошка', id: 'cat_06wz08b', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Нектарины', id: 'cat_0s8p3fv', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Персики', id: 'cat_12puq3i', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Облепиха', id: 'cat_0gtgnpg', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Папайя', id: 'cat_14sbsfb', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Помело', id: 'cat_1iqef8k', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Рябина', id: 'cat_0fbfqwy', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Сливы', id: 'cat_162jwym', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Смородина', id: 'cat_0ylz32v', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Фейхоа', id: 'cat_0mvfn1k', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Финики', id: 'cat_12eamms', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Хурма', id: 'cat_0dv6489', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черёмуха', id: 'cat_0w7j6zo', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черешня', id: 'cat_0na35xk', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Черника', id: 'cat_1gzl52q', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Шиповник', id: 'cat_0r78pv1', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Экзотические фрукты', id: 'cat_19q2o4r', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
          { name: 'Яблоки', id: 'cat_0tie794', children: [], categoryFeatures: AGRO_FRESH_FEATURES }
        ]
      },
      {
        name: 'Яйцо',
        id: 'cat_1qdd6co',
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
        id: 'cat_0cucvez',
        children: [
          {
            name: 'Мёд натуральный (монофлорный, полифлорный)',
            id: 'cat_1gle48u',
            children: [],
            categoryFeatures: AGRO_HONEY_FEATURES
          },
          { name: 'Мёд в сотах', id: 'cat_09mvioa', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Перга, пыльца (обножка)', id: 'cat_0jp7o5w', children: [], categoryFeatures: BEE_PRODUCT_FEATURES },
          { name: 'Прополис', id: 'cat_0ebj1vf', children: [], categoryFeatures: BEE_PRODUCT_FEATURES },
          {
            name: 'Маточное молочко, трутневый гомогенат',
            id: 'cat_10zckab',
            children: [],
            categoryFeatures: BEE_PRODUCT_FEATURES
          },
          { name: 'Воск пчелиный', id: 'cat_18a1tul', children: [], categoryFeatures: BEE_WAX_FEATURES }
        ]
      }
    ]
  },
  {
    name: 'Полевые культуры',
    id: 'cat_08197mo',
    aliases: ['Агрокультуры', 'Сельхозпродукция и растительное сырьё', 'Сельхозсырьё и агрокультуры'],
    iconId: 'Sprout',
    children: [
      {
        name: 'Зерно, зернобобовые',
        id: 'cat_0zw6ple',
        children: [
          { name: 'Бобы', id: 'cat_0siotdf', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Горох', id: 'cat_19zmvje', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Гречиха', id: 'cat_1q43jts', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кукуруза', id: 'cat_0wtf5fu', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Люпин', id: 'cat_03zxral', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Маш', id: 'cat_0kgy49w', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Нут', id: 'cat_1csqohe', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Овёс', id: 'cat_0y3g1cm', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Полба', id: 'cat_0ge6nyv', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Просо', id: 'cat_1jhb608', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Пшеница', id: 'cat_1fxba3p', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рожь', id: 'cat_1j1qlb4', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Сорго', id: 'cat_099yfzw', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Соя', id: 'cat_1svp874', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Тритикале', id: 'cat_1vxpbp2', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Фасоль', id: 'cat_1cdkep0', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Чечевица', id: 'cat_16bh5h0', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Ячмень', id: 'cat_1qubdew', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Технические культуры',
        id: 'cat_10as97r',
        children: [
          { name: 'Анис', id: 'cat_1cuzeav', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Горчица', id: 'cat_0r0f6xj', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Имбирь', id: 'cat_1dfd402', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Конопля техническая', id: 'cat_147zcow', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Кориандр', id: 'cat_0gofn04', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Лавровый лист', id: 'cat_1ii9cyu', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          {
            name: 'Лекарственное растительное сырьё',
            id: 'cat_17s3uwa',
            children: [],
            categoryFeatures: AGRO_TECHNICAL_FEATURES
          },
          {
            name: 'Лён технический/Лён-долгунец',
            id: 'cat_1b6n7zd',
            children: [],
            categoryFeatures: AGRO_TECHNICAL_FEATURES
          },
          { name: 'Мак', id: 'cat_1paaixj', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Мята', id: 'cat_0v3ovqc', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Прядильные культуры', id: 'cat_0n0ueux', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Сахарный тростник', id: 'cat_0a19atc', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Сахарная свекла', id: 'cat_1yhcqv8', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Стевия', id: 'cat_0m2khoi', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хлопчатник', id: 'cat_059n8yg', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хмель', id: 'cat_0jvhtay', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
          { name: 'Хрен', id: 'cat_0v59u0s', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES }
        ]
      },
      {
        name: 'Масличные культуры',
        id: 'cat_1tyw4gs',
        children: [
          { name: 'Горчица', id: 'cat_0ojrf90', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Конопля техническая', id: 'cat_1cgy2zr', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кориандр', id: 'cat_02ti52l', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Косточки облепихи', id: 'cat_0ag9mof', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Кунжут', id: 'cat_0liade7', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Лён', id: 'cat_0enceu9', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Подсолнечник', id: 'cat_0u9kbn3', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рапс', id: 'cat_0kefy2i', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Расторопша', id: 'cat_12wbj0c', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Редька масличная', id: 'cat_05lw8vy', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Рыжик', id: 'cat_032ra3t', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Сафлор', id: 'cat_0q0imxw', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Семечки тыквенные', id: 'cat_16ndgam', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Соя (соевые бобы)', id: 'cat_04wtv4g', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Тмин', id: 'cat_1rmmd8j', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Чиа', id: 'cat_02ogivb', children: [], categoryFeatures: AGRO_RAW_FEATURES }
        ]
      },
      {
        name: 'Прочее сырьё растительного происхождения',
        id: 'cat_09gdlc0',
        children: [
          {
            name: 'Лекарственные травы, дикоросы',
            id: 'cat_1wa40zv',
            children: [],
            categoryFeatures: AGRO_RAW_FEATURES
          },
          {
            name: 'Семена цветов, газонных трав, декоративных культур',
            id: 'cat_19hsc6m',
            children: [],
            categoryFeatures: AGRO_RAW_FEATURES
          },
          {
            name: 'Сушёные цветы для кондитерских изделий и чая',
            id: 'cat_1yj1jmo',
            children: [],
            categoryFeatures: DEFAULT_FEATURES
          }
        ]
      }
    ]
  },
  {
    name: 'Посадочный материал',
    id: 'cat_1vfli2x',
    iconId: 'Leaf',
    children: [
      {
        name: 'Семена, посевной материал',
        id: 'cat_1m6upyf',
        children: [
          { name: 'Мицелий, грибные блоки', id: 'cat_0tbcnmz', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          {
            name: 'Семена зерновых и зернобобовых культур',
            id: 'cat_1rps3f4',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Семена кормовых, силосных и пастбищных трав',
            id: 'cat_1b5c9iq',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Семена лекарственных растений',
            id: 'cat_1q41av5',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          { name: 'Семена масличных культур', id: 'cat_0he395e', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Рассада овощных культур', id: 'cat_1n1tqpe', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена бахчевых культур', id: 'cat_16ttg4a', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          {
            name: 'Семена деревьев и кустарников',
            id: 'cat_0w2yt75',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          { name: 'Семена медоносных растений', id: 'cat_0boimcd', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена овощных культур', id: 'cat_1gzr2wi', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Семена технических культур', id: 'cat_1fh9oor', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          {
            name: 'Семена плодово-ягодных культур',
            id: 'cat_0a49sh6',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Семена, рассада, саженцы цветов и декоративных культур',
            id: 'cat_0l8i3z5',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          }
        ]
      },
      {
        name: 'Саженцы',
        id: 'cat_03nuhy6',
        children: [
          {
            name: 'Саженцы лиственных деревьев',
            id: 'cat_0gv6igf',
            children: [],
            categoryFeatures: AGRO_SAPLING_FEATURES
          },
          { name: 'Саженцы хвойных пород', id: 'cat_0vpd4k4', children: [], categoryFeatures: AGRO_SAPLING_FEATURES },
          {
            name: 'Саженцы лиственных кустарников',
            id: 'cat_1r69b6q',
            children: [],
            categoryFeatures: AGRO_SAPLING_FEATURES
          },
          {
            name: 'Рассада, саженцы плодово-ягодных культур',
            id: 'cat_14y5w5k',
            children: [],
            categoryFeatures: AGRO_SAPLING_FEATURES
          }
        ]
      }
    ]
  },
  {
    name: 'С/х техника',
    id: 'cat_1owojcn',
    aliases: ['Сельскохозяйственная техника'],
    iconId: 'Truck',
    children: [
      {
        name: 'Запчасти для сельхозтехники',
        id: 'cat_0vi787l',
        children: [
          {
            name: 'Двигатели и узлы в сборе (КПП, мосты)',
            id: 'cat_172a5ce',
            children: [],
            categoryFeatures: TECH_PARTS
          },
          {
            name: 'Для животноводческого и фермерского оборудования',
            id: 'cat_1dcmo42',
            children: [],
            categoryFeatures: TECH_PARTS
          },
          { name: 'Для кормозаготовительной техники', id: 'cat_1e7ees6', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для опрыскивателей', id: 'cat_1jmmpvo', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для погрузчиков', id: 'cat_1ve4x6a', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для посевной техники', id: 'cat_1qqlnl7', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для почвообрабатывающей техники', id: 'cat_0qht1fa', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для прочих с/х полевых машин', id: 'cat_0srcn0p', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для с/х прицепов', id: 'cat_09qkr8z', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для тракторов', id: 'cat_0h2r76l', children: [], categoryFeatures: TECH_PARTS },
          { name: 'Для уборочной техники', id: 'cat_1shw3nb', children: [], categoryFeatures: TECH_PARTS }
        ]
      },
      { name: 'Кормозаготовительная техника', id: 'cat_0sd5rk6', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Оборудование для тракторов и с/х транспорта',
        id: 'cat_14d9fwz',
        children: [
          { name: 'Бульдозерные отвалы', id: 'cat_1t320o7', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Грузозахватные механизмы', id: 'cat_1ooogwc', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Грузоподъемное оборудование', id: 'cat_0ordji0', children: [], categoryFeatures: TECH_ATTACHED },
          {
            name: 'Грунторезы (баровое оборудование)',
            id: 'cat_09omyeu',
            children: [],
            categoryFeatures: TECH_ATTACHED
          },
          { name: 'Загрузочные шнеки', id: 'cat_1bqyg7h', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Опрыскиватели', id: 'cat_061bu4i', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Посевная техника', id: 'cat_1hsvyq7', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Почвообрабатывающая техника',
        id: 'cat_0dun2w5',
        children: [
          { name: 'Бороны', id: 'cat_0f3wo5o', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Глубокорыхлители', id: 'cat_1eynrtk', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Гребнеобразователи', id: 'cat_0tk72ui', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Камнеподборщики', id: 'cat_0xat15o', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Канавокопатели', id: 'cat_1opjg7b', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Катки', id: 'cat_19r8oc1', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Комбинированные агрегаты', id: 'cat_0nseq21', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Компакторы', id: 'cat_0etckuv', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Культиваторы', id: 'cat_0qaykr0', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Лущильники', id: 'cat_0qg2a3y', children: [], categoryFeatures: TECH_ATTACHED },
          {
            name: 'Машины для формирования парников',
            id: 'cat_090fq69',
            children: [],
            categoryFeatures: TECH_ATTACHED
          },
          { name: 'Мульчировщики', id: 'cat_0m7gsjb', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Окучники', id: 'cat_114av9s', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Планировщики почвы', id: 'cat_0jkazjm', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Пленкоукладчики', id: 'cat_1emhud8', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Плуги', id: 'cat_0j04nwb', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Прополочные машины', id: 'cat_0ud9fic', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Фрезы', id: 'cat_0ucklcq', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Прицепы и полуприцепы', id: 'cat_06sqbm4', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для внесения удобрения', id: 'cat_1mietyh', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Тракторы сельскохозяйственные', id: 'cat_1a5miey', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Уборочная техника',
        id: 'cat_1le0bdv',
        children: [
          { name: 'Ботвоудалители', id: 'cat_0udqdxa', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Жатки', id: 'cat_1puznjn', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Измельчитель соломы', id: 'cat_0asbpja', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Картофелекопатели', id: 'cat_0kibh0p', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Комбайны', id: 'cat_1xhdsxj', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Лукокопатели', id: 'cat_0e8dp30', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      { name: 'Агродроны', id: 'cat_0wboir6', children: [], categoryFeatures: TECH_ATTACHED },
      {
        name: 'Грузовой с/х транспорт',
        id: 'cat_1i7hdpb',
        children: [
          { name: 'Зерновозы', id: 'cat_0xkh2c8', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Кормовозы', id: 'cat_1ijqwul', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Молоковозы', id: 'cat_09bszjm', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Сельхозники', id: 'cat_0vvlt81', children: [], categoryFeatures: TECH_ATTACHED },
          { name: 'Скотовозы', id: 'cat_03udhbs', children: [], categoryFeatures: TECH_ATTACHED }
        ]
      },
      {
        name: 'Мини-техника, мотокультиваторы, мотоблоки',
        id: 'cat_0rfa6jj',
        children: [],
        categoryFeatures: TECH_ATTACHED
      },
      { name: 'Навигационные и контрольные системы', id: 'cat_1dttw86', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Погрузчики', id: 'cat_1pkkqxu', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Прочая с/х техника', id: 'cat_0x2s13e', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для животноводства', id: 'cat_0p7ecm8', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для полива и орошения', id: 'cat_06fxstz', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для садоводства', id: 'cat_19kg2us', children: [], categoryFeatures: TECH_ATTACHED },
      { name: 'Техника для хранения зерна в рукавах', id: 'cat_1i19yje', children: [], categoryFeatures: TECH_ATTACHED }
    ]
  },
  {
    name: 'Тара и упаковка',
    id: 'cat_0l8ic37',
    iconId: 'Box',
    children: [
      {
        name: 'Пластиковые емкости крупногабаритные',
        id: 'cat_1ucc3cw',
        children: [],
        categoryFeatures: PACKAGING_MATERIAL_FEATURES
      },
      { name: 'Тара, упаковка', id: 'cat_0pwxnvr', children: [], categoryFeatures: PACKAGING_MATERIAL_FEATURES },
      {
        name: 'Упаковочные материалы и сырьё',
        id: 'cat_1bypbd1',
        children: [],
        categoryFeatures: PACKAGING_MATERIAL_FEATURES
      }
    ]
  },
  {
    name: 'Животное сырьё',
    id: 'cat_1fbekco',
    iconId: 'Shell',
    aliases: ['Сырьё животного происхождения', 'Техническое сырьё'],
    children: [
      { name: 'Натуральные оболочки', id: 'cat_187w6vh', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Овечьи шкуры', id: 'cat_1ahqgys', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Перо, пух', id: 'cat_1oz8wnl', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Шерсть', id: 'cat_1hxlpw4', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Шкуры', id: 'cat_0vspqr4', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES }
    ]
  },
  {
    name: 'Прочее',
    id: 'cat_06m2bvv',
    iconId: 'EqualApproximately',
    children: [
      {
        name: 'Ангары и каркасно-тентовые конструкции',
        id: 'cat_03y6e5a',
        children: [],
        categoryFeatures: OTHER_GOODS_FEATURES
      },
      { name: 'Веники и травы для бани', id: 'cat_0htqm0u', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
      { name: 'Горюче-смазочные материалы', id: 'cat_0abat4y', children: [], categoryFeatures: OTHER_FUEL_FEATURES },
      {
        name: 'Пеллеты, дрова, топливные брикеты, уголь древесный',
        id: 'cat_1rcfclg',
        children: [],
        categoryFeatures: OTHER_FUEL_FEATURES
      },
      {
        name: 'Программное обеспечение АПК',
        id: 'cat_0vhvwcn',
        children: [],
        categoryFeatures: [{ name: 'version', label: 'Версия', type: 'TEXT', filterable: false }]
      },
      { name: 'Прочие с/х товары', id: 'cat_001g8zu', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
      {
        name: 'Различные товары для пищевой промышленности',
        id: 'cat_0oyyx0j',
        children: [],
        categoryFeatures: OTHER_DEFAULT_FEATURES
      },
      {
        name: 'Различные товары для сельского хозяйства',
        id: 'cat_1m5cwko',
        children: [
          { name: 'Амуниция для лошадей', id: 'cat_00klv4u', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          {
            name: 'Ветеринарные и зоотехнические товары',
            id: 'cat_1gidzmd',
            children: [],
            categoryFeatures: OTHER_DEFAULT_FEATURES
          },
          { name: 'Влагомеры', id: 'cat_0rh26og', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          {
            name: 'Кассеты и горшки для рассады',
            id: 'cat_1dlnmps',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          { name: 'Комплектующие', id: 'cat_0ez1mzi', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          {
            name: 'Опрыскиватели садовые ручные',
            id: 'cat_0zl07p7',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          {
            name: 'Органический материал для мульчирования',
            id: 'cat_1glk7sd',
            children: [],
            categoryFeatures: OTHER_WASTE_FEATURES
          },
          {
            name: 'Подстилки для с/х животных',
            id: 'cat_11x7isb',
            children: [],
            categoryFeatures: OTHER_WASTE_FEATURES
          },
          {
            name: 'Полимерные рукава для хранения сельхозпродукции',
            id: 'cat_0hpazuf',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          { name: 'Расходные материалы', id: 'cat_0mq29i4', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Садовый инвентарь', id: 'cat_114ijs6', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Сеялки ручные', id: 'cat_0geyn71', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Спецодежда', id: 'cat_0cgu5i4', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          {
            name: 'Средства защиты от насекомых и грызунов',
            id: 'cat_1t05xk2',
            children: [],
            categoryFeatures: OTHER_DEFAULT_FEATURES
          },
          {
            name: 'Укрывной материал, пленка, агроткань',
            id: 'cat_1s0uuw0',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          {
            name: 'Шпагат и сетка',
            id: 'cat_1deh59a',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES,
            priceUnits: ['RUNNING_METER', 'ITEM']
          }
        ]
      },
      {
        name: 'С/х отходы и побочные продукты производства',
        id: 'cat_0ssree4',
        children: [],
        categoryFeatures: OTHER_WASTE_FEATURES
      },
      {
        name: 'Книги, документация, аграрные издания',
        id: 'cat_0dvtic0',
        children: [],
        categoryFeatures: [{ name: 'author', label: 'Автор/Издательство', type: 'TEXT', filterable: false }]
      }
    ]
  },
  {
    // Новая категория верхнего уровня — земля и с/х недвижимость (см.
    // обсуждение: изучили agroserver.ru и Авито "Недвижимость → Земельные
    // участки", обе площадки держат минимум структурированных полей, всё
    // остальное — в описании, см. REAL_ESTATE_LAND_FEATURES выше). Сама
    // вершина — лист (children: []), без подкатегорий: усложнять дерево не
    // имеет смысла при таком скромном наборе полей. priceUnits — явно
    // переопределены (не через DEFAULT_PRICE_UNITS_BY_FEATURES): 'ITEM' для
    // абсолютной цены участка (как у мелких лотов на Авито) и 'HA' для цены
    // за гектар (как у agroserver для крупных с/х наделов) — продавец
    // выбирает нужное при подаче объявления.
    name: 'Земли и объекты с/х недвижимости',
    id: 'cat_0pypyaf',
    aliases: ['Земельные участки', 'Недвижимость', 'Земля'],
    iconId: 'LandPlot',
    children: [],
    categoryFeatures: REAL_ESTATE_LAND_FEATURES,
    priceUnits: ['ITEM', 'HA']
  }
] satisfies CategorySeed[]

export const CATEGORIES_DATA: CategoryInput[] = materializeCategories(CATEGORY_TREE)

/** Используйте в тестах/CI; ошибок уровня error после текущих исправлений быть не должно. */
export const CATEGORY_VALIDATION_ISSUES = validateCategories(CATEGORIES_DATA)
