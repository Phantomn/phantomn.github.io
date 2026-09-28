'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Linkedin,
  Share2,
  Tag,
  Twitter,
} from 'lucide-react'
import type { BlogPost, BlogPostMeta, SeriesPart } from '@/lib/blog'
import { formatDate } from '@/lib/format'
import { SITE_URL } from '@/lib/seo'
import ThemeToggle from '@/components/ThemeToggle'
import LocaleToggle from '@/components/LocaleToggle'
import { SeriesNav, SeriesPager } from '@/components/SeriesNav'
import { PostTitle } from '@/components/PostTitle'

interface BlogPostClientProps {
  post: BlogPost
  allPosts: BlogPostMeta[]
  seriesTitle: string | null
  seriesParts: SeriesPart[]
}

export default function BlogPostClient({
  post,
  allPosts,
  seriesTitle,
  seriesParts,
}: BlogPostClientProps) {
  const t = useTranslations('blog')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}/`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(canonicalUrl)
    setCopyStatus('copied')
    window.setTimeout(() => setCopyStatus('idle'), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: canonicalUrl,
        })
      } catch {
        // user cancelled
      }
    } else {
      await handleCopy()
    }
  }

  const encodedUrl = encodeURIComponent(canonicalUrl)
  const encodedTitle = encodeURIComponent(post.title)
  const shareLinks = [
    {
      label: t('shareX'),
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      Icon: Twitter,
    },
    {
      label: t('shareLinkedin'),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      Icon: Linkedin,
    },
    {
      label: t('submitHN'),
      href: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`,
      Icon: ExternalLink,
    },
  ]

  const related = allPosts
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 2)

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

          <div className="mb-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="chip">
                  <Tag size={12} className="mr-1 text-faint" />
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="mb-4 max-w-3xl text-balance text-3xl font-bold leading-[1.1] tracking-tight text-fg sm:text-4xl md:text-5xl">
              <PostTitle title={post.title} variant="full" />
            </h1>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="mb-4 flex items-center text-sm text-faint md:mb-0">
                <Calendar size={16} className="mr-2" />
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <Clock size={16} className="ml-4 mr-2" />
                {post.readTime}
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="btn-ghost inline-flex items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Share2 size={16} className="mr-2" />
                {t('share')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-12">
        <div className="mx-auto max-w-4xl">
          {seriesTitle && <SeriesNav title={seriesTitle} parts={seriesParts} />}

          {post.headings.length >= 3 && (
            <nav
              aria-label={t('tableOfContents')}
              className="mb-10 border-l-2 border-line py-1 pl-6"
            >
              <p className="eyebrow mb-3">{t('onThisPage')}</p>
              <ul className="space-y-2">
                {post.headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className="text-sm text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <article>
            <div
              className="prose prose-lg max-w-none dark:prose-invert prose-a:text-accent hover:prose-a:opacity-80"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          </article>

          <aside
            aria-labelledby="share-this-post"
            className="mt-12 rounded-xl border border-line bg-surface/40 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div>
              <h2 id="share-this-post" className="text-sm font-semibold text-fg">
                {t('shareOriginal')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-faint">{t('shareOriginalDesc')}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-xs"
              >
                {copyStatus === 'copied' ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                {copyStatus === 'copied' ? t('copied') : t('copyLink')}
              </button>
              {shareLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </a>
              ))}
            </div>
          </aside>

          <SeriesPager parts={seriesParts} />

          {related.length > 0 && (
            <div className="mt-16 border-t border-line pt-12">
              <h3 className="mb-6 text-2xl font-semibold tracking-tight text-fg">
                {t('relatedPosts')}
              </h3>
              <div className="divide-y divide-line border-y border-line">
                {related.map((rp) => (
                  <Link
                    key={rp.slug}
                    href={`/blog/${rp.slug}`}
                    className="group block py-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <h4 className="mb-2 text-balance text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-accent">
                      <PostTitle title={rp.title} variant="inline" />
                    </h4>
                    <p className="mb-3 text-sm text-muted">{rp.excerpt}</p>
                    <div className="flex items-center text-sm text-faint">
                      <Calendar size={14} className="mr-1" />
                      <time dateTime={rp.date}>
                        {formatDate(rp.date, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </time>
                      <Clock size={14} className="ml-3 mr-1" />
                      {rp.readTime}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <aside className="mt-16 border-t border-line pt-10">
            <p className="eyebrow mb-3">{t('nextStep')}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">{t('nextStepDesc')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Link href="/recruiter-brief" className="link-accent font-medium">
                {t('recruiterBrief')}
              </Link>
              <Link href="/#case-studies" className="link-accent font-medium">
                {t('seeCaseStudies')}
              </Link>
              <a href="/feed.xml" className="link-accent font-medium">
                {t('subscribeRss')}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
