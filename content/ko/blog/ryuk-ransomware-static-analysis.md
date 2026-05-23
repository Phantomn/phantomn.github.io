---
title: "Static Analysis of Ryuk Ransomware Samples (Hermes Variant)"
date: 2022-03-04
description: "Static reverse engineering of two 32-bit PE binaries identified as Ryuk ransomware (Hermes variant): a dropper/loader and the main encryption payload. Analysis covers persistence, process injection, and VSS deletion."
tags: ["malware", "ransomware", "Ryuk", "Hermes", "reverse-engineering", "PE32", "static-analysis", "Windows"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

**Samples**: Two 32-bit PE binaries (Sample1, Sample2)  
**Tools**: IDA Pro, x32dbg, HxD  
**Identification**: Ryuk ransomware — Hermes variant (per ESTsecurity blog)

---

## Overview

Two 32-bit PE binaries were received for analysis. Sample1 functions as a **dropper/loader** — it fingerprints the environment, drops an embedded payload to disk, and establishes persistence. Sample2 is the **main ransomware** binary that performs encryption, kills shadow copies, and drops the ransom note.

---

## Sample 1: Dropper / Loader

### Execution Flow

**1. Environment Fingerprinting**

```cpp
GetModuleFileName(NULL, Filename, MAX_PATH);
// → C:\Users\Phantom\Desktop\Samples\sample1

memset(&VersionInformation, 0, sizeof(OSVERSIONINFO));
VersionInformation.dwOSVersionInfoSize = 276;
GetVersionEx(&VersionInformation);
GetWindowsDirectory(Buffer, MAX_PATH);
// → C:\Windows
```

`GetVersionEx` retrieves the OS major version. If `dwMajorVersion == 5` (Windows XP/2003), the payload is dropped to the Windows directory. Otherwise (Vista+), it targets `C:\Users\Public\`.

**2. Random Filename Generation**

```cpp
srand(GetTickCount());
// Generate 5 random alphabetic characters
for (i = 0; i < 5; i++) {
    name[i] = 'A' + (rand() % 26);
}
strcat(name, ".exe");
// Result: e.g., "RSmEa.exe"
// Full path: "C:\Users\Public\RSmEa.exe"
CreateFile(full_path, GENERIC_WRITE, ...);
```

The generated filename is random on each execution, making static detection based on filename patterns ineffective.

**3. Architecture Detection**

```cpp
HMODULE k32 = LoadLibrary("kernel32.dll");
FARPROC isWow64 = GetProcAddress(k32, "IsWow64Process");
IsWow64Process(GetCurrentProcess(), &isWow64Result);
FreeLibrary(k32);
```

The binary checks whether it is running under WOW64 (32-bit on 64-bit OS) to select the appropriate embedded PE format — PE32 for 32-bit, PE32+ for 64-bit targets.

**4. Embedded Payload Drop**

The selected PE header bytes are written to the random-named file via `WriteFile`. This pattern of carrying an embedded binary (PE-in-PE) and writing it out at runtime is characteristic of multi-stage droppers.

**5. Execution**

```cpp
ShellExecute(NULL, "open", "C:\\Users\\Public\\RSmEa.exe", NULL, NULL, SW_SHOW);
```

After execution of Sample1, the following artifacts were observed:
- `RukeREADME.txt` created on the desktop
- Files in the working directory encrypted

---

## Sample 1 (Inner Payload): Persistence Module

The embedded binary dropped by Sample1 handles **persistence** and **process injection**.

### Registry Run Key Persistence

```
C:\Windows\System32\cmd.exe /C REG ADD 
"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
/v "svchos" /t REG_SZ
/d "C:\Users\phantom\Desktop\Samples\sample1_part.exe"
/f
```

The payload registers itself under the `Run` key with the name `svchos` — mimicking the legitimate `svchost.exe` service name.

### Process Injection Pattern

```cpp
// Enumerate all running processes
// Find self (sample1_part.exe) in process list
// For each matching process: Alloc → Write → Execute → Free
// Exclude: csrss.exe, explorer.exe, lsass.exe
```

Standard process injection via `VirtualAllocEx` / `WriteProcessMemory` / `CreateRemoteThread`. The exclusion list of critical system processes is common in ransomware to avoid crashing the system before encryption completes.

**Final action**: Creates a `.sys` file in `C:\Users\Public\` and exits.

---

## Sample 2: Ryuk Ransomware (Main Binary)

Sample2 is the primary ransomware component. An embedded IP address is visible in the binary — cross-referenced against threat intelligence, this matches **Ryuk**, identified by ESTsecurity as a **Hermes ransomware variant**.

### Initialization

```cpp
// sub_403FB0: dynamic import resolution
// Loads required DLLs and caches function pointers via GetProcAddress
// Avoids static import table entries for AV evasion
```

The initialization routine resolves API addresses dynamically, a common anti-analysis technique.

### Anti-Analysis Exit

```cpp
// Creates batch file + winlogon.exe artifact
// Calls exit() — forces early termination on first run
```

On first execution, the binary exits early after setup. The actual encryption logic runs on a subsequent execution or via process injection, making dynamic analysis without breakpoints ineffective.

### Encryption Routine

```cpp
// XOR-based byte generation:
for (i = 0; i < length; i++) {
    output[i] = input[i] ^ key[i % key_len];
}
```

A second encryption function operates on file data. The exact algorithm was not fully reversed during this analysis — the XOR layer is likely a key-wrapping step, with RSA or AES used for file content encryption (consistent with Hermes/Ryuk behavior).

### Shadow Copy Deletion

```cpp
ShellExecute(NULL, "open", "cmd.exe",
    "/C vssadmin Delete Shadows /all /quiet",
    NULL, SW_HIDE);
```

Deleting Volume Shadow Copies (`vssadmin Delete Shadows /all /quiet`) prevents file recovery via Windows backup. This is a signature behavior of Ryuk/Hermes and many other ransomware families.

### Ransom Note Drop

```cpp
// Creates shortcut/link pointing to RukeREADME.txt
// Displays README on user desktop
```

---

## Summary

| | Sample 1 | Sample 1 (inner) | Sample 2 |
|--|----------|-----------------|----------|
| Role | Dropper | Persistence | Ransomware |
| Key behavior | Random filename, arch detection, PE drop | Registry Run key, process injection | Encryption, VSS deletion, ransom note |
| Anti-analysis | Embedded PE-in-PE | Excludes csrss/explorer/lsass | Dynamic imports, early exit |

The two samples work in coordination: Sample1 prepares the environment and drops the payload; Sample2 performs the actual encryption and data destruction.

**Key indicators of compromise:**
- Registry key `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` → `svchos`
- File `C:\Users\Public\<5-random-chars>.exe`
- `vssadmin Delete Shadows /all /quiet` execution
- Files with a `.RYK` extension and `RukeREADME.txt` ransom note

---

## References

- [ESTsecurity — Hermes Ransomware Analysis](https://blog.alyac.co.kr/)
- [FireEye — RYUK Ransomware Technical Analysis](https://www.fireeye.com/blog/threat-research/2019/01/a-nasty-trick-from-credential-theft-malware-to-business-disruption.html)
