---
title: "H2C Smuggling: Bypassing Reverse Proxies via HTTP/2 Cleartext Upgrade"
date: 2021-03-01
description: "H2C smuggling technique: abusing HTTP/2 cleartext upgrade to bypass reverse proxy access controls and reach internal endpoints"
tags: ["HTTP2", "H2C", "smuggling", "proxy", "web-security", "bypass"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

H2C Smuggling is a technique that creates a persistent TCP tunnel through an HTTP version switch — specifically by abusing the HTTP/1.1 to HTTP/2 cleartext (h2c) upgrade mechanism. This allows an attacker to bypass access controls enforced by a reverse proxy and communicate directly with back-end services.

Like classic HTTP Request Smuggling, this attack exploits the trust boundary between a front-end proxy and a back-end server. The difference is that instead of manipulating `Content-Length` vs `Transfer-Encoding` headers, H2C smuggling leverages the HTTP `Upgrade` mechanism to establish a tunneled connection that the proxy no longer inspects.

## How It Works

In a standard reverse proxy architecture:

1. The client sends requests to the front-end proxy (e.g., nginx, HAProxy, Envoy).
2. The proxy applies access controls, authentication checks, and routing rules.
3. The proxy forwards allowed requests to the back-end.

The problem arises when the proxy forwards HTTP `Upgrade: h2c` requests to the back-end without stripping the `Upgrade` and `Connection` headers. If the back-end supports h2c negotiation and the proxy passes the upgrade handshake through, the back-end establishes a raw HTTP/2 connection with the client — tunneled through the proxy's existing TCP connection.

Once the tunnel is established, all subsequent HTTP/2 frames flow directly to the back-end. The proxy has effectively handed off the connection and no longer applies its access control rules. The attacker can now reach internal endpoints that the proxy was meant to protect.

### The Upgrade Headers

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
- `Connection: Upgrade, HTTP2-Settings` — marks both headers as connection-specific (hop-by-hop)

Per RFC 7230, `Connection` header fields are hop-by-hop and should be consumed and stripped by intermediaries. A compliant proxy should strip `Upgrade` and `HTTP2-Settings` before forwarding. However, many proxy configurations either pass them through or handle them inconsistently.

## Exploitation Conditions

H2C smuggling is exploitable when all of the following are true:

1. The reverse proxy forwards `Upgrade: h2c` requests to the back-end (does not strip or reject them).
2. The back-end server supports h2c upgrade (e.g., Go's `net/http`, some Node.js configurations).
3. The proxy reuses the same back-end TCP connection for the tunneled traffic after upgrade completes.

Under these conditions, the attacker sends the upgrade request, the back-end responds with `101 Switching Protocols`, and the connection transitions to HTTP/2. The proxy now functions as a transparent pipe — all subsequent HTTP/2 requests bypass the proxy's routing and access control logic entirely.

## Detection

To check if a target is vulnerable, test whether the proxy passes h2c upgrade headers to the back-end and whether the back-end responds with a `101 Switching Protocols`:

```bash
curl -v --http2 -H "Upgrade: h2c" -H "Connection: Upgrade, HTTP2-Settings" \
     -H "HTTP2-Settings: AAMAAABkAAQAAP__" \
     https://target.example.com/
```

If the back-end returns `101 Switching Protocols` rather than the proxy intercepting and rejecting the upgrade, the tunnel can be established.

The tool `h2csmuggler` automates this process and allows issuing arbitrary HTTP/2 requests through the established tunnel.

## Attack Impact

Once the tunnel is established, the attacker can:

- **Access internal-only endpoints** — paths the proxy's access control list blocks (e.g., `/admin`, `/internal/api`, `/metrics`)
- **Bypass authentication middleware** — proxy-level auth (mTLS, API keys, IP allowlists) no longer applies
- **Reach services on internal ports** — if the back-end forwards h2c frames to downstream services, the attack surface expands
- **Combine with SSRF** — the tunneled connection may be leveraged to pivot to other internal network resources

The impact is roughly equivalent to SSRF with arbitrary HTTP method and body control, but without relying on the application's own request-forwarding logic.

## Affected Proxy Configurations

Proxies that have been observed forwarding h2c upgrade requests include certain configurations of:

- **nginx** (when `proxy_http_version` is not set to `1.1` with explicit header stripping)
- **HAProxy** (depending on version and mode)
- **Envoy** (some upstream cluster configurations)
- **Traefik** (certain routing rules)
- **AWS ALB / CloudFront** (when using certain origin protocols)

The vulnerability is configuration-dependent. Correctly hardened proxies strip `Connection`, `Upgrade`, and `HTTP2-Settings` headers before forwarding.

## Mitigation

- **Strip hop-by-hop headers at the proxy layer** — ensure `Upgrade`, `HTTP2-Settings`, and all headers listed in `Connection` are consumed and not forwarded to the back-end
- **Explicitly reject `Upgrade: h2c` at the proxy** — return `400 Bad Request` or `426 Upgrade Required` and terminate the connection
- **Disable h2c support on back-end servers if not needed** — if the back-end does not need to serve h2c directly, disable the feature
- **Use HTTP/2 with TLS (h2) for back-end connections** — h2 over TLS does not use the `Upgrade` mechanism and is not susceptible to this attack vector
- **Audit proxy forwarding rules regularly** — ensure access control rules are applied at the back-end level as well, not solely at the proxy

## Relationship to Classic Request Smuggling

H2C smuggling and classic HTTP request smuggling (CL.TE / TE.CL) share the same fundamental model: the front-end proxy and back-end server disagree on request boundaries or protocol state, creating a gap that the attacker exploits. The difference is in mechanism:

| | Classic Smuggling | H2C Smuggling |
|---|---|---|
| Trigger | CL/TE header mismatch | HTTP Upgrade to h2c |
| Effect | Poisoned back-end request queue | Tunneled connection bypassing proxy |
| Per-request | Yes — each smuggled prefix is per-request | No — tunnel persists for connection lifetime |
| Access control bypass | Partial (depends on smuggled path) | Complete — proxy rules no longer apply |

H2C smuggling is in many respects more powerful than classic smuggling: once the tunnel is established, the attacker has an open channel to the back-end for the duration of the connection, with no need to race against other users' requests.
