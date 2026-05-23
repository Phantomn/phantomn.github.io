---
title: "Memory Leak에 대한 개인적인 이해"
date: "2020-12-09"
description: "카나리(SSP) 우회를 위한 메모리 릭 기법 3가지 — cd80님의 memory leak techniques 기반"
tags: ["pwn", "memory-leak", "canary", "rop", "stack"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

이제 카나리(SSP)라는 메모리 보호기법을 공부하면서 memory leak에 대한걸 공부하기 시작했다.

아니 쫌 시간이 지났다.

하지만 한번 따라한것으론 이해도가 부족하고 몸에 체득하기 위해 이글을 쓴다.

이 글에서는 cd80님의 memory leak techniques라는 문서를 가지고 그걸 개인적으로 이해한 글을 쓸 것이며

조금 더 쉽게 쓰여지길 바라는 마음이다.

이 문서에서도 역시 다룰 메모리 릭 방법은 3가지이다.

1. 변수와 변수가 NULL Byte 없이 이어져 문자열 출력함수에서 이어진 변수를 모두 출력할 때
2. ROP 기법으로 메모리를 읽어 출력할 때
3. 프로그램의 작동으로 값 판단(SSP)

먼저 1번 소스를 보겠다.

아래 소스를 gcc -o ./server ./server.c -fno-stack-protector -O0으로 컴파일 해주면 된다.

간단한 chat Server 프로그램이다.

서버를 실행시키고 터미널에서 접속을 해보자.

![](/images/blog/memory-leak-understanding/untitled.png)

문자열을 입력하면 recv되어 나온다.

**변수와 변수가 널바이트없이 이어져 문자열 출력함수에서 이어진 변수를 모두 출력하는것이 첫번째 방법이다.**

IDA에서 보면 다음과 같이 나온다.

![](/images/blog/memory-leak-understanding/untitled%201.png)

buf가 bp-0x122에 있고

v9~14(secretmessage)는 4바이트 단위로 잘라져 들어가 있고 위치는 bp-0x22에 있다.

두 개의 거리는 0x100(256)이다 그리고 우리는 256만큼 입력 할 수 있다.

![](/images/blog/memory-leak-understanding/untitled%202.png)

![](/images/blog/memory-leak-understanding/untitled%203.png)

실행 결과를 보면 A를 256개를 보냈다. 허나 recv함수는 데이터를 받으면 버퍼 뒤에 널바이트를 넣는 동작을 하지 않기 때문에

snprintf함수는 바로 다음 버퍼인 You leaked my memory!에 있는 Null 전까지 출력이 되게 된다.

결국, buf와 secretmessage 변수 모두 출력이 된 셈이다.

대회문제에서 이런식으로 값을 가져오는 문제들이 있었다. - CodeGate 2014 Angry_doraemon
