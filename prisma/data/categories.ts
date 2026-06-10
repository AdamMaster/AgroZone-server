export type FeatureInput = {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: string[]
  required: boolean
}

export type CategoryInput = {
  name: string
  children?: CategoryInput[]
  features?: FeatureInput[]
}

const AGRO_CHEM_FEATURES = [
  {
    name: 'form',
    label: 'Форма выпуска',
    type: 'select',
    options: ['Жидкая', 'Порошкообразная', 'Гранулированная', 'Гель'],
    required: true
  },
  { name: 'application', label: 'Способ применения', type: 'text', required: true },
  { name: 'volume', label: 'Фасовка (л/кг)', type: 'number', required: true },
  { name: 'manufacturer', label: 'Производитель', type: 'text', required: false }
] as FeatureInput[]

const FEED_BASE_FEATURES = [
  { name: 'protein', label: 'Протеин (%)', type: 'number', required: false },
  { name: 'packing', label: 'Упаковка', type: 'select', options: ['Мешки', 'Биг-бэг', 'Навалом'], required: true },
  { name: 'origin', label: 'Производитель', type: 'text', required: false }
] as FeatureInput[]

const ANIMAL_FEED_FEATURES = [
  { name: 'animal_type', label: 'Для кого', type: 'text', required: true },
  { name: 'volume', label: 'Вес упаковки (кг)', type: 'number', required: true }
] as FeatureInput[]

const EQUIP_GENERAL = [
  { name: 'condition', label: 'Состояние', type: 'select', options: ['Новое', 'Б/у'], required: true },
  { name: 'year', label: 'Год выпуска', type: 'number', required: false },
  { name: 'power', label: 'Мощность (кВт)', type: 'number', required: false }
] as FeatureInput[]

const PROCESSED_FEATURES = [
  {
    name: 'packing',
    label: 'Тип упаковки',
    type: 'select',
    options: ['Вакуум', 'Пакет', 'Банка', 'Навалом'],
    required: true
  },
  { name: 'shelf_life', label: 'Срок годности (мес)', type: 'number', required: true },
  { name: 'gost', label: 'ГОСТ/ТУ', type: 'text', required: false }
] as FeatureInput[]

const AGRO_FEATURES = [
  { name: 'gost', label: 'ГОСТ/ТУ', type: 'text', required: true },
  { name: 'moisture', label: 'Влажность (%)', type: 'number', required: true },
  { name: 'purity', label: 'Чистота (%)', type: 'number', required: true },
  { name: 'packing', label: 'Упаковка', type: 'text', required: true }
] as FeatureInput[]
const ANIMAL_FEATURES = [
  { name: 'age', label: 'Возраст (мес)', type: 'number', required: true },
  { name: 'weight', label: 'Вес (кг)', type: 'number', required: true },
  { name: 'breed', label: 'Порода', type: 'text', required: false },
  { name: 'vaccination', label: 'Вакцинация', type: 'boolean', required: false }
] as FeatureInput[]
const SEED_FEATURES = [
  { name: 'germination', label: 'Всхожесть (%)', type: 'number', required: true },
  { name: 'reproduction', label: 'Репродукция', type: 'text', required: true },
  { name: 'year', label: 'Год урожая', type: 'number', required: true }
] as FeatureInput[]
const DEFAULT_FEATURES = [
  { name: 'condition', label: 'Состояние/Сорт', type: 'text', required: true },
  { name: 'volume', label: 'Объем партии', type: 'number', required: true }
] as FeatureInput[]

const TECH_FEATURES = [
  { name: 'year', label: 'Год выпуска', type: 'number', required: true },
  { name: 'brand', label: 'Бренд', type: 'text', required: true },
  { name: 'condition', label: 'Состояние', type: 'select', options: ['Новое', 'Б/у'], required: true },
  { name: 'power', label: 'Мощность (л.с.)', type: 'number', required: false }
] as FeatureInput[]

const EQUIP_FEATURES = [
  { name: 'performance', label: 'Производительность (ед/мин)', type: 'number', required: true },
  { name: 'condition', label: 'Состояние', type: 'select', options: ['Новое', 'Б/у'], required: true },
  { name: 'year', label: 'Год выпуска', type: 'number', required: false }
] as FeatureInput[]

const MATERIAL_FEATURES = [
  { name: 'material_type', label: 'Материал', type: 'text', required: true },
  { name: 'dimensions', label: 'Размеры (мм)', type: 'text', required: false },
  { name: 'volume', label: 'Объем/Вес (кг)', type: 'number', required: true }
] as FeatureInput[]

const OTHER_FEATURES = [
  { name: 'usage', label: 'Назначение', type: 'text', required: true },
  { name: 'material', label: 'Материал', type: 'text', required: false },
  { name: 'volume', label: 'Количество/Объем', type: 'number', required: true }
] as FeatureInput[]

export const CATEGORIES_DATA: CategoryInput[] = [
  {
    name: 'Агрохимия',
    children: [
      { name: 'Биопрепараты', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Грунты', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Микроудобрения', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Минеральные удобрения', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Моющие и дезинфицирующие средства', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Органические удобрения', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Органоминеральные удобрения', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Регуляторы роста', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Средства для дезинсекции и дератизации', children: [], features: AGRO_CHEM_FEATURES },
      { name: 'Средства защиты растений', children: [], features: AGRO_CHEM_FEATURES }
    ]
  },
  {
    name: 'Корма для с.х. животных и птиц',
    children: [
      { name: 'Барда, пивная дробина', children: [], features: FEED_BASE_FEATURES },
      { name: 'Жмых, шрот, жом, патока', children: [], features: FEED_BASE_FEATURES },
      { name: 'Зерно фуражное', children: [], features: FEED_BASE_FEATURES },
      { name: 'Комбикорма, зерносмеси', children: [], features: FEED_BASE_FEATURES },
      { name: 'Корма для кошек, собак', children: [], features: ANIMAL_FEED_FEATURES },
      { name: 'Кормовые добавки', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука мясокостная', children: [], features: FEED_BASE_FEATURES },
      { name: 'Отруби', children: [], features: FEED_BASE_FEATURES },
      { name: 'Прочие корма', children: [], features: FEED_BASE_FEATURES },
      { name: 'Сено, солома, силос', children: [], features: FEED_BASE_FEATURES },
      { name: 'Жидкие корма', children: [], features: FEED_BASE_FEATURES },
      { name: 'Заменители цельного молока', children: [], features: FEED_BASE_FEATURES },
      { name: 'Ингредиенты для кормов', children: [], features: FEED_BASE_FEATURES },
      { name: 'Для силосования', children: [], features: FEED_BASE_FEATURES },
      { name: 'Корма для рыб', children: [], features: FEED_BASE_FEATURES },
      { name: 'Корма экструдированные', children: [], features: FEED_BASE_FEATURES },
      { name: 'Кормовые дрожжи', children: [], features: FEED_BASE_FEATURES },
      { name: 'Кормовые корнеплоды', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука кровяная', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука мясная', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука перьевая', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука рыбная', children: [], features: FEED_BASE_FEATURES },
      { name: 'Мука травяная', children: [], features: FEED_BASE_FEATURES },
      { name: 'Некондиционные продукты на корм', children: [], features: FEED_BASE_FEATURES },
      { name: 'Пробиотики', children: [], features: FEED_BASE_FEATURES },
      { name: 'Соль кормовая', children: [], features: FEED_BASE_FEATURES }
    ]
  },
  {
    name: 'Оборудование',
    children: [
      {
        name: 'Зерноперерабатывающее оборудование',
        children: [
          { name: 'Зерноочистительное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Зернопогрузчики, зернометатели', children: [], features: EQUIP_GENERAL },
          { name: 'Зерносушильное оборудование (зерносушилки)', children: [], features: EQUIP_GENERAL },
          { name: 'Зернотранспортное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Мукомольно-крупяное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для анализа качества зерна', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для хранения зерна', children: [], features: EQUIP_GENERAL },
          { name: 'Прочее зерноперерабатывающее оборудование', children: [], features: EQUIP_GENERAL }
        ]
      },
      { name: 'Компрессорное и насосное оборудование', children: [], features: EQUIP_GENERAL },
      {
        name: 'Мясоперерабатывающее оборудование',
        children: [
          { name: 'Блокорезки', children: [], features: EQUIP_GENERAL },
          { name: 'Волчки', children: [], features: EQUIP_GENERAL },
          { name: 'Запчасти и расходные материалы', children: [], features: EQUIP_GENERAL },
          { name: 'Инъекторы', children: [], features: EQUIP_GENERAL },
          { name: 'Клипсаторы, перекрутчики', children: [], features: EQUIP_GENERAL },
          { name: 'Коптильни, термокамеры, рамы', children: [], features: EQUIP_GENERAL },
          { name: 'Котлетные автоматы', children: [], features: EQUIP_GENERAL },
          { name: 'Куттеры', children: [], features: EQUIP_GENERAL },
          { name: 'Линии для разделки птицы', children: [], features: EQUIP_GENERAL },
          { name: 'Льдогенераторы', children: [], features: EQUIP_GENERAL },
          { name: 'Массажеры', children: [], features: EQUIP_GENERAL },
          { name: 'Машины для нарезки', children: [], features: EQUIP_GENERAL },
          { name: 'Модульные мясные цеха и мини-заводы', children: [], features: EQUIP_GENERAL },
          { name: 'Мясорубки', children: [], features: EQUIP_GENERAL },
          { name: 'Для обработки субпродуктов', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для убоя', children: [], features: EQUIP_GENERAL },
          { name: 'Пельменные аппараты', children: [], features: EQUIP_GENERAL },
          { name: 'Пилы для разделки мяса', children: [], features: EQUIP_GENERAL },
          { name: 'Подвесные пути, подъемники', children: [], features: EQUIP_GENERAL },
          { name: 'Пресса механической обвалки', children: [], features: EQUIP_GENERAL },
          { name: 'Прочее мясное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Станки для заточки ножей', children: [], features: EQUIP_GENERAL },
          { name: 'Тендерайзеры', children: [], features: EQUIP_GENERAL },
          { name: 'Фаршемешалки', children: [], features: EQUIP_GENERAL },
          { name: 'Шкуросъемные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Шпигорезки', children: [], features: EQUIP_GENERAL }
        ]
      },
      {
        name: 'Для животноводства',
        children: [
          { name: 'Весы для взвешивания животных', children: [], features: EQUIP_GENERAL },
          { name: 'Ветеринарное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Доильное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Домики и загоны для телят', children: [], features: EQUIP_GENERAL },
          { name: 'Клеточное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Климатическое оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Машинки для стрижки животных', children: [], features: EQUIP_GENERAL },
          { name: 'Навозоуборочное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для кормления и поения', children: [], features: EQUIP_GENERAL },
          { name: 'Стойловое оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Электропастухи', children: [], features: EQUIP_GENERAL }
        ]
      },
      {
        name: 'Для молочной промышленности',
        children: [
          { name: 'Емкости для приемки и хранения молока', children: [], features: EQUIP_GENERAL },
          { name: 'Заквасочники', children: [], features: EQUIP_GENERAL },
          { name: 'Запчасти и комплектующие для молочной промышленности', children: [], features: EQUIP_GENERAL },
          { name: 'Модульные молочные заводы', children: [], features: EQUIP_GENERAL },
          { name: 'Насосы пищевые молочные', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства сгущенного молока', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства сливочного масла и спредов', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства сухого молока', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства сыра', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства творога', children: [], features: EQUIP_GENERAL },
          { name: 'Пастеризаторы и охладители', children: [], features: EQUIP_GENERAL },
          { name: 'Прочее молокоперерабатывающее оборудование', children: [], features: EQUIP_GENERAL }
        ]
      },
      {
        name: 'Для переработки овощей, фруктов, ягод',
        children: [
          { name: 'Линии для предпродажной подготовки', children: [], features: EQUIP_GENERAL },
          { name: 'Для варки, выпаривания, бланширования', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для консервирования', children: [], features: EQUIP_GENERAL },
          { name: 'Для мойки и подготовки', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства паст, соков, пюре', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства сахара', children: [], features: EQUIP_GENERAL },
          { name: 'Для разделки, нарезки, шинковки', children: [], features: EQUIP_GENERAL },
          { name: 'Для сушки', children: [], features: EQUIP_GENERAL },
          { name: 'Протирочные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Прочее для переработки овощей, фруктов, ягод', children: [], features: EQUIP_GENERAL },
          { name: 'Сортировщики и калибровщики', children: [], features: EQUIP_GENERAL },
          { name: 'Столы переборочные', children: [], features: EQUIP_GENERAL }
        ]
      },
      { name: 'Для производства кормов', children: [], features: EQUIP_GENERAL },
      {
        name: 'Для производства продуктов питания',
        children: [
          { name: 'Варочно-жарочное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Для консервирования продуктов', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для масложирового производства', children: [], features: EQUIP_GENERAL },
          { name: 'Для переработки рыбы и морепродуктов', children: [], features: EQUIP_GENERAL },
          { name: 'Для переработки яиц', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства безалкогольных напитков', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства готовых завтраков, чипсов, снеков', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства соусов, майонеза, кетчупов', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для производства чая', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование по переработке зерновых продуктов', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование по переработке орехов, семечек', children: [], features: EQUIP_GENERAL }
        ]
      },
      {
        name: 'Для растениеводства',
        children: [
          { name: 'Климатические шкафы', children: [], features: EQUIP_GENERAL },
          { name: 'Лабораторное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Машины семяочистительные', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для гидропоники', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для грибоводства', children: [], features: EQUIP_GENERAL },
          { name: 'Для контроля окружающей среды', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для полива и орошения', children: [], features: EQUIP_GENERAL },
          { name: 'Для приготовления растворов удобрений', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для садоводства', children: [], features: EQUIP_GENERAL },
          { name: 'Оборудование для цветоводства', children: [], features: EQUIP_GENERAL },
          { name: 'Посадочное оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Протравливатели семян', children: [], features: EQUIP_GENERAL },
          { name: 'Теплицы', children: [], features: EQUIP_GENERAL }
        ]
      },
      {
        name: 'Хлебопекарное и кондитерское оборудование',
        children: [
          { name: 'Глазировочные, дражировочные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Дозаторы начинок, шприцы, депозиторы', children: [], features: EQUIP_GENERAL },
          { name: 'Запчасти для оборудования', children: [], features: EQUIP_GENERAL },
          { name: 'Миксеры, кремовзбивальные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Мукопросеиватели', children: [], features: EQUIP_GENERAL },
          { name: 'Для производства макаронных изделий', children: [], features: EQUIP_GENERAL },
          { name: 'Отсадочные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Печи хлебопекарные', children: [], features: EQUIP_GENERAL },
          { name: 'Прочее хлебопекарное и кондитерское оборудование', children: [], features: EQUIP_GENERAL },
          { name: 'Тестоделительные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Тестозакаточные, формующие машины', children: [], features: EQUIP_GENERAL },
          { name: 'Тестомесильные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Тестоокруглительные машины', children: [], features: EQUIP_GENERAL },
          { name: 'Тестораскатывающие машины', children: [], features: EQUIP_GENERAL }
        ]
      },
      { name: 'Весоизмерительное оборудование', children: [], features: EQUIP_GENERAL },
      { name: 'Емкостное оборудование', children: [], features: EQUIP_GENERAL },
      { name: 'Моечное и санитарно-гигиеническое оборудование', children: [], features: EQUIP_GENERAL },
      { name: 'Оборудование для переработки с/х отходов', children: [], features: EQUIP_GENERAL },
      { name: 'Для птицеводства', children: [], features: EQUIP_GENERAL },
      { name: 'Для пчеловодства', children: [], features: EQUIP_GENERAL },
      { name: 'Оборудование для рыбоводства', children: [], features: EQUIP_GENERAL },
      { name: 'Для складов и хранилищ', children: [], features: EQUIP_GENERAL },
      { name: 'Сушильное оборудование', children: [], features: EQUIP_GENERAL },
      { name: 'Холодильное оборудование', children: [], features: EQUIP_GENERAL }
    ]
  },
  {
    name: 'Продукты переработки',
    children: [
      { name: 'Замороженные овощи и фрукты', children: [], features: PROCESSED_FEATURES },
      {
        name: 'Консервированные продукты',
        children: [
          { name: 'Грибы соленые, солено-отварные, маринованные', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы молочные', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы мясные', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы мясорастительные', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы овощные, соления, квашения', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы рыбные', children: [], features: PROCESSED_FEATURES },
          { name: 'Консервы фруктово-ягодные', children: [], features: PROCESSED_FEATURES }
        ]
      },
      {
        name: 'Крупы',
        children: [
          { name: 'Крупа гороховая', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа гречневая', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа киноа', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа кукурузная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа манная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа овсяная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа перловая', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа полбяная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа пшеничная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа пшенная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа рисовая', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа чечевичная', children: [], features: PROCESSED_FEATURES },
          { name: 'Крупа ячневая', children: [], features: PROCESSED_FEATURES },
          { name: 'Фасоль', children: [], features: PROCESSED_FEATURES }
        ]
      },
      { name: 'Масложировая продукция', children: [], features: PROCESSED_FEATURES },
      {
        name: 'Молоко, молочные продукты',
        children: [
          { name: 'Йогурт', children: [], features: PROCESSED_FEATURES },
          { name: 'Кефир', children: [], features: PROCESSED_FEATURES },
          { name: 'Кисломолочные продукты', children: [], features: PROCESSED_FEATURES },
          { name: 'Молоко', children: [], features: PROCESSED_FEATURES },
          { name: 'Молочные десерты', children: [], features: PROCESSED_FEATURES },
          { name: 'Молочные коктейли', children: [], features: PROCESSED_FEATURES },
          { name: 'Молочные продукты для детей', children: [], features: PROCESSED_FEATURES },
          { name: 'Молочный белок', children: [], features: PROCESSED_FEATURES },
          { name: 'Молочный жир', children: [], features: PROCESSED_FEATURES },
          { name: 'Мороженое', children: [], features: PROCESSED_FEATURES },
          { name: 'Растительные заменители пищевого молока и сливок', children: [], features: PROCESSED_FEATURES },
          { name: 'Ряженка', children: [], features: PROCESSED_FEATURES },
          { name: 'Сгущенное молоко', children: [], features: PROCESSED_FEATURES },
          { name: 'Сливки', children: [], features: PROCESSED_FEATURES },
          { name: 'Сметана', children: [], features: PROCESSED_FEATURES },
          { name: 'Сухое молоко, сухие натуральные сливки', children: [], features: PROCESSED_FEATURES },
          { name: 'Сыворотка', children: [], features: PROCESSED_FEATURES },
          { name: 'Сыры', children: [], features: PROCESSED_FEATURES }
        ]
      },
      {
        name: 'Мясо и мясные продукты',
        children: [
          { name: 'Баранина', children: [], features: PROCESSED_FEATURES },
          { name: 'Говядина', children: [], features: PROCESSED_FEATURES },
          { name: 'Готовые мясные продукты, полуфабрикаты', children: [], features: PROCESSED_FEATURES },
          { name: 'Козлятина', children: [], features: PROCESSED_FEATURES },
          { name: 'Конина', children: [], features: PROCESSED_FEATURES },
          { name: 'Мясо кролика', children: [], features: PROCESSED_FEATURES },
          { name: 'Мясо птицы', children: [], features: PROCESSED_FEATURES },
          { name: 'Свинина', children: [], features: PROCESSED_FEATURES },
          { name: 'Субпродукты', children: [], features: PROCESSED_FEATURES },
          { name: 'Сырое cало (шпик), жир-сырец', children: [], features: PROCESSED_FEATURES },
          { name: 'Фарш', children: [], features: PROCESSED_FEATURES }
        ]
      },
      { name: 'Пряности, приправы', children: [], features: PROCESSED_FEATURES },
      { name: 'Сушеные овощи и фрукты', children: [], features: PROCESSED_FEATURES },
      { name: 'Чай, кофе, чайные напитки', children: [], features: PROCESSED_FEATURES },
      { name: 'Экстракты растительные пищевые', children: [], features: PROCESSED_FEATURES },
      { name: 'Безалкогольные напитки, соки', children: [], features: PROCESSED_FEATURES },
      { name: 'Изоляты, текстураты', children: [], features: PROCESSED_FEATURES },
      { name: 'Какао-порошок, какао-бобы, кэроб', children: [], features: PROCESSED_FEATURES },
      { name: 'Кондитерские изделия', children: [], features: PROCESSED_FEATURES },
      { name: 'Крахмало-паточная продукция', children: [], features: PROCESSED_FEATURES },
      { name: 'Макаронные изделия', children: [], features: PROCESSED_FEATURES },
      {
        name: 'Мука',
        children: [
          { name: 'Мука амарантовая', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука гороховая', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука грецкого ореха', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука гречневая', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука из зародышей пшеницы', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука кукурузная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука кунжутная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука льняная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука нутовая', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука овсяная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука ореховая', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука полбяная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука пшеничная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука расторопши', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука ржаная', children: [], features: PROCESSED_FEATURES },
          { name: 'Мука рисовая', children: [], features: PROCESSED_FEATURES }
        ]
      },
      { name: 'Пасты, пюре', children: [], features: PROCESSED_FEATURES },
      { name: 'Продукты быстрого приготовления', children: [], features: PROCESSED_FEATURES },
      { name: 'Прочая пищевая продукция', children: [], features: PROCESSED_FEATURES },
      {
        name: 'Рыба и морепродукты',
        children: [
          { name: 'Готовые рыбные продукты и полуфабрикаты', children: [], features: PROCESSED_FEATURES },
          { name: 'Икра рыбы', children: [], features: PROCESSED_FEATURES },
          { name: 'Моллюски и ракообразные', children: [], features: PROCESSED_FEATURES },
          { name: 'Морская капуста, водоросли', children: [], features: PROCESSED_FEATURES },
          { name: 'Прочее морепродукты', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыба вяленая, сушеная', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыба живая, охлажденная', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыба копченая', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыба свежемороженая', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыба соленая', children: [], features: PROCESSED_FEATURES },
          { name: 'Рыбные субпродукты', children: [], features: PROCESSED_FEATURES },
          { name: 'Фарш рыбный', children: [], features: PROCESSED_FEATURES }
        ]
      },
      { name: 'Сахар', children: [], features: PROCESSED_FEATURES },
      { name: 'Снековая продукция', children: [], features: PROCESSED_FEATURES },
      { name: 'Солод', children: [], features: PROCESSED_FEATURES },
      { name: 'Соусы, кетчуп, майонез', children: [], features: PROCESSED_FEATURES },
      { name: 'Хлебобулочные изделия', children: [], features: PROCESSED_FEATURES },
      { name: 'Яичный порошок, меланж', children: [], features: PROCESSED_FEATURES }
    ]
  },
  {
    name: 'Продукция и сырье',
    children: [
      { name: 'Грибы пищевые', children: [], features: DEFAULT_FEATURES },
      {
        name: 'Зерно, зернобобовые',
        children: [
          { name: 'Бобы', children: [], features: AGRO_FEATURES },
          { name: 'Горох', children: [], features: AGRO_FEATURES },
          { name: 'Гречиха', children: [], features: AGRO_FEATURES },
          { name: 'Кукуруза', children: [], features: AGRO_FEATURES },
          { name: 'Люпин', children: [], features: AGRO_FEATURES },
          { name: 'Маш', children: [], features: AGRO_FEATURES },
          { name: 'Нут', children: [], features: AGRO_FEATURES },
          { name: 'Овёс', children: [], features: AGRO_FEATURES },
          { name: 'Полба', children: [], features: AGRO_FEATURES },
          { name: 'Просо', children: [], features: AGRO_FEATURES },
          { name: 'Пшеница', children: [], features: AGRO_FEATURES },
          { name: 'Рожь', children: [], features: AGRO_FEATURES },
          { name: 'Сорго', children: [], features: AGRO_FEATURES },
          { name: 'Соя', children: [], features: AGRO_FEATURES },
          { name: 'Тритикале', children: [], features: AGRO_FEATURES },
          { name: 'Фасоль', children: [], features: AGRO_FEATURES },
          { name: 'Чечевица', children: [], features: AGRO_FEATURES },
          { name: 'Ячмень', children: [], features: AGRO_FEATURES }
        ]
      },
      {
        name: 'Масличные культуры',
        children: [
          { name: 'Амарант', children: [], features: AGRO_FEATURES },
          { name: 'Горчица', children: [], features: AGRO_FEATURES },
          { name: 'Конопля техническая', children: [], features: AGRO_FEATURES },
          { name: 'Кориандр', children: [], features: AGRO_FEATURES },
          { name: 'Косточки облепихи', children: [], features: AGRO_FEATURES },
          { name: 'Кунжут', children: [], features: AGRO_FEATURES },
          { name: 'Лён', children: [], features: AGRO_FEATURES },
          { name: 'Подсолнечник', children: [], features: AGRO_FEATURES },
          { name: 'Рапс', children: [], features: AGRO_FEATURES },
          { name: 'Расторопша', children: [], features: AGRO_FEATURES },
          { name: 'Редька масличная', children: [], features: AGRO_FEATURES },
          { name: 'Рыжик', children: [], features: AGRO_FEATURES },
          { name: 'Сафлор', children: [], features: AGRO_FEATURES },
          { name: 'Семечки тыквенные', children: [], features: AGRO_FEATURES },
          { name: 'Тмин', children: [], features: AGRO_FEATURES },
          { name: 'Чиа', children: [], features: AGRO_FEATURES }
        ]
      },
      { name: 'Мёд, продукция пчеловодства', children: [], features: DEFAULT_FEATURES },
      {
        name: 'Овощи',
        children: [
          { name: 'Баклажаны', children: [], features: DEFAULT_FEATURES },
          { name: 'Батат', children: [], features: DEFAULT_FEATURES },
          { name: 'Зелень', children: [], features: DEFAULT_FEATURES },
          { name: 'Кабачки', children: [], features: DEFAULT_FEATURES },
          { name: 'Капуста', children: [], features: DEFAULT_FEATURES },
          { name: 'Картофель', children: [], features: DEFAULT_FEATURES },
          { name: 'Лук репчатый', children: [], features: DEFAULT_FEATURES },
          { name: 'Морковь', children: [], features: DEFAULT_FEATURES },
          { name: 'Огурцы', children: [], features: DEFAULT_FEATURES },
          { name: 'Пастернак', children: [], features: DEFAULT_FEATURES },
          { name: 'Перец болгарский', children: [], features: DEFAULT_FEATURES },
          { name: 'Перец острый', children: [], features: DEFAULT_FEATURES },
          { name: 'Ревень', children: [], features: DEFAULT_FEATURES },
          { name: 'Редис', children: [], features: DEFAULT_FEATURES },
          { name: 'Редька', children: [], features: DEFAULT_FEATURES },
          { name: 'Сахарная кукуруза', children: [], features: DEFAULT_FEATURES },
          { name: 'Свёкла столовая', children: [], features: DEFAULT_FEATURES },
          { name: 'Сельдерей', children: [], features: DEFAULT_FEATURES },
          { name: 'Томат', children: [], features: DEFAULT_FEATURES },
          { name: 'Топинамбур', children: [], features: DEFAULT_FEATURES },
          { name: 'Тыква', children: [], features: DEFAULT_FEATURES },
          { name: 'Фасоль стручковая', children: [], features: DEFAULT_FEATURES },
          { name: 'Чеснок', children: [], features: DEFAULT_FEATURES }
        ]
      },
      {
        name: 'Орехи',
        children: [
          { name: 'Арахис', children: [], features: DEFAULT_FEATURES },
          { name: 'Бразильский орех', children: [], features: DEFAULT_FEATURES },
          { name: 'Каштаны', children: [], features: DEFAULT_FEATURES },
          { name: 'Кедровые орехи', children: [], features: DEFAULT_FEATURES },
          { name: 'Кокосовый орех', children: [], features: DEFAULT_FEATURES },
          { name: 'Макадамия', children: [], features: DEFAULT_FEATURES },
          { name: 'Миндальный орех', children: [], features: DEFAULT_FEATURES },
          { name: 'Орех грецкий', children: [], features: DEFAULT_FEATURES },
          { name: 'Орех кешью', children: [], features: DEFAULT_FEATURES },
          { name: 'Орех кола', children: [], features: DEFAULT_FEATURES },
          { name: 'Пекан', children: [], features: DEFAULT_FEATURES },
          { name: 'Прочие орехи', children: [], features: DEFAULT_FEATURES },
          { name: 'Фисташки', children: [], features: DEFAULT_FEATURES },
          { name: 'Фундук', children: [], features: DEFAULT_FEATURES }
        ]
      },
      {
        name: 'С/х животные и птица (живок)',
        children: [
          { name: 'Другие с/х животные', children: [], features: ANIMAL_FEATURES },
          { name: 'Козы', children: [], features: ANIMAL_FEATURES },
          { name: 'Кролики', children: [], features: ANIMAL_FEATURES },
          { name: 'Крупный рогатый скот', children: [], features: ANIMAL_FEATURES },
          { name: 'Лошади', children: [], features: ANIMAL_FEATURES },
          { name: 'Овцы', children: [], features: ANIMAL_FEATURES },
          { name: 'Птицы', children: [], features: ANIMAL_FEATURES },
          { name: 'Пчелы', children: [], features: ANIMAL_FEATURES },
          { name: 'Рыбопосадочный материал', children: [], features: ANIMAL_FEATURES },
          { name: 'Свиньи', children: [], features: ANIMAL_FEATURES }
        ]
      },
      {
        name: 'Семена, посевной материал',
        children: [
          { name: 'Мицелий, грибные блоки', children: [], features: SEED_FEATURES },
          { name: 'Посевной материал зерновых и зернобобовых культур', children: [], features: SEED_FEATURES },
          { name: 'Посевной материал кормовых, силосных и пастбищных трав', children: [], features: SEED_FEATURES },
          { name: 'Посевной материал лекарственных растений', children: [], features: SEED_FEATURES },
          { name: 'Посевной материал масличных культур', children: [], features: SEED_FEATURES },
          { name: 'Рассада овощных культур', children: [], features: SEED_FEATURES },
          { name: 'Саженцы деревьев и кустарников', children: [], features: SEED_FEATURES },
          { name: 'Семена бахчевых культур', children: [], features: SEED_FEATURES },
          { name: 'Семена деревьев и кустарников', children: [], features: SEED_FEATURES },
          { name: 'Семена медоносных растений', children: [], features: SEED_FEATURES },
          { name: 'Семена овощных культур', children: [], features: SEED_FEATURES },
          { name: 'Семена технических культур', children: [], features: SEED_FEATURES },
          { name: 'Семена, рассада и саженцы плодово-ягодных культур', children: [], features: SEED_FEATURES },
          { name: 'Семена, рассада, саженцы цветов, декоративных', children: [], features: SEED_FEATURES }
        ]
      },
      {
        name: 'Технические культуры',
        children: [
          { name: 'Анис', children: [], features: AGRO_FEATURES },
          { name: 'Горчица', children: [], features: AGRO_FEATURES },
          { name: 'Имбирь', children: [], features: AGRO_FEATURES },
          { name: 'Кориандр', children: [], features: AGRO_FEATURES },
          { name: 'Лавровый лист', children: [], features: AGRO_FEATURES },
          { name: 'Лекарственное растительное сырье', children: [], features: AGRO_FEATURES },
          { name: 'Мак', children: [], features: AGRO_FEATURES },
          { name: 'Мята', children: [], features: AGRO_FEATURES },
          { name: 'Прядильные культуры', children: [], features: AGRO_FEATURES },
          { name: 'Пряные культуры', children: [], features: AGRO_FEATURES },
          { name: 'Сахарный тростник', children: [], features: AGRO_FEATURES },
          { name: 'Стевия', children: [], features: AGRO_FEATURES },
          { name: 'Хлопчатник', children: [], features: AGRO_FEATURES },
          { name: 'Хмель', children: [], features: AGRO_FEATURES },
          { name: 'Хрен', children: [], features: AGRO_FEATURES }
        ]
      },
      {
        name: 'Фрукты. Ягоды',
        children: [
          { name: 'Абрикосы', children: [], features: DEFAULT_FEATURES },
          { name: 'Авокадо', children: [], features: DEFAULT_FEATURES },
          { name: 'Айва', children: [], features: DEFAULT_FEATURES },
          { name: 'Алыча', children: [], features: DEFAULT_FEATURES },
          { name: 'Ананасы', children: [], features: DEFAULT_FEATURES },
          { name: 'Апельсины', children: [], features: DEFAULT_FEATURES },
          { name: 'Арбузы', children: [], features: DEFAULT_FEATURES },
          { name: 'Бананы', children: [], features: DEFAULT_FEATURES },
          { name: 'Барбарис', children: [], features: DEFAULT_FEATURES },
          { name: 'Боярышник', children: [], features: DEFAULT_FEATURES },
          { name: 'Брусника', children: [], features: DEFAULT_FEATURES },
          { name: 'Виноград', children: [], features: DEFAULT_FEATURES },
          { name: 'Вишня', children: [], features: DEFAULT_FEATURES },
          { name: 'Годжи', children: [], features: DEFAULT_FEATURES },
          { name: 'Голубика', children: [], features: DEFAULT_FEATURES },
          { name: 'Гранат', children: [], features: DEFAULT_FEATURES },
          { name: 'Грейпфрут', children: [], features: DEFAULT_FEATURES },
          { name: 'Груши', children: [], features: DEFAULT_FEATURES },
          { name: 'Гуава', children: [], features: DEFAULT_FEATURES },
          { name: 'Дыня', children: [], features: DEFAULT_FEATURES },
          { name: 'Ежевика', children: [], features: DEFAULT_FEATURES },
          { name: 'Жимолость', children: [], features: DEFAULT_FEATURES },
          { name: 'Земляника', children: [], features: DEFAULT_FEATURES },
          { name: 'Инжир', children: [], features: DEFAULT_FEATURES },
          { name: 'Ирга', children: [], features: DEFAULT_FEATURES },
          { name: 'Калина', children: [], features: DEFAULT_FEATURES },
          { name: 'Киви', children: [], features: DEFAULT_FEATURES },
          { name: 'Клубника', children: [], features: DEFAULT_FEATURES },
          { name: 'Клюква', children: [], features: DEFAULT_FEATURES },
          { name: 'Крыжовник', children: [], features: DEFAULT_FEATURES },
          { name: 'Лайм', children: [], features: DEFAULT_FEATURES },
          { name: 'Лимоны', children: [], features: DEFAULT_FEATURES },
          { name: 'Малина', children: [], features: DEFAULT_FEATURES },
          { name: 'Манго', children: [], features: DEFAULT_FEATURES },
          { name: 'Мандарины', children: [], features: DEFAULT_FEATURES },
          { name: 'Маракуйя', children: [], features: DEFAULT_FEATURES },
          { name: 'Можжевеловая ягода', children: [], features: DEFAULT_FEATURES },
          { name: 'Морошка', children: [], features: DEFAULT_FEATURES },
          { name: 'Нектарины', children: [], features: DEFAULT_FEATURES },
          { name: 'Облепиха', children: [], features: DEFAULT_FEATURES },
          { name: 'Папайя', children: [], features: DEFAULT_FEATURES },
          { name: 'Персики', children: [], features: DEFAULT_FEATURES },
          { name: 'Помело', children: [], features: DEFAULT_FEATURES },
          { name: 'Рябина', children: [], features: DEFAULT_FEATURES },
          { name: 'Сливы', children: [], features: DEFAULT_FEATURES },
          { name: 'Смородина', children: [], features: DEFAULT_FEATURES },
          { name: 'Фейхоа', children: [], features: DEFAULT_FEATURES },
          { name: 'Финики', children: [], features: DEFAULT_FEATURES },
          { name: 'Хурма', children: [], features: DEFAULT_FEATURES },
          { name: 'Черёмуха', children: [], features: DEFAULT_FEATURES },
          { name: 'Черешня', children: [], features: DEFAULT_FEATURES },
          { name: 'Черника', children: [], features: DEFAULT_FEATURES },
          { name: 'Шиповник', children: [], features: DEFAULT_FEATURES },
          { name: 'Экзотические фрукты', children: [], features: DEFAULT_FEATURES },
          { name: 'Яблоки', children: [], features: DEFAULT_FEATURES }
        ]
      },
      { name: 'Декоративные культуры', children: [], features: DEFAULT_FEATURES },
      {
        name: 'Техническое сырье',
        children: [
          { name: 'Натуральные оболочки', children: [], features: DEFAULT_FEATURES },
          { name: 'Овечьи шкуры', children: [], features: DEFAULT_FEATURES },
          { name: 'Перо, пух', children: [], features: DEFAULT_FEATURES },
          {
            name: 'Сушеные цветы для кондитерского производства и производства чая',
            children: [],
            features: DEFAULT_FEATURES
          },
          { name: 'Шерсть', children: [], features: DEFAULT_FEATURES },
          { name: 'Шкуры', children: [], features: DEFAULT_FEATURES }
        ]
      },
      {
        name: 'Яйцо',
        children: [],
        features: [
          { name: 'category', label: 'Категория', type: 'select', options: ['С0', 'С1', 'С2'], required: true }
        ]
      }
    ]
  },
  {
    name: 'Сельскохозяйственная техника',
    children: [
      {
        name: 'Запчасти для сельхозтехники',
        children: [
          { name: 'Для комбайнов и жаток', children: [], features: TECH_FEATURES },
          { name: 'Для кормозаготовительной техники', children: [], features: TECH_FEATURES },
          { name: 'Для опрыскивателей', children: [], features: TECH_FEATURES },
          { name: 'Для погрузчиков', children: [], features: TECH_FEATURES },
          { name: 'Для посевной техники', children: [], features: TECH_FEATURES },
          { name: 'Для почвообрабатывающей техники', children: [], features: TECH_FEATURES },
          { name: 'Для прочих с/х полевых машин', children: [], features: TECH_FEATURES },
          { name: 'Для с/х прицепов', children: [], features: TECH_FEATURES },
          { name: 'Для тракторов', children: [], features: TECH_FEATURES },
          { name: 'Для уборочной техники', children: [], features: TECH_FEATURES }
        ]
      },
      { name: 'Кормозаготовительная техника', children: [], features: TECH_FEATURES },
      {
        name: 'Оборудование для тракторов и с/х транспорта',
        children: [
          { name: 'Бульдозерные отвалы', children: [], features: TECH_FEATURES },
          { name: 'Грузозахватные механизмы', children: [], features: TECH_FEATURES },
          { name: 'Грузоподъемное оборудование', children: [], features: TECH_FEATURES },
          { name: 'Грунторезы (баровое оборудование)', children: [], features: TECH_FEATURES },
          { name: 'Загрузочные шнеки', children: [], features: TECH_FEATURES }
        ]
      },
      { name: 'Опрыскиватели', children: [], features: TECH_FEATURES },
      { name: 'Посевная техника', children: [], features: TECH_FEATURES },
      {
        name: 'Почвообрабатывающая техника',
        children: [
          { name: 'Бороны', children: [], features: TECH_FEATURES },
          { name: 'Глубокорыхлители', children: [], features: TECH_FEATURES },
          { name: 'Гребнеобразователи', children: [], features: TECH_FEATURES },
          { name: 'Камнеподборщики', children: [], features: TECH_FEATURES },
          { name: 'Канавокопатели', children: [], features: TECH_FEATURES },
          { name: 'Катки', children: [], features: TECH_FEATURES },
          { name: 'Комбинированные агрегаты', children: [], features: TECH_FEATURES },
          { name: 'Компакторы', children: [], features: TECH_FEATURES },
          { name: 'Культиваторы', children: [], features: TECH_FEATURES },
          { name: 'Лущильники', children: [], features: TECH_FEATURES },
          { name: 'Машины для формирования парников', children: [], features: TECH_FEATURES },
          { name: 'Мульчировщики', children: [], features: TECH_FEATURES },
          { name: 'Окучники', children: [], features: TECH_FEATURES },
          { name: 'Планировщики почвы', children: [], features: TECH_FEATURES },
          { name: 'Пленкоукладчики', children: [], features: TECH_FEATURES },
          { name: 'Плуги', children: [], features: TECH_FEATURES },
          { name: 'Прополочные машины', children: [], features: TECH_FEATURES },
          { name: 'Фрезы', children: [], features: TECH_FEATURES }
        ]
      },
      { name: 'Прицепы и полуприцепы', children: [], features: TECH_FEATURES },
      { name: 'Техника для внесения удобрения', children: [], features: TECH_FEATURES },
      { name: 'Тракторы сельскохозяйственные', children: [], features: TECH_FEATURES },
      {
        name: 'Уборочная техника',
        children: [
          { name: 'Ботвоудалители', children: [], features: TECH_FEATURES },
          { name: 'Жатки', children: [], features: TECH_FEATURES },
          { name: 'Измельчитель соломы', children: [], features: TECH_FEATURES },
          { name: 'Картофелекопатели', children: [], features: TECH_FEATURES },
          { name: 'Комбайны', children: [], features: TECH_FEATURES },
          { name: 'Лукокопатели', children: [], features: TECH_FEATURES }
        ]
      },
      { name: 'Агродроны', children: [], features: TECH_FEATURES },
      {
        name: 'Грузовой с/х транспорт',
        children: [
          { name: 'Зерновозы', children: [], features: TECH_FEATURES },
          { name: 'Кормовозы', children: [], features: TECH_FEATURES },
          { name: 'Молоковозы', children: [], features: TECH_FEATURES },
          { name: 'Сельхозники', children: [], features: TECH_FEATURES },
          { name: 'Скотовозы', children: [], features: TECH_FEATURES }
        ]
      },
      { name: 'Мини-техника, мотокультиваторы, мотоблоки', children: [], features: TECH_FEATURES },
      { name: 'Навигационные и контрольные системы', children: [], features: TECH_FEATURES },
      { name: 'Погрузчики', children: [], features: TECH_FEATURES },
      { name: 'Прочая сельскохозяйственная техника', children: [], features: TECH_FEATURES },
      { name: 'Техника для животноводства', children: [], features: TECH_FEATURES },
      { name: 'Техника для полива и орошения', children: [], features: TECH_FEATURES },
      { name: 'Техника для садоводства', children: [], features: TECH_FEATURES },
      { name: 'Техника для хранения зерна в рукавах', children: [], features: TECH_FEATURES }
    ]
  },
  {
    name: 'Тара и упаковка',
    children: [
      { name: 'Маркировочное и этикетировочное оборудование', children: [], features: EQUIP_FEATURES },
      { name: 'Оборудование для производства упаковки', children: [], features: EQUIP_FEATURES },
      { name: 'Пластиковые емкости крупногабаритные', children: [], features: MATERIAL_FEATURES },
      { name: 'Тара, упаковка', children: [], features: MATERIAL_FEATURES },
      { name: 'Упаковочное и фасовочное оборудование', children: [], features: EQUIP_FEATURES },
      { name: 'Упаковочные материалы и сырье', children: [], features: MATERIAL_FEATURES }
    ]
  },
  {
    name: 'Прочее',
    children: [
      { name: 'Ангары и каркасно-тентовые конструкции', children: [], features: OTHER_FEATURES },
      { name: 'Веники и травы для бани', children: [], features: OTHER_FEATURES },
      { name: 'Горюче-смазочные материалы', children: [], features: OTHER_FEATURES },
      { name: 'Пеллеты, дрова, топливные брикеты, уголь древесный', children: [], features: OTHER_FEATURES },
      {
        name: 'Программное обеспечение АПК',
        children: [],
        features: [{ name: 'version', label: 'Версия', type: 'text', required: true }]
      },
      { name: 'Прочая спецтехника', children: [], features: OTHER_FEATURES },
      { name: 'Прочие с/х товары', children: [], features: OTHER_FEATURES },
      { name: 'Различные товары для пищевой промышленности', children: [], features: OTHER_FEATURES },
      {
        name: 'Различные товары для сельского хозяйства',
        children: [
          { name: 'Амуниция для лошадей', children: [], features: OTHER_FEATURES },
          { name: 'Ветеринарные и зоотехнические товары', children: [], features: OTHER_FEATURES },
          { name: 'Влагомеры', children: [], features: OTHER_FEATURES },
          { name: 'Кассеты и горшки для рассады', children: [], features: OTHER_FEATURES },
          { name: 'Комплектующие для шпалеры', children: [], features: OTHER_FEATURES },
          { name: 'Напольные покрытия для животноводства', children: [], features: OTHER_FEATURES },
          { name: 'Определители почвенного контроля', children: [], features: OTHER_FEATURES },
          { name: 'Опрыскиватели ранцевые', children: [], features: OTHER_FEATURES },
          { name: 'Опрыскиватели садовые ручные', children: [], features: OTHER_FEATURES },
          { name: 'Органический материал для мульчирования', children: [], features: OTHER_FEATURES },
          { name: 'Подстилки для с/х животных', children: [], features: OTHER_FEATURES },
          { name: 'Полимерные рукава для хранение с.х. продукции', children: [], features: OTHER_FEATURES },
          { name: 'Пчелоинвентарь', children: [], features: OTHER_FEATURES },
          { name: 'Расходные материалы', children: [], features: OTHER_FEATURES },
          { name: 'Садовый инвентарь', children: [], features: OTHER_FEATURES },
          { name: 'Сеялки ручные', children: [], features: OTHER_FEATURES },
          { name: 'Спецодежда', children: [], features: OTHER_FEATURES },
          { name: 'Средства защиты от насекомых и грызунов', children: [], features: OTHER_FEATURES },
          { name: 'Укрывной материал, пленка, агроткань', children: [], features: OTHER_FEATURES },
          { name: 'Шпагат и сетка', children: [], features: OTHER_FEATURES }
        ]
      },
      { name: 'С/х отходы и побочные продукты производства', children: [], features: OTHER_FEATURES },
      {
        name: 'Книги, документация, аграрные издания',
        children: [],
        features: [{ name: 'author', label: 'Автор/Издательство', type: 'text', required: false }]
      }
    ]
  }
]
