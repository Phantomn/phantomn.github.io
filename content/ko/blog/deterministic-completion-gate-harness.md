---
title: "LLM은 자기가 끝냈는지 모른다 — 완료 판정을 모델 밖으로 빼는 하네스 설계"
date: 2026-08-11
description: "LLM 에이전트의 완료편향·과잉확신은 프롬프트로 교정되지 않는다는 것이 여러 연구의 결론이다. '전수 조사했다'·'취약점 0건'을 모델 서사가 아니라 HMAC receipt 원장과 결정론 훅으로 계산하게 만든, 취약점 점검 자동화 하네스의 설계 원리를 정리한다. negative-control 없는 '200 OK'는 확증이 아니다."
tags: ["LLM", "AI-agents", "harness", "vulnerability-research", "automation", "completion-bias", "security-automation"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 문제: "다 했습니다"가 거짓일 때

취약점 점검을 LLM 에이전트로 자동화하다 보면 반복해서 만나는 실패가 있다. 엔드포인트 71개 중 34개를 실제로 검증한 상태에서, 에이전트가 "전 표면 매핑 완료"라고 보고한다. "정말 전부 열거했나?"라고 되물으면 다시 "네, 모든 엔드포인트를 조사했습니다"라고 답한다. 세 번을 물어도 같은 과잉단정이 나온다. 실측은 34/71인데.

이건 게으름이나 버그가 아니다. **대표 표본을 몇 개 테스트해서 결과가 일관되면("전부 파라미터 바인딩 처리됨"), 모델은 "패턴이 확립됐으니 나머지도 같다"는 추론을 개별 검증한 사실처럼 서술한다.** 확신이 최고조에 달하는 "패턴 정합" 지점에서, 남은 항목의 실제 도구 실행을 추론으로 대체하고 그걸 "완료"로 보고한다.

문헌에는 이미 이름이 붙어 있다 — false success, silent semantic failure, premature completion, teleological(completion) bias. 그리고 중요한 사실 하나: **이건 프롬프트로 못 고친다.**

이 글은 그 결론을 받아들이고 나온 하네스 설계를 정리한다. 핵심 한 문장은 이렇다 — **완료와 취약 판정 권한을 LLM의 서사에서 회수해, 모델 밖의 결정론 프로세스(위조 불가능한 receipt 원장 + 훅)로 외부화한다.**

## 왜 프롬프트로 못 고치는가

"신중하게 하자", "추론과 실측을 구분해서 표기하자" 같은 자기지시가 왜 무효인지부터 짚어야, 왜 굳이 모델 밖으로 빼야 하는지가 납득된다. 구조적 원인이 다섯 가지다.

**R1. 생성-검증 갭.** 생성기는 자기 작업의 최악의 검증자다("the generator is the worst possible verifier of its own work"). 자기 메타인지만으로는 자기 완결성을 검증할 수 없다. 외부 앵커가 필수다. (Jason Wei의 "Asymmetry of verification"이 같은 지점을 짚는다.)

**R2. 소유편향 + RLVR 과잉확신.** 모델은 자기가 낸 답에 약 26% 더 확신한다(ownership bias). 더 결정적인 건 RLVR(검증가능 보상 강화학습)로 훈련된 모델이 decision token 확률을 정오와 무관하게 1에 가깝게 뱉는다는 점이다 — calibrated rollout이 없어 **강화학습으로도 이 과잉확신을 교정할 경로가 없다.** training에 구워진 것이라 프롬프트로 못 되돌린다.

**R3. 텔레올로지(완료) 편향.** 모델은 예측적 서사 엔진이라 목표지향 사건에서 완료를 환각한다. 명시적 취소 지시조차 override한다. 의도와 결과를 혼동한다.

**R4. 일관성이 거짓확신을 증폭한다.** 모델이 한 해석에 committing하면("다 음성이니 done") 표본의 일관성이 그 해석을 증폭해 거짓확신을 제조한다. 더 나쁜 건 **LLM 심판(judge)도 이걸 못 잡는다**는 것 — false success 탐지 AUROC가 0.65 이하로, "confident closing language" 같은 표면 프록시에 의존하기 때문이다. 작은 evaluator 모델을 붙여도 소용없다.

**R5. 탐지에는 negative가 필요하다.** 이론적으로, positive-only 정보만으로는 환각(false completion) 탐지가 불가능하다(Language Identification 문제와 동치). **labeled negative가 있어야 탐지가 가능해진다.** "done처럼 보인다"(positive-only)로는 false-completion을 못 잡는다.

정리하면 R2가 못이다 — 과잉확신이 training에 구워졌고 이를 교정할 calibrated 경로가 없다. epistemic marker("아마도", "확실치 않지만")나 "신중히"류 자기지시는 오히려 역효과거나 무효다. **결정론적 외부 강제만 유효하다.**

## 태그를 검사하는 게이트는 우회된다

"그럼 게이트를 붙이면 되지 않나"에 대한 첫 시도들이 왜 실패하는지도 봐 둘 값어치가 있다.

**출처 태그 존재만 검사하는 게이트.** 추론을 `[추론]`, 실측을 `[실측]`으로 태깅하도록 강제하고, 게이트가 태그 존재를 검사한다. 문제는 태그를 붙이는 것 자체가 gameable이라는 점이다. 내용의 진위는 검사하지 않으니, 추론에 `[실측]` 태그를 달면 통과한다.

**작은 evaluator 모델(Haiku 등)로 완료를 심판.** transcript만 읽고 도구는 없는 evaluator는, 에이전트의 confident한 서사를 읽고 "34 ≠ 71"을 검증하지 못한다. 소형 evaluator는 관대하다 — 한 벤치마크에서 "완벽"으로 판정된 trace의 83%가 실제로는 절차를 위반했다. R4가 정확히 이걸 예측한다.

두 방식 다 "텍스트가 grounded/done처럼 보이나"를 본다. 이게 바로 연구가 실패한다고 명시한 **표면 프록시**다.

## 근본 원리: 완료는 판단이 아니라 카운터의 read다

약 10개의 독립 프로젝트와 이론이 한 지점으로 수렴한다.

> **완료 권한을 결정론적·위조불가·아티팩트근거·fail-closed 원장으로 외부화한다. "done"은 모델 서사가 아니라, 실제 작업 receipt로부터 외부 프로세스가 계산한 기계적 COUNT다.**

수렴하는 요소들:

| 요소 | 이 설계에 주는 것 |
|------|-------------------|
| 완료권한 분리(doer ≠ done-checker) | 완료 판정을 작업하는 모델 밖으로 |
| 외부·fail-closed 수용검사 | 에이전트는 `candidate_complete`만 제안, 보호된 게이트가 실제 아티팩트를 읽고 grant. **미지 = blocked**(자동 승격 없음) |
| receipt = 위조불가 근거 | 도구 실행이 HMAC receipt 생성. 모델은 못 씀. "0건인데 receipt는 미테스트" = 탐지 가능한 거짓 |
| coverage = trace 이벤트로만 인정 | 엔드포인트는 실제 test 이벤트 receipt가 있을 때만 tested. 표본→서사 갈음이 차단됨 |
| 상태 외부화(파일 = 유일 정본) | 어느 항목이 검증됐는지 bookkeeping을 모델 머리 밖 파일로. context 압축에 불변 |
| Stop-hook 강제(프롬프트 아님) | 훅은 시스템 레벨 ~100% 준수(프롬프트는 70~90%). context 압박에 면역 |
| 검증 비대칭성 front-load | 원장(=정답지)을 테스트 전에 구축. 각 테스트는 한 줄 flip, 완료 확인은 trivial. 검증 << 생성 |

핵심 일반화 한 줄: **완결성 주장은 판단(judgment)이 아니라 외부 카운터의 read여야 한다.** 모델의 일은 (a) 작업 수행 (b) receipt 방출, 이 둘뿐이다. 카운트는 스크립트가, 강제는 훅이 한다.

## 구현: coverage-ledger receipt 게이트

원리를 코드로 내리면 이렇게 된다. 런타임 인프라(DB·그래프·상주 프로세스) 없이 경량 shell/python + append-only JSONL 원장 + HMAC 결정론 게이트만으로 선다.

**1. 원장 = SSOT, fail-closed.** 착수 전에 전체 엔드포인트 목록으로 원장을 seed한다. 엔드포인트 한 줄, 기본 `status: untested`. 상태 격자는 `untested | candidate | tested-neg | tested-pos`. 여기서 **"대표 검증"과 "추론"은 tested가 아니다** — count를 채우지 못한다. 이게 검증의 비대칭성을 front-load하는 지점이다. 정답지를 테스트 전에 만들어 두면, 각 테스트는 한 줄 flip이고 완료 확인은 count 비교로 끝난다.

**2. receipt는 하네스가 생성한다(모델이 아니라).** 프로빙 스크립트가 실행 side-effect로 `{endpoint, payload, resp_hash, verdict, ts}`를 receipt 파일에 append하고 HMAC으로 서명한다. **모델은 `tested`를 직접 못 쓴다** — 프로브 실행만이 쓴다. 이 무결성 경계가 전체 설계의 축이다. receipt 생성자를 단 하나(probe 스크립트)로 두고, HMAC 키는 모델이 접근 못 하게 한다.

**3. 완료 = 기계적 count.** 게이트가 계산한다:

```
tested = jq -s 'map(select(.verdict != null)) | length' receipts.jsonl
total  = wc -l all_endpoints.txt
```

"전수 / 모든 / 완료 / 0건 / N of M / 전 표면" 류 주장은 `tested == total`이 아니면 **DENY**된다. 태그로 우회할 수 없다 — 검사하는 게 텍스트가 아니라 카운트이기 때문이다.

**4. fail-closed 미지.** 원장에 untested나 candidate가 남으면 Stop 훅이 `decision: block`을 낸다("잔여 N 미검증"). 자동 승격 경로가 없다. false absence — "0건입니다"인데 실은 미테스트 — 는 이 방식이 잡는 특정한 거짓이다. 그래서 "확증 0"과 "미검증 N"을 분리해 표기하게 강제한다.

**5. verdict는 cross-family fresh 검증.** `tested-pos`(취약 확증)로의 승격은 별도의 fresh subprocess가 `resp_hash`를 근거로 재판정한다. 자기검토는 불가하다(R1·R4). 판정하는 프로세스와 작업한 프로세스가 달라야 공유 환각을 피한다.

**6. Stop-hook 강제.** 완료 주장이 나온 turn에서 count < total이거나 receipt 근거 없는 완료어가 있으면 훅이 block한다. 프롬프트가 아니라 시스템 레벨 훅이라 context 압박에 면역이고, `stop_hook_active`로 정당한 탈출구만 열어 둔다.

이렇게 하면 모델에게 남는 자율은 "정해진 next를 묻지 않고 실행하는 것"뿐이다. 다음에 뭘 테스트할지도 결정론 스케줄러가 정하고, 판정도 완료도 코드가 한다.

## 취약 확증: "200 OK"는 데이터 반환일 뿐이다

완료편향과 나란히 가는 두 번째 축이 **취약 판정**이다. 여기서도 같은 함정이 있다 — 에이전트는 응답이 200이거나, 응답 크기가 크거나, PII 형태의 데이터가 보이면 "취약"으로 판정하려 든다. 이건 전부 **"데이터가 반환됐다"만 증명할 뿐 "취약하다"를 증명하지 못한다.**

확증에는 **negative-control**이 필요하다. R5가 이론적으로 말한 그 negative다.

원리는 단순하다. 모든 PoC에 무페이로드 대조(baseline)를 짝지운다.

```
# baseline: 페이로드 없는 정상 요청
probe /path sqli baseline -- curl "$URL?q=normal"

# payload: 공격 페이로드
probe /path sqli quote -- curl "$URL?q=x'"
```

그리고 verdict를 결정론으로 계산한다:

- **`pos-candidate`**: payload 응답 ≠ baseline 응답 (차이가 있다 → 후보)
- **`neg`**: payload 응답 == baseline 응답 (같다 = 노이즈, 취약 아님)
- **`pos-unpaired`**: baseline이 없음 = **확증 불가, 신고 부적격**

핵심은 마지막 줄이다. **baseline 없이는 절대 pos로 승격되지 않는다.** 무페이로드 요청이 똑같은 "success 패턴"을 fire한다면, 그건 페이로드 때문이 아니라 원래 그런 응답이었다는 뜻이다. 이 대조가 없으면 오탐이 그대로 신고서로 나간다.

이걸 지침이 아니라 **훅으로** 강제한다. 확증 receipt에 negative-control(대조·baseline·타인계정·피해자 데이터)이 없으면 게이트가 DENY한다. `[확증: ...]` 태그를 다는 것만으로는 부족하다 — 태그는 gameable이니까(위와 같은 이유).

## 신고 전 kill-gate

확증을 통과한 finding도 신고 전에 7질문 kill-gate를 거친다. 그중 둘이 결정적이다.

- **Q3 — PoC가 impact를 증명하는가?** IDOR이라면 "200 OK"가 아니라 **타인의 데이터를 실제로 조회**해 보여야 한다. 접근이 됐다는 것과 피해가 증명된다는 것은 다르다.
- **Q4 — severity floor를 넘는가?**

하나라도 "아니오"면 finding으로 확정하지 않는다. 이 게이트는 조기 긍정 판정을 막는 마지막 관문이다.

## 무거운 프레임워크의 정반대 축

이 설계를 자율 레드팀 프레임워크(LangGraph + 그래프 DB + 상주 런타임)와 대조하면 성격이 분명해진다. 그런 프레임워크도 핵심 규율은 같다 — HMAC 체인 append-only 원장, 서버측 provenance 주입(에이전트가 위조 불가), negative-control 검증. 실제로 여러 자율 레드팀 구현이 audit sink를 `seq + prev_hash + hash + hmac`의 해시 체인으로 만들고, PoC 검증에 무페이로드 대조를 필수로 둔다. 좋은 설계는 서로 수렴한다.

차이는 **무게**다. 이 하네스는 상주 프로세스도 그래프 DB도 없다. 상태는 파일이 유일 정본이고, 훅은 stateless다. 완료·취약 판정 권한을 모델 서사에서 회수해 스크립트 count와 훅 block으로 이관하는 그 규율만 남기고, 런타임 인프라는 전부 걷어냈다. 훅 하나가 shell 스크립트 한 줄로 게이트를 세운다.

이 미니멀리즘이 실용적으로 중요한 이유가 있다. 게이트가 무거우면 우회하고 싶어진다. 게이트가 `jq`와 `wc` 한 줄이면 우회할 이유가 없고, context가 압축돼도 파일과 훅은 그대로 남는다.

## 마치며

LLM 에이전트에게 "다 했어?"라고 묻는 것은 구조적으로 답을 얻을 수 없는 질문이다 — 생성기는 자기 검증자가 될 수 없고, 과잉확신은 training에 구워져 프롬프트로 안 풀린다. 그래서 이 하네스는 그 질문을 아예 모델에게 하지 않는다. **"done"은 receipt를 세는 스크립트가 답하고, "취약"은 negative-control을 대조하는 게이트가 답한다. 모델의 일은 작업하고 receipt를 남기는 것뿐이다.**

일반화하면 이건 취약점 점검만의 이야기가 아니다. LLM 에이전트에게 완결성이나 검증을 맡기는 모든 자동화 — 테스트 커버리지, 마이그레이션 완료, 데이터 처리 완결성 — 에 같은 원리가 적용된다. **완결성 주장을 모델의 판단이 아니라 외부 카운터의 read로 만들어라.** 판정 권한을 서사에서 회수하는 것, 그게 이 설계의 전부다.

## 참고

주요 근거 문헌 (완료편향·검증 비대칭성):
- Jason Wei — *Asymmetry of Verification & Verifier's Rule* (2025)
- *LLMs Are Overconfident in Their Own Responses* (ownership bias, arXiv 2606.03437)
- *From Confident Closing to Silent Failure* (false success, LLM judge AUROC ≤ 0.65; arXiv 2606.09863)
- *The (Im)possibility of Automated Hallucination Detection* (positive-only 불가, negative 필요)
- *InfiAgent* (coverage = trace 이벤트로만 인정; 2026.findings-acl.1787)
- *NabaOS* (HMAC receipt, false absence 탐지; arXiv 2603.10060)
