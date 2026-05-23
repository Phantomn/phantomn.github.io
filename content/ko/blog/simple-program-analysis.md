---
title: "간단한 프로그램 분析 — x86 어셈블리 입문"
date: "2020-12-09"
description: "Hello World, 덧셈, 계산기 프로그램을 GDB로 디버깅하며 x86 어셈블리 패턴을 이해하는 과정"
tags: ["reversing", "x86", "assembly", "gdb", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

컴파일 옵션:

```bash
gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o <output> <source>
```

## Hello World 프로그램

가장 간단한 Hello World 프로그램을 GDB로 디버깅한다.

함수 프롤로그로 `ebp`를 저장하고 `esp`를 `ebp`에 복사한다. `printf`의 인자로 문자열 주소(0x80484b0)를 `push`하고 `printf`를 `call`한다. 인자가 1개일 경우 컴파일러가 `puts`로 최적화하기도 한다.

함수 종료 후 `add`로 스택을 정리하고, `mov eax, 0x0`은 `return 0`에 해당한다. 함수 에필로그로 `pop ebp` → `ret`으로 종료한다.

## 덧셈 프로그램

```
0xC(12) 공간 확장 → 두 변수(ebp-0x4 = 5, ebp-0x8 = 10) 저장
→ 레지스터에 복사 → add 연산 → eax에 결과 저장
→ eax, 두 피연산자, 문자열 push → printf 호출
```

인자는 C언어 코드 기준 바깥부터 push한다. 즉 `printf("%d + %d = %d\n", a, b, result)`라면 `result → b → a → format_string` 순으로 push한다.

## 계산기 프로그램

계산기는 3개의 인자(연산자, 두 피연산자)를 `scanf`로 입력받은 뒤 `calc` 함수로 분기하여 계산한다.

`ebp+0xc`에는 연산자 문자가 ASCII로 저장된다(예: `+`는 0x2B). 비교 분기로 `+`, `-`, `*`, `/` 연산을 처리한다.

나누기 연산에서 `cdq`(Convert DoubleWord to QuadWord) 명령이 사용된다. 부동 소수점 관련이 아니라 `idiv` 명령 전 `edx:eax`를 준비하기 위한 부호 확장 명령이다.

각 연산 처리 후 사용 공간을 정리하고 `calc+160`으로 점프하여 함수를 종료한다.

## 정리

- 함수 인자는 바깥(오른쪽)부터 push
- `cdq`는 `idiv` 전 부호 확장 용도
- `mov eax, 0` = `return 0`
- 함수 에필로그: `pop ebp` → `ret`
