---
title: "Webhacking.kr 워게임 Writeup"
date: "2023-08-27"
description: "Webhacking.kr 워게임 문제 풀이 — web-01~05"
tags: ["web", "sqli", "cookie", "php", "wargame"]
platform: "wargame"
category: "web"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## web-01

앞으로 해야할 일이 웹과 앱해킹이기 때문에 먼저 웹해킹.kr을 라이트업을 보고 따라 푼다.

그 이후 라이트업 없이 푼다.

![](/images/writeups/webhacking-kr/web-01-Untitled.png)

첫번째 문제의 보이는 것은 이게 전부이고 view-source버튼을 클릭하면 소스가 나온다.

```php
<?php
  include "../../config.php";
  if($_GET['view-source'] == 1){ view_source(); }
  if(!$_COOKIE['user_lv']){
    SetCookie("user_lv","1",time()+86400*30,"/challenge/web-01/");
    echo("<meta http-equiv=refresh content=0>");
  }
?>
```

핵심 부분:

```php
<?php
  if(!is_numeric($_COOKIE['user_lv'])) 
		$_COOKIE['user_lv']=1;
  if($_COOKIE['user_lv']>=6) 
		$_COOKIE['user_lv']=1;
  if($_COOKIE['user_lv']>5) 
		solve(1);
  echo "<br>level : {$_COOKIE['user_lv']}";
?>
```

5보다커야하고 6보다 작아야한다. 소수점?

![](/images/writeups/webhacking-kr/web-01-Untitled%201.png)

---

## web-02

![](/images/writeups/webhacking-kr/web-02-Untitled.png)

2번문제에 들어가면 이렇게 보이고 관리자 페이지를 한번 열어보자

![](/images/writeups/webhacking-kr/web-02-Untitled%201.png)

admin.php에 들어가면 궁디를 팡팡해준단다. 들어갈거다 나는.

![](/images/writeups/webhacking-kr/web-02-Untitled%202.png)

이것이 admin.php화면이고 아래는 html 소스다. 비교구문도없고...입력 칸과 제출버튼밖에 없다. 뭘 어떡하란거지... sql injection같은데 'or 1=1 같은건 통하지않는다.

웹에서 주는 데이터 중 Cookie가 있었다.

우선 웹에서 세션과 쿠키를 알아야 한다.

두 개는 비슷하지만 차이점이 있다면 세션은 서버측에 저장되어있다는 점과 쿠키는 클라이언트측에 저장되어 있다는 것이다. 그래서 클라이언트 측에 있는 사용자는 저장된 쿠키를 열어 볼 수 있다. ***하지만 서버 측에 있는 세션에 관한 정보는 클라이언트 측에서 접근 할 수 없는 영역에 있게 되어 보안에 유리하다***

이번 문제에서는 쿠키안에 PHPSESSID와 time이 있었다.

![](/images/writeups/webhacking-kr/web-02-Untitled%203.png)

time값이 날짜형식이 아닌 그...어디서봤더라 서버에서 볼법한 그런 형식이다. 그래서 변환기를 찾아 날짜를 바꿔봤다.

![](/images/writeups/webhacking-kr/web-02-Untitled%204.png)

변환하니 오늘 날짜의 시간이 나왔다. 근데 이걸로 뭐하지.... 다른 값을 넣어볼까

![](/images/writeups/webhacking-kr/web-02-Untitled%205.png)

time의 값을 1로 주었더니 2070-01-01 09:00:01초로 바뀌었다. 1970년도여야하는거아닌가..?

알아보니 2038년 문제라는 것이 있다.

![](/images/writeups/webhacking-kr/web-02-2038.gif)

32비트 정수형을 쓰는 모든 PC의 시계가 UTC 0기준으로 2038년 1월 19일 03시 14분 7초 가 지나는 순간 32비트의 모든 비트가 Carry되어 Overflow 되면서 0으로 바뀌는 문제이다.

때문에 time값을 1로 주었을때 1970이 아니라 2070으로 바뀌는것 같다. 라이트업을 봤을때 이걸로 Time Based SQLi를 하는것 같다.

---

## web-03

![](/images/writeups/webhacking-kr/web-03-Untitled.png)

처음에 이게 뭔가 싶었고 스도쿠같은건줄 알았다

근데 노노그램?이라고 나오더라  심지어 솔버까지 있다. 바로 솔버로 풀어버렸다.

![](/images/writeups/webhacking-kr/web-03-Untitled%201.png)

![](/images/writeups/webhacking-kr/web-03-Untitled%202.png)

문제를 풀면 다음 화면이 나온다. 뭔지 일단 모르겠으니 관리자 페이지를 킨다.

---

## web-04

![](/images/writeups/webhacking-kr/web-04-Untitled.png)

4번 문제는 왠지 md5일거같은 문자열과 비밀번호를 맞추는 것 같은 느낌이다.

아래 view-source버튼을 이용해 소스를 分석해보자.

```php
<?php
  sleep(1); // anti brute force
  if((isset($_SESSION['chall4'])) && ($_POST['key'] == $_SESSION['chall4'])) 
  	solve(4);
  
  $hash = rand(10000000,99999999)."salt_for_you";
  $_SESSION['chall4'] = $hash;
  for($i=0;$i<500;$i++) 
  	$hash = sha1($hash);
?>
```

메인 소스만 떼어냈다. $_SESSION['chall4'] 의 값과 key의 값이 같아야 한다.

hash는 10000000 ~ 99999999 사이의 랜덤 값과 "salt_for_you"를 붙여서 암호화 되기 전 값을 $_SESSION['chall4']에 저장하고 500번 sha1로 암호화한다.

슈발 이걸 어떻게하지 똑같이 decrypt하면 되지않을까?

첫번째로 sha1로 암호화 하기전의 hash값을 알아야 하며 두번째로 500번 암호화한 값만 알면 된다.

---

## web-05

![](/images/writeups/webhacking-kr/web-05-Untitled.png)

이번 문제는 버튼이 두개가 있다. F12를 눌러서 소스를 봐야겠다.

![](/images/writeups/webhacking-kr/web-05-Untitled%201.png)

Element에서는 move와 no라는 함수가 각 버튼에 클릭시에 실행되는걸 알았다.

![](/images/writeups/webhacking-kr/web-05-Untitled%202.png)

각 함수가 소스에 다행히 보인다.

no는 의미없어보이고 move함수가 login시에만 작동하는거같은데 경로를 보니 mem 디렉토리에 파일이 있는것 같다. 이걸 Directory or Path Traversal 취약점이라 하는건가? 잘 모르겠다. mem 디렉토리로 가보자.

![](/images/writeups/webhacking-kr/web-05-Untitled%203.png)

오 이 안에 join과 login 파일이 있다. 이것을 wget으로 가져와서 소스를 봐야겠다.
