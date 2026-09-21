# 문서 작성 컨벤션

> 문서는 **ASCII 표기**로 통일한다. 근거: Pandoc/AsciiDoc cross-ref 표준은 식별자에 `letters/numbers/underscore/period/hyphen`만 허용 — 비-ASCII 기호는 `grep`/diff/검색을 깨고 입력이 번거롭다. 비-ASCII는 **다이어그램 프레임 박스만** 예외.

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

## 예외·보존

- **다이어그램 프레임 박스 보존**: `─ ═ │ █ ┌ ┐ └ ┘ ├ ┤ ┴ ┬ ┼` — ASCII art 시각 구조(표기법 아님). 단 박스 *내부* 흐름 화살촉·불릿은 ASCII화(`->`, `-`).

## 검증

```
# 비-ASCII 표기 잔존 탐지 (다이어그램 프레임 제외 후 0이어야)
grep -oP '[^\x00-\x7f]' SPEC.md | grep -vP '[가-힣ㄱ-ㅎㅏ-ㅣ─═│█┌┐└┘├┤┴┬┼]' | sort | uniq -c
# dangling 섹션 참조 (참조 S<N> ⊄ 헤더 정의 → 출력 있으면 깨짐)
comm -23 <(grep -oE 'S[0-9]+(\.[0-9]+){0,3}' SPEC.md|sed 's/^S//'|sort -u) \
         <(grep -oE '^#+ S?[0-9]+(\.[0-9]+){0,3}' SPEC.md|grep -oE '[0-9]+(\.[0-9]+){0,3}'|sort -u)
```

## Git / 배포 워크플로

- `main` 병합 = 배포. `deploy.yml` 은 PR 에서 qa/build/e2e 만, main push 에서 deploy 까지 돈다. 병합 전에 PR 의 CI 통과를 확인하고 로컬은 `pnpm verify` 로 미리 본다. PR 은 스쿼시 병합하고, 병합 후 원격 브랜치를 지운다.
- 커밋 전에 `git diff --cached --name-status` 로 스테이징 목록을 확인한다 (`git rm` 으로 스테이징한 삭제가 무관한 커밋에 딸려 들어간 사고가 2회 있었다).
- 이력서 yaml(`scripts/cv/`) 을 고치면 `pnpm cv:pdf` 로 배포 PDF 를 다시 만든다. 순위와 CVE 건수는 원본(`src/data/competitions.json`, `cves.ts`) 에서만 고치고 `pnpm check:records` 로 대조한다.
