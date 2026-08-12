#!/usr/bin/env bash
# 이력서 / 경력기술서 PDF 생성 (RenderCV)
#
# scripts/cv/*.yaml 을 RenderCV(YAML→Typst→PDF, classic 테마·Pretendard)로
# 렌더해 public/docs/ 에 배치한다.
#
#   career-statement-ko.yaml   → public/docs/career-statement-ko.pdf (경력기술서, /portfolio)
#   Hong_Seungpyo_CV_kor.yaml  → public/docs/resume-ko.pdf           (한글 이력서, /about)
#   Hong_Seungpyo_CV.yaml      → public/docs/resume-en.pdf           (영문 이력서, /about)
#   Hong_Seungpyo_CV_xbow.yaml → public/docs/resume-xbow.pdf         (지원처 맞춤 이력서)
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

# rendercv 실행 방법 결정.
# 전역 설치가 깨져 있어도(예: pydantic 버전 충돌) uv 가 있으면 격리 실행으로 우회한다.
if rendercv --version >/dev/null 2>&1; then
  RENDERCV=(rendercv)
elif command -v uv >/dev/null 2>&1; then
  RENDERCV=(uv tool run --from "rendercv[full]" rendercv)
  echo "· 전역 rendercv 사용 불가 → uv 격리 실행"
else
  echo "✗ rendercv 실행 불가 — 'pip install \"rendercv[full]\"' 또는 uv 설치 필요" >&2
  exit 1
fi
mkdir -p "$DOCS_DIR"

# render <yaml> <rendercv출력pdf명> <목적지파일명>
render() {
  local yaml="$1" generated="$2" target="$3"
  ( cd "$CV_DIR" && "${RENDERCV[@]}" render "$yaml" >/dev/null )
  if [ ! -f "$OUT/$generated" ]; then
    echo "✗ $yaml 렌더 실패 ($generated 없음)" >&2
    exit 1
  fi
  cp "$OUT/$generated" "$DOCS_DIR/$target"
  echo "✓ $target ($(du -h "$DOCS_DIR/$target" | cut -f1))"
}

render "career-statement-ko.yaml"   "홍승표_CV.pdf"        "career-statement-ko.pdf"
render "Hong_Seungpyo_CV_kor.yaml"  "홍승표_CV.pdf"        "resume-ko.pdf"
render "Hong_Seungpyo_CV.yaml"      "Seungpyo_Hong_CV.pdf" "resume-en.pdf"
render "Hong_Seungpyo_CV_xbow.yaml" "Seungpyo_Hong_CV.pdf" "resume-xbow.pdf"

# 사이트에서 참조되지 않는 구 잔재 파일. 내용이 낡지 않도록 영문판과 동일하게 유지한다.
for legacy in resume-enus.pdf resume-ptbr.pdf; do
  cp "$DOCS_DIR/resume-en.pdf" "$DOCS_DIR/$legacy"
  echo "✓ $legacy (resume-en.pdf 사본)"
done

echo "완료 — public/docs/ 갱신"
