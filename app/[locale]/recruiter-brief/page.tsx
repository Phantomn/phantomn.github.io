import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, FileDown, Github, Linkedin, Mail, MapPin } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import portfolioData from '@/data/portfolio.json'
import { disclosureSummary } from '@/lib/disclosures'
import { pageAlternates, serializeJsonLd, SITE_URL } from '@/lib/seo'

type Params = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('recruiterBrief')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/recruiter-brief/'),
    openGraph: {
      title: t('metaTitle'),
      description: t('ogDescription'),
      url: `${SITE_URL}/recruiter-brief/`,
    },
  }
}

const FOCUS_KEYS = ['otIcs', 'iotFirmware', 'kernelBinary', 'webLlm'] as const

export default async function RecruiterBriefPage({ params }: Params) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('recruiterBrief')
  const { personal, experience, education, themes, findings, exercises } = portfolioData

  const recruiterJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${personal.name} - Recruiter Brief`,
    url: `${SITE_URL}/recruiter-brief/`,
    mainEntity: {
      '@type': 'Person',
      name: personal.name,
      url: SITE_URL,
      jobTitle: 'Offensive Security Researcher',
      worksFor: { '@type': 'Organization', name: experience[0].company },
      alumniOf: { '@type': 'CollegeOrUniversity', name: education[0].institution },
    },
  }

  const roleConversationHref = `mailto:${personal.email}?subject=${encodeURIComponent(
    t('mailSubject'),
  )}`

  // 채용 담당자용은 이력서(resume). 로케일에 맞는 것, 없으면 ko.
  const resume = personal.cv.resume as Record<string, string>
  const resumeHref = resume[locale] ?? resume.ko

  const stats = [
    { value: String(findings.length), label: t('statFindings') },
    { value: String(disclosureSummary.cves), label: t('statCves') },
    { value: String(themes.length), label: t('statAreas') },
    { value: String(exercises.length), label: t('statExercises') },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(recruiterJsonLd) }}
      />
      <Header />
      <main id="main-content" className="min-h-screen bg-bg pt-16">
        <section className="border-b border-line">
          <div className="container-max section-padding py-16 sm:py-20">
            <p className="eyebrow mb-4 text-accent">{t('eyebrow')}</p>
            <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-muted">{t('lead')}</p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={resumeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3"
              >
                <FileDown size={16} aria-hidden="true" />
                {t('downloadCv')}
              </a>
              <a href={roleConversationHref} className="btn-ghost inline-flex items-center gap-2 px-6 py-3">
                <Mail size={16} aria-hidden="true" />
                {t('startConversation')}
              </a>
            </div>
          </div>
        </section>

        <section className="container-max section-padding py-16 md:py-20">
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface/50 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center ${
                  index % 2 === 1 ? 'border-l border-line' : ''
                } ${index < 2 ? 'border-b border-line md:border-b-0' : ''} ${
                  index > 0 ? 'md:border-l md:border-line' : ''
                }`}
              >
                <span className="font-mono text-xl font-semibold tracking-tight text-fg sm:text-2xl">
                  {stat.value}
                </span>
                <span className="eyebrow text-center">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)]">
            <div>
              <h2 className="section-title">{t('mandates')}</h2>
              <ul className="mt-6 space-y-4">
                {FOCUS_KEYS.map((key) => (
                  <li key={key} className="flex gap-3 text-muted">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
                    />
                    <span className="leading-relaxed">{t(`focus.${key}`)}</span>
                  </li>
                ))}
              </ul>

              <h2 className="section-title mt-14">{t('experience')}</h2>
              <div className="mt-6 divide-y divide-line border-y border-line">
                {experience.slice(0, 3).map((role) => (
                  <article key={`${role.company}-${role.period}`} className="py-6">
                    <p className="font-mono text-xs text-accent">{role.period}</p>
                    <h3 className="mt-2 text-lg font-semibold text-fg">
                      {role.title} · {role.company}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{role.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-line bg-surface/50 p-6">
              <p className="eyebrow text-accent">{t('atAGlance')}</p>
              <dl className="mt-5 space-y-5 text-sm">
                <div>
                  <dt className="text-faint">{t('currentRole')}</dt>
                  <dd className="mt-1 font-medium text-fg">
                    {experience[0].title} · {experience[0].company}
                  </dd>
                </div>
                <div>
                  <dt className="text-faint">{t('workingModel')}</dt>
                  <dd className="mt-1 inline-flex items-center gap-2 font-medium text-fg">
                    <MapPin size={14} aria-hidden="true" />
                    {personal.location}
                  </dd>
                </div>
                <div>
                  <dt className="text-faint">{t('education')}</dt>
                  <dd className="mt-1 font-medium text-fg">
                    {education[0].degree} · {education[0].institution}
                  </dd>
                </div>
                <div>
                  <dt className="text-faint">{t('availability')}</dt>
                  <dd className="mt-1 leading-relaxed text-muted">{t('availabilityBody')}</dd>
                </div>
              </dl>

              <div className="mt-7 flex flex-col items-start gap-3 border-t border-line pt-6 text-sm">
                <a
                  href={`https://linkedin.com/in/${personal.social.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-accent inline-flex items-center gap-2"
                >
                  <Linkedin size={15} aria-hidden="true" />
                  LinkedIn
                </a>
                <a
                  href={`https://github.com/${personal.social.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-accent inline-flex items-center gap-2"
                >
                  <Github size={15} aria-hidden="true" />
                  GitHub
                </a>
                <a href={`mailto:${personal.email}`} className="link-accent inline-flex items-center gap-2">
                  <Mail size={15} aria-hidden="true" />
                  {personal.email}
                </a>
              </div>
            </aside>
          </div>

          <div className="mt-16 border-t border-line pt-10">
            <p className="eyebrow mb-4 text-accent">{t('startEvidence')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                [t('evidenceCases'), '/#case-studies'],
                [t('evidenceFindings'), '/findings/'],
                [t('evidenceResearch'), '/research/'],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="focus-ring group flex items-center justify-between rounded-lg border border-line bg-surface/40 px-5 py-4 text-sm font-medium text-fg transition-colors hover:border-line-strong"
                >
                  <span>{label}</span>
                  <ArrowRight size={15} className="text-accent" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
