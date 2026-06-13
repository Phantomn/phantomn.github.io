#!/usr/bin/env bash
# 경력기술서 PDF 생성 (RenderCV)
#
# scripts/cv/career-statement-ko.yaml (portfolio 24개 프로젝트 STAR)을
# RenderCV(YAML→Typst→PDF, classic 테마·Pretendard)로 렌더해
# public/docs/career-statement-ko.pdf 에 배치한다.
#
# 사전조건:
#   - rendercv 설치:  pip install "rendercv[full]"   (Typst 번들 포함)
#   - Pretendard 폰트: scripts/cv/fonts/Pretendard-*.ttf (RenderCV가 자동 임베드)
# 사용법: bash scripts/generate-career-pdf.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CV_DIR="$ROOT/scripts/cv"
DOCS_DIR="$ROOT/public/docs"
YAML="career-statement-ko.yaml"
TARGET="$DOCS_DIR/career-statement-ko.pdf"

command -v rendercv >/dev/null 2>&1 || {
  echo "✗ rendercv 미설치 — 'pip install \"rendercv[full]\"' 실행" >&2
  exit 1
}

mkdir -p "$DOCS_DIR"

# RenderCV 렌더 (yaml 디렉토리에서 실행해야 fonts/ 자동 인식)
( cd "$CV_DIR" && rendercv render "$YAML" >/dev/null )

# RenderCV 출력 PDF (cv.name 기반 파일명) → 고정 경로로 복사
GENERATED="$(find "$CV_DIR/rendercv_output" -maxdepth 1 -name '*.pdf' -print -quit)"
if [ -z "$GENERATED" ]; then
  echo "✗ RenderCV PDF 생성 실패" >&2
  exit 1
fi

cp "$GENERATED" "$TARGET"
echo "✓ 생성: $TARGET ($(du -h "$TARGET" | cut -f1), $(basename "$GENERATED"))"
