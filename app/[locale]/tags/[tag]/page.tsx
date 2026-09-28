import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import { getAllTags, getPostsByTag, normalizeTag } from '@/lib/tags'
import { pageAlternates } from '@/lib/seo'
import { formatDate } from '@/lib/format'
import { PostTitle } from '@/components/PostTitle'
import { routing } from '@/i18n/routing'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'

interface TagPageProps {
  params: Promise<{ locale: string; tag: string }>
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getAllTags().map(({ tag }) => ({ locale, tag: encodeURIComponent(tag) })),
  )
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { locale, tag } = await params
  const decoded = normalizeTag(decodeURIComponent(tag))
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'tags' })
  return {
    title: t('tagMetaTitle', { tag: decoded }),
    alternates: pageAlternates(`/tags/${tag}/`),
  }
}

export default async function TagPage({ params }: TagPageProps) {
  const { locale, tag } = await params
  const decoded = normalizeTag(decodeURIComponent(tag))
  setRequestLocale(locale)
  const t = await getTranslations('tags')
  const posts = getPostsByTag(decoded)
  if (posts.length === 0) notFound()

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <div className="border-b border-line">
        <div className="container-max section-padding py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/tags"
              className="link-accent inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft size={20} className="mr-2" />
              {t('backToTags')}
            </Link>
            <div className="flex items-center">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">{t('eyebrow')}</p>
            <h1 className="section-title mb-4">{decoded}</h1>
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-12">
        <div className="divide-y divide-line border-t border-line">
          {posts.map((post) => (
            <article key={post.slug} className="py-10">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-faint">
                <span className="flex items-center">
                  <Calendar size={16} className="mr-2" />
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                </span>
                <span className="flex items-center">
                  <Clock size={16} className="mr-2" />
                  {post.readTime}
                </span>
              </div>

              <h2 className="mb-3 text-balance text-2xl font-bold text-fg transition-colors hover:text-accent">
                <Link href={`/blog/${post.slug}`}>
                  <PostTitle title={post.title} variant="inline" />
                </Link>
              </h2>

              <p className="mb-4 leading-relaxed text-muted">{post.excerpt}</p>

              <Link
                href={`/blog/${post.slug}`}
                className="link-accent inline-flex items-center font-medium focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('readFullArticle')}
                <ArrowLeft size={16} className="ml-2 rotate-180" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
