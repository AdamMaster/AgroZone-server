import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { TypeBaseProviderOptions } from './types/base-provider.options.type'
import { TypeUserInfo } from './types/user-info.types'
import { TypeTokenResponse } from './types/oauth-responses.types'

interface ITokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  token_type?: string
}

@Injectable()
export class BaseOAuthService {
  private BASE_URL!: string

  constructor(private readonly options: TypeBaseProviderOptions) {}

  protected async extractUserInfo(data: any): Promise<TypeUserInfo> {
    return {
      ...data,
      provider: this.options.name
    }
  }

  getAuthUrl() {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.options.client_id,
      redirect_uri: this.getRedirectUrl(),
      scope: (this.options.scopes ?? []).join(' '),
      access_type: 'offline',
      prompt: 'select_account'
    })

    return `${this.options.authorize_url}?${query}`
  }

  async findUserByCode(code: string): Promise<TypeUserInfo> {
    const client_id = this.options.client_id
    const client_secret = this.options.client_secret

    const tokenQuery = new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri: this.getRedirectUrl(),
      grant_type: 'authorization_code'
    })

    const tokensRequest = await fetch(this.options.access_url, {
      method: 'POST',
      body: tokenQuery,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      }
    })

    if (!tokensRequest.ok) {
      throw new BadRequestException(
        `Не удалось получить пользователя с ${this.options.profile_url}. Проверьте правильность токена доступа.`
      )
    }

    const tokens = await tokensRequest.json()

    if (!tokens.access_token) {
      throw new BadRequestException(
        `Нет токенов с ${this.options.access_url}. Убедитесь, что код авторизации действителен.`
      )
    }

    const userRequest = await fetch(this.options.profile_url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    })

    if (!userRequest.ok) {
      throw new UnauthorizedException(
        `Не удалось получить пользователя с ${this.options.profile_url}. Проверьте правильность токена доступа.`
      )
    }

    const user = await userRequest.json()
    const userData = await this.extractUserInfo(user)

    return {
      ...userData,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at || tokens.expires_in,
      provider: this.options.name
    }
  }

  getRedirectUrl() {
    return `${this.BASE_URL}/auth/oauth/callback/${this.options.name}`
  }

  set baseUrl(value: string) {
    this.BASE_URL = value
  }

  get name() {
    return this.options.name
  }

  get accessUrl() {
    return this.options.access_url
  }

  get profileUrl() {
    return this.options.profile_url
  }

  get scopes() {
    return this.options.scopes
  }
}
