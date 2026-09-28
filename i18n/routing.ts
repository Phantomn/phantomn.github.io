import { defineRouting } from 'next-intl/routing'

/*
 * 기본은 한글, 영어 전환 가능. 정적 내보내기(output: 'export')는 middleware 를
 * 못 쓰므로 localePrefix: 'always' 가 필수다 - 모든 경로가 /ko 또는 /en 으로 시작한다.
 * bare "/" 는 app/page.tsx 가 기본 로케일로 리다이렉트한다.
 */
export const routing = defineRouting({
  locales: ['ko', 'en'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

/*
 * 콘텐츠(포트폴리오 데이터·블로그 글·UI 메시지)가 저작된 언어 = 영어. 사이트는 영어를
 * 유일 소스로 저작하고, 그 밖의 로케일은 DynamicTranslator 가 런타임 번역한다.
 * defaultLocale 도 'en' 이라 /en 은 저작 영어를 그대로 SSR(번역기 off, SEO 정상),
 * /ko 는 DT 가 en->ko 로 번역한다(SOURCE_LOCALE 이 DT 의 출발어).
 */
export const SOURCE_LOCALE: Locale = 'en'

// BCP 47 로케일 태그(번역 API 의 source/target 파라미터용). 포크는 ko/en 만 쓴다.
export function toBcp47(locale: string): string {
  return locale === 'ko' ? 'ko-KR' : 'en-US'
}
