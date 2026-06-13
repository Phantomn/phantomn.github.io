/**
 * Portfolio / 경력증명 데이터
 *
 * `/about`(소개 프로필)과 분리된 경력증명·쇼케이스 문서용 데이터.
 * 한국 경력기술서 표준(기간 / 역할 / 기여도 / 배경 / 수행 / 성과 / 기술스택)을 따른다.
 *
 * - Featured 프로젝트: full STAR (background + actions + results + stack)
 * - 나머지: 간략 (한 줄 성과만 results[0])
 *
 * 고객사명은 실명 공개 결정. 본문 번역은 DynamicTranslator가 런타임 처리.
 */

export type PortfolioCategoryKey =
  | "fintech"
  | "ics-ot"
  | "iot"
  | "medical"
  | "cyber-range"
  | "consulting";

export interface PortfolioCategory {
  key: PortfolioCategoryKey;
  label: string;
}

export interface PortfolioProject {
  /** 프로젝트명 */
  title: string;
  /** 고객사 / 발주처 (실명) */
  client: string;
  /** 수행 기간 — 예: "2024.07 — 2025.03" */
  period: string;
  /** 분류 */
  category: PortfolioCategoryKey;
  /** 역할 */
  role: string;
  /** 기여도 (%) */
  contribution: number;
  /** Featured 여부 — true면 STAR 상세 카드로 렌더 */
  featured: boolean;
  /** STAR-S/T: 배경·과제 (featured 전용) */
  background?: string;
  /** STAR-A: 주요 수행 내용 */
  actions: string[];
  /** STAR-R: 성과 (간략 항목은 1줄) */
  results: string[];
  /** 기술스택 (featured 전용) */
  stack?: string[];
}

export const PORTFOLIO_CATEGORIES: PortfolioCategory[] = [
  { key: "fintech", label: "금융·공공 Web/App 모의해킹" },
  { key: "ics-ot", label: "OT/ICS 보안 (IEC 62443)" },
  { key: "iot", label: "IoT 취약점·도구 개발" },
  { key: "medical", label: "의료기기 보안 (FDA/eSTAR)" },
  { key: "cyber-range", label: "사이버훈련장·CTF 개발" },
  { key: "consulting", label: "보안 컨설팅·인증" },
];

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  /* ── Featured (full STAR) ───────────────────────────────────── */
  {
    title: "LS ELECTRIC 자동화기기 Achilles Communication Certificate Level 2 인증 취득",
    client: "LS ELECTRIC",
    period: "2024.07 — 2025.03",
    category: "ics-ot",
    role: "주담당 (인증 점검·시험 총괄)",
    contribution: 100,
    featured: true,
    background:
      "LS ELECTRIC PLC 제품군의 국제 통신 견고성 인증(Achilles Communication Certificate Level 2) 취득을 위한 사전 점검·시험·보완이 필요했다. DoS·스톰·비정상 트래픽 환경에서도 제어 기능을 유지해야 하는 까다로운 통과 기준을 충족해야 했다.",
    actions: [
      "PLC 제품군 대상 Achilles Communication Certificate Level 2 전 시험 항목 통신 견고성 점검 수행",
      "XGT Protocol 등 통신 스택 대상 스톰/퍼징/비정상 패킷 내성 검증 및 결함 재현",
      "인증 시험 시나리오 설계 및 재시험 대응으로 통과 기준 충족 검증",
    ],
    results: [
      "LS ELECTRIC PLC 제품군 Achilles Communication Certificate Level 2 인증 취득 달성",
      "통신 견고성 결함 식별 → 제품 펌웨어 보완 반영",
    ],
    stack: ["Achilles Test Platform", "XGT Protocol", "PLC", "Wireshark", "Python"],
  },
  {
    title: "NATO CCDCOE Locked Shields 2025 — 한국-캐나다 연합 DFIR 블루팀",
    client: "NATO CCDCOE",
    period: "2025.01 — 2025.04",
    category: "cyber-range",
    role: "DFIR 블루팀원 (포렌식·침해대응)",
    contribution: 45,
    featured: true,
    background:
      "세계 최대 규모 국제 사이버 방어 훈련 Locked Shields에 한국-캐나다 연합팀 DFIR(디지털 포렌식·침해대응) 블루팀으로 참가했다. 실시간 공격 환경에서 침해 흔적을 분석하고 대응 보고하는 고강도 훈련이다. (2026년에는 한국-헝가리 연합 Special System 블루팀 참가)",
    actions: [
      "실시간 공격 시나리오 하 침해사고 포렌식 분석 및 타임라인 재구성",
      "DFIR CTF 과제 수행 — 아티팩트 분석·악성코드 트리아지",
      "연합팀 협업 기반 침해대응 보고 체계 운영",
    ],
    results: [
      "Locked Shields 2025 — 훈련 종합 6위 / DFIR CTF 부문 1위 달성",
      "Locked Shields 2026 — 한국-헝가리 연합 Special System 블루팀, 종합 9위",
    ],
    stack: ["DFIR", "Volatility", "Wireshark", "Sysmon", "YARA"],
  },
  {
    title: "IoT/CCTV 침해사고 조사 도구 개발",
    client: "CoreSecurity (R&D)",
    period: "2022.08 — 2022.12",
    category: "iot",
    role: "도구 설계·개발 주담당",
    contribution: 45,
    featured: true,
    background:
      "CCTV 등 IoT 장비는 침해사고 발생 시 증거 수집 절차·도구가 표준화되어 있지 않다. 펌웨어 내부의 설정 파일·로그를 신속하게 확보할 수 있는 자동화 조사 도구가 필요했다.",
    actions: [
      "국내·외 CCTV 40종 대상 침해사고 증거 수집 자동화 도구 설계·구현",
      "UART 접근·플래시 덤프·binwalk 기반 펌웨어 추출 및 설정 파일·로그 전수 수집 모듈 개발",
      "공공기관 현장에서 실제 40종 장비 대상 침해사고 흔적 수집 수행",
    ],
    results: [
      "국내·외 CCTV 40종 침해사고 증거 수집 자동화 도구 개발",
      "공공기관 실증 — 40종 장비 침해 흔적 수집 및 분석",
    ],
    stack: ["Python", "C/C++", "UART", "binwalk", "Firmware Dump", "Linux"],
  },

  /* ── 금융·공공 Web/App 모의해킹 (A3 Security) ───────────────── */
  {
    title: "금융·공공 전자금융기반시설 모의해킹 (12개 사이트)",
    client: "A3 Security",
    period: "2020.06 — 2021.06",
    category: "fintech",
    role: "Web/App 모의해킹·취약점 분석평가",
    contribution: 0,
    featured: false,
    background:
      "A3 Security 재직 중 금융권·공공기관의 전자금융기반시설을 대상으로 다수의 Web/App 모의해킹 및 취약점 분석평가를 수행했다. 정보 유출·2차 공격 가능성을 점검하고 개선 방안을 제시하는 것이 목표였다.",
    actions: [
      "전자금융기반시설 취약점 분석평가 — 참저축은행, 애큐온캐피탈, 금융투자협회 등 금융권 Web/App 모의해킹",
      "금융·보험·제조 시스템 보안성 검토 — SBI저축은행(오픈뱅킹·디지털창구), 현대자동차 HKMC, DB손해보험 클레임콜",
      "농협중앙회 RPA 소스코드 진단, 대교 통합교육 플랫폼·오토핸즈·UNTAC 등 모의해킹",
    ],
    results: [
      "금융·공공 전자금융기반시설 12개 사이트 모의해킹 수행, 사이트당 고위험 취약점 평균 1~2건 식별",
      "취약점별 개선 방안 제시 및 보안성 심의 지원",
    ],
    stack: ["Burp Suite", "OWASP Top 10", "Web/App Pentest", "Source Code Review"],
  },

  /* ── IoT 취약점·도구 개발 ───────────────────────────────────── */
  {
    title: "KT 기가지니 AI 스피커 단말 모의해킹",
    client: "KT",
    period: "2020.10",
    category: "iot",
    role: "IoT 단말 모의해킹",
    contribution: 100,
    featured: false,
    actions: [
      "기가지니 AI 스피커 단말 대상 UART 디버그 인터페이스 분석",
      "블루투스 통신 및 Android APK 분석을 통한 공격 표면 점검",
    ],
    results: ["기가지니 AI 스피커 단말 UART·블루투스·APK 다중 벡터 보안성 모의해킹 수행"],
    stack: ["UART", "Bluetooth", "APK", "Android"],
  },
  {
    title: "스마트빌딩 내 IoT 기기 취약점 탐지 기술 개발 및 실증 (1차년도)",
    client: "CoreSecurity (R&D)",
    period: "2021.08 — 2021.12",
    category: "iot",
    role: "탐지 시나리오·테스트베드 개발·도구 검증",
    contribution: 40,
    featured: false,
    background:
      "스마트빌딩 내 IoT 기기는 임베디드 리눅스 기반으로 일반 스캔이 어렵고, 표준 프로토콜이 혼재해 자산·취약점 식별이 까다로웠다. 스캐닝부터 취약점 매핑까지 자동화하는 탐지 기술과 이를 검증할 테스트베드가 필요했다.",
    actions: [
      "유선(BACNet·KNXNet·Modbus)·무선(Wi-Fi·BLE) 프로토콜 디스커버리 기반 IoT 스캐닝 기술 검증",
      "수집 정보(OS·프로토콜·펌웨어·모델)와 NVD CVE/CWE 매핑 및 PoC 기반 검증 시나리오 개발",
      "실제 스마트빌딩 기능을 갖춘 테스트베드 구축 및 탐지 도구 완성도 검증",
    ],
    results: [
      "스마트빌딩 IoT 취약점 탐지 도구 검증용 테스트베드 및 탐지 시나리오 개발 (기여도 40%)",
      "유·무선 프로토콜 자산 식별 → CVE/CWE 매핑 → PoC 검증 흐름 확립",
    ],
    stack: ["BACNet", "KNXNet", "Modbus", "BLE", "CVE/CWE", "SQLite"],
  },
  {
    title: "스마트빌딩 내 IoT 기기 취약점 탐지 기술 개발 및 실증 (2차년도)",
    client: "CoreSecurity (R&D)",
    period: "2022.01 — 2022.10",
    category: "iot",
    role: "실증 수행·탐지 식별률 검증",
    contribution: 40,
    featured: false,
    background:
      "1차년도에 개발한 탐지 기술을 실제 운영 중인 스마트빌딩 환경에 적용해 탐지 정확도를 검증하고 개선해야 했다.",
    actions: [
      "실제 스마트빌딩 대상 실증 — 기기·센서·프로토콜 정보 수집 및 취약점 탐지 수행",
      "취약점 정탐/오탐/미탐 식별 및 탐지 식별률 도출",
      "실증 결과 분석 기반 탐지 개선사항 도출 및 취약점 DB 최신화",
    ],
    results: [
      "실제 스마트빌딩 대상 탐지 기술 실증 및 식별률 검증 (기여도 40%)",
      "정/오/미탐 분석 기반 탐지 정확도 개선 조치 도출",
    ],
    stack: ["IoT Scanning", "CVE/CWE", "PoC Validation", "CSV/Excel Report"],
  },
  {
    title: "QUD-081871 IoT 보안 과제",
    client: "CoreSecurity (R&D)",
    period: "2021.08 — 2021.12",
    category: "iot",
    role: "연구 수행",
    contribution: 40,
    featured: false,
    actions: [],
    results: ["IoT 보안 연구 과제 수행"],
  },

  /* ── OT/ICS 보안 (IEC 62443) ────────────────────────────────── */
  {
    title: "LS ELECTRIC 자동화기기 Threat Modeling 컨설팅",
    client: "LS ELECTRIC",
    period: "2023.03 — 2023.11",
    category: "ics-ot",
    role: "Threat Modeling 컨설팅·모의해킹",
    contribution: 40,
    featured: false,
    background:
      "LS ELECTRIC 자동화기기(XGI-CPUZ)의 IEC 62443-4-2 인증을 위해 체계적 위협 모델링과 이를 검증할 모의해킹이 필요했다.",
    actions: [
      "System Definition → Function Point Definition → Data Flow Analysis 순으로 분석, DFD 작성",
      "STRIDE + DREAD 기반 Threat & Risk Assessment 수행",
      "주요정보통신기반시설 취약점 분석평가 방법론 기반 모의해킹으로 위협 검증",
    ],
    results: [
      "LS ELECTRIC XGI-CPUZ 대상 Threat Modeling 보고서 및 모의해킹 보고서 산출",
      "IEC 62443-4-2 인증을 위한 위협·위험 평가 근거 제공",
    ],
    stack: ["STRIDE", "DREAD", "DFD", "IEC 62443-4-2"],
  },
  {
    title: "LS ELECTRIC IEC 62443-4-2 자동화 점검 도구 개발",
    client: "LS ELECTRIC",
    period: "2025.03 — 2025.11",
    category: "ics-ot",
    role: "자동화 도구 설계·개발 주담당",
    contribution: 90,
    featured: true,
    background:
      "LS ELECTRIC PLC 제품군의 IEC 62443-4-2 인증 준비 과정에서 컴포넌트 보안 요구사항(CR) 점검은 대부분 수작업이었다. 통신으로 자동 점검이 가능한 요구사항을 도구화해 반복 점검 비용을 줄여야 했다.",
    actions: [
      "IEC 62443-4-2 SL1 요구사항 중 통신 기반 자동화가 가능한 항목을 선별해 점검 도구 설계",
      "FR2(사용 제어)·FR3(시스템 무결성)·FR4(데이터 기밀성)·FR7(자원 가용성) 영역 점검 자동화 구현",
      "점검 대상·결과 관리를 위한 웹 기반 UI 및 결과 저장 파이프라인 구축",
    ],
    results: [
      "LS ELECTRIC PLC 제품군 IEC 62443-4-2 통신 기반 요구사항 자동 점검 도구 개발 (기여도 90%)",
      "수작업 대비 점검 시간 단축",
    ],
    stack: [
      "Python",
      "FastAPI",
      "TypeScript",
      "React",
      "TailwindCSS",
      "SQLite3",
      "IEC 62443-4-2",
    ],
  },
  {
    title: "스마트쉽 인프라 취약점 분석·검증 도구 및 보안 기술 개발",
    client: "CoreSecurity (R&D)",
    period: "2024.07 — 2024.11",
    category: "ics-ot",
    role: "취약점 분석·검증 도구 개발",
    contribution: 25,
    featured: false,
    background:
      "스마트선박 내부 CBS(Computer Based System)는 Windows/Linux PC뿐 아니라 Embedded 기반 IoT·IIoT 장비가 혼재해 일반 스캔으로는 자산·취약점 식별이 어려웠다. 주요정보통신기반시설 취약점 분석 가이드 기반의 점검 도구가 필요했다.",
    actions: [
      "주요정보통신기반시설 취약점 분석 가이드 기반 Windows/Linux 점검 체크리스트 개발",
      "SSDP Discovery 기반 IoT/IIoT 센싱으로 OS·호스트·디바이스 정보 수집 (WS-Discovery·SNMP 확장 검증)",
      "NVD/MITRE의 CVE·CWE를 CPE 기반으로 CBS에 매핑, PoC 코드로 명령 실행·코드 실행 취약점 검증",
      "Shell/Powershell 기반 OS별 점검 자동화 모듈 및 5개 엔티티 취약점 DB(ERD) 구축",
    ],
    results: [
      "스마트쉽 CBS 대상 취약점 분석·검증 자동화 도구 개발 (기여도 25%)",
      "식별 자산 기반 CVE/CWE 매핑 및 PoC 검증 결과를 CSV 등 포맷으로 제공",
    ],
    stack: ["Python", "SSDP", "CVE/CWE", "CPE", "SQLite", "Shell/Powershell"],
  },

  /* ── 의료기기 보안 (FDA/eSTAR) ──────────────────────────────── */
  {
    title: "의료기기 FDA 보안 컨설팅",
    client: "의료기기 제조사",
    period: "2024.03 — 2024.12",
    category: "medical",
    role: "Threat Modeling·모의해킹·eSTAR 컨설팅",
    contribution: 30,
    featured: false,
    background:
      "미국 FDA 시판 전 인증을 준비하는 의료기기 제조사의 사이버보안 요구사항 충족을 위해, 인프라 위협 모델링부터 의료기기·연동 시스템 모의해킹, eSTAR 제출 문서화까지 일괄 지원이 필요했다.",
    actions: [
      "FDA 인증 대상 인프라 Threat Modeling 수행 및 위협·완화 방안 도출",
      "의료기기 본체 및 연동 Web/App 대상 모의해킹으로 실제 취약점 검증",
      "FDA Premarket Cybersecurity 요구사항 기반 eSTAR 제출 문서화 컨설팅",
    ],
    results: [
      "FDA 인증 대상 인프라 Threat Modeling 및 Web/App·의료기기 모의해킹 수행 (기여도 30%)",
      "eSTAR 사이버보안 제출 문서 컨설팅 지원",
    ],
    stack: ["FDA Premarket Cybersecurity", "eSTAR", "Threat Modeling"],
  },
  {
    title: "의료기기 보안인증을 위한 컨설팅 (Cybersecurity Controls)",
    client: "의료기기 제조사",
    period: "2024.06 — 2025.03",
    category: "medical",
    role: "보안 통제 설계·문서화 컨설팅",
    contribution: 45,
    featured: false,
    background:
      "전자약(ADHD 치료용 경피전기신경자극기) 의료기기의 보안인증 취득을 위해, 기기·베이스스테이션·모바일앱·서버로 구성된 시스템 전반의 사이버보안 통제를 설계하고 인증 제출 문서를 작성해야 했다.",
    actions: [
      "기기-앱(BLE)·앱-서버(LTE/5G)·웹(HTTPS)·베이스스테이션(Wi-Fi) 통신 경로 및 데이터 흐름 분석",
      "사용자 인증(JWT HS256·RTR), OTP 가입 인증, 비밀번호 정책, 대시보드 RBAC 등 보안 통제 설계·검증",
      "다중 연결 제한·세션 관리·역할 분리 등 Cybersecurity Controls 인증 제출 문서 작성",
    ],
    results: [
      "의료기기 시스템 전반 사이버보안 통제 설계 및 인증 제출 문서(Cybersecurity Controls) 작성 (기여도 45%)",
      "통신 경로별 암호화·인증·접근통제 체계 정립",
    ],
    stack: ["BLE", "JWT/HS256", "OTP", "RBAC", "HTTPS", "Cybersecurity Controls"],
  },
  {
    title: "연합학습 기반 신약개발 가속화 프로젝트 (K-MELLODDY)",
    client: "K-MELLODDY 컨소시엄",
    period: "2024.07 — 2024.12",
    category: "medical",
    role: "연합학습 플랫폼 보안 설계·모의해킹",
    contribution: 30,
    featured: false,
    background:
      "신약개발을 위한 연합학습(Federated Learning) 플랫폼(FDD)은 다기관 데이터·모델을 다루므로, 개발 생명주기 전반의 보안 내재화와 실제 위협에 대한 통제가 필요했다.",
    actions: [
      "NIST SSDF 기반 FDD 플랫폼 안전한 개발 프로세스 분석·정의 (IEC 62443·FDA·ISO 27001·EU CRA 표준 검토)",
      "FDD 플랫폼 위협 모델링 기반 실제 위협 식별 및 소스코드 레벨 보안 통제(API 보안) 적용",
      "공급망 보안 관리 체계(SBOM+VEX+EoS) 수립 및 실 운영 환경 모의해킹 2회 수행",
    ],
    results: [
      "연합학습 신약개발 플랫폼(FDD) 보안 개발 프로세스 정립 및 위협 통제 적용 (기여도 30%)",
      "공급망 보안 체계 수립 및 모의해킹 기반 보안 대책 반영",
    ],
    stack: ["NIST SSDF", "Threat Modeling", "SBOM/VEX", "IEC 62443", "FDA Cybersecurity"],
  },

  /* ── 사이버훈련장·CTF 개발 ──────────────────────────────────── */
  {
    title: "C2021 행사 (ELECCON 대회 운영)",
    client: "CoreSecurity / 한국전력",
    period: "2021.05 — 2021.12",
    category: "cyber-range",
    role: "대회 운영 보조",
    contribution: 30,
    featured: false,
    actions: ["ELECCON 사이버 공방 대회 운영 보조"],
    results: ["ELECCON 대회 운영 지원 (기여도 30%)"],
  },
  {
    title: "실전형 사이버보안 훈련시스템 고도화",
    client: "CoreSecurity",
    period: "2022.07 — 2022.09",
    category: "cyber-range",
    role: "예선 문제·본선 시나리오 개발",
    contribution: 40,
    featured: false,
    actions: [
      "실전형 사이버 공방 훈련 예선 문제 개발",
      "전력망(OT/ICS) 환경 기반 본선 공방 시나리오 개발",
    ],
    results: ["실전형 훈련시스템 예선 문제 및 전력망 본선 시나리오 개발 (기여도 40%)"],
    stack: ["OT/ICS", "SCADA", "CTF"],
  },
  {
    title: "한국전력 실전형 사이버 보안 훈련 시스템 보강 (ELECCON)",
    client: "한국전력공사",
    period: "2023.06 — 2023.12",
    category: "cyber-range",
    role: "예선 문제·본선 시나리오 개발",
    contribution: 30,
    featured: false,
    actions: [
      "ELECCON 예선 CTF 문제 개발",
      "전력망(OT/ICS) 환경 기반 본선 공방 시나리오 설계·개발",
    ],
    results: ["한국전력 ELECCON 예선 문제 및 전력망 본선 시나리오 개발 (기여도 30%)"],
    stack: ["OT/ICS", "SCADA", "CTF"],
  },
  {
    title: "24년 실전형 사이버훈련장 훈련과정 운영 (스마트선박 항만)",
    client: "CoreSecurity",
    period: "2024.07 — 2024.12",
    category: "cyber-range",
    role: "스마트선박 훈련 컨텐츠 개발",
    contribution: 20,
    featured: false,
    actions: ["스마트선박 환경 대상 사이버 훈련 컨텐츠 개발"],
    results: ["스마트선박·항만 실전형 사이버훈련장 훈련 컨텐츠 개발 (기여도 20%)"],
  },
  {
    title: "실전형 사이버 보안 훈련시스템 보강 (2024)",
    client: "CoreSecurity",
    period: "2024.09 — 2025.02",
    category: "cyber-range",
    role: "본선 시나리오 개발",
    contribution: 30,
    featured: false,
    actions: ["전력망(OT/ICS) 환경 기반 본선 공방 시나리오 개발"],
    results: ["실전형 훈련시스템 전력망 본선 시나리오 개발 (기여도 30%)"],
    stack: ["OT/ICS", "SCADA"],
  },
  {
    title: "해킹 시나리오 기반 해킹체험 운영",
    client: "CoreSecurity",
    period: "2024.11",
    category: "cyber-range",
    role: "IoT 해킹체험 부스 운영",
    contribution: 45,
    featured: false,
    actions: ["IoT 기기 대상 해킹 체험 부스 운영"],
    results: ["IoT 기기 해킹 체험 부스 운영 (기여도 45%)"],
    stack: ["IoT"],
  },
  {
    title: "APEX 2025 문제 개발 (DFIR)",
    client: "APEX CTF 2025",
    period: "2025.06 — 2025.09",
    category: "cyber-range",
    role: "DFIR Network Forensics 문제 개발",
    contribution: 45,
    featured: false,
    actions: ["DFIR Network Forensics 카테고리 문제 개발 — 실제 침해사고 기반 포렌식 시나리오"],
    results: ["APEX CTF 2025 DFIR Network Forensics 문제 개발 (기여도 45%)"],
    stack: ["DFIR", "Network Forensics", "Wireshark"],
  },

  /* ── 보안 컨설팅·인증 ───────────────────────────────────────── */
  {
    title: "코웨이 인증심사 취득지원 (ISMS, ISO27001) 컨설팅",
    client: "코웨이",
    period: "2020.11",
    category: "consulting",
    role: "인증 취득 컨설팅",
    contribution: 40,
    featured: false,
    actions: [],
    results: ["ISMS·ISO27001 인증심사 취득지원 컨설팅 수행"],
  },
  {
    title: "INFINITT DPS 의료영상 플랫폼 모의해킹",
    client: "INFINITT Healthcare",
    period: "2024.07 — 2024.09",
    category: "consulting",
    role: "모의해킹 주담당 (보고서 주저자)",
    contribution: 70,
    featured: false,
    background:
      "의료영상 플랫폼(DPS)의 Web 및 모바일(Android/iOS) 서비스에 대해 체크리스트 기반 취약점 진단과 실제 침투 시도를 통해 정보 유출·2차 공격 가능성을 점검해야 했다.",
    actions: [
      "주요정보통신기반시설 취약점 분석 가이드 + OWASP Top 10 2021 기반 Web/Mobile 수동 진단",
      "Burp Suite·Wireshark·APKTool 등으로 인증·접근통제·입력검증 취약점 점검",
      "결과 보고서 작성 및 이행점검(재점검)으로 조치 완료 검증",
    ],
    results: [
      "INFINITT DPS Web/Mobile 모의해킹 총 14건 취약점 식별(중위험 3·저위험 11), 재점검 전건 조치 완료",
      "영문 결과 보고서 주저자 수행 (기여도 70%)",
    ],
    stack: ["Burp Suite", "Wireshark", "APKTool", "OWASP Top 10", "Android/iOS"],
  },
  {
    title: "정보보안 컨설팅 용역",
    client: "비공개",
    period: "2024.10 — 2025.01",
    category: "consulting",
    role: "정보보안 컨설팅",
    contribution: 25,
    featured: false,
    actions: [],
    results: ["정보보안 컨설팅 용역 수행"],
  },
];

/** Featured 프로젝트만 (등록 순서 유지) */
export const FEATURED_PROJECTS = PORTFOLIO_PROJECTS.filter((p) => p.featured);

/** 전체 프로젝트 수 */
export const PORTFOLIO_PROJECT_COUNT = PORTFOLIO_PROJECTS.length;

/** 카테고리별 프로젝트 수 */
export const PORTFOLIO_CATEGORY_COUNTS: Record<PortfolioCategoryKey, number> =
  PORTFOLIO_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.key] = PORTFOLIO_PROJECTS.filter((p) => p.category === cat.key).length;
      return acc;
    },
    {} as Record<PortfolioCategoryKey, number>,
  );

export function getPortfolioCategoryLabel(key: PortfolioCategoryKey): string {
  return PORTFOLIO_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
