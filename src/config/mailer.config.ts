import { MailerOptions } from '@nestjs-modules/mailer'
import { ConfigService } from '@nestjs/config'

export const getMailerConfig = async (configService: ConfigService): Promise<MailerOptions> => ({
  transport: {
    host: configService.getOrThrow<string>('MAIL_HOST'),
    port: configService.getOrThrow<number>('MAIL_PORT'),
    // secure должен зависеть от порта, а не от окружения:
    // 465 -> implicit TLS (secure: true), 587/25 -> STARTTLS (secure: false)
    secure: Number(configService.getOrThrow<number>('MAIL_PORT')) === 465,
    auth: {
      user: configService.getOrThrow<string>('MAIL_LOGIN'),
      pass: configService.getOrThrow<string>('MAIL_PASSWORD')
    }
  },
  defaults: {
    from: `"AgroZone" ${configService.getOrThrow<string>('MAIL_LOGIN')}`
  }
})
