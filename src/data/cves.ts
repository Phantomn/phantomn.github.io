export type CveSeverity = "critical" | "high" | "medium" | "pending";
export type CveStatus = "published" | "pending";

export interface CveEntry {
  id: string;
  title: string;
  year: number;
  groupKey: string;
  groupLabel: string;
  severity: CveSeverity;
  status: CveStatus;
  href: string;
  summary: string;
}

export interface CveGroupSummary {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
}

export const CVE_ITEMS: CveEntry[] = [
  {
    id: "CVE-2019-18885",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-18885",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19036",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19036",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19037",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19037",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19039",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19039",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19318",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19318",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19319",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19319",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19377",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19377",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19378",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19378",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19447",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19447",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19448",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19448",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19449",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19449",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19813",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19813",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19814",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19814",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19815",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19815",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19816",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "high",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19816",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2019-19927",
    title: "OS kernel disclosure from BoB 8",
    year: 2019,
    groupKey: "os-kernel",
    groupLabel: "Best of the Best 8 - OS Kernel",
    severity: "medium",
    status: "published",
    href: "https://github.com/Phantomn/CVE/tree/master/CVE-2019-19927",
    summary: "Kernel vulnerability disclosed during BoB 8 research.",
  },
  {
    id: "CVE-2024-33788",
    title: "IoT disclosure from personal research",
    year: 2024,
    groupKey: "iot",
    groupLabel: "Personal research - IoT",
    severity: "high",
    status: "published",
    href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33788",
    summary: "IoT vulnerability disclosed during personal research.",
  },
  {
    id: "CVE-2024-33789",
    title: "IoT disclosure from personal research",
    year: 2024,
    groupKey: "iot",
    groupLabel: "Personal research - IoT",
    severity: "pending",
    status: "pending",
    href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33789",
    summary: "Pending IoT disclosure tracked from personal research.",
  },
  {
    id: "CVE-2024-33791",
    title: "IoT disclosure from personal research",
    year: 2024,
    groupKey: "iot",
    groupLabel: "Personal research - IoT",
    severity: "medium",
    status: "published",
    href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33791",
    summary: "IoT vulnerability disclosed during personal research.",
  },
  {
    id: "CVE-2024-33792",
    title: "IoT disclosure from personal research",
    year: 2024,
    groupKey: "iot",
    groupLabel: "Personal research - IoT",
    severity: "critical",
    status: "published",
    href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33792",
    summary: "Critical IoT vulnerability disclosed during personal research.",
  },
  {
    id: "CVE-2024-33793",
    title: "IoT disclosure from personal research",
    year: 2024,
    groupKey: "iot",
    groupLabel: "Personal research - IoT",
    severity: "medium",
    status: "published",
    href: "https://github.com/0x0xxxx/CVE/tree/main/CVE-2024-33793",
    summary: "IoT vulnerability disclosed during personal research.",
  },
];

export const CVE_COUNT = CVE_ITEMS.length;

export const CVE_GROUPS: CveGroupSummary[] = [
  {
    key: "os-kernel",
    label: "Best of the Best 8 - OS Kernel",
    shortLabel: "OS Kernel",
    count: 16,
  },
  {
    key: "iot",
    label: "Personal research - IoT",
    shortLabel: "IoT",
    count: 5,
  },
];

export function getCveSeverityLabel(severity: CveSeverity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "pending":
      return "Pending";
  }
}

export function getCveSlug(id: string) {
  return id.toLowerCase();
}

export function getCveBySlug(slug: string) {
  return CVE_ITEMS.find((item) => getCveSlug(item.id) === slug) ?? null;
}
