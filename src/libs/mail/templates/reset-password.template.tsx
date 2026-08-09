import { Html } from '@react-email/html'
import { Body, Heading, Text, Link, Tailwind } from '@react-email/components'
import * as React from 'react'

interface ResetPasswordTemplateProps {
  domain: string
  token: string
}

export function ResetPasswordTemplate({ domain, token }: ResetPasswordTemplateProps) {
  const resetLink = `${domain}/new-password?token=${token}`

  return (
    <Tailwind>
      <Html>
        <Body className='text-black'>
          <Heading as='h2'>Сброс пароля</Heading>
          <Text>Пожалуйста, перейдите по следующей ссылке, чтобы создать новый пароль:</Text>
          <Link className='px-3 py-1.5 inline-block rounded-lg text-white mb-8 bg-[#5ea500]' href={resetLink}>
            Подтвердить сброс пароля
          </Link>
          <Text className='text-gray-500'>
            Эта ссылка действительна в течение 1 часа. Если вы не запрашивали подтверждение, просто проигнорируйте это
            сообщение.
          </Text>
          <Text className='text-gray-500'>Спасибо за использование нашего сервиса!</Text>
        </Body>
      </Html>
    </Tailwind>
  )
}
