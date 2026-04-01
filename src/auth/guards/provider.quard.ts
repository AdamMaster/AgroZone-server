import { Request } from 'express'
import { ProviderService } from './../provider/provider.service'
import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class AuthProviderGuard implements CanActivate {
  constructor(private readonly providerService: ProviderService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()

    const provider = request.params.provider

    const providerInstance = this.providerService.findByService(provider as string)

    if (!providerInstance) {
      throw new NotFoundException(
        `Провайдер "${provider}" не найден. Пожалуйста, проверьте правильность введенных данных.`
      )
    }

    return true
  }
}
