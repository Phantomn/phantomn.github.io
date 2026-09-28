import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import portfolioData from '@/data/portfolio.json'
import { pageAlternates } from '@/lib/seo'
import ResearchGrid from '@/components/ResearchGrid'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'research' })
  return {
    title: t('archiveMetaTitle'),
    description: t('archiveMetaDescription'),
    alternates: pageAlternates('/research/'),
  }
}

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('research')
  const { themes } = portfolioData

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
              {t('archiveBackToPortfolio')}
            </Link>
            <div className="flex items-center">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">{t('archiveEyebrow')}</p>
            <h1 className="section-title mb-4">{t('archiveTitle')}</h1>
            <p className="max-w-3xl text-xl text-muted">{t('archiveBody')}</p>
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-12">
        <ResearchGrid themes={themes} />
      </div>
    </main>
  )
}
