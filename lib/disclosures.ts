// 자동 생성 - 고치지 마라. scripts/generate-from-source.mjs 가 data/source/cves.json 에서 만든다.
// 갈래는 항목의 CWE 에서 도출한다(매핑 근거는 생성기 주석). 원본 CWE 도 함께 남겨 근거를 잃지 않는다.

export type DisclosureCategory =
  | 'Memory corruption'
  | 'Out-of-bounds read'
  | 'Injection / command execution'
  | 'Authentication / access control'
  | 'Logic / denial of service'
  | 'Unclassified'

export interface CveDisclosure {
  id: string
  summary: string
  category: DisclosureCategory
  cwe: string
  url?: string
  impact?: string
}

export interface PublicFinding {
  project: string
  date: string
  title: string
  description: string
  url: string
  links?: { label: string; url: string }[]
}

export interface DisclosureGroup {
  project: string
  period: string
  description: string
  attribution?: string
  cves: CveDisclosure[]
  evidence?: { label: string; url: string }[]
}

export const disclosureGroups: DisclosureGroup[] = [
  {
    "project": "Database",
    "period": "2026",
    "description": "1 disclosures in the Database group.",
    "cves": [
      {
        "id": "CVE-UNASSIGNED-MDEV-40571",
        "summary": "MariaDB .frm parsing OOB read leads to vtable hijacking RCE",
        "category": "Logic / denial of service",
        "cwe": "CWE-1285",
        "url": "/blog/mariadb-frm-oob-read-vtable-hijack-rce/",
        "impact": "CVSS 8 (high)"
      }
    ],
    "evidence": []
  },
  {
    "project": "LLM",
    "period": "2026",
    "description": "3 disclosures in the LLM group.",
    "cves": [
      {
        "id": "CVE-2026-52130",
        "summary": "llama.cpp json-schema-to-grammar uncontrolled recursion",
        "category": "Logic / denial of service",
        "cwe": "CWE-674",
        "url": "/blog/cve-2026-52130/",
        "impact": "CVSS 7.5 (high)"
      },
      {
        "id": "CVE-2026-52131",
        "summary": "llama.cpp gguf_reader::read reachable assertion",
        "category": "Logic / denial of service",
        "cwe": "CWE-617",
        "url": "/blog/cve-2026-52131/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2026-52132",
        "summary": "llama.cpp /rerank negative top_n denial of service",
        "category": "Logic / denial of service",
        "cwe": "CWE-190",
        "url": "/blog/cve-2026-52132/",
        "impact": "CVSS 7.5 (high)"
      }
    ],
    "evidence": []
  },
  {
    "project": "Web",
    "period": "2026",
    "description": "4 disclosures in the Web group.",
    "cves": [
      {
        "id": "FVE-2026-8617-75112",
        "summary": "Masked web disclosure from Findthegap bug bounty platform",
        "category": "Authentication / access control",
        "cwe": "CWE-306 / CWE-200 / CWE-284",
        "url": "/blog/fve-2026-8617-75112/",
        "impact": "CVSS 7.5 (high)"
      },
      {
        "id": "FVE-2026-8617-74526",
        "summary": "Masked web disclosure from Findthegap bug bounty platform",
        "category": "Authentication / access control",
        "cwe": "CWE-639 / CWE-306",
        "url": "/blog/fve-2026-8617-74526/",
        "impact": "CVSS 7.5 (high)"
      },
      {
        "id": "FVE-2026-8617-74507",
        "summary": "Masked web disclosure from Findthegap bug bounty platform",
        "category": "Authentication / access control",
        "cwe": "CWE-620 / CWE-306",
        "url": "/blog/fve-2026-8617-74507/",
        "impact": "CVSS 9.8 (critical)"
      },
      {
        "id": "FVE-2026-8617-74513",
        "summary": "Masked web disclosure from Findthegap bug bounty platform",
        "category": "Unclassified",
        "cwe": "CWE-unknown",
        "url": "/blog/fve-2026-8617-74513/",
        "impact": "CVSS 7.5 (high)"
      }
    ],
    "evidence": []
  },
  {
    "project": "IoT",
    "period": "2024",
    "description": "5 disclosures in the IoT group.",
    "cves": [
      {
        "id": "CVE-2024-33788",
        "summary": "Linksys E5600 command injection",
        "category": "Injection / command execution",
        "cwe": "CWE-77",
        "url": "/blog/e5600-wps-command-injection/",
        "impact": "CVSS 8 (high)"
      },
      {
        "id": "CVE-2024-33789",
        "summary": "Linksys E5600 command injection",
        "category": "Injection / command execution",
        "cwe": "CWE-77",
        "url": "/blog/e5600-wps-command-injection/",
        "impact": "CVSS 8.2 (medium)"
      },
      {
        "id": "CVE-2024-33791",
        "summary": "netis-systems MEX605 cross-site scripting",
        "category": "Injection / command execution",
        "cwe": "CWE-79",
        "url": "/blog/netis-mex605-vulnerability-research/",
        "impact": "CVSS 4.6 (high)"
      },
      {
        "id": "CVE-2024-33792",
        "summary": "netis-systems MEX605 OS command execution",
        "category": "Injection / command execution",
        "cwe": "CWE-78",
        "url": "/blog/netis-mex605-vulnerability-research/",
        "impact": "CVSS 9.8 (critical)"
      },
      {
        "id": "CVE-2024-33793",
        "summary": "netis-systems MEX605 OS command execution",
        "category": "Injection / command execution",
        "cwe": "CWE-78",
        "url": "/blog/netis-mex605-vulnerability-research/",
        "impact": "CVSS 5.3 (medium)"
      }
    ],
    "evidence": []
  },
  {
    "project": "Kernel",
    "period": "2019",
    "description": "16 disclosures in the Kernel group.",
    "attribution": "BoB 8th bobfuzzer team project (5-person team, ported JANUS fuzzer)",
    "cves": [
      {
        "id": "CVE-2019-19927",
        "summary": "Linux kernel ttm slab out-of-bounds read",
        "category": "Out-of-bounds read",
        "cwe": "CWE-125",
        "url": "/blog/cve-2019-19927/",
        "impact": "CVSS 6 (medium)"
      },
      {
        "id": "CVE-2019-19813",
        "summary": "Linux kernel btrfs use-after-free",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19813/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2019-19814",
        "summary": "Linux kernel f2fs slab out-of-bounds write",
        "category": "Memory corruption",
        "cwe": "CWE-787",
        "url": "/blog/cve-2019-19814/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19815",
        "summary": "Linux kernel f2fs NULL pointer dereference",
        "category": "Logic / denial of service",
        "cwe": "CWE-476",
        "url": "/blog/cve-2019-19815/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2019-19816",
        "summary": "Linux kernel btrfs slab out-of-bounds write",
        "category": "Memory corruption",
        "cwe": "CWE-787",
        "url": "/blog/cve-2019-19816/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19447",
        "summary": "Linux kernel ext4 use-after-free",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19447/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19448",
        "summary": "Linux kernel btrfs use-after-free",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19448/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19449",
        "summary": "Linux kernel f2fs slab out-of-bounds read",
        "category": "Out-of-bounds read",
        "cwe": "CWE-125",
        "url": "/blog/cve-2019-19449/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19377",
        "summary": "Linux kernel btrfs use-after-free",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19377/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19378",
        "summary": "Linux kernel btrfs slab out-of-bounds write",
        "category": "Memory corruption",
        "cwe": "CWE-787",
        "url": "/blog/cve-2019-19378/",
        "impact": "CVSS 7.8 (high)"
      },
      {
        "id": "CVE-2019-19318",
        "summary": "Linux kernel btrfs use-after-free",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19318/",
        "impact": "CVSS 4.4 (medium)"
      },
      {
        "id": "CVE-2019-19319",
        "summary": "Linux kernel ext4 slab out-of-bounds write",
        "category": "Memory corruption",
        "cwe": "CWE-416",
        "url": "/blog/cve-2019-19319/",
        "impact": "CVSS 6.5 (medium)"
      },
      {
        "id": "CVE-2019-19036",
        "summary": "Linux kernel btrfs root node NULL pointer dereference",
        "category": "Logic / denial of service",
        "cwe": "CWE-476",
        "url": "/blog/cve-2019-19036/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2019-19037",
        "summary": "Linux kernel ext4 NULL pointer dereference",
        "category": "Logic / denial of service",
        "cwe": "CWE-476",
        "url": "/blog/cve-2019-19037/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2019-19039",
        "summary": "Linux kernel btrfs information disclosure",
        "category": "Authentication / access control",
        "cwe": "CWE-532",
        "url": "/blog/cve-2019-19039/",
        "impact": "CVSS 5.5 (medium)"
      },
      {
        "id": "CVE-2019-18885",
        "summary": "Linux kernel btrfs NULL pointer dereference",
        "category": "Logic / denial of service",
        "cwe": "CWE-476",
        "url": "/blog/cve-2019-18885/",
        "impact": "CVSS 5.5 (high)"
      }
    ],
    "evidence": []
  }
]

// 번호 없이 공개한 추가 발견. 우리 FVE 는 원장(disclosureGroups)에 들어가 있어 여기는 비어 있다.
export const additionalPublicFindings: PublicFinding[] = []

export const allCveDisclosures = disclosureGroups.flatMap((group) => group.cves)

// 그룹 기간에서 뽑아 히어로 라벨이 원장과 어긋날 수 없게 한다.
const disclosureYears = disclosureGroups.flatMap((group) =>
  (group.period.match(/\d{4}/g) ?? []).map(Number),
)
const oldestYear = Math.min(...disclosureYears)
const newestYear = Math.max(...disclosureYears)
export const disclosureYearRange =
  oldestYear === newestYear ? String(oldestYear) : `${oldestYear}-${String(newestYear).slice(-2)}`

const countBy = (category: DisclosureCategory) =>
  allCveDisclosures.filter((item) => item.category === category).length

export const disclosureSummary = {
  cves: 24,
  fves: 4,
  pending: 1,
  projects: 5,
  memoryCorruption: countBy('Memory corruption'),
  outOfBoundsReads: countBy('Out-of-bounds read'),
  injectionOrRce: countBy('Injection / command execution'),
  authOrAccessControl: countBy('Authentication / access control'),
  logicOrDos: countBy('Logic / denial of service'),
  unclassified: countBy('Unclassified'),
  additionalPublicFindings: additionalPublicFindings.length,
}

// CVE 번호가 있는 항목만 cve.org 에 있다. FVE·번호 대기 항목은 item.url 을 쓴다.
export const cveRecordUrl = (id: string) => `https://www.cve.org/CVERecord?id=${id}`
