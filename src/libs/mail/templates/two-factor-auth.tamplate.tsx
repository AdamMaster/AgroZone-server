import { Html } from '@react-email/html'
import { Body, Heading, Text, Tailwind } from '@react-email/components'
import * as React from 'react'

interface TwoFactorAuthTemplateProps {
  token: string
}

export function TwoFactorAuthTemplate({ token }: TwoFactorAuthTemplateProps) {
  return (
    <Tailwind>
      <Html>
        <Body className='text-black'>
          <Heading as='h2'>Двухфакторная аутентификация</Heading>
          <Text>Ваш код подтверждения:</Text>
          <Text className='text-2xl py-3 px-4 rounded-lg bg-gray-100 inline-block'>
            <strong>{token}</strong>
          </Text>
          <Text>Пожалуйста, введите этот код в приложении для завершения процесса аутентификации.</Text>
          <Text className='text-gray-500'>Если вы не запрашивали этот код, просто проигнорируйте это сообщение.</Text>
        </Body>
      </Html>
    </Tailwind>
  )
}
