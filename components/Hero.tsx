import { getTranslations } from 'next-intl/server'
import { ArrowDown, FileText } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { BlogPostMeta } from '@/lib/blog'
import { formatDate } from '@/lib/format'
import { disclosureSummary, disclosureYearRange } from '@/lib/disclosures'
import portfolioData from '@/data/portfolio.json'

type LatestPost = Pick<BlogPostMeta, 'slug' | 'title' | 'date'>

interface HeroProps {
  latestPost: LatestPost | null
}

export default async function Hero({ latestPost }: HeroProps) {
  const t = await getTranslations('hero')
  const tc = await getTranslations('common')
  const { themes, exercises, findings } = portfolioData

  // 최근 공개 취약점(날짜 내림차순, 대표 1건). url 있는 것만 - FVE 는 상세 비공개라 링크 없음.
  const recentFindings = [...findings]
    .filter((f) => f.url)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 1)

  const stats = [
    {
      value: String(disclosureSummary.cves),
      label: t('statCves', { range: disclosureYearRange }),
      href: '/findings/#cve-disclosures',
    },
    { value: String(findings.length), label: t('statFindings'), href: '#findings' },
    { value: String(themes.length), label: t('statAreas'), href: '#research' },
    { value: String(exercises.length), label: t('statExercises'), href: '#exercises' },
  ]

  return (
    <section
      id="home"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden border-b border-line bg-bg pt-16"
    >
      <div className="container-max section-padding w-full py-16 sm:py-20 lg:py-24">
        <div className="max-w-3xl animate-fade-in">
          <p className="eyebrow flex items-center gap-3 text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('eyebrow')}
          </p>

          <h1 className="mt-5 text-[clamp(2.5rem,10vw,4rem)] font-semibold leading-none tracking-[-0.045em] text-fg">
            {tc('name')}
          </h1>

          <p className="mt-7 max-w-2xl text-xl leading-relaxed text-fg sm:text-2xl">
            {t('thesis')}
          </p>

          {/* summary 는 비어 있을 수 있다(논지에 흡수). 빈 문자열이면 빈 문단을 안 그린다. */}
          {t('summary') && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {t('summary')}
            </p>
          )}

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {t('recent')}{' '}
            {recentFindings.map((finding, index) => (
              <span key={finding.title}>
                {index > 0 ? '; ' : ''}
                {/* CVE 번호·날짜 대신 무엇인지(제품+취약점)를 보여준다 - 조사한 관행. */}
                {/* 내부 글(/...)은 i18n Link 로 로케일 접두어를 붙여 같은 탭에서, 외부는 새 탭. */}
                {finding.url?.startsWith('/') ? (
                  <Link href={finding.url} className="link-accent">
                    {finding.description}
                  </Link>
                ) : (
                  <a
                    href={finding.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-accent"
                  >
                    {finding.description}
                  </a>
                )}
              </span>
            ))}
            .
          </p>

          {latestPost && (
            <Link
              href={`/blog/${latestPost.slug}`}
              className="focus-ring group mt-8 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-2 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              <FileText size={14} className="flex-shrink-0 text-accent" />
              <span className="eyebrow flex-shrink-0">{t('latest')}</span>
              <span className="truncate">{latestPost.title}</span>
              <time
                dateTime={latestPost.date}
                className="hidden flex-shrink-0 font-mono text-xs text-faint sm:inline"
              >
                {formatDate(latestPost.date, { year: 'numeric', month: 'short' })}
              </time>
            </Link>
          )}
        </div>

        <div className="mt-14 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface/50 md:grid-cols-4">
          {stats.map((stat, index) => {
            const className = `flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              index % 2 === 1 ? 'border-l border-line' : ''
            } ${index < 2 ? 'border-b border-line md:border-b-0' : ''} ${
              index > 0 ? 'md:border-l md:border-line' : ''
            }`
            const children = (
              <>
                <span className="font-mono text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                  {stat.value}
                </span>
                <span className="eyebrow text-center">{stat.label}</span>
              </>
            )
            return stat.href.startsWith('/') ? (
              <Link key={stat.label} href={stat.href} className={className}>
                {children}
              </Link>
            ) : (
              <a key={stat.label} href={stat.href} className={className}>
                {children}
              </a>
            )
          })}
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
          <a href="#case-studies" className="btn-primary px-6 py-3">
            {t('seeCaseStudies')}
          </a>
          <Link href="/recruiter-brief" className="btn-ghost px-6 py-3">
            {t('forHiring')}
          </Link>
        </div>

        <a
          href="#findings"
          className="focus-ring mx-auto mt-8 flex w-fit items-center gap-2 rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-faint transition-colors hover:text-fg"
        >
          {t('exploreEvidence')}
          <ArrowDown size={15} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
