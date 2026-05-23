---
title: "CodeQL로 xpdf 취약점 분석"
date: "2023-11-04"
description: "CodeQL을 이용한 xpdf 정적 분석 데이터베이스 구성 방법"
tags: ["codeql", "static-analysis", "xpdf", "vulnerability"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

CodeQL을 이용해 xpdf의 취약점 분석을 위한 데이터베이스를 생성하는 방법을 정리한다.

## CodeQL 데이터베이스 생성

```bash
codeql database create xpdf \
  --language=cpp \
  -c "cmake -DCMAKE_BUILD_TYPE=Debug -DCMAKE_INSTALL_PREFIX=. .."
```

`--language=cpp`로 C/C++ 프로젝트를 지정하고, `-c` 옵션에 실제 빌드 커맨드를 전달한다. CodeQL은 빌드 과정을 추적하여 소스와 컴파일 정보를 데이터베이스에 저장한다.

이후 CodeQL 쿼리를 작성하여 버퍼 오버플로우, 정수 오버플로우, Use-After-Free 등의 취약점 패턴을 탐지할 수 있다.

## 관련 포스트

- [Fuzzing 101 - xpdf](/blog/fuzzing-101-xpdf)
