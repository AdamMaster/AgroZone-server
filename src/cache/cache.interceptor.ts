import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable, from } from 'rxjs'
import { switchMap, tap } from 'rxjs/operators'
import { CacheService } from './cache.service'

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()

    const key = this.buildKey(req)

    return from(this.cacheService.get<any>(key)).pipe(
      switchMap(cached => {
        if (cached) {
          return new Observable(observer => {
            observer.next(cached)
            observer.complete()
          })
        }

        return next.handle().pipe(
          tap(result => {
            this.cacheService.set(key, result, 300, ['search']).catch(() => {})
          })
        )
      })
    )
  }

  private buildKey(req: any): string {
    const sortedQuery = Object.keys(req.query || {})
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = req.query[key]
          return acc
        },
        {} as Record<string, any>
      )

    return `cache:${req.method}:${req.path}:${JSON.stringify(sortedQuery)}`
  }
}
