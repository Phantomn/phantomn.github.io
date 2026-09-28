'use client'

import { useTranslations } from 'next-intl'
import { ExternalLink, Github, Linkedin, Mail, Twitter } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import portfolioData from '@/data/portfolio.json'

export default function Footer() {
  const t = useTranslations()
  const { personal } = portfolioData
  const currentYear = new Date().getFullYear()

  const quickLinks = [
    { key: 'nav.caseStudies', href: '/#case-studies' },
    { key: 'nav.about', href: '/#about' },
    { key: 'nav.research', href: '/#research' },
    { key: 'nav.findings', href: '/#findings' },
    { key: 'nav.blog', href: '/blog' },
    { key: 'nav.recruiters', href: '/recruiter-brief' },
  ]

  return (
    <footer className="border-t border-line bg-bg py-12">
      <div className="container-max section-padding">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="mb-4 text-2xl font-semibold tracking-tight text-fg">{personal.name}</h3>
            <p className="mb-6 max-w-md text-muted">{t('footer.tagline')}</p>
            <div className="flex space-x-5">
              <a
                href={`https://github.com/${personal.social.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t('nav.github')}
              >
                <Github size={18} />
              </a>
              <a
                href={`https://linkedin.com/in/${personal.social.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t('nav.linkedin')}
              >
                <Linkedin size={18} />
              </a>
              <a
                href={`https://x.com/${personal.social.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t('nav.twitter')}
              >
                <Twitter size={18} />
              </a>
              <a
                href={`mailto:${personal.email}`}
                className="text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t('footer.email')}
              >
                <Mail size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="eyebrow mb-4">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} className="text-muted transition-colors hover:text-fg">
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="eyebrow mb-4">{t('footer.resources')}</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href={`https://github.com/${personal.social.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-muted transition-colors hover:text-fg"
                >
                  <span>{t('footer.openSource')}</span>
                  <ExternalLink size={14} className="text-faint" />
                </a>
              </li>
              <li>
                <a
                  href="/feed.xml"
                  className="inline-flex items-center space-x-1 text-muted transition-colors hover:text-fg"
                >
                  <span>{t('footer.rssFeed')}</span>
                </a>
              </li>
              <li>
                <a href="/llms.txt" className="text-muted transition-colors hover:text-fg">
                  {t('footer.llmIndex')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-8">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <p className="font-mono text-xs text-faint">
              © {currentYear} {personal.name}. {t('footer.rights')}
            </p>
            <div className="mt-4 flex items-center space-x-6 md:mt-0">
              <Link
                href="/privacy"
                className="font-mono text-xs text-faint transition-colors hover:text-fg"
              >
                {t('footer.privacy')}
              </Link>
              <Link
                href="/terms"
                className="font-mono text-xs text-faint transition-colors hover:text-fg"
              >
                {t('footer.disclaimer')}
              </Link>
              <p className="font-mono text-xs text-faint">{t('footer.builtWith')}</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
