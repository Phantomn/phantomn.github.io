---
title: "alert(1) to win — XSS 챌린지"
date: "2023-08-27"
description: "alert(1) to win XSS 챌린지 풀이 — 다양한 XSS 필터 우회 기법 실습"
tags: ["web", "xss", "javascript", "portswigger"]
platform: "portswigger"
category: "web"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

[alert(1) to win](https://alf.nu/alert1)은 다양한 JavaScript 컨텍스트에서 `alert(1)`을 실행하는 XSS 챌린지다.

## WarmUp

기본적인 XSS 주입 문제. 입력값이 HTML에 그대로 반영되는 경우 `<script>alert(1)</script>` 또는 `<img src=x onerror=alert(1)>`으로 해결한다.

## Adobe (속성 컨텍스트 우회)

입력값이 HTML 속성 내에 삽입되는 경우 속성 값 탈출이 필요하다:

```html
" onmouseover="alert(1)
```

또는 다음 패턴:

```html
"><script>alert(1)</script>
```

## 핵심 학습

- HTML 컨텍스트별 XSS 주입 방법이 다르다
- 필터 우회는 인코딩, 대소문자 변환, 특수 이벤트 핸들러 활용
- `alert(1)`이 막혀있을 때 `prompt(1)`, `confirm(1)`, `alert\`1\`` 등 대안 사용
