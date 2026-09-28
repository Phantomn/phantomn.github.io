import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import DisclosureLedger from '@/components/DisclosureLedger'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'
import { allCveDisclosures, cveRecordUrl, disclosureSummary } from '@/lib/disclosures'
import { pageAlternates, serializeJsonLd, SITE_URL } from '@/lib/seo'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('findingsPage')
  return {
    title: t('metaTitle'),
    description: t('metaDescription', { cves: disclosureSummary.cves }),
    alternates: pageAlternates('/findings/'),
  }
}

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Security Findings & Disclosures',
  url: `${SITE_URL}/findings/`,
  author: { '@type': 'Person', name: 'Seungpyo Hong', url: SITE_URL },
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: allCveDisclosures.length,
    itemListElement: allCveDisclosures.map((cve, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cve.id,
      url: cve.url ?? cveRecordUrl(cve.id),
    })),
  },
}

export default async function FindingsPage({ params }: Params) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('findingsPage')

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />

      <div className="border-b border-line">
        <div className="container-max section-padding py-8">
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/#findings"
              className="link-accent inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft size={20} className="mr-2" aria-hidden="true" />
              {t('back')}
            </Link>
            <div className="flex items-center">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <p className="eyebrow mb-3">{t('eyebrow')}</p>
          <h1 className="section-title mb-5">{t('title')}</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-muted">{t('intro')}</p>
        </div>
      </div>

      <div className="container-max section-padding py-12 md:py-16">
        <DisclosureLedger />

        <aside className="mt-16 border-t border-line pt-8 text-sm leading-relaxed text-faint">
          <p className="max-w-4xl">{t('provenance')}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a
              href="https://github.com/CVEProject/cvelistV5"
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent inline-flex items-center gap-1.5"
            >
              {t('cveCorpus')}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </main>
  )
}
