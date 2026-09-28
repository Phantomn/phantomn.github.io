import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { GoogleAnalytics } from '@next/third-parties/google'
import { routing, SOURCE_LOCALE, type Locale } from '@/i18n/routing'
import { pageAlternates } from '@/lib/seo'
import { DynamicTranslator } from '@/components/dynamic-translator'
import portfolioData from '@/data/portfolio.json'
import '@/app/globals.css'

// The CSS variable keeps Tailwind's font-sans token pointing at the self-hosted
// next/font family; nothing else loads a face literally named "Inter".
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// 400 covers eyebrows/chips/body mono; 600 gives the hero stat digits a real
// semibold face instead of browser-synthesized bold.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-jetbrains-mono',
})

const siteDescription = portfolioData.personal.description
/*
 * 사이트 부제. portfolio.json 의 personal.title 은 한글이 섞여 있어(사이트 표기용이 아니라
 * 이력 표기용) 영어 메타데이터에 쓸 수 없다. 세 곳(title/openGraph/twitter)이 갈라지지
 * 않도록 여기 한 번만 적는다.
 */
const SITE_TAGLINE = 'Vulnerability Research & OT/ICS Security'
const SITE_TITLE = `${portfolioData.personal.name} - ${SITE_TAGLINE}`

export const metadata: Metadata = {
  metadataBase: new URL('https://blog.ph4nt0m.xyz'),
  title: {
    default: SITE_TITLE,
    template: `%s - ${portfolioData.personal.name}`,
  },
  description: siteDescription,
  keywords: [
    'vulnerability research',
    'penetration testing',
    'OT security',
    'ICS security',
    'IEC 62443',
    'IoT security',
    'firmware analysis',
    'medical device security',
    'Linux kernel',
    'fuzzing',
    'cyber range',
  ],
  authors: [{ name: portfolioData.personal.name }],
  alternates: pageAlternates('/'),
  openGraph: {
    type: 'website',
    url: 'https://blog.ph4nt0m.xyz',
    siteName: portfolioData.personal.name,
    title: SITE_TITLE,
    description: siteDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: siteDescription,
    creator: `@${portfolioData.personal.social.twitter}`,
  },
}

// Runs before paint to apply the saved theme and avoid a flash. Dark is the
// default; only an explicit 'light' preference removes the `dark` class.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

// 정적 내보내기: 로케일마다 페이지를 빌드 시점에 생성한다.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as Locale)) notFound()

  // 정적 렌더링에서 각 로케일을 독립적으로 그리려면 컨텍스트를 명시해야 한다.
  setRequestLocale(locale)
  // client 컴포넌트(Header 등)의 useTranslations 가 읽을 메시지를 내려보낸다.
  const messages = await getMessages()
  const t = await getTranslations('common')

  return (
    <html
      lang={locale}
      className={`dark scroll-smooth ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="alternate"
          type="application/json"
          href="/.well-known/claims.json"
          title="Verifiable professional claims"
        />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM site index" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/*
            콘텐츠 원본은 한글 하나. 저작 언어(SOURCE_LOCALE)가 아닌 로케일에서는 페이지
            전체를 런타임 번역한다. 페이지마다 감싸면 홈처럼 빠뜨려 한글이 새므로, 로케일
            레이아웃 한 곳에서 감싸 모든 페이지가 균일하게 덮이도록 한다. contentKey 는
            사이트 전역 하나로 둬 같은 문구를 페이지 간 캐시 재사용한다.
          */}
          <DynamicTranslator
            enabled={locale !== SOURCE_LOCALE}
            targetLocale={locale}
            contentKey="site"
          >
            {children}
          </DynamicTranslator>
        </NextIntlClientProvider>
      </body>
      <GoogleAnalytics gaId="G-KV41V41G5J" />
    </html>
  )
}
