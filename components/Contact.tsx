import { getTranslations } from 'next-intl/server'
import { ArrowRight, Briefcase, Mail } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import portfolioData from '@/data/portfolio.json'

export default async function Contact() {
  const t = await getTranslations('contact')
  const { email } = portfolioData.personal

  return (
    <section id="contact" className="border-t border-line py-24 md:py-28">
      <div className="container-max section-padding">
        <p className="eyebrow mb-4">08 - {t('eyebrow')}</p>
        <h2 className="section-title">{t('title')}</h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">{t('intro')}</p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 채용은 전용 페이지로. 컨설팅은 재직 중 회사 업무라 개인 의뢰 카드는 두지 않는다. */}
          <article className="rounded-xl border border-line bg-surface/50 p-6 md:p-8">
            <Briefcase size={22} className="text-accent" aria-hidden="true" />
            <p className="eyebrow mt-5 text-accent">{t('hiring.eyebrow')}</p>
            <h3 className="mt-3 text-2xl font-semibold text-fg">{t('hiring.title')}</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted">{t('hiring.description')}</p>
            <Link
              href="/recruiter-brief"
              className="link-accent mt-6 inline-flex items-center gap-2 text-sm font-medium"
            >
              <span>{t('hiring.cta')}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </article>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <a href={`mailto:${email}`} className="link-accent inline-flex items-center gap-2">
            <Mail size={15} aria-hidden="true" />
            {email}
          </a>
          <span className="text-faint">{t('firstNote')}</span>
        </div>
      </div>
    </section>
  )
}
