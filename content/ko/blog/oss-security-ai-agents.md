---
title: "오픈소스 보안 AI 에이전트 해부 — CAI·PentAGI·OpenManus·CRS"
date: 2026-08-13
description: "네 개의 오픈소스 에이전트 프레임워크(CAI, PentAGI, OpenManus, CRS)를 실제 코드와 논문 기준으로 분해하고, DARPA AIxCC가 드러낸 자율 취약점 발견·패치의 현실을 정리한다."
tags: ["Security", "AI-Agents", "AIxCC", "CRS", "Offensive-Security"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 두괄식 요약

보안 AI 에이전트는 지금 **네 가지 서로 다른 설계 철학**으로 갈라져 있다. 완전 자동화(CRS), 자율+계층(PentAGI), 반자율 HITL(CAI), 그리고 최소주의 범용 프레임워크(OpenManus)다. 이 글은 각 프레임워크를 실제 오픈소스 코드와 논문 기준으로 뜯어보고, DARPA AIxCC 결선이 실증한 "무엇이 실제로 작동하는가"를 정리한다.

핵심 결론부터 말하면 이렇다.

- **자율성은 스펙트럼이지 스위치가 아니다.** 정형화된 CVE 재현은 완전 자동이 유리하고, 실제 펜테스트는 사람 개입(HITL)이 성공률을 높인다.
- **AIxCC 우승 요인은 기술이 아니라 안정성이었다.** 가장 정교한 팀이 아니라, 143시간 내내 가용성을 유지한 팀이 이겼다.
- **LLM의 실질 기여는 명확하다.** 병렬 퍼저가 못 잡는 22개 취약점을 LLM이 추가로 잡았다. 다만 자동 검증을 통과한 패치의 **37~45%가 의미론적으로 틀렸다.**

시스템 내부 설계 관점의 자체 아키텍처는 [AI 보안 에이전트 아키텍처](/ko/blog/ai-security-agent-architecture/)에서 별도로 다룬다. 이 글은 오픈소스 프레임워크 분석에 집중한다.

---

## 1부 — 네 프레임워크 개관

먼저 네 시스템을 한 표로 압축한다. 세부는 이후 각 부에서 코드 수준으로 풀어낸다.

| 항목 | CAI | PentAGI | OpenManus | CRS |
|------|-----|---------|-----------|-----|
| 개발 주체 | Alias Robotics | vxcontrol | MetaGPT(FoundationAgents) | Theori (AIxCC 결선팀) |
| 언어/기반 | Python, OpenAI Agents SDK 확장 | Go 백엔드 + React | Python, OpenAI SDK + Pydantic | Python + Rust FFI |
| 자율성 | 반자율 (HITL) | 자율 + 계층 | 단순 ReAct | 완전 자율 |
| 특화 | CTF / 버그바운티 | 네트워크 침투 | 범용 태스크 | 코드 취약점 발견·패치 |
| 메모리 | 상태 없음(stateless) | pgvector + Graphiti | 슬라이딩 윈도우 100 msg | 상태 없음 |
| 계획 수정 | Planner 재계획 | Delta Patch | 불가 | 없음 |
| 가드레일 | 4계층 | 4중 | stuck 감지만 | 도구 후크 |
| 코드 규모 | 중대형 SDK | 대형 풀스택 | ~2,500줄 | 대형(12 에이전트·11 모듈) |

이 네 시스템은 각각 다른 질문에 답한다. CRS는 "사람 없이 끝까지 갈 수 있는가", PentAGI는 "자율성과 계층 통제를 어떻게 결합하는가", CAI는 "어디서 사람이 개입해야 하는가", OpenManus는 "얼마나 단순하게 만들 수 있는가"다.

---

## 2부 — CAI: 8 기둥 반자율 아키텍처

**CAI(Cybersecurity AI)**는 Alias Robotics의 오픈소스 사이버보안 AI다. HackTheBox AI 랭킹 상위에 올랐고, arXiv `2504.06017`에서 인간 대비 최대 3,600배 속도를 보고했다. OpenAI Agents SDK를 확장한 구조다.

CAI를 관통하는 원칙은 **반자율(Semi-autonomous)**이다. 완전 자동화는 정형화된 작업에만 잘 맞고, 복잡한 보안 판단이 필요한 순간에는 실패율이 높다. 그래서 CAI는 언제든 `Ctrl+C`로 사람이 끼어드는 HITL 구조를 유지한다. 자동화 vs 자율성의 6단계 분류는 `2506.23592`에서 정리했다.

### 8 기둥

CAI의 아키텍처는 여덟 개 개념으로 구성된다.

| 기둥 | 역할 |
|------|------|
| **Agents** | LLM의 생각·행동 단위 (일꾼) |
| **Tools** | Python 함수를 `@function_tool`로 래핑 (연장통) |
| **Handoffs** | `transfer_to_<agent>` 도구로 주도권 이전 (바톤 터치) |
| **Patterns** | 분산(Swarm)·상명하달(Hierarchical) 등 팀 운영 방식 |
| **Turns** | 사이클 단위, 비용·진행 추적 |
| **Tracing** | 전체 기록, 디버깅 (블랙박스) |
| **Guardrails** | 4계층 방어 (안전장치) |
| **HITL** | `Ctrl+C` 개입 (비상 브레이크) |

한 문장으로 요약하면: 일꾼(Agents)이 연장(Tools)을 들고, 바톤터치(Handoffs)하며, 팀 방식(Patterns)으로, 턴(Turns)마다 기록(Tracing)되고, 안전장치(Guardrails)가 지키며, 위험하면 사람(HITL)이 잡는다.

### 핸드오프를 도구로 표현한 이유

CAI의 가장 특징적인 설계는 **에이전트 간 제어권 이전을 별도 메커니즘이 아니라 도구 호출로 표현**한 것이다. LLM은 이미 도구 호출에 최적화되어 있다. 따라서 `transfer_to_<agent_name>`이라는 도구를 호출하면 제어권이 넘어가도록 만들면, LLM이 새 개념을 학습할 필요 없이 자연스럽게 위임을 판단한다.

핸드오프 시 넘어가는 히스토리는 세 종류로 나뉜다. 이전 전체 히스토리(`input_history`), 핸드오프 직전까지의 항목(`pre_handoff_items`), 핸드오프 턴에서 새로 생성된 항목(`new_items`)이다. `input_filter`로 새 에이전트에게 전달할 히스토리를 조작할 수 있어, 실패한 시도의 흔적을 지우고 깨끗한 컨텍스트로 넘길 수 있다.

`as_tool()` 메서드는 이와 대비된다. 핸드오프가 주도권을 넘기는 것이라면, `as_tool()`은 에이전트를 **다른 에이전트의 서브루틴 도구**로 변환한다. 주도권은 넘어가지 않고, 결과만 받아온다.

### Runner 실행 루프

`Runner.run()`이 전체 루프를 구동하며 세 단계를 반복한다.

1. **Input Guardrail 병렬 실행** — 첫 에이전트에만, LLM 추론과 동시에 돌린다.
2. **LLM 추론** — 시스템 프롬프트 + 히스토리로 다음 행동을 결정한다.
3. **도구 병렬 실행**

분기 조건은 세 가지다. 핸드오프가 발생하면 새 에이전트로 넘어가 1단계부터 다시 시작하고, 최종 출력이 나오면 Output Guardrail을 거쳐 종료하며, 추가 작업이 필요하면 2단계로 복귀한다. CAI는 **Stateless**하게 Chat Completions API 위에서 동작하므로, 각 호출이 독립적이고 다중 모델 전환이 자유롭다. LiteLLM으로 300개 이상 모델을 다룬다.

### Guardrails 4계층과 프롬프트 인젝션 방어

CAI의 가드레일은 4계층 방어(defense-in-depth)로 설계됐다. 근거는 `2508.21669`다.

| 계층 | 동작 시점 |
|------|----------|
| Layer 1 InputGuardrail | 첫 에이전트 입력, LLM 추론과 **병렬** |
| Layer 2 Tool-level | 각 도구 실행 **직전** |
| Layer 3 OutputGuardrail | 최종 출력 생성 시 |
| Layer 4 Unicode/Encoding | 동형 문자·인코딩 정규화 후 재검사 |

가드레일을 병렬로 돌리는 이유는 지연 최소화다. 빠른 정규식 검사와 느린 LLM 분석을 동시에 수행해 대기 시간을 줄인다. 이 병렬화는 CAI의 실행 루프 설계와 일관된다. Runner의 첫 단계에서 Input Guardrail을 LLM 추론과 동시에 돌리는 것도 같은 원리로, 안전성을 지연 없이 확보하려는 의도다.

프롬프트 인젝션은 다섯 패턴으로 탐지한다. 직접 지시 오버라이드("ignore previous"), 숨겨진 명령(`<system>`·`<admin>` 태그), Leetspeak 난독화, 인코딩 트릭(Base32/64), 셸 메타문자(`$`, `` ` ``, `|`, `&` 등)다. Layer 4는 키릴 문자 а(a 모양)나 그리스 문자 ο(o 모양) 같은 유니코드 동형 문자를 ASCII로 정규화한 뒤 다시 검사한다.

### Context 관리와 Lifecycle Hooks

CAI는 두 종류의 컨텍스트를 명확히 분리한다. **로컬 Context**(`RunContextWrapper`)와 **LLM Context**(히스토리)다.

| | 로컬 Context | LLM Context |
|--|-------------|-------------|
| LLM 접근 | 불가 | 직접 참조 |
| 사용자 | 도구·훅만 접근 | 시스템 프롬프트로 전달 |
| 데이터 | Python 객체(dataclass, Pydantic) | JSON 직렬화 메시지 |

이 분리가 보안에서 중요하다. 예컨대 `SecurityAlert(ip, threat_id)` 같은 dataclass를 로컬 Context로 넘기면, 도구는 `wrapper.context.ip_address`로 접근하지만 LLM은 그 값을 보지 못한다. 민감 정보를 LLM 히스토리에서 격리하는 것이다. 첫 파라미터가 `RunContextWrapper` 타입인 `@function_tool` 함수에는 런타임 컨텍스트가 자동 주입된다.

생명주기 훅도 두 종류다. **RunHooks**(전역: `on_agent_start/end`, `on_handoff`, `on_tool_start/end`)는 "CCTV"처럼 전체를 관측하고, **AgentHooks**(에이전트별)는 "개인 비서"처럼 특정 에이전트만 감시한다.

### Council — LLM 협의회

CAI의 독특한 기능 하나가 **Council**이다. 여러 모델이 병렬로 응답한 뒤 서로를 평가하고 의장이 종합한다. 3단계로 진행된다. ① GPT 계열·Claude 등이 각각 독립 텍스트를 생성하고, ② 익명화된 상태로 상호 순위를 매기며, ③ 현재 에이전트가 최종 합의를 종합한다. N명이면 약 2N+1 호출로 비용이 3~4배 늘지만, 중요한 판단에서 단일 모델의 편향을 줄인다.

### 11 전문 에이전트와 Cyber Kill Chain

CAI는 11개 전문 에이전트를 세 그룹으로 나눈다.

- **공격 4종**: Red Teamer(침투·권한 상승), Bug Bounter(취약점 발견), Web Pentester(웹앱/API), One Tool Agent(CTF 최소 도구 도전)
- **방어 2종**: Blue Teamer(모니터링), DFIR Agent(포렌식)
- **지원 5종**: Thought Agent(전략 라우팅), Reporter(보고서), Retester(거짓 양성 제거), Memory Agent(RAG 저장/조회), Flag Discriminator(CTF 플래그 검증)

Red Teamer의 프롬프트 전략이 실전 감각을 잘 보여준다. "루트 접근까지 절대 멈추지 말라(never stop iterate until root access)"는 지침과 함께, 비대화형 명령만 쓸 것(`--batch`, `--non-interactive` 필수), 한 번에 하나의 명령만, 반드시 타임아웃을 붙일 것(hang 방지), 같은 접근을 반복하지 말 것(막히면 Thought Agent로 복귀) 같은 규칙이 박혀 있다.

역쉘 같은 장기 실행 프로세스는 세션 4단계로 관리한다. netcat 리스너를 띄워 `session_id`를 받고, `session output <id>`로 출력을 확인하며, 세션에 명령을 원격 실행하고, `session kill <id>`로 종료한다.

도구는 **Cyber Kill Chain 6단계**로 디렉토리를 나눈다. `reconnaissance/`(정찰), `exploitation/`(익스플로잇), `privilege_scalation/`(권한 상승), `lateral_movement/`(측면 이동), `data_exfiltration/`(유출), `command_and_control/`(C2)다.

### 5 패턴과 CAIBench

CAI는 조율 방식을 **LLM 기반**(Swarm 자율 핸드오프, 탐색적·비결정적)과 **코드 기반**(Parallel 설정, 결정성·재현성) 두 축으로 나눈다. 에이전트 패턴은 다섯 차원의 튜플로 형식화된다. 참여 집합(Agents), 전환 규칙(Handoffs), 흐름 결정(Decision: LLM 자율 or 코드), 히스토리 공유(Communication: unified/isolated), 실행 모드(Execution: sequential/parallel/recursive)다.

이 다섯 차원을 하나의 `Pattern` dataclass로 표현하고, `PatternType` 열거형 다섯 종(PARALLEL·SWARM·HIERARCHICAL·SEQUENTIAL·CONDITIONAL)으로 구체화한다. `CAIBench`는 단일 벤치마크가 아니라 CTF·퍼징·패치 품질·CVE 재현·HITL 개입 빈도 등 여러 도메인을 통합한 메타 벤치마크로, 에이전트·모델·패턴 선택을 최적화하는 데 쓰인다.

---

## 3부 — PentAGI: Go 기반 자율 펜테스트 플랫폼

**PentAGI**는 vxcontrol의 자율 AI 침투 테스트 플랫폼이다. "10.10.10.5 서버의 취약점을 찾아줘" 같은 요청을 받으면 AI가 스캔·공격·보고를 자율 수행한다. 기술 스택은 Go 백엔드(Gin, gqlgen GraphQL, GORM)에 React 프론트엔드, PostgreSQL + pgvector, 선택적 Neo4j + Graphiti 지식 그래프, Docker(Kali Linux) 실행 환경이다.

### 5단계 흐름

동작은 다섯 단계로 진행된다.

1. **사용자 요청** — 웹 UI에서 태스크 입력
2. **환경 준비** — Image Chooser가 적절한 Docker 이미지를 고르고 Kali 컨테이너를 기동. Flow별로 OOB 콜백 TCP 포트 2개를 자동 할당
3. **계획 수립** — Generator가 태스크를 서브태스크로 분해
4. **서브태스크 실행 루프** — Primary Agent가 오케스트레이션
5. **최종 평가** — Reporter가 판정

서브태스크 실행 루프의 구조가 핵심이다. Primary Agent 아래에서 Task Planner(Adviser)가 3~7단계 체크리스트를 만들고, Pentester에게 위임하면 Pentester는 `terminal("nmap -sV ...")`로 Docker에서 도구를 실행하거나, Searcher에게 CVE 검색을 위임하거나, Coder에게 익스플로잇 스크립트 작성을 시킨다. 발견이 확정되면 `hack_result()`를 호출해 서브태스크를 종료(Barrier)한다.

이후 Refiner가 남은 계획을 **Delta Patch**로 수정한다. 계획 전체를 다시 짜는 대신 add/remove/modify/reorder 델타만 적용해 효율을 높인다. 이는 CAI의 전면 재계획과 대비되는 지점이다.

### 최종 판정은 결과 기준

PentAGI의 Reporter는 독립적으로 판정하되, **과정이 아니라 결과를 본다.** 100번을 시도해도 실제 취약점을 못 찾았다면 FAILURE다. 각 서브태스크가 `hack_result` 호출로 종료되고, Reporter는 그 결과를 근거로 SUCCESS/FAILURE를 판단한다.

### 4중 가드레일

PentAGI는 무한 루프와 정체를 코드 수준에서 막는다.

1. **repeatingDetector** — 동일 도구+인자가 3회 연속이면 경고, 7회면 강제 종료
2. **executionMonitor** — 호출이 일정 횟수를 넘으면 Adviser(멘토)가 개입해 대안 전략 제안
3. **Enhanced Response** — 도구 응답에 멘토 분석을 XML로 자동 삽입 (`<enhanced_response>` 안에 원 결과와 멘토 분석을 함께 담아, 진행 평가·문제·대안·다음 단계를 제시)
4. **Reflector** — 도구 호출 없이 텍스트만 반환하면 최대 3회 재지시

### 3중 메모리와 익명화

PentAGI는 세 계층 메모리를 쓴다. Working Memory(LLM 컨텍스트 + 요약, 세션 단위), Long-term Memory(PostgreSQL + pgvector, 영구), Knowledge Graph(Neo4j + Graphiti, 영구)다.

주목할 설계는 **Anonymization Protocol**이다. 메모리 저장 시 IP·도메인·크레덴셜을 `{target_ip}`, `{password}` 같은 플레이스홀더로 치환한다. 이렇게 하면 특정 타깃에 종속된 로그가 아니라 다른 타깃에서도 재사용 가능한 일반화된 지식으로 축적된다.

### 워크플로우 패턴 조합

PentAGI는 Anthropic의 프로덕션 패턴을 조합한다. Prompt Chaining(generator → primary_agent → reporter), Routing(primary가 pentester/coder/searcher 선택), Augmented LLM(pentester가 nmap 실행), Evaluator-Optimizer(Refiner가 Delta Patch로 개선)다. 이 패턴들은 [AI 에이전트 아키텍처 기본기](/ko/blog/ai-agent-architecture-basics/)에서 개념적으로 정리한다.

---

## 4부 — OpenManus: 최소주의 범용 프레임워크

**OpenManus**는 MetaGPT 팀의 오픈소스 범용 에이전트 프레임워크로, Manus AI의 오픈소스 대안이다. 철학은 명확하다. "단순하게, 빠르게." 전체 코드가 약 **2,500줄**이며, LangChain이나 CrewAI 같은 복잡한 추상화 계층을 쓰지 않고 OpenAI SDK와 Pydantic만 직접 사용한다.

보안 특화 프레임워크는 아니지만, 최소 구성으로 에이전트를 만들 때의 기준선을 보여준다는 점에서 비교 대상으로 가치가 있다.

### 두 실행 모드

- **단일 에이전트 모드** (`main.py`): `Manus.create()`로 에이전트를 만들고 ReAct 루프를 돈다. `think()`로 도구를 고르고 `act()`로 실행한 뒤 관찰하며, `terminate` 도구를 고를 때까지 반복한다.
- **멀티에이전트 모드** (`run_flow.py`): `PlanningFlow`가 LLM + PlanningTool로 계획을 세우고 스텝별로 실행한다.

멀티에이전트 모드의 라우팅이 흥미롭다. 각 스텝 텍스트에 `[MANUS]`, `[DATA_ANALYSIS]` 같은 태그를 붙이고, 정규식 `\[([A-Z_]+)\]`로 태그를 추출해 해당 에이전트에 배정한다. 태그가 없으면 primary_agent로 폴백한다. 정교한 라우터 대신 텍스트 태그와 정규식으로 처리하는 전형적인 최소주의다.

### 4계층 상속

OpenManus는 상속으로 기능을 쌓는다.

```
BaseAgent      — name, memory, state / create(), run(), step()
  └ ReActAgent  — think() → bool, act() → str
      └ ToolCallAgent — 도구 호출 결정·실행, tools 관리
          └ Manus     — python_execute, browser_use, MCP 연결
```

`BaseAgent.run()`이 `step()` 골격을 고정하는 Template Method 패턴이고, 하위 클래스가 구체화한다. MCP는 클라이언트와 서버 양방향을 모두 지원해, 외부 MCP 서버의 도구를 주입받을 수도 있고 자기 에이전트를 MCP 서버로 노출할 수도 있다. 브라우저는 Playwright(browser-use), 코드 실행은 Docker 샌드박스를 쓴다.

### 유일한 안전장치: stuck 감지

OpenManus에는 전용 가드레일이 없다. 유일한 루프 안전장치는 `BaseAgent`의 **중복 응답 감지**다. 마지막 assistant 메시지가 `duplicate_threshold`(기본 2)회 반복되면 stuck으로 판정하고, "관찰된 중복 응답. 새로운 전략을 고려하고 이미 시도한 비효과적 경로를 반복하지 말 것"이라는 프롬프트를 주입해 루프 탈출을 유도한다. 동일 출력이 반복될 때만 개입하며, 프롬프트 인젝션 방어·도구 권한 제어·입출력 가드레일은 없다.

메모리도 최소다. 영속 메모리 없이 `Memory.add_message()`가 최대 100개 메시지만 유지하는 슬라이딩 윈도우이고, 세션이 끝나면 전부 사라진다.

이 단순함은 트레이드오프가 명확하다. 강점은 명확한 상속 구조, 최소 의존성, MCP 양방향 네이티브, 높은 가독성이다. 약점은 메모리 영속성 없음, 에이전트 간 통신 없음, 동적 재계획 불가, 보안·권한 제어 없음이다. 보안 실전용이 아니라 프로토타이핑·학습용 기준선이다.

---

## 5부 — CRS와 AIxCC: 완전 자율의 현실

**CRS(Cyber Reasoning System)**는 스펙트럼의 반대편 끝, 완전 자율이다. 여기서는 DARPA AIxCC 맥락과 함께 다룬다.

### AIxCC란

**AIxCC(AI Cyber Challenge)**는 DARPA가 주관한 2023~2025 경쟁으로, 실제 오픈소스 소프트웨어에서 **자율적으로 취약점을 발견하고 패치**하는 CRS를 구축하는 것이 목표였다. 2016년 CGC(Cyber Grand Challenge)가 맞춤형 바이너리를 격리된 CTF 환경에서 다뤘다면, AIxCC는 실제 C/Java OSS를 GitHub 통합 개발 환경에서 다뤘고, Anthropic·Google·OpenAI가 LLM 인프라를 제공했다.

최종 경쟁(AFC)의 규모는 이렇다.

- **기간**: 143시간 완전 자율 운영
- **챌린지**: 24개 OSS 저장소 → 48개 CP, 63개 CPV
- **자원**: 팀당 Azure $85,000 + LLM 크레딧 $50,000
- **언어**: C 취약점 40개, Java 취약점 23개, 34가지 CWE 유형

CRS의 핵심 기능은 넷이다. Full Scan(새 릴리스 태그 트리거, 전체 코드베이스 탐지·패치), Delta Scan(PR 머지 트리거, diff 분석), SARIF Review(정적 분석기 경고 유효성 평가), Report Synthesis(취약점별 보고서 통합)다.

채점 구조가 시스템 설계를 강하게 규정했다. PoV(취약점 증명 입력)는 1~2점, Patch(기능 유지하며 수정)는 3~6점, SARIF 평가는 0.5~1점, Bundle(PoV/Patch/SARIF 연결)은 오연결 시 페널티까지 포함해 -7~7점이었다. 여기에 **시간 감쇠**(즉시 제출 100%, 마감 직전 50%)와 **정확도 승수**(50% 정확도면 전체 점수 6% 감소)가 붙었다. 이 채점 구조 때문에 "빠르지만 부정확한 제출"과 "느리지만 정확한 제출" 사이의 전략적 선택이 순위를 갈랐다.

### CRS 아키텍처 (Theori roboduck)

Theori의 결선팀 CRS는 다음 계층으로 구성된다.

```
CRS Orchestrator (WorkDB + ProductsDB + TaskDB)
LLM Agents (12개: VulnAnalyzer · PovProducer · Patcher · Triage · ...)
Tool Modules (11개: Project · Fuzzing · Coverage · Debugger · Searcher · ...)
Common Library (LLM API · Types · VFS · Docker · Prompts)
Rust FFI (HTTP · Logger · Metrics · Coverage)
```

에이전트 프레임워크는 **1 공통 뿌리 + 6 서브클래스** 구조다. 공통 뿌리 `AgentGeneric[T]`가 LLM 호출(`_completion()` via litellm), 도구 실행, ReAct 루프(최대 30~40회), 비용 추적, 컨텍스트 관리, 직렬화(jsonpickle, `fork()`로 복제), 모델 폴백을 담당한다. 서브클래스는 종료 방식으로 갈린다.

- **XMLAgent** — 자유 텍스트에서 XML 태그를 파싱해 Pydantic으로 검증. 검증 실패 시 에러 메시지를 주입하고 재시도한다.
- **ToolRequiredAgent** — 반드시 `terminate` 도구 호출로 종료. 반환 타입의 Pydantic 필드를 `inspect.signature`로 분석해 `terminate` 시그니처를 동적 생성한다.
- **Classifier** — logprobs로 분류. temperature=0, max_tokens=1로 1토큰만 생성하고, 각 옵션 토큰의 확률을 정규화한다. 예를 들어 logprobs가 "likely"=-0.139, "unlikely"=-2.207이면 likely 87% / unlikely 11%로 계산된다. 비용이 토큰 1개분(약 $0.00001)에 불과해 저비용 게이트로 쓴다. 단 GPT 모델 전용이라(Claude/Gemini는 logprobs 미지원) `gpt-4o-mini`를 강제한다.

이 구조에서 종종 쓰이는 것이 **다중 상속**이다. `CRSAgent[T, U]`는 CRS 컨텍스트(task·project·searcher·coverage·debugger)를 제공하지만 자체 종료 로직이 없어, 종료 방식을 담당하는 클래스와 함께 상속받는다. 예를 들어 VulnAnalyzer는 `CRSAgent`와 `XMLAgent`를 동시에 상속해 CRS 컨텍스트와 XML 종료 로직을 결합한다. jsonpickle로 에이전트 상태 전체를 직렬화·복제(`fork()`)할 수 있어, 유망한 분석 지점에서 상태를 분기해 병렬 탐색하는 것도 가능하다.

### 오케스트레이터와 비용 에스컬레이션

CRS의 WorkDB는 SQLite 기반 우선순위 큐로, **Linux CFS 스케줄러 방식**으로 32종 작업을 공정 분배한다. 작업별 동시성 제한(PoV 50개, 패치 32개), vruntime 기반 공정 스케줄링, 우선순위 실행, 지수 backoff 재시도, 대회 마감 연동 만료, 벌크 배치를 처리한다.

비용 관리는 게이트 파이프라인으로 한다. 저비용으로 후보를 거르고 고비용으로 승격한다.

```
취약점 후보 (퍼저 · 정적분석 · LLM)
  ↓ [Gate 1] Classifier — ~$0.001 (logprobs 확률 낮으면 폐기)
  ↓ [Gate 2] VulnAnalyzer — ~$0.5~2 (소스 탐색+분석, triggerable=false면 폐기)
  ↓ [Gate 3] PovProducer — ~$5~20 (PoV 생성+실제 테스트)
  ↓ [Gate 4] Patcher — ~$5~20 (패치+빌드+기능 테스트+PoV 재검증)
```

컨텍스트가 초과되면 `_compress_context()`가 처음 2개 메시지를 보존하고 뒤쪽 1/3만 유지한다. 모델 폴백은 GPT-4.1 실패 시 Claude Sonnet, 그다음 o4-mini로 넘어간다.

### AIxCC가 실증한 것

경쟁 결과는 보안 AI에 대한 통념을 몇 개 깼다.

**우승 요인은 안정성이었다.** 1위 AT Atlantis는 392.8점으로 2위 대비 80% 높았는데, 결정적 요인은 가장 정교한 기술이 아니라 **7개 라운드 내내 가용성을 유지**한 것이었다. Azure 87%, LLM 크레딧 59%로 가장 적극적으로 자원을 활용했다. 반면 2위 TI RoboDuck은 기술적으로 가장 정교했고 Java PoV 최고 점수를 냈지만, 공격적 전략이 정확도 페널티로 이어졌다. 경쟁자 상당수는 P3~P4 이후 기능이 중단됐고, 과도한 엔지니어링으로 기초 CPV조차 실패한 팀도 있었다.

7개 결선팀의 설계 철학도 제각각이었다.

| 팀 | 철학 |
|----|------|
| AT Atlantis | 앙상블 우선 — 8개 패치 에이전트, 빌드 캐싱 |
| TB Buttercup | 전문성 기반 분해 — 결정론적 워크플로우, LLM은 도구 부족 시만 |
| TI RoboDuck | 에이전트 중심 — 자율 LLM 운영 극대화 |
| FB FuzzingBrain | 단순 아키텍처 — 23개 독립 Python 전략 |
| SP Artiphishell | 포괄 기술 — 53개 구성 요소 조정 |
| 42 BugBuster | 실용주의 — 전통 퍼징 중심, LLM은 시드 생성 보조 |
| LC Lacrosse | DSPy 멀티 LLM — Lisp 기반 작업 분배 |

**LLM의 실질 기여는 측정 가능했다.** 병렬 퍼저(PF)는 63개 중 34개(54%)를 발견할 수 있었는데, C는 75%였지만 Java는 17%에 그쳤다(입력 의미 제약이 복잡). CRS가 PF를 넘어선 부분은 22개 추가 취약점(C 8 + Java 14)이었고, 그 원천은 델타 코드 변경 분석, 복잡한 입력 문법(XML 등) 장벽 극복, 정규식·인코딩·압축·경로 난독화 같은 논리 제약 해결이었다.

**패치 품질은 여전히 미해결이다.** 자동 유효성 검사를 통과한 패치의 의미론적 오류율이 낮지 않았다. 기초 에이전트 기준 Claude Code 계열 37.7%, MultiRetrieval 계열 45.6%였다. 오류 원인은 잘못된 루트 원인(증상만 억제), 불완전한 수정(특정 경로만), 기능 편차(테스트가 못 잡는 의미 변경), 새 버그 도입, 도메인 지식 부족이었다. 다만 CRS는 정적 분석 보고서·실행 추적·PoV 바이트·CWE 지침을 통합한 컨텍스트화 덕분에 기초 에이전트보다는 낮은 오류율을 달성했다.

패치 파이프라인의 핵심 기술도 팀마다 수렴했다. **독립형 RCA**(LLM이 루트 원인 분석과 패치 합성을 별개 하위 문제로 분리), **컨텍스트화**(정적 분석 보고서 + 실행 추적 + PoV 바이트 + CWE 지침 통합), **LLM 리플렉션**(실패한 시도에서 학습, 대부분의 CRS가 채택), **패치 후 퍼징**(불완전 패치를 잡기 위한 단기 퍼징)이다. 제출 최적화로는 동일 루트 원인을 공유하는 PoV를 그룹화해 최소 패치 세트를 계산하고, 부정확한 No-PoV 패치의 제출을 지연시켜 페널티를 줄였다.

SARIF 유효성 검사에서도 세 전략이 갈렸다. PoV 중심(PoV-SARIF 위치 매칭 시만 제출), LLM 판단 중심(Correct/Incorrect 모두 제출하나 오류 위험), 버그 후보 중심(초기엔 Incorrect로 두고 증거 발견 시 Correct로 수정)이다.

결과적으로 7개 팀 전원이 최소 1개 0-day를 찾았고, 총 25개 0-day가 10개 OSS 프로젝트에서 발견됐으며, 그중 12개(48%)가 패치됐다.

### 삼중 과제

AIxCC의 교훈은 하나의 삼각형으로 압축된다. 연구(기술 역량), 엔지니어링(시스템 안정성), 전략(정확도·타이밍)의 균형이다. AT Atlantis는 셋을 균형 잡아 우승했고, TI RoboDuck은 연구는 강했으나 전략에서 실패했으며, 과도한 엔지니어링은 오히려 전략을 약화시켰다. **실제 병목은 기술 역량이 아니라 견고한 시스템 통합이었다.**

산업 배포를 위한 과제도 명확하다. 자원 효율(AFC CRS는 $85K Azure를 썼다. 개인 개발자에게는 단일 머신 경량 버전이 필요하다), OSS 커뮤니티 통합(LLM 프로비저닝, CRS 인터페이스 표준화, 엔드투엔드 워크플로우 정의), 텔레메트리 개선, 오픈소스 LLM 탐색이다.

---

## 종합 — 자율성 스펙트럼과 선택 기준

네 프레임워크를 자율성 축에 놓으면 이렇게 정렬된다.

```
완전 자율 ─────────────────────────────── 반자율
CRS          PentAGI        OpenManus      CAI
(코드 취약점)  (네트워크 침투)  (범용 최소)    (CTF/펜테스트)
```

선택 기준은 작업의 성격에 달렸다.

- **정형화된 CVE 재현·패치**라면 CRS 방식의 완전 자율이 유리하다. 판단보다 반복과 검증이 지배한다.
- **네트워크 침투**처럼 계획이 계속 바뀌는 작업이라면 PentAGI의 자율+계층+Delta Patch가 맞다.
- **실제 펜테스트·버그바운티**처럼 사람의 판단이 성공률을 좌우하는 작업이라면 CAI의 반자율 HITL이 낫다.
- **학습·프로토타이핑**이라면 OpenManus의 2,500줄 최소주의가 기준선이다.

AIxCC가 준 가장 큰 교훈은 아키텍처 선택보다 **안정성과 시스템 통합이 결과를 지배한다**는 것이다. 가장 정교한 에이전트 라이브러리를 가진 팀이 아니라, 143시간 동안 죽지 않은 팀이 이겼다. 보안 AI 에이전트를 설계한다면, 화려한 자율성보다 먼저 견고한 하네스와 가드레일에 투자해야 한다는 뜻이다.

---

## 참고 자료

- CAI (Alias Robotics) — arXiv `2504.06017`(3,600× 속도), `2506.23592`(자율성 6단계), `2508.21669`(프롬프트 인젝션 4계층), `2510.24317`(CAIBench)
- PentAGI (vxcontrol) — Go 기반 자율 펜테스트 플랫폼
- OpenManus (MetaGPT / FoundationAgents) — OpenAI SDK + Pydantic 범용 에이전트
- CRS / AIxCC — Theori roboduck 분석, DARPA AIxCC SoK
- 연관 글: [AI 보안 에이전트 아키텍처](/ko/blog/ai-security-agent-architecture/), [AI 에이전트 아키텍처 기본기](/ko/blog/ai-agent-architecture-basics/)
