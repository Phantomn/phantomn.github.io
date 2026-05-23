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

![](/images/writeups/konjuuni-gifted-pwnable2/untitled.png)

12시간 기다리란다.

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%201.png)

파일에 대한 정보, 32비트 ELF바이너리이며, NX가 걸려있다.

디버거로 파일을 살펴보면

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%202.png)

Sleep 이 걸려있고 인자는 0x67d, 십진수로 1661이다. 저거언제기달려... 위의 아스키 보면 플래그일거같은데 아니었다.

![](/images/writeups/konjuuni-gifted-pwnable2/untitled%203.png)

간단한 디코드도 가능하지만 디버거에서 0x90으로 덮어써주면

flag를 기다리지 않고 출력할 수 있게 만들어준다.
