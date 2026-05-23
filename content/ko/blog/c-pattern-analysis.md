---
title: "간단한 C언어 패턴 분석 — if/for/while/do-while 어셈블리"
date: "2020-12-09"
description: "C언어 제어 구조(if-else, for, while, do-while)가 x86 어셈블리에서 어떻게 컴파일되는지 분석"
tags: ["reversing", "x86", "assembly", "c", "pattern", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

간단한 리버싱 패턴을 분석한 글을 적고자 한다.

우선 scanf, printf 같은것들은 생략하기로 한다.

컴파일 옵션은 다음과 같다.

gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o

--------------------if_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_elseif_else--------------------

![](/images/blog/c-pattern-analysis/untitled.png)

간단히 if ifelse else 세가지만 처리해봤다.

![](/images/blog/c-pattern-analysis/untitled%201.png)

함수 프롤로그 이후 scanf로 한개를 입력받는다. 그 후에 ebp-0x4에 있는데이터를 eax로 옮기며 분기문을 시작한다.

![](/images/blog/c-pattern-analysis/untitled%202.png)

우선 분기직전에 BP를 걸고 값을 확인했을때 0x4b를 가지고 있었다. 실수로 문자로 컨버팅했고. 10진수로는 75가 된다.

![](/images/blog/c-pattern-analysis/untitled%203.png)

0x4b(75)를 eax로 옮기고 0x59와 비교 후 작거나 같으면 점프한다. 작으니 main+46으로 점프.

![](/images/blog/c-pattern-analysis/untitled%204.png)

이번에도 0x4f와 비교후 작으면 main+77로 jmp 한다.

![](/images/blog/c-pattern-analysis/untitled%205.png)

문자열을 push하고 출력 후 main함수가 종료된다 else 부분이다.

else if 부분을 다루지 않고 분기문은 if -> else -> else if 문순으로 비교를 하는것으로 보인다.

![](/images/blog/c-pattern-analysis/untitled%206.png)

else if 문은 else 문 비교에서 0x4f와 비교하고 바로 작지 않게 되니 0x59와 연속적으로 비교를 한다. 그리고 jg에도 조건이 맞지 않게되면 아래 puts함수를 출력하게 되는것이다.

이제 대충 if-elseif-else 문의 감을 잡았으니 전체 소스를 Hand-ray 해보도록 하겠다.

![](/images/blog/c-pattern-analysis/untitled%207.png)

우리는 순서적으로 비교를 하지만 내부에서는 if -> else -> else if 순으로 처리를 하는것을 알게 되었다!

--------------------forforforforforforforforforforforforforforforforforforforfor--------------------

![](/images/blog/c-pattern-analysis/untitled%208.png)

전에 C언어 공부할때 짰던 구구단 프로그램이다.

원하는 단수 하나만 출력해주는 그런 프로그램이다.

for문의 패턴을 공부해보도록하자.

![](/images/blog/c-pattern-analysis/untitled%209.png)

![](/images/blog/c-pattern-analysis/untitled%2010.png)

scanf로 변수를 입력받고 ebp-0xc에 있는것을 eax옮긴 후 다시 ebp-0x4로 옮긴다. 그후 main+94로 이동한다.

main+94에서는 ebp-0xc에 있는 데이터를 eax에 옮기고 ebp-0x4와 비교한다.

작거나 같으면 main+44로 jmp한다.

![](/images/blog/c-pattern-analysis/untitled%2011.png)

1번.

main+44에서는 ebp-0x8에 1을 저장하고 main+84로 이동한다.

main+84에서는 ebp-0x8에 있는 값(1)과 9를 비교하고 작거나 같으면 main+53으로 jmp한다.

2번.

ebp-0x4와 ebp-0x8을 곱하고 eax에 저장, 그리고 곱셈값, 2번째 인자, 1번째인자, 문자열을넣고 출력한다.

3번.

출력이 끝나고 ebp-0x8의 값을 +1 증가시키고 9와 비교후 작거나 같으면 main+53으로 점프한다. --> ebp-0x8 증가 후 곱연산 및 출력

![](/images/blog/c-pattern-analysis/untitled%2012.png)

그렇게 2번과 3번의 루프가 끝나게 되면 ebp-0x4의 값을 1 증가시키고 ebp-0xc(입력값)을 eax에 저장 후 ebp-0x4와 비교하게 된다.

입력값(2)과 ebp-0x4(2)+1 = 3을 비교하면 3이 더 크기 때문에 eax에 0을 넣고 프로그램은 종료를 하게 된다. mov eax, 0x0은 return 0를 뜻한다.

N단을 출력하는 프로그램이었다.

음.. 전체적인 구조를 보자면 입력인자를 가장 끝에 두고 ebp-0x4, ebp-0x8에각각 값을 할당 후 안쪽 Loop를 처리하고 바깥쪽 Loop를 처리한다.

그 사이에 분기문이 존재하게 되는것이다.

이 패턴을 파악하려면 분기하면서 add와 cmp가 같이 있는 부분과, 비교값을 보고 Loop 파악을 하는것이 우선인듯 하다.

이것 역시 Hand-ray를 하면 다음처럼 보이게 된다

![](/images/blog/c-pattern-analysis/untitled%2013.png)

모의 코드이기 때문에 다시 바꿔줄 필요가 있다 for문에는 초기값, 조건부, 증감부 이렇게 세가지가 있다. 그것에 맞춰 다시 만들어 보겠다.

![](/images/blog/c-pattern-analysis/untitled%2014.png)

--------------------whilewhilewhilewhilewhilewhilewhilewhilewhilewhilewhilewhile--------------------

이번엔 while문으로 프로그램을 재작성 해보겠다.

![](/images/blog/c-pattern-analysis/untitled%2015.png)

![](/images/blog/c-pattern-analysis/untitled%2016.png)

내부적으로는 while은 큰 차이가 없는것처럼 보인다.

초기값 설정 후 맨 하단부에서 비교 , 그리고 중단부에서 값 처리, 출력 후값 증가 다시 비교 크게 다르지 않다.

이것도 Hand-ray를 하고 do_while문을 보도록 하겠다.

![](/images/blog/c-pattern-analysis/untitled%2017.png)

모의 코드는 역시 이렇고 이걸 while문의 형식으로 맞추면 이렇게 된다.

![](/images/blog/c-pattern-analysis/untitled%2018.png)

수정할것이 별로 없다.

--------------------do_whiledo_whiledo_whiledo_whiledo_whiledo_whiledo_whiledo_whiledo_while--------------------

마지막으로 do_while문이다.

![](/images/blog/c-pattern-analysis/untitled%2019.png)

![](/images/blog/c-pattern-analysis/untitled%2020.png)

Do_While문으로 짜니 비교구문이 단 두개로 줄어든다.먼저 한번 처리하고 마지막에 비교만 하면되니 디버깅에 친숙한?문법이다!!

간단하게 Hand-ray하고 마치도록 하겠다.

![](/images/blog/c-pattern-analysis/untitled%2021.png)

모의 코드는 이렇다 선 처리 후증가 후 jmp하게 된다.

이형식은 기존 반복문과는 깔끔은 하나 다르기에 기억할 필요가 있을듯 하다.

형식에 맞춰서 다시 작성해보자.

![](/images/blog/c-pattern-analysis/untitled%2022.png)

음.....do while문이 겹치게 되면 안쪽의 반복문으로만 분기하게 되어있다.

그래서 2개의 do_while문인지를 판별하려면 증감값의 개수가 1개이상이면 다중 반복문인지 의심해봐야 하고 비교문도 있다면 그건 다중 반복문이다.

간단한것같으면서도 또한 알게 된것들이 많은 패턴 연습이다 많은 패턴을 공부해야 하는데 겨우 간단한 두가지를 알았다

어떤 패턴이 더 있을지는 아직 잘 모르겠다.
