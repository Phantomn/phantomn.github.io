import { getTranslations } from 'next-intl/server'
import portfolioData from '@/data/portfolio.json'
import { ThemeLink } from '@/components/ResearchGrid'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'

export default async function CaseStudies() {
  const t = await getTranslations('caseStudies')
  const { caseStudies } = portfolioData

  // No border-t on this section: the hero above already closes with border-b,
  // and doubling them produced a 2px seam once this moved directly below it.
  return (
    <section id="case-studies" className="bg-surface/30 py-24 md:py-28">
      <div className="container-max section-padding">
        <div className="mb-16">
          <p className="eyebrow mb-4">01 — {t('eyebrow')}</p>
          <h2 className="section-title">{t('title')}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            {t('intro', { count: caseStudies.length })}
          </p>
        </div>

        <div className="space-y-6">
          {caseStudies.map((cs, index) => (
            <article
              key={cs.id}
              id={cs.id}
              className="relative scroll-mt-24 overflow-hidden rounded-xl border border-line bg-bg/80 p-6 md:p-8"
            >
              <span aria-hidden="true" className="absolute bottom-8 left-0 top-8 w-px bg-accent" />
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs text-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="eyebrow text-accent">{cs.eyebrow}</p>
              </div>
              <h3 className="mb-6 max-w-3xl text-balance text-2xl font-semibold text-fg">
                {cs.title}
              </h3>
              <dl className="grid grid-cols-1 gap-x-10 gap-y-5 border-t border-line pt-6 md:grid-cols-3">
                <div>
                  <dt className="eyebrow mb-2">{t('stakes')}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{cs.stakes}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">{t('approach')}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{cs.approach}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">{t('result')}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{cs.result}</dd>
                </div>
              </dl>
              <div className="mt-7 border-t border-line pt-5">
                <p className="eyebrow mb-2 text-accent">{t('demonstrates')}</p>
                <p className="max-w-3xl text-sm leading-relaxed text-muted">{cs.demonstrates}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {/* evidence 는 아직 비어 있다(생성기가 [] 로 낸다). 채우면 여기 링크가 나온다. */}
                  {(cs.evidence as { label: string; url: string }[]).map((link) => (
                    <ThemeLink key={link.url} link={{ ...link, type: 'external' }} />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-line pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow mb-2 text-accent">{t('whereThisFits')}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">{t('whereThisFitsBody')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/recruiter-brief"
              className="btn-primary inline-flex flex-shrink-0 items-center gap-2 px-5 py-2.5"
            >
              <span>{t('recruiterBrief')}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
