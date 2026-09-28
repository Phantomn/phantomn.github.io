import { getTranslations } from 'next-intl/server'
import { ExternalLink, ShieldAlert, Users } from 'lucide-react'
import {
  additionalPublicFindings,
  cveRecordUrl,
  disclosureGroups,
  disclosureSummary,
} from '@/lib/disclosures'
import { Link } from '@/i18n/navigation'

const projectId = (project: string) =>
  project
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export default async function DisclosureLedger() {
  const t = await getTranslations('ledger')
  const s = disclosureSummary

  // 갈래는 CWE 에서 도출한 여섯 종. 값이 0 인 갈래는 숨긴다. label/detail 은 메시지.
  const categories = (
    [
      ['memoryCorruption', s.memoryCorruption],
      ['outOfBoundsReads', s.outOfBoundsReads],
      ['injectionOrRce', s.injectionOrRce],
      ['authOrAccessControl', s.authOrAccessControl],
      ['logicOrDos', s.logicOrDos],
      ['unclassified', s.unclassified],
    ] as const
  ).filter(([, value]) => value > 0)

  return (
    <>
      <section aria-labelledby="disclosure-summary-heading">
        <h2 id="disclosure-summary-heading" className="sr-only">
          {t('summaryHeading')}
        </h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          <div className="flex min-h-28 flex-col justify-center bg-bg p-5">
            <span className="font-mono text-3xl font-semibold text-fg">{s.cves}</span>
            <span className="eyebrow mt-2">{t('publishedCves')}</span>
          </div>
          <div className="flex min-h-28 flex-col justify-center bg-bg p-5">
            <span className="font-mono text-3xl font-semibold text-fg">{s.fves}</span>
            <span className="eyebrow mt-2">{t('maskedFves')}</span>
          </div>
          <div className="flex min-h-28 flex-col justify-center bg-bg p-5">
            <span className="font-mono text-3xl font-semibold text-fg">{s.pending}</span>
            <span className="eyebrow mt-2">{t('pending')}</span>
          </div>
          <div className="flex min-h-28 flex-col justify-center bg-bg p-5">
            <span className="font-mono text-3xl font-semibold text-fg">{s.projects}</span>
            <span className="eyebrow mt-2">{t('groups')}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(([key, value]) => (
            <div key={key} className="border-l-2 border-accent pl-4">
              <p className="text-sm font-medium text-fg">
                {t(`categories.${key}.label`)} · {value}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t(`categories.${key}.detail`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="classification-note-heading">
        <div className="rounded-xl border border-line bg-surface/50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
            <div>
              <h2 id="classification-note-heading" className="text-lg font-semibold text-fg">
                {t('noteHeading')}
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted">
                {t('noteBody', { cves: s.cves, fves: s.fves })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div id="cve-disclosures" className="mt-16 scroll-mt-24 space-y-16">
        {disclosureGroups.map((group) => (
          <section key={group.project} id={projectId(group.project)} className="scroll-mt-24">
            <div className="mb-6 flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow mb-2">{group.period}</p>
                <h2 className="text-2xl font-semibold text-fg">{group.project}</h2>
                {/* 팀 성과인 그룹(커널 = BoB)은 개인 단독으로 읽히지 않게 배지를 단다. */}
                {group.attribution && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface/60 px-2.5 py-1 text-xs text-muted">
                    <Users size={12} className="flex-shrink-0 text-accent" aria-hidden="true" />
                    {t('teamProject')}
                  </span>
                )}
              </div>
              <p className="font-mono text-sm text-faint">
                {t('cveCount', { count: group.cves.length })}
              </p>
            </div>

            <ul className="divide-y divide-line border-y border-line">
              {group.cves.map((cve) => (
                <li
                  key={cve.id}
                  id={cve.id.toLowerCase()}
                  className="grid scroll-mt-24 gap-3 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6"
                >
                  <div className="flex flex-col items-start gap-2">
                    {/* FVE 는 상세 비공개라 url 이 없다. CVE 는 항목 url 또는 cve.org 레코드. */}
                    {(() => {
                      const href = cve.url ?? (cve.id.startsWith('CVE') ? cveRecordUrl(cve.id) : null)
                      // '/' 로 시작하면 우리 분석 글(FVE) - i18n Link 로 로케일 접두어를 붙인다.
                      if (href?.startsWith('/')) {
                        return (
                          <Link
                            href={href}
                            className="link-accent inline-flex items-center gap-1.5 font-mono text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {cve.id}
                          </Link>
                        )
                      }
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-accent inline-flex items-center gap-1.5 font-mono text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {cve.id}
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="font-mono text-sm font-semibold text-fg">{cve.id}</span>
                      )
                    })()}
                    <span className="chip">{cve.category}</span>
                  </div>
                  <div>
                    <p className="text-sm leading-relaxed text-fg">{cve.summary}</p>
                    {cve.impact && (
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        <strong className="font-medium text-fg">{t('impact')}:</strong> {cve.impact}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {group.evidence && group.evidence.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                {group.evidence.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-accent inline-flex items-center gap-1.5 text-sm"
                  >
                    {item.label}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {additionalPublicFindings.length > 0 && (
        <section className="mt-16" aria-labelledby="additional-findings-heading">
          <div className="mb-6 border-b border-line pb-5">
            <p className="eyebrow mb-2">{t('additionalEyebrow')}</p>
            <h2 id="additional-findings-heading" className="text-2xl font-semibold text-fg">
              {t('additionalTitle')}
            </h2>
          </div>

          <div className="divide-y divide-line border-y border-line">
            {additionalPublicFindings.map((finding) => (
              <article
                key={finding.url}
                className="grid gap-3 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6"
              >
                <div>
                  <p className="font-mono text-sm text-faint">{finding.date}</p>
                  <p className="mt-1 text-sm font-medium text-accent">{finding.project}</p>
                </div>
                <div>
                  <a
                    href={finding.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-fg transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {finding.title}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{finding.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
