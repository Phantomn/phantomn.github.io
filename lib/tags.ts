import { getAllPostsMeta } from '@/lib/blog'

export const normalizeTag = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-')

export function getAllTags() {
  const counts = new Map<string, number>()
  for (const post of getAllPostsMeta()) {
    for (const tag of post.tags) {
      const key = normalizeTag(tag)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function getPostsByTag(tag: string) {
  const key = normalizeTag(tag)
  return getAllPostsMeta().filter((post) => post.tags.some((t) => normalizeTag(t) === key))
}
