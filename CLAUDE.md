# 문서 작성 컨벤션

> 문서는 **ASCII 표기**로 통일한다. 근거: 비-ASCII 기호는 `grep`/diff/검색을 깨고 입력이 번거롭다. 비-ASCII는 **다이어그램 프레임 박스만** 예외.

## 표기 SSOT

| 용도 | 표기 | 금지(비-ASCII) |
|------|------|----------------|
| 섹션 참조 | `S<N>.<M>` (예: `S2.4.1`) | `§` |
| 나열 구분 | `,` 또는 `/` | `·` |
| 흐름/전이 | `->` `<-` `<->` | `→ ← ↔ ⇄ ▶ ◀ ▼ ▲` |
| 논리·부등 | `!= >= <= in x` `forall exists {} subset-of contains` | `≠ ≥ ≤ ∈ × ∀ ∃ ∅ ⊂ ⊃ ⊄ Σ` |
| 직교/독립 | `/` | `⊥` |
| 강조/체크 마커 | `*` `[X]` `[v]` `[x]` `(!)` `(a)` `(1)` | `★ ▣ ※ ❌ ✓ ✗ ⚠ ⓐ ①` |
| 대시 | `-` (또는 ` - `) | `— – −` |

예외: 다이어그램 프레임 박스(`─ ═ │ █ ┌ ┐ └ ┘ ├ ┤ ┴ ┬ ┼`)는 ASCII art 시각 구조라 보존한다.

## 아키텍처 개요

콘텐츠는 `data/source/*.json`(정형 데이터)과 `content/posts/*.md`(블로그 + CVE/FVE + CTF/wargame 라이트업)
두 갈래로 저작한다. **`data/source/`, `content/posts/`, `scripts/`, `docs/` 는 손으로 고치는 소스,
그 밖에 생성기가 쓰는 파일(`data/portfolio.json`, `lib/disclosures.ts`, `public/.well-known/*`,
`public/llms.txt`, `public/pgp-key.asc`)은 산출물이니 절대 직접 고치지 않는다** - 다음 생성 실행에
덮어써진다.

### 생성기: 1개 -> 산출물 5종

```
data/source/*.json  --(node scripts/generate-from-source.mjs)-->
    data/portfolio.json
    lib/disclosures.ts
    public/.well-known/claims.json
    public/.well-known/security.txt (+ public/security.txt)
    public/llms.txt
    public/pgp-key.asc
```

데이터를 고칠 때는 `data/source/*.json`(competitions, cves, labels, pgp, project-text, projects)만
편집하고 `node scripts/generate-from-source.mjs` 를 다시 돌려 산출물을 갱신한다.

### 블로그 파이프라인

`content/posts/*.md` -> `lib/blog.ts`(remark/rehype, `allowDangerousHtml: false`) -> 렌더링.
프런트매터 `tags` 는 `lib/tags.ts` 가 읽어 `/tags`, `/tags/[tag]` 목록을 만든다.

### 검색 인덱스

`pnpm build` 의 `postbuild` 라이프사이클이 `scripts/build-search-index.mjs` 를 실행해
`out/search-index.json` 을 만든다. **`next build` 를 직접 돌리면 이 산출물이 안 생긴다 - 반드시
`pnpm build` 로 실행한다.**

## 검증 스크립트

전부 `scripts/` 아래, `pnpm <name>` 으로 실행한다.

| 스크립트 | 파일 | 확인 대상 |
|----------|------|-----------|
| `check:claims` | check-claims.mjs | 기계가독 주장(`claims.json`) 정합성 |
| `check:pgp` | check-pgp.mjs | PGP 키 유효성 |
| `check:residue` | check-residue.mjs | 이전 콘텐츠 잔재 |
| `check:links` | check-links.mjs | href/img src가 `out/` 실제 파일을 가리키는지(누락 시 exit 1) |
| `check:records` | check-records.mjs | 이력서 yaml의 순위/CVE 건수를 `data/source/*` 와 대조. CVE id는 `^CVE-\d{4}-\d{4,}$`, FVE는 별도 |
| `check:i18n` | check-i18n.mjs | en/ko 메시지 키 정합성(en이 저작 소스) |

`pnpm check` 는 typecheck + lint + format:check + check:claims + check:pgp 를 묶어서 돈다.

## i18n

next-intl 사용, **en 이 유일한 저작 소스**다. ko 등 다른 로케일은 `DynamicTranslator`(런타임 번역,
`i18n/routing.ts` 의 `SOURCE_LOCALE = 'en'`)가 처리한다. 사실 데이터를 `ko.json` 같은 메시지
파일에 손으로 번역해 넣지 않는다 - 번역은 런타임 책임이다.

## 이력서(CV)

`scripts/cv/` 의 yaml을 고치면 `pnpm cv:pdf`(rendercv + poppler/pdfinfo 필요)로 배포용 PDF를
다시 만든다. PDF는 `public/docs` 에 놓인다. 순위/CVE 건수는 `data/source/*.json` 에서만 고치고
`pnpm check:records` 로 대조한다.

## Git / 배포 워크플로

- `main` push = 배포(`.github/workflows/deploy.yml`): `pnpm install` -> `generate-from-source.mjs`
  -> `check:claims`/`check:pgp` -> cosign으로 `claims.json` 서명/검증(Phantomn identity) -> `pnpm build`
  -> `check:links` -> GitHub Pages 업로드. PR에서는 배포 단계 없이 CI만 돈다.
- 커스텀 도메인은 `public/CNAME` = `blog.ph4nt0m.xyz`.
- 패키지 매니저는 **pnpm@11.2.2**(`packageManager` 필드로 고정). `package-lock.json` 없음.
- 커밋 전에 `git diff --cached --name-status` 로 스테이징 목록을 확인한다(무관한 삭제가 딸려
  들어간 사고 이력이 있다).

## 함정

- **`pnpm dev` 를 켜 둔 채 `pnpm build` 를 돌리지 않는다** - `.next` vendor-chunk가 깨져 500 에러가
  난다. build 전에는 dev 서버를 먼저 끈다.
- 생성기 산출물(`data/portfolio.json`, `lib/disclosures.ts`, `public/.well-known/*`, `public/llms.txt`,
  `public/pgp-key.asc`)을 직접 편집하지 않는다 - `data/source/*.json` 을 고치고 생성기를 다시 돌린다.
