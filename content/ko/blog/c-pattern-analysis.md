---
title: "간단한 C언어 패턴 分析 — if/for/while/do-while 어셈블리"
date: "2020-12-09"
description: "C언어 제어 구조(if-else, for, while, do-while)가 x86 어셈블리에서 어떻게 컴파일되는지 분석"
tags: ["reversing", "x86", "assembly", "c", "pattern", "beginner"]
categories: ["research"]
authors:
  - name: "Ph4nt0m"
    link: "https://github.com/Phantomn"
---

컴파일 옵션:

```bash
gcc -m32 -fno-stack-protector -mpreferred-stack-boundary=2 -z execstack -fno-pie -o <output> <source>
```

---

## if-elseif-else 패턴

`scanf`로 값을 입력받은 후 `eax`로 이동, 분기문을 시작한다.

테스트 케이스에서 0x4B(75)를 입력했을 때:

1. `cmp eax, 0x59` → 작거나 같으면 `main+46`으로 점프 (if 조건)
2. `cmp eax, 0x4F` → 작으면 `main+77`로 점프 (else 부분)
3. 조건 불일치 시 `puts`로 문자열 출력 (else if 부분)

**핵심 발견**: 어셈블리 수준에서 실제 비교 순서는 `if → else → else if` 순이다. 우리가 작성하는 코드 순서와 반대다.

Hand-ray 결과를 보면 내부적으로는 `if`를 먼저 처리하고, 다음으로 `else` 조건을 체크한 뒤, 마지막으로 `else if`에 해당하는 비교를 연속으로 수행한다.

---

## for 문 패턴 (구구단 프로그램)

N단을 출력하는 for 루프:

```
초기값 설정 → main+94로 이동
main+94: 카운터와 입력값 비교 → 조건 충족 시 main+44로 점프
main+44: 내부 카운터 초기화(1) → main+84로 이동
main+84: 카운터 9와 비교 → main+53으로 점프 (본체 실행)
main+53: 곱셈 → printf 출력 → 카운터 +1 → main+84로 복귀
```

패턴 파악 방법:
- `add`와 `cmp`가 함께 있는 부분 → Loop 증감/조건
- 비교값(여기서 9) → Loop 한계값
- 비교값이 2개 이상이면 중첩 반복문 의심

---

## while 문 패턴

while과 for는 내부적으로 큰 차이가 없다:

```
초기값 설정 → 하단에서 비교 → 본체 처리/출력 → 값 증가 → 다시 비교
```

---

## do-while 문 패턴

do-while의 특징은 비교 구문이 단 2개로 줄어든다:

```
선 처리 → 값 증가 → 비교 → (조건 충족 시) 처음으로 점프
```

일반 while/for와 달리 조건 검사 없이 한 번 먼저 실행하므로 분기 수가 적다.

**다중 do-while 식별 방법**: 증감값이 1개 이상이고 비교문이 함께 있으면 다중 반복문으로 의심한다.

---

## 정리

| 구조 | 특징 |
|------|------|
| if-else-elseif | 어셈블리 비교 순서: if → else → else if |
| for | 초기화 → 비교(말단) → 본체 → 증감 → 비교 |
| while | for와 구조 동일 |
| do-while | 비교 구문 감소, 선 실행 후 비교 |
