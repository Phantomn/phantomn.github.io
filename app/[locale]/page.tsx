import Header from '@/components/Header'
import Hero from '@/components/Hero'
import About from '@/components/About'
import CaseStudies from '@/components/CaseStudies'
import Projects from '@/components/Projects'
import Findings from '@/components/Findings'
import Exercises from '@/components/Exercises'
import Writing from '@/components/Writing'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import { setRequestLocale } from 'next-intl/server'
import { getAllPostsMeta } from '@/lib/blog'
import { SITE_URL, serializeJsonLd } from '@/lib/seo'
import portfolioData from '@/data/portfolio.json'

/*
 * 구조화 데이터는 검색엔진이 사실로 읽는다. 포크 원본에는 저자의 학력(TU Berlin 박사 +
 * 학위논문 제목)과 소속(이더리움 재단)이 이름만 바뀐 채 남아 있었다 - 방치하면 우리
 * 이름으로 허위 학력을 선언한다. 소속은 정체성 자리가 아니라 경력이므로 아예 넣지 않고,
 * 계정은 portfolio.json 을 읽어 푸터·연락처와 갈라지지 않게 한다.
 */
const { social } = portfolioData.personal
const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: portfolioData.personal.name,
  url: SITE_URL,
  jobTitle: 'Offensive Security Researcher',
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Kongju National University',
  },
  sameAs: [
    `https://github.com/${social.github}`,
    `https://linkedin.com/in/${social.linkedin}`,
  ],
  knowsAbout: [
    'OT/ICS security',
    'IEC 62443',
    'IoT and firmware analysis',
    'Medical device security',
    'Linux kernel vulnerability research',
    'LLM inference engine security',
    'Penetration testing',
    'Cyber range development',
  ],
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  // setRequestLocale 이 없으면 하위 getTranslations 가 headers 로 폴백해 정적 내보내기가 막힌다.
  const { locale } = await params
  setRequestLocale(locale)
  const posts = getAllPostsMeta()
  const recentPosts = posts.slice(0, 3)
  const latestPost = posts[0] ?? null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
      />
      <Header />
      <main id="main-content" className="min-h-screen">
        <Hero latestPost={latestPost} />
        <CaseStudies />
        <About />
        <Projects />
        <Findings />
        <Exercises />
        <Writing posts={recentPosts} />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
