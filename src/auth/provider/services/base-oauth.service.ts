import { Injectable } from '@nestjs/common'
import { TypeBaseProviderOptions } from './types/base-provider.options.type'

@Injectable()
export class BaseOAuthService {
  private BASE_URL: string

  constructor(private readonly options: TypeBaseProviderOptions) {}

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
