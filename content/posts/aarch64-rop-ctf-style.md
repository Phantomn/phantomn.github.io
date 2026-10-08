---
title: 'Doing ROP on AArch64: CTF Style'
date: 2020-02-10T00:00:00.000Z
excerpt: 'A hands-on look at the AArch64 calling convention, Link Register control, and ROP chain construction for CTF-style exploitation'
tags:
  - aarch64
  - arm64
  - rop
  - pwn
  - ctf
  - exploit
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Introduction

This is a record of practicing AArch64 ROP starting entirely from an x86/x64 background.

We had barely touched any architecture other than x86/x64. Since we had no AArch64 exploitation experience at all, even finding relevant documentation was difficult. The methods and techniques we used may not be the best, but we learned a lot along the way.

### AArch64 Basics

Before getting into the challenge, let's take a quick look at the basic concepts.

#### Registers

AArch64 has 31 general-purpose registers, x0~x30. Since it is a 64-bit architecture, every register is 64 bits. However, using the `w` prefix (e.g. w0, w1) lets you access the lower 32 bits of each register.

There is also a 32nd register called `xzr`, or the zero register. It serves many purposes, but in certain situations it acts as an alias for `sp` (the stack pointer).

#### Basic Instructions

**mov instruction:**
```assembly
mov x0, x1      ; move the value of x1 into x0
mov x1, 0x4141  ; move the immediate value 0x4141 into x1
```

**str/ldr instructions (Store and Load Register):**
Store or load a register at a given pointer location.
```assembly
str x0, [x29]   ; store x0 at the address x29
ldr x0, [x29]   ; load the value at address x29 into x0

stp/ldp - store/load a register pair
stp x29, x30, [sp]  ; store x29 at sp and x30 at sp+8
```

**bl/blr instructions (Branch Link):**
Similar to x86's `call`. They jump to a subroutine and store the return address in x30 (the Link Register).
```assembly
blr x0  ; call the subroutine at the address stored in x0
```

**b/br instructions (Branch):**
Similar to x86's `jmp`. They perform an unconditional jump.
```assembly
br x0   ; jump to the address stored in x0
```

**ret instruction:**
On x86 the return address is on the stack, but AArch64's `ret` finds the return address in the x30 register and jumps to it.

#### Indexing Modes

Unlike x86, AArch64's load/store instructions support three modes of offset indexing.

**Direct offset:** `[base, #offset]` - index the offset directly without modifying base
```assembly
ldr x0, [sp, 0x10]  ; load the value at address sp+0x10 into x0
```

**Pre-indexed:** `[base, #offset]!` - same as direct offset, but base + offset is written back into base
```assembly
ldr x0, [sp, 0x10]! ; load the value at sp+0x10 into x0, then increase sp by 0x10
```

**Post-indexed:** `[base], #offset` - use base as is, then write base + offset back into base
```assembly
ldr x0, [sp], 0x10  ; load the value at sp into x0, then increase sp by 0x10
```

#### Stack and Calling Convention

**Registers x0~x7 are used to pass parameters to a subroutine.** Additional parameters are passed on the stack.

**The return address is stored in x30** (also called LR). However, on nested subroutine calls it is preserved on the stack.

**The x29 register (FP - Frame Pointer)** corresponds to x86's ebp. All local variables on the stack are accessed relative to x29, and just like on x86 it holds a pointer to the previous stack frame.

There is one interesting difference. On x86, ebp always sits at the bottom of the current stack frame, with the return address located right below it. On AArch64, however, x29 (together with the preserved x30) is stored at the top of the stack, and the local variables sit below it. Compared to x86, the arrangement is reversed.

## The Challenge

The challenge runs in an Ubuntu 18.04 AArch64 environment inside a chroot.

The challenge binary, libc, and a placeholder flag file are provided together. Because it is a chroot environment, you cannot get a shell and must execute an open/read/write ROP chain.

First you have to set up the environment. You need to download an AArch64 Ubuntu server image, since ARM does not run on an ordinary VM. Your only options are to emulate it with QEMU or use an ARM64 EC2 instance. If AWS isn't convenient, you can also run it directly by matching the lib paths.

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

The challenge shows a note prompt that's familiar from heap challenges. A bit of poking reveals an integer underflow in the alloc function, which in turn causes a heap overflow in the edit function.

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

If you enter 0 for len in alloc, a valid heap chunk is allocated but it tries to read -1 bytes. Because read uses unsigned semantics, -1 becomes 0xffffffffffffffff, which is too large to read and causes an error.

When the read error occurs, the return value (-1) is stored in the size member of the global chunk struct. In the edit function, size is used as an unsigned short, so -1 becomes 0xffff and an overflow occurs.

This post focuses on ROP, and since the heap on AArch64 works almost identically to x86, the heap exploitation part is only summarized.

- Since there is no `free()`, we overwrite the size of the freed top_chunk on the next allocation to trigger a leak
- The server uses libc 2.27, so we can leverage tcache, which makes arbitrary allocation easier. We achieve this by overwriting the top_chunk's FD
- First we leak the libc address, use it to obtain a chunk near the environment to leak a stack address, and finally allocate a chunk near the return address (the saved x30) to write the ROP chain

### Part 2 - The ROP Chain

Now we move on to the interesting part: finding gadgets. How do you find ROP gadgets on AArch64?

Fortunately, ropper supports AArch64. But what kinds of gadgets exist on AArch64, and how can we use them?

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
[... many gadgets ...]
```

Most of these gadgets are useless, because `ret` depends on the x30 register. The address held in x30 is where `ret` returns when it executes. Unless a gadget changes x30 in a way we can control, we cannot continue control flow.

Therefore, to execute a ROP chain on AArch64, you can only use gadgets that satisfy all of the following conditions:

- Perform the functionality we want
- Pop x30 from the stack
- Execute `ret`

The heap exploit could only allocate 0x98 chunks of space, and a full open/read/write chain needs more space than that. So in the second stage, we first had to read additional ROP chain data.

One way is to call `gets(stack_address)`. This lets us write a ROP chain of arbitrary length onto the stack without newlines.

How do we call `gets()`? It's a libc function, and we already have a libc leak.

What we need is to put the address of gets into x30 and a stack address into x0 (function parameters are passed in x0~x7).

The gadget found while hunting:

```
0x00062554: ldr x0, [x29, #0x18]; ldp x29, x30, [sp], #0x20; ret;

load the value at x29+0x18 into x0; load x29 and x30 from sp and sp += 0x20
```

In essence, this gadget loads the value at `x29 + 0x18` into x0, then pops x29 and x30 from the top of the stack (`ldp from sp` is equivalent to a pop, with sp += 0x20 in post-indexed fashion).

In almost all gadgets, most loads/stores are performed relative to x29. So we need to control x29 properly.

Viewing the stack state right before the first gadget executes, from the perspective of the alloc function epilogue:

![AArch64 ROP stack layout](/images/blog/aarch64-rop-ctf-style/Untitled.png)

We pop x29 and x30 from the stack and jump to the first gadget. Since we control x29, we also control x0.

Why controlling x29 leads to controlling x0 becomes clear when you look at the prologue of the gets function:

```c
<_IO_gets>:    stp    x29, x30, [sp, #-48]!
<_IO_gets+4>:    mov    x29, sp
```

During normal execution it assumes the return address is in x30, so it tries to preserve it on the stack together with x29.

But since we arrived via `ret`, x30 holds its own address.

If this state persists, at the end of gets it pops the preserved x30 and loops back into gets infinitely.

## Key Takeaways

**AArch64 ROP exploitation is fundamentally different from x86/x64:**

1. **The Link Register (x30) is central** - unlike x86 where the return address is on the stack, x30 must be carefully managed throughout every gadget chain
2. **The stack frame layout is reversed** - x29 and the preserved x30 are usually stored at the top of the stack, with local variables below them (the opposite of x86)
3. **Usable gadgets are limited** - most gadgets don't provide controllable x30 manipulation and are therefore useless
4. **Mastering the calling convention is essential** - you must set the x0~x7 parameters correctly, and controlling x29 often leads indirectly to controlling x0 via a gadget
5. **A two-stage chain** - space constraints may force you to secure a larger buffer with an initial exploit (via gets) and then write the full ROP chain in a second stage
6. **Understanding post-indexing is essential** - you must grasp the exact `[sp], #offset` semantics to analyze gadgets

This CTF challenge is a good illustration that successful AArch64 ROP exploitation requires a deep understanding of the architecture's unique characteristics, especially the Link Register mechanism and the stack layout differences from x86.
