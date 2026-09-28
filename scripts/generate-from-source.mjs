/*
 * data/source/ 의 단일 원본에서 공개 산출물 5개를 만든다.
 *
 *   data/portfolio.json              사이트가 읽는 프로필/경력/케이스 스터디/발견/대회
 *   lib/disclosures.ts               CVE 공시 원장 (findings, bugs, recruiter-brief 가 읽는다)
 *   public/.well-known/claims.json   검증 가능한 주장
 *   public/.well-known/security.txt  RFC 9116
 *   public/llms.txt                  기계 판독용 요약
 *
 * 왜 하나로 모았나: scripts/check-claims.mjs 와 check-pgp.mjs 가 이 산출물들을 서로 대조한다.
 * CVE 건수가 claims 와 disclosures 에서 다르면 빌드가 막히고, llms.txt 에 PGP 지문이 없어도 막힌다.
 * 손으로 다섯 곳을 고치면 반드시 어긋나므로, 숫자와 사실은 data/source/ 한 곳에서만 온다.
 *
 * PGP 값은 gpg 에서 직접 읽는다. 지문을 적어 두면 키를 교체할 때 조용히 틀린다.
 * gpg 가 없는 환경(CI)에서는 data/source/pgp.json 을 대신 읽는다.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = (name) => JSON.parse(readFileSync(path.join(root, 'data', 'source', name), 'utf8'))

const SITE = 'https://blog.ph4nt0m.xyz'
const REPO_SLUG = 'Phantomn/phantomn.github.io'
const EMAIL = 'newbiepwner@kakao.com'
const GITHUB = 'phantomn'
const LINKEDIN = 'ph4nt0m'
// X 핸들은 LinkedIn 과 다르다(끝 m 두 개). 예전에 LINKEDIN 을 재사용해 링크가 깨져 있었다.
const TWITTER = 'Ph4nt0mm'
const PGP_FINGERPRINT = '28DDDA5777C6E1E163AF1C8DB955911775AD63BB'

const today = new Date().toISOString().slice(0, 10)
const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`

// 최신순으로 한 번 정렬해 모든 산출물(findings, disclosures, Hero 최근항목)이
// 일관되게 최신 CVE 부터 나오게 한다. published(YYYY-MM-DD) 우선, 없으면 연도.
const cveDateKey = (c) => c.published ?? `${c.year}-00-00`
const cves = src('cves.json').sort((a, b) => (cveDateKey(a) < cveDateKey(b) ? 1 : cveDateKey(a) > cveDateKey(b) ? -1 : 0))
const projects = src('projects.json')
const competitions = src('competitions.json')
const text = src('project-text.json')
const { records: rec, portfolio: t } = src('labels.json')

/* ---------- PGP ---------- */
function readPgp() {
  const cached = path.join(root, 'data', 'source', 'pgp.json')
  try {
    const colons = execFileSync('gpg', ['--with-colons', '--list-keys', PGP_FINGERPRINT], {
      encoding: 'utf8',
    }).split('\n')
    const pub = colons.find((l) => l.startsWith('pub:')).split(':')
    const uid = colons.find((l) => l.startsWith('uid:')).split(':')[9]
    const armor = execFileSync('gpg', ['--armor', '--export', PGP_FINGERPRINT], { encoding: 'utf8' })
    const bytes = execFileSync('gpg', ['--export', PGP_FINGERPRINT], { maxBuffer: 1 << 22 })
    const algorithms = { 1: 'RSA', 18: 'ECDH', 22: 'EdDSA' }
    const pgp = {
      publicKeyPath: '/pgp-key.asc',
      fingerprint: PGP_FINGERPRINT,
      keyId: PGP_FINGERPRINT.slice(-16),
      uid,
      algorithm: algorithms[Number(pub[3])] ?? `unknown(${pub[3]})`,
      length: Number(pub[2]),
      created: new Date(Number(pub[5]) * 1000).toISOString().slice(0, 10),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    writeFileSync(path.join(root, 'public', 'pgp-key.asc'), armor)
    writeFileSync(cached, JSON.stringify(pgp, null, 2) + '\n')
    return { pgp, from: 'gpg' }
  } catch {
    if (!existsSync(cached)) throw new Error('gpg 를 쓸 수 없고 data/source/pgp.json 도 없다')
    return { pgp: JSON.parse(readFileSync(cached, 'utf8')), from: 'data/source/pgp.json' }
  }
}
const { pgp, from: pgpFrom } = readPgp()

/* ---------- 파생 값 ---------- */
const assigned = cves.filter((c) => c.id.startsWith('CVE') && !c.id.includes('UNASSIGNED'))
const fves = cves.filter((c) => c.id.startsWith('FVE'))
const pending = cves.filter((c) => c.id.includes('UNASSIGNED'))
// 팀 성과(attribution 있음)인 assigned CVE 수. claims 가 "혼자 다 한 것" 처럼 보이지 않게 명시한다.
const kernelTeamCves = assigned.filter((c) => c.attribution).length
// href/nvdHref 가 '#'(FVE 상세 비공개) 이면 링크가 없는 것으로 본다.
const realHref = (c) => [c.href, c.nvdHref].find((h) => h && h !== '#')
const groupNames = [...new Set(cves.map((c) => c.groupLabel ?? c.groupKey))]
const featured = projects.filter((p) => p.featured)

const ls = (id) => competitions.find((c) => c.id === id)
const resultOf = (c) =>
  [
    c.overall ? rec.overall.replace('{rank}', c.overall.rank).replace('{of}', c.overall.of) : '',
    ...(c.tracks ?? []).map((tr) => rec.track.replace('{name}', tr.name).replace('{rank}', tr.rank)),
  ]
    .filter(Boolean)
    .join(' · ')
const ls2025 = ls('ls2025')
// 문장 목록을 한 문단으로 잇는다. 원본 항목엔 마침표가 없어 그냥 이으면 문장이 붙어 버린다.
const sentences = (xs) => xs.map((x) => (/[.!?]$/.test(x) ? x : `${x}.`)).join(' ')
// project-text 결과의 {ls2025} 같은 자리표시를 대회 기록으로 채운다(순위는 competitions.json 한 곳에만).
for (const x of Object.values(text)) {
  x.results = x.results?.map((r) =>
    r.replace(/\{(ls\d{4})\}/g, (_, id) => `${ls(id).name} ${ls(id).year}: ${resultOf(ls(id))}`),
  )
}

/* ---------- 1. data/portfolio.json ---------- */
const portfolio = {
  personal: {
    name: 'Seungpyo Hong',
    title: t.headline,
    description: t.summary.replace('{projects}', String(projects.length)),
    location: 'Seoul, South Korea',
    email: EMAIL,
    /*
     * 공개 문서 두 종류를 로케일별로. Portfolio 는 사이트 자체가 그 역할이라 PDF 를
     * 두지 않고, Cover Letter 는 회사맞춤이라 About 소개가 대신한다(실사례 6곳 관찰).
     * careerStatement.en 은 아직 없다 - 생성 전까지 UI 가 ko 로 대체한다.
     */
    cv: {
      resume: { ko: '/docs/resume-ko.pdf', en: '/docs/resume-en.pdf' },
      careerStatement: { ko: '/docs/career-statement-ko.pdf', en: '/docs/career-statement-en.pdf' },
    },
    social: { github: GITHUB, linkedin: LINKEDIN, twitter: TWITTER },
    pgp,
  },
  experience: [
    {
      title: t.experience.coresec.role,
      company: t.experience.coresec.company,
      period: `2021.06 - ${t.present}`,
      description: ['ot', 'achilles', 'iot'].map((k) => t.experience.coresec.bullets[k]).join(' '),
    },
    {
      title: t.experience.a3.role,
      company: 'A3 Security',
      period: '2020.06 - 2021.06',
      description: ['financial', 'review'].map((k) => t.experience.a3.bullets[k]).join(' '),
    },
  ],
  education: [
    { degree: t.education.kongju, institution: 'Kongju National University', year: '2012.02 - 2020.02', focus: 'Computer Engineering' },
    { degree: t.education.cheonan, institution: 'Cheonan Commercial High School', year: '2009.03 - 2012.02', focus: 'Information Processing' },
  ],
  skills: {
    languages: ['C/C++', 'Python', 'TypeScript', 'Shell'],
    security: [
      'Web/App Pentesting',
      'OT/ICS Pentesting',
      'Vulnerability Research',
      'Exploit Development',
      'Fuzzing',
      'Reverse Engineering',
      'Threat Modeling',
    ],
    blockchain: [],
    tools: ['IDA Pro', 'Ghidra', 'Burp Suite', 'Frida', 'Wireshark', 'Achilles Test Platform'],
  },
  themes: Object.entries(
    projects.reduce((acc, p) => ((acc[p.category] ??= []).push(p), acc), {}),
  ).map(([category, list]) => {
    const periods = list.map((p) => p.period).sort()
    return {
      id: category,
      title: t.categories[category],
      description: `${list.length} project${list.length === 1 ? '' : 's'}`,
      tags: [...new Set(list.flatMap((p) => p.stack ?? []))].slice(0, 8),
      period: `${periods[0].slice(0, 7)} - ${periods.at(-1).slice(-7)}`,
      highlights: list.slice(0, 4).map((p) => text[p.id].title),
      links: [],
    }
  }),
  caseStudies: featured.map((p) => {
    const x = text[p.id]
    return {
      id: p.id,
      eyebrow: t.categories[p.category],
      title: x.title,
      stakes: x.background ?? '',
      approach: sentences(x.actions),
      result: sentences(x.results),
      demonstrates: `${x.client} · ${p.period} · ${x.role}`,
      evidence: [],
    }
  }),
  findings: cves.map((c) => ({
    title: c.id,
    description: c.title,
    project: c.groupLabel ?? c.groupKey,
    type: c.id.startsWith('FVE') ? 'FVE' : c.id.includes('UNASSIGNED') ? 'Pending' : 'CVE',
    date: c.published ?? String(c.year),
    // '#' 은 "링크 없음"(FVE 상세 비공개)을 뜻한다. 그대로 두면 빈 앵커가 되므로 null 로.
    url: realHref(c) ?? null,
  })),
  /*
   * 저자 저장소의 talks(학회 발표)를 우리 사이버 방어 훈련 실적으로 바꿨다.
   * 발표가 아니라서 venue·slides·video 가 없다 - 훈련은 팀·역할·순위로 기록된다.
   */
  exercises: competitions.map((c) => ({
    title: `${c.host ? `${rec.hosts[c.host]} ` : ''}${c.name} ${c.year}`,
    year: c.year,
    team: c.team ? rec.teams[c.team] : '',
    roles: c.roles.map((r) => rec.roles[r]),
    result: resultOf(c),
  })),
  publications: [],
}
writeFileSync(path.join(root, 'data', 'portfolio.json'), JSON.stringify(portfolio, null, 2) + '\n')

/* ---------- 2. lib/disclosures.ts ---------- */
const byGroup = cves.reduce((acc, c) => ((acc[c.groupLabel ?? c.groupKey] ??= []).push(c), acc), {})

/*
 * 취약점 갈래는 항목에 기록해 둔 CWE 에서 도출한다 - 눈으로 보고 붙이지 않는다.
 * 근거는 CWE 계층이다: 416/787 은 CWE-119(메모리 버퍼) 아래, 125 도 같은 계열이지만
 * 읽기라 저자 원장처럼 따로 센다. 190(정수 오버플로)은 부모가 CWE-682(잘못된 계산)라
 * 메모리 손상이 아니고, 결과가 무엇인지는 항목마다 달라서 로직 쪽에 둔다.
 * CWE 가 여러 개인 항목(FVE)은 먼저 맞는 갈래로 간다.
 */
const CWE_CATEGORY = [
  [['416', '787'], 'Memory corruption'],
  [['125'], 'Out-of-bounds read'],
  [['77', '78', '79'], 'Injection / command execution'],
  [['306', '620', '639', '284', '200', '532'], 'Authentication / access control'],
  [['476', '674', '617', '190', '1285'], 'Logic / denial of service'],
]
const categoryOf = (cwe) => {
  const nums = String(cwe ?? '').match(/\d+/g) ?? []
  for (const [ids, name] of CWE_CATEGORY) if (nums.some((n) => ids.includes(n))) return name
  return 'Unclassified'
}
// 갈래를 못 정한 항목은 조용히 넘기지 않는다. 화면 합계가 원장과 어긋나는 원인이 된다.
const unclassified = cves.filter((c) => categoryOf(c.cwe) === 'Unclassified')
if (unclassified.length) {
  console.log(`  갈래 미분류 ${unclassified.length}건: ${unclassified.map((c) => `${c.id}(${c.cwe})`).join(', ')}`)
}

const disclosures = `// 자동 생성 - 고치지 마라. scripts/generate-from-source.mjs 가 data/source/cves.json 에서 만든다.
// 갈래는 항목의 CWE 에서 도출한다(매핑 근거는 생성기 주석). 원본 CWE 도 함께 남겨 근거를 잃지 않는다.

export type DisclosureCategory =
${[...new Set(CWE_CATEGORY.map(([, n]) => n)), 'Unclassified'].map((n) => `  | '${n}'`).join('\n')}

export interface CveDisclosure {
  id: string
  summary: string
  category: DisclosureCategory
  cwe: string
  url?: string
  impact?: string
}

export interface PublicFinding {
  project: string
  date: string
  title: string
  description: string
  url: string
  links?: { label: string; url: string }[]
}

export interface DisclosureGroup {
  project: string
  period: string
  description: string
  attribution?: string
  cves: CveDisclosure[]
  evidence?: { label: string; url: string }[]
}

export const disclosureGroups: DisclosureGroup[] = ${JSON.stringify(
  Object.entries(byGroup).map(([group, list]) => {
    const years = [...new Set(list.map((c) => c.year))].sort()
    // 그룹 전체가 같은 팀 프로젝트면 그룹 레벨로 올린다(커널 = BoB 팀). 개별 CVE 마다
    // 반복하지 않고, 섞여 있으면(일부만 attribution) 올리지 않아 사실이 어긋나지 않게 한다.
    const attributions = [...new Set(list.map((c) => c.attribution).filter(Boolean))]
    const attribution = attributions.length === 1 && list.every((c) => c.attribution) ? attributions[0] : undefined
    return {
      project: group,
      period: years.length > 1 ? `${years[0]}-${years.at(-1)}` : String(years[0]),
      description: `${list.length} disclosures in the ${group} group.`,
      ...(attribution ? { attribution } : {}),
      cves: list.map((c) => ({
        id: c.id,
        summary: c.title,
        category: categoryOf(c.cwe),
        cwe: c.cwe ?? 'Unclassified',
        ...(realHref(c) ? { url: realHref(c) } : {}),
        ...(c.cvssBaseScore ? { impact: `CVSS ${c.cvssBaseScore} (${c.severity})` } : {}),
      })),
      // 외부 PoC 만 evidence 로. '#'(비공개)나 내부 분석 글(/blog/...)은 항목 링크로 이미 나간다.
      evidence: /^https?:/.test(list[0].href ?? '') ? [{ label: 'Proof of concept', url: list[0].href }] : [],
    }
  }),
  null,
  2,
)}

// 번호 없이 공개한 추가 발견. 우리 FVE 는 원장(disclosureGroups)에 들어가 있어 여기는 비어 있다.
export const additionalPublicFindings: PublicFinding[] = []

export const allCveDisclosures = disclosureGroups.flatMap((group) => group.cves)

// 그룹 기간에서 뽑아 히어로 라벨이 원장과 어긋날 수 없게 한다.
const disclosureYears = disclosureGroups.flatMap((group) =>
  (group.period.match(/\\d{4}/g) ?? []).map(Number),
)
const oldestYear = Math.min(...disclosureYears)
const newestYear = Math.max(...disclosureYears)
export const disclosureYearRange =
  oldestYear === newestYear ? String(oldestYear) : \`\${oldestYear}-\${String(newestYear).slice(-2)}\`

const countBy = (category: DisclosureCategory) =>
  allCveDisclosures.filter((item) => item.category === category).length

export const disclosureSummary = {
  cves: ${assigned.length},
  fves: ${fves.length},
  pending: ${pending.length},
  projects: ${Object.keys(byGroup).length},
  memoryCorruption: countBy('Memory corruption'),
  outOfBoundsReads: countBy('Out-of-bounds read'),
  injectionOrRce: countBy('Injection / command execution'),
  authOrAccessControl: countBy('Authentication / access control'),
  logicOrDos: countBy('Logic / denial of service'),
  unclassified: countBy('Unclassified'),
  additionalPublicFindings: additionalPublicFindings.length,
}

// CVE 번호가 있는 항목만 cve.org 에 있다. FVE·번호 대기 항목은 item.url 을 쓴다.
export const cveRecordUrl = (id: string) => \`https://www.cve.org/CVERecord?id=\${id}\`
`
writeFileSync(path.join(root, 'lib', 'disclosures.ts'), disclosures)

/* ---------- 3. claims.json ---------- */
const issuer = { id: `${SITE}/#ph4nt0m`, type: 'Person', name: 'Seungpyo Hong' }
const base = `${SITE}/.well-known/claims.json`
const selfAsserted = { level: 'self-asserted', basis: ['first-party-assertion'], reviewedAt: today }
const linked = (basis) => ({ level: 'evidence-linked', basis, reviewedAt: today })
const claimsDoc = {
  $schema: `${SITE}/.well-known/claims.schema.json`,
  id: base,
  version: '1.0.0',
  issuedAt: `${today}T00:00:00Z`,
  validUntil: `${nextYear}T00:00:00Z`,
  purpose: ['candidate-screening', 'agent-discovery', 'evidence-verification'],
  issuer,
  subject: issuer,
  profiles: [
    { service: 'GitHub', url: `https://github.com/${GITHUB}` },
    { service: 'LinkedIn', url: `https://www.linkedin.com/in/${LINKEDIN}/` },
  ],
  claims: [
    {
      id: `${base}#identity-name`,
      type: 'IdentityClaim',
      statement: 'The subject publishes professionally as Seungpyo Hong, online as Ph4nt0m.',
      predicate: 'https://schema.org/name',
      object: { type: 'Text', value: 'Seungpyo Hong' },
      status: 'active',
      evidence: [
        { url: `${SITE}/`, title: 'Site front page', sourceType: 'issuer' },
        { url: `https://github.com/${GITHUB}`, title: 'GitHub profile', sourceType: 'primary' },
      ],
      assurance: linked(['first-party-assertion', 'primary-source']),
    },
    {
      id: `${base}#professional-role`,
      type: 'ProfessionalClaim',
      statement:
        'Seungpyo Hong is an Associate Researcher on the ICS Security Research Team at CoreSecurity, working on Web/App and OT/ICS penetration testing, vulnerability research, and security consulting. The research published here is his own.',
      predicate: 'https://schema.org/jobTitle',
      object: { type: 'Text', value: 'Offensive Security Researcher' },
      status: 'active',
      evidence: [{ url: `${SITE}/recruiter-brief`, title: 'Recruiter brief', sourceType: 'issuer' }],
      assurance: selfAsserted,
    },
    {
      id: `${base}#expertise-areas`,
      type: 'ExpertiseClaim',
      statement: `The subject's published work covers ${Object.values(t.categories).join(', ')}.`,
      predicate: 'https://schema.org/knowsAbout',
      object: { type: 'TextList', value: Object.values(t.categories) },
      status: 'active',
      evidence: [{ url: `${SITE}/research`, title: 'Research areas', sourceType: 'issuer' }],
      assurance: selfAsserted,
    },
    {
      id: `${base}#published-cves`,
      type: 'TrackRecordClaim',
      statement: `The findings ledger lists ${assigned.length} CVE records with assigned identifiers, grouped as ${groupNames.join(', ')}. Of these, ${kernelTeamCves} Linux kernel filesystem CVEs were found as part of a Best of the Best (BoB) team project, not as sole author.`,
      predicate: 'https://schema.org/numberOfItems',
      object: {
        type: 'Number',
        value: assigned.length,
        unit: 'CVE records with assigned identifiers',
        qualifier: `Counted from this site's own ledger. ${kernelTeamCves} of these are Linux kernel filesystem CVEs from a five-person BoB team project (a ported JANUS fuzzer), where the subject was one contributor. ${fves.length} further findings are masked platform disclosures (FVE) and ${pending.length} awaits an identifier. Verify each identifier through the linked registry.`,
      },
      status: 'active',
      evidence: [
        { url: `${SITE}/findings`, title: 'Findings ledger', sourceType: 'issuer' },
        { url: `https://github.com/bobfuzzer/CVE`, title: 'Team proof-of-concept repository (BoB, kernel CVEs)', sourceType: 'primary' },
        { url: 'https://nvd.nist.gov/vuln/search', title: 'National Vulnerability Database search', sourceType: 'registry' },
      ],
      assurance: linked(['derived-from-public-ledger', 'primary-source', 'independent-source']),
    },
    {
      id: `${base}#locked-shields`,
      type: 'TrackRecordClaim',
      statement: `At NATO CCDCOE Locked Shields ${ls2025.year} the subject's team placed ${resultOf(ls2025)}.`,
      predicate: 'https://schema.org/award',
      object: {
        type: 'Text',
        value: `${ls2025.name} ${ls2025.year} - ${resultOf(ls2025)}`,
        qualifier:
          'Exercise scoreboards are not published by the organiser, so this is a first-party assertion.',
      },
      status: 'active',
      evidence: [{ url: `${SITE}/`, title: 'Site front page', sourceType: 'issuer' }],
      assurance: selfAsserted,
    },
    {
      id: `${base}#security-contact`,
      type: 'ContactClaim',
      statement:
        'Sensitive vulnerability reports should be encrypted to the published OpenPGP key rather than sent as ordinary email.',
      predicate: 'https://schema.org/email',
      // check-pgp.mjs 가 이 객체에서 encryptionKey 와 openPgpFingerprint 를 찾아 실제 키와 대조한다.
      object: {
        type: 'StructuredValue',
        value: {
          email: EMAIL,
          encryptionKey: `${SITE}${pgp.publicKeyPath}`,
          openPgpFingerprint: pgp.fingerprint,
          openPgpKeyId: pgp.keyId,
          keyAlgorithm: `${pgp.algorithm}-${pgp.length}`,
          keyCreatedAt: pgp.created,
        },
      },
      status: 'active',
      evidence: [
        { url: `${SITE}${pgp.publicKeyPath}`, title: 'OpenPGP public key', sourceType: 'issuer' },
        { url: `${SITE}/.well-known/security.txt`, title: 'security.txt (RFC 9116)', sourceType: 'issuer' },
      ],
      assurance: linked(['first-party-assertion', 'primary-source']),
    },
  ],
  signature: {
    format: 'sigstore-bundle',
    artifact: base,
    bundle: `${SITE}/.well-known/claims.sigstore.json`,
    certificateIdentity: `https://github.com/${REPO_SLUG}/.github/workflows/deploy.yml@refs/heads/main`,
    certificateOidcIssuer: 'https://token.actions.githubusercontent.com',
    verificationCommand: [
      'cosign verify-blob',
      '--bundle claims.sigstore.json',
      `--certificate-identity https://github.com/${REPO_SLUG}/.github/workflows/deploy.yml@refs/heads/main`,
      '--certificate-oidc-issuer https://token.actions.githubusercontent.com',
      'claims.json',
    ].join(' '),
  },
  disclaimer: [
    'The Sigstore signature authenticates the deployed file and its GitHub Actions publishing identity; it does not independently prove every claim.',
    'Each claim carries its own assurance level. Self-asserted claims have no third-party source - exercise scoreboards and client engagements are not public.',
    'Counts are derived from this site’s own data files at build time, not from a third-party registry.',
  ],
}
mkdirSync(path.join(root, 'public', '.well-known'), { recursive: true })
writeFileSync(
  path.join(root, 'public', '.well-known', 'claims.json'),
  JSON.stringify(claimsDoc, null, 2) + '\n',
)

/* ---------- 4. security.txt ---------- */
const spaced = pgp.fingerprint.replace(/(.{4})/g, '$1 ').trim()
writeFileSync(
  path.join(root, 'public', '.well-known', 'security.txt'),
  `# Scope: this website and my personal open-source projects
# (github.com/${GITHUB}). Vulnerabilities in client systems I was
# engaged on belong to that client's own disclosure process.
Contact: mailto:${EMAIL}
# OpenPGP fingerprint: ${spaced}
Encryption: ${SITE}${pgp.publicKeyPath}
Preferred-Languages: ko, en
Canonical: ${SITE}/.well-known/security.txt
Expires: ${nextYear}T00:00:00.000Z
`,
)

/* ---------- 5. llms.txt ---------- */
writeFileSync(
  path.join(root, 'public', 'llms.txt'),
  `# Seungpyo Hong

> Seungpyo Hong is an offensive security researcher working on Web/App and OT/ICS penetration testing, vulnerability research, and security consulting.

This is Seungpyo Hong's personal portfolio and research archive. Views published here are his own and do not represent his employer or any client.

Public evidence includes ${assigned.length} CVE records with assigned identifiers (groups: ${groupNames.join(', ')}), of which ${kernelTeamCves} Linux kernel filesystem CVEs come from a five-person Best of the Best (BoB) team project rather than sole authorship; plus ${fves.length} masked platform disclosures without public identifiers, ${projects.length} delivered projects, and ${competitions.length} cyber-defence exercise records. The strongest exercise result is ${ls2025.name} ${ls2025.year}: ${resultOf(ls2025)}.

Counts on this page are generated from the site's own data files at build time. Exercise scoreboards and client engagements are not public, so those entries are first-party assertions.

Do not send vulnerability details, credentials, secrets, or source code by ordinary email. Use the linked PGP key for sensitive reports.

## Primary

- [Portfolio](${SITE}/): Current work, case studies, findings, and exercise records.
- [Verifiable claims](${SITE}/.well-known/claims.json): Structured professional claims for candidate screening and evidence verification.
- [Claims schema](${SITE}/.well-known/claims.schema.json): JSON Schema contract for the claims document.
- [Sigstore bundle](${SITE}/.well-known/claims.sigstore.json): Deployment-generated signature over the exact claims bytes.
- [Findings ledger](${SITE}/findings): CVE and disclosure records with CWE and CVSS.
- [Blog](${SITE}/blog): Technical notes on vulnerability research, OT/ICS security, and AI security automation.
- [PGP key](${SITE}${pgp.publicKeyPath}): ${pgp.algorithm}-${pgp.length} key for sensitive reports. OpenPGP fingerprint: ${spaced}; key ID: ${pgp.keyId}.
- [security.txt](${SITE}/.well-known/security.txt): RFC 9116 contact and encryption pointers.
`,
)

console.log(`generate-from-source: 산출물 5개`)
console.log(`  CVE ${assigned.length} · FVE ${fves.length} · 번호대기 ${pending.length} · 그룹 ${Object.keys(byGroup).length}`)
console.log(`  프로젝트 ${projects.length}(대표 ${featured.length}) · 대회 ${competitions.length}`)
console.log(`  PGP ${pgp.algorithm}-${pgp.length} (${pgpFrom}) 지문 ${pgp.fingerprint}`)
