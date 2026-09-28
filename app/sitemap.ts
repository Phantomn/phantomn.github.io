import type { MetadataRoute } from 'next'
import { getAllPostsMeta } from '@/lib/blog'
import { getAllTags } from '@/lib/tags'
import { routing } from '@/i18n/routing'
export const dynamic = 'force-static'

const BASE = 'https://blog.ph4nt0m.xyz'

// localePrefix: 'always' 라 모든 경로가 /ko, /en 으로 존재한다. 로케일마다 URL 을 낸다.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'monthly', priority: 1 },
    { path: 'blog/', changeFrequency: 'weekly', priority: 0.9 },
    { path: 'research/', changeFrequency: 'monthly', priority: 0.8 },
    { path: 'findings/', changeFrequency: 'monthly', priority: 0.8 },
    { path: 'recruiter-brief/', changeFrequency: 'monthly', priority: 0.9 },
    { path: 'privacy/', changeFrequency: 'yearly', priority: 0.3 },
    { path: 'terms/', changeFrequency: 'yearly', priority: 0.3 },
  ]
  const posts = getAllPostsMeta()
  const tags = getAllTags()

  const routes: MetadataRoute.Sitemap = []
  for (const locale of routing.locales) {
    for (const { path, changeFrequency, priority } of paths) {
      routes.push({ url: `${BASE}/${locale}/${path}`, changeFrequency, priority })
    }
    for (const post of posts) {
      routes.push({
        url: `${BASE}/${locale}/blog/${post.slug}/`,
        lastModified: new Date(`${post.date}T00:00:00Z`),
        changeFrequency: 'yearly',
        priority: 0.7,
      })
    }
    routes.push({ url: `${BASE}/${locale}/tags/`, changeFrequency: 'weekly', priority: 0.5 })
    for (const { tag } of tags) {
      routes.push({
        url: `${BASE}/${locale}/tags/${encodeURIComponent(tag)}/`,
        changeFrequency: 'weekly',
        priority: 0.4,
      })
    }
  }
  return routes
}
