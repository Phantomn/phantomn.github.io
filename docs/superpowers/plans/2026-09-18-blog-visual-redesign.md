# Blog Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** blog.ph4nt0m.xyz의 색상 시스템을 Linear/Raycast/Cursor풍 프리미엄 다크
개발자 도구 방향(근검정 배경 + 앰버 단일 악센트)으로 통일하고, 상세 페이지 본문의
줄 길이 버그(`max-w-none`)를 고친다.

**Architecture:** 전체 변경의 99%는 `src/styles/globals.css`의 CSS 커스텀 프로퍼티
값 교체다 - 모든 UI 컴포넌트(Badge/Button/Card/CVE 아카이브)가 하드코딩 색상 없이
토큰만 소비하므로, 토큰 값을 바꾸면 컴포넌트 코드는 건드리지 않고 전체 사이트에
전파된다. 나머지는 `.prose` 줄 길이 유틸리티 클래스 1줄씩 x 3파일, 홈페이지 하드코딩
글로우 색상 1줄 x 1파일뿐이다.

**Tech Stack:** Next.js 15 App Router(`output: "export"`), Tailwind CSS v4
(`@theme inline` + CSS 커스텀 프로퍼티, `tailwind.config.*` 없음), shadcn/ui,
`@tailwindcss/typography`. 새 npm 의존성 추가 없음.

**Spec:** `docs/specs/blog-visual-redesign.md` (2026-09-18 spec-audit 통과, 발견된
8건의 라인/수치 오차 전부 정정 완료)

## Global Constraints

- 새 npm 의존성을 추가하지 않는다(스펙 가정 5).
- 기존 글 URL, 라우트 구조, 콘텐츠(문구/데이터)는 전혀 바뀌지 않는다(스펙 가정 6).
- 색상 변경은 CSS 커스텀 프로퍼티(`globals.css`의 `:root`/`.dark` 토큰) 수준에서만
  한다 - 컴포넌트 파일에 새 인라인 hex를 추가하지 않는다(스펙 Boundaries "Always").
- WCAG AA를 최소 기준으로 한다: 본문 텍스트 대비 4.5:1 이상, UI 컴포넌트/큰 텍스트
  3:1 이상(스펙 가정 7).
- `--radius`(카드 모서리), 폰트 패밀리(Heebo/Signika/JetBrains Mono), CVSS 심각도
  배지 색상 체계(`src/components/cves/cve-archive.tsx`의 `SEVERITY_CLASSNAMES`)는
  이 계획의 범위 밖이다 - 절대 건드리지 않는다(스펙 Boundaries "Ask first"/"Never",
  Design Decisions "H. CVE 심각도 배지").
- shadcn sidebar 토큰(`--sidebar*` 8개, `globals.css` 라이트 L65-72/다크 L117-124)은
  미사용 보일러플레이트다 - 삭제도 수정도 하지 않는다(스펙 감사 I).
- 커밋 전 매번 `pnpm build`를 클린 빌드로 돌려 확인한다(스테일 캐시가 버그를 숨긴
  전례가 있음 - `[[blog-ia-improvement-initiative]]` 메모리 참조).

---

### Task 1: 다크모드 색상 토큰을 앰버 시스템으로 교체

**Files:**
- Modify: `src/styles/globals.css:98-147` (`.dark` 블록 전체)

**Interfaces:**
- Consumes: 없음(독립 작업)
- Produces: `--primary: #f59e0b`, `--avatar-glow: rgba(245, 158, 11, 0.35)` -
  Task 4(홈페이지 글로우)가 이 `--avatar-glow` 토큰을 참조한다. Task 3의 `.prose`
  링크/헤딩 색상도 이 블록의 `--primary`/`--prose-h-accent`를 참조한다(코드 변경
  없이 자동 반영).

- [ ] **Step 1: 현재 `.dark` 블록 확인**

```bash
sed -n '98,147p' src/styles/globals.css
```

Expected: 아래 "현재 값"과 정확히 일치해야 한다(다르면 스펙의 라인 인용이 구현
시점 기준으로 어긋난 것이니 실제 파일을 기준으로 삼고 진행).

현재 값(교체 대상):
```css
.dark {
  --background: #0d1117;
  --foreground: #c9d1d9;
  --card: #161b22;
  --card-foreground: #ffffff;
  --popover: #161b22;
  --popover-foreground: #c9d1d9;
  --primary: #9fef00;
  --primary-foreground: #0d1117;
  --secondary: #161b22;
  --secondary-foreground: #c9d1d9;
  --muted: #21262d;
  --muted-foreground: #8b949e;
  --accent: #21262d;
  --accent-foreground: #ffffff;
  --destructive: #b91c1c;
  --border: #21262d;
  --input: #21262d;
  --ring: #9fef00;
  --sidebar: hsl(240 5.9% 10%);
  --sidebar-foreground: hsl(240 4.8% 95.9%);
  --sidebar-primary: hsl(224.3 76.3% 48%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 3.7% 15.9%);
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%);
  --sidebar-border: hsl(240 3.7% 15.9%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);

  /* Prose accent colors — h3 gets github-blue to contrast the neon-green
     primary and create a hacker-terminal vibe in dark mode */
  --prose-h-accent: #58a6ff;  /* github blue */
  --prose-link-hover: #9fef00;

  /* CVE registry tokens */
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
  --cve-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
  --cve-radius: 18px;
  --cve-radius-inner: 14px;
}
```

- [ ] **Step 2: `.dark` 블록을 아래 값으로 전체 교체**

`--sidebar*` 8줄과 `--cve-shadow`/`--cve-radius`/`--cve-radius-inner` 3줄은 Global
Constraints에 따라 **값을 그대로 유지**한 채, 나머지 줄만 아래처럼 바꾼다:

```css
.dark {
  --background: #0d0d0f;
  --foreground: #e8e6e3;
  --card: #151517;
  --card-foreground: #f5f4f2;
  --popover: #151517;
  --popover-foreground: #e8e6e3;
  --primary: #f59e0b;
  --primary-foreground: #0d0d0f;
  --secondary: #1c1c1f;
  --secondary-foreground: #e8e6e3;
  --muted: #1c1c1f;
  --muted-foreground: #9a9a9e;
  --accent: #1c1c1f;
  --accent-foreground: #f5f4f2;
  --destructive: #ef4444;
  --border: #232326;
  --input: #232326;
  --ring: #f59e0b;
  --sidebar: hsl(240 5.9% 10%);
  --sidebar-foreground: hsl(240 4.8% 95.9%);
  --sidebar-primary: hsl(224.3 76.3% 48%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 3.7% 15.9%);
  --sidebar-accent-foreground: hsl(240 4.8% 95.9%);
  --sidebar-border: hsl(240 3.7% 15.9%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);

  /* Prose accent colors - h3 stays github-blue for level contrast against
     the amber primary; link hover now derives from primary directly. */
  --prose-h-accent: #58a6ff;
  --prose-link-hover: var(--primary);

  /* CVE registry tokens */
  --cve-surface: #151517;
  --cve-surface-strong: #0d0d0f;
  --cve-surface-soft: #1c1c1f;
  --cve-border: #232326;
  --cve-border-strong: #f59e0b;
  --cve-accent: #f59e0b;
  --cve-accent-soft: rgba(245, 158, 11, 0.08);
  --cve-danger: #ff5f57;
  --cve-warning: #f59e0b;
  --cve-info: #58a6ff;
  --cve-muted: #8b949e;
  --cve-focus: #f59e0b;
  --cve-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
  --cve-radius: 18px;
  --cve-radius-inner: 14px;

  /* Avatar glow (home hero) - replaces hardcoded rgba(159,239,0,...) */
  --avatar-glow: rgba(245, 158, 11, 0.35);
}
```

- [ ] **Step 3: 교체 확인**

```bash
grep -n "9fef00" src/styles/globals.css
```

Expected: `.dark` 블록 안에서는 0건(라이트 `:root` 블록은 Task 2 이전이라 아직
`#121212` 계열이므로 네온그린과 무관 - 이 grep은 순수 네온그린 잔존 여부만 본다).

- [ ] **Step 4: 타입체크/린트로 문법 오류 없는지 확인**

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS (CSS 문법 오류는 typecheck/lint가 안 잡으므로, 다음 스텝의 빌드가
실질적 검증이다).

- [ ] **Step 5: 클린 빌드로 CSS 파싱 확인**

```bash
rm -rf .next out && pnpm build
```

Expected: 빌드 성공. `out/` 디렉토리 생성됨.

- [ ] **Step 6: 커밋**

```bash
git add src/styles/globals.css
git commit -m "feat(theme): dark mode neon-green -> amber accent system"
```

---

### Task 2: 라이트모드 색상 토큰을 앰버 시스템으로 교체 (다크와 동일 색조로 통일)

**Files:**
- Modify: `src/styles/globals.css:45-95` (`:root` 블록 전체)

**Interfaces:**
- Consumes: 없음(Task 1과 독립 - 다른 CSS 블록)
- Produces: `--primary: #b45309`, `--avatar-glow: rgba(180, 83, 9, 0.12)` - Task 4가
  라이트모드에서 이 값을 쓴다.

- [ ] **Step 1: 현재 `:root` 블록 확인**

```bash
sed -n '45,95p' src/styles/globals.css
```

현재 값(교체 대상):
```css
:root {
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
  --sidebar: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);

  /* Prose accent colors — h3 gets a contrasting hue vs primary so
     heading hierarchy is visually distinct in light mode */
  --prose-h-accent: #0f766e;  /* teal */
  --prose-link-hover: #0f766e;

  /* CVE registry tokens */
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
  --cve-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
  --cve-radius: 18px;
  --cve-radius-inner: 14px;
}
```

- [ ] **Step 2: `:root` 블록을 아래 값으로 전체 교체**

`--radius`, `--sidebar*` 8줄, `--cve-shadow`/`--cve-radius`/`--cve-radius-inner`는
Global Constraints에 따라 **값을 그대로 유지**:

```css
:root {
  --radius: 0.625rem;
  --background: #fafaf9;
  --foreground: #18181b;
  --card: #ffffff;
  --card-foreground: #18181b;
  --popover: #ffffff;
  --popover-foreground: #18181b;
  --primary: #b45309;
  --primary-foreground: #fffbeb;
  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #18181b;
  --destructive: #dc2626;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #b45309;
  --sidebar: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);

  /* Prose accent colors - h3 uses a blue that matches dark mode's
     github-blue tone (sky-700 here for AA contrast on light bg) */
  --prose-h-accent: #0369a1;
  --prose-link-hover: var(--primary);

  /* CVE registry tokens */
  --cve-surface: #f4f4f5;
  --cve-surface-strong: #ffffff;
  --cve-surface-soft: #fafafa;
  --cve-border: #e4e4e7;
  --cve-border-strong: #d4d4d8;
  --cve-accent: var(--primary);
  --cve-accent-soft: rgba(180, 83, 9, 0.08);
  --cve-danger: #dc2626;
  --cve-warning: #d97706;
  --cve-info: #0369a1;
  --cve-muted: #71717a;
  --cve-focus: var(--primary);
  --cve-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
  --cve-radius: 18px;
  --cve-radius-inner: 14px;

  /* Avatar glow (home hero) - much softer than dark mode's version */
  --avatar-glow: rgba(180, 83, 9, 0.12);
}
```

- [ ] **Step 3: 교체 확인**

```bash
grep -n "#121212\|#0f766e" src/styles/globals.css
```

Expected: `:root` 블록 안에서는 0건(`.dark` 블록에는 이 값들이 원래 없었으므로
파일 전체 기준 0건이어야 정상).

- [ ] **Step 4: 클린 빌드**

```bash
rm -rf .next out && pnpm build
```

Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/globals.css
git commit -m "feat(theme): light mode monochrome -> amber accent system"
```

---

### Task 3: 상세 페이지 본문 줄 길이 수정 (3개 파일)

**Files:**
- Modify: `src/app/[locale]/blog/[slug]/page.tsx:242`
- Modify: `src/app/[locale]/writeups/[slug]/page.tsx:181`
- Modify: `src/app/[locale]/cves/[slug]/page.tsx:226`

**Interfaces:**
- Consumes: 없음(Task 1/2와 독립 - 다른 파일)
- Produces: 없음(다른 태스크가 의존하지 않음)

세 파일 전부 동일한 1줄 변경이라 하나의 태스크로 묶는다(스펙 File-Level Change
Plan의 파일 2/3/4).

- [ ] **Step 1: 세 파일의 현재 줄 확인**

```bash
sed -n '242p' "src/app/[locale]/blog/[slug]/page.tsx"
sed -n '181p' "src/app/[locale]/writeups/[slug]/page.tsx"
sed -n '226p' "src/app/[locale]/cves/[slug]/page.tsx"
```

Expected: 세 줄 모두 다음과 정확히 일치:
```
                  className="prose prose-neutral max-w-none dark:prose-invert"
```

- [ ] **Step 2: `blog/[slug]/page.tsx` 수정**

```diff
- className="prose prose-neutral max-w-none dark:prose-invert"
+ className="prose prose-neutral max-w-[75ch] dark:prose-invert"
```

- [ ] **Step 3: `writeups/[slug]/page.tsx` 수정**

```diff
- className="prose prose-neutral max-w-none dark:prose-invert"
+ className="prose prose-neutral max-w-[75ch] dark:prose-invert"
```

(181행. `blog/[slug]/page.tsx`와 글자 그대로 동일한 className 문자열이므로 diff도
동일하다 - 각 파일에서 이 문자열이 나타나는 곳은 1곳뿐이라 오매치 위험 없음.)

- [ ] **Step 4: `cves/[slug]/page.tsx` 수정**

```diff
- className="prose prose-neutral max-w-none dark:prose-invert"
+ className="prose prose-neutral max-w-[75ch] dark:prose-invert"
```

(226행.)

- [ ] **Step 5: 세 파일 전부 반영됐는지 확인**

```bash
grep -rn "max-w-none dark:prose-invert" "src/app/[locale]"
```

Expected: 0건(전부 `max-w-[75ch]`로 바뀌었어야 함).

```bash
grep -rn "max-w-\[75ch\] dark:prose-invert" "src/app/[locale]"
```

Expected: 정확히 3건.

- [ ] **Step 6: 클린 빌드**

```bash
rm -rf .next out && pnpm build
```

Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add "src/app/[locale]/blog/[slug]/page.tsx" "src/app/[locale]/writeups/[slug]/page.tsx" "src/app/[locale]/cves/[slug]/page.tsx"
git commit -m "fix(prose): cap article body measure at 75ch (was unbounded)"
```

---

### Task 4: 홈페이지 아바타 글로우 하드코딩 색상을 토큰 참조로 교체

**Files:**
- Modify: `src/app/[locale]/page.tsx:53`

**Interfaces:**
- Consumes: Task 1의 `--avatar-glow`(다크), Task 2의 `--avatar-glow`(라이트) - 이
  두 토큰이 이미 `globals.css`에 정의되어 있어야 이 태스크의 변경이 시각적으로
  올바르게 작동한다. 순서상 Task 1/2 이후에 실행할 것(값 자체는 이미 정의돼 있으므로
  Task 1/2 없이 적용해도 빌드는 성공하지만, `var(--avatar-glow)`가 미정의 토큰을
  참조해 브라우저가 무효 처리 - 즉 글로우가 아예 안 보이는 조용한 실패가 난다).
- Produces: 없음

- [ ] **Step 1: 현재 줄 확인**

```bash
sed -n '53p' "src/app/[locale]/page.tsx"
```

Expected:
```
            className="mb-6 h-56 w-56 sm:h-72 sm:w-72 aspect-square rounded-full object-contain bg-black border-4 border-primary shadow-[0_0_40px_rgba(159,239,0,0.3)]"
```

- [ ] **Step 2: 하드코딩 rgba를 토큰 참조로 교체**

```diff
- shadow-[0_0_40px_rgba(159,239,0,0.3)]
+ shadow-[0_0_40px_var(--avatar-glow)]
```

- [ ] **Step 3: 반영 확인**

```bash
grep -n "rgba(159,239,0" "src/app/[locale]/page.tsx"
```

Expected: 0건.

```bash
grep -n "var(--avatar-glow)" "src/app/[locale]/page.tsx"
```

Expected: 1건.

- [ ] **Step 4: 클린 빌드**

```bash
rm -rf .next out && pnpm build
```

Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/[locale]/page.tsx"
git commit -m "fix(home): avatar glow uses --avatar-glow token instead of hardcoded neon-green rgba"
```

---

### Task 5: 전체 검증 (자동 + 수동)

**Files:** 없음(검증 전용, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1-4의 전체 결과
- Produces: 없음(이 계획의 마지막 태스크)

- [ ] **Step 1: 전체 자동 검증**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e
```

Expected: 전부 PASS. 하나라도 실패하면 해당 태스크로 돌아가 수정 후 재실행.

- [ ] **Step 2: 정적 사이트 서빙**

```bash
pnpm exec serve out -l 4173
```

터미널을 하나 더 열어(또는 백그라운드 실행) 다음 스텝 진행.

- [ ] **Step 3: 라이트/다크 각 5개 페이지에서 Lighthouse 접근성 감사**

브라우저에서 `http://localhost:4173/ko/` 접속, DevTools > Lighthouse > Accessibility
카테고리만 선택해 실행. 아래 5개 URL 각각을 라이트/다크 토글 두 번(총 10회) 실행:

```
http://localhost:4173/ko/
http://localhost:4173/ko/blog/
http://localhost:4173/ko/blog/mariadb-frm-oob-read-vtable-hijack-rce/
http://localhost:4173/ko/cves/
http://localhost:4173/ko/cves/cve-unassigned-mdev-40571/
```

Expected: 10회 전부 "Contrast" 관련 위반 0건(Lighthouse 리포트의 "Background and
foreground colors do not have a sufficient contrast ratio" 항목 미출현).

- [ ] **Step 4: 수동 시각 확인**

각 URL에서 라이트/다크 토글 후 아래 3가지를 육안 확인:
1. 홈(`/ko/`)의 아바타 후광이 다크에서는 선명한 앰버, 라이트에서는 옅은 앰버로
   보이는지(이전처럼 라이트에서 녹색이 보이면 실패).
2. 블로그 상세/CVE 상세 본문이 브라우저 창을 최대화해도 줄 끝까지 안 가고 중앙에
   좁게 모여 있는지(이전처럼 화면 끝까지 뻗어 있으면 실패).
3. CVE 목록(`/ko/cves/`)에서 심각도 배지 "MEDIUM"(앰버 계열)과 사이트 전역 악센트
   (버튼/링크, 동일 앰버 계열)가 나란히 있을 때 텍스트 라벨 덕에 구분 가능한지 -
   구분이 정말 안 되면 스펙의 Open Questions Q-A에 따라 별도 후속 작업으로 남기고
   이 계획에서는 수정하지 않는다.

- [ ] **Step 5: 서버 종료**

```bash
# Step 2에서 백그라운드 실행했다면 해당 프로세스 종료(포트 4173)
lsof -ti :4173 | xargs -r kill
```

- [ ] **Step 6: 최종 커밋 없음(Task 1-4에서 이미 전부 커밋됨) - 브랜치 마무리 단계로 이동**

이 태스크는 코드 변경이 없으므로 커밋하지 않는다. 전체 검증이 끝나면
`superpowers:finishing-a-development-branch` 스킬로 넘어간다(PR 생성 여부는
사용자에게 확인).
