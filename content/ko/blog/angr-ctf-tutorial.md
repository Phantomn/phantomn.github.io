---
title: "CTF를 위한 Angr: 심볼릭 실행 튜토리얼"
date: 2020-01-01
description: "angr를 CTF 바이너리 분석에 활용하는 실용 가이드: 심볼릭 실행 기초, find/avoid 전략, 심볼릭 레지스터·스택 인자 설정, 크랙미 자동 풀기"
tags: ["angr", "symbolic-execution", "CTF", "binary-analysis", "Python", "automation"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## angr란?

angr는 Python 기반 바이너리 분석 프레임워크다. 정적 분석과 동적(concolic) 분석을 결합하여 다양한 리버스 엔지니어링 작업에 적용할 수 있다. Symbolic Execution 도구 중 가장 접근하기 쉬운 편이며, 주변 생태계도 활발하게 발전하고 있다.

angr를 기반으로 구축된 도구들이 수행할 수 있는 작업을 나열하면 다음과 같다:

- Control-Flow Graph 복구
- Symbolic Execution 및 제약 조건 풀이
- `angrop`을 이용한 자동 ROP 체인 생성
- `patcherex`를 이용한 자동 바이너리 강화
- `rex`를 이용한 DECREE 및 단순 리눅스 바이너리용 자동 익스플로잇 생성

angr 자체는 여러 하위 프로젝트로 구성되어 있으며, 각각 독립적으로 사용할 수 있다:

| 하위 프로젝트 | 역할 |
|---|---|
| `CLE` | 바이너리 및 라이브러리 로더 |
| `archinfo` | 아키텍처 정보 라이브러리 |
| `PyVEX` | VEX IR 리프터를 감싼 Python Wrapper |
| `Claripy` | 구체값과 심볼릭 값 간의 추상화 레이어 (Z3 백엔드) |
| `angr` | 분석 스위트 본체 |

## Symbolic Execution이란?

일반적인 프로그램 실행에서는 모든 변수가 구체적인 값을 가진다. Symbolic Execution은 미지의 입력 값을 *심볼릭 변수* — 수학적 미지수 — 로 치환하고, 각 분기에서 그 미지수에 걸리는 제약 조건을 추적한다. 이후 SMT 솔버(angr는 내부적으로 Z3를 사용한다)가 특정 경로에 도달하기 위한 구체적인 입력 값을 계산해 낸다.

다음 예제 코드를 보자:

```c
#include <stdio.h>

void main() {
    int x, y, z;
    scanf("%d %d", &x, &y);
    z = x * 2;
    if (z == 1000) {
        if (y > z)
            printf("Nice!\n");
        else
            printf("Wrong!\n");
    }
}
```

`x`를 χ, `y`를 λ로 두면 엔진은 세 가지 실행 경로를 도출한다:

1. `(χ * 2) ≠ 1000` — 조용히 종료
2. `(χ * 2) = 1000` 이고 `λ ≤ 1000` — "Wrong!" 출력
3. `(χ * 2) = 1000` 이고 `λ > 1000` — "Nice!" 출력

"Nice!"에 도달하려면 angr가 Z3에 다음 질문을 던진다: `χ * 2 = 1000` 이고 `λ > 1000`을 만족하는 χ, λ를 찾아라. 솔버는 즉시 `x = 500, y = 1001`을 반환한다.

### 알려진 한계

**Path Explosion** — 분기 수가 늘어날수록 실행 경로 수가 기하급수적으로 증가한다. 반복문이 많거나 조건이 복잡한 프로그램은 수백만 개의 상태를 생성할 수 있다. 해결 방법으로는 휴리스틱 기반 탐색, 독립 경로 병렬 처리, 경로 병합 등이 있다.

**프로그램 의존적 효용** — Symbolic Execution은 입력에 따라 서로 다른 경로를 타는 프로그램에 강하다. 대부분의 입력이 같은 경로를 사용한다면 입력별 테스트가 더 경제적일 수 있다.

**환경과의 상호작용** — 시스템 콜, 시그널 수신, 외부 I/O 등을 환경이 정확하게 모델링하지 못할 경우 일관성 문제가 발생할 수 있다.

## 설치

```bash
virtualenv -p python3.6 venv
. venv/bin/activate
pip install angr
```

이 튜토리얼에서 사용하는 바이너리는 [Angr_Tutorial_For_CTF](https://github.com/Hustcw/Angr_Tutorial_For_CTF) 레포지토리에서 가져온다:

```bash
git clone https://github.com/Hustcw/Angr_Tutorial_For_CTF.git
```

> 주의: 구버전 `path_group` API는 제거되었다. 이 튜토리얼의 모든 예제는 현행 `simgr` (simulation manager) API를 사용한다.

## Claripy: 솔버 엔진

Claripy는 angr의 Z3 SMT 솔버 추상화 레이어다. 구체값과 심볼릭 값 모두를 Abstract Syntax Tree(AST)로 표현하여, 하위 값이 고정인지 미지수인지와 무관하게 표현식을 조작할 수 있다.

### Bit-Vector

CTF에서 가장 자주 쓰이는 Claripy 타입은 bit-vector다.

```python
import claripy

# 32비트 심볼릭 비트벡터 "x" 생성
x = claripy.BVS('x', 32)
# <BV32 x_1_32>

# 0xdeadbeef 값을 가진 32비트 구체 비트벡터 생성
v = claripy.BVV(0xdeadbeef, 32)
# <BV32 0xdeadbeef>
```

`BVS(name, size)`는 심볼릭 변수를 생성하고, `BVV(value, size)`는 구체적인 값을 생성한다. 이전 `BV()` 생성자는 deprecated 되어 곧 제거될 예정이다.

유용한 bit-vector 연산:

```python
x = claripy.BVS('x', 32)

# 8비트 단위로 자르기 (MSB부터)
x.chop(8)
# [<BV8 x[31:24]>, <BV8 x[23:16]>, <BV8 x[15:8]>, <BV8 x[7:0]>]

# 빅엔디안 순서로 바이트 하나 추출
x.get_byte(0)   # <BV8 x[31:24]>  (MSB)
x.get_byte(2)   # <BV8 x[15:8]>

# 여러 바이트 추출
x.get_bytes(0, 3)  # <BV24 x[31:8]>
```

`BVS`의 주요 파라미터:

| 파라미터 | 의미 |
|---|---|
| `name` | 변수 레이블 (솔버 출력에 표시됨) |
| `size` | 비트 단위 너비 |
| `min` / `max` | 선택적 값 범위 제한 |
| `stride` | 이 값의 배수만 허용 |

### Floating-Point 심볼

```python
# 심볼릭 float
claripy.FPS('x', claripy.fp.FSORT_FLOAT)
# <FP32 FPS(FP_x_1_32, FLOAT)>

# 구체적인 double 값
claripy.FPV(3.2, claripy.fp.FSORT_DOUBLE)
# <FP64 FPV(3.2, DOUBLE)>
```

### Boolean 연산

```python
x = claripy.BVS('x', 32)
y = claripy.BVS('y', 32)

cmp = x == y
# <Bool x_2_32 == y_3_32>
```

### Solver

```python
s = claripy.Solver()
x = claripy.BVS('x', 8)

# x < 5 (unsigned) 제약 추가
s.add(claripy.ULT(x, 5))

# 최대 5개의 충족 값 반환
s.eval(x, 5)   # (0, 1, 2, 3, 4)

# 범위
s.max(x)  # 4
s.min(x)  # 0

# 조건부 표현식
y = claripy.BVV(65, 8)
z = claripy.If(x == 1, x, y)
s.eval(z, 10)  # (1, 65)
```

## angr 기본 워크플로우

모든 angr 스크립트는 다음 구조를 따른다:

```python
import angr

p = angr.Project("./binary")          # 바이너리 로드
state = p.factory.entry_state()       # 초기 프로그램 상태
sim = p.factory.simgr(state)          # 시뮬레이션 매니저 생성
sim.explore(find=GOOD_ADDR, avoid=BAD_ADDR)

if sim.found:
    solution = sim.found[0]
    print(solution.posix.dumps(0))    # 성공 경로에 도달한 stdin 값
```

`posix.dumps(0)`은 성공 상태에서 파일 디스크립터 0(stdin)에 기록된 바이트를 반환한다.

---

## Challenge 00: angr_find

이 바이너리는 각 문자를 `complex_function`으로 뒤섞어 패스워드를 검증한다. 함수의 역함수를 손으로 구하는 것도 가능하지만, 그렇게 하지 않으려고 angr를 쓰는 것이다.

```python
# 참고용 수동 풀이
string = "JACEJGCS"

def complex_function(a1, a2):
    return (3 * a2 + a1 - 65) % 26 + 65

data = ""
for i in range(len(string)):
    for j in range(0x40, 0x5a):
        if chr(complex_function(j, i)) == string[i]:
            data += chr(j)
            break
print(data)
```

angr를 쓰면 디스어셈블리에서 두 주소만 찾으면 된다:

- `0x804867d` — "Good Job" 분기
- `0x804866b` — "Try again" 분기

```python
import angr

def main():
    p = angr.Project("../problems/00_angr_find")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x804867d
    bad  = 0x804866b

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

출력:

```
flag: b'JXWVXRKX'
```

검증:

```bash
./00_angr_find
Enter the password: JXWVXRKX
Good Job.
```

핵심 포인트: 성공 출력과 실패 출력의 주소만 알면 된다. angr가 성공 경로로 향하면서 실패 경로를 피하는 입력을 자동으로 찾아준다.

---

## Challenge 01: angr_avoid

이 바이너리는 IDA Pro가 완전히 분석을 거부할 만큼 크다 — 수백 개의 중복 블록이 손으로 복제된 것처럼 보인다. angr는 처리할 수 있지만 `avoid` 집합을 신중하게 선택해야 한다.

### 첫 번째 시도: 단일 bad 주소

```python
import angr

def main():
    p = angr.Project("../problems/01_angr_avoid")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x80485b5
    bad  = 0x80485ef

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

이 코드는 `b'HUPBBPHP'`를 반환하지만 바이너리는 "Try again."으로 거부한다. 단일 `avoid` 주소만으로는 부족하다 — 바이너리에 죽은 경로(dead end)로 이어지는 `avoid_me` 함수가 따로 존재하기 때문이다.

### 두 번째 시도: avoid_me 추가

```python
good = 0x80485b5
bad  = [0x80485a8, 0x80485f7]
```

결과: `no solution found`. 아직 맞지 않는다 — `find` 주소도 수정이 필요하다. 바이너리가 처음 가정했던 것과 다른 비교 지점에서 패스워드를 검사하고 있다.

### 작동하는 풀이

GDB로 더 세밀하게 분석하면 실제 "Good Job" 위치와 모든 dead-end 경로를 파악할 수 있다:

```python
import angr

def main():
    p = angr.Project("../problems/01_angr_avoid")
    init_state = p.factory.entry_state()
    sim = p.factory.simgr(init_state)

    good = 0x80485e5
    bad  = [0x80485a8, 0x804852b, 0x80485f7]

    sim.explore(find=good, avoid=bad)

    if sim.found:
        solution = sim.found[0]
        print('flag:', solution.posix.dumps(0))
    else:
        print('no solution found')

if __name__ == '__main__':
    main()
```

출력:

```
flag: b'HUJOZMYS'
```

검증:

```bash
./01_angr_avoid
Enter the password: HUJOZMYS
Good Job.
```

### 교훈: 정확한 avoid 집합

`avoid` 파라미터는 단일 주소 또는 주소 리스트를 받는다. 확실히 실패 경로로 이어지는 주소는 모두 포함해야 한다. angr는 avoided 주소에 도달하는 순간 해당 상태를 즉시 폐기하므로, 비대한 바이너리에서 상태 공간이 극적으로 줄어들고 성능이 크게 향상된다.

`find` 주소도 신중하게 골라야 한다. "Good Job"이 여러 위치에서 출력될 수 있다. 실제로 도달하고 싶은 분기의 주소를 선택해야 한다.

---

## Challenge 02: angr_find_condition

이 문제도 "Good Job" 또는 "Try again"이 출력되는데, 중간에 `complex_function`이 존재한다.

주소를 직접 지정하는 방식 대신, 출력 문자열로 성공/실패를 판단하는 콜백 함수를 사용할 수 있다. `state.posix.dumps(sys.stdout.fileno())`로 현재 상태까지 stdout에 기록된 내용을 확인하면 된다.

```python
import angr, sys

def main():
    proj = angr.Project('../problems/02_angr_find_condition')
    init_state = proj.factory.entry_state()
    simulation = proj.factory.simgr(init_state)

    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution = simulation.found[0]
        print('flag: ', solution.posix.dumps(sys.stdin.fileno()))
    else:
        print('no flag')

def is_successful(state):
    return b"Good Job" in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b"Try again" in state.posix.dumps(sys.stdout.fileno())

if __name__ == '__main__':
    main()
```

주소를 직접 지정하는 것보다 이 방식이 더 유연하다. 바이너리 버전이 달라지거나 ASLR이 적용되어도 문자열 기반 판단은 변하지 않는다.

---

## Challenge 03: angr_symbolic_registers

이 문제는 3개의 hex 값을 입력받고 3개의 `complex_function`을 거쳐 검증한다. 3개 중 하나라도 True가 되면 실패한다.

단순히 entry_state에서 탐색해도 풀리지만, 이 문제의 핵심은 **입력 직후 지점**에서 시작하여 레지스터에 심볼릭 값을 직접 세팅하는 방법이다:

```python
import angr
import claripy
import sys

def main():
    p = angr.Project("../problems/03_angr_symbolic_registers")
    start_address = 0x8048980  # scanf 이후 지점

    init_state = p.factory.blank_state(addr=start_address)

    passwd0 = claripy.BVS('p0', 32)  # 심볼릭 비트벡터 p0
    passwd1 = claripy.BVS('p1', 32)  # 심볼릭 비트벡터 p1
    passwd2 = claripy.BVS('p2', 32)  # 심볼릭 비트벡터 p2

    init_state.regs.eax = passwd0
    init_state.regs.ebx = passwd1
    init_state.regs.edx = passwd2

    simulation = p.factory.simgr(init_state)
    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution_state = simulation.found[0]
        solution0 = solution_state.solver.eval(passwd0)
        solution1 = solution_state.solver.eval(passwd1)
        solution2 = solution_state.solver.eval(passwd2)
        print("flag: ", hex(solution0), hex(solution1), hex(solution2))
    else:
        print("no flag")

def is_successful(state):
    return b"Good Job." in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b"Try again." in state.posix.dumps(sys.stdout.fileno())

if __name__ == '__main__':
    main()
```

포인트:
- `blank_state(addr=...)`를 사용해 stdin 처리 과정을 건너뛰고 분석 시작 지점을 앞당긴다
- `claripy.BVS`로 만든 심볼릭 변수를 레지스터에 직접 주입한다
- 성공 경로 도달 후 `solver.eval()`로 실제 값을 추출한다

---

## Challenge 04: angr_symbolic_stack

이번 문제는 스택에 값을 저장한다. 레지스터에 직접 주입하는 방식은 쓸 수 없고, 스택 레이아웃을 재현해야 한다.

```python
import angr
import claripy
import sys

def is_successful(state):
    return b'Good Job.' in state.posix.dumps(sys.stdout.fileno())

def should_abort(state):
    return b'Try again.' in state.posix.dumps(sys.stdout.fileno())

def main():
    proj = angr.Project('../problems/04_angr_symbolic_stack')

    # scanf 이후, 스택 변수를 사용하기 시작하는 지점
    start_addr = 0x08048697
    init_state = proj.factory.blank_state(addr=start_addr)

    # ebp = esp로 스택 프레임 초기화
    init_state.regs.ebp = init_state.regs.esp

    password1 = init_state.solver.BVS('password1', 32)
    password2 = init_state.solver.BVS('password2', 32)

    # 스택 레이아웃 시뮬레이션
    # password2가 ebp-0x8, password1이 ebp-0xc에 위치
    padding_len = 0x8
    init_state.regs.esp -= padding_len

    init_state.stack_push(password2)
    init_state.stack_push(password1)

    simulation = proj.factory.simgr(init_state)
    simulation.explore(find=is_successful, avoid=should_abort)

    if simulation.found:
        solution = simulation.found[0]
        solution_password1 = solution.solver.eval(password1)
        solution_password2 = solution.solver.eval(password2)
        print('flag: ', solution_password2, solution_password1)
    else:
        print('no flag')

if __name__ == '__main__':
    main()
```

스택 기반 인자를 다룰 때는 `start_address`를 정밀하게 계산해야 한다. 함수 프롤로그 이후의 스택 레이아웃을 IDA나 GDB로 확인하고, `esp` 오프셋을 직접 재현하는 것이 핵심이다.

---

## 실전 팁

**entry_state로 시작하라.** 대부분의 크랙미는 `p.factory.entry_state()`가 정답이다. `blank_state(addr)`는 특정 함수 중간에 커스텀 레지스터/메모리 상태로 진입하고 싶을 때만 사용한다.

**stdin 기반 바이너리에는 posix.dumps(0)를 쓰라.** 바이너리가 파일에서 입력을 읽는다면 open 시스콜을 후킹하거나 파일시스템 플러그인을 사용해야 할 수 있다.

**경고 출력을 살펴라.** 제약 없는 레지스터나 메모리에 대한 경고는 angr가 가정을 세우고 있다는 신호다. 단순한 크랙미에서는 대부분 무해하지만, 포인터 값에 따라 분기하는 프로그램에서는 잘못된 결과를 낼 수 있다.

**avoid 주소를 여러 개 지정하면 성능이 향상된다.** 식별한 dead-end 경로를 `avoid`에 추가할수록 angr가 탐색해야 할 상태 공간이 줄어든다. 대형 바이너리에서는 수초와 수분의 차이가 날 수 있다.

**반복문이 많은 코드에서 angr는 느릴 수 있다.** 탐색이 무한히 계속된다면 스텝 제한 설정(`sim.run(n=N)`)이나 `DFS`/`BFS` 탐색 전략을 명시적으로 지정하는 것을 고려하라.

**콜백 기반 find/avoid가 더 유연하다.** 주소가 자주 바뀌거나 ASLR 환경이라면, `state.posix.dumps(sys.stdout.fileno())`로 출력 내용을 검사하는 함수를 `find`/`avoid`에 전달하는 방식을 선호하라.
