#!/usr/bin/env node
// postbuild 훅에서 실행(pnpm build 뒤 자동) — content/posts/*.md 를 읽어
// out/search-index.json 을 쓴다. href 는 저장하지 않는다: 클라이언트가
// 현재 로케일로 `/${locale}/blog/${slug}/` 를 조립한다.
import fs from 'fs'
import path from 'path'
import { load } from 'js-yaml'

const DIR = path.join(process.cwd(), 'content', 'posts')
const OUT = path.join(process.cwd(), 'out', 'search-index.json')
const FM = /^---\r?\n([\s\S]*?)\r?\n---/

// type 유도: 슬러그 prefix 또는 tags 로 cve/fve 판정(MariaDB 처럼 슬러그가
// cve- 로 시작하지 않는 CVE 글도 tags 로 잡는다), writeup 은 ctf/wargame 계열.
function deriveType(slug, tags) {
  if (/^(cve|fve)-/i.test(slug) || tags.some((t) => ['cve', 'fve'].includes(t))) return 'cve'
  if (tags.some((t) => ['writeup', 'ctf', 'wargame'].includes(t))) return 'writeup'
  return 'blog'
}

const entries = fs
  .readdirSync(DIR)
  .filter((f) => /\.mdx?$/.test(f) && !/^_index\./.test(f))
  .map((f) => {
    const m = FM.exec(fs.readFileSync(path.join(DIR, f), 'utf-8'))
    const data = m ? (load(m[1]) ?? {}) : {}
    const slug = f.replace(/\.mdx?$/, '')
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
    return {
      slug,
      title: data.title ?? slug,
      description: data.excerpt ?? '',
      tags,
      type: deriveType(slug, tags),
    }
  })

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(entries))
console.log(`search-index: ${entries.length} entries`)
