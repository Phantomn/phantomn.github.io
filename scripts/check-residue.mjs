/*
 * 포크 잔재 검사기.
 *
 * 왜 필요한가: 이 저장소는 다른 사람의 사이트를 포크해 우리 것으로 교체하는 중이다.
 * "교체했다" 를 키워드 grep(ethereum|solidity|...)으로 판정했더니 다섯 건을 놓쳤다 -
 * 저자 박사 학위 JSON-LD, "no witness at this address"(저자 논문 워드플레이),
 * 저자 CVE 대상 프로젝트 목록, 저자 이력서 PDF, 메일 템플릿의 고용주 이해상충 질문.
 * 키워드 목록은 사람이 만들고 사람은 빠뜨린다.
 *
 * 그래서 판정을 바꾼다: 잔재 = **저자 원본(BASE)에 그대로 있는 사용자 가시 문자열**.
 * 키워드 목록에 의존하지 않으므로 완전하다. 교체가 끝나면 목록이 빈다.
 *
 * 기계는 "저자 사실" 과 "범용 UI 라벨"(Skip to content, Copy link)을 구분하지 못한다.
 * 그 판정은 사람이 하고 scripts/residue-keep.txt 에 한 줄씩 등재한다 - 등재가 곧
 * "이것은 저자 것이 아니라 관용구다" 라는 기록이다. 미등재 잔재가 남으면 실패한다.
 *
 * 실행: node scripts/check-residue.mjs [--json] [--all]
 *   --all  등재된 것까지 전부 보여준다(등재 목록을 검토할 때)
 *   BASE 는 환경변수 RESIDUE_BASE 로 바꿀 수 있다(기본 origin/master).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const BASE = process.env.RESIDUE_BASE ?? 'origin/master'
const asJson = process.argv.includes('--json')
const showAll = process.argv.includes('--all')

const KEEP_FILE = 'scripts/residue-keep.txt'
const keep = new Set(
  existsSync(KEEP_FILE)
    ? readFileSync(KEEP_FILE, 'utf8')
        .split('\n')
        .map((l) => l.replace(/\s+#.*$/, '').trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
)

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 })

/* 검사 대상: 화면에 글자를 내보내는 소스. 콘텐츠(content/)는 이미 우리 글이라 제외. */
const TARGET = /^(app|components|lib)\/.*\.(tsx|ts)$/

/*
 * 문자열 추출. 사용자에게 보이는 것만 남기려면 코드 문자열을 걸러야 한다.
 * 기준: 공백을 포함한 12자 이상. 기술 식별자·경로·클래스 이름은 대체로 공백이 없다.
 * Tailwind 클래스는 공백이 있으므로 따로 배제한다.
 */
// Tailwind 클래스 나열. 변수에 담긴 className(`focus-ring ... ${x}`)도 거르도록 ${}·() 허용.
const TAILWIND = /^[a-z0-9:[\]/.%_${}()#-]+(\s+[a-z0-9:[\]/.%_${}()#-]+)*$/
const isVisible = (s) => {
  const t = s.trim()
  if (t.length < 12 || !/\s/.test(t)) return false
  if (!/[A-Za-z]/.test(t)) return false
  if (/^https?:\/\//.test(t)) return false
  if (TAILWIND.test(t)) return false // className 값
  if (/^[\w-]+\/[\w-]+/.test(t)) return false // 경로·MIME
  // 코드 냄새: 리터럴/JSX 정규식이 코드 조각(연산자·메서드 호출·템플릿 보간)을 문장으로
  // 오인하는 것을 막는다. 화면에 보이는 산문에는 이 기호들이 거의 안 나온다.
  if (/&&|\|\||=>|\$\{|\.\w+\(|;\s|\)\s*&&/.test(t)) return false
  if (/^[,\]}).:]/.test(t)) return false // 구두점으로 시작 = 잘린 코드 조각
  if (/\b(export|const|let|return|import|new|function)\b/.test(t)) return false // 코드 키워드
  return true
}

/*
 * className 값은 사용자에게 보이지 않는데 공백이 많아 문장처럼 보인다. 값을 걸러내려
 * 애쓰기보다 속성 자체를 먼저 지운다 - 템플릿 보간이 섞인 클래스 조합까지 한 번에 빠진다.
 */
const stripClasses = (src) =>
  src
    .replace(/className=\{`[\s\S]*?`\}/g, 'className=""')
    .replace(/className=(["'])[\s\S]*?\1/g, 'className=""')
    .replace(/(?:^|\n)\s*(?:const|let)\s+\w*[Cc]lass\w*\s*=\s*[\s\S]*?(?=\n\n|\nconst |\nexport |\nfunction )/g, '\n')

/** 한 파일에서 문자열 리터럴과 JSX 텍스트 노드를 뽑는다(파서 없이, 실용 수준으로). */
function extract(raw) {
  const src = stripClasses(raw)
  const out = new Set()
  // 'literal' | "literal" | `literal`  (줄바꿈 포함 백틱까지)
  for (const m of src.matchAll(/'([^'\\\n]{12,})'|"([^"\\\n]{12,})"|`([^`\\\n]{12,})`/g)) {
    const v = m[1] ?? m[2] ?? m[3]
    if (isVisible(v)) out.add(v.trim())
  }
  // JSX 텍스트 노드: >텍스트</  (닫는 태그 앞에서만 - 코드의 `a < b`, `a > b` 오인 방지)
  for (const m of src.matchAll(/>([^<>{}\n][^<>{}]{11,})<\//g)) {
    if (isVisible(m[1])) out.add(m[1].trim().replace(/\s+/g, ' '))
  }
  return out
}

/* BASE 쪽 파일 목록과 내용을 읽는다. */
const baseFiles = git('ls-tree', '-r', '--name-only', BASE)
  .split('\n')
  .filter((f) => TARGET.test(f))
const baseText = new Map()
for (const f of baseFiles) {
  try {
    baseText.set(f, git('show', `${BASE}:${f}`))
  } catch {
    /* BASE 에 없으면 비교 대상이 아니다 */
  }
}

/* BASE 전체의 가시 문자열 집합. 파일이 이름을 바꿔 옮겨졌어도 문장은 따라간다. */
const baseStrings = new Set()
for (const src of baseText.values()) for (const s of extract(src)) baseStrings.add(s)

/* 현재 트리에서 같은 문장을 찾는다. */
const headFiles = git('ls-files').split('\n').filter((f) => TARGET.test(f) && existsSync(f))
const findings = []
for (const f of headFiles) {
  const src = readFileSync(f, 'utf8')
  const lines = src.split('\n')
  const hits = [...extract(src)].filter((s) => baseStrings.has(s))
  for (const s of hits) {
    if (!showAll && keep.has(s)) continue
    const idx = lines.findIndex((l) => l.includes(s.slice(0, 40)))
    // 주석 안의 저자 설명은 화면에 안 나온다. 별도로 표시해 우선순위를 낮춘다.
    const line = (lines[idx] ?? '').trim()
    const inComment = line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')
    findings.push({ file: f, line: idx + 1, text: s, inComment, kept: keep.has(s) })
  }
}

/*
 * public/ 의 저자 정적 파일도 잔재다. 내용이 아니라 존재 자체가 배포된다.
 * BASE 에 있고 지금도 있는 파일 중, 우리가 새로 만든 산출물이 아닌 것.
 */
const OURS = /^public\/(pgp-key\.asc|llms\.txt|\.well-known\/|images\/|docs\/)/
const basePublic = new Set(
  git('ls-tree', '-r', '--name-only', BASE)
    .split('\n')
    .filter((f) => f.startsWith('public/')),
)
const staleAssets = git('ls-files')
  .split('\n')
  .filter((f) => f.startsWith('public/') && basePublic.has(f) && !OURS.test(f))

if (asJson) {
  console.log(JSON.stringify({ findings, staleAssets }, null, 2))
} else {
  const byFile = findings.reduce((acc, x) => ((acc[x.file] ??= []).push(x), acc), {})
  const files = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)
  for (const [file, list] of files) {
    const code = list.filter((x) => !x.inComment).length
    console.log(`\n${file}  (${list.length}건${code < list.length ? `, 주석 ${list.length - code}` : ''})`)
    for (const { line, text, inComment } of list.sort((a, b) => a.line - b.line)) {
      console.log(`  ${inComment ? '·' : ' '}${String(line).padStart(4)}  ${text.slice(0, 92)}`)
    }
  }
  if (staleAssets.length) {
    console.log(`\npublic/ 저자 정적 파일 ${staleAssets.length}개`)
    for (const f of staleAssets) console.log(`        ${f}`)
  }
  console.log(
    `\n합계: 문장 ${findings.length}건 · 파일 ${files.length}개 · 정적 파일 ${staleAssets.length}개 (기준 ${BASE})`,
  )
}

process.exit(findings.length || staleAssets.length ? 1 : 0)
