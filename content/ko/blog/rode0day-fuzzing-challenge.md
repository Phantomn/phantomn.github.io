---
title: "Rode0day Fuzzing Challenge"
date: "2024-11-14"
description: "Fuzzing CTF인 Rode0day 참가 기록 — 진행 리포트 및 참고자료 정리"
tags: ["fuzzing", "ctf", "afl", "vulnerability-research"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

Rode0day는 일종의 Fuzzing CTF다. 주어진 바이너리에서 취약점을 찾아내는 방식으로 진행된다.

## 개요

- 형식: 바이너리 기반 Fuzzing 경진대회
- 목표: 주어진 대상 바이너리에서 충돌(crash)을 최대한 많이 발견
- 주요 도구: AFL, AFL++, libFuzzer 등

## 접근 방법

1. 대상 바이너리 파일 분석 (file, checksec)
2. 입력 포맷 파악 및 시드 코퍼스 구성
3. AFL/AFL++ 계측(instrumentation) 빌드 또는 QEMU 모드로 실행
4. 커버리지 기반 퍼징 실행 및 크래시 트리아지

## 참고

진행 상세 리포트 및 참고자료 목록은 내부 DB로 관리했다.
