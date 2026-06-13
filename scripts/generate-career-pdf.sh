#!/usr/bin/env bash
# 경력기술서 PDF 생성
#
# portfolio 페이지(/ko/portfolio/)를 print CSS(RenderCV classic 룩)와 함께
# headless Chrome으로 PDF화하여 public/docs/career-statement-ko.pdf 에 저장한다.
#
# 사전조건: `pnpm build` 로 out/ 이 최신 상태여야 한다.
# 사용법: bash scripts/generate-career-pdf.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/out"
DOCS_DIR="$ROOT/public/docs"
PORT=8123
CHROME="${CHROME_BIN:-google-chrome-stable}"

if [ ! -d "$OUT_DIR/ko/portfolio" ]; then
  echo "✗ out/ko/portfolio 없음 — 먼저 'pnpm build' 실행" >&2
  exit 1
fi

mkdir -p "$DOCS_DIR"

# 정적 서버 기동 (이 스크립트 수명 동안만)
python3 -m http.server "$PORT" --directory "$OUT_DIR" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 2

URL="http://localhost:$PORT/ko/portfolio/index.html"
TARGET="$DOCS_DIR/career-statement-ko.pdf"

"$CHROME" --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer \
  --print-to-pdf="$TARGET" \
  "$URL" 2>/dev/null

if [ -f "$TARGET" ]; then
  echo "✓ 생성: $TARGET ($(du -h "$TARGET" | cut -f1))"
else
  echo "✗ PDF 생성 실패" >&2
  exit 1
fi
