import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import LocaleToggle from '@/components/LocaleToggle'
import { ArrowLeft, Scale } from 'lucide-react'
import portfolioData from '@/data/portfolio.json'
import { pageAlternates } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'terms' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/terms/'),
  }
}

const LAST_UPDATED = 'September 23, 2026'

export default async function DisclaimerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('terms')
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
            <Scale size={32} className="mr-3 text-faint" />
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
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('personalViewsTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('personalViewsBody')}</p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('securityResearchTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('securityResearchBody')}</p>
              </section>

              <section className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('noWarrantyTitle')}</h2>
                <p className="leading-relaxed text-muted">{t('noWarrantyBody')}</p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-bold text-fg">{t('questionsTitle')}</h2>
                <p className="leading-relaxed text-muted">
                  {t('questionsBody')}{' '}
                  <a href={`mailto:${email}`} className="link-accent">
                    {email}
                  </a>
                  .
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
