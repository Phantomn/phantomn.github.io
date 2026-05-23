---
title: "ROP-ing on AArch64: The CTF Style"
date: 2020-02-10
description: "AArch64 calling conventions, link register abuse, and ROP chain construction for CTF-style exploitation"
tags: ["AArch64", "ARM64", "ROP", "pwn", "CTF", "exploit"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Introduction

This is a practical exercise in performing ROP exploitation on AArch64, coming entirely from an x86/x64 background.

We are people who have not touched anything outside of x86/x64 exploitation. Since none of us had previous experience exploiting AArch64, we couldn't find much documentation on how to approach it. The methods and techniques we used are probably not the best practices, but we learned a lot in the process.

### AArch64 Basics

Before diving into the challenge, let's quickly review the fundamentals. I'll do my best to explain everything to the extent of my understanding.

#### Registers

AArch64 has 31 general-purpose registers, x0 through x30. Since it's a 64-bit architecture, all registers are 64 bits. However, you can access the lower 32 bits of registers using the w prefix (e.g., w0, w1).

There's also a 32nd register known as the zero register (xzr or zero). This serves multiple purposes but in certain contexts is used as sp (stack pointer), with sp being an alias to it.

#### Basic Instructions

**mov instruction:**
```assembly
mov x0, x1      ; Move value from x1 to x0
mov x1, 0x4141  ; Move immediate value 0x4141 to x1
```

**str/ldr instructions (Store and Load Register):**
These fundamentally store and load registers at a given pointer location.
```assembly
str x0, [x29]   ; Store x0 to address in x29
ldr x0, [x29]   ; Load value from address in x29 to x0

stp/ldp - store/load a pair of registers
stp x29, x30, [sp]  ; Store x29 to sp, x30 to sp+8
```

**bl/blr instructions (Branch Link):**
Similar to call in x86, these jump to a subroutine and store the return address in x30 (Link Register).
```assembly
blr x0  ; Call subroutine at address in x0
```

**b/br instructions (Branch):**
Similar to jmp in x86, these perform unconditional jumps.
```assembly
br x0   ; Jump to address in x0
```

**ret instruction:**
Unlike x86 where the return address is on the stack, AArch64's ret instruction retrieves the return address from the x30 register.

#### Indexing Modes

Unlike x86, AArch64's load/store instructions support three different indexing modes for offsets:

**Direct offset:** `[base, #offset]` - Index offset directly without modifying the base
```assembly
ldr x0, [sp, 0x10]  ; Load from sp+0x10
```

**Pre-indexed:** `[base, #offset]!` - Same as direct offset, except base + offset is written back to base
```assembly
ldr x0, [sp, 0x10]! ; Load from sp+0x10, then increment sp by 0x10
```

**Post-indexed:** `[base], #offset` - Use base directly, then write base + offset back to base
```assembly
ldr x0, [sp], 0x10  ; Load from sp, then increment sp by 0x10
```

#### Stack and Calling Conventions

**Registers x0 through x7 are used to pass parameters to subroutines.** Additional parameters are passed on the stack.

**The return address is stored in x30** (also called LR - Link Register), but during nested subroutine calls it is preserved on the stack.

**The x29 register (also called FP - Frame Pointer)** is equivalent to ebp in x86. All local variables in the stack are accessed relative to x29, and like x86, it holds a pointer to the previous stack frame.

One interesting difference is that in x86, ebp is always at the bottom of the current stack frame with ret right below it. However, in AArch64, x29 appears to be stored at an optimal location relative to local variables. In minimal test cases, it's always stored at the top of the stack (with the preserved x30), and local variables below it—essentially the opposite layout compared to x86.

## The Challenge

The challenge runs on Ubuntu 18.04 AArch64 in a chrooted environment.

The challenge binary is provided along with its libc and a placeholder flag file. Since the challenge runs in a chroot, we cannot obtain a shell, so we must execute an open/read/write ROP chain.

The first requirement is setting up the environment. You need to download an AArch64 Ubuntu server image. Unfortunately, ARM doesn't run on typical VMs, so your options are limited to emulating with QEMU or using an ARM64 EC2 instance. Since AWS is out of reach, we can match the library paths and execute directly:

```bash
➜  lib git:(master) ✗ ls
ld-linux-aarch64.so.1  libc.so.6

➜  lib git:(master) ✗ pwd
/root/ctf/ctf-writeups/2019/insomnihack-teaser-2019/nyanc/challenge/lib

export CTF_HOME=/root/ctf/ctf-writeups/2019/insomnihack-teaser-2019/nyanc/challenge
export LD_LIBRARY_PATH=$CTF_HOME/lib
➜  challenge git:(master) ✗ source ~/.profile
```

After this setup, the binary runs naturally.

### Part 1 - The Heap Vulnerability

```
Not Yet Another Note Challenge...
====== menu ======
1. alloc
2. view
3. edit
4. delete
5. quit
```

A familiar note challenge prompt appears. A quick exploration reveals an integer underflow in the alloc function, leading to heap overflow in the edit function.

```c
__int64 do_add()
{
  __int64 v0;
  int v1;
  signed __int64 i;
  __int64 v4;

  for ( i = 0LL; ; ++i )
  {
    if ( i > 7 )
      return puts("no more room!");
    if ( !mchunks[i].pointer )
      break;
  }
  v0 = printf("len : ");
  v4 = read_int(v0);
  mchunks[i].pointer = malloc(v4);
  if ( !mchunks[i].pointer )
    return puts("couldn't allocate chunk");
  printf("data : ");
  v1 = read(0LL, mchunks[i].pointer, v4 - 1);
  LOWORD(mchunks[i].size) = v1;
  *(_BYTE *)(mchunks[i].pointer + v1) = 0;
  return printf("chunk %d allocated\n");
}

__int64 do_edit()
{
  __int64 v0;
  __int64 result;
  int v2;
  __int64 v3;

  v0 = printf("index : ");
  result = read_int(v0);
  v3 = result;
  if ( result >= 0 && result <= 7 )
  {
    result = LOWORD(mchunks[result].size);
    if ( LOWORD(mchunks[v3].size) )
    {
      printf("data : ");
      v2 = read(0LL, mchunks[v3].pointer, (unsigned int)LOWORD(mchunks[v3].size) - 1);
      LOWORD(mchunks[v3].size) = v2;
      result = mchunks[v3].pointer + v2;
      *(_BYTE *)result = 0;
    }
  }
  return result;
}
```

By inputting 0 as the length in alloc, a valid heap chunk is allocated but -1 bytes are read. Since the read uses unsigned semantics, -1 becomes 0xffffffffffffffff, which causes a read error.

When a read error occurs, the return value (-1 for errors) is stored in the size member of the global chunk structure. In the edit function, size is used as an unsigned short, so -1 becomes 0xffff, causing overflow.

This post focuses on ROP exploitation, and AArch64 heaps work nearly identically to x86, so we'll skip the heap exploitation details:

- Since there is no free(), we trigger a leak by overwriting the freed top_chunk size in the next allocation
- The server uses libc 2.27, which supports tcache, making arbitrary allocation easier. We can overwrite the top_chunk's FD to achieve this
- First, leak the libc address, then use it to obtain a chunk near the environment to leak a stack address, and finally allocate a chunk near the return address (saved x30 register) to write our ROP chain

### Part 2 - The ROP Chain

Now comes the interesting part: finding gadgets. How do we find ROP gadgets on AArch64?

Fortunately, ropper supports AArch64. But what types of gadgets exist on AArch64, and how do we use them?

```
➜  lib git:(master) ✗ ROPgadget --binary libc.so.6 | more
Gadgets information
============================================================
0x0000000000091ac4 : add sp, sp, #0x140 ; ret
0x00000000000bf0dc : add sp, sp, #0x150 ; ret
0x00000000000c0aa8 : add sp, sp, #0x160 ; ret
0x000000000009166c : add sp, sp, #0x20 ; csel x0, x0, x1, gt ; ret
0x0000000000082ab4 : add sp, sp, #0x20 ; ret
0x00000000000b8a18 : add sp, sp, #0x20 ; ret ; cbnz w2, #0xb8a5c ; ...
[... many more gadgets ...]
```

Most of these gadgets are useless because ret depends on the x30 register. The address in x30 is where execution returns when ret is executed. Unless a gadget modifies x30 in a way we can control, we cannot continue control flow.

Therefore, to execute a ROP chain on AArch64, we can only use gadgets that:
- Perform the functionality we want
- Pop x30 from the stack
- Execute ret

Since the heap exploit only allowed us to allocate a 0x98 chunk, and we need more space for the entire open/read/write chain, we must read additional ROP chain data in a second stage.

One way to accomplish this is to call gets(stack_address), which essentially allows us to write an arbitrary-length ROP chain to the stack (without newlines).

But how do we call gets()? It's a libc function, and we already have a libc leak.

All we need is the address of gets in x30 and a stack address in x0 (function parameters are passed in x0~x7).

Here's a gadget we hunted:

```
0x00062554: ldr x0, [x29, #0x18]; ldp x29, x30, [sp], #0x20; ret;

Loads the value at x29+0x18 into x0, then loads x29 and x30 from the stack and increments sp by 0x20
```

Essentially, this gadget loads x0 from x29 + 0x18, then pops x29 and x30 from the stack (ldp from sp is equivalent to a pop, followed by sp += 0x20 for post-indexed addressing).

In almost all gadgets, most load/store operations are performed relative to x29, so we must control it properly.

Here's how the stack looks just before executing the first gadget, as seen from the alloc function epilogue:

![AArch64 ROP Stack Layout](/images/blog/aarch64-rop-ctf-style/Untitled.png)

We pop x29 and x30 from the stack and jump to the first gadget. Since we control x29, we control x0.

Why does this matter? Look at the prologue of the gets function:

```c
<_IO_gets>:    stp    x29, x30, [sp, #-48]!
<_IO_gets+4>:    mov    x29, sp
```

The return address is assumed to be in x30 (during normal execution), so it's preserved on the stack with x29.

Unfortunately, since we arrived with ret, x30 contains its own address.

If this continues, at the end of gets, the preserved x30 is popped, and we jump back to gets in an infinite loop.

## Key Takeaways

**AArch64 ROP exploitation differs fundamentally from x86/x64:**

1. **Link Register (x30) is critical** - Unlike x86 where return addresses sit on the stack, x30 must be carefully managed in every gadget chain
2. **Stack frame layout is inverted** - x29 and preserved x30 typically appear at the top of the stack, with local variables below (opposite of x86)
3. **Limited gadget usefulness** - Most gadgets are useless because they don't provide controlled x30 manipulation
4. **Calling convention awareness** - Parameters x0-x7 must be properly set; control of x29 often indirectly controls x0 through gadgets
5. **Two-stage chains** - Space limitations may require initial exploitation to allocate a larger buffer (via gets), then writing the full ROP chain in the second stage
6. **Post-indexed addressing** - Understanding `[sp], #offset` semantics is crucial for gadget analysis

The CTF challenge demonstrates that successful AArch64 ROP exploitation requires deep understanding of the architecture's unique features, particularly the link register mechanism and stack layout differences from x86.
