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
          <Heading>Сброс пароля</Heading>
          <Text>
            Привет! Вы запросили сброс пароля. Пожалуйста, перейдите по следующей ссылке, чтобы создать новый пароль:
          </Text>
          <Link href={resetLink}>Подтвердить сброс пароля</Link>
          <Text>
            Эта ссылка действительна в течение 1 часа. Если вы не запрашивали подтверждение, просто проигнорируйте это
            сообщение.
          </Text>
          <Text>Спасибо за использование нашего сервиса!</Text>
        </Body>
      </Html>
    </Tailwind>
  )
}
