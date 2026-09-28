---
title: 'H2C Smuggling: Bypassing Reverse Proxies via HTTP/2 Cleartext Upgrade'
date: 2021-03-01T00:00:00.000Z
excerpt: >-
  The H2C Smuggling technique: abusing the HTTP/2 cleartext upgrade to bypass reverse proxy
  access controls and reach internal endpoints
tags:
  - http2
  - h2c
  - smuggling
  - proxy
  - web-security
  - bypass
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

H2C Smuggling is a technique that establishes a persistent TCP tunnel through an HTTP version switch. Specifically, it abuses the upgrade mechanism from HTTP/1.1 to HTTP/2 cleartext (h2c) to bypass access controls enforced by a reverse proxy and communicate directly with the backend service.

Like classic HTTP Request Smuggling, this attack exploits the trust boundary between the frontend proxy and the backend server. The difference is that instead of manipulating `Content-Length` versus `Transfer-Encoding` headers, it leverages the HTTP `Upgrade` mechanism to establish a tunneled connection that the proxy no longer inspects.

## How It Works

In a typical reverse proxy architecture:

1. The client sends a request to the frontend proxy (e.g., nginx, HAProxy, Envoy).
2. The proxy applies access control, authentication checks, and routing rules.
3. The proxy forwards allowed requests to the backend.

The problem arises when the proxy forwards an `Upgrade: h2c` request to the backend without stripping the `Upgrade` and `Connection` headers. If the backend supports h2c negotiation and the proxy passes the upgrade handshake through, the backend establishes a raw HTTP/2 connection with the client, tunneled through the proxy's existing TCP connection.

Once the tunnel is established, all subsequent HTTP/2 frames flow directly to the backend. The proxy has effectively handed off the connection and no longer applies access control rules. The attacker can now reach internal endpoints that the proxy was meant to protect.

### Upgrade Headers

The key headers that trigger this behavior:

```http
GET / HTTP/1.1
Host: target.example.com
Upgrade: h2c
HTTP2-Settings: AAMAAABkAAQAAP__
Connection: Upgrade, HTTP2-Settings
```

- `Upgrade: h2c` — requests a protocol switch to HTTP/2 cleartext
- `HTTP2-Settings` — base64url-encoded HTTP/2 SETTINGS frame parameters
- `Connection: Upgrade, HTTP2-Settings` — marks both headers as hop-by-hop

Per RFC 7230, the `Connection` header field is hop-by-hop and must be consumed and removed by intermediaries. A compliant proxy should strip `Upgrade` and `HTTP2-Settings` before forwarding. However, many proxy configurations pass them through or handle them inconsistently.

## Exploitation Conditions

H2C Smuggling is exploitable when all of the following conditions hold:

1. The reverse proxy forwards the `Upgrade: h2c` request to the backend (without stripping or rejecting it).
2. The backend server supports h2c upgrade (e.g., Go's `net/http`, some Node.js configurations).
3. After the upgrade completes, the proxy reuses the same backend TCP connection for the tunneled traffic.

Under these conditions, when an attacker sends an upgrade request, the backend responds with `101 Switching Protocols` and the connection switches to HTTP/2. The proxy now acts as a transparent pipe, and every subsequent HTTP/2 request completely bypasses the proxy's routing and access control logic.

## Detection

To check whether a target is vulnerable, test whether the proxy passes the h2c upgrade headers to the backend and whether the backend responds with `101 Switching Protocols`:

```bash
curl -v --http2 -H "Upgrade: h2c" -H "Connection: Upgrade, HTTP2-Settings" \
     -H "HTTP2-Settings: AAMAAABkAAQAAP__" \
     https://target.example.com/
```

If the backend returns `101 Switching Protocols` instead of the proxy blocking or rejecting the request, the tunnel can be established.

The `h2csmuggler` tool automates this process, allowing arbitrary HTTP/2 requests to be sent through the established tunnel.

## Impact

Once the tunnel is established, an attacker can:

- **Reach internal-only endpoints** — paths blocked by the proxy's access control list (`/admin`, `/internal/api`, `/metrics`, etc.)
- **Bypass authentication middleware** — proxy-level authentication (mTLS, API keys, IP allowlists) no longer applies
- **Reach services on internal ports** — if the backend forwards h2c frames to downstream services, the attack surface expands
- **Combine with SSRF** — the tunneled connection can be used to pivot to other internal network resources

The impact is roughly equivalent to an SSRF with arbitrary HTTP method and body control, but does not rely on the application's own request-forwarding logic.

## Affected Proxy Configurations

Proxy configurations observed to forward h2c upgrade requests:

- **nginx** (when `proxy_http_version` is not set to `1.1` along with explicit header removal)
- **HAProxy** (depends on version and mode)
- **Envoy** (certain upstream cluster configurations)
- **Traefik** (specific routing rules)
- **AWS ALB / CloudFront** (with certain origin protocol settings)

This vulnerability is configuration-dependent. A properly hardened proxy strips the `Connection`, `Upgrade`, and `HTTP2-Settings` headers before forwarding to the backend.

## Mitigations

- **Strip hop-by-hop headers at the proxy layer** — ensure `Upgrade`, `HTTP2-Settings`, and any headers listed in `Connection` are consumed and not forwarded to the backend
- **Explicitly reject `Upgrade: h2c` at the proxy** — return `400 Bad Request` or `426 Upgrade Required` and close the connection
- **Disable h2c support on the backend server if not needed** — disable the feature if the backend does not need to serve h2c directly
- **Use HTTP/2 over TLS (h2) for backend connections** — h2 over TLS does not use the `Upgrade` mechanism, so it is not vulnerable to this attack vector
- **Regularly audit proxy forwarding rules** — verify that access control rules are enforced at the backend level, not only at the proxy

## Relationship to Classic Request Smuggling

H2C Smuggling and classic HTTP Request Smuggling (CL.TE / TE.CL) share the same underlying model: a gap that an attacker can exploit because the frontend proxy and backend server disagree about request boundaries or protocol state. The difference lies in the mechanism:

| | Classic Smuggling | H2C Smuggling |
|---|---|---|
| Trigger | CL/TE header mismatch | HTTP Upgrade to h2c |
| Effect | Poisons the backend request queue | Tunneled connection that bypasses the proxy |
| Per-request | Yes — each smuggled prefix is per-request | No — the tunnel persists for the connection's lifetime |
| Access control bypass | Partial (depends on the smuggled path) | Complete — proxy rules no longer apply |

H2C Smuggling is, in several ways, more powerful than classic smuggling: once the tunnel is established, the attacker has an open channel to the backend for as long as the connection persists, with no need to race other users' requests.
