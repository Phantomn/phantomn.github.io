#!/usr/bin/env bash
# 이력서 / 경력기술서 PDF 생성 (RenderCV)
#
# scripts/cv/*.yaml 을 RenderCV(YAML→Typst→PDF, classic 테마·Pretendard)로
# 렌더해 public/docs/ 에 배치한다.
#
#   career-statement-ko.yaml  → public/docs/career-statement-ko.pdf  (경력기술서, /portfolio)
#   Hong_Seungpyo_CV_kor.yaml → public/docs/resume-ko.pdf            (한글 이력서, /about)
#   Hong_Seungpyo_CV.yaml     → public/docs/resume-en.pdf            (영문 이력서, /about)
#
# 주의: career-statement-ko 와 한글 이력서는 cv.name 이 같아 RenderCV 출력
#       파일명(홍승표_CV.pdf)이 충돌한다. 각 렌더 직후 즉시 고정명으로 복사한다.
#
# 사전조건:
#   - pip install "rendercv[full]"      (Typst 번들 포함)
#   - scripts/cv/fonts/Pretendard-*.ttf (RenderCV 자동 임베드)
# 사용법: bash scripts/generate-career-pdf.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CV_DIR="$ROOT/scripts/cv"
OUT="$CV_DIR/rendercv_output"
DOCS_DIR="$ROOT/public/docs"

command -v rendercv >/dev/null 2>&1 || {
  echo "✗ rendercv 미설치 — 'pip install \"rendercv[full]\"' 실행" >&2
  exit 1
}
mkdir -p "$DOCS_DIR"

# render <yaml> <rendercv출력pdf명> <목적지파일명>
render() {
  local yaml="$1" generated="$2" target="$3"
  ( cd "$CV_DIR" && rendercv render "$yaml" >/dev/null )
  if [ ! -f "$OUT/$generated" ]; then
    echo "✗ $yaml 렌더 실패 ($generated 없음)" >&2
    exit 1
  fi
  cp "$OUT/$generated" "$DOCS_DIR/$target"
  echo "✓ $target ($(du -h "$DOCS_DIR/$target" | cut -f1))"
}

render "career-statement-ko.yaml"  "홍승표_CV.pdf"        "career-statement-ko.pdf"
render "Hong_Seungpyo_CV_kor.yaml" "홍승표_CV.pdf"        "resume-ko.pdf"
render "Hong_Seungpyo_CV.yaml"     "Seungpyo_Hong_CV.pdf" "resume-en.pdf"

echo "완료 — public/docs/ 갱신"
