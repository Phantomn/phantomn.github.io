import { getLocale, getTranslations } from 'next-intl/server'
import { FileDown } from 'lucide-react'
import portfolioData from '@/data/portfolio.json'

const EXPERTISE_KEYS = ['otIcs', 'iotFirmware', 'kernel', 'webApp', 'llm', 'medical'] as const

export default async function About() {
  const t = await getTranslations('about')
  const locale = await getLocale()
  const { experience, education, skills } = portfolioData
  // About 은 경력기술서(careerStatement). en 이 아직 없으면 ko 로 대체한다.
  const cs = portfolioData.personal.cv.careerStatement as Record<string, string | null>
  const csHref = cs[locale] ?? cs.ko
  // 기술 태그는 데이터에서. 손으로 적으면 이력서와 갈라진다.
  const technologies = [...skills.languages, ...skills.tools]

  return (
    <section id="about" className="bg-bg py-24 md:py-28">
      <div className="container-max section-padding">
        <div className="mb-16">
          <p className="eyebrow mb-4">02 - {t('eyebrow')}</p>
          <h2 className="section-title">{t('title')}</h2>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            {/* 자기소개는 사람 소개만(실적은 Experience/Portfolio 가 맡는다). messages/*.json about.bio* */}
            <p className="mb-5 text-lg leading-relaxed text-fg">{t('bio1')}</p>
            <p className="leading-relaxed text-muted">{t('bio2')}</p>
          </div>

          <div className="h-fit rounded-xl border border-line bg-surface/50 p-6 sm:p-8">
            <h3 className="mb-4 text-lg font-semibold text-fg">{t('coreExpertise')}</h3>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {EXPERTISE_KEYS.map((key) => (
                <li key={key} className="flex items-baseline gap-2 font-mono text-sm text-fg">
                  <span aria-hidden="true" className="text-accent">
                    &rsaquo;
                  </span>
                  <span>{t(`expertise.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <div>
              <h3 className="mb-5 text-2xl font-semibold text-fg">{t('experience')}</h3>
              <div className="border-t border-line">
                {experience.map((entry) => (
                  <article
                    key={`${entry.company}-${entry.period}`}
                    className="border-b border-line py-5"
                  >
                    <p className="font-mono text-xs text-faint">{entry.period}</p>
                    <h4 className="mt-1 font-medium text-fg">
                      {entry.title} · {entry.company}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{entry.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-5 text-2xl font-semibold text-fg">{t('education')}</h3>
              <div className="border-t border-line">
                {education.map((entry) => (
                  <article
                    key={`${entry.institution}-${entry.year}`}
                    className="border-b border-line py-5"
                  >
                    <p className="font-mono text-xs text-faint">{entry.year}</p>
                    <h4 className="mt-1 font-medium text-fg">
                      {entry.degree} · {entry.institution}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{entry.focus}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <a
            href={csHref ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost mt-8 inline-flex items-center gap-2 px-5 py-2.5"
          >
            <FileDown size={16} />
            <span>{t('downloadCv')}</span>
          </a>
        </div>

        <div>
          <h3 className="mb-6 text-2xl font-semibold text-fg">{t('technologies')}</h3>
          <div className="flex flex-wrap gap-2">
            {technologies.map((tech) => (
              <span key={tech} className="chip">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
