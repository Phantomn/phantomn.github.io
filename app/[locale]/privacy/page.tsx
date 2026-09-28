import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Shield } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import LocaleToggle from '@/components/LocaleToggle'
import portfolioData from '@/data/portfolio.json'
import { pageAlternates } from '@/lib/seo'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('privacy')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/privacy/'),
  }
}

// 오늘 날짜. 저자 원본의 고정 날짜가 아니라 GA 안내를 반영한 최종 수정일.
const LAST_UPDATED = '2026-09-23'

export default async function PrivacyPolicyPage({ params }: Params) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('privacy')
  const { email } = portfolioData.personal

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <div className="border-b border-line">
        <div className="container-max section-padding py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="link-accent inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft size={20} className="mr-2" />
              {t('backToHome')}
            </Link>
            <LocaleToggle />
          </div>

          <div className="mb-4 flex items-center">
            <Shield size={32} className="mr-3 text-faint" />
            <h1 className="section-title">{t('title')}</h1>
          </div>

          <p className="text-lg text-muted">
            {t('lastUpdated')}: {LAST_UPDATED}
          </p>
        </div>
      </div>

      <div className="container-max section-padding py-12">
        <div className="mx-auto max-w-4xl">
          <div className="panel p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('shortTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('shortBody')}</p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('storesTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('storesTheme')}</p>
                <p className="mt-4 leading-relaxed text-muted">
                  {t.rich('storesGa', {
                    policy: (chunks) => (
                      <a
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-accent"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
                <p className="mt-4 leading-relaxed text-muted">
                  {t.rich('storesOptOut', {
                    optout: (chunks) => (
                      <a
                        href="https://tools.google.com/dlpage/gaoptout"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-accent"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('hostingTitle')}</h2>
                <p className="leading-relaxed text-muted">
                  {t.rich('hostingBody', {
                    github: (chunks) => (
                      <a
                        href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-accent"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('emailTitle')}</h2>
                <p className="leading-relaxed text-muted">
                  {t.rich('emailBody', {
                    mail: () => (
                      <a href={`mailto:${email}`} className="link-accent">
                        {email}
                      </a>
                    ),
                  })}
                </p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('linksTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('linksBody')}</p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('changesTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('changesBody')}</p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
