---
title: "Reversing.kr: Easy Series Writeups"
date: 2019-06-01
description: "Reversing.kr 이지 시리즈 풀이: Easy CrackMe, Easy ELF, Easy Keygen, Easy Unpack, Replace 문제를 정적/동적 분석으로 해결"
tags: ["reversing", "Reversing.kr", "crackme", "IDA", "GDB", "wargame"]
platform: "wargame"
category: "reversing"
difficulty: "easy"
categories: ["CTF"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Easy CrackMe

### 개요

포너블과 취약점 분석을 더 잘하기 위해 리버싱을 다시 시작하게 됐다. 첫 번째 문제는 Easy_CrackMe다.

32비트 Windows PE (C++)로 패커 없이 컴파일되었다. 실행하면 키를 입력받는 다이얼로그가 표시되고, "Correct" 또는 "Incorrect"를 출력한다.

### 분석

PEID로 확인하면 C++로 작성된 바이너리임을 알 수 있다.

Immunity Debugger에서 "Incorrect Password" 문자열을 추적하면 분기문을 찾을 수 있다. 위로 올라가 분기 조건을 역추적하면 입력 함수 아래에서부터 비교값과 루프가 보인다.

조건을 분석하면:
- 첫 번째 비교: 입력값의 첫 번째 바이트와 `0x45` (`'E'`) 비교
- 두 번째 비교: 다음 값과 `0x61` (`'a'`) 비교
- 세 번째 비교: 그 다음 배열과 `"5y"` 비교
- 네 번째 비교: 루프 안에서 한 바이트씩 `"R3versing"`과 비교 (EAX와 ESI를 한 바이트씩 떼어 비교, 맞으면 2씩 증가)

이것들을 순서대로 연결하면 플래그가 나온다.

IDA Hex-Rays로 디컴파일하면 간단한 if문 구조가 보인다.

**Flag:** `Ea5yR3versing`

---

## Easy ELF

### 개요

32비트 Linux ELF, stripped(심볼 제거)로 GDB에서 함수명을 직접 확인할 수 없다. 바이너리는 입력을 받아 "Correct" 또는 "Wrong"을 출력한다.

### 분석

GDB로 디버깅하려 했는데 `file` 명령으로 보니 stripped 상태여서 IDA로 분석했다.

IDA에서 main 함수를 보면 xor 비교 함수가 있다. 조건을 정리하면:

```
char data[5];

data[0] = data[0] ^ 0x34
data[1] == '1'
data[2] = data[2] ^ 0x32
data[3] = data[3] ^ 0x88
data[4] == 'X'
data[5] == NULL
data[2] == '|'(0x7C)
data[0] == 'x'  →  data[3] == 0xDD
```

`x1|X` + (null)을 입력한다고 가정하면:

```
data[0] = 0x78 ^ 0x34 = 'L'
data[1] = '1'
data[2] = 0x7C ^ 0x32 = 'N'
data[3] = 0xDD ^ 0x88 = 'U'
data[4] = 'X'
```

각 XOR 키와 기대 출력 바이트가 정적으로 고정되어 있으므로, XOR을 역으로 계산해 입력값을 복원할 수 있다.

**Flag:** `L1NUX`

---

## Easy Keygen

### 개요

시리얼/이름 쌍을 맞추는 문제다. 패커나 난독화 없이 컴파일되었다. 주어진 시리얼 `5B 13 49 77 13 5E 7D 13`에 해당하는 이름을 찾아야 한다.

### 분석

IDA에서 분석하면 키젠 알고리즘이 이름의 각 문자를 순환 키 `{0x10, 0x20, 0x30}`으로 XOR한다는 것을 알 수 있다:

```
serial[i] = name[i] ^ key[i % 3]
```

where `key = {0x10, 0x20, 0x30}`.

시리얼 `5B 13 49 77 13 5E 7D 13`은 8바이트이므로 이름도 8자다. XOR을 역으로 계산:

```
name[i] = serial[i] ^ key[i % 3]
```

| i | serial | key  | name char |
|---|--------|------|-----------|
| 0 | 0x5B   | 0x10 | `K`       |
| 1 | 0x13   | 0x20 | `3`       |
| 2 | 0x49   | 0x30 | `y`       |
| 3 | 0x77   | 0x10 | `g`       |
| 4 | 0x13   | 0x20 | `3`       |
| 5 | 0x5E   | 0x30 | `n`       |
| 6 | 0x7D   | 0x10 | `m`       |
| 7 | 0x13   | 0x20 | `3`       |

**Name:** `K3yg3nm3`

---

## Easy Unpack

### 개요

패킹된 Windows PE의 OEP(Original Entry Point)를 찾는 문제다. 표준 UPX 같은 패커가 아닌 커스텀 패커로 보인다.

### 분석

IDA에서 열면 엔트리 포인트가 길고 난독화된 스텁으로 시작한다. 정적 분석만으로는 부족하고 OllyDbg / x64dbg로 동적 분석이 필요하다.

**언패킹 루프 구조:**

1. **루프 1** — `JMP` 기반 루프로 `JE` 조건이 충족되면 `0x40A0C3`로 점프. 해당 주소에 브레이크포인트 설정.

2. **루프 2** — `VirtualProtect`와 `GetProcAddress`로 API 주소를 해결. `JNZ` 조건이 빠져나갈 때까지 계속하고 이후에 브레이크포인트 설정.

3. **루프 3** — `LoadLibraryA`로 필요한 DLL을 로드. `JE` 조건 충족 시 루프 종료. `0x40A13E`에 브레이크포인트 설정.

4. **루프 4** — 가장 바깥쪽 라이브러리 로딩 루프. 하단의 `JNZ`가 모든 임포트 해결까지 반복.

모든 루프가 완료되면 raw 바이트처럼 보이는 영역으로 점프하는 `JMP`에 도달한다. 디버거의 **Analysis → Analyze Code** 기능으로 해당 영역을 분석하면 함수 프롤로그/에필로그가 나타나 OEP를 찾을 수 있다.

**OEP:** `0x00401150`

---

## Replace

### 개요

32비트 Windows PE (C++), 패커 없음. UI에서 숫자만 입력 가능하고, 값을 입력해 Check를 누르면 프로그램이 크래시된다. 조건을 충족하는 올바른 숫자 입력을 찾아야 한다.

### 분석

IDA에서 `DialogFunc`가 `GetDlgItemInt`로 숫자 입력을 읽은 후 `sub_4066F`로 전달한다. 이 함수는 값 `0x619060EB`를 주소 `0x406016`에 쓰고, `현재_주소 + 5`로 점프한다. 이것이 런타임 자기 수정 코드(self-modifying code)다.

실행 흐름을 따라가면 "Correct" 메시지로 이어진다. 입력값 자체가 플래그다. Immunity Debugger에서 패칭 지점에 브레이크포인트를 설정해 런타임 동작을 분석하면 조건을 충족하는 숫자값을 찾을 수 있다.

패치는 이후 비교가 성공하도록 하는 명령을 작성하며, 그 입력값이 답이다.

**Flag:** `3`
