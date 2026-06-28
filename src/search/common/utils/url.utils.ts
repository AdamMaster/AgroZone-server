export function buildAdUrl(params: { categoryPath: string[]; slug: string }) {
  const path = params.categoryPath
    .filter(Boolean)
    .map(slug => slug.trim())
    .join('/')

  return `/catalog/${path}/${params.slug}`.replace(/\/+/g, '/')
}
