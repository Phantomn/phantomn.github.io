/**
 * Portfolio / 경력증명 데이터 - 로케일과 무관한 값(기간, 분류, 기여도, 스택)만 둔다.
 * 제목·고객사·역할·서술은 src/data/portfolio-text/<locale>.json (id 기준)에 있고,
 * portfolio-i18n.ts 가 합친다. 문장을 여기 두면 런타임 기계 번역에 맡겨야 해서 고유명사와 숫자가 깨진다.
 * 새 프로젝트를 넣으면 4개 로케일 JSON 에 같은 id 를 모두 추가해야 한다(pnpm check:i18n 이 검사).
 *
 * 한국 경력기술서 표준(기간 / 역할 / 기여도 / 배경 / 수행 / 성과 / 기술스택)을 따른다.
 * - Featured 프로젝트: full STAR (background + actions + results + stack)
 * - 나머지: 간략 (한 줄 성과만 results[0])
 */

export type PortfolioCategoryKey =
  | "fintech"
  | "ics-ot"
  | "iot"
  | "medical"
  | "cyber-range"
  | "consulting"
  | "vuln-research";

export const PORTFOLIO_CATEGORY_KEYS: PortfolioCategoryKey[] = [
  "fintech",
  "ics-ot",
  "iot",
  "medical",
  "cyber-range",
  "consulting",
  "vuln-research",
];

export interface PortfolioProject {
  id: string;
  /** 수행 기간 - 예: "2024.07 — 2025.03" */
  period: string;
  category: PortfolioCategoryKey;
  /** 기여도 (%) */
  contribution: number;
  /** true 면 STAR 상세 카드로 렌더 */
  featured: boolean;
  /** 기술스택 (featured 전용) */
  stack?: string[];
}

/** 로케일별 서술. `{ls2025}` `{ls2026}` 는 competitions.json 에서 만든 문구로 치환된다. */
export interface PortfolioProjectText {
  title: string;
  /** 고객사 / 발주처 */
  client: string;
  role: string;
  /** STAR-S/T: 배경·과제 */
  background?: string;
  /** STAR-A: 주요 수행 내용 */
  actions: string[];
  /** STAR-R: 성과 */
  results: string[];
}

export type LocalizedProject = PortfolioProject & PortfolioProjectText;

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  { id: "achilles-l2", period: "2024.07 — 2025.03", category: "ics-ot", contribution: 100, featured: true, stack: ["Achilles Test Platform", "XGT Protocol", "PLC", "Wireshark", "Python"] },
  { id: "locked-shields", period: "2025.01 — 2025.04", category: "cyber-range", contribution: 45, featured: true, stack: ["DFIR", "Volatility", "Wireshark", "Sysmon", "YARA"] },
  { id: "llama-cpp-cve", period: "2026.07 — 2026.08", category: "vuln-research", contribution: 100, featured: true, stack: ["C/C++", "llama.cpp", "GGUF", "Fuzzing", "CVSS 3.1", "PoC"] },
  { id: "data-platform-idor", period: "2026.08", category: "vuln-research", contribution: 100, featured: false, stack: ["Web", "API Security", "IDOR", "Burp Suite"] },
  { id: "iot-cctv-forensics", period: "2022.08 — 2022.12", category: "iot", contribution: 45, featured: true, stack: ["Python", "C/C++", "UART", "binwalk", "Firmware Dump", "Linux"] },
  { id: "a3-financial-pentest", period: "2020.06 — 2021.06", category: "fintech", contribution: 0, featured: false, stack: ["Burp Suite", "OWASP Top 10", "Web/App Pentest", "Source Code Review"] },
  { id: "kt-gigagenie", period: "2020.10", category: "iot", contribution: 100, featured: false, stack: ["UART", "Bluetooth", "APK", "Android"] },
  { id: "smartbuilding-y1", period: "2021.08 — 2021.12", category: "iot", contribution: 40, featured: false, stack: ["BACNet", "KNXNet", "Modbus", "BLE", "CVE/CWE", "SQLite"] },
  { id: "smartbuilding-y2", period: "2022.01 — 2022.10", category: "iot", contribution: 40, featured: false, stack: ["IoT Scanning", "CVE/CWE", "PoC Validation", "CSV/Excel Report"] },
  { id: "qud-081871", period: "2021.08 — 2021.12", category: "iot", contribution: 40, featured: false },
  { id: "ls-threat-modeling", period: "2023.03 — 2023.11", category: "ics-ot", contribution: 40, featured: false, stack: ["STRIDE", "DREAD", "DFD", "IEC 62443-4-2"] },
  { id: "ls-62443-tool", period: "2025.03 — 2025.11", category: "ics-ot", contribution: 90, featured: true, stack: ["Python", "FastAPI", "TypeScript", "React", "TailwindCSS", "SQLite3", "IEC 62443-4-2"] },
  { id: "smartship", period: "2024.07 — 2024.11", category: "ics-ot", contribution: 25, featured: false, stack: ["Python", "SSDP", "CVE/CWE", "CPE", "SQLite", "Shell/Powershell"] },
  { id: "fda-consulting", period: "2024.03 — 2024.12", category: "medical", contribution: 30, featured: false, stack: ["FDA Premarket Cybersecurity", "eSTAR", "Threat Modeling"] },
  { id: "medical-controls", period: "2024.06 — 2025.03", category: "medical", contribution: 45, featured: false, stack: ["BLE", "JWT/HS256", "OTP", "RBAC", "HTTPS", "Cybersecurity Controls"] },
  { id: "k-melloddy", period: "2024.07 — 2024.12", category: "medical", contribution: 30, featured: false, stack: ["NIST SSDF", "Threat Modeling", "SBOM/VEX", "IEC 62443", "FDA Cybersecurity"] },
  { id: "cosmo-mfds", period: "2025.10 — 2026.12", category: "medical", contribution: 40, featured: false },
  { id: "c2021-eleccon", period: "2021.05 — 2021.12", category: "cyber-range", contribution: 30, featured: false },
  { id: "cyber-training-upgrade", period: "2022.07 — 2022.09", category: "cyber-range", contribution: 40, featured: false, stack: ["OT/ICS", "SCADA", "CTF"] },
  { id: "kepco-eleccon-2023", period: "2023.06 — 2023.12", category: "cyber-range", contribution: 30, featured: false, stack: ["OT/ICS", "SCADA", "CTF"] },
  { id: "smartship-port-training", period: "2024.07 — 2024.12", category: "cyber-range", contribution: 20, featured: false },
  { id: "training-upgrade-2024", period: "2024.09 — 2025.02", category: "cyber-range", contribution: 30, featured: false, stack: ["OT/ICS", "SCADA"] },
  { id: "hacking-booth", period: "2024.11", category: "cyber-range", contribution: 45, featured: false, stack: ["IoT"] },
  { id: "apex-2025", period: "2025.06 — 2025.09", category: "cyber-range", contribution: 45, featured: false, stack: ["DFIR", "Network Forensics", "Wireshark"] },
  { id: "apex-2026", period: "2026.06 — 2026.09", category: "cyber-range", contribution: 100, featured: true, stack: ["DFIR", "CCSDS", "AIS", "Firmware Reversing", "PCAP Analysis"] },
  { id: "hacksium", period: "2026.06 — 2026.09", category: "cyber-range", contribution: 70, featured: true, stack: ["LiveFire", "Blue Team Defense", "ICS/OT", "Scenario Design", "CTF Ops"] },
  { id: "coway-isms", period: "2020.11", category: "consulting", contribution: 40, featured: false },
  { id: "infinitt-dps", period: "2024.07 — 2024.09", category: "consulting", contribution: 70, featured: false, stack: ["Burp Suite", "Wireshark", "APKTool", "OWASP Top 10", "Android/iOS"] },
  { id: "infosec-consulting", period: "2024.10 — 2025.01", category: "consulting", contribution: 25, featured: false },
];

/** 전체 프로젝트 수 */
export const PORTFOLIO_PROJECT_COUNT = PORTFOLIO_PROJECTS.length;
