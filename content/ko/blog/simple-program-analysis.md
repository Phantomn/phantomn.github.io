---
title: "간단한 프로그램 분석 — x86 어셈블리 입문"
date: "2020-12-09"
description: "Hello World, 덧셈, 계산기 프로그램을 GDB로 디버깅하며 x86 어셈블리 패턴을 이해하는 과정"
tags: ["reversing", "x86", "assembly", "gdb", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

컴파일 옵션은 다음과 같다

gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o

![](/images/blog/simple-program-analysis/untitled.png)

Hello World 프로그램이다 아주 간단하다 디버깅을 해보도록 하자.

![](/images/blog/simple-program-analysis/untitled%201.png)

먼저 함수 프롤로그로 ebp를 저장하고 esp를 ebp에 저장한다.

그리고 printf의 인자로 0x80484b0주소가 push되고 printf함수를 call 한다. 인자가 1개일 경우 puts 함수로 대체되는것으로 보인다.

함수 종료 후 add명령어로 스택을 정리해주고 아래 mov eax, 0x0은 위의 C언어 코드에서 return 0으로 보인다.

함수 에필로그로

pop ebp

mov esp, ebp 로 SFP로 돌아간 후 ret명령어로 종료한다.

![](/images/blog/simple-program-analysis/untitled%202.png)

더하기 프로그램이다. 역시 디버깅을 해보도록 하자.

![](/images/blog/simple-program-analysis/untitled%203.png)

함수 프롤로그 이후 0x8의 공간을 확장하고 변수 두개를 받습니다.

ebp-0x4에 0x5라는 값을 저장하고 ebp-0x8에 0xa(10)을 저장합니다.

값을 저장한후 2개의 레지스터에 값을 복사하고 add연산으로 덧셈연산을 하고 첫번째 operand에 저장합니다. 대부분 eax에 값을 저장합니다.

결과 값인 eax를 push하고 ebp-0x8, ebp-0x4를 push한다 그리고 마지막으로 문자열을 push하고 printf함수를 call한다

함수의 인자를 넣을때는 바깥부분의 인자부터 push를 한다. 이것을 C언어로 변형해보면

printf("%d + %d = %d\n",ebp-0x4, ebp-0x8, eax) 이렇게 되고 eax는 위에서 말했듯이 add연산의 결과값이다.

그렇게 함수가 종료되고 사용한 공간인 0x10을 add로 스택을 축소시킨다. push명령을 4번했으니 0x10(16)을 줄이는 것이다.

그리고 함수 에필로그 후 ret명령으로 main함수가 종료된다.

![](/images/blog/simple-program-analysis/untitled%204.png)

마지막 계산기 프로그램이다. 디버깅 해보자

![](/images/blog/simple-program-analysis/untitled%205.png)

0xC(12)의 공간을 확장하고 0x8, 0x9, 0x4의 주소와 문자열을 push 후 scanf 함수를 실행한다.

0xC만큼 확장한 것은 x86은 4 Byte 단위로 포인터가 이동하기 때문에 그리고 효율적인 접근을 위해 0xC만큼 확장한 것이다.

scanf함수를 실행 후 0x10만큼의 공간을 정리한다. 이유는 마지막에 문자열 부분도 push되었기 때문에 총 0x10만큼의 공간을 사용했다.

그 후 0x8과 0x9에 있는 값을 각각의 레지스터에 옮기고 eax에 저장된 것을 다시 edx로 옮긴다, 그리고 다시 eax에 0x4에 있는 값을 옮긴다.

또 다시 같은 방식으로 레지스터를 push하고 calc 함수를 call한다.

![](/images/blog/simple-program-analysis/untitled%206.png)

함수 프롤로그 후 ebp+0xc의 값을 eax에 옮긴다.

calc+6지점에 bp를걸고 실행해봤다.

![](/images/blog/simple-program-analysis/untitled%207.png)

![](/images/blog/simple-program-analysis/untitled%208.png)

ebp+0xc에는 0x2b라는 값이 들어있었다. 이걸 아스키 코드로 바꾸면 '+' 문자가 된다.

그 값을 eax에 저장하고 분기문으로 간다.

![](/images/blog/simple-program-analysis/untitled%209.png)

이 사진을 좀더 이해하기 쉽게 바꿔봤다.

![](/images/blog/simple-program-analysis/untitled%2010.png)

이렇게 분기가 끝나고 각 연산은 다음과 같이 진행된다.

![](/images/blog/simple-program-analysis/untitled%2011.png)

먼저 각 변수가 eax에 들어가게 되고 곱하기연산에서는 imul명령어가 쓰였다.

0x8에는 1이들어가 있고 0x10에는 2가들어가있다 그 둘을 곱해서 eax에 저장한다.

그리고 나누기연산에서는 cdq라는 명령어가 끼어있는데 이것은 Convert DoubleWord to QuadWord라는 명령어다.

더블워드에서 쿼드로, 8에서 16으로 변경한다는것인데..부동 소수점연산이라그런걸까? 자세히는 모르겠다.

각 연산이 끝나고 사용공간을 정리한 후에 함수의 끝부분인 calc+160으로 jmp해서 함수를 종료하며 main함수로 돌아온다.

![](/images/blog/simple-program-analysis/untitled%2012.png)

돌아온 후 3개의 인자를 사용한 공간을 정리하고 main함수를 종료한다.
