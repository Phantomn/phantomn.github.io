# Spec: Blog IA/UX Improvement (Tags, Search, Data Quality)

Status: draft, awaiting human review before Phase 4 (Implement)
Owner: Phantomn
Source research: /tmp/.../ph4ntom-ux-research-report.md (S1-S10 site audit + evidence),
brainstorm session decisions Q1/Q2/Q3/Q4(=Q6)/Q7/Q8 (this conversation)
Companion tracker: TaskList #2-#14 (created before this spec; this spec is the
Self-Contained execution reference for those tasks)

---

## ASSUMPTIONS I'M MAKING

1. "Self-Contained"하게 작성하라는 요청은 이 문서 하나만 보고 구현자가 추가 질문 없이
   작업을 시작할 수 있어야 한다는 뜻으로 해석한다 -> 모든 파일 경로/라인/현재 데이터
   분포를 실측치로 박아 넣는다(추측 금지).
2. TaskList #2-#14는 이미 승인된 범위다. 이 스펙은 그 작업들을 다시 논의하는 게 아니라
   "어떻게 구현할지"의 기술적 세부를 확정하는 문서다.
3. 새 npm 의존성은 추가하지 않는다(사용자 제약 확인 완료: "새 라이브러리/의존성 추가
   지양"). 글로벌 검색은 기존 shadcn 컴포넌트(Sheet/Input/Table, radix-ui 이미 설치됨)
   와 순수 TypeScript 문자열 매칭으로 구현한다.
4. 기존 글 URL(/[locale]/blog/[slug]/ 등)은 절대 바뀌지 않는다(사용자 제약 확인 완료).
   /tags/, /tags/[tag]/ 는 전부 신규 라우트라 이 제약과 충돌하지 않는다.
5. `<html lang>` 수정(TaskList #1)은 이미 완료되어 별도 스펙이 필요 없다 - 이 문서는
   #2-#14만 다룬다.
6. i18n 본문 번역(en/pt-br/es)은 DynamicTranslator(client-side, Lingva 백엔드) 그대로
   유지한다(Q8 승인) - 이 스펙은 그 메커니즘을 바꾸지 않는다.

이 중 틀린 게 있으면 지금 정정해달라 - 없으면 아래 내용대로 진행한다.

---

## Objective

Ph4nt0m 블로그(blog.ph4nt0m.xyz)의 Blog/CVE/Writeup 세 아카이브가 가진 태그/데이터
품질/탐색성 결함을 근본 원인 수준에서 고친다. 대상 사용자는 CVE를 찾는 보안 연구자,
CTF Writeup을 주제별로 찾는 연구자, 긴 Research 글을 읽고 관련 글로 넘어가려는
독자다(전체 페르소나는 연구 보고서 S3 참조).

성공 기준: (1) 태그 배지를 클릭하면 실제로 같은 주제의 다른 글/CVE/Writeup으로
이동한다, (2) 대소문자만 다른 중복 태그가 사라진다, (3) Writeup 목록/상세가
JS 없이도(크롤러 기준) 내용에 도달 가능하다, (4) Blog+CVE+Writeup을 한 번에 검색할
수 있다, (5) 검색/태그/페이지네이션 상태가 URL에 반영되어 새로고침해도 유지된다.

## Tech Stack

- Next.js 15 (App Router), `output: "export"` 정적 export - 서버 런타임/API route 없음
- React 19, TypeScript 5 (strict, `tsc --noEmit`로 검증)
- next-intl 4.9 - locale: en/ko(default)/pt-br/es, `localePrefix: "always"`
  (src/i18n/routing.ts)
- Tailwind CSS 4 + shadcn 스타일 컴포넌트(src/components/ui, radix-ui 1.4 기반)
- 콘텐츠: `content/ko/{blog,cves,writeups}/*.md` (gray-matter 프론트매터 + MDX 본문),
  ko만 실체 존재(en/es/pt-br 디렉토리는 0개 파일 - 실측 완료). CVE는 별도로
  `src/data/cves.ts`(TS 객체 배열, LegacyCveEntry)가 진짜 소스이며 content/ko/cves/*.md는
  본문(장문 설명) 전용.
- 번역: `src/components/dynamic-translator.tsx`(client component, mount 후 DOM
  TreeWalker로 텍스트 노드를 Lingva API에 보내 치환) - 본 스펙 범위 밖, 그대로 둠.

## Commands

```
Dev:        pnpm dev
Build:      pnpm build          (postbuild: node scripts/lock-posts.mjs)
Typecheck:  pnpm typecheck      (tsc --noEmit)
Lint:       pnpm lint           (eslint . --cache)
Dead code:  pnpm knip
E2E:        pnpm test:e2e       (playwright test, testDir=./tests, out/ 정적 파일 대상)
```

CI(.github/workflows/deploy.yml)는 `qa`(typecheck+lint+knip) -> `build` -> `e2e`
-> `deploy` 순서로 push마다 main에 직행 배포된다. 즉 이 스펙의 모든 작업은 저
4단계를 통과해야 배포된다 - 로컬에서 최소 `pnpm typecheck && pnpm lint && pnpm build`
는 커밋 전에 돌려야 한다.

## Project Structure (관련 부분만)

```
content/ko/blog/*.md         -> 58개 파일, frontmatter: title/date/description/
                                 tags(string[])/categories(string[])/authors
content/ko/writeups/*.md     -> 28개 파일, frontmatter: title/date/description/
                                 tags(string[])/platform/category(string)/difficulty
content/ko/cves/*.md         -> 28개 파일, 본문(장문)만. 메타데이터는 src/data/cves.ts

src/data/cves.ts             -> CVE/FVE 메타데이터 배열(LegacyCveEntry -> CveEntry).
                                 CveEntry.tags(L69)는 이미 존재하나 정규화 함수
                                 normalizeCveEntry(L716-720)가 [kind, groupKey,
                                 "redacted"?]만 자동 생성하는 구조적 메타데이터
                                 - 블로그/Writeup 같은 주제(topic) 폴크소노미가
                                 아님(2026-09-17 plan 작성 중 재확인). content/ko/
                                 cves/*.md 프론트매터의 tags도 동일하게 연도/CWE/
                                 상태 자동생성 값뿐(예: llm, 2026, high, cwe-674,
                                 dos - cve-2026-52130.md 실측). 즉 "CVE에 태그가
                                 없다"가 아니라 "CVE에 주제 태그가 없다"가 정확한
                                 진단 - 기존 tags 필드는 건드리지 않고 새 필드
                                 topics: string[]를 추가한다(아래 Task 2 참조).
src/data/taxonomy.ts         -> (신규) TAG_SYNONYMS: Record<string,string>
src/lib/content.ts           -> getAllPosts/getAllWriteups 등 frontmatter 파서.
                                 CATEGORY_NAMES, SOURCE_NAMES 매핑 여기 있음(L173-189)
src/lib/taxonomy.ts          -> (신규) normalizeTag(), TaggedItem, getAllTaggedItems(), buildTagIndex()
src/lib/seo.ts                -> 메타데이터(title/description) 빌더
src/lib/translation-api.ts   -> Lingva 클라이언트(번역 범위 밖)

src/hooks/                    -> 디렉토리는 존재하나 현재 파일 0개(빈 디렉토리,
                                 2026-09-17 ls로 실측 확인). "기존 패턴을 따른다"가
                                 아니라 이 디렉토리에 실질적으로 처음 파일이 생기는
                                 것임 - 참고할 기존 훅 컨벤션 없음.
src/hooks/use-url-state.ts   -> (신규, Task #15) pagination/검색/태그필터 공용
                                 URL 쿼리 상태 훅

scripts/normalize-tags.mjs        -> (신규, Task #2) 태그 대소문자 정규화 마이그레이션
scripts/build-search-index.mjs    -> (신규, Task #12) 빌드타임 검색 인덱스 생성,
                                      postbuild에 lock-posts.mjs와 함께 등록
public/search-index.json          -> (신규 산출물, Task #12) build-search-index.mjs가
                                      생성 -> Next static export가 그대로 out/으로 복사
src/components/global-search.tsx  -> (신규, Task #12)

src/app/[locale]/tags/page.tsx        -> (신규, Task #10)
src/app/[locale]/tags/[tag]/page.tsx  -> (신규, Task #9)

src/components/blog/blog-search-layout.tsx   -> 블로그 목록 + client 검색 + pagination
                                                 (PaginationControls, L53-117)
src/components/writeups/writeup-data-grid.tsx -> Writeup 목록 테이블(L282: <tr onClick>)
src/components/ui/pagination.tsx              -> shadcn Pagination 프리미티브(그대로 재사용)
src/components/ui/sheet.tsx                   -> shadcn Sheet(글로벌 검색 오버레이로 재사용)

src/app/[locale]/layout.tsx    -> 실제 root layout(lang={locale} SSR, #1에서 완료)
src/app/(root)/layout.tsx      -> "/" 리다이렉트 전용 root layout(#1에서 완료)

tests/smoke.spec.ts            -> Playwright e2e, 홈/블로그/포트폴리오 3개 페이지 로드 확인
```

## Data Model (현재 실측 -> 목표)

### 현재 (실측, 2026-09-17 기준)

| 섹션 | 항목 수 | tags 필드 | tags 실측 | category 필드 |
|---|---|---|---|---|
| Blog | 58 | 있음(frontmatter tags: string[]) | 대소문자 정규화 전 **207개** distinct, 대소문자만 다른 중복 14그룹(afl/AFL, ai-agents/AI-Agents, asan/ASan, c/C, ctf/CTF, cve/CVE, harness/Harness, iot/IoT, linux/Linux, python/Python, rop/ROP, security/Security, v8/V8, windows/Windows) | categories: string[], "Research"(43)/"research"(14)/"projects"(2) - 대소문자 오류 아니라 실제 다른 분류 축일 가능성 있음(#2에서 손대지 않음, 별도 확인 필요 -> Open Questions 참조) |
| CVE | 28 | 있으나 구조적 값뿐(tags: [kind, groupKey, "redacted"?], **주제 태그(topics)는 없음**) | N/A(topics는 #5에서 신설) | groupKey(kernel/iot/web/llm), kind(cve/fve) |
| Writeup | 28 | 있음(frontmatter tags: string[]) | 75개 distinct(대소문자 중복 이번 실측에선 미발견, #2 정규화 스크립트로 자동 검증) | category: pwn(14)/redteam(8)/reversing(3)/web(2)/misc(1). CATEGORY_NAMES(content.ts L184-189)가 표시명 매핑 |
| Writeup | - | - | - | difficulty: Easy(10)+easy(4), medium(5)+Medium(3), easy-medium(5), Hard(1) - 표기 3계열 혼재 |

### 목표 데이터 모델

- `src/lib/taxonomy.ts`(신규): `normalizeTag(raw: string): string`가 전 사이트
  공통으로 쓰는 단일 정규화 함수. 규칙: (1) `toLowerCase()`, (2) 아래
  `TAG_SYNONYMS` 맵에 있으면 preferred term으로 치환, (3) 나머지는 lowercase
  그대로 유지(공백/특수문자 변경 없음 - kebab-case 태그(iec-62443)는 이미
  kebab이므로 별도 변환 불필요).
- `src/data/taxonomy.ts`(신규): `TAG_SYNONYMS: Record<string,string>` - 대소문자
  외에 진짜 동의어(예: "xss"/"cross-site-scripting" 같은 것)가 나중에 발견되면
  여기 추가. 초기 버전은 위 14개 대소문자 그룹만 preferred term(소문자)으로 매핑
  (실제로는 소문자 변환만으로 이 14그룹은 전부 해소되므로 SYNONYMS 맵은 빈
  객체로 시작해도 무방 - 향후 "진짜 동의어"용으로 자리만 마련).
- CVE에 `topics: string[]` 필드 신설(src/data/cves.ts의 `LegacyCveEntry`/
  `CveEntry` 타입 확장 - 기존 `tags` 필드는 건드리지 않음, 그건 [kind,
  groupKey, "redacted"?] 구조적 값으로 계속 그 용도로만 쓰임). `topics` 값은
  groupKey/cwe/summary에서 착안해 저자가 직접 부여(예: groupKey="llm" 항목엔
  "llm", cwe="CWE-190"이면 "integer-overflow" 등 - 힌트일 뿐 자동 생성 아님).
  정확한 매핑표는 Task #5 구현 시 cves.ts 28개 항목을 1건씩 검토해서 채운다
  (자동 생성 금지 - 취약점 성격을 가장 잘 아는 저자가 직접 붙여야 정확함).
- 3섹션 통합 태그 조회는 두 함수로 분리(신규, `src/lib/taxonomy.ts` - plan
  작성 중 단일 `getAllTags()` 초안에서 이렇게 분리 확정됨):
  `getAllTaggedItems(locale): TaggedItem[]`(blog+cve+writeup 원본 목록)와
  `buildTagIndex(items: TaggedItem[]): Map<string, TaggedItem[]>`(정규화된
  태그별로 묶기 - 빈도는 `items.length`로 읽음, 별도 count 필드 없음).

## Root Causes (확정된 버그, 코드로 확인 완료)

### RC-1: Writeup 목록 행이 앵커가 아님 (Task #6)

`src/components/writeups/writeup-data-grid.tsx:282-291`:
```tsx
<tr
  key={w.href}
  onClick={() => router.push(w.href)}
  className={cn("group cursor-pointer ...")}
>
```
`<tr>`에 `onClick`만 있고 `<a href>`가 전혀 없다. 새 탭 열기, 링크 복사,
크롤러 탐색이 전부 불가능한 근본 원인이다.

수정: 행 전체를 감싸지 말고, 제목 셀(Name 컬럼) 내부의 텍스트를
`<Link href={w.href} className="absolute inset-0" aria-label={w.name} />`
패턴(row 전체를 클릭 가능하게 하면서도 진짜 앵커인 "stretched link" 패턴)으로
바꾼다. `<tr>`는 `position: relative`를 유지하고 `onClick`/`router.push`는 제거.

### RC-2: Pagination이 href="#" 고정 (Task #11)

`src/components/blog/blog-search-layout.tsx:70-113` - `PaginationPrevious`/
`PaginationLink`/`PaginationNext` 전부 `href="#"` + `onClick={(e) =>
e.preventDefault(); onPageChange(n)}`. `currentPage`는 순수 `useState`.

수정: `href`를 실제 `?page=${n}` 쿼리로 채우고, `useSearchParams()`(next/navigation)
로 초기 `currentPage`를 URL에서 읽는다. 클릭 시 `e.preventDefault()` 제거하고
`router.push(`?page=${n}`, { scroll: false })` 사용(Task #16과 동일 메커니즘
재사용 - 아래 "글로벌 검색/필터 URL 상태" 절 참조).

### RC-3: Writeup 태그(207개 중 75개)와 category(5개 값)가 서로 다른 축인데
category만 필터에 노출됨, 그리고 category=redteam인데 pwn류 태그를 가진
7개 항목 확정 (Task #3)

`content/ko/writeups/{browser-exploitation, codegate-ctf,
csaw-2013-exploitation-2, hitcon-training-lab10, konjuuni-gifted-pwnable2,
one-gadget-example, suninatas-challenges}.md` - category: "redteam"인데 tags에
pwn/rop/heap/bof/one-gadget 등이 있음. 이 7개를 1건씩 열어서 실제 문제 성격에
맞는 category로 재분류(대부분 "pwn"이 맞을 것으로 추정되나 자동 변경 금지 -
문제 내용을 실제로 읽고 판단).

### RC-4: 대소문자 중복 태그 14그룹 (Task #2)

위 "Data Model" 표에 실측 그룹 전부 나열됨. `content/ko/blog/*.md`의 tags
배열을 `normalizeTag()`로 일괄 변환하는 마이그레이션 스크립트
(`scripts/normalize-tags.mjs`, 기존 `scripts/lock-posts.mjs` 패턴 참고)를
작성해 실행. 실행 전/후 태그 목록을 `--dry-run`으로 diff 출력 후 사람이 확인하고
`--apply`로 실제 파일 수정.

### RC-5: 태그가 링크가 아님 / 관련글 링크가 전부 동일 URL (Task #8)

블로그 개별글 상단 태그 배지, 하단 "관련 게시물" 링크 컴포넌트(src/components/blog
디렉토리 내, 정확한 파일은 Task #8 착수 시 `grep -rn "관련 게시물\|related" src/app/
\[locale\]/blog/\[slug\]/page.tsx src/components/blog` 로 재확인 - 이 스펙 작성
시점엔 render 함수 자체를 직접 열람하지 않았으므로 파일명을 단정하지 않음)를
`<a href="/${locale}/tags/${normalizeTag(tag)}/">`로 교체. RC-9(/tags/[tag]/
페이지)가 먼저 존재해야 함(TaskList 의존관계 #8 blockedBy #9와 일치).

### RC-6: 태그/카테고리 전용 URL 전부 404 (Task #9, #10)

`/ko/blog/tags/*`, `/ko/tags/*`, `/ko/blog/tag/*`, `/ko/blog/category/*`
전부 라우트 자체가 없음(curl로 404 확인 완료). `/[locale]/tags/[tag]/`,
`/[locale]/tags/` 신규 라우트 필요.

## Design Decisions (Open Question이었던 것 중 이번에 확정)

### D-1: 태그 UI 형태 (Q2 조사 결과 반영)

- 태그 "클라우드"(폰트 크기 가중) 위젯은 만들지 않는다 - Nielsen(2009)
  "tag clouds ... use screen space inefficiently, and many users don't know
  how to use them", Lohmann et al.(2009, INTERACT) "spot-search 과제엔 alphabetical
  list가 cloud보다 낫다"는 근거로 명시적 배제.
- `/[locale]/tags/[tag]/`: 해당 태그를 가진 Blog/CVE/Writeup 항목을 유형 뱃지와
  함께 날짜순 flat list로 보여주는 페이지. 테이블/카드 없이 `src/components/ui/
  table.tsx` 재사용 가능한 단순 리스트.
- `/[locale]/tags/`: 전체 태그 인덱스. 207개(정규화 후 193개 예상) 전부 나열하지
  않고, **빈도 3회 이상**인 태그만 알파벳순 flat list로 노출(Hedden 실무 기준:
  50-60개 넘으면 flat list도 훑어보기 어려움 -> 상위만 노출해 그 문턱 아래로
  유지). 3회 미만 롱테일 태그는 개별 글의 실제 링크(RC-5)와 글로벌 검색(D-2)
  으로만 도달 가능 - 이는 의도된 설계이지 누락이 아님을 페이지 하단에 짧게
  명시("전체 태그는 검색으로 찾아보세요" 같은 문구, 정확한 카피는 구현 시 결정).
- 사이드바 체크박스 다중선택 필터(facet UI)는 이번 라운드에 만들지 않는다
  (NNG "Filters vs Facets": 필요성 검증 전 투자 금지, 이 사이트는 아직 그 필요성
  실측 데이터가 없음).

### D-2: 글로벌 검색 구현 방식 (Task #12) - 새 의존성 없이

- 빌드 타임에 `scripts/build-search-index.mjs`(신규, postbuild 단계에 추가)가
  content/ko/{blog,cves,writeups}를 순회해 `public/search-index.json`을 생성.
  스키마: `{ type: "blog"|"cve"|"writeup", slug, title, description, tags:
  string[](normalizeTag 적용됨), date, href }[]`.
- 클라이언트: `src/components/global-search.tsx`(신규) - `src/components/ui/
  sheet.tsx`(이미 있음, radix Dialog 기반)로 우측 슬라이드 패널을 열고,
  `fetch("/search-index.json")` 후 순수 TS로 title/description/tags 부분
  문자열 매칭 + 태그 완전일치 가중치 부여하는 간단한 스코어링(외부 라이브러리
  없음 - Fuse.js/minisearch 등 추가 금지, 항목 수가 115개뿐이라 불필요).
- 트리거: `src/components/site-header.tsx`에 검색 아이콘 버튼 추가(Cmd+K 단축키는
  이번 라운드 범위 밖 - nice-to-have로 Open Questions에 남김).
- SiteHeader에 이미 있는 로케일/테마 전환 버튼과 동일한 톤의 아이콘 버튼 스타일
  재사용(구현 시 site-header.tsx 직접 열람해서 기존 버튼 스타일 그대로 따라감).

### D-3: 검색/태그/페이지네이션 URL 상태 (Task #16) - 공통 메커니즘

정적 export이므로 서버 사이드 라우팅 없음. `next/navigation`의
`useSearchParams()` + `useRouter().push(pathname + "?" + params, { scroll:
false })` 클라이언트 패턴을 아래 3곳에 동일하게 적용:
- 블로그 pagination: `?page=N` (RC-2)
- 글로벌 검색: `?q=<query>` (Sheet가 열려 있을 때만 반영, 닫으면 제거)
- `/tags/` 인덱스에서 검색 필터링(있다면): `?q=<substring>`

공통 훅 `src/hooks/use-url-state.ts`(신규, src/hooks 디렉토리 이미 존재 확인)로
추출해서 3곳이 각자 구현하지 않게 한다.

## Code Style

기존 코드 관례를 그대로 따른다(신규 관례 도입 금지):
- 함수형 컴포넌트, named export (`export function Foo() {}`), default export는
  Next.js가 요구하는 `page.tsx`/`layout.tsx`에서만.
- Tailwind 유틸리티 클래스 직접 사용, `cn()`(src/lib/utils.ts의 clsx+tailwind-merge
  래퍼)으로 조건부 클래스 병합 - writeup-data-grid.tsx L285의 `cn(...)` 패턴 참고.
- 2-space indent, 큰따옴표, 세미콜론 - 기존 파일과 100% 동일(Prettier 설정 파일
  없음, ESLint(next/core-web-vitals + next/typescript)만 적용 - `pnpm lint`로 검증).
- 데이터 파서/변환 함수는 `src/lib/*.ts`에, UI 컴포넌트는 `src/components/**/*.tsx`에
  - 기존 구조(content.ts, cves.ts, taxonomy.ts 신규 추가도 이 위치)를 따름.
- 신규 스크립트(scripts/normalize-tags.mjs, scripts/build-search-index.mjs)는
  기존 `scripts/lock-posts.mjs`와 동일하게 순수 Node.js(ESM, `.mjs`), 외부
  런타임 의존성 없이 `fs`/`path`/`gray-matter`(이미 의존성에 있음)만 사용.

## Testing Strategy

- 프레임워크: Playwright(`@playwright/test` ^1.50), `tests/*.spec.ts`, 정적
  export(`out/`)를 `pnpm exec serve out -l 4173`로 띄워서 테스트(playwright.config.ts).
- 커버리지 기대치: 이 스펙 범위의 각 신규/변경 라우트마다 최소 1개의 "페이지가
  로드되고 200대 상태코드+제목이 나온다" 수준 스모크 테스트를 `tests/smoke.spec.ts`
  에 추가(기존 3개 테스트 패턴을 그대로 복제):
  - `/en/tags/` 로드
  - `/en/tags/pwn/` 로드(pwn은 실제 존재가 보장되는 태그)
  - 글로벌 검색 Sheet가 열리고 "pwn" 검색 시 결과 1건 이상(page.getByRole 등
    Playwright locator로 검증)
- **회귀 방지 테스트(spec-audit 2026-09-17 보강)**: RC-1/RC-2/#7처럼 "지금 잘
  고쳤는지"를 1회성 grep/curl로만 확인하면 나중에 실수로 되돌려도 CI가 못
  잡는다. 아래 3건은 grep 확인과 별개로 `tests/smoke.spec.ts`에 **영구
  회귀 테스트를 반드시 추가**한다(각 태스크 Acceptance의 일부로 취급):
  - `#6`(Writeup 앵커화): `page.goto("/en/writeups/")` 후
    `page.locator('a[href*="/writeups/"]').count()`가 28 이상인지 assert
    (앵커가 아니라 `<tr onClick>`으로 되돌아가면 이 count가 0에 가깝게 떨어짐)
  - `#7`(Writeup SSR): Playwright의 `request` 컨텍스트(브라우저 JS 없이
    raw HTML만 받는 API)로 writeup 상세 1건을 fetch해 응답 본문에 실제
    콘텐츠 텍스트가 포함되는지 assert(Suspense placeholder로 되돌아가면
    이 raw HTML엔 본문이 없음 - 브라우저 fixture로는 이 회귀를 못 잡음,
    반드시 `request.get()` 사용)
  - `#11`(Pagination URL): `page.goto("/en/blog/?page=2")` 후 1페이지에는
    없는 글 제목이 보이는지 assert(href="#" 방식으로 되돌아가면 쿼리를
    무시하고 항상 1페이지가 뜸)
- 데이터 마이그레이션 스크립트(#2, #5)는 자체 검증 로직 필요 - `node
  scripts/normalize-tags.mjs --dry-run`이 사람이 확인 가능한 diff를 stdout에
  출력해야 하고, `--apply` 실행 후 `grep -c` 등으로 대소문자 중복이 실제로
  0건이 됐는지 확인하는 것을 각 태스크의 Verify 단계로 삼는다(별도 단위테스트
  프레임워크 도입 안 함 - 이 프로젝트엔 vitest/jest가 없고 새로 추가하지 않음,
  YAGNI).
- 회귀 방지: 매 태스크 종료 시 `pnpm typecheck && pnpm lint && pnpm build &&
  pnpm test:e2e`를 로컬에서 통과시킨 뒤 커밋(CI와 동일 게이트를 로컬에서 선실행).

## Boundaries

**Always do:**
- 커밋 전 `pnpm typecheck && pnpm lint`
- 기존 글 URL 구조(`/[locale]/blog/[slug]/` 등) 불변 유지
- 태그 정규화는 소문자 변환 + 명시적 synonym 맵만, 휴리스틱 추측(stemming 등) 금지
- 프론트매터를 스크립트로 일괄 수정하기 전 `--dry-run`으로 diff를 사람이 먼저 확인

**Ask first:**
- `content/ko/*.md` 프론트매터를 스크립트로 일괄 수정하는 것(정규화 스크립트의
  `--apply` 실행 자체) - 자동 실행하지 말고 사용자에게 diff 보여주고 승인받은
  후 적용
- CVE에 새 `tags` 필드 값을 채워 넣는 것(취약점 성격 판단이 필요 - RC로 자동
  생성 금지, 사용자/저자 확인 필요)
- Writeup 7건의 category 재분류(RC-3) - 문제 내용을 실제로 읽어야 하므로 자동
  변경 금지, 사용자에게 문제별로 확인받거나 문제 설명을 근거로 제시 후 승인
- FVE 라벨 문구 변경(Task #14) - 저자 재량 사항, 하기 전에 먼저 물어봄

**Never do:**
- 기존 글 URL을 바꾸거나 redirect 없이 제거
- 새 npm 의존성 추가(검색/태그 기능에 한해 - 다른 무관한 버그 수정에 필요한
  경우는 예외로 그때 논의)
- `.env`/`LOCK_PASSWORD` 등 시크릿을 코드/커밋에 노출
- CI 게이트(typecheck/lint/knip/e2e) 우회(`--no-verify` 등)

## Task Breakdown (TaskList #2-#14와 1:1 매핑)

각 태스크는 이미 TaskList에 등록되어 있다(의존관계 포함). 아래는 각 태스크의
Acceptance/Verify/Files를 구체화한 것 - `/breakdown` 또는 구현 착수 시 이 표를
그대로 따른다.

- [ ] **#2 태그/카테고리 대소문자 정규화**
  - Acceptance: `content/ko/blog/*.md`의 tags 배열에서 위 14개 대소문자
    중복 그룹이 각각 1개 preferred term(소문자)으로 통합됨. "Research"/
    "research"/"projects" categories는 손대지 않음(RC-4 참조, 별도 확인 필요시
    Open Questions로).
  - Verify: `node scripts/normalize-tags.mjs --dry-run` 출력에서 14그룹이
    보이고, `--apply` 후 재실행 시 0그룹.
  - Files: `scripts/normalize-tags.mjs`(신규), `src/lib/taxonomy.ts`(신규),
    `src/data/taxonomy.ts`(신규), `content/ko/blog/*.md`(마이그레이션 대상)

- [ ] **#3 Writeup category-tag 불일치 재분류**
  - Acceptance: RC-3의 7개 파일(browser-exploitation, codegate-ctf,
    csaw-2013-exploitation-2, hitcon-training-lab10, konjuuni-gifted-pwnable2,
    one-gadget-example, suninatas-challenges) 각각의 category 필드가 문제
    내용에 맞게 재검토되어 확정됨(자동 변경 아님 - 결과가 "redteam 유지"일
    수도 있음, 판단 근거를 커밋 메시지에 남김).
  - Verify: 7개 파일 `category:` 라인 diff 확인 + `pnpm build`로 카테고리
    카운트 재계산되는지 확인.
  - Files: `content/ko/writeups/{browser-exploitation,codegate-ctf,csaw-2013-exploitation-2,hitcon-training-lab10,konjuuni-gifted-pwnable2,one-gadget-example,suninatas-challenges}.md`

- [ ] **#4 Writeup difficulty 표기 정규화**
  - Acceptance: difficulty 값이 `Easy`/`Medium`/`Hard`/`Insane` 4단계 중
    하나로 통일(easy-medium 5건은 실제 난이도 재평가 필요 - Medium으로
    일괄 변환하지 말고 문제별 확인).
  - Verify: `grep -h "^difficulty:" content/ko/writeups/*.md | sort -u`가
    4개 값만 반환.
  - Files: `content/ko/writeups/*.md`(difficulty 필드), 필요시
    `src/components/writeups/writeup-data-grid.tsx`의 `DIFFICULTY_ORDER`/
    `DIFFICULTY_STYLES`(L29, L53) 매핑 갱신

- [ ] **#5 CVE에 주제(topic) 태그 필드 신설** (2026-09-17 plan 작성 중 2차 정정:
  Writeup은 이미 tags 있음. CVE도 `tags` 필드 자체는 이미 있으나 [kind,
  groupKey, "redacted"?]뿐인 구조적 자동생성 값(normalizeCveEntry L716-720)이라
  주제 폴크소노미로 못 씀 - 기존 `tags`는 그대로 두고 새 필드 `topics:
  string[]`를 추가)
  - Acceptance: `src/data/cves.ts`의 `LegacyCveEntry`, `CveEntry` 타입에
    `topics: string[]` 추가(선택적 아님, 필수 필드로), `normalizeCveEntry()`가
    `entry.topics`를 그대로 전달, `CVE_SOURCE_ITEMS` 28개 항목 전부에 정규화된
    (#2와 동일 어휘) 주제 태그 부여.
  - Verify: `pnpm typecheck` 통과(필수 필드라 28개 전부 채워야 컴파일됨).
  - Files: `src/data/cves.ts`

- [ ] **#6 Writeup 목록 행 앵커화** (RC-1)
  - Acceptance: `/ko/writeups/` 페이지에서 각 행 제목에 마우스 우클릭 ->
    "새 탭에서 열기"가 동작. `curl`로 정적 HTML을 받았을 때 `<a href="/ko/
    writeups/{slug}/">`가 존재.
  - Verify: `pnpm build && grep -o '<a href="/ko/writeups/[a-z0-9-]*/"' out/ko/writeups/index.html | wc -l`가 28 이상
    **+ tests/smoke.spec.ts에 회귀 테스트 추가**(Testing Strategy 참조, `a[href*="/writeups/"]`
    count 기반) 후 `pnpm test:e2e` 통과.
  - Files: `src/components/writeups/writeup-data-grid.tsx`(L282-291), `tests/smoke.spec.ts`

- [ ] **#7 Writeup 본문 SSR 전환**
  - Acceptance: 원인 조사 결과를 먼저 커밋 메시지/PR 설명에 1-2문장으로
    남긴 뒤(왜 CSR 전용이었는지), Blog/CVE와 동일하게 서버 렌더링된 본문이
    출력.
  - Verify: `pnpm build && curl (또는 grep) out/ko/writeups/{slug}/index.html`에서
    Suspense placeholder가 아니라 실제 본문 텍스트(코드블록 등) 존재
    **+ tests/smoke.spec.ts에 회귀 테스트 추가**(Testing Strategy 참조 -
    `request.get()`으로 raw HTML 확인, 브라우저 fixture로는 이 회귀를 못 잡음).
  - Files: `src/app/[locale]/writeups/[slug]/page.tsx`(구현 전 직접 열람 필요
    - 이 스펙 작성 시점엔 정확한 원인 코드를 확인하지 않았음, Task 착수 시
    가장 먼저 할 일은 이 파일을 읽고 왜 dynamic import/Suspense를 쓰는지
    파악하는 것), `tests/smoke.spec.ts`

- [ ] **#8 블로그 태그 배지 실제 링크화** (RC-5, blocked by #2, #9)
  - Acceptance: 상단 태그 배지 + 하단 관련 게시물 링크가 각각
    `/${locale}/tags/${normalizeTag(tag)}/`로 연결.
  - Verify: `pnpm build` 후 blog 개별글 정적 HTML에서 태그 배지 `<a href>`가
    `/tags/`로 시작하는지 grep.
  - Files: 착수 시 `grep -rn "관련 게시물\|related-post\|tags.map" src/app/
    \[locale\]/blog/\[slug\]/page.tsx src/components/blog`로 정확한 파일 확정.

- [ ] **#9 /tags/[tag]/ 페이지 신설** (blocked by #2, #5)
  - Acceptance: D-1 설계대로 Blog+CVE+Writeup 통합 태그 필터 페이지 생성,
    존재하지 않는 태그는 notFound().
  - Verify: `curl -s http://localhost:4173/en/tags/pwn/` (또는 build 후 out/
    확인)이 200이고 Blog/Writeup 항목이 섞여 나옴.
  - Files: `src/app/[locale]/tags/[tag]/page.tsx`(신규), `src/lib/taxonomy.ts`

- [ ] **#10 /tags/ 인덱스 페이지** (blocked by #9)
  - Acceptance: D-1 설계대로 빈도 3회 이상 태그만 알파벳순 노출, 그 미만은
    노출 안 하되 페이지 하단에 "검색으로 찾아보세요" 안내.
  - Verify: 렌더된 태그 수가 `buildTagIndex(getAllTaggedItems(locale))`에서
    `items.length>=3`인 항목 수와 일치(구현 세부는 plan Task 10 참조 - 함수명이
    본 스펙 초안 작성 시점의 `getAllTags()`에서 plan 작성 중 두 함수로 분리됨).
  - Files: `src/app/[locale]/tags/page.tsx`(신규)

- [ ] **#15 공용 URL 상태 훅 선행 분리** (spec-audit 2026-09-17 신설 - #11과 #16이
  같은 신규 파일을 각자 명시해 순서 보장 없이 동시 생성될 위험을 제거하기 위해
  훅 생성 자체를 독립 태스크로 뺌. TaskList: #11, #16 모두 blockedBy #15)
  - Acceptance: `src/hooks/use-url-state.ts`가 pagination(#11)/검색(#16)/태그
    필터 3곳이 공통으로 쓸 수 있는 형태로 존재(`useUrlState(key: string):
    [string, (v: string) => void]` 정도의 최소 인터페이스).
  - Verify: `pnpm typecheck` 통과 + 다른 컴포넌트에서 import 가능한지 확인.
  - Files: `src/hooks/use-url-state.ts`(신규 - src/hooks/ 디렉토리 자체는
    존재하나 현재 비어 있어 따를 기존 컨벤션 없음, 최소 구현으로)

- [ ] **#11 Pagination URL 기반 전환** (RC-2, blocked by #15)
  - Acceptance: `/ko/blog/?page=2` 직접 접속 시 2페이지 콘텐츠가 표시,
    새로고침해도 유지.
  - Verify: **tests/smoke.spec.ts에 회귀 테스트로 영구 추가**(Testing Strategy
    참조) - `page.goto("/en/blog/?page=2")` 후 1페이지엔 없는 글 제목이
    보이는지 assert, `pnpm test:e2e` 통과.
  - Files: `src/components/blog/blog-search-layout.tsx`(L53-117),
    `src/hooks/use-url-state.ts`(#15에서 생성됨, 여기선 사용만), `tests/smoke.spec.ts`

- [ ] **#12 글로벌 검색 도입** (D-2)
  - Acceptance: 헤더의 검색 버튼 클릭 -> Sheet 열림 -> "pwn" 입력 ->
    Blog/CVE/Writeup 섞인 결과 표시 -> 클릭 시 해당 페이지로 이동.
  - Verify: `pnpm build`로 `out/search-index.json`이 생성되고 항목 수가
    58+28+28=114(또는 실측 최신 수)와 일치. Playwright로 검색 플로우 e2e.
  - Files: `scripts/build-search-index.mjs`(신규), `src/components/
    global-search.tsx`(신규), `src/components/site-header.tsx`(버튼 추가)

- [ ] **#16 검색/필터 URL 상태 반영** (blocked by #12, #15 - #9와 무관함을 spec-audit 2026-09-17에서 확인, 구 #13 삭제 후 재생성)
  - Acceptance: 검색 Sheet가 열린 채 `?q=pwn`으로 URL 공유 가능, 새로고침
    시 검색창에 "pwn"이 채워지고 결과도 동일.
  - Verify: Playwright로 URL 직접 진입 -> 검색창 값 확인.
  - Files: `src/hooks/use-url-state.ts`, `src/components/global-search.tsx`

- [ ] **#14 FVE 라벨 문구 검토**
  - Acceptance: 사용자 승인 후에만 문구 변경(예: "공개 범위: 비공개" ->
    "공개 범위: 마스킹 공개"). 승인 전엔 보류.
  - Verify: N/A(저자 판단)
  - Files: `src/data/cves.ts`(해당 FVE 항목 summary 관련 필드, 정확한 라벨
    렌더 위치는 `src/app/[locale]/cves/[slug]/page.tsx`에서 확인)

## Success Criteria (전체)

- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` 전부 통과
- [ ] 대소문자 중복 태그 0건(정규화 스크립트 재실행으로 확인)
- [ ] Writeup 목록/상세가 `curl`(JS 미실행)만으로 제목+본문 텍스트 확인 가능
- [ ] `/tags/`, `/tags/[tag]/` 라우트가 최소 1개 이상의 실제 태그로 200 응답
- [ ] 헤더에서 검색 -> 3개 섹션 통합 결과 -> 클릭 이동까지 수동 확인 1회
- [ ] `?page=`, `?q=` 쿼리로 새로고침해도 상태 유지 확인

## Open Questions

- **Q-A. "Research"(43)/"research"(14)/"projects"(2) categories는 대소문자
  버그인가 의도된 별도 카테고리인가?** RC-4 정규화 스크립트가 tags는 자동
  처리하지만 이 categories 필드는 스코프에서 제외했다 - 저자 확인 필요.
  Evidence For(버그): 대소문자만 다름. Evidence Against(의도): "projects"는
  아예 다른 단어라 단순 케이스 오류가 아닐 가능성. 확인 전엔 손대지 않는다.
- **Q-B. /tags/ 인덱스의 "빈도 3회 이상" 임계값이 적절한가?** 정규화 후 실제
  분포(몇 개 태그가 3회 이상 쓰였는지)를 #2 완료 후 다시 세어봐야 정확한 숫자를
  안다 - 이 스펙에선 방향(문턱을 둔다)만 확정하고 정확한 숫자는 #10 착수 시
  재계산.
- **Q-C. 글로벌 검색에 Cmd+K 단축키를 넣을지** - nice-to-have, 이번 스펙
  범위에는 포함 안 함(D-2에 명시).
- **Q-D. Writeup difficulty의 "easy-medium"(5건) 재분류 기준** - Easy로 내릴지
  Medium으로 올릴지는 문제별 실제 난이도 재평가가 필요, 일괄 규칙 없음(#4에서
  건별 확인).
- **Q-E. CVE tags 값의 구체적 매핑표** - D의 "Data Model" 절에 방향만 제시,
  28개 항목 각각의 정확한 태그는 #5 착수 시 저자가 채운다(자동 생성 배제
  이유: 취약점 성격 판단 오류 위험).
