import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAllTags } from '@/lib/tags'
import { pageAlternates } from '@/lib/seo'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'tags' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/tags/'),
  }
}

export default async function TagsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('tags')
  const tags = getAllTags()

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <div className="border-b border-line">
        <div className="container-max section-padding py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/blog"
              className="link-accent inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft size={20} className="mr-2" />
              {t('backToBlog')}
            </Link>
            <div className="flex items-center">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">{t('eyebrow')}</p>
            <h1 className="section-title mb-4">{t('title')}</h1>
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-12">
        <div className="flex flex-wrap gap-3">
          {tags.map(({ tag, count }) => (
            <Link key={tag} href={`/tags/${encodeURIComponent(tag)}`} className="chip">
              {tag}
              <span className="ml-2 text-faint">{count}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
