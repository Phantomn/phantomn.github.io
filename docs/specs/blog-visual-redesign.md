# Spec: Blog Visual Redesign (Color System, Typography Measure, Component Polish)

Status: draft, awaiting human review before Phase 4 (Implement)
Owner: Phantomn
Source research: 4-agent Exa survey round 1 (보안 블로그/개발자 에디토리얼/타이포그래피
원리/디자인 갤러리, 편향 발견 후 폐기), 4-agent Exa survey round 2 (일반 디자인 갤러리
기준 무드 A/B/C/D 재조사, 편향 배제), 비주얼 컴패니언 브레인스토밍 세션(코드 감사 +
목업 2회 + 실제 사이트 20곳 직접 열람 후 사용자 선택: Linear/Raycast/Cursor)
Companion tracker: 이 스펙은 TaskList 없이 이 대화의 브레인스토밍 결정을 그대로
구현 참조로 옮긴 문서다(선행 TaskList 없음 - `writing-plans` 단계에서 새로 생성)
Predecessor: `docs/specs/blog-ia-improvement.md`(2026-09-17 완료/병합, PR #29) - 이
스펙은 그 작업 위에 쌓이는 별개 범위(시각 디자인)이며 IA/데이터 품질 범위를 재논의하지
않는다.

---

## ASSUMPTIONS I'M MAKING

1. "Self-Contained"하게 작성하라는 요청은 이 문서 하나만 보고 구현자가 추가 질문 없이
   작업을 시작할 수 있어야 한다는 뜻으로 해석한다 -> 모든 색상 토큰 값, 파일 경로/라인,
   현재 CSS 규칙의 실측 내용을 이 문서에 박아 넣는다(추측 금지).
2. 사용자가 브레인스토밍 세션에서 명시적으로 선택한 것만 확정 결정으로 취급한다:
   (a) 전면 리디자인("C") 선택, (b) 비주얼 컴패니언 목업에서 "옵션 2(앰버)" 클릭,
   (c) 20개 사이트 중 Linear/Raycast/Cursor 선택("다크 배경 + 절제된 단일 악센트 +
   모노스페이스는 기술 요소에만" 방향). 그 외 색상 정밀값(정확한 hex, 톤 단계)은 이
   스펙에서 저자가 판단해 확정하며, 아래 "Open Questions"에 재검토가 필요한 항목을
   명시한다.
3. **자체 정정**: 이 대화 중 3개 리서치 서브에이전트(보안 블로그/개발자 에디토리얼/
   타이포그래피 원리)와 나 자신이 "line-height가 미지정되어 있다"고 반복 보고했으나,
   이는 WebFetch 기반 서브에이전트가 실제 이 저장소의 `src/styles/globals.css`를 열어보지
   않고 일반적인 "미지정 시 브라우저 기본값" 패턴을 이 사이트에도 추정 적용한 오판이었다.
   `git grep`으로 직접 확인한 결과 `.prose p { line-height: 1.75; }`(globals.css:325)가 이미 존재하며, 이는 리서치가 권장한 1.5-1.8 범위 안에 있다. 이 스펙은 실제
   코드를 읽고 검증된 사실만 "현재 상태"로 기술하며, line-height는 **변경 대상에서
   제외**한다. `[[webfetch-needs-live-crossverify]]` 메모리에 기록된 패턴(4번째 사례)이며
   해당 메모리에 추가 예정.
4. 다크모드가 이 사이트의 1차 정체성이다(기존에도 "signature Ph4nt0m palette" 주석이
   `.dark` 블록에 달려 있었다). 이 스펙은 다크모드를 기준으로 먼저 설계하고 라이트모드는
   같은 토큰 구조를 대칭 적용한다(브레인스토밍에서 발견한 "라이트모드 무정체성" 문제의
   해결책).
5. 새 npm 의존성은 추가하지 않는다(순수 CSS 커스텀 프로퍼티 값 교체 + Tailwind 유틸리티
   클래스 변경만으로 전체 범위를 구현 가능함을 이미 코드 감사로 확인함 - 아래 "현재 상태
   실측" 참조).
6. 기존 글 URL, 라우트 구조, 콘텐츠(문구/데이터)는 전혀 바뀌지 않는다. 이 스펙은 순수
   시각 계층(색상/타이포/여백/보더/섀도우)만 다룬다.
7. WCAG AA(본문 텍스트 대비 4.5:1, UI 컴포넌트/큰 텍스트 3:1)를 색상 선택의 최소
   기준으로 삼는다(타이포그래피 리서치가 인용한 기준과 동일).

이 중 틀린 게 있으면 지금 정정해달라 - 없으면 아래 내용대로 진행한다.

---

## Objective

blog.ph4nt0m.xyz의 시각 정체성을 "Linear/Raycast/Cursor류 프리미엄 다크 개발자 도구"
방향으로 리디자인한다. 사용자가 명시한 핵심 불만 2가지를 근본 원인 수준에서 해결한다:

1. **가독성**: 코드 감사로 확인한 유일한 실제 결함 - 블로그/CVE/Writeup 상세 페이지
   본문(`.prose`)에 `max-w-none`이 걸려 있어 줄 길이가 읽기 최적 범위(60-90자)를
   초과한다.
2. **UI/UX 정체성**: 다크모드는 GitHub-dark + 네온그린으로 뚜렷한 정체성이 있었으나
   라이트모드는 순수 흑백조(`#121212`/`#f6f6f6` 단일톤)로 정체성이 없어 테마 전환 시
   완전히 다른 사이트처럼 보였다.

성공 기준: (1) 상세 페이지 본문이 독립적으로 읽기 편한 줄 길이로 제한된다, (2) 라이트/
다크 두 테마가 같은 악센트 색조(앰버)를 공유해 테마 전환 시 정체성이 유지된다, (3)
모든 색상 변경이 CSS 커스텀 프로퍼티(`:root`/`.dark` 토큰) 수준에서 이뤄져 컴포넌트
코드는 거의 손대지 않는다(아래 "현재 상태 실측"에서 확인했듯 모든 UI 컴포넌트가 하드코딩
색상이 아닌 토큰을 소비하기 때문).

---

## Tech Stack (변경 없음)

Next.js 15 App Router, `output: "export"` 정적 export, Tailwind CSS v4(`@theme inline`
+ CSS 커스텀 프로퍼티 방식, `tailwind.config.*` 없음 - `src/styles/globals.css`의
`@theme inline` 블록이 곧 설정), shadcn/ui(Radix 프리미티브 + `class-variance-authority`),
`@tailwindcss/typography`(`.prose` 클래스).

## Commands

```
Dev:       pnpm dev
Build:     pnpm build          (postbuild가 lock-posts.mjs + build-search-index.mjs 체인)
Typecheck: pnpm typecheck
Lint:      pnpm lint
E2E:       pnpm test:e2e       (Playwright, tests/smoke.spec.ts)
```

## Project Structure (이 작업이 건드리는 범위만)

```
src/styles/globals.css           -> 색상 토큰(:root, .dark), CVE 토큰, prose 규칙
src/app/[locale]/blog/[slug]/page.tsx     -> prose max-w-none (L242)
src/app/[locale]/writeups/[slug]/page.tsx -> prose max-w-none (L181)
src/app/[locale]/cves/[slug]/page.tsx     -> prose max-w-none (L226)
src/app/[locale]/page.tsx        -> 홈 히어로 아바타 글로우 하드코딩 (L53)
```

그 외 컴포넌트(`src/components/ui/badge.tsx`, `button.tsx`, `card.tsx`,
`src/components/cves/cve-archive.tsx`, `src/components/blog/post-card.tsx`,
`featured-post-card.tsx` 등)는 **전부 CSS 커스텀 프로퍼티(`bg-primary`,
`var(--cve-border)` 등)만 소비하며 하드코딩 색상이 없음을 코드 감사로 확인**했다
(아래 "현재 상태 실측 - 컴포넌트 감사" 참조) -> 토큰 값만 바꾸면 이 컴포넌트들은
수정 없이 자동으로 새 색상을 반영한다.

---

## 현재 상태 실측 (Self-Contained 근거)

### A. 색상 토큰 전체 (라이트, `:root`, globals.css L45-95, 여는 `:root {`~닫는 `}` 포함)

```css
--radius: 0.625rem;
--background: #ffffff;
--foreground: #121212;
--card: #f6f6f6;
--card-foreground: #040404;
--popover: #ffffff;
--popover-foreground: #121212;
--primary: #121212;
--primary-foreground: #ffffff;
--secondary: #f6f6f6;
--secondary-foreground: #121212;
--muted: #f6f6f6;
--muted-foreground: #717171;
--accent: #f6f6f6;
--accent-foreground: #121212;
--destructive: #dc2626;
--border: #eaeaea;
--input: #eaeaea;
--ring: #121212;
--prose-h-accent: #0f766e;   /* teal, 본문 h3 전용 */
--prose-link-hover: #0f766e; /* 하드코딩, var(--primary) 미참조 */
--cve-surface: #f7f7f7;
--cve-surface-strong: #ffffff;
--cve-surface-soft: #fbfbfb;
--cve-border: #e6e6e6;
--cve-border-strong: #cfcfcf;
--cve-accent: #121212;
--cve-accent-soft: rgba(18, 18, 18, 0.08);
--cve-danger: #dc2626;
--cve-warning: #d97706;
--cve-info: #0f766e;
--cve-muted: #717171;
--cve-focus: #121212;
```

**정정 노트**: `secondary`/`muted`/`accent`가 전부 `#f6f6f6`로 동일한 것은 이 사이트만의
결함이 아니라 shadcn 기본 zinc/neutral 테마의 표준 관행이다(여러 shadcn 공식 테마가
이 세 토큰에 같은 회색 값을 쓴다). 이 스펙은 이 세 토큰을 "차별화"하지 않는다 - 브레인
스토밍 중 "정체성 없음"이라 판단했던 진짜 원인은 이 회색 재사용이 아니라 **악센트 색조
자체가 없었던 것**이다(아래 B 참조).

### B. 색상 토큰 전체 (다크, `.dark`, globals.css L98-147, 여는 `.dark {`~닫는 `}` 포함)

```css
--background: #0d1117;   /* GitHub dark */
--foreground: #c9d1d9;
--card: #161b22;
--card-foreground: #ffffff;
--popover: #161b22;
--popover-foreground: #c9d1d9;
--primary: #9fef00;      /* 네온그린 - 폐기 대상 */
--primary-foreground: #0d1117;
--secondary: #161b22;    /* card와 동일 */
--secondary-foreground: #c9d1d9;
--muted: #21262d;
--muted-foreground: #8b949e;
--accent: #21262d;
--accent-foreground: #ffffff;
--destructive: #b91c1c;
--border: #21262d;
--input: #21262d;
--ring: #9fef00;
--prose-h-accent: #58a6ff;   /* github blue */
--prose-link-hover: #9fef00; /* var(--primary) 참조 안 함, 하드코딩 */
--cve-surface: #11161d;
--cve-surface-strong: #0d1117;
--cve-surface-soft: #1a2028;
--cve-border: #21262d;
--cve-border-strong: #9fef00;
--cve-accent: #9fef00;
--cve-accent-soft: rgba(159, 239, 0, 0.08);
--cve-danger: #ff5f57;
--cve-warning: #f59e0b;
--cve-info: #58a6ff;
--cve-muted: #8b949e;
--cve-focus: #9fef00;
```

### C. line-height (정정됨 - 이미 정상, 변경 불필요)

`globals.css` L324-328에 `.prose p { line-height: 1.75; margin-top: 1.25rem;
margin-bottom: 1.25rem; }`가 이미 존재한다. 타이포그래피 리서치가 권장한 1.5-1.8 범위 안.
**변경하지 않는다.**

### D. 본문 폰트 크기 (정정됨 - 이미 정상, 변경 불필요)

`.prose` 클래스에 크기 수정자(`prose-sm`/`prose-lg` 등)가 없으므로 `@tailwindcss/
typography`의 기본 크기(`1rem` = 16px)가 적용된다. 타이포그래피 리서치가 권장한
15-25px(모바일 최소 16px) 범위 안. **변경하지 않는다.** (UI 크롬 텍스트 - 카드 메타,
배지 등 - 는 의도적으로 `text-xs`/`text-sm`을 쓰며 이는 본문이 아니라 부가 정보이므로
별개 - 변경 범위 아님.)

### E. 줄 길이(measure) - 실제 결함 (유일한 레이아웃 버그)

```
grep -n "prose prose-neutral max-w-none" 결과:
  src/app/[locale]/blog/[slug]/page.tsx:242
  src/app/[locale]/writeups/[slug]/page.tsx:181
  src/app/[locale]/cves/[slug]/page.tsx:226
```

세 파일 모두 `className="prose prose-neutral max-w-none dark:prose-invert"`.
`blog/[slug]/page.tsx`는 바깥 컨테이너가 `mx-auto w-[90vw] max-w-[1200px]`(L137)이고
본문 `<article>`이 `w-full min-w-0 lg:w-[70%]`(L238, 사이드바 30%와 분할)이므로 실제
본문 폭은 데스크톱에서 최대 약 **840px**(1200px * 0.7, 패딩/갭 제외 전)까지 늘어난다 -
16px 폰트 기준 대략 100자 이상/줄로, 리서치가 권장한 60-90자 범위를 초과한다.
`writeups/[slug]/page.tsx`, `cves/[slug]/page.tsx`도 동일한 `max-w-none` 패턴을 쓰므로
같은 결함을 가진다(각 파일의 바깥 컨테이너 폭은 파일별로 다를 수 있으니 구현 시
개별 확인).

**근본 원인**: `max-w-none`이 Tailwind Typography 플러그인의 기본 `max-width: 65ch`
(플러그인 자체 기본값)를 명시적으로 해제한 것. 왜 해제했는지의 의도는 불명(주석 없음) -
아마 "본문을 넓게 쓰고 싶었다"는 의도로 추정되나 결과적으로 가독성을 해쳤다.

### F. 홈페이지 하드코딩 색상 (정체성 분열의 물리적 증거)

`src/app/[locale]/page.tsx:53`:
```tsx
className="mb-6 h-56 w-56 sm:h-72 sm:w-72 aspect-square rounded-full object-contain bg-black border-4 border-primary shadow-[0_0_40px_rgba(159,239,0,0.3)]"
```
`rgba(159,239,0,0.3)`는 다크모드 전용 네온그린(`--primary` 다크 값)을 Tailwind 임의값
문법으로 **직접 하드코딩**한 것 - `dark:` 접두사가 없어 라이트모드에서도 동일하게
적용된다. 라이트모드 아바타에 다크모드용 녹색 후광이 뜨는 원인.

### G. 컴포넌트 감사 - 하드코딩 색상 전무 확인

```
grep -rn "#9fef00\|rgba(159" src --include="*.tsx" --include="*.ts" --include="*.css"
```
위 검색으로 발견된 7개소는 전부 `globals.css`의 토큰 정의 자체이거나(6개소) 위 F의
홈페이지 1개소뿐이다. `Badge`(`src/components/ui/badge.tsx`), `Button`(`button.tsx`),
`Card`(`card.tsx`), `cve-archive.tsx`, `post-card.tsx`, `featured-post-card.tsx`는
전부 `bg-primary`, `var(--cve-border)`, `var(--cve-surface)` 같은 토큰 참조만 쓰며
하드코딩 hex가 전혀 없다. **결론: 색상 리디자인의 99%는 `globals.css`의 토큰 값 교체
+ 위 F의 1줄 수정만으로 전체 사이트에 전파된다.**

### H. CVE 심각도 배지 (별도 색상 체계 - 유지)

`src/components/cves/cve-archive.tsx:26-32`:
```tsx
const SEVERITY_CLASSNAMES: Record<string, string> = {
  critical: "border-destructive/20 bg-destructive/15 text-destructive",
  high: "border-red-500/20 bg-red-500/15 text-red-600 dark:text-red-400",
  medium: "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "border-sky-500/20 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  pending: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
};
```
이 배지들은 토큰이 아니라 Tailwind 기본 색상 팔레트(`red-500`, `amber-500`, `sky-500`)를
직접 쓴다 - CVSS 심각도라는 **의미론적(semantic) 분류**이므로 브랜드 악센트와 별개로
유지하는 게 맞다(신호등 색상 관행). **이 스펙은 이 파일을 건드리지 않는다.** 다만
`medium` 심각도가 이미 `amber-500`을 쓰고 있어 새 브랜드 악센트(앰버)와 같은 색조가
된다 - 아래 "Open Questions"의 Q-A 참조.

### I. shadcn sidebar 토큰 (미사용 보일러플레이트 - 건드리지 않음)

`--sidebar*` 8개 토큰(라이트 L65-72, 다크 L117-124)은 `grep -rln "components/ui/sidebar"` 결과
어디서도 소비되지 않는 죽은 설정값이다(shadcn CLI가 기본 생성한 것을 그대로 둔 것으로
추정). **이 스펙의 범위 밖 - 값을 바꾸지도, 삭제하지도 않는다**(범위 최소화 원칙).

---

## Design Decisions

### 색상 시스템 - 다크모드 (1차 정체성)

`.dark` 블록(globals.css L98-147, 여는 `.dark {`~닫는 `}` 포함)을 아래 값으로 교체:

```css
.dark {
  --background: #0d0d0f;
  --foreground: #e8e6e3;
  --card: #151517;
  --card-foreground: #f5f4f2;
  --popover: #151517;
  --popover-foreground: #e8e6e3;
  --primary: #f59e0b;          /* amber-500, Tailwind 표준 스케일 */
  --primary-foreground: #0d0d0f;
  --secondary: #1c1c1f;
  --secondary-foreground: #e8e6e3;
  --muted: #1c1c1f;
  --muted-foreground: #9a9a9e;
  --accent: #1c1c1f;
  --accent-foreground: #f5f4f2;
  --destructive: #ef4444;      /* red-500, 기존 #b91c1c보다 다크 배경에서 대비 확보 */
  --border: #232326;
  --input: #232326;
  --ring: #f59e0b;
  --sidebar: hsl(240 5.9% 10%);              /* 변경 없음 - I 항목, 미사용 보일러플레이트 */
  --sidebar-foreground: hsl(240 4.8% 95.9%); /* 변경 없음 */
  --sidebar-primary: hsl(224.3 76.3% 48%);   /* 변경 없음 */
  --sidebar-primary-foreground: hsl(0 0% 100%); /* 변경 없음 */
  --sidebar-accent: hsl(240 3.7% 15.9%);     /* 변경 없음 */
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%); /* 변경 없음 */
  --sidebar-border: hsl(240 3.7% 15.9%);     /* 변경 없음 */
  --sidebar-ring: hsl(217.2 91.2% 59.8%);    /* 변경 없음 */
  --prose-h-accent: #58a6ff;   /* 변경 없음 - 이미 적절한 보조색(블루) */
  --prose-link-hover: var(--primary); /* 하드코딩 제거, primary 참조로 전환 */
  --cve-surface: #151517;
  --cve-surface-strong: #0d0d0f;
  --cve-surface-soft: #1c1c1f;
  --cve-border: #232326;
  --cve-border-strong: #f59e0b;
  --cve-accent: #f59e0b;
  --cve-accent-soft: rgba(245, 158, 11, 0.08);
  --cve-danger: #ff5f57;       /* 변경 없음 */
  --cve-warning: #f59e0b;      /* 변경 없음(이미 앰버) */
  --cve-info: #58a6ff;         /* 변경 없음 */
  --cve-muted: #8b949e;        /* 변경 없음 */
  --cve-focus: #f59e0b;
  --cve-shadow: 0 16px 36px rgba(0, 0, 0, 0.28); /* 변경 없음 */
  --cve-radius: 18px;          /* 변경 없음 */
  --cve-radius-inner: 14px;    /* 변경 없음 */
  --avatar-glow: rgba(245, 158, 11, 0.35); /* 신규 토큰, F 항목 수정용 */
}
```

WCAG 검증: `#f59e0b`(amber-500) on `#0d0d0f`(background) 대비비 약 9.04:1(AA 통과,
AAA 통과) - 링크/텍스트로 안전하게 사용 가능.

### 색상 시스템 - 라이트모드 (다크와 동일 악센트 색조로 정체성 통일)

`:root` 블록(globals.css L45-95, 여는 `:root {`~닫는 `}` 포함)을 아래 값으로 교체:

```css
:root {
  --radius: 0.625rem;         /* 변경 없음 */
  --background: #fafaf9;
  --foreground: #18181b;
  --card: #ffffff;
  --card-foreground: #18181b;
  --popover: #ffffff;
  --popover-foreground: #18181b;
  --primary: #b45309;         /* amber-700 - amber-500은 흰 배경 대비 2.15:1로 AA 미달 */
  --primary-foreground: #fffbeb;
  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #18181b;
  --destructive: #dc2626;     /* 변경 없음 */
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #b45309;
  --sidebar: hsl(0 0% 98%);                     /* 변경 없음 - I 항목, 미사용 보일러플레이트 */
  --sidebar-foreground: hsl(240 5.3% 26.1%);    /* 변경 없음 */
  --sidebar-primary: hsl(240 5.9% 10%);         /* 변경 없음 */
  --sidebar-primary-foreground: hsl(0 0% 98%);  /* 변경 없음 */
  --sidebar-accent: hsl(240 4.8% 95.9%);        /* 변경 없음 */
  --sidebar-accent-foreground: hsl(240 5.9% 10%); /* 변경 없음 */
  --sidebar-border: hsl(220 13% 91%);           /* 변경 없음 */
  --sidebar-ring: hsl(217.2 91.2% 59.8%);       /* 변경 없음 */
  --prose-h-accent: #0369a1;  /* sky-700 - 다크의 github-blue(#58a6ff)와 같은 계열로 통일 */
  --prose-link-hover: var(--primary); /* 하드코딩 제거 */
  --cve-surface: #f4f4f5;
  --cve-surface-strong: #ffffff;
  --cve-surface-soft: #fafafa;
  --cve-border: #e4e4e7;
  --cve-border-strong: #d4d4d8;
  --cve-accent: var(--primary);
  --cve-accent-soft: rgba(180, 83, 9, 0.08);
  --cve-danger: #dc2626;       /* 변경 없음 */
  --cve-warning: #d97706;      /* 변경 없음 */
  --cve-info: #0369a1;         /* sky-700, dark의 --cve-info(#58a6ff)와 같은 계열 */
  --cve-muted: #71717a;
  --cve-focus: var(--primary);
  --cve-shadow: 0 10px 30px rgba(0, 0, 0, 0.06); /* 변경 없음 */
  --cve-radius: 18px;          /* 변경 없음 */
  --cve-radius-inner: 14px;    /* 변경 없음 */
  --avatar-glow: rgba(180, 83, 9, 0.12); /* 다크보다 훨씬 옅게 - 흰 배경에서 과하지 않도록 */
}
```

WCAG 검증: `#b45309`(amber-700) on `#fafaf9`(background) 대비비 약 4.81:1(AA 통과,
일반 텍스트 4.5:1 기준 충족). `#fffbeb` on `#b45309`(버튼/배지 전경-배경) 대비비 약
4.84:1(AA 통과).
실측은 WCAG 상대휘도 공식(sRGB 감마 보정 후 0.2126R+0.7152G+0.0722B)으로 직접
계산한 값이며 근사치가 아니다.

**설계 근거**: 라이트/다크가 서로 다른 명도의 같은 색조(앰버)를 쓰는 것은 비일관성이
아니라 **의도된 패턴**이다 - 디자인 원칙 자료(Every Layout, Butterick)와 타이포그래피
리서치가 공통으로 지적하듯, 밝은 배경과 어두운 배경은 같은 hex 값이 전혀 다른 대비를
만들어내므로 명도를 테마별로 조정하는 게 표준 관행이다. `prose-h-accent`/`cve-info`도
동일 원칙으로 블루 계열(다크 `#58a6ff` / 라이트 `#0369a1`)을 양쪽에 통일해서 예전의
"라이트=teal, 다크=blue"처럼 테마마다 다른 hue를 쓰던 분열을 없앤다.

### 타이포그래피 - 줄 길이만 수정 (line-height/font-size는 C, D에서 확인했듯 이미 정상)

세 파일의 `.prose` 클래스에서 `max-w-none`을 제거하고 명시적 측정값으로 교체:

```diff
- className="prose prose-neutral max-w-none dark:prose-invert"
+ className="prose prose-neutral max-w-[75ch] dark:prose-invert"
```

`75ch`를 쓰는 이유: 타이포그래피 리서치가 인용한 WCAG 1.4.8 성공기준이 **문자 단위**로
"80자 이하"를 명시하므로, px 고정값보다 폰트 크기에 자동 대응하는 `ch` 단위가 더
견고하다(사용자가 브라우저 폰트 크기를 키워도 측정 원칙이 유지됨). `75ch`는 WCAG
상한(80) 안쪽이면서 연구가 권장한 60-90자 범위 중간대.

**주의**: Tailwind Typography 플러그인의 `.prose` 기본값 자체가 `65ch`이므로, 이 수정은
사실상 "커스텀 해제를 없던 일로 되돌리는" 원상복구에 가깝다 - `max-w-none`을 완전히
삭제하기만 해도 플러그인 기본값(65ch)이 적용되어 목표를 달성한다. `max-w-[75ch]`로
명시하는 이유는 "기본값에 우연히 의존"이 아니라 "60-90자 권장 범위 안에서 의도적으로
고른 값"임을 코드에 남기기 위함(다음 사람이 왜 65도 90도 아닌 값인지 알 수 있도록).

### 컴포넌트 트리트먼트 규칙

- **배지(Badge)**: 기존 `variant="default"`(`bg-primary`)가 새 앰버를 자동 상속 -
  코드 변경 없음. CVSS 심각도 배지(H 항목)는 별도 체계 유지, 변경 없음.
- **카드(Card)**: 기존 `shadow-sm` + `border` 유지(글래스모피즘/네온 글로우 추가 안 함 -
  Linear/Cursor는 소프트섀도우 수준이지 화려한 글로우가 아님). 코드 변경 없음.
- **CVE 상세/목록**: `--cve-*` 토큰 교체만으로 전체 반영(위 감사 G, H 참조). 코드
  변경 없음.
- **아바타 글로우**(`src/app/[locale]/page.tsx:53`):
  ```diff
  - shadow-[0_0_40px_rgba(159,239,0,0.3)]
  + shadow-[0_0_40px_var(--avatar-glow)]
  ```
  `--avatar-glow` 토큰은 위 색상 시스템에서 테마별로 이미 정의함(다크는 선명하게,
  라이트는 옅게) - 하드코딩 제거 + 테마 대응 동시 해결.
- **prose h3 `::before` 글리프, h4 `::before` 글리프**: `var(--prose-h-accent)`,
  `var(--primary)`를 이미 참조하므로 토큰 교체만으로 자동 반영, 코드 변경 없음.

---

## File-Level Change Plan

- [ ] **파일 1: `src/styles/globals.css`**
  - `:root` 블록(L45-95) 전체를 위 "라이트모드" 색상 값으로 교체
  - `.dark` 블록(L98-147) 전체를 위 "다크모드" 색상 값으로 교체
  - 각 블록에 `--avatar-glow` 토큰 신규 추가(다크/라이트 값 위 참조)
  - `--prose-link-hover`를 양쪽 모두 `var(--primary)`로 변경(하드코딩 제거)

- [ ] **파일 2: `src/app/[locale]/blog/[slug]/page.tsx`**
  - L242: `max-w-none` -> `max-w-[75ch]`

- [ ] **파일 3: `src/app/[locale]/writeups/[slug]/page.tsx`**
  - L181: `max-w-none` -> `max-w-[75ch]`

- [ ] **파일 4: `src/app/[locale]/cves/[slug]/page.tsx`**
  - L226: `max-w-none` -> `max-w-[75ch]`

- [ ] **파일 5: `src/app/[locale]/page.tsx`**
  - L53: `shadow-[0_0_40px_rgba(159,239,0,0.3)]` -> `shadow-[0_0_40px_var(--avatar-glow)]`

5개 파일, 총 약 60줄 변경(대부분 globals.css의 토큰 값). 컴포넌트 코드(`.tsx`)는 위
4개 파일의 각 1줄 교체 외에는 전혀 건드리지 않는다.

---

## Testing Strategy

이 저장소에 시각 회귀(visual regression) 테스트 도구는 없다(스크린샷 diff 없음) -
새 의존성을 추가하지 않는다는 제약(가정 5) 때문에 이번 스펙에서도 도입하지 않는다.
대신:

1. **자동 검증**: `pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` 전부
   통과 - CSS 값 변경만으로는 기존 `tests/smoke.spec.ts`의 어떤 테스트도 깨지지 않아야
   한다(색상은 테스트 대상이 아니었음 - 만약 특정 텍스트 대비색을 `toHaveCSS`로 검증하는
   테스트가 있다면 구현 중 발견 시 그 테스트를 새 값에 맞게 갱신).
2. **수동 대비 검증**: 구현 후 `pnpm build && pnpm exec serve out -l 4173`(이 저장소의
   `playwright.config.ts`가 e2e에 쓰는 것과 동일한 명령 - `serve`는 이미 devDependency)로
   정적 사이트를
   띄우고, 브라우저 DevTools의 Lighthouse 접근성 감사(또는 axe DevTools 확장)를
   라이트/다크 각각 홈/블로그 목록/블로그 상세/CVE 목록/CVE 상세에서 1회씩 실행 -
   "Contrast" 관련 위반 0건 확인.
3. **수동 시각 확인**: 라이트/다크 토글 후 (a) 아바타 글로우가 테마에 맞게 보이는지,
   (b) 블로그/Writeup/CVE 상세 본문이 확실히 좁아졌는지(브라우저 창 최대화 후 줄 끝이
   화면 끝까지 안 가는지 육안 확인), (c) CVE 심각도 배지 4종(critical/high/medium/low)
   색상이 브랜드 악센트(앰버)와 시각적으로 구분되는지(Open Questions Q-A 참조) 확인.

## Boundaries

- **Always**: 색상 변경은 토큰(`globals.css`의 `:root`/`.dark`) 수준에서만 한다 -
  컴포넌트 파일에 인라인 hex를 새로 추가하지 않는다. 커밋 전 `pnpm build` 클린 빌드로
  확인한다(이전 IA 개선 작업에서 스테일 빌드 캐시가 버그를 숨긴 전례 있음).
- **Ask first**: `--radius`(카드 모서리 둥글기), 폰트 패밀리(Heebo/Signika/JetBrains
  Mono) 교체, CVSS 심각도 배지 색상 체계(H 항목) 변경 - 전부 이 스펙 범위 밖이며 별도
  승인 필요.
- **Never**: `content/**/*.md` 프런트매터나 본문 수정, 라우트/URL 변경, `src/data/
  cves.ts`의 데이터 값 변경, shadcn sidebar 토큰(I 항목) 삭제/변경, 새 npm 의존성 추가.

## Success Criteria

- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` 전부 통과
- [ ] 다크모드 `--primary`가 `#f59e0b`, 라이트모드 `--primary`가 `#b45309`로 확인됨
- [ ] 블로그/Writeup/CVE 세 상세 페이지 전부 `max-w-none`이 코드에서 사라짐
- [ ] 홈 아바타 글로우가 `var(--avatar-glow)`를 참조(하드코딩 rgba 제거)
- [ ] 라이트/다크 각 페이지에서 Lighthouse 접근성 감사 Contrast 위반 0건
- [ ] `--prose-link-hover`, `--cve-accent`(라이트), `--cve-focus`(라이트)가 전부
      `var(--primary)`를 참조(하드코딩 제거 확인)

## Open Questions

- **Q-A. CVE 심각도 "medium" 배지가 이미 `amber-500`을 쓰는데, 브랜드 악센트도 앰버가
  되면 시각적으로 구분이 안 될 수 있다.** 두 맥락(브랜드 vs 심각도 라벨)이 다르고 배지에
  "MEDIUM" 텍스트 라벨이 항상 동반되므로 완전히 혼동되진 않겠지만, 실제 화면에서
  나란히 놓고 봤을 때 문제가 될 수 있다 - 구현 후 수동 확인(Testing Strategy #3)에서
  문제로 판단되면 `medium` 심각도 색을 `orange-500`(#f97316) 등으로 옮기는 걸 재검토.
  이 스펙에서는 미리 바꾸지 않는다(가정 확인 전 변경 금지 원칙).
- **Q-B. `--radius: 0.625rem`(10px)가 Linear/Raycast의 더 각진 느낌과 맞는가?**
  브레인스토밍에서 명시적으로 논의되지 않았다 - 이 스펙은 현상 유지로 두되, 사용자가
  "더 각지게" 원하면 별도 후속 스펙으로 처리(Boundaries의 "Ask first" 항목).
- **Q-C. 목업은 CVE 카드 1종과 블로그 히어로 1종만 만들어봤다.** 홈페이지 히어로 전체,
  CVE 상세 페이지 좌측 사이드바 카드 배치, Writeup 목록 그리드는 색상 토큰 교체
  결과를 실제 빌드로 띄워보기 전까진 눈으로 확인하지 못했다 - 구현 후 Testing
  Strategy #3의 수동 시각 확인에서 부자연스러운 부분이 나오면 이 스펙을 갱신하고
  반영한다(스펙은 living document).
