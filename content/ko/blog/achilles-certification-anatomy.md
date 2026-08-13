---
title: "Achilles 인증 해부 — 산업제어기기는 어떻게 퍼징당하는가"
date: 2026-08-10
description: "Achilles 통신 견고성 인증(ACC)이 PLC·RTU·산업 스위치를 어떻게 시험하는지 해부한다. L1 31개 / L2 54개 테스트케이스 분류, Scans·Storms·Fuzzers·Grammars 7가지 테스트 유형, IP 스택부터 DNP3·Modbus·IEC 61850까지 제어 프로토콜 커버리지, 그리고 Normal/Warning/Failure 모니터가 실제로 무엇을 판정하는지 정리한다."
tags: ["ICS", "OT", "fuzzing", "Achilles", "IEC-62443", "protocol", "vulnerability-research", "robustness-testing"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 들어가며

산업제어기기 벤더가 "우리 PLC는 Achilles 인증을 받았습니다"라고 말할 때, 그 문장 뒤에서는 수십만 개의 악의적인 패킷이 그 기기에 인라인으로 쏟아졌다. Achilles 인증은 통신 견고성(communication robustness)을 시험한다. 쉽게 말해, **오류 패킷과 고부하 트래픽이 밀려드는 상황에서도 이 기기가 제어 기능을 놓치지 않는가**를 검증한다. IT 서버라면 잠깐 응답이 느려지고 마는 상황이, 발전소나 변전소의 컨트롤러에서는 물리적 사고로 직결되기 때문이다.

이 글은 Achilles 통신 견고성 인증(ACC)의 내부를 세 부분으로 해부한다. 1부는 시험 환경과 판정 체계 — 하드웨어가 어디에 삽입되고, 모니터가 무엇을 보고, Normal/Warning/Failure가 각각 무슨 뜻인지. 2부는 7가지 테스트 유형과 L1 31개 / L2 54개 테스트케이스의 분류 — IP 스택 계층별로 무엇이 어떻게 두들겨지는지. 3부는 제어 프로토콜 커버리지 — DNP3, Modbus/TCP, EtherNet/IP, IEC 61850, IEC 104, OPC UA가 각각 어떤 방식으로 시험되는지.

여기서 다루는 Grammar 방식 테스트의 설계 원리는 [Grammar 기반 퍼징 글](/ko/blog/grammar-based-fuzzing/)에서 별도로 깊이 다뤘다. 이 글은 그 위에서 "인증이라는 틀 안에서 그것이 어떻게 조직화되는가"를 본다.

---

## 1부 — 시험 환경과 판정 체계

### ACC와 APC — 두 가지 인증

Achilles 인증은 두 갈래로 나뉜다.

- **ACC (Achilles Communications Certification)** — 통신 견고성 인증. 기기가 오류·고부하 트래픽에서 제어 기능을 유지하는지 검증한다. 이 글의 주제다.
- **APC (Achilles Practices Certification)** — 보안 관행 인증. 개발 생애주기, 취약점 대응 프로세스 등 조직의 프로세스를 본다.

ACC의 대상은 넓다. PLC·DCS·RTU 같은 **임베디드 장치**, 라우터·스위치 같은 **네트워크 장비**, EWS·히스토리안·도메인 컨트롤러 같은 **호스트 장비**, HMI·제어 소프트웨어 같은 **제어 애플리케이션**이 모두 시험 대상이 된다. 보안 강도에 따라 L1과 L2로 나뉘며, L2는 L1의 상위 호환이다 — L1 테스트를 전부 포함하고, 모니터를 추가하고, VDR이라는 개념을 도입한다(뒤에서 설명).

### 시험 대상은 격리되지 않는다 — 인라인 삽입

Achilles 시험의 핵심 발상은 **인라인 삽입**이다. 시험 장비를 DUT(Device Under Test, 시험 대상 기기)와 VCS(Validation Control System, 제어시스템) 사이에 끼워 넣는다.

```
[VCS (제어시스템)] ──── [Achilles Satellite] ──── [DUT (시험 대상 기기)]
                         │
                    [Client PC]
                    (테스트 제어·결과 확인)
```

이 배치가 중요한 이유는, Achilles가 단순히 패킷을 던지는 도구가 아니라 **패킷 생성·전송·모니터링을 일체로 수행**하기 때문이다. DUT가 VCS와 정상 통신을 하는 와중에 Achilles가 그 통신선에 악의적 트래픽을 주입하고, 동시에 DUT의 출력 신호를 관찰한다. 시험 네트워크는 보통 네 갈래로 구성된다.

| 네트워크 | 구성 | 역할 |
|---------|------|------|
| Test 1 | Achilles Port 1 + DUT 1 + VCS 1 | 주 시험 경로 |
| Test 2 | Achilles Port 3 + DUT 2 + VCS 2 | 두 번째 DUT 병렬 시험 |
| Management | Client ↔ Achilles | 시험 제어·결과 확인 (DHCP 불가, 수동 설정) |
| Monitor | Achilles Monitor Port + VCS 보조 NIC | 출력 신호 감시 전용 |

### 시험 전 준비 — DUT에 "필수 기능"을 심는다

시험이 시작되기 전, DUT에는 지속적으로 관측 가능한 필수 기능이 설정되어 있어야 한다. PLC를 예로 들면 네 가지를 설정한다.

| 기능 | 설정 방법 |
|------|---------|
| **제어(Control)** | 디지털/아날로그 출력 신호를 생성하는 래더 로직 구성 |
| **알람(Alarm)** | 주기적으로 알람을 발생시키고 히스토리에 저장 |
| **뷰(View)** | HMI에서 출력값을 화면에 표시 |
| **명령(Command)** | HMI 스크립트로 출력 주기를 변경하는 명령 전송 |

이렇게 하는 이유는 명확하다. Achilles가 트래픽을 퍼붓는 동안 이 기능들이 **끊기는 순간을 포착**해야 하기 때문이다. 가장 대표적인 것이 디지털 출력에 1초 주기(500ms high / 500ms low)의 square wave를 생성해 두는 것이다. 이 파형이 흐트러지면 곧 제어 기능이 방해받았다는 신호다.

### 모니터 — 무엇을 감시하는가

Achilles는 여러 모니터를 동시에 돌린다.

| 모니터 | 감시 대상 |
|--------|---------|
| **Discrete Monitor** | 디지털 출력 신호 (1000ms 주기 square wave) |
| **Analog Monitor** | 아날로그 출력 신호 (L2 전용) |
| **ICMP Monitor** | ICMP ping 응답 (통신 유지 확인) |
| **Link State Monitor** | 물리 링크 상태 유지 |
| **TCP Ports Monitor** | 발견된 TCP 포트의 연결 상태 |
| **UDP Ports Monitor** | 발견된 UDP 포트의 상태 |
| **Test Monitor** | 테스트 케이스 내부의 이상 감지 |

L1은 **Discrete + ICMP** 두 개만 쓴다. L2는 여기에 **Analog + Link State + TCP Ports + UDP Ports**를 더해 여섯 개를 쓴다. L2가 더 촘촘한 그물을 던진다는 뜻이다.

### Normal / Warning / Failure — 오해하기 쉬운 판정

Achilles 초심자가 가장 흔히 오해하는 지점이 여기다. 모니터 결과는 세 가지다.

| 결과 | 의미 |
|------|------|
| **Normal** | 시험 및 post-test 내내 이상 동작 없음 |
| **Warning** | 시험 중 이상 감지, post-test 종료 전에 스스로 복구됨 |
| **Failure** | 시험 중 이상 감지, post-test 종료 후에도 미복구 |

**Failure가 곧 "인증 불합격"이 아니다.** Failure는 "이상 동작이 관측되었고 회복되지 않았다"는 사실만을 기록한다. 최종 합격·불합격은 별도의 인증 요구사항(Certification Requirements)을 적용해서 판정한다. 예컨대 설계 의도에 따른 ICMP Monitor Warning — "초당 200패킷을 넘으면 응답을 의도적으로 중단하도록 설계했다" 같은 경우 — 은 설계 문서를 제출하면 예외로 인정될 수 있다. 반면 Discrete Monitor의 Warning/Failure나 ICMP Failure는 예외로 인정되지 않는다. 제어 신호가 흔들렸다는 것은 변명의 여지가 없기 때문이다.

### L1 합격 기준 — 10% 링크 이용률의 벽

L1의 합격 조건은 단순하고 엄격하다.

```
10% 링크 이용률 이하의 모든 테스트에서:
  Discrete Monitor → Normal
  ICMP Monitor → Normal

단 1개 테스트라도 이 기준을 못 넘기면 → L1 불합격
```

핵심 파라미터는 다음과 같다. 최대 링크 이용률 **10%**, Discrete Monitor 주기 1000ms(허용 오차 ±4%), ICMP 타임아웃 0.5초, ICMP 허용 패킷 손실 10%. 10%라는 숫자가 중요하다 — 링크 대역폭의 10%까지의 트래픽에서는 **무조건** 제어와 ping이 살아 있어야 한다는 뜻이다.

### L2 합격 기준 — VDR로 기준을 이원화한다

L2는 여기에 아날로그 출력 감시를 더하고, **VDR(Vendor-Defined Rate)**이라는 개념을 도입한다. VDR은 다음 중 하나가 발생하는 패킷 레이트다.

1. 장치가 rate-limiting 메커니즘을 활성화해 트래픽을 폐기하기 시작하는 지점, 또는
2. 장치가 성능 한계에 도달해 패킷을 드롭하기 시작하는 지점

L2 합격 기준은 이 VDR을 경계로 두 구간으로 나뉜다.

```
VDR 이하의 모든 테스트:
  Discrete / Analog / Link State / ICMP / TCP Ports / UDP Ports → 전부 Normal

VDR 초과 ~ 최대 링크 레이트:
  Discrete / Analog / Link State → Normal (필수)
  ICMP / TCP Ports / UDP Ports → Normal 또는 Warning 허용
```

발상이 흥미롭다. VDR 이하 — 즉 장치가 감당할 수 있다고 스스로 선언한 부하 — 에서는 모든 것이 완벽해야 한다. VDR을 넘어선 극한 부하에서는 **제어 신호(Discrete/Analog)와 링크는 반드시 살아 있되, 부가적인 응답(ICMP/포트)은 잠깐 죽어도 봐준다**. 벤더가 VDR을 지정하지 않으면? 전체 테스트에 엄격한 기준(VDR 이하 기준)이 일괄 적용된다. L2에는 Recovery period 120초가 추가로 규정되어, 부하 종료 후 2분 안에 정상 상태로 돌아와야 한다.

---

## 2부 — 7가지 테스트 유형과 IP 스택 커버리지

### 테스트 유형 7종

Achilles의 테스트는 목적에 따라 일곱 가지로 분류된다. 이 분류를 이해하면 인증서에 찍힌 숫자를 읽을 수 있다.

**1. Scans (스캔)** — 포트 스캔 도구에 대한 견고성. IT 환경에서 흔한 정찰 기법(TCP SYN/ACK/FIN/Connect/Null/XMAS 스캔, UDP 스캔)에 DUT가 어떻게 반응하는지 본다.

**2. Storms (스톰)** — 고속 패킷 전송으로 메모리·버퍼 자원 고갈을 시도한다. 10%~100% 링크 이용률로 레이트를 조절하며, **DoS search mode**를 쓰면 레이트를 자동으로 증가시키며 한계값을 탐색한다.

**3. Fuzzers (퍼저)** — 무작위 헤더값으로 잘못된 패킷을 생성한다. 랜덤 넘버 제너레이터 기반이라 필드 선택과 값이 모두 무작위다. 강력하지만 **비체계적이라 커버리지를 측정할 수 없다**는 한계가 있다. 보통 50,000개 이상의 패킷을 던진다.

**4. Grammars (그래머)** — 체계적 도메인 기반 테스트. 프로토콜의 모든 필드와 조합을 순차적으로 순회하며, 각 필드에 공통 구현 오류를 노리는 지능적 퍼즈값을 넣는다. **퍼저와 달리 정량적 커버리지를 달성할 수 있다**는 것이 핵심 차이다. (이 대비 — 무작위 뮤테이션이 놓치는 것을 Grammar가 어떻게 메우는지 — 는 [Grammar 기반 퍼징 글](/ko/blog/grammar-based-fuzzing/)에서 상세히 다뤘다.)

**5. Data Grammars (데이터 그래머)** — 하위 계층은 유효하게 유지한 채 상위 계층에 잘못된 데이터를 전송한다. 크기 범위는 0부터 max valid까지(TCP는 약 65KB).

**6. Damage Tests (손상 테스트)** — 페이로드를 소폭 변조해 길이 필드 불일치 등에 대한 민감도를 본다.

**7. Response Tests (응답 테스트)** — DUT가 서버가 아니라 **클라이언트로 요청을 보낼 때** 잘못된 응답을 던진다. DUT가 정해진 순서로 일정 횟수 요청을 보내야만 실행되며, 30초 안에 요청이 없으면 타임아웃된다. 현재는 Modbus/TCP Client Grammar가 대표적이다.

### Fuzzers vs Grammars — 왜 둘 다 필요한가

이 두 유형의 관계가 Achilles 설계의 핵심 철학을 드러낸다.

| 항목 | Fuzzer | Grammar |
|------|--------|---------|
| 필드 선택 | 무작위 | 순차적 순회 |
| 값 생성 | 랜덤 | 유효값 + 지능적 퍼즈값 |
| 커버리지 | 측정 불가 | 정량화 가능 |
| 강점 | 예상 못 한 조합 발견 | 빠짐없는 필드 검증 |

Fuzzer는 "넓게 던지지만 어디를 맞혔는지 모르는" 산탄총이고, Grammar는 "모든 필드를 하나씩 조준하는" 소총이다. 인증은 재현 가능성과 커버리지를 요구하므로 Grammar가 중심이 되고, Fuzzer는 그물에 걸리지 않은 조합을 보완한다.

### L1 테스트 목록 — 31개, OSI L2~L4만

L1은 IP 스택의 하위 계층(데이터링크~전송)만 다룬다. 프로토콜 여섯 개에 걸쳐 총 31개 테스트다.

| 프로토콜 | 테스트 케이스 |
|---------|-------------|
| **Ethernet** | Unicast Storm, Multicast Storm, Broadcast Storm, Fuzzer, Grammar |
| **ARP** | Request Storm, Host Reply Storm, Cache Saturation Storm, Grammar |
| **IP** | Unicast Storm, Multicast Storm, Broadcast Storm, Fragmented Storm, Fuzzer, Grammar-Header, Grammar-Fragmentation, Grammar-Options |
| **ICMP** | Storm, Grammar, Type/Code Cross Product |
| **TCP** | Scan Robustness, SYN Storm, LAND Storm, Fuzzer, Grammar |
| **UDP** | Scan Robustness, Unicast Storm, Multicast Storm, Broadcast Storm, Fuzzer, Grammar |

각 계층이 무엇을 노리는지 몇 가지만 짚어 보자.

- **ARP Host Reply Storm** — DUT의 IP가 다른 MAC에 속한다고 위조한 ARP Reply를 퍼붓는다. ARP 스푸핑 저항성을 본다.
- **ARP Cache Saturation Storm** — IP/MAC 조합을 계속 바꿔 ARP 캐시를 포화시킨다.
- **IP Fragmented Storm** — 재조립이 필요한 단편화 패킷을 연속 전송해 임베디드 장치의 재조립 버퍼 한계를 찾는다.
- **ICMP Type/Code Cross Product** — 모든 유효·무효 Type-Code 조합을 전수 전송한다. 정상 범위 밖의 조합을 어떻게 처리하는지 본다.
- **TCP/IP LAND Storm** — src IP = dst IP = DUT, src port = dst port로 설정해 DUT가 자기 자신에게 응답하는 루프를 유발한다. 고전적인 DoS 기법이다.

### L2가 추가하는 23개 — TCP가 가장 두꺼워진다

L2는 L1의 31개를 그대로 포함하고 23개를 더해 총 54개가 된다. 추가분의 무게중심은 압도적으로 TCP다.

L1의 TCP는 5개였지만 L2에서는 21개로 불어난다. 몇 가지 특기할 만한 것들:

- **TCP RST Storm** — RST 플래그를 퍼부어 연결을 강제 종료시킨다.
- **TCP Closed Receive Window Storm** — Window Size를 0으로 유지해 송신을 차단당한 상태로 묶는다.
- **TCP Segment Reassembly Storm** — 분할된 세그먼트를 연속 전송해 재조립 버퍼를 고갈시킨다.
- **TCP Grammar - Contextually Invalid** — 연결 상태와 맞지 않는 패킷(예: SYN 없이 ACK)을 보낸다. 상태 머신 구현의 결함을 노린다.
- **TCP Maximum Concurrent Connections** — 약 1,021개의 동시 연결을 열었다가 역순으로 해제한다.
- **TCP ISN Randomness Check** — 초기 시퀀스 넘버(ISN)의 무작위성을 Dieharder 통계 검정으로 확인한다. 단, ISN은 중복 방지를 위해 부분적으로 순차적이어야 하므로(RFC6528) 완전 무작위면 오히려 실패할 수 있다. **이 테스트는 정보 목적이며 실패해도 불합격이 아니다.**

TCP Scan Robustness 하나에도 일곱 가지 스캔 모드(SYN/ACK/FIN/Connect/Null/XMAS/OS·Version Detection)가 들어 있다. TCP가 가장 복잡한 상태 머신을 가진 프로토콜이라 시험도 그만큼 두껍다.

### 인증 대상이 아닌 것들

여기서 주의할 것 하나. **LLDP, IGMP, 그리고 FTP·HTTP 같은 IT 애플리케이션 프로토콜은 L1/L2 인증 대상이 아니다.** 이들에 대한 테스트 스위트가 존재하긴 하지만(LLDP Saturation, HTTP Header Grammar 등) 별도 선택 항목이다. 인증서의 커버리지를 읽을 때 이 경계를 아는 것이 중요하다.

### 공통 파라미터 — Storm과 Grammar의 손잡이

모든 Storm은 같은 손잡이를 공유한다.

| 파라미터 | 값 범위 | 기본값 |
|---------|--------|--------|
| Packet Length | 60 ~ 1514 bytes | 60 (최고 속도) |
| Rate Limit | Off / Limit(pps) / DoS search mode / Global | Global |
| Duration | 사용자 지정 / Global | Global |
| Packet Capture | Global / On Anomalies / Never / Always | Global |

기본 패킷 길이가 60바이트인 이유는 최소 프레임 크기로 **초당 패킷 수를 최대화**하기 위해서다. 반대로 데이터율을 보고 싶으면 프레임을 1514바이트로 키운다. 실무 권장은 먼저 DoS search mode로 임계율을 찾고(5%씩 증가), 그다음 프레임 크기를 60B → 1514B로 확대해 "패킷율 병목인지 데이터율 병목인지"를 구분하는 것이다.

Grammar는 다른 손잡이를 쓴다. First/Last Subtest로 범위를 지정하고, **Fault Isolation**을 켜면 이상 감지 시 자동 이진 탐색으로 문제를 일으킨 서브테스트를 격리한다. 5만 개 서브테스트 중 어느 하나가 크래시를 냈는지 손으로 찾을 필요가 없다는 뜻이다.

---

## 3부 — 제어 프로토콜은 어떻게 시험되는가

IP 스택 시험이 "네트워크 스택이 안 죽는가"를 본다면, 제어 프로토콜 시험은 "산업 통신 프로토콜 구현이 안 죽는가"를 본다. 이 테스트들은 L1/L2가 아니라 **L1+** 또는 별도 스위트로 제공된다. Storm/Fuzzer/Grammar라는 같은 패턴을 각 프로토콜에 맞게 적용한다.

### 커버되는 프로토콜과 기본 포트

| 프로토콜 | 표준 | 기본 포트 | 테스트 수 | 주요 테스트 유형 |
|---------|------|---------|---------|----------------|
| **DNP3** | DNP3 Spec | TCP 20000 | 7 | 계층별 Grammar (DL/Transport/App) |
| **EtherNet/IP** | ODVA/CIP | TCP 44818 | 25 | CIP Object Grammar + Exhaustion |
| **FF-HSE** | IEC 61158 | — | 3 | DoS, Grammar, Saturation |
| **GOOSE** | IEC 61850 | Multicast Ethernet | 1 | Request Damage (Grammar) |
| **IEC 104** | IEC 60870-5-104 | TCP 2404 | 5 | APCI + ASDU Grammar |
| **MMS** | IEC 61850 | TCP 102 | 14 | 계층별 Grammar (TPKT/COTP/Session/Init) |
| **Modbus/TCP** | Modbus.org | TCP 502 | 4 | Server Grammar (L1+), Client Grammar (Response) |
| **OPC UA** | IEC 62541 | TCP 4840 | 21 | 계층별 Grammar + Exhaustion |
| **PROFINET** | IEC 61158 Type 10 | — | 19 | DCP Grammar + RT Cyclic/Acyclic |

여기서 흥미로운 점은 **프로토콜의 계층 구조가 그대로 시험 구조로 번역**된다는 것이다. 예를 들어 MMS(IEC 61850)는 `TCP → TPKT → COTP → OSI Session → MMS` 스택을 가지는데, 시험도 TPKT Grammar → COTP Grammar → Session Grammar → MMS Init Grammar로 계층별로 쌓인다. 각 계층의 파서가 독립적으로 두들겨진다.

### DNP3 — 세 계층을 각각 두들긴다

DNP3는 마스터/슬레이브 구조이며 세 계층으로 나뉜다.

- **Data Link Layer** — 주소지정·오류검출. Start(0x05 0x64), Length, Control, Dst/Src Address, CRC.
- **Transport Function** — 분할·재조립. Fin/Fir/Sequence.
- **Application Layer** — 응답 처리. Application Control, Function Code, Internal Indications.

시험도 이 세 계층 각각에 대해 Grammar를 돌린다(Data Link Layer Slave Grammar, Transport Function Slave Grammar, Application Layer Slave Grammar 등). 각 계층에 대해 "메시지 구조 조합"과 "데이터 페이로드 조합"을 따로 시험한다.

한 가지 실무 함정이 있다. DNP3는 Source/Destination 주소를 명시적으로 갖는데, DUT가 특정 소스 주소만 수신하도록 설정된 경우가 있다. 그래서 시험 전에 Wireshark로 VCS-DUT 간 트래픽을 캡처해 실제 주소를 확인해야 한다. 연결 실패 시 5회까지 재시도하고, 그래도 안 되면 테스트가 예외(exception)로 처리된다.

### Modbus/TCP — 유일한 Response Test가 여기 있다

Modbus/TCP는 TCP 502에서 MBAP 헤더(Transaction ID, Protocol ID, Length, Unit Identifier) 뒤에 1바이트 Function Code가 붙는 단순한 구조다. 테스트는 네 개인데, 두 갈래가 인상적이다.

**Server Grammar (L1+)** — Function Code 01~17과 스펙 미정의 무효 코드를 조합해 던진다. 검사하는 Function Code는 Read Coils(01), Read Holding Registers(03), Write Single Coil(05), Write Multiple Registers(16), Report Server ID(17) 등 표준 코드 전부와 무효 코드다.

**Client Grammar (Response Test)** — 이것이 앞서 말한 유일한 Response Test다. **DUT가 Achilles에 클라이언트로 접속해 순서대로 요청을 보내야** 실행된다. Function Code마다 필요한 요청 수가 정해져 있다 — 예를 들어 FC 0x01~0x04는 각 55회, FC 0x16은 무려 1,351회를 DUT가 보내 줘야 모든 서브테스트가 실행된다. 30초 안에 요청이 없으면 타임아웃이다. DUT가 마스터 역할을 하는 게이트웨이·프로토콜 변환기라면 이 테스트가 핵심이 된다.

### GOOSE — 단 하나지만 4ms의 세계

IEC 61850 GOOSE는 변전소 이벤트를 **4ms 이내**에 전달해야 하는 초저지연 프로토콜이다. IP를 쓰지 않고 Ethernet 멀티캐스트로 L2에서 직접 전송된다. 시험은 GOOSE Request Damage 단 하나 — 무효 GOOSE PDU를 Grammar 방식으로 던진다. 테스트가 하나뿐인 이유는 프로토콜 자체가 단순하기 때문이지, 중요도가 낮아서가 아니다. 변전소 보호 계전기가 오염된 GOOSE 하나에 오작동하면 그것이 곧 정전이다.

### OPC UA — 자원 고갈이 절반이다

OPC UA(IEC 62541)는 UA TCP → UA Secure Conversation → UA Services라는 다층 스택을 가진다. 시험 21개 중 상당수가 **Exhaustion(고갈) 테스트**다 — Incomplete CreateSession Exhaustion, Secure Channel Exhaustion, Session Exhaustion, Monitored Item Exhaustion, Subscription Exhaustion. OPC UA가 세션·구독 같은 상태 자원을 많이 유지하는 프로토콜이라, "미완성 세션을 계속 열어 두면 자원이 고갈되는가"가 주된 공격 벡터이기 때문이다.

각 Grammar 테스트 전에 Achilles는 자동으로 TCP 연결 → UA TCP 연결 → Secure Conversation → Get Endpoints → Create/Activate Session의 절차를 밟는다. 어느 단계에서 5회 재시도 후에도 실패하면 Failure로 처리된다. Browse Request Loop 테스트는 DUT의 Browse 요청을 루프 구조로 처리해 **무한 루프 취약점**을 노린다.

### 제어 프로토콜 전용 Fault Isolation — Quick 모드

IP 스택 테스트와 달리 제어 프로토콜 Grammar에는 Fault Isolation에 **Quick 모드**가 추가된다.

| 모드 | 동작 |
|------|------|
| **Disable** | 자동 격리 없음 |
| **Full** | 전체 실행 후 이상 발견 시 이진 탐색으로 문제 서브테스트 격리 |
| **Quick** | Test Monitor Failure 시 즉시 중단 → post-test 통과 시 다음 서브테스트 계속 |

Quick 모드는 크래시가 나면 바로 멈추고 DUT가 스스로 회복되는지 본 뒤 다음으로 넘어간다. 회복이 안 되면 DUT 재시작이 필요할 수 있다. 제어 프로토콜은 한 번 크래시하면 전체 스택이 먹통이 되는 경우가 많아, 이런 세밀한 제어가 필요하다.

---

## 정리 — 인증서 뒤에 무엇이 있는가

Achilles 인증을 해부하면 "인증을 받았다"는 문장의 정보량이 드러난다.

- **L1이냐 L2냐** — L1은 IP 스택 하위 계층 31개, 모니터 2개, 10% 링크 이용률 기준. L2는 54개, 모니터 6개, VDR 기반 이원화 기준. L2가 질적으로 더 촘촘하다.
- **어떤 프로토콜이 포함됐나** — IP 스택만인가, 아니면 DNP3·Modbus·IEC 61850 같은 제어 프로토콜 스위트(L1+)까지 포함됐나. 후자가 없으면 그 기기의 산업 프로토콜 파서는 시험받지 않은 것이다.
- **Failure가 없다 ≠ 완벽하다** — 인증은 정의된 테스트 스위트 안에서의 견고성을 보증할 뿐이다. LLDP·IGMP·IT 프로토콜은 애초에 대상이 아니고, Fuzzer의 비체계성은 커버리지 공백을 남긴다.

Achilles가 하는 일은 결국 **제어 신호가 살아 있는가**를 물리 출력 파형으로 관측하면서, 네트워크 스택과 프로토콜 파서를 계통적으로 두들기는 것이다. IT 견고성 시험과 다른 점은 판정 기준이 "서비스 응답"이 아니라 "제어의 연속성"이라는 데 있다. 이 발상 — 가용성과 제어 연속성을 최우선에 두는 것 — 은 IEC 62443이 산업 보안을 IT 보안과 다르게 정의하는 근본 이유와 정확히 맞닿아 있다. Achilles는 그 철학을 패킷 단위의 시험으로 번역한 도구인 셈이다.
