---
title: "공격적 보안 툴킷: 바이너리 익스플로잇 & 펌웨어 분석 레퍼런스"
date: 2022-03-08
description: "바이너리 익스플로잇과 펌웨어 분석 실무 레퍼런스: 셸코드 추출, libc /bin/sh 주소 탐색, pwn 컴파일 플래그, BinDiff 설치, binwalk/sasquatch 오류 수정, AFL 크래시 트리아지."
tags: ["binary-exploitation", "firmware", "AFL", "IDA", "BinDiff", "binwalk", "shellcode", "pwn", "toolkit"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

CTF 대회와 취약점 연구 과정에서 반복적으로 사용하게 되는 바이너리 익스플로잇 및 펌웨어 보안 작업의 실무 레퍼런스를 정리한 문서다. 실제 워크플로우에서 축적된 내용이다.

---

## objdump를 이용한 셸코드 추출

어셈블리로 작성한 커스텀 셸코드를 바이트 스트림으로 추출할 때, 컴파일된 ELF에서 raw 옵코드를 뽑아내는 방법이다.

**빌드:**
```bash
as -o shell.o shell.s && ld -o shell shell.o && objdump -d shell
```

**`\x` 접두사 없이 옵코드 추출:**
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

**`\x` 접두사 포함 추출 (C 문자열 형식):**
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

## libc에서 `/bin/sh` 주소 찾기

`system()` 호출로 셸을 실행할 때 `/bin/sh` 문자열의 주소가 필요하다. `system()`의 주소를 기준으로 오프셋을 계산하는 방법이다.

```bash
# Step 1: libc 내 /bin/sh 문자열 오프셋 확인
strings -tx libc.so.6 | grep /bin/sh
# → 0x1b3e1a /bin/sh

# Step 2: libc에서 system() 주소 확인 (gdb 이용)
gdb -q libc.so.6 -ex "p system" -ex "quit"
# → $1 = {<text variable, no debug info>} 0x453a0 <__libc_system>

# Step 3: 오프셋 델타 계산
addr_offset = 0x1b3e1a - 0x453a0   # /bin/sh VA - system VA

# Step 4: 런타임에 system() 주소를 릭하면:
# binsh_addr = leaked_system_addr + addr_offset
```

pwntools로 처리하는 방법:

```python
from pwn import *

libc = ELF("libc.so.6")
binsh_offset = next(libc.search(b"/bin/sh"))
system_offset = libc.sym["system"]
delta = binsh_offset - system_offset

# 런타임에 system 주소를 릭한 후:
system_leak  = <leaked_value>
binsh_addr   = system_leak + delta
```

---

## pwn 챌린지용 컴파일 플래그

취약한 바이너리를 트레이닝 목적으로 빌드할 때 보안 완화책을 비활성화하는 플래그 모음이다.

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
# 또는 clang으로:
clang -fno-stack-protector -z execstack -o vuln vuln.c
```

| 플래그 | 효과 |
|------|--------|
| `-fno-stack-protector` | 스택 카나리 비활성화 |
| `-z execstack` | 스택 실행 가능하게 설정 (NX 비활성화) |
| `-no-pie` | 바이너리 자체의 ASLR 비활성화 |
| `-m32` | x86-64 호스트에서 32-bit으로 컴파일 |

---

## Windows에서 BinDiff 설치 (IDA Pro)

BinDiff는 IDA Pro용 바이너리 비교 플러그인으로, 패치 전후 바이너리를 비교해 취약점 수정 위치를 찾는 패치 디핑(patch diffing)에 필수적인 도구다.

**준비물:**
- IDA Pro (Hex-Rays 포함)
- BinDiff 설치 파일 ([zynamics.com/software.html](https://www.zynamics.com/software.html))
- JRE (최신 버전)

**Windows에서 자주 발생하는 오류:**

**오류: "Can't start disassembler. Please set correct path in the main settings first."**

BinDiff이 IDA 실행 파일 이름을 `idaq.exe`로 고정 참조한다. IDA 설치 디렉토리에서 파일명을 변경하면 해결된다:
```
변경: <IDA_DIR>\ida.exe → <IDA_DIR>\idaq.exe
```

**BinDiff differ가 실행되지 않는 경우:**

differ 컴포넌트가 `differ64.exe`라는 이름의 64-bit 바이너리를 찾는다:
```
변경: <BINDIFF_DIR>\differ.exe → <BINDIFF_DIR>\differ64.exe
```

**설치 경로 불일치:**

설치 시 IDA 버전별 기본 경로(예: `IDA 7.x`)로 설정되므로, 실제 IDA 설치 디렉토리와 맞게 수정해야 한다. 설치 마법사에서 경로를 직접 지정하는 것이 안전하다.

---

## binwalk + sasquatch: LZMA 헤더 충돌 수정

sasquatch(확장된 squashfs 추출기)를 소스에서 빌드할 때 `LZMA.h` 헤더 충돌로 빌드 실패가 발생한다.

**증상:**
```
error: redefinition of 'struct LZMADecoder'
```

**수정 방법:**
```bash
# Step 1: 충돌하는 헤더 파일 이름 변경
cd LZMA/lzmadaptive/C/7zip/Compress/LZMA/
mv LZMA.h LZMA2.h

cd LZMA/lzmalt/
mv LZMA.h LZMA3.h

# Step 2: 변경된 파일명으로 #include 경로 수정
nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMADecoder.h
# 변경: #include "LZMA.h" → #include "LZMA2.h"

nano LZMA/lzmadaptive/C/7zip/Compress/LZMA/LZMAEncoder.h
# 변경: #include "LZMA.h" → #include "LZMA2.h"

nano LZMA/lzmalt/LZMADecoder.h
# 변경: #include "LZMA.h" → #include "LZMA3.h"

# Step 3: 재빌드 및 설치
make clean && make && make install
sudo cp sasquatch /usr/bin/sasquatch
```

**검증:**
```bash
binwalk -e firmware.bin   # LZMA 압축 squashfs 정상 추출 확인
```

---

## AFL 크래시 트리아지 스크립트

AFL 퍼징이 끝난 후 모든 크래시 입력을 처리하여 고유한 버그를 식별하는 트리아지 스크립트다.

```bash
#!/bin/bash

for file in $HOME/fuzzing_dact/afl_out/default/crashes/*; do
    echo "Input: $file" >> $HOME/fuzzing_dact/crash.log
    $HOME/fuzzing_dact/install/bin/dact -dcf "$file" \
        2>> $HOME/fuzzing_dact/crash.log
done
```

`dact -dcf`는 분석 대상 바이너리와 인수에 맞게 수정한다. stderr를 리다이렉트하여 ASan/크래시 출력을 캡처한다. `crash.log`를 스택 트레이스 기준으로 분류해 고유 크래시를 그룹핑한다.

자동 중복 제거가 필요하다면:
```bash
# 각 크래시를 ASan 빌드된 타겟으로 실행하고 고유 스택 트레이스 수집
for f in afl_out/default/crashes/id:*; do
    ./target_asan "$f" 2>&1 | grep -A5 "SUMMARY:" >> crashes_summary.txt
done
sort -u crashes_summary.txt > unique_crashes.txt
```
