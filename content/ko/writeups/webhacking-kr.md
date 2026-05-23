---
title: "Webhacking.kr 워게임 Writeup"
date: "2023-08-27"
description: "Webhacking.kr 워게임 문제 풀이 — web-01~05 쿠키 조작, SQL Injection, 노노그램, SHA1 해시, 디렉토리 트래버설"
tags: ["web", "sqli", "cookie", "php", "wargame"]
platform: "wargame"
category: "web"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## web-01 — 쿠키 레벨 조작

페이지를 열면 `user_lv` 쿠키가 `1`로 설정된다.

```php
if (!$_COOKIE['user_lv']) {
    SetCookie("user_lv", "1", time()+86400*30, "/challenge/web-01/");
}
```

쿠키 `user_lv` 값을 변조해 레벨을 높이면 통과한다. 브라우저 개발자 도구에서 `user_lv=6` 등으로 수정 후 새로고침.

## web-02 — 쿠키 조작으로 관리자 접근

`admin.php`에 접근하면 "궁디를 팡팡" 메시지가 나온다. SQL Injection으로는 우회가 안 된다.

서버가 쿠키를 기반으로 인증을 처리한다. 쿠키 값을 `admin`으로 변조해 관리자 권한을 얻는다.

세션: 서버 측 저장. 쿠키: 클라이언트 측 저장 → 클라이언트 측에서 수정 가능.

## web-03 — 노노그램 솔버

노노그램 퍼즐 문제다. 온라인 노노그램 솔버로 풀면 답이 나온다. 정답 입력 후 관리자 페이지를 통해 플래그를 획득한다.

## web-04 — SHA1 해시 레이스 컨디션

```php
sleep(1); // anti brute force
if (isset($_SESSION['chall4']) && $_POST['key'] == $_SESSION['chall4'])
    solve(4);

$hash = rand(10000000, 99999999) . "salt_for_you";
$_SESSION['chall4'] = $hash;
for ($i = 0; $i < 500; $i++)
    $hash = sha1($hash);
```

세션 값(500회 SHA1 해시된 값)을 `key`로 전송하면 풀린다. 문제는 서버가 응답하기 전에 세션 값을 먼저 저장한다는 점이다.

`view-source`로 응답을 받기 전에 같은 세션으로 POST를 날려 레이스 컨디션을 유발하거나, Python으로 SHA1 500회 연산 후 전송한다.

## web-05 — 디렉토리 탐색으로 소스 열람

버튼 2개(`move`, `no`) 중 `move` 함수가 `mem/` 디렉토리의 파일을 참조한다. `mem/` 디렉토리에 직접 접근하면 `join.php`와 `login.php`가 있다.

`join.php` 소스를 열람해 인증 로직을 파악하고 우회한다.
