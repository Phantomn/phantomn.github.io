---
title: 'Offensive Security Toolkit: Binary Exploitation & Firmware Analysis Reference'
date: 2022-03-08T00:00:00.000Z
excerpt: >-
  A practical reference for binary exploitation and firmware analysis work: extracting shellcode, finding libc /bin/sh addresses, pwn compilation flags, BinDiff
  installation, fixing binwalk/sasquatch errors, and AFL crash triage.
tags:
  - binary-exploitation
  - firmware
  - afl
  - ida
  - bindiff
  - binwalk
  - shellcode
  - pwn
  - toolkit
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

A practical reference compiling binary exploitation and firmware security tasks that come up repeatedly during CTF competitions and vulnerability research. This is content accumulated from real workflows.

---

## Extracting shellcode with objdump

When you write custom shellcode in assembly and need to extract it as a byte stream, here's how to pull the raw opcodes out of a compiled ELF.

**Build:**
```bash
as -o shell.o shell.s && ld -o shell shell.o && objdump -d shell
```

**Extract opcodes without the `\x` prefix:**
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

**Extract with the `\x` prefix (C string format):**
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

## Finding the `/bin/sh` address in libc

To spawn a shell via a `system()` call, you need the address of the `/bin/sh` string. Here's how to compute it as an offset from the address of `system()`.

```bash
# Step 1: check the offset of /bin/sh inside libc
strings -tx libc.so.6 | grep /bin/sh
# -> 0x1b3e1a /bin/sh

# Step 2: check the address of system() in libc (using gdb)
gdb -q libc.so.6 -ex "p system" -ex "quit"
# -> $1 = {<text variable, no debug info>} 0x453a0 <__libc_system>

# Step 3: compute the offset delta
addr_offset = 0x1b3e1a - 0x453a0   # /bin/sh VA - system VA

# Step 4: once you leak the system() address at runtime:
# binsh_addr = leaked_system_addr + addr_offset
```

How to handle it with pwntools:

```python
from pwn import *

libc = ELF("libc.so.6")
binsh_offset = next(libc.search(b"/bin/sh"))
system_offset = libc.sym["system"]
delta = binsh_offset - system_offset

# after leaking the system address at runtime:
system_leak  = <leaked_value>
binsh_addr   = system_leak + delta
```

---

## Compilation flags for pwn challenges

A collection of flags for disabling security mitigations when building vulnerable binaries for training purposes.

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
| `-fno-stack-protector` | Disables the stack canary |
| `-z execstack` | Makes the stack executable (disables NX) |
| `-no-pie` | Disables ASLR for the binary itself |
| `-m32` | Compiles as 32-bit on an x86-64 host |

---

## Installing BinDiff on Windows (IDA Pro)

BinDiff is a binary comparison plugin for IDA Pro, essential for patch diffing—comparing binaries before and after a patch to locate where a vulnerability was fixed.

**Prerequisites:**
- IDA Pro (with Hex-Rays)
- BinDiff installer ([zynamics.com/software.html](https://www.zynamics.com/software.html))
- JRE (latest version)

**Common errors on Windows:**

**Error: "Can't start disassembler. Please set correct path in the main settings first."**

BinDiff hardcodes a reference to the IDA executable named `idaq.exe`. This is fixed by renaming the file in the IDA install directory:
```
Rename: <IDA_DIR>\ida.exe -> <IDA_DIR>\idaq.exe
```

**When the BinDiff differ won't run:**

The differ component looks for a 64-bit binary named `differ64.exe`:
```
Rename: <BINDIFF_DIR>\differ.exe -> <BINDIFF_DIR>\differ64.exe
```

**Install path mismatch:**

The installer defaults to a per-version IDA path (e.g. `IDA 7.x`), so it needs to be corrected to match your actual IDA install directory. It's safest to specify the path directly in the install wizard.

---

## binwalk + sasquatch: fixing the LZMA header conflict

Building sasquatch (the extended squashfs extractor) from source fails due to a `LZMA.h` header conflict.

**Symptom:**
```
error: redefinition of 'struct LZMADecoder'
```

**Fix:**
```bash
# Step 1: rename the conflicting header files
cd LZMA/lzmadaptive/C/7zip/Compress/LZMA/
mv LZMA.h LZMA2.h

cd LZMA/lzmalt/
mv LZMA.h LZMA3.h

# Step 2: update the #include paths to match the renamed files
nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMADecoder.h
# change: #include "LZMA.h" -> #include "LZMA2.h"

nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMAEncoder.h
# change: #include "LZMA.h" -> #include "LZMA2.h"

nano LZMA/lzmalt/LZMADecoder.h
# change: #include "LZMA.h" -> #include "LZMA3.h"

# Step 3: rebuild and install
make clean && make && make install
sudo cp sasquatch /usr/bin/sasquatch
```

**Verify:**
```bash
binwalk -e firmware.bin   # confirm LZMA-compressed squashfs extracts correctly
```

---

## AFL crash triage script

A triage script that processes all crashing inputs after an AFL fuzzing run to identify unique bugs.

```bash
#!/bin/bash

for file in $HOME/fuzzing_dact/afl_out/default/crashes/*; do
    echo "Input: $file" >> $HOME/fuzzing_dact/crash.log
    $HOME/fuzzing_dact/install/bin/dact -dcf "$file" \
        2>> $HOME/fuzzing_dact/crash.log
done
```

Adjust `dact -dcf` to match the target binary and arguments you're analyzing. Redirect stderr to capture ASan/crash output. Group unique crashes by classifying `crash.log` on stack traces.

For automatic deduplication:
```bash
# run each crash against the ASan-built target and collect unique stack traces
for f in afl_out/default/crashes/id:*; do
    ./target_asan "$f" 2>&1 | grep -A5 "SUMMARY:" >> crashes_summary.txt
done
sort -u crashes_summary.txt > unique_crashes.txt
```
