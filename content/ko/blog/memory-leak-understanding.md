---
title: "Memory Leak에 대한 개인적인 이해"
date: "2020-12-09"
description: "카나리(SSP) 우회를 위한 메모리 릭 기법 3가지 — Null Byte 없는 변수 연결, ROP, SSP 값 판단"
tags: ["pwn", "memory-leak", "canary", "rop", "stack"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

카나리(SSP)를 공부하면서 메모리 릭을 공부하기 시작했다. cd80님의 "memory leak techniques" 문서를 기반으로 개인적으로 이해한 내용을 정리한다.

## 메모리 릭 방법 3가지

1. 변수와 변수가 NULL Byte 없이 이어져 문자열 출력 함수에서 이어진 변수를 모두 출력하는 방법
2. ROP 기법으로 메모리를 읽어 출력하는 방법
3. 프로그램의 작동으로 값을 판단하는 방법 (SSP)

---

## 방법 1 — Null Byte 없는 변수 연결

### 빌드

```bash
gcc -o ./server ./server.c -fno-stack-protector -O0
```

### 취약 구조

간단한 chat 서버 프로그램을 예시로 사용한다. 서버 실행 후 터미널에서 접속하면 입력한 문자열을 `recv`로 받아 `snprintf`로 응답한다.

IDA 분석 결과:

```
buf:           bp-0x122
secretmessage: bp-0x22
거리:          0x100 (256 bytes)
입력 가능 크기: 256 bytes
```

`recv` 함수는 데이터를 받은 뒤 버퍼 뒤에 Null Byte를 추가하지 않는다. 따라서 256개의 `A`를 보내면 `buf`를 채우고 Null 없이 바로 `secretmessage`까지 이어진다.

`snprintf`는 다음 Null Byte까지 출력하므로 `You leaked my memory!` 문자열까지 모두 출력된다.

**결과**: `buf`와 `secretmessage` 변수 모두 출력됨.

이 패턴의 실전 예시: CodeGate 2014 Angry_doraemon

### 핵심 원리

```
[ buf (256 bytes) ][ secretmessage ][ ... ]
       ^A*256→          ^leak 발생
```

`recv`가 Null을 추가하지 않으므로 `snprintf`가 다음 변수까지 읽어 출력한다.
