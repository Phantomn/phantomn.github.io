# CREDITS

## bshastry/bshastry.github.io

이 사이트의 일부 CSS 와 레이아웃 구조는 Bhargava Shastry 의 개인 사이트에서 가져왔다.

- 출처: https://github.com/bshastry/bshastry.github.io (Next.js + Tailwind)
- 저자: Bhargava Shastry (bshastry@ethereum.org)
- 허락: 2026-09-22 이메일로 사용 요청(newbiepwner@kakao.com), 저자가 이메일로 허락. 조건은 붙지 않았다.
- 주의: 해당 저장소에는 `LICENSE` 파일이 없다(확인 시점 2026-09-23). 공개 저장소의 기본값은
  저작권 전부 보유이므로, 이 사용의 근거는 위 이메일 허락뿐이다. **이메일 원문을 보관한다.**
  허락은 이 사이트에 한한다 - 이 저장소를 포크하는 제3자에게 승계되지 않는다.
  저자가 나중에 저장소에 오픈소스 라이선스를 붙이면 그 라이선스가 근거가 되므로 이 항목을 갱신한다.

### 가져온 것

`src/styles/globals.css`:

- `.hero-grid` - 격자 + 강조색 번짐 배경 모티프 (이미지 파일 없이 시각 정체성을 만든다)
- `.signal-panel::before` - 왼쪽 세로 강조선 (위아래로 사라지는 그라디언트)
- `.chip` - 모노 테두리 칩
- `.focus-ring` - 키보드 포커스 표시를 한 곳에서 정의
- `@media (prefers-contrast: more)` 경계선 보정, `@media (prefers-reduced-motion: reduce)` 전환 해제
- `.eyebrow` - 모노 + 대문자 + 넓은 자간 라벨 (자간은 한글 낱말이 떠 보여 0.2em -> 0.07em 으로 조정)
- 글자색 3단계 구성(`--foreground` / `--muted-foreground` / `--faint-foreground`)

원본은 색을 RGB 채널(`rgb(var(--accent) / 0.13)`)로 다루지만 우리 토큰은 hex 와 `color-mix` 라서
`color-mix(in oklab, ...)` 로 바꿨다. 강조색은 우리 값(`--primary`)을 쓴다.

### 가져오지 않은 것

문구, 색 팔레트(파란색 `#6ea8fe`), 서체 조합(Inter), 본인 연구를 설명하는 다이어그램, 컴포넌트 코드.
레이아웃 짜임새(한 문장 논지 -> 숫자 -> 케이스 스터디)는 우리 데이터와 4개 로케일에 맞춰 다시 구현했다.
배경/수행/성과 3열 배치는 한글에서 한 줄이 16자로 줄어 쓰지 않았다(라벨을 왼쪽 열로 빼는 형태로 바꿨다).
