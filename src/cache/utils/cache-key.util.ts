export function buildCacheKey(prefix: string, args: unknown[]): string {
  const normalizedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return JSON.stringify(
        Object.keys(arg)
          .sort()
          .reduce(
            (acc, key) => {
              acc[key] = (arg as any)[key]
              return acc
            },
            {} as Record<string, unknown>
          )
      )
    }

    return String(arg)
  })

  return `${prefix}:${normalizedArgs.join(':')}`
}
