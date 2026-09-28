import { getTranslations } from 'next-intl/server'
import portfolioData from '@/data/portfolio.json'
import ResearchGrid from '@/components/ResearchGrid'

// The homepage features the first FEATURED_COUNT entries of portfolio.json's
// themes array — the ordering in the data file is the curation.
const FEATURED_COUNT = 5

export default async function Projects() {
  const t = await getTranslations('research')
  const { themes } = portfolioData
  const featured = themes.slice(0, FEATURED_COUNT)
  const hidden = themes.slice(FEATURED_COUNT)

  return (
    <section id="research" className="bg-bg py-24 md:py-28">
      {/* Legacy anchor: external links to /#projects predate the rename. */}
      <span id="projects" aria-hidden="true" />
      <div className="container-max section-padding">
        <div className="mb-16">
          <p className="eyebrow mb-4">03 — {t('eyebrow')}</p>
          <h2 className="section-title">{t('title')}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t('intro')}</p>
        </div>

        <ResearchGrid themes={featured} hiddenThemes={hidden} />
      </div>
    </section>
  )
}
