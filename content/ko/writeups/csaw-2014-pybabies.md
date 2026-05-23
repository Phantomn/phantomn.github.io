---
title: "CSAW CTF 2014 — Pybabies Writeup"
date: "2020-12-09"
description: "CSAW 2014 pyjail 문제 풀이: 파이썬 내장 함수를 이용한 샌드박스 탈출"
tags: ["pyjail", "python", "csaw", "ctf", "writeup"]
platform: "ctf"
category: "misc"
difficulty: "Easy"
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

오늘부터 하루에 한 문제씩이라도 풀기로 했다.

그래서 ShellStorm에서 2014년도 문제부터 골라서 풀던 도중 pyjail 문제를 보았는데 처음에는 전혀 감이 오지 않았다.

파이썬을 대충 쓰고 있는 기분이다.

## 문제 분석

문제 소스를 보면 밴되어 있는 문자열들은 쓸 수 없고, 이것으로 무한루프를 탈출하거나 `exec data`로 실행해야 하는 구조다.

## 내장 함수 활용

`targets`를 보면 `__builtins__.__dict__.keys()`가 보이는데, 이것은 `import` 없이도 사용할 수 있는 내장 함수들이다.

C 언어에서도 이와 비슷한 기능이 있는 것으로 기억한다.

파이썬의 `__builtins__` 딕셔너리를 통해 샌드박스를 우회할 수 있다:

```python
# __builtins__를 통한 내장 함수 접근
__builtins__.__dict__['__import__']('os').system('sh')
```

## 접근 방법

1. 밴된 문자열 목록 파악
2. `__builtins__.__dict__`를 통한 우회 경로 탐색
3. `exec` 또는 루프 탈출 조건 분석
