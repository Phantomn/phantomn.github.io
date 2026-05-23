---
title: "Suninatas 워게임 Writeup"
date: "2023-08-27"
description: "Suninatas 워게임 문제 풀이 모음 — Forensics 14/15/18, Simple Login"
tags: ["forensics", "pwn", "wargame", "suninatas"]
platform: "wargame"
category: "redteam"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## Forensics 14 — 패스워드 크랙

`evidence.tar` 압축 해제 시 `passwd`와 `shadow` 파일이 나온다. `john the ripper`로 패스워드 크랙을 수행한다.

```bash
unshadow passwd shadow > combined
john combined
```

## Forensics 15 — MP3 메타데이터

MP3 파일을 다운로드 후 스테가노그래피를 먼저 시도했으나 아니었다. 파일 속성에 플래그가 그대로 기록되어 있었다. 기초 분析을 먼저 하는 것이 중요하다는 교훈을 얻었다.

## Forensics 18 — ASCII 디코딩

127을 넘지 않는 숫자 배열 → ASCII값으로 판단. A~F가 없어 16진수가 아닌 10진수임을 확인. 각 숫자를 ASCII 문자로 변환하면 1차 플래그가 나오지만 추가 암호화가 적용되어 있었다.

## Simple Login — Base64 + Stack BOF

32-bit 바이너리, Canary + NX 환경.

소스 흐름:
1. `v6`을 0으로 30바이트 초기화
2. `v6`에 30바이트 입력 수신
3. `input` 전역변수를 12바이트로 0 초기화
4. `v6`을 Base64 디코드한 길이가 12바이트 초과 시 BOF 발생

Base64 디코드 후 12바이트를 초과하는 값으로 스택을 덮어써서 반환 주소를 제어한다.
