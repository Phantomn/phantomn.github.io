---
title: "SUA CTF 2019 Writeup"
date: 2019-10-01
description: "SUA CTF 2019 challenge solutions covering pwn and reversing categories"
tags: ["SUA", "CTF", "pwn", "reversing"]
platform: "ctf"
category: "pwn"
difficulty: "medium"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

1점짜리 문제는 생략하겠다.

## Welcome (100 pts)

### 개요

MISC 문제다. SUA 카페(동아리 커뮤니티)에 들어가서 플래그를 찾는 문제로, 힌트로는 "임원 소개" 페이지와 "가장 어린 친구를 찾으라"는 내용이 주어졌다.

### 풀이

임원 소개 페이지를 탐색하면서 회장님 등 여러 분의 글을 확인했다. 아닌 분들은 패스.

한 멤버의 소개 글 제일 아래 부분에서 `0_5u4}`를 발견했다. 처음에 `SUA{0_5u4}`를 입력했는데 틀렸다 — 생각해보니 플래그가 `{`로 시작하지 않았다.

아직 문제가 남아 있어서 모든 글을 한 번씩 들어가봤고, 한동 씨의 글에서 또 하나를 발견했다:

```
Flag{h311
```

플래그의 앞부분이었다. 두 개를 합치면:

```
Flag{h3110_5u4}
```

**Flag:** `sua{h3110_5u4}`

---

## Enc_msg (100 pts)

### 개요

크립토 문제다. 해당 문제를 제공하던 서버가 현재 닫혀 있어 풀이 방법만 기록한다.

### 풀이

이 문제는 오히려 Crypto_3번 문제의 힌트를 보고 풀었다. Crypto_3의 힌트는 **시저 암호**였고, 바로 시저 암호 코드를 구글링해서 얻었다.

암호화된 파일(`Encrypted.txt`)과 함께 4개의 평문 참조 파일(`text1` ~ `text4`)이 제공됐다.

Python 스크립트로 1~26 사이의 모든 이동값을 시도했다:

```python
def caesar_decrypt(ciphertext, shift):
    result = ""
    for char in ciphertext:
        if char.isalpha():
            base = ord('A') if char.isupper() else ord('a')
            result += chr((ord(char) - base - shift) % 26 + base)
        else:
            result += char
    return result

with open("Encrypted.txt") as f:
    ciphertext = f.read()

for shift in range(1, 27):
    print(f"Shift {shift}: {caesar_decrypt(ciphertext, shift)}")
```

for 문으로 1~26까지 거리를 무작위로 대입해 암호문을 해독한 결과, **이동값 22**에서 참조 텍스트와 일치하는 읽을 수 있는 영어 문장이 나왔다.

**Flag:** `sua{SUA CTF Encryption}`

---

## TAXI (300 pts)

### 개요

리버싱 문제다. 바이너리에 4글자를 입력하면 출력이 `TAXI`가 나와야 한다.

### 풀이

힌트:
- **brute force**
- **4 letter**

이 두 가지 힌트가 나온 순간부터 개발 지식이 부족해 직접 손으로 브루트 포싱을 했다. 4자 조합을 체계적으로 시도하며 출력이 `TAXI`가 되는 입력을 찾았다.

정석적인 풀이는 출력 가능한 ASCII 문자의 4바이트 조합을 모두 순회하며 출력을 확인하는 스크립트를 작성하는 것이다. 바이너리의 변환 함수는 고정된 알고리즘으로 입력을 4자 출력으로 매핑한다.

내가 직접 찾은 답(빨간색)과 원래 정답(노란색) 두 개가 모두 동일한 `TAXI` 출력을 만들었다 — 변환 함수의 동작 방식으로 인한 충돌이었으며, 이것은 문제 설계상의 의도치 않은 버그였다. 그래서 두 답 모두 점수를 받을 수 있었다.

> 참고: 두 답 모두 출력이 일치했으므로 채점 시 인정됐다. 이는 문제에 여러 유효한 입력이 존재함을 보여준다.
