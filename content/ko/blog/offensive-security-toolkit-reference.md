---
title: "Offensive Security Toolkit: Quick Reference for Binary Exploitation & Firmware Analysis"
date: 2022-03-08
description: "Practical reference for binary exploitation and firmware analysis workflows: shellcode extraction, libc /bin/sh lookup, compilation flags for pwn challenges, BinDiff setup, binwalk/sasquatch fixes, and AFL crash triage."
tags: ["binary-exploitation", "firmware", "AFL", "IDA", "BinDiff", "binwalk", "shellcode", "pwn", "toolkit"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

A working reference for recurring tasks in binary exploitation and firmware security research. Accumulated from real workflows during CTF competitions and vulnerability research.

---

## Shellcode Extraction via objdump

Extract raw opcodes from a compiled ELF — useful when writing custom shellcode in assembly.

**Build:**
```bash
as -o shell.o shell.s && ld -o shell shell.o && objdump -d shell
```

**Extract opcodes without `\x` prefix:**
```bash
objdump -d ./shell \
  | grep '[0-9a-f]:' \
  | grep -v 'file' \
  | cut -f2 -d: \
  | cut -f1-6 -d' ' \
  | tr -s ' ' \
  | tr '\t' ' ' \
  | sed 's/ $//g' \
  | sed 's/ /\\x/g' \
  | paste -d '' -s \
  | sed 's/^/"/' \
  | sed 's/$/"/g'
```

**Extract with `\x` prefix (C string format):**
```bash
objdump -d ./shell \
  | grep '[0-9a-f]:' \
  | grep -v 'file' \
  | cut -f2 -d: \
  | cut -f1-6 -d' ' \
  | tr -s ' ' | tr '\t' ' ' \
  | sed 's/ $//g' \
  | sed 's/ /\\x/g' \
  | paste -d '' -s \
  | sed 's/^/"/' \
  | sed 's/$/"/g'
```

---

## Finding `/bin/sh` Address in libc

When you have a `system()` call and need to pass `/bin/sh`, locate the string offset relative to `system`:

```bash
# Step 1: find the /bin/sh string offset in libc
strings -tx libc.so.6 | grep /bin/sh
# → 0x1b3e1a /bin/sh

# Step 2: find system() address in libc (via gdb)
gdb -q libc.so.6 -ex "p system" -ex "quit"
# → $1 = {<text variable, no debug info>} 0x453a0 <__libc_system>

# Step 3: compute offset delta
addr_offset = 0x1b3e1a - 0x453a0   # /bin/sh VA - system VA

# Step 4: at runtime, once you have the system() leak address:
# binsh_addr = leaked_system_addr + addr_offset
```

In pwntools:

```python
from pwn import *

libc = ELF("libc.so.6")
binsh_offset = next(libc.search(b"/bin/sh"))
system_offset = libc.sym["system"]
delta = binsh_offset - system_offset

# At runtime after leaking system address:
system_leak  = <leaked_value>
binsh_addr   = system_leak + delta
```

---

## Compilation Flags for Pwn Challenges

Disable mitigations when building vulnerable binaries for training:

**x86 (32-bit):**
```bash
gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -no-pie -o vuln vuln.c
```

**x86-64:**
```bash
gcc -fno-stack-protector -mpreferred-stack-boundary=4 -z execstack -no-pie -o vuln vuln.c
```

**ARM (32-bit):**
```bash
gcc -fno-stack-protector -z execstack -fno-pie -o vuln vuln.c
```

**ARM64 / AArch64:**
```bash
gcc -fno-stack-protector -z execstack -no-pie -o vuln vuln.c
# or with clang:
clang -fno-stack-protector -z execstack -o vuln vuln.c
```

| Flag | Effect |
|------|--------|
| `-fno-stack-protector` | Disable stack canary |
| `-z execstack` | Make stack executable (disable NX) |
| `-no-pie` | Disable ASLR on the binary itself |
| `-m32` | Compile as 32-bit on x86-64 host |

---

## BinDiff Installation on Windows (IDA Pro)

BinDiff is a binary diffing plugin for IDA Pro — essential for patch diffing (comparing patched vs. unpatched binaries to locate vulnerability fixes).

**Requirements:**
- IDA Pro (with Hex-Rays)
- BinDiff installer ([zynamics.com/software.html](https://www.zynamics.com/software.html))
- Java Runtime Environment (latest)

**Common issues on Windows:**

**Error: "Can't start disassembler. Please set correct path in the main settings first."**

BinDiff hardcodes the IDA executable name as `idaq.exe`. If your IDA installation uses a different name:
```
Rename: <IDA_DIR>\ida.exe → <IDA_DIR>\idaq.exe
```

**BinDiff differ not launching:**

The differ component expects a 64-bit binary named `differ64.exe`:
```
Rename: <BINDIFF_DIR>\differ.exe → <BINDIFF_DIR>\differ64.exe
```

**Path mismatch during installation:**

The installer defaults to an IDA version-specific path (e.g., `IDA 7.x`). Change it to match your actual IDA installation directory.

---

## binwalk + sasquatch: LZMA Header Conflict Fix

When building sasquatch (extended squashfs extractor) from source, conflicting `LZMA.h` headers cause build failures.

**Symptoms:**
```
error: redefinition of 'struct LZMADecoder'
```

**Fix:**
```bash
# Step 1: rename conflicting headers
cd LZMA/lzmadaptive/C/7zip/Compress/LZMA/
mv LZMA.h LZMA2.h

cd LZMA/lzmalt/
mv LZMA3.h LZMA3.h   # rename appropriately

# Step 2: update #include directives in affected files
nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMADecoder.h
# Change: #include "LZMA.h" → #include "LZMA2.h"

nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMAEncoder.h
# Change: #include "LZMA.h" → #include "LZMA2.h"

nano LZMA/lzmalt/LZMADecoder.h
# Change: #include "LZMA.h" → #include "LZMA3.h"

# Step 3: rebuild and install
make clean && make && make install
sudo cp sasquatch /usr/bin/sasquatch
```

**Verify:**
```bash
binwalk -e firmware.bin   # should now extract squashfs with LZMA compression
```

---

## AFL Crash Triage Script

After an AFL fuzzing run, triage all crash inputs to identify unique bugs:

```bash
#!/bin/bash

for file in $HOME/fuzzing_dact/afl_out/default/crashes/*; do
    echo "Input: $file" >> $HOME/fuzzing_dact/crash.log
    $HOME/fuzzing_dact/install/bin/dact -dcf "$file" \
        2>> $HOME/fuzzing_dact/crash.log
done
```

Adapt `dact -dcf` to your target binary and arguments. Redirect stderr to capture ASan/crash output. Review `crash.log` to group crashes by stack trace signature.

For automated deduplication:
```bash
# Run each crash through the target with ASan, collect unique stack traces
for f in afl_out/default/crashes/id:*; do
    ./target_asan "$f" 2>&1 | grep -A5 "SUMMARY:" >> crashes_summary.txt
done
sort -u crashes_summary.txt > unique_crashes.txt
```
