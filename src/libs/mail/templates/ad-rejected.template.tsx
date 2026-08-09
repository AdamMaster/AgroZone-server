import { Html } from '@react-email/html'
import { Body, Heading, Text, Link, Tailwind } from '@react-email/components'
import * as React from 'react'

interface AdRejectedTemplateProps {
  domain: string
  adId: string
  adTitle: string
  reason: string | null
}

export function AdRejectedTemplate({ domain, adId, adTitle, reason }: AdRejectedTemplateProps) {
  const editLink = `${domain}/ads/${adId}/edit`

  return (
    <Tailwind>
      <Html>
        <Body className='text-black'>
          <Heading as='h2'>Объявление отклонено</Heading>
          <Text>
            Модератор отклонил объявление «{adTitle}»{reason ? ' по следующей причине:' : '.'}
          </Text>
          {reason && <Text className='text-gray-500'>{reason}</Text>}
          <Link className='px-3 py-1.5 inline-block rounded-lg text-white mb-8 bg-[#5ea500]' href={editLink}>
            Исправить объявление
          </Link>
          <Text className='text-gray-500'>
            Поправьте объявление с учётом причины и сохраните — оно автоматически отправится на повторную проверку
            модератору.
          </Text>
          <Text className='text-gray-500'>Спасибо за использование нашего сервиса!</Text>
        </Body>
      </Html>
    </Tailwind>
  )
}
