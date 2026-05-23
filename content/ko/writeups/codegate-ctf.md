---
title: "Codegate CTF Writeup 모음"
date: "2023-08-27"
description: "Codegate CTF 문제 풀이 모음 — 2014 Nuclear, 2018 PreQual RedVelvet"
tags: ["pwn", "rev", "ctf", "codegate"]
platform: "ctf"
category: "redteam"
difficulty: "Medium"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## CodeGate 2014 Nuclear WriteUp

![](/images/writeups/codegate-ctf/nuclear-untitled.jpg)

32bit 바이너리이며 NX가 걸려있다. 다행히 카나리는 없다.

메인 함수에서 1129 포트로 바인드하고 subroutine 함수를 실행한다.

![](/images/writeups/codegate-ctf/nuclear-untitled%201.jpg)

사용되는 변수들이다.

---

## CodeGate 2018 PreQual RedVelvet(Rev)

# 파일 개요

![](/images/writeups/codegate-ctf/redvelvet-untitled.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%201.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%202.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%203.jpg)

간단히 설명하자면 문제는 func1() 부터 func15()까지 모두 통과하면 flag를 출력해주는 문제이다.

위에 저장된 hash가 변조되면 안된다.

![](/images/writeups/codegate-ctf/redvelvet-untitled%204.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%205.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%206.jpg)

이런 함수가 1번부터 15번까지 있는데 모두 통과해야한다.

angr, z3 등 Symbolic Execution을 하는 도구를 사용해서 풀라는 소리같다.

이번년도 4월 당시에 예선을 할때는 이런 도구를 몰라서 손수 풀었었다.

손수 풀면 이런 코드들이 나온다.

![](/images/writeups/codegate-ctf/redvelvet-untitled%207.jpg)

![](/images/writeups/codegate-ctf/redvelvet-untitled%208.jpg)

Symbolic Execution 도구를 사용하면 훨씬 편해진다

Symbolic Execution이란 반복적인 시뮬레이션을 통해 여러개의 분기(if문)을 타면서 프로그램의 흐름을 분석합니다.

이 기술은 많은 반복 행위를 해야하는 작업에 상당히 많은 이득(?)을 제공합니다.
