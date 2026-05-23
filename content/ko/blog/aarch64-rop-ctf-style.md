---
title: "AArch64에서 ROP하기: CTF 스타일"
date: 2020-02-10
description: "AArch64 호출 규약, Link Register 제어, CTF 스타일 익스플로잇을 위한 ROP 체인 구성 실습"
tags: ["AArch64", "ARM64", "ROP", "pwn", "CTF", "exploit"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 소개

이것은 완전히 x86/x64 배경에서 출발해 AArch64 ROP를 실습한 기록이다.

우리는 x86/x64 이외의 아키텍처를 거의 건드리지 않았다. AArch64 익스플로잇 경험이 전혀 없었기 때문에 관련 문서를 찾기도 어려웠다. 사용한 방법과 기술이 최선은 아닐 수 있지만, 그 과정에서 많은 것을 배웠다.

### AArch64 기초

챌린지에 들어가기 전에 기본 개념을 빠르게 살펴보자.

#### 레지스터

AArch64에는 31개의 범용 레지스터 x0~x30이 있다. 64비트 아키텍처이므로 모든 레지스터는 64비트다. 단, `w` 접두사(예: w0, w1)를 사용하면 각 레지스터의 하위 32비트에 접근할 수 있다.

`xzr` 또는 zero 레지스터라고 불리는 32번째 레지스터도 있다. 다용도로 쓰이지만 특정 상황에서는 `sp`(스택 포인터) 별칭으로 동작한다.

#### 기본 명령어

**mov 명령어:**
```assembly
mov x0, x1      ; x1의 값을 x0으로 이동
mov x1, 0x4141  ; 즉시값 0x4141을 x1로 이동
```

**str/ldr 명령어 (Store and Load Register):**
주어진 포인터 위치에서 레지스터를 저장하거나 로드한다.
```assembly
str x0, [x29]   ; x0을 x29 주소에 저장
ldr x0, [x29]   ; x29 주소의 값을 x0에 로드

stp/ldp - 레지스터 쌍 저장/로드
stp x29, x30, [sp]  ; sp에 x29를, sp+8에 x30을 저장
```

**bl/blr 명령어 (Branch Link):**
x86의 `call`과 유사하다. 서브루틴으로 점프하며 리턴 주소를 x30(Link Register)에 저장한다.
```assembly
blr x0  ; x0에 저장된 주소의 서브루틴을 호출
```

**b/br 명령어 (Branch):**
x86의 `jmp`와 유사하다. 무조건 점프를 수행한다.
```assembly
br x0   ; x0에 저장된 주소로 점프
```

**ret 명령어:**
x86에서는 리턴 주소가 스택에 있지만, AArch64의 `ret`는 x30 레지스터에서 리턴 주소를 찾아 점프한다.

#### 인덱싱 모드

x86과 달리 AArch64의 load/store 명령어는 오프셋 인덱싱을 위한 세 가지 모드를 지원한다.

**직접 오프셋 (Direct offset):** `[base, #offset]` — 오프셋을 직접 인덱스하고 base는 변경하지 않음
```assembly
ldr x0, [sp, 0x10]  ; sp+0x10 주소의 값을 x0에 로드
```

**전위 인덱스 (Pre-indexed):** `[base, #offset]!` — 직접 오프셋과 동일하지만, base + offset이 base에 다시 기록됨
```assembly
ldr x0, [sp, 0x10]! ; sp+0x10의 값을 x0에 로드한 후 sp를 0x10 증가
```

**후위 인덱스 (Post-indexed):** `[base], #offset` — base를 그대로 사용한 뒤 base + offset을 base에 기록
```assembly
ldr x0, [sp], 0x10  ; sp의 값을 x0에 로드한 후 sp를 0x10 증가
```

#### 스택과 호출 규약

**레지스터 x0~x7은 서브루틴에 파라미터를 전달하는 데 사용된다.** 추가 파라미터는 스택으로 전달된다.

**리턴 주소는 x30에 저장된다** (LR이라고도 함). 단, 중첩 서브루틴 호출 시에는 스택에 보존된다.

**x29 레지스터(FP — Frame Pointer)**는 x86의 ebp에 해당한다. 스택의 로컬 변수는 모두 x29를 기준으로 접근하며, x86과 마찬가지로 이전 스택 프레임에 대한 포인터를 보유한다.

흥미로운 차이점이 하나 있다. x86에서는 ebp가 항상 현재 스택 프레임의 하단에, 그 바로 아래에 리턴 주소가 위치한다. 그런데 AArch64에서는 x29(보존된 x30과 함께)가 스택의 상단에 저장되고, 로컬 변수들이 그 아래에 위치한다. x86과 비교해 배치가 반대다.

## 챌린지

챌린지는 Ubuntu 18.04 AArch64 환경에서 chroot로 실행된다.

챌린지 바이너리, libc, placeholder 플래그 파일이 함께 제공된다. chroot 환경이므로 쉘은 얻을 수 없고, open/read/write ROP 체인을 실행해야 한다.

첫 번째로 환경을 설정해야 한다. AArch64 우분투 서버 이미지를 다운로드해야 하는데, ARM은 일반 VM에서 돌아가지 않는다. QEMU로 에뮬레이팅하거나 ARM64 EC2 인스턴스를 사용하는 방법밖에 없다. AWS가 여의치 않다면, lib 경로를 맞춰서 직접 실행하는 방법도 있다.

```bash
➜  lib git:(master) ✗ ls
ld-linux-aarch64.so.1  libc.so.6

➜  lib git:(master) ✗ pwd
/root/ctf/ctf-writeups/2019/insomnihack-teaser-2019/nyanc/challenge/lib

export CTF_HOME=/root/ctf/ctf-writeups/2019/insomnihack-teaser-2019/nyanc/challenge
export LD_LIBRARY_PATH=$CTF_HOME/lib
➜  challenge git:(master) ✗ source ~/.profile
```

이 설정 이후에는 바이너리가 자연스럽게 실행된다.

### Part 1 - 힙 취약점

```
Not Yet Another Note Challenge...
====== menu ======
1. alloc
2. view
3. edit
4. delete
5. quit
```

힙 챌린지에서 익숙한 노트 프롬프트가 뜬다. 조금 살펴보면 alloc 함수에서 정수 언더플로가 발견되고, 이로 인해 edit 함수에서 힙 오버플로가 발생한다.

```c
__int64 do_add()
{
  __int64 v0;
  int v1;
  signed __int64 i;
  __int64 v4;

  for ( i = 0LL; ; ++i )
  {
    if ( i > 7 )
      return puts("no more room!");
    if ( !mchunks[i].pointer )
      break;
  }
  v0 = printf("len : ");
  v4 = read_int(v0);
  mchunks[i].pointer = malloc(v4);
  if ( !mchunks[i].pointer )
    return puts("couldn't allocate chunk");
  printf("data : ");
  v1 = read(0LL, mchunks[i].pointer, v4 - 1);
  LOWORD(mchunks[i].size) = v1;
  *(_BYTE *)(mchunks[i].pointer + v1) = 0;
  return printf("chunk %d allocated\n");
}

__int64 do_edit()
{
  __int64 v0;
  __int64 result;
  int v2;
  __int64 v3;

  v0 = printf("index : ");
  result = read_int(v0);
  v3 = result;
  if ( result >= 0 && result <= 7 )
  {
    result = LOWORD(mchunks[result].size);
    if ( LOWORD(mchunks[v3].size) )
    {
      printf("data : ");
      v2 = read(0LL, mchunks[v3].pointer, (unsigned int)LOWORD(mchunks[v3].size) - 1);
      LOWORD(mchunks[v3].size) = v2;
      result = mchunks[v3].pointer + v2;
      *(_BYTE *)result = 0;
    }
  }
  return result;
}
```

alloc에서 len으로 0을 입력하면 유효한 힙 청크가 할당되지만 -1 바이트를 읽으려 한다. read는 unsigned 의미론을 사용하므로 -1이 0xffffffffffffffff가 되어 큰 값을 읽을 수 없어 오류가 발생한다.

read 오류가 발생하면 반환값(-1)이 전역 청크 구조체의 size 멤버에 저장된다. edit 함수에서 size는 unsigned short로 사용되므로 -1은 0xffff가 되어 오버플로가 발생한다.

이 포스트는 ROP에 집중하며, AArch64의 힙은 x86과 거의 동일하게 작동하므로 힙 익스 부분은 요약만 한다.

- `free()`가 없으므로, 다음 할당 시 해제된 top_chunk의 크기를 덮어써서 leak을 트리거
- 서버가 libc 2.27을 사용하므로 tcache를 활용할 수 있어 임의 할당이 더 쉬움. top_chunk의 FD를 덮어써서 달성
- 먼저 libc 주소를 leak하고, 이를 이용해 환경 근처에서 청크를 얻어 스택 주소를 leak. 마지막으로 리턴 주소(저장된 x30) 근처에 청크를 할당해 ROP 체인 작성

### Part 2 - ROP 체인

이제 흥미로운 부분인 가젯 찾기로 넘어간다. AArch64에서 ROP 가젯을 어떻게 찾을까?

다행히 ropper는 AArch64를 지원한다. 그런데 AArch64에는 어떤 종류의 가젯이 있고, 어떻게 활용할 수 있을까?

```
➜  lib git:(master) ✗ ROPgadget --binary libc.so.6 | more
Gadgets information
============================================================
0x0000000000091ac4 : add sp, sp, #0x140 ; ret
0x00000000000bf0dc : add sp, sp, #0x150 ; ret
0x00000000000c0aa8 : add sp, sp, #0x160 ; ret
0x000000000009166c : add sp, sp, #0x20 ; csel x0, x0, x1, gt ; ret
0x0000000000082ab4 : add sp, sp, #0x20 ; ret
0x00000000000b8a18 : add sp, sp, #0x20 ; ret ; cbnz w2, #0xb8a5c ; ...
[... 많은 가젯들 ...]
```

이 가젯 대부분은 쓸모가 없다. `ret`은 x30 레지스터에 의존하기 때문이다. x30에 담긴 주소가 `ret` 실행 시 리턴되는 위치다. 가젯이 우리가 제어할 수 있는 방식으로 x30을 변경하지 않으면 Control Flow를 이어갈 수 없다.

따라서 AArch64에서 ROP 체인을 실행하려면 다음 조건을 모두 만족하는 가젯만 사용할 수 있다:

- 우리가 원하는 기능을 수행할 것
- 스택에서 x30을 pop할 것
- `ret`을 실행할 것

힙 익스로 할당 가능한 공간이 0x98 청크뿐이었고, 전체 open/read/write 체인에는 더 많은 공간이 필요했다. 따라서 두 번째 단계에서 추가 ROP 체인 데이터를 먼저 읽어야 했다.

한 가지 방법은 `gets(stack_address)`를 호출하는 것이다. 이렇게 하면 스택에 개행 없이 임의 길이의 ROP 체인을 작성할 수 있다.

`gets()`를 어떻게 호출할까? libc 함수이고 우리에게는 이미 libc leak이 있다.

필요한 것은 x30에 gets 주소를, x0에 스택 주소를 넣는 것이다 (함수 파라미터는 x0~x7로 전달된다).

헌팅해서 찾은 가젯:

```
0x00062554: ldr x0, [x29, #0x18]; ldp x29, x30, [sp], #0x20; ret;

x29+0x18의 값을 x0에 로드; sp에서 x29와 x30을 로드하고 sp += 0x20
```

본질적으로 이 가젯은 `x29 + 0x18`의 값을 x0에 로드한 뒤, 스택 상단에서 x29와 x30을 pop한다 (`ldp from sp`는 pop과 동일하며, 후위 인덱스 방식으로 sp += 0x20).

거의 모든 가젯에서 대부분의 load/store는 x29를 기준으로 수행된다. 따라서 x29를 제대로 제어해야 한다.

첫 번째 가젯 실행 직전 스택 상태를 alloc 함수 에필로그 관점에서 보면:

![AArch64 ROP 스택 레이아웃](/images/blog/aarch64-rop-ctf-style/Untitled.png)

스택에서 x29와 x30을 팝하고 첫 번째 가젯으로 점프한다. x29를 제어하므로 x0도 제어한다.

왜 x29 제어가 x0 제어로 이어지냐면, gets 함수의 프롤로그를 보면 알 수 있다:

```c
<_IO_gets>:    stp    x29, x30, [sp, #-48]!
<_IO_gets+4>:    mov    x29, sp
```

정상 실행 중에는 리턴 주소가 x30에 있다고 가정하므로 x29와 함께 스택에 보존하려 한다.

그런데 우리는 `ret`를 통해 도달했기 때문에 x30은 자기 자신의 주소를 갖고 있다.

이 상태가 계속되면 gets 끝에서 보존된 x30을 팝한 뒤 무한 루프로 다시 gets로 돌아간다.

## 핵심 교훈

**AArch64 ROP 익스플로잇은 x86/x64와 근본적으로 다르다:**

1. **Link Register (x30)가 핵심** — x86에서 리턴 주소가 스택에 있는 것과 달리, x30은 모든 가젯 체인에서 신중하게 관리해야 한다
2. **스택 프레임 레이아웃이 반대** — x29와 보존된 x30은 보통 스택 상단에 저장되고, 로컬 변수는 그 아래에 위치한다 (x86과 반대)
3. **사용 가능한 가젯이 제한적** — 대부분의 가젯은 제어 가능한 x30 조작을 제공하지 않아 쓸모없다
4. **호출 규약 숙지 필수** — x0~x7 파라미터를 올바르게 설정해야 하며, x29 제어가 종종 가젯을 통해 간접적으로 x0 제어로 이어진다
5. **2단계 체인** — 공간 제한으로 인해 초기 익스로 더 큰 버퍼를 확보(gets를 통해)한 뒤 두 번째 단계에서 전체 ROP 체인을 작성해야 할 수 있다
6. **후위 인덱스 방식 이해 필수** — `[sp], #offset` 의미론을 정확히 파악해야 가젯 분석이 가능하다

이 CTF 챌린지는 성공적인 AArch64 ROP 익스플로잇이 아키텍처 고유의 특성, 특히 Link Register 메커니즘과 x86과의 스택 레이아웃 차이에 대한 깊은 이해를 요구한다는 것을 잘 보여준다.
