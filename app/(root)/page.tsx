'use client'

import { useEffect } from 'react'
import { routing } from '@/i18n/routing'

// 정적 내보내기는 서버 리다이렉트를 못 쓴다. 기본은 영어(defaultLocale)로 보낸다.
// 브라우저 언어는 보지 않는다 - 사이트 기본을 en 으로 고정하기로 했다. 사용자가
// 직접 ko 를 고르면(preferred-locale 저장) 그 선택만 존중한다.
export default function RootRedirect() {
  useEffect(() => {
    const { locales, defaultLocale } = routing
    const list = locales as readonly string[]
    let stored: string | null = null
    try {
      stored = localStorage.getItem('preferred-locale')
    } catch {
      /* private mode 등에서 접근 실패 - 무시 */
    }
    const candidate = (stored && list.includes(stored) && stored) || defaultLocale
    window.location.replace(`/${candidate}/`)
  }, [])

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Loading…</div>
  )
}
