---
title: "H2C Smuggling: HTTP/2 Cleartext 업그레이드를 통한 리버스 프록시 우회"
date: 2021-03-01
description: "H2C Smuggling 기법: HTTP/2 cleartext 업그레이드를 악용하여 리버스 프록시의 접근 제어를 우회하고 내부 엔드포인트에 접근하는 방법"
tags: ["HTTP2", "H2C", "smuggling", "proxy", "web-security", "bypass"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

H2C Smuggling은 HTTP 버전 전환을 통해 지속적인 TCP 터널을 생성하는 기법이다. 구체적으로는 HTTP/1.1에서 HTTP/2 cleartext(h2c)로의 업그레이드 메커니즘을 악용하여, 리버스 프록시가 적용한 접근 제어를 우회하고 백엔드 서비스와 직접 통신하는 것을 가능하게 한다.

고전적인 HTTP Request Smuggling과 마찬가지로, 이 공격은 프론트엔드 프록시와 백엔드 서버 사이의 신뢰 경계를 악용한다. 차이점은 `Content-Length` 대 `Transfer-Encoding` 헤더를 조작하는 대신, HTTP `Upgrade` 메커니즘을 활용하여 프록시가 더 이상 검사하지 않는 터널링된 연결을 수립한다는 것이다.

## 동작 원리

일반적인 리버스 프록시 아키텍처에서는:

1. 클라이언트가 프론트엔드 프록시(예: nginx, HAProxy, Envoy)에 요청을 보낸다.
2. 프록시가 접근 제어, 인증 검사, 라우팅 규칙을 적용한다.
3. 프록시가 허용된 요청을 백엔드로 전달한다.

문제는 프록시가 `Upgrade: h2c` 요청을 백엔드에 전달할 때 `Upgrade`와 `Connection` 헤더를 제거하지 않는 경우에 발생한다. 백엔드가 h2c 협상을 지원하고 프록시가 업그레이드 핸드셰이크를 통과시키면, 백엔드는 프록시의 기존 TCP 연결을 통해 터널링된 상태로 클라이언트와 순수 HTTP/2 연결을 수립한다.

터널이 수립되면 모든 후속 HTTP/2 프레임이 백엔드로 직접 흐른다. 프록시는 사실상 연결을 넘겨준 상태이며 더 이상 접근 제어 규칙을 적용하지 않는다. 공격자는 이제 프록시가 보호하려던 내부 엔드포인트에 접근할 수 있게 된다.

### 업그레이드 헤더

이 동작을 트리거하는 핵심 헤더들:

```http
GET / HTTP/1.1
Host: target.example.com
Upgrade: h2c
HTTP2-Settings: AAMAAABkAAQAAP__
Connection: Upgrade, HTTP2-Settings
```

- `Upgrade: h2c` — HTTP/2 cleartext로의 프로토콜 전환 요청
- `HTTP2-Settings` — base64url 인코딩된 HTTP/2 SETTINGS 프레임 파라미터
- `Connection: Upgrade, HTTP2-Settings` — 두 헤더를 연결별(hop-by-hop) 헤더로 표시

RFC 7230에 따르면, `Connection` 헤더 필드는 hop-by-hop이며 중간 노드(intermediary)가 소비하고 제거해야 한다. 규정을 준수하는 프록시라면 `Upgrade`와 `HTTP2-Settings`를 전달 전에 제거해야 한다. 그러나 많은 프록시 설정이 이를 통과시키거나 일관성 없이 처리한다.

## 취약점 조건

다음 조건이 모두 충족될 때 H2C Smuggling이 악용 가능하다:

1. 리버스 프록시가 `Upgrade: h2c` 요청을 백엔드에 전달한다(제거하거나 거부하지 않음).
2. 백엔드 서버가 h2c 업그레이드를 지원한다(예: Go의 `net/http`, 일부 Node.js 설정).
3. 업그레이드 완료 후 프록시가 터널링된 트래픽에 동일한 백엔드 TCP 연결을 재사용한다.

이 조건들 하에서, 공격자가 업그레이드 요청을 보내면 백엔드는 `101 Switching Protocols`로 응답하고 연결이 HTTP/2로 전환된다. 이제 프록시는 투명한 파이프로 동작하며, 모든 후속 HTTP/2 요청은 프록시의 라우팅과 접근 제어 로직을 완전히 우회한다.

## 탐지

대상이 취약한지 확인하려면, 프록시가 h2c 업그레이드 헤더를 백엔드에 통과시키는지 그리고 백엔드가 `101 Switching Protocols`로 응답하는지 테스트한다:

```bash
curl -v --http2 -H "Upgrade: h2c" -H "Connection: Upgrade, HTTP2-Settings" \
     -H "HTTP2-Settings: AAMAAABkAAQAAP__" \
     https://target.example.com/
```

백엔드가 프록시가 차단하거나 거부하는 대신 `101 Switching Protocols`를 반환하면 터널을 수립할 수 있다.

`h2csmuggler` 도구가 이 과정을 자동화하여 수립된 터널을 통해 임의의 HTTP/2 요청을 전송할 수 있게 해준다.

## 공격 영향

터널이 수립되면 공격자는 다음이 가능하다:

- **내부 전용 엔드포인트 접근** — 프록시의 접근 제어 목록이 차단하는 경로(`/admin`, `/internal/api`, `/metrics` 등)
- **인증 미들웨어 우회** — 프록시 수준의 인증(mTLS, API 키, IP 허용 목록)이 더 이상 적용되지 않음
- **내부 포트의 서비스 접근** — 백엔드가 h2c 프레임을 하위 서비스로 전달하면 공격 표면이 확장됨
- **SSRF와 결합** — 터널링된 연결을 활용하여 다른 내부 네트워크 리소스로 피벗 가능

영향력은 임의의 HTTP 메서드와 바디 제어가 가능한 SSRF와 대략 동등하지만, 애플리케이션 자체의 요청 전달 로직에 의존하지 않는다.

## 영향받는 프록시 설정

h2c 업그레이드 요청을 전달하는 것으로 관찰된 프록시 설정들:

- **nginx** (`proxy_http_version`이 명시적 헤더 제거와 함께 `1.1`로 설정되지 않은 경우)
- **HAProxy** (버전 및 모드에 따라 다름)
- **Envoy** (일부 업스트림 클러스터 설정)
- **Traefik** (특정 라우팅 규칙)
- **AWS ALB / CloudFront** (특정 오리진 프로토콜 사용 시)

이 취약점은 설정에 따라 다르다. 올바르게 강화된 프록시는 백엔드에 전달하기 전에 `Connection`, `Upgrade`, `HTTP2-Settings` 헤더를 제거한다.

## 대응 방안

- **프록시 레이어에서 hop-by-hop 헤더 제거** — `Upgrade`, `HTTP2-Settings`, 그리고 `Connection`에 나열된 모든 헤더가 소비되고 백엔드에 전달되지 않도록 보장
- **프록시에서 `Upgrade: h2c` 명시적 거부** — `400 Bad Request` 또는 `426 Upgrade Required`를 반환하고 연결 종료
- **필요하지 않은 경우 백엔드 서버에서 h2c 지원 비활성화** — 백엔드가 h2c를 직접 서빙할 필요가 없다면 기능 비활성화
- **백엔드 연결에 TLS를 통한 HTTP/2(h2) 사용** — TLS 위의 h2는 `Upgrade` 메커니즘을 사용하지 않으므로 이 공격 벡터에 취약하지 않음
- **프록시 포워딩 규칙 정기 감사** — 접근 제어 규칙이 프록시에만 아니라 백엔드 수준에도 적용되는지 확인

## 고전적인 Request Smuggling과의 관계

H2C Smuggling과 고전적인 HTTP Request Smuggling(CL.TE / TE.CL)은 동일한 근본 모델을 공유한다: 프론트엔드 프록시와 백엔드 서버가 요청 경계나 프로토콜 상태에 대해 의견이 일치하지 않아 공격자가 악용하는 틈이 생긴다. 차이는 메커니즘에 있다:

| | 고전적 Smuggling | H2C Smuggling |
|---|---|---|
| 트리거 | CL/TE 헤더 불일치 | HTTP Upgrade to h2c |
| 효과 | 백엔드 요청 큐 오염 | 프록시를 우회하는 터널링된 연결 |
| 요청별 | 예 — 각 스머글된 접두사는 요청별 | 아니오 — 터널은 연결 수명 동안 지속 |
| 접근 제어 우회 | 부분적(스머글된 경로에 따라 다름) | 완전함 — 프록시 규칙이 더 이상 적용되지 않음 |

H2C Smuggling은 여러 면에서 고전적인 Smuggling보다 강력하다: 터널이 수립되면 공격자는 연결이 지속되는 동안 백엔드로의 열린 채널을 가지며, 다른 사용자의 요청과 경쟁할 필요가 없다.
