export type CategoryFeatureInput = {
  name: string
  label: string
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'MULTI_SELECT'
  options?: string[]
  required?: boolean
}

export type CategoryInput = {
  name: string
  iconId?: string
  children?: CategoryInput[]
  categoryFeatures?: CategoryFeatureInput[]
}

const AGRO_CHEM_STANDARD = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'MULTI_SELECT',
    options: ['Жидкая', 'Порошкообразная', 'Гранулированная', 'Гель', 'Таблетки', 'Газ']
  },
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Канистра', 'Еврокуб (IBC)', 'Флакон/Бутылка', 'Мешки', 'Биг-бэг', 'Цистерна/Навалом']
  }
] as CategoryFeatureInput[]

const AGRO_SOIL_FEATURES = [
  {
    name: 'packing',
    label: 'Упаковка/Объем',
    type: 'MULTI_SELECT',
    options: ['Мешки', 'Биг-бэг/Биг-бэйл', 'Навалом/Самосвал']
  }
] as CategoryFeatureInput[]

const AGRO_CLEAN_FEATURES = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'MULTI_SELECT',
    options: ['Жидкая (концентрат)', 'Жидкая (готовый раствор)', 'Порошок', 'Таблетки/Брикеты']
  },
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Флакон/Бутылка', 'Канистра', 'Бочка', 'Еврокуб', 'Мешок/Коробка']
  }
] as CategoryFeatureInput[]

const FEED_HIGH_PROTEIN = [
  {
    name: 'animal_type',
    label: 'Предназначение',
    type: 'MULTI_SELECT',
    options: ['Коровы, быки', 'Овцы, козы', 'Лошади', 'Свиньи', 'Птица', 'Рыба', 'Универсальный']
  },
  {
    name: 'packing',
    label: 'Упаковка',
    type: 'MULTI_SELECT',
    options: ['Мешки', 'Биг-бэг', 'Навалом/Автоцистерна', 'Канистра/Бочка']
  }
] as CategoryFeatureInput[]

const FEED_BULK_FEATURES = [
  {
    name: 'packing',
    label: 'Упаковка/Форма',
    type: 'MULTI_SELECT',
    options: ['Рулоны', 'Тюки', 'Навалом/Кузов', 'В рукаве/Траншея']
  }
] as CategoryFeatureInput[]

const FEED_ADDITIVES = [
  {
    name: 'animal_type',
    label: 'Предназначение',
    type: 'MULTI_SELECT',
    options: ['Коровы, быки', 'Овцы, козы', 'Лошади', 'Свиньи', 'Птица', 'Рыба', 'Универсальный']
  },
  {
    name: 'packing',
    label: 'Упаковка',
    type: 'MULTI_SELECT',
    options: ['Мешки', 'Биг-бэг', 'Блоки/Лизунцы', 'Флаконы/Канистры']
  }
] as CategoryFeatureInput[]

const ENSILAGE_FEATURES = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'MULTI_SELECT',
    options: ['Сухая (порошок/гранулы)', 'Жидкая (концентрат)']
  },
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Канистра/Флакон', 'Пакет/Коробка', 'Ведро']
  }
] as CategoryFeatureInput[]

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
    type: 'MULTI_SELECT',
    options: ['Сухой корм', 'Влажный (паучи, консервы)', 'Лакомства', 'Заменитель молока']
  },
  {
    name: 'age_group',
    label: 'Возраст',
    type: 'MULTI_SELECT',
    options: ['Для котят/щенков', 'Для взрослых', 'Для пожилых', 'Универсальный']
  }
] as CategoryFeatureInput[]

const FEED_LIQUID_FEATURES = [
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Автоцистерна', 'Еврокуб', 'Бочка', 'Канистра', 'Навалом/Налив']
  }
] as CategoryFeatureInput[]

export const EQUIP_BASE = [
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у']
  },
  {
    name: 'year',
    label: 'Год выпуска',
    type: 'NUMBER'
  }
] as CategoryFeatureInput[]

const EQUIP_PARTS = [
  {
    name: 'condition',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Новое', 'Б/у']
  }
] as CategoryFeatureInput[]

const FOOD_GROCERY = [
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: ['Мешок', 'Биг-бэг', 'Пакет/Пачка', 'Коробка', 'Навалом/Бункер']
  },
  {
    name: 'shelf_life',
    label: 'Срок годности (мес)',
    type: 'NUMBER'
  },
  {
    name: 'gost',
    label: 'ГОСТ/ТУ/СТО',
    type: 'TEXT'
  }
] as CategoryFeatureInput[]

const FOOD_DAIRY = [
  { name: 'fat', label: 'Жирность (%)', type: 'NUMBER', placeholder: '%' },
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'Пакет/Тетрапак',
      'Бутылка',
      'Пластиковая тара/Стакан',
      'Фляга/Цистерна',
      'Коробка/Монолит',
      'Вакуум/Пленка',
      'Мешок/Биг-бэг'
    ]
  },
  {
    name: 'shelf_life',
    label: 'Срок годности (мес.)',
    type: 'NUMBER',
    placeholder: 'например, 1'
  },
  { name: 'gost', label: 'ГОСТ/ТУ/СТО', type: 'TEXT', placeholder: 'например, ГОСТ 31450-2013' }
] as CategoryFeatureInput[]

export const FOOD_BASE = [
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: ['Короб', 'Пакет/Мешок', 'Вакуум', 'Лоток/Коррекс', 'Навалом/Монолит']
  },
  {
    name: 'shelf_life',
    label: 'Срок годности (мес.)',
    type: 'NUMBER',
    placeholder: 'например, 12'
  },
  {
    name: 'gost',
    label: 'ГОСТ/ТУ/СТО',
    type: 'TEXT',
    placeholder: 'например, ГОСТ 32125-2013'
  }
] as CategoryFeatureInput[]

export const FOOD_MEAT_FISH = [
  {
    name: 'state',
    label: 'Термическое состояние',
    type: 'SELECT',
    options: ['Охлажденное', 'Замороженное', 'Парное / Живая (для рыбы)', 'Вяленое / Копченое', 'Соленое']
  },
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'В тушах/Полутушах / Четвертинах',
      'Навалом/Монолитный блок',
      'Вакуумная упаковка',
      'Лоток/ГАЗ (МГС)',
      'Короб/Гофрокороб',
      'Пленка/Мешок'
    ]
  },
  {
    name: 'shelf_life',
    label: 'Срок годности (мес.)',
    type: 'NUMBER',
    placeholder: 'например, 12'
  },
  {
    name: 'gost',
    label: 'ГОСТ/ТУ/СТО',
    type: 'TEXT',
    placeholder: 'например, ГОСТ 31777-2012'
  }
] as CategoryFeatureInput[]

export const FOOD_CANNED = [
  {
    name: 'packing',
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
  {
    name: 'shelf_life',
    label: 'Срок годности (мес.)',
    type: 'NUMBER',
    placeholder: 'Например, 24'
  },
  {
    name: 'gost',
    label: 'ГОСТ / ТУ / СТО',
    type: 'TEXT',
    placeholder: 'Например, ГОСТ 32125-2013'
  }
] as CategoryFeatureInput[]

const FOOD_READY = [
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'MULTI_SELECT',
    options: [
      'Пакет/Коробка',
      'Бутылка/Банка',
      'Навалом',
      'Шоу-бокс/Дисплей',
      'Пленка/Флоу-пак',
      'Пластиковое ведро / Контейнер',
      'Пакет / Дой-пак'
    ]
  },
  { name: 'shelf_life', label: 'Срок годности (мес)', type: 'NUMBER' },
  { name: 'gost', label: 'ГОСТ/ТУ', type: 'TEXT' }
] as CategoryFeatureInput[]

export const AGRO_RAW_FEATURES = [
  {
    name: 'packing',
    label: 'Упаковка',
    type: 'MULTI_SELECT',
    options: ['Навалом/Насыпью', 'Биг-бэг', 'Мешки', 'Флекситанк/Цистерна']
  },
  {
    name: 'gost',
    label: 'ГОСТ/ТУ',
    type: 'TEXT'
  }
] as CategoryFeatureInput[]

const AGRO_FRESH_FEATURES = [
  { name: 'caliber', label: 'Калибр / Размер (мм)', type: 'TEXT' },
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Ящики', 'Сетки', 'Коробки', 'Навалом', 'Поддоны']
  }
] as CategoryFeatureInput[]

const AGRO_HONEY_FEATURES = [
  {
    name: 'honey_type',
    label: 'Вид мёда',
    type: 'MULTI_SELECT',
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
  {
    name: 'collection_year',
    label: 'Год сбора',
    type: 'NUMBER'
  },
  {
    name: 'state',
    label: 'Состояние',
    type: 'MULTI_SELECT',
    options: ['Жидкий', 'Кристаллизованный (севший)', 'Крем-мёд']
  },
  {
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Пластиковое ведро', 'Стеклянная банка', 'Фляга/Барабан', 'Куботейнер', 'В сотах (рамка)']
  }
] as CategoryFeatureInput[]

export const AGRO_GREEN_FEATURES = [
  {
    name: 'state',
    label: 'Состояние',
    type: 'SELECT',
    options: ['Свежесрезанная', 'В горшочках (с корневой системой)', 'Замороженная', 'Сушеная']
  },
  {
    name: 'packing',
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
] as CategoryFeatureInput[]

export const AGRO_MUSHROOM_FEATURES = [
  {
    name: 'state',
    label: 'Состояние',
    type: 'MULTI_SELECT',
    options: ['Свежие', 'Замороженные (шоковая заморозка)', 'Сушеные', 'Соленые/Маринованные']
  },
  {
    name: 'origin_type',
    label: 'Происхождение',
    type: 'MULTI_SELECT',
    options: ['Культивируемые (фермерские)', 'Дикорастущие (дикоросы)']
  },
  {
    name: 'packing',
    label: 'Упаковка / Тара',
    type: 'MULTI_SELECT',
    options: [
      'Ящики (дерево / пластик)',
      'Коробки/Картон',
      'Коррекс/Пинетка',
      'Мешки/Пакеты (для сушеных/заморозки)',
      'Бочки/Банки'
    ]
  }
] as CategoryFeatureInput[]

const ANIMAL_FEATURES = [
  { name: 'age', label: 'Возраст (мес)', type: 'NUMBER' },
  { name: 'weight', label: 'Вес (кг)', type: 'NUMBER' },
  { name: 'breed', label: 'Порода', type: 'TEXT' },
  { name: 'vaccination', label: 'Вакцинация', type: 'BOOLEAN' }
] as CategoryFeatureInput[]

export const POULTRY_FEATURES = [
  { name: 'breed', label: 'Порода/Кросс', type: 'TEXT' },
  {
    name: 'purpose',
    label: 'Тип/Назначение',
    type: 'MULTI_SELECT',
    options: ['Суточные цыплята', 'Молодняк/Подрощенные', 'Несушки', 'Бройлеры', 'Инкубационное яйцо']
  },
  { name: 'vaccination', label: 'Вакцинация', type: 'BOOLEAN' }
] as CategoryFeatureInput[]

export const BEES_FEATURES = [
  {
    name: 'breed',
    label: 'Порода пчёл',
    type: 'MULTI_SELECT',
    options: ['Карпатская', 'Карника', 'Среднерусская', 'Бакфаст', 'Кавказская', 'Прочая']
  },
  {
    name: 'item_type',
    label: 'Тип товара',
    type: 'MULTI_SELECT',
    options: ['Пчелопакет', 'Пчелосемья (с ульем)', 'Пчеломатка', 'Рой']
  }
] as CategoryFeatureInput[]

export const FISH_FEATURES = [
  { name: 'fish_species', label: 'Вид рыбы', type: 'TEXT', placeholder: 'Карп, Форель, Осётр...' },
  { name: 'weight_g', label: 'Средняя навеска/вес 1 шт (грамм)', type: 'NUMBER' },
  { name: 'stage', label: 'Стадия', type: 'SELECT', options: ['Икра', 'Личинка', 'Малек', 'Годовик', 'Товарная рыба'] }
] as CategoryFeatureInput[]

const DEFAULT_FEATURES = [
  { name: 'condition', label: 'Состояние/Сорт', type: 'TEXT' },
  { name: 'volume', label: 'Объем партии', type: 'NUMBER' }
] as CategoryFeatureInput[]

const TECH_ATTACHED = [
  { name: 'year', label: 'Год выпуска', type: 'NUMBER' },
  { name: 'condition', label: 'Состояние', type: 'SELECT', options: ['Новое', 'Б/у'] }
] as CategoryFeatureInput[]

const TECH_PARTS = [
  { name: 'condition', label: 'Состояние', type: 'SELECT', options: ['Новое', 'Б/у'] }
] as CategoryFeatureInput[]

const PACKAGING_MATERIAL_FEATURES = [
  {
    name: 'material',
    label: 'Материал',
    type: 'SELECT',
    options: ['Пластик', 'Полиэтилен/Пленка', 'Бумага/Картон', 'Дерево', 'Стекло', 'Металл', 'Ткань/Джут']
  },
  { name: 'dimensions', label: 'Размеры (ДхШхВ, мм)', type: 'TEXT' },
  { name: 'volume_weight', label: 'Объем / Вместимость (л/кг)', type: 'NUMBER' }
] as CategoryFeatureInput[]

const MATERIAL_FEATURES = [
  { name: 'material_type', label: 'Материал', type: 'TEXT' },
  { name: 'dimensions', label: 'Размеры (мм)', type: 'TEXT' },
  { name: 'volume', label: 'Объем/Вес (кг)', type: 'NUMBER' }
] as CategoryFeatureInput[]

const OTHER_FUEL_FEATURES = [
  { name: 'fuel_type', label: 'Тип/Марка', type: 'TEXT' },
  {
    name: 'packing',
    label: 'Упаковка',
    type: 'SELECT',
    options: ['Биг-бэг', 'Навалом', 'Сетки/Пакеты', 'Канистра/Бочка', 'В кузове']
  }
] as CategoryFeatureInput[]

const OTHER_GOODS_FEATURES = [
  { name: 'material', label: 'Материал', type: 'TEXT' },
  { name: 'dimensions', label: 'Размеры / Толщина', type: 'TEXT' },
  { name: 'origin', label: 'Производитель', type: 'TEXT' }
] as CategoryFeatureInput[]

const OTHER_WASTE_FEATURES = [
  { name: 'raw_type', label: 'Тип сырья', type: 'TEXT' },
  { name: 'volume', label: 'Объем партии', type: 'NUMBER' },
  { name: 'packing', label: 'Упаковка', type: 'SELECT', options: ['Навалом', 'Биг-бэг', 'Мешки'] }
] as CategoryFeatureInput[]

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
    name: 'packing',
    label: 'Упаковка/Тара',
    type: 'MULTI_SELECT',
    options: ['Биг-бэг', 'Мешки', 'Кипы/Киповые прессы', 'Картонные короба', 'Вакуумная упаковка/Фольга', 'Навалом']
  }
] as CategoryFeatureInput[]

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
      'Необработанное (сырье)',
      'Мытое / Очищенное',
      'Мокросоленое',
      'Сухосоленое',
      'Сушеное (для растительного сырья)'
    ]
  },
  {
    name: 'packing',
    label: 'Упаковка / Тара',
    type: 'SELECT',
    options: ['Прессованные тюки', 'Мешки (ПП/джут)', 'В бочках / Рассоле', 'Пакеты / Коробки', 'Навалом']
  }
] as CategoryFeatureInput[]

const AGRO_SEED_FEATURES = [
  {
    name: 'packing',
    label: 'Упаковка / Тара',
    type: 'MULTI_SELECT',
    options: [
      'Биг-бэги',
      'Мешки (бумажные/ПП)',
      'Навалом / Насыпью',
      'Кассеты/Горшки',
      'ОКС (открытая корневая)',
      'ЗКС (закрытая корневая)',
      'Пакеты (фасовка)'
    ]
  }
] as CategoryFeatureInput[]

const OTHER_DEFAULT_FEATURES = [
  { name: 'usage', label: 'Назначение', type: 'TEXT' },
  { name: 'origin', label: 'Производитель/Бренд', type: 'TEXT' }
] as CategoryFeatureInput[]

export const CATEGORIES_DATA: CategoryInput[] = [
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
      { name: 'Средства для дезинсекции и дератизации', children: [], categoryFeatures: AGRO_CHEM_STANDARD },
      { name: 'Средства защиты растений', children: [], categoryFeatures: AGRO_CHEM_STANDARD }
    ]
  },
  {
    name: 'С/х животные и птица',
    iconId: 'Bird',
    children: [
      { name: 'Крупный рогатый скот (КРС)', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Свиньи', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Овцы и бараны', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Козы', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Лошади', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Сельхозптица', children: [], categoryFeatures: POULTRY_FEATURES },
      { name: 'Кролики', children: [], categoryFeatures: ANIMAL_FEATURES },
      { name: 'Пчеловодство (пчелопакеты, матки)', children: [], categoryFeatures: BEES_FEATURES },
      { name: 'Рыбопосадочный материал и малёк', children: [], categoryFeatures: FISH_FEATURES },
      { name: 'Другие с/х животные', children: [], categoryFeatures: ANIMAL_FEATURES }
    ]
  },
  {
    name: 'Корма для животных',
    iconId: 'Wheat',
    children: [
      { name: 'Барда, пивная дробина', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Жмых, шрот, жом, патока', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Зерно фуражное', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Комбикорма, зерносмеси', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Корма для кошек, собак', children: [], categoryFeatures: ANIMAL_FEED_EXTENDED },
      { name: 'Кормовые добавки', children: [], categoryFeatures: FEED_ADDITIVES },
      { name: 'Мука мясокостная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Отруби', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Сено, солома, силос', children: [], categoryFeatures: FEED_BULK_FEATURES },
      { name: 'Жидкие корма', children: [], categoryFeatures: FEED_LIQUID_FEATURES },
      { name: 'Заменители цельного молока', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Ингредиенты для кормов', children: [], categoryFeatures: FEED_ADDITIVES },
      { name: 'Для силосования', children: [], categoryFeatures: ENSILAGE_FEATURES },
      { name: 'Корма для рыб', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Корма экструдированные', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Кормовые дрожжи', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Кормовые корнеплоды', children: [], categoryFeatures: FEED_BULK_FEATURES },
      { name: 'Мука кровяная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Мука мясная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Мука перьевая', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Мука рыбная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Мука травяная', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Некондиционные продукты на корм', children: [], categoryFeatures: FEED_HIGH_PROTEIN },
      { name: 'Пробиотики', children: [], categoryFeatures: FEED_ADDITIVES },
      { name: 'Соль кормовая', children: [], categoryFeatures: FEED_ADDITIVES },
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
          { name: 'Прочее зерноперерабатывающее оборудование', children: [], categoryFeatures: EQUIP_BASE }
        ]
      },
      { name: 'Компрессорное и насосное оборудование', children: [], categoryFeatures: EQUIP_BASE },
      {
        name: 'Мясоперерабатывающее оборудование',
        children: [
          { name: 'Блокорезки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Волчки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Запчасти и расходные материалы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Инъекторы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Клипсаторы, перекрутчики', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Коптильни, термокамеры, рамы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Котлетные автоматы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Куттеры', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Линии для разделки птицы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Льдогенераторы', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Массажеры', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машины для нарезки', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Модульные мясные цеха и mini-заводы', children: [], categoryFeatures: EQUIP_BASE },
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
          { name: 'Домики и загоны для телят', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Клеточное оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Климатическое оборудование', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Машинки для стрижки животных', children: [], categoryFeatures: EQUIP_PARTS },
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
          { name: 'Прочее для переработки овощей, фруктов, ягод', children: [], categoryFeatures: EQUIP_BASE },
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
          { name: 'Лабораторное оборудование', children: [], categoryFeatures: EQUIP_PARTS },
          { name: 'Машины семяочистительные', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для гидропоники', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для грибоводства', children: [], categoryFeatures: EQUIP_BASE },
          { name: 'Для контроля окружающей среды', children: [], categoryFeatures: EQUIP_PARTS },
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
          { name: 'Прочее хлебопекарное и кондитерское', children: [], categoryFeatures: EQUIP_BASE },
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
      { name: 'Для пчеловодства', children: [], categoryFeatures: EQUIP_PARTS },
      { name: 'Для рыбоводства', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Для складов и хранилищ', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Сушильное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Холодильное', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Маркировочное и этикетировочное оборудование', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Оборудование для производства упаковки', children: [], categoryFeatures: EQUIP_BASE },
      { name: 'Упаковочное и фасовочное оборудование', children: [], categoryFeatures: EQUIP_BASE }
    ]
  },
  // Тут
  {
    name: 'Продукты переработки',
    iconId: 'Factory',
    children: [
      { name: 'Замороженные овощи и фрукты', children: [], categoryFeatures: FOOD_BASE },
      {
        name: 'Консервированные продукты',
        children: [
          { name: 'Грибы соленые, солено-отварные, маринованные', children: [], categoryFeatures: FOOD_CANNED },
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
          { name: 'Прочие крупы и бобовые (чечевица, фасоль, нут, маш)', children: [], categoryFeatures: FOOD_GROCERY }
        ]
      },
      { name: 'Масложировая продукция', children: [], categoryFeatures: FOOD_READY },
      {
        name: 'Молоко, молочные продукты',
        children: [
          { name: 'Йогурт', children: [], categoryFeatures: FOOD_DAIRY },
          { name: 'Кефир, ряженка, кумыс', children: [], categoryFeatures: FOOD_DAIRY },
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
          { name: 'Баранина', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Говядина', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Готовые мясные продукты, полуфабрикаты', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Козлятина', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Конина', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Колбасные изделия и мясные деликатесы', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Кролик', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Птица', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Свинина', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Субпродукты', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Сырое сало (шпик), жир-сырец', children: [], categoryFeatures: FOOD_MEAT_FISH },
          { name: 'Фарш', children: [], categoryFeatures: FOOD_MEAT_FISH }
        ]
      },
      { name: 'Пряности, специи, приправы', children: [], categoryFeatures: FOOD_GROCERY },
      { name: 'Сушеные овощи, фрукты, сухофрукты', children: [], categoryFeatures: FOOD_GROCERY },
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
          { name: 'Готовые рыбные продукты и полуфабрикаты', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Икра рыбы', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Моллюски и ракообразные', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Морская капуста, водоросли', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Прочее морепродукты', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыба вяленая, сушеная', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыба живая, охлажденная', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыба копченая', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыба свежемороженая', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыба соленая', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Рыбные субпродукты', children: [], categoryFeatures: FOOD_BASE },
          { name: 'Фарш рыбный', children: [], categoryFeatures: FOOD_BASE }
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
    name: 'Продукты питания',
    iconId: 'Apple',
    children: [
      { name: 'Грибы пищевые', children: [], categoryFeatures: AGRO_MUSHROOM_FEATURES },
      {
        name: 'Зелень, салатные культуры, травы',
        children: [
          { name: 'Базилик', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Кинза', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
          { name: 'Лук зеленое перо', children: [], categoryFeatures: AGRO_GREEN_FEATURES },
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
          { name: 'Персики', children: [], categoryFeatures: AGRO_FRESH_FEATURES },
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
          { name: 'category', label: 'Категория', type: 'MULTI_SELECT', options: ['С0', 'С1', 'С2', 'СВ', 'СП'] }
        ]
      },
      {
        name: 'Мед, продукция пчеловодства',
        children: [
          { name: 'Мед натуральный (монофлорный, полифлорный)', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Мед в сотах', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Перга, пыльца (обножка)', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Прополис', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Маточное молочко, трутневый гомогенат', children: [], categoryFeatures: AGRO_HONEY_FEATURES },
          { name: 'Воск пчелиный', children: [], categoryFeatures: AGRO_HONEY_FEATURES }
        ]
      }
    ]
  },
  {
    name: 'Сельхозсырье и агрокультуры',
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
          { name: 'Лекарственное растительное сырье', children: [], categoryFeatures: AGRO_TECHNICAL_FEATURES },
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
        name: 'Прочее сырье растительного происхождения',
        children: [
          { name: 'Лекарственные травы, дикоросы', children: [], categoryFeatures: AGRO_RAW_FEATURES },
          { name: 'Саженцы, рассада, мицелий грибов', children: [], categoryFeatures: DEFAULT_FEATURES },
          {
            name: 'Семена цветов, газонных трав, декоративных культур',
            children: [],
            categoryFeatures: AGRO_RAW_FEATURES
          },
          {
            name: 'Сушеные цветы для кондитерского производства и производства чая',
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
            name: 'Посевной материал зерновых и зернобобовых культур',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          {
            name: 'Посевной материал кормовых, силосных и пастбищных трав',
            children: [],
            categoryFeatures: AGRO_SEED_FEATURES
          },
          { name: 'Посевной материал лекарственных растений', children: [], categoryFeatures: AGRO_SEED_FEATURES },
          { name: 'Посевной материал масличных культур', children: [], categoryFeatures: AGRO_SEED_FEATURES },
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
    name: 'Сельскохозяйственная техника',
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
      { name: 'Упаковочные материалы и сырье', children: [], categoryFeatures: PACKAGING_MATERIAL_FEATURES }
    ]
  },
  {
    name: 'Техническое сырье',
    children: [
      { name: 'Натуральные оболочки', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Овечьи шкуры', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      { name: 'Перо, пух', children: [], categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES },
      {
        name: 'Сушеные цветы для кондитерского производства и производства чая',
        children: [],
        categoryFeatures: AGRO_INDUSTRIAL_RAW_FEATURES
      },
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
        categoryFeatures: [{ name: 'version', label: 'Версия', type: 'TEXT' }]
      },
      { name: 'Прочая спецтехника', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
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
            name: 'Полимерные рукава для хранение с.х. продукции',
            children: [],
            categoryFeatures: OTHER_GOODS_FEATURES
          },
          { name: 'Пчелоинвентарь', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Расходные материалы', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Садовый инвентарь', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Сеялки ручные', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Спецодежда', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Средства защиты от насекомых и грызунов', children: [], categoryFeatures: OTHER_DEFAULT_FEATURES },
          { name: 'Укрывной материал, пленка, агроткань', children: [], categoryFeatures: OTHER_GOODS_FEATURES },
          { name: 'Шпагат и сетка', children: [], categoryFeatures: OTHER_GOODS_FEATURES }
        ]
      },
      { name: 'С/х отходы и побочные продукты производства', children: [], categoryFeatures: OTHER_WASTE_FEATURES },
      {
        name: 'Книги, документация, аграрные издания',
        children: [],
        categoryFeatures: [{ name: 'author', label: 'Автор/Издательство', type: 'TEXT' }]
      }
    ]
  }
]
