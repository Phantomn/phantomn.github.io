/**
 * Reader-facing collections for the blog index. Posts keep their granular
 * frontmatter tags; this maps them onto seven curated collections so the
 * archive reads as a handful of coherent threads instead of 185 tags.
 *
 * Kept free of node imports so client components can use it.
 */

export const COLLECTIONS = [
  'OT/ICS & regulated systems',
  'IoT & firmware',
  'Kernel & binary exploitation',
  'Web security',
  'Fuzzing & program analysis',
  'Malware analysis',
  'AI & LLM security',
  'Archive',
] as const

export type Collection = (typeof COLLECTIONS)[number]

/*
 * Matching runs top-to-bottom; the first rule whose tag set intersects the
 * post's tags wins, so the collection that should own a cross-cutting post
 * must come first. The PLC fuzzer write-up carries both `ot` and `fuzzing`
 * and belongs under OT/ICS, so that rule precedes the fuzzing one; fuzzing in
 * turn precedes kernel/binary, or the tool write-ups land under their target.
 *
 * Tags are the ones that actually occur in content/posts frontmatter - a rule
 * naming a tag no post uses silently drops every post into Archive.
 */
const rules: Array<{ collection: Collection; tags: string[] }> = [
  {
    collection: 'OT/ICS & regulated systems',
    tags: [
      'ot',
      'ot-security',
      'ics',
      'plc',
      'modbus',
      'dnp3',
      'iec-62443',
      'iec62443',
      'achilles',
      'isasecure',
      'iecee',
      'certification',
      'compliance',
      'security-level',
      'foundational-requirements',
      'component-security',
      'ls-electric',
      'standards',
      'cra',
      'cyber-resilience-act',
      'eu-regulation',
      'ce-marking',
      'sbom',
      'automotive',
      'ecu',
      'medical-device-security',
      'iec62304',
      'iso14971',
      'mfds',
    ],
  },
  {
    collection: 'IoT & firmware',
    tags: [
      'iot',
      'firmware',
      'firmware-update',
      'embedded',
      'router',
      'routeros',
      'mikrotik',
      'binwalk',
      'rauc',
      'wps',
      'bootrom',
      'hardware-security',
    ],
  },
  {
    collection: 'Web security',
    tags: [
      'web',
      'web-security',
      'xss',
      'command-injection',
      'http',
      'http2',
      'h2c',
      'request-smuggling',
      'smuggling',
      'desync',
      'cl.te',
      'te.cl',
      'proxy',
    ],
  },
  {
    collection: 'AI & LLM security',
    tags: [
      'llm',
      'ai-agents',
      'ai-security',
      'anti-llm',
      'agent-memory',
      'multi-agent-systems',
      'sub-agents',
      'mcp',
      'a2a',
      'rag',
      'retrieval',
      'embeddings',
      'voltagent',
      'aixcc',
      'crs',
      'completion-bias',
      'interoperability',
    ],
  },
  {
    collection: 'Malware analysis',
    tags: [
      'malware',
      'ransomware',
      'ryuk',
      'hermes',
      'anubis',
      'stealer',
      'token-stealing',
      'banking-trojan',
      'lazarus',
      'wannacry',
      'ir',
    ],
  },
  {
    collection: 'Fuzzing & program analysis',
    tags: [
      'fuzzing',
      'afl',
      'asan',
      'boofuzz',
      'grammar-fuzzing',
      'coverage-guided',
      'harness',
      'robustness-testing',
      'symbolic-execution',
      'angr',
      'static-analysis',
      'binary-analysis',
      'bindiff',
      'binary-ninja',
      'ida',
      'reverse-engineering',
      'reversing',
      'dynamic-analysis',
      'bug-finding',
    ],
  },
  {
    collection: 'Kernel & binary exploitation',
    tags: [
      'kernel',
      'linux',
      'windows',
      'driver',
      'hevd',
      'privilege-escalation',
      'pwn',
      'rop',
      'ret2zp',
      'binary-exploitation',
      'exploitation',
      'exploit',
      'heap',
      'uaf',
      'oob',
      'buffer-overflow',
      'stack-buffer-overflow',
      'shellcode',
      'got',
      'plt',
      'aarch64',
      'arm',
      'arm32',
      'arm64',
      'ppc-vle',
      'tricore',
      'jit',
      'v8',
      'chrome',
      'browser-exploitation',
      'type-confusion',
      'wasm',
      'javascript',
      'smb',
      'ms17-010',
      'eternalblue',
      'checkm8',
      'ios',
      'iphone',
      'jailbreak',
      'pe32',
      'ffmpeg',
      'xpdf',
      'filesystem',
    ],
  },
]

export function collectionFor(tags: string[]): Collection {
  for (const rule of rules) {
    if (rule.tags.some((t) => tags.includes(t))) return rule.collection
  }
  return 'Archive'
}
