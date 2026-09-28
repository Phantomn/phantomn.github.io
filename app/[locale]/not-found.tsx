'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, FileSearch, FlaskConical, Rss } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'
import portfolioData from '@/data/portfolio.json'

// The Jekyll-era site lived at these URLs for years; the shims under public/
// cover known posts, but decayed or mistyped inbound links still land here.
const destinations = [
  { href: '/findings/', icon: FileSearch, key: 'findings' },
  { href: '/research/', icon: FlaskConical, key: 'research' },
  { href: '/blog/', icon: Rss, key: 'blog' },
] as const

export default function NotFound() {
  const t = useTranslations('notFound')
  const { email } = portfolioData.personal

  return (
    <main id="main-content" className="flex min-h-screen flex-col bg-bg">
      <div className="border-b border-line">
        <div className="container-max section-padding flex items-center justify-between py-8">
          <Link
            href="/"
            className="link-accent inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft size={20} className="mr-2" aria-hidden="true" />
            {t('backToPortfolio')}
          </Link>
          <div className="flex items-center">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container-max section-padding flex flex-1 flex-col justify-center py-16 md:py-24">
        <p className="eyebrow mb-3 text-accent">{t('eyebrow')}</p>
        <h1 className="section-title mb-5">{t('title')}</h1>
        <p className="max-w-2xl text-xl leading-relaxed text-muted">{t('body')}</p>

        <div className="mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {destinations.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring group rounded-xl border border-line bg-surface/50 p-6 transition-colors hover:border-line-strong hover:bg-surface"
            >
              <item.icon size={20} className="mb-4 text-accent" aria-hidden="true" />
              <h2 className="font-medium text-fg group-hover:text-accent">
                {t(`destinations.${item.key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t(`destinations.${item.key}.description`)}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-12 max-w-2xl text-sm leading-relaxed text-faint">
          {t('lookingFor')}{' '}
          <a href={`mailto:${email}`} className="link-accent">
            {t('emailMe')}
          </a>{' '}
          {t('pointYou')}
        </p>
      </div>
    </main>
  )
}
