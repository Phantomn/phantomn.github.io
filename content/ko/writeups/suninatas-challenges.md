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

## Suninatas Forensics 14

![](/images/writeups/suninatas-challenges/forensics14-untitled.png)

파일을 다운받으면 evidence.tar 파일이 있는데 압축을 풀면 passwd, shadow 파일이 나온다.

![](/images/writeups/suninatas-challenges/forensics14-untitled%201.png)

딱 봐도 패스워드 크랙처럼 보여서 john the ripper를 돌렸다.

그럼 일단 passwd 파일과 shadow 파일을 보자.

![](/images/writeups/suninatas-challenges/forensics14-untitled%202.png)

passwd 내용을 보면 ":"으로 구분자가 지어져 있는데 설명은 다음과 같다

suninatas:x:1001:1001::/home/suninatas:/bin/sh

① 필드 1 : 사용자명

② 필드 2 : 패스워드(/etc/shadow 파일에 암호화되어 있음)

③ 필드 3 : 사용자 계정 uid

④ 필드 4 : 사용자 계정 gid

⑤ 필드 5 : 사용자 계정 이름(정보)

⑥ 필드 6 : 사용자 계정 홈 디렉토리

⑦ 필드 7 : 사용자 계정 로그인 쉘

출처: [https://webdir.tistory.com/129](https://webdir.tistory.com/129) [WEBDIR]

패스워드는 암호화되어 shadow 파일에 담기는데 shadow 파일도 보도록 하자

![](/images/writeups/suninatas-challenges/forensics14-untitled%203.png)

suninatas:$6$QlRlqGhj$BZoS9PuMMRHZZXz1Gde99W01u3kD9nP/zYtl8O2dsshdnwsJT/1lZXsLar8asQZpqTAioiey4rKVpsLm/bqrX/:15427:0:99999:7:::

① 필드 1 : 사용자명

② 필드 2 : 패스워드

③ 필드 3 : 패스워드 파일 최종 수정일

④ 필드 4 : 패스워드 변경 최소일

⑤ 필드 5 : 패스워드 변경 최대일

⑥ 필드 6 : 패스워드 만료 경고기간

⑦ 필드 7 : 패스워드 파기 기간(패스워드 파기후 게정 비활성 기간)

⑧ 필드 8 : 계정 만료 기간

⑨ 필드 9 : 예약 필드

출처: [https://webdir.tistory.com/129](https://webdir.tistory.com/129) [WEBDIR]

패스워드가 암호화 되어있는것을 볼 수 있다.

$6$ 이라고 되어 있는 것은 sha-512암호화를 사용 했다는 것이다. 암호화에따라 $사이 숫자가 다르다.

이 두 파일을 가지고 john the ripper를 돌리면 패스워드를 추출할 수 있다.

![](/images/writeups/suninatas-challenges/forensics14-untitled%204.png)

---

## Suninatas Forensics 15

![](/images/writeups/suninatas-challenges/forensics15-untitled.png)

아래 링크를 클릭하면 mp3 파일을 다운 받을 수 있다.

처음엔 mp3 파일에 스테가노 그래피로 다른 파일을 숨긴줄 알았다.

기초 분석을 안하고 잘못짚었던 문제중 하나다.

파일의 속성에 들어가보면 바로 플래그가 있더라

---

## Suninatas Forensics 18

![](/images/writeups/suninatas-challenges/forensics18-untitled.png)

암호 문제이다. 숫자가 127을 넘지 않는것을 보니 아스키값 같고 A~F가 보이지 않으니 10진수인것같다.

아마 아스키 값을 문자로 출력하면 풀리는문제인 것 같다.

![](/images/writeups/suninatas-challenges/forensics18-untitled%201.png)

코드를 간단히 짜고 출력했더니 문자가 나오긴 했다. 근데 플래그라고 보기엔 암호화가 되어있는것 같다.

![](/images/writeups/suninatas-challenges/forensics18-untitled%202.png)

문자를 한번 디코드를 싹다 돌려봐야겠다.

![](/images/writeups/suninatas-challenges/forensics18-untitled%203.png)

base64로 돌리니 플래그가 나왔다!!

---

## Simple Login

![](/images/writeups/suninatas-challenges/simple-login-untitled.png)

32비트 바이너리익고 Canary와 NX가 있다고 한다. 근데 IDA에서는 카나리를 찾지 못했다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%201.png)

카나리가 없어보인다. 아직 능력의 부족인걸지도.

소스를 분석해보자면 우선 v6을 0으로 30바이트 만큼 초기화한다.

그리고 v6에 30바이트 만큼을 입력받는다.

input은 전역변수같은데 12바이트 만큼을 0으로 초기화한다.

그리고 v6을 base64로 디코드했을때의 길이값이 12바이트보다 크면 프로그램이 꺼지고 아니라면 input에 복사해 auth 함수를 진행하고 return 값이 1이면 correct를 실행하고 프로그램은 끝난다.

그럼... auth함수와 correct 함수를 분석해보자.

![](/images/writeups/suninatas-challenges/simple-login-untitled%202.png)

메인에서 v7변수를 인자로 받아오는데 base64디코딩한 길이값이다. 그러므로 a1은 12이다.

auth함수에선 input을 v4에 복사하고 calc_md5 함수를 한 값과 f87cd601aa7fedca99018a8be88eda34 해쉬가 같으면 correct함수를 리턴한다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%203.png)

correct함수에서는 input이 0xdeadbeef 이면 쉘을 얻을 수 있다.

요약 :

1. 30바이트 만큼 입력을 받아 base64 디코드했을때 길이 값이 12바이트여야한다. f87cd601aa7fedca99018a8be88eda34와 md5 해쉬가 같아야 한다.
2. input 값은 0xdeadbeef 값이어야 한다.

자 이제 시작해봅시다.

---

아 나는 정말 빡대가리인가보다

이 문제를 풀때 input에는 0xdeadbeef가 들어 있어야 한다.

그리고 함수에서 base64decode한 값이 deadbeef 여야 한다는 것은 인코딩 된 값이 들어가야 한다는 것이다.

그러므로 input변수는 12바이트이니 AAAABBBBCCCC를 base64로 인코딩 해서 값을 입력한다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%204.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%205.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%206.png)

ebp가 CCCC로 손상되었다. 디코드했을시에 CCCC이다. 3번째 부분을 조절하면 함수 에필로그를 통해 ebp를 컨트롤할 수 있다. 그렇다면

두번째 부분에 주소값을 넣는다면 leave에서 변조된 값이 ebp로 들어오고 ret명령을 통해 원하는 곳으로 갈 수 있게 되지 않을까?

원하는 곳이라면 correct 함수이다. auth에서 변조가 일어나고 correct 함수만 실행하면 된다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%207.png)

이제 그럼 correct주소를 넣은 곳의 주소값만 알면 될거같다.

근데 이 변수는 input변수이고 +4한 값만 집어넣어주면 된다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%208.png)

![](/images/writeups/suninatas-challenges/simple-login-untitled%209.png)

에러가난다 왜일까??

이유는 leave명령시에 ebp를 esp에 가져오고 +4하기 때문이다.

그러니 원래 input의 주소인 40을 넣으면 익스가 된다.

![](/images/writeups/suninatas-challenges/simple-login-untitled%2010.png)
