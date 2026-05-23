---
title: "공주대 영재원 pwnable2 Writeup"
date: "2023-08-27"
description: "공주대 영재원 pwnable2 문제 — Sleep NOP 패치로 플래그 즉시 출력"
tags: ["pwn", "patching", "sleep", "linux", "ctf"]
platform: "ctf"
category: "redteam"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## 문제

32-bit ELF 바이너리, NX 적용.

## 분석

디버거로 파일을 분석하면 `Sleep` 함수 호출이 존재하며 인자가 `0x67D`(십진수 1661)이다. 1661초(약 28분)를 대기해야 플래그가 출력된다.

바이너리에 아스키 형태의 플래그처럼 보이는 값이 있지만 실제 플래그가 아니었다.

## 풀이 — Sleep NOP 패치

디버거에서 `Sleep` 호출 부분을 `0x90`(NOP)으로 덮어쓰면 대기 없이 플래그를 즉시 출력할 수 있다.

```
# 대기 시간 없이 즉시 flag 출력
Sleep 호출 → NOP(0x90)으로 패치
```

실행하면 Sleep을 건너뛰고 플래그 출력 루틴이 바로 실행된다.
