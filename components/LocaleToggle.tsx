'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

/**
 * ko/en 전환. 로케일이 둘뿐이라 드롭다운 대신 반대 언어로 가는 버튼 하나.
 * 같은 페이지의 다른 로케일로 이동한다(pathname 은 로케일 접두어가 빠진 경로).
 * data-notranslate: /ko 에서 DynamicTranslator 가 버튼 글자를 번역하지 않게.
 */
export default function LocaleToggle({ className = 'h-10 w-10' }: { className?: string }) {
  const t = useTranslations('common')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const next = locale === 'ko' ? 'en' : 'ko'

  return (
    <button
      type="button"
      data-notranslate
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={next === 'ko' ? t('switchToKorean') : t('switchToEnglish')}
      className={`focus-ring inline-flex items-center justify-center rounded-md font-mono text-xs font-semibold text-muted transition-colors hover:text-fg ${className}`}
    >
      {next.toUpperCase()}
    </button>
  )
}
