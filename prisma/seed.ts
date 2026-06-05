import { PrismaClient } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface CategoryInput {
  name: string
  children?: { name: string }[]
}

const categoriesData: CategoryInput[] = [
  {
    name: 'Сельскохозяйственная техника, оборудование и запчасти',
    children: [
      { name: 'Агродроны (беспилотные летательные аппараты)' },
      { name: 'Комбайны (зерноуборочные, кормоуборочные, картофелеуборочные и др.)' },
      { name: 'Запчасти, комплектующие, расходные материалы' },
      { name: 'Оборудование для полива, орошения и поливомоечные машины' },
      { name: 'Почвообрабатывающая техника и оборудование' },
      { name: 'Посевная и посадочная техника' },
      { name: 'Тракторы (гусеничные, колесные, мини-тракторы)' }
    ]
  },
  {
    name: 'Сельскохозяйственная продукция и сырье',
    children: [
      { name: 'Зерновые, зернобобовые и масличные культуры' },
      { name: 'Животные и птица (живок)' },
      { name: 'Овощи, фрукты, ягоды, грибы, орехи свежие' },
      { name: 'Семена, саженцы, посадочный материал' }
    ]
  }
]

async function main(): Promise<void> {
  console.log('Начало заполнения базы данных категориями (TS)...')

  // Очищаем старые категории, чтобы не было дублей
  await prisma.category.deleteMany()

  for (const parentCat of categoriesData) {
    // Создаем главную категорию
    const createdParent = await prisma.category.create({
      data: {
        name: parentCat.name
      }
    })

    console.log(`Создана главная категория: ${createdParent.name}`)

    // Создаем вложенные подкатегории
    if (parentCat.children && parentCat.children.length > 0) {
      for (const childCat of parentCat.children) {
        await prisma.category.create({
          data: {
            name: childCat.name,
            parentId: createdParent.id
          }
        })
      }
    }
  }

  console.log('Заполнение успешно завершено!')
}

main()
  .catch((e: unknown) => {
    console.error('Ошибка при заполнении БД:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
