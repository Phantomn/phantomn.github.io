'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Search as SearchIcon, X } from 'lucide-react'

interface SearchEntry {
  slug: string
  title: string
  description: string
  tags: string[]
  type: 'blog' | 'cve' | 'writeup'
}

const TYPE_LABEL: Record<SearchEntry['type'], string> = {
  blog: 'Blog',
  cve: 'CVE',
  writeup: 'Writeup',
}

function score(entry: SearchEntry, query: string): number {
  const q = query.toLowerCase()
  let s = 0
  if (entry.tags.some((t) => t.toLowerCase() === q)) s += 10
  if (entry.title.toLowerCase().includes(q)) s += 5
  if (entry.tags.some((t) => t.toLowerCase().includes(q))) s += 3
  if (entry.description.toLowerCase().includes(q)) s += 1
  return s
}

// 전역 검색. Header 에서 아이콘 버튼으로 노출되고, 클릭하면 입력창+결과
// 패널이 버튼 아래로 펼쳐진다. 인덱스는 빌드타임에 생성된
// /search-index.json 을 열 때 한 번만 fetch 한다.
export default function Search({ className = 'h-10 w-10' }: { className?: string }) {
  const t = useTranslations('blog')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || entries.length > 0) return
    fetch('/search-index.json')
      .then((res) => res.json())
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [open, entries.length])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  const results = useMemo(() => {
    if (query.trim().length < 2) return []
    return entries
      .map((entry) => ({ entry, s: score(entry, query.trim()) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((r) => r.entry)
  }, [entries, query])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('searchLabel')}
        aria-expanded={open}
        className={`focus-ring inline-flex items-center justify-center rounded-md text-muted transition-colors hover:text-fg ${className}`}
      >
        {open ? <X size={18} /> : <SearchIcon size={18} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-surface p-3 shadow-xl shadow-black/10 sm:w-96">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
          {query.trim().length >= 2 && (
            <ul className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto">
              {results.length === 0 ? (
                <li className="px-1 py-2 text-sm text-muted">{t('noResults')}</li>
              ) : (
                results.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/blog/${entry.slug}`}
                      onClick={() => setOpen(false)}
                      className="focus-ring flex flex-col gap-0.5 rounded-md p-2 hover:bg-bg"
                    >
                      <span className="text-xs uppercase text-faint">
                        {TYPE_LABEL[entry.type]}
                      </span>
                      <span className="text-sm font-medium text-fg">{entry.title}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
