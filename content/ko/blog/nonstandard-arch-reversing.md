---
title: "비표준 아키텍처 리버싱: PPC-VLE·TriCore 디스어셈블러를 직접 만들다"
date: 2026-08-13
description: "IDA·Ghidra·Binary Ninja가 기본 지원하지 않는 자동차 ECU 아키텍처(PPC-VLE, TriCore)를 분석하는 방법. IR을 공통어로 삼는 RE 도구 구조, 아키텍처 플러그인 구현 공식, 그리고 비표준 calling convention이 data-flow 분석을 오염시키는 문제와 해법."
tags: ["reversing", "PPC-VLE", "TriCore", "binary-ninja", "IDA", "IR", "automotive", "ECU", "embedded"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 들어가며

x86과 ARM은 어떤 리버싱 도구를 켜도 즉시 디스어셈블된다. 문제는 그 바깥이다. 자동차 ECU 펌웨어를 뜯어 보면 **IDA도 Ghidra도 Binary Ninja도 기본 상태로는 한 줄도 못 읽는** 아키텍처를 만난다. PowerPC의 VLE 변종, Infineon TriCore가 대표적이다. 심지어 심볼도 문자열도 없이 코드만 4메가바이트쯤 들어 있곤 한다.

이 글은 도구가 지원하지 않는 아키텍처를 만났을 때 무엇을 하는지 정리한다. 핵심은 두 가지다 — **(1) IR을 공통어로 삼는 RE 도구 구조를 이해하면 "아키텍처 플러그인 하나만 쓰면 나머지 분석 인프라가 다 딸려온다"는 것**, 그리고 **(2) 비표준 calling convention이 어떻게 data-flow 분석 전체를 무너뜨리는지와 그 해법**이다. 사례는 공개 발표(HackingCamp, @d0now_kim / PetoWorks)와 오픈소스 구현체에 기댄다.

## IR: 모든 RE 도구의 공통어

새 아키텍처를 지원하려면 디스어셈블러·디컴파일러·심볼릭 실행 엔진을 전부 새로 짜야 할 것 같지만, 현대 RE 프레임워크는 그렇지 않다. 그 사이에 **중간 표현(Intermediate Representation, IR)** 이 있기 때문이다.

```
각 아키텍처 코드 (x86, ARM, RISC-V, PPC, MIPS, TriCore, ...)
        ↓  [아키텍처별 디스어셈블러 — IR 변환 담당]
    IR (플랫폼 고유)
        ↓
  ┌─────────────────────────────────┐
  │  Pseudo-C 생성기                 │
  │  심볼릭 실행 엔진                │
  │  프로그램 분석 플랫폼            │
  │  RE 자동화 (LLM 에이전트 등)     │
  └─────────────────────────────────┘
```

기계어를 IR로 바꾸는 계층만 아키텍처를 안다. 그 위의 모든 도구는 IR만 상대한다. **따라서 새 아키텍처를 지원한다 = IR 변환기(디스어셈블러)만 작성한다.** Pseudo-C 생성기도, 데이터 흐름 분석기도 그대로 재활용된다. 이게 비표준 아키텍처 리버싱의 경제성을 결정한다.

플랫폼마다 IR이 다르고, 그게 곧 도구 생태계 선택이다.

| 플랫폼 | IR | 특징 |
|--------|-----|------|
| Ghidra | P-code | NSA 개발, SLEIGH 언어로 아키텍처 정의 |
| Binary Ninja | BNIL | LLIL → MLIL → HLIL 3단계 계층 |
| angr | VEX (PyVEX) | valgrind VEX IR, Python API |
| IDA Pro | 마이크로코드 | Hex-Rays 전용, `set_type`이 직접 영향 |

Binary Ninja의 BNIL은 3단계로 올라간다.

```
기계어
    ↓  Architecture Plugin
LLIL (Low Level IL)   — 어셈블리와 1:1 근접, 레지스터 명시
    ↓  Data-flow Analysis
MLIL (Mid Level IL)   — SSA 형태, 변수 추론
    ↓  Type Propagation
HLIL (High Level IL)  — C pseudocode 근접, 타입 반영
```

아키텍처 플러그인이 담당하는 건 맨 아래 한 계층, 기계어 → LLIL 뿐이다. 그 위 MLIL·HLIL은 Binary Ninja가 알아서 올려준다. 플러그인 하나의 값어치가 여기 있다.

## 비표준 아키텍처 RE 접근 공식

지원 안 되는 아키텍처를 만났을 때의 순서는 정형화되어 있다.

1. **데이터시트/레퍼런스 매뉴얼 획득.** 제조사 사이트나 검색으로 "Reference Manual", "Architecture Specification" 키워드. 명령어 인코딩·레지스터 목록·메모리 모델이 전부 여기 있다.
2. **레지스터 분석.** 범용(GPR) vs 특수목적(SPR)을 구분하고 각 용도를 파악.
3. **명령어 크기 분석.** 고정 길이냐 가변 길이냐. 이게 파서의 뼈대를 결정한다.
4. **명령어 구조 파싱.** opcode·operand의 비트 위치를 규칙으로 정리.
5. **명령어 의미(semantic) 표현.** 각 명령어가 레지스터·메모리에 미치는 영향을 IR 연산으로.
6. **IR 변환기 구현.** Capstone을 붙이거나 직접 비트 파서를 짜고, 플랫폼 API로 IR을 생성.

이 공식을 두 아키텍처에 적용해 보자.

## 사례 1: PPC-VLE 디스어셈블러

**PPC-VLE(Power Architecture Variable Length Encoding)** 는 자동차 ECU에 흔한 PowerPC 파생이다. 이름 그대로 16비트·32비트 명령어를 혼합해 코드 밀도를 높인다. 문제는 IDA·Ghidra의 기본 PPC 지원이 이 가변 길이 인코딩을 디코딩하지 못한다는 점이다.

ECU 펌웨어를 손에 넣기까지는 물리 작업이다 — ECU 탈거, 펌웨어 보안 우회(case-by-case), 플래시에서 추출, 아키텍처 식별. 식별 결과가 PowerPC(VLE)로 나오면 그때부터 위 공식이 돈다.

**레지스터**는 PowerPC 계보를 따른다.

| 분류 | 예시 | 역할 |
|------|------|------|
| 범용(GPR) | r0~r31 | 데이터/주소 |
| 특수목적(SPR) | LR, CTR, XER, CR | 링크 레지스터, 카운터, 조건 코드 |
| FPR | f0~f31 | 부동소수점 |

**명령어 크기**가 VLE의 핵심이다. 상위 비트 패턴으로 이 명령어가 16비트인지 32비트인지를 먼저 판정해야 다음 명령어의 시작점을 안다. 고정 길이 아키텍처에 없던 문제다.

**구조 파싱**은 비트 필드 분해다.

```
명령어 [31..0]:
  [31..26] = opcode (6비트)
  [25..21] = rD (목적 레지스터)
  [20..16] = rA (소스 레지스터)
  [15..0]  = immediate 또는 추가 필드
```

**의미 표현**은 각 명령어를 Binary Ninja LLIL로 옮기는 작업이다. 예컨대 SPR에서 GPR로 옮기는 명령어라면:

```python
class MoveFromSPR:
    def get_llil(self, il, instr):
        # LLIL: rD = SPR
        il.append(
            il.set_reg(4, instr.rD,
                il.reg(4, instr.spr_name))
        )
```

명령어의 효과를 `set_reg`·`load`·`store`·`goto` 같은 LLIL 연산으로 기술하면, Binary Ninja가 그 위로 MLIL·HLIL을 쌓아 올린다. 플러그인 적용 전엔 "알 수 없는 바이트 시퀀스"였던 것이, 적용 후엔 완전한 어셈블리 + Pseudo-C로 바뀐다.

이 영역은 이미 오픈소스 레퍼런스가 여럿 있다.

- [Martyx00/PowerPC-VLE-Extension](https://github.com/Martyx00/PowerPC-VLE-Extension) — 초기 구현
- [PetoWorks/binaryninja-power-vle](https://github.com/PetoWorks/binaryninja-power-vle) — 발표자 직접 제작
- [Vector35 공식 PPC 지원](https://github.com/Vector35/binaryninja-api/tree/dev/arch/powerpc) — 이후 Binary Ninja 본체 편입

아키텍처 플러그인 작성법 자체는 Binary Ninja의 공식 가이드([part1](https://binary.ninja/2020/01/08/guide-to-architecture-plugins-part1.html), [part2](https://binary.ninja/2021/12/09/guide-to-architecture-plugins-part2.html))가 잘 정리해 두었다.

## 사례 2: TriCore Fast Function Calls

두 번째 사례는 디스어셈블 자체가 아니라 **분석 정확도**의 문제다. Infineon **TriCore**는 자동차 ECU용 32비트 RISC인데, 일반 RISC에 없는 **Fast Function Call(fcall)** 이라는 호출 방식을 지원한다. 이걸 도구가 모르면 data-flow 분석 전체가 오염된다.

일반 calling convention부터 대비해 보자. ARM 예시:

```
caller():
    r0 = arg1, r1 = arg2    // 인자 설정
    PUSH {r4-r11, lr}       // callee-saved 백업
    BL callee               // 호출
    POP {r4-r11, pc}        // 컨텍스트 복구
    // r0 = 반환값
```

callee는 독립된 컨텍스트를 갖고, caller의 레지스터는 규약으로 보호된다. 도구는 이 규약을 알기에 "이 함수 호출 이후 r4~r11은 보존됐다"고 가정할 수 있다.

Fast Function Call은 이 가정을 깬다.

```
fastcall_fn:
    // 스택 프레임 없음, 컨텍스트 백업 없음
    // caller가 쓰던 레지스터를 그대로 읽고 쓴다
    D6 = D4 + D5            // caller의 D4, D5를 source로 사용
    RET                     // D6이 caller로 "반환" (컨텍스트 공유이므로)
```

별도 컨텍스트가 없다. caller와 레지스터 공간을 완전히 공유한다. 문제는 여기서 터진다.

```
caller():
    D4 = 0xdeadbeef          // D4 설정
    fcall fastcall_fn        // ← 도구: "D4가 어디서 쓰이지?"
    result = D6              // ← 도구: "D6이 정의된 적 없음" → dead-code
```

fastcall이 어떤 레지스터를 읽고(use) 쓰는지(set) 도구가 모르니, 반환값 관련 코드가 전부 unreachable/dead-code로 표시된다. **분석 신뢰도가 0으로 떨어진다.**

해법은 fastcall 함수마다 두 프로퍼티를 명시하는 것이다.

- **Clobbered Registers**: fastcall이 쓰는(set) 레지스터. caller가 값 보존을 기대하면 안 되는 것들.
- **Return Registers**: fastcall이 반환값으로 쓰는 레지스터.

Binary Ninja API로:

```python
fn = bv.get_function_at(fastcall_addr)
fn.clobbered_regs = ['D4', 'D5', 'D6']  # 이 레지스터를 씀
fn.return_regs    = ['D6']              # D6이 반환값
```

이 정보가 들어가면 data-flow 엔진이 set/use 관계를 정확히 추적하고, dead-code로 잘못 표시됐던 코드가 되살아난다. IDA Pro에서도 원리는 같다 — 함수 타입 선언에 `__spoils` 등으로 변경 레지스터를 지정하면 Hex-Rays 마이크로코드가 이를 반영해 data-flow를 재계산한다.

## 심볼 없는 펌웨어에서 구조 복원하기

TriCore 사례에는 한 가지 더 쓸모 있는 관찰이 있다. fastcall 함수들이 **메모리에 무작위로 흩어져 있지 않다.**

```
0x0000 [section A 시작]
    fastcall_fn_1   ← fastcall 함수들이 선두에 연속 배치
    fastcall_fn_2
    fastcall_fn_3
    regular_fn_1    ← 일반 함수들, fastcall 호출
    regular_fn_2
0x1000 [section B 시작]
    fastcall_fn_4   ← 다음 섹션도 동일 패턴
    ...
```

이 배치는 컴파일 단위(.o 파일)가 링크 후에도 연속으로 남기 때문에 생긴다. **fastcall 다발의 경계 = 섹션(컴파일 단위) 경계**라는 뜻이다. 심볼도 문자열도 없는 펌웨어에서, calling convention 패턴이 파일 경계를 되짚는 거의 유일한 단서가 된다.

자동화도 가능하다.

```python
for func in bv.functions:
    if is_fastcall(func):
        func.name = f"fastcall_{func.start:08x}"
# 연속된 fastcall 블록 → 하나의 파일/섹션 단위로 추정
```

발표자의 표현을 빌리면 "이 펌웨어에는 문자열도 심볼도 없고 오직 코드뿐"인 상황. 이럴 때 **코드 패턴 → 파일/섹션 경계 → 기능 단위 추론**이 분석을 확장하는 유일한 경로다.

## 타입 명시가 디컴파일 품질을 바꾼다

두 사례를 관통하는 교훈이 하나 있다. IR 기반 도구에서 **분석가가 준 타입·레지스터 정보는 그대로 상위 계층으로 전파된다.**

IDA Pro는 내부적으로 Hex-Rays 마이크로코드를 IR로 쓴다.

- `set_type`으로 함수 시그니처를 지정하면 마이크로코드 생성 시 파라미터 타입이 반영된다.
- `infer_types`는 마이크로코드 기반으로 지역 변수 타입을 역추론한다.
- `declare_type`으로 구조체를 정의하면 필드 접근이 `*(a1 + 0x10)` 대신 `request->method`로 표현된다.

Binary Ninja도 마찬가지로 LLIL에서 명시한 타입이 MLIL·HLIL로 올라간다. TriCore의 clobbered/return 레지스터 지정이 정확히 이 메커니즘이다 — 낮은 계층에 정확한 정보를 주면 높은 계층 분석 품질이 비약한다. 비표준 아키텍처든 표준 아키텍처든, 디컴파일 결과가 엉망일 때 가장 먼저 손볼 곳은 타입과 calling convention이다.

## 마치며

지원 안 되는 아키텍처는 벽처럼 보이지만, 실제 작업량은 IR 변환기 한 계층에 국한된다. PPC-VLE는 가변 길이 인코딩을 판정해 LLIL로 옮기는 디스어셈블러 문제였고, TriCore는 비표준 calling convention을 도구에 알려 data-flow를 살리는 주석(annotation) 문제였다. 둘 다 "낮은 계층에 정확한 정보를 주면 상위 도구가 알아서 올라온다"는 IR 구조의 이점을 그대로 활용한다.

자동차 ECU처럼 심볼 없는 임베디드 타깃이 늘면서, 표준 아키텍처 밖으로 나가는 일은 점점 흔해진다. 도구가 못 읽는다고 멈추는 대신, 데이터시트를 펴고 플러그인을 짜는 쪽이 결국 더 빠르다.

## 참고

- HackingCamp 발표 — @d0now_kim (PetoWorks), "TriCore, PPC-VLE 리버스 엔지니어링"
- [PetoWorks/binaryninja-power-vle](https://github.com/PetoWorks/binaryninja-power-vle)
- [Binary Ninja Architecture Plugin Guide part1](https://binary.ninja/2020/01/08/guide-to-architecture-plugins-part1.html) · [part2](https://binary.ninja/2021/12/09/guide-to-architecture-plugins-part2.html)
