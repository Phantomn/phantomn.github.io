import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Bug, ExternalLink, FileText, ShieldAlert } from 'lucide-react'
import { disclosureSummary } from '@/lib/disclosures'
import portfolioData from '@/data/portfolio.json'

// 우리 findings type 은 CVE / FVE / Pending 셋뿐이다(저자의 Paper/Merged fix 아님).
const typeIcons: Record<string, React.ReactNode> = {
  CVE: <ShieldAlert size={12} />,
  FVE: <Bug size={12} />,
  Pending: <FileText size={12} />,
}
const fallbackTypeIcon = <FileText size={12} />

export default async function Findings() {
  const t = await getTranslations('findings')
  const s = disclosureSummary
  const findings = portfolioData.findings

  return (
    <section id="findings" className="py-24 md:py-28">
      <div className="container-max section-padding">
        <div className="mb-16">
          <p className="eyebrow mb-4">04 - {t('eyebrow')}</p>
          <h2 className="section-title">{t('title')}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t('intro')}</p>
        </div>

        <div className="mb-10 rounded-xl border border-line bg-surface/50 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="eyebrow mb-3 text-accent">{t('archiveEyebrow')}</p>
              <h3 className="text-2xl font-semibold text-fg">
                {t('archiveHeading', { cves: s.cves, fves: s.fves })}
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                {t('archiveDetail', {
                  memory: s.memoryCorruption,
                  oob: s.outOfBoundsReads,
                  injection: s.injectionOrRce,
                  auth: s.authOrAccessControl,
                  logic: s.logicOrDos,
                })}
              </p>
            </div>
            <Link
              href="/findings/"
              className="btn-ghost inline-flex w-fit items-center gap-2 px-5 py-2.5"
            >
              <span>{t('exploreLedger')}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
          {findings.map((finding) => {
            // FVE 는 상세가 비공개라 링크(#)가 없다. 그런 항목은 <a> 대신 <div> 로 -
            // 여러 항목이 같은 '#' 를 key 로 쓰면 중복 key 가 되고, 빈 링크는 상단으로 점프한다.
            const hasLink = Boolean(finding.url) && finding.url !== '#'
            const cardClass =
              'group flex flex-col bg-bg p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent' +
              (hasLink ? ' hover:bg-surface' : '')
            const body = (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="chip gap-1.5">
                    {typeIcons[finding.type] ?? fallbackTypeIcon}
                    <span>{t(`type.${finding.type}`)}</span>
                  </span>
                  <span className="font-mono text-xs text-faint">{finding.date}</span>
                </div>
                <h3 className="text-base font-semibold text-fg transition-colors group-hover:text-accent">
                  {finding.title}
                </h3>
                <p className="mb-4 mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {finding.description}
                </p>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-faint">
                  {hasLink && <ExternalLink size={12} className="flex-shrink-0" />}
                  {finding.project}
                </span>
              </>
            )
            // '/' 로 시작하면 우리 분석 글(FVE) - 로케일 접두어를 붙이는 i18n Link 로, 같은 탭에서.
            if (hasLink && finding.url!.startsWith('/')) {
              return (
                <Link key={finding.title} href={finding.url!} className={cardClass}>
                  {body}
                </Link>
              )
            }
            return hasLink ? (
              <a
                key={finding.title}
                href={finding.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
              >
                {body}
              </a>
            ) : (
              <div key={finding.title} className={cardClass}>
                {body}
              </div>
            )
          })}
        </div>

        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-faint">
          {t.rich('privateNote', {
            github: (chunks) => (
              <a
                href={`https://github.com/${portfolioData.personal.social.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </section>
  )
}
