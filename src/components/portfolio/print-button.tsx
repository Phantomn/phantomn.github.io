import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 경력기술서 PDF 다운로드 버튼.
 * PDF는 scripts/generate-career-pdf.sh 로 사전 생성된 정적 파일
 * (/docs/career-statement-ko.pdf) 을 내려받는다.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 print:hidden"
      data-notranslate
      asChild
    >
      <a href="/docs/career-statement-ko.pdf" download>
        <Download className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}
