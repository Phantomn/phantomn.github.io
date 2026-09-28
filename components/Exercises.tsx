import { getTranslations } from 'next-intl/server'
import { Trophy } from 'lucide-react'
import portfolioData from '@/data/portfolio.json'

export default async function Exercises() {
  const t = await getTranslations('exercises')
  // 최근 것이 먼저. 같은 해가 여러 건이면 원본 순서를 유지한다.
  const exercises = [...portfolioData.exercises].sort((a, b) => Number(b.year) - Number(a.year))

  return (
    <section id="exercises" className="py-24 md:py-28">
      <div className="container-max section-padding">
        <div className="mb-16">
          <p className="eyebrow mb-4">05 — {t('eyebrow')}</p>
          <h2 className="section-title">{t('title')}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t('intro')}</p>
        </div>

        <div className="border-t border-line">
          {exercises.map((exercise) => (
            <article key={exercise.title} className="border-b border-line py-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold text-fg">{exercise.title}</h3>
                {exercise.team && <span className="text-sm text-muted">{exercise.team}</span>}
              </div>

              {/* 순위는 주최 측이 스코어보드를 공개하지 않아 자기 기록이다 - 제목보다 낮은 위계로 둔다. */}
              {exercise.result && (
                <p className="mt-2 flex items-center gap-2 text-sm text-fg">
                  <Trophy size={14} className="flex-shrink-0 text-accent" aria-hidden="true" />
                  {exercise.result}
                </p>
              )}

              {exercise.roles.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {exercise.roles.map((role) => (
                    <span key={role} className="chip">
                      {role}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
