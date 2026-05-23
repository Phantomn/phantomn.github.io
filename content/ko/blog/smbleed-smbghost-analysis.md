---
title: "SMBGhost & SMBleed: CVE-2020-0796 + CVE-2020-1206 분석"
date: 2020-06-20
description: "SMBv3.1.1 압축 해제 루틴의 Integer Overflow(SMBGhost)와 초기화되지 않은 커널 메모리 릭(SMBleed), 그리고 두 버그를 체이닝한 Pre-Auth RCE 분석"
tags: ["CVE", "SMB", "Windows", "kernel", "buffer-overflow", "memory-leak", "RCE", "exploitation"]
categories: ["Research"]
authors:
  - name: "ph4nt0m"
    link: "https://github.com/Phantomn"
    image: "https://github.com/Phantomn.png"
---

# SMBGhost (CVE-2020-0796) 분석

## 취약점 개요

SMBv3의 이 취약점은 최신 버전의 프로토콜(SMB 3.1.1)을 통해 네트워크 공유로 전파될 수 있는 잠재적 웜(wormable) 취약점이다.

Microsoft는 2020년 3월 12일 오전 CVE-2020-0796 패치를 발표했다. 버그는 SMBv3 데이터 페이로드의 **압축 해제(decompression) 루틴**에서 발생하며, Windows 10 1903(2019년 4월)과 1909(2019년 11월) 배포 시 도입되었다.

조작된 압축 메시지를 처리하는 과정에서 취약점이 발생한다. 메시지 헤더는 MS-SMB2 스펙을 따른다.

![SMB Compression Transform Header 구조](/images/blog/smbleed-smbghost/smbghost-header.png)

핵심 취약 지점:

- 헤더에는 `OriginalCompressedSegmentSize`와 `Offset/Length` 두 개의 핵심 파라미터가 존재한다.
- `Srv2DecompressData`(srv2.sys)는 `OriginalCompressedSegmentSize + Offset/Length` 크기의 버퍼를 할당한다.
- 이 두 값의 덧셈에서 **부호(sign) 검사가 없다** — 공격자가 의도적으로 작은 버퍼를 할당하게 만들 수 있다.
- `packet + 0x10 + offset`의 데이터를 `buffer + offset`에 압축 해제한다.
- `OriginalCompressedSegmentSize`는 `SmbCompressionDecompression`(→ `RtlDecompressBufferEx2` 래퍼)의 `UncompressedBufferSize` 파라미터로 전달된다.
- 이 루틴은 압축 해제 버퍼 크기를 `unsigned long`으로 취급 — **음수 값이 큰 unsigned 숫자로 캐스팅**되어, 압축 해제 루틴이 원래 크기보다 훨씬 큰 버퍼가 있다고 가정하고 OOB Write를 수행한다.

아래는 서버 측 취약 함수 디스어셈블리:

![Srv2DecompressData 디스어셈블리 1](/images/blog/smbleed-smbghost/smbghost-disasm1.png)

![Srv2DecompressData 디스어셈블리 2](/images/blog/smbleed-smbghost/smbghost-disasm2.png)

이 취약점은 `Negotiate` 프로토콜 응답 이후 전송되는 압축 메시지에 영향을 미치므로 **클라이언트와 서버 모두에 영향**을 준다. 서버 취약점은 `srv2.sys`, 클라이언트 취약점은 `mrxsmb.sys`에 위치하며, 양쪽 모두 `SmbCompressionDecompress`를 호출한다.

클라이언트 측 디스어셈블리:

![클라이언트 측 디스어셈블리](/images/blog/smbleed-smbghost/smbghost-disasm3.png)

`OriginalCompressedSegmentSize`는 경계가 체크되지만, `Offset/Length`와의 합산 결과가 `ExAllocatePoolWithTag`로 전달되기 전에는 검사되지 않는다.

## 압축 협상 흐름

포트 445를 통한 인바운드 SMB3 트래픽이 허용되면 기본적으로 압축이 지원된다. 클라이언트와 서버는 압축 협상(negotiation)을 수행한 후 압축된 페이로드를 주고받는다.

![SMB 압축 협상 흐름](/images/blog/smbleed-smbghost/smbghost-compress-nego.png)

취약점은 모든 인증 전 단계에서 SMB 압축 변환 헤더에 존재한다.

![Pre-auth 취약 지점](/images/blog/smbleed-smbghost/smbghost-payload.png)

아래에서 공격자가 제어하는 매우 큰 `OriginalSize`(0xFFFFFFFF = signed long 기준 -1)를 확인할 수 있다. 작은 고정 버퍼로 복사되어 클래식 BOF가 발생한다. `\xfcSMB` 매직 바이트는 해당 메시지가 압축 해제가 필요함을 나타내는 `ProtocolID`이다.

![공격자 제어 데이터](/images/blog/smbleed-smbghost/smbghost-attacker-data.png)

서버뿐 아니라 **클라이언트도 취약**하다. 클라이언트가 악의적인 SMB 서버에 연결하면, 서버가 동일한 방식으로 응답하여 클라이언트 측 Overflow를 트리거할 수 있다.

## 노출 현황

패치 발표 직전 Shodan.io 검색 결과:

```
port:445 os:"Windows" + os:"18362"
```

취약한 버전의 Windows PC 35,000개 이상이 검색되었다.

![Shodan 검색 결과 1](/images/blog/smbleed-smbghost/smbghost-shodan1.png)

![Shodan 검색 결과 2](/images/blog/smbleed-smbghost/smbghost-shodan2.png)

![Shodan 검색 결과 3](/images/blog/smbleed-smbghost/smbghost-shodan3.png)

## 패치 분석

패치된 버전에서는 `RtlULongAdd`를 사용하여 `OriginalCompressedSegmentSize + Offset/Length` 덧셈을 수행한다. 또한 크기가 전체 패킷 + 0x134보다 크지 않은지 검사하는 추가 로직이 추가되었다. `Offset` 필드를 고려한 압축 버퍼 크기 계산에서 `RtlULongSub`도 사용된다.

![패치 비교](/images/blog/smbleed-smbghost/smbghost-patch.png)

## 영향: BSOD vs RCE

BSOD 유발은 간단하다. 완전한 RCE 달성은 KASLR 등 Windows 완화 기술 우회가 필요하여 더 어렵다. 이 버그의 경우 공격자는 데이터 할당을 위한 기본 프리미티브(primitive)를 가지며 Overflow 크기를 제어할 수 있다. 단, 메모리에 할당된 객체는 비교적 빠르게 해제되어 Exploit 난이도가 높다.

![BSOD vs RCE 분석](/images/blog/smbleed-smbghost/smbghost-bsod-rce.png)

---

# SMBleed (CVE-2020-1206) 분석

## 요약

- SMBGhost 취약 함수 분석 중 또 다른 취약점 발견 → **SMBleed (CVE-2020-1206)**
- SMBleed: 커널 메모리를 **원격으로 릭(leak)**
- SMBGhost(패치됨) + SMBleed 체이닝 → **Pre-Auth RCE**
- POC #1 (SMBleed 원격 커널 메모리 릭): [ZecOps/CVE-2020-1206-POC](https://github.com/ZecOps/CVE-2020-1206-POC)
- POC #2 (SMBleed + SMBGhost Pre-Auth RCE): [ZecOps/CVE-2020-0796-RCE-POC](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)

## 취약 함수 분석

SMBleed는 SMBGhost와 동일한 함수(`srv2.sys`의 `Srv2DecompressData`)에서 발생한다.

```c
typedef struct _COMPRESSION_TRANSFORM_HEADER {
    ULONG ProtocolId;
    ULONG OriginalCompressedSegmentSize;
    USHORT CompressionAlgorithm;
    USHORT Flags;
    ULONG Offset;
} COMPRESSION_TRANSFORM_HEADER, *PCOMPRESSION_TRANSFORM_HEADER;

typedef struct _ALLOCATION_HEADER {
    // ...
    PVOID UserBuffer;
    // ...
} ALLOCATION_HEADER, *PALLOCATION_HEADER;

NTSTATUS Srv2DecompressData(PCOMPRESSION_TRANSFORM_HEADER Header, SIZE_T TotalSize)
{
    PALLOCATION_HEADER Alloc = SrvNetAllocateBuffer(
        (ULONG)(Header->OriginalCompressedSegmentSize + Header->Offset),
        NULL); // OriginalCompressedSegmentSize + Offset 크기 할당
    if (!Alloc) {
        return STATUS_INSUFFICIENT_RESOURCES;
    }

    ULONG FinalCompressedSize = 0;

    NTSTATUS Status = SmbCompressionDecompress(
        Header->CompressionAlgorithm,
        (PUCHAR)Header + sizeof(COMPRESSION_TRANSFORM_HEADER) + Header->Offset,
        (ULONG)(TotalSize - sizeof(COMPRESSION_TRANSFORM_HEADER) - Header->Offset),
        (PUCHAR)Alloc->UserBuffer + Header->Offset,
        Header->OriginalCompressedSegmentSize,
        &FinalCompressedSize);
    if (Status < 0 || FinalCompressedSize != Header->OriginalCompressedSegmentSize) {
        SrvNetFreeBuffer(Alloc);
        return STATUS_BAD_DATA;
    }

    if (Header->Offset > 0) {
        memcpy(
            Alloc->UserBuffer,
            (PUCHAR)Header + sizeof(COMPRESSION_TRANSFORM_HEADER),
            Header->Offset); // Offset 바이트만큼 memcpy
    }

    Srv2ReplaceReceiveBuffer(some_session_handle, Alloc);
    return STATUS_SUCCESS;
}
```

![SmbCompressionDecompress 흐름](/images/blog/smbleed-smbghost/smbleed-func.png)

처리 흐름:
1. `Srv2DecompressData`가 클라이언트의 압축 메시지를 수신
2. 필요한 메모리를 할당하고 데이터를 압축 해제
3. `Offset` 필드가 0이 아니면, 압축 데이터 앞의 데이터를 할당된 버퍼 시작 부분에 `memcpy`

## 핵심 버그

SMBGhost 패치 이후 Integer Overflow 체크가 추가되었다고 가정하자. 그래도 여전히 심각한 버그가 남아 있다.

실제로 압축 해제한 데이터 크기보다 **조금 더 큰 값**을 `OriginalCompressedSegmentSize`에 설정하면 어떻게 될까?

예를 들어 압축 해제 후 크기가 `x`라면, `OriginalCompressedSegmentSize`를 `x + 0x1000`으로 설정한다.

![초기화되지 않은 커널 메모리가 메시지 일부로 취급됨](/images/blog/smbleed-smbghost/smbleed-uninit.png)

초기화되지 않은 커널 데이터가 메시지의 일부로 취급되어 읽힌다.

**왜 검사가 통과되는가?** `SmbCompressionDecompress` 구현을 보면:

```c
NTSTATUS SmbCompressionDecompress(
    USHORT CompressionAlgorithm,
    PUCHAR UncompressedBuffer,
    ULONG UncompressedBufferSize,
    PUCHAR CompressedBuffer,
    PULONG FinalCompressedSize)
{
    // ...
    NTSTATUS Status = RtlDecompressBufferEx2(
        ...,
        FinalUncompressedSize,
        ...);
    if (Status >= 0) {
        *FinalUncompressedSize = CompressedBufferSize; // CompressedBufferSize로 덮어씀
    }
    // ...
    return Status;
}
```

압축 해제 성공 시 `FinalCompressedSize`가 `CompressedBufferSize`(즉, `OriginalCompressedSegmentSize`인 `x + 0x1000`)로 업데이트된다. 결과적으로 검사 `FinalCompressedSize != Header->OriginalCompressedSegmentSize`가 **통과**되며, 초기화되지 않은 `0x1000` 바이트 커널 메모리가 유출된다.

## 익스플로잇 개요

취약점 시연에 사용한 SMB 메시지: [SMB2 WRITE message](https://docs.microsoft.com/ko-kr/openspecs/windows_protocols/ms-smb2/e7046961-3318-4350-be2a-a8d69bb59ce8)

```c
// HACK: fake size
if (((Smb2SinglePacket)packet).Header.Command == Smb2Command.WRITE) {
    ((Smb2WriteRequestPacket)packet).Payload.Length += 0x1000;
    compressedPacket.Header.OriginalCompressedSegmentSize += 0x1000;
}
```

leak된 메모리는 `NonPagedPoolNx` 풀의 이전 할당에서 비롯된 것으로, 할당 크기 제어를 통해 어느 정도 유출 데이터를 제어할 수 있다.

![SMBleed POC 데모](/images/blog/smbleed-smbghost/smbleed-poc-demo.gif)

## 영향 버전

Windows 10 Version 1903, 1909, 2004에 영향.

Windows 10 1903 초기 버전에서는 유효한 압축 SMB 패킷 처리 중 **Null Dereference 버그**도 추가로 존재:

패치 전 (Null Dereference 발생):

![패치 전 — Null Dereference](/images/blog/smbleed-smbghost/smbleed-nullderef-unpatched.png)

패치 후 (Null Dereference 체크 추가):

![패치 후 — Null Dereference 체크](/images/blog/smbleed-smbghost/smbleed-nullderef-patched.png)

---

# SMBleedingGhost: SMBleed + SMBGhost 체이닝 → Pre-Auth RCE

SMBleed로 커널 메모리를 릭하여 KASLR을 우회하고, SMBGhost의 Write-What-Where 프리미티브와 결합하면 인증 없이 RCE 달성이 가능하다.

![SMBleedingGhost RCE 데모](/images/blog/smbleed-smbghost/smbleedghost-rce-demo.gif)

POC: [ZecOps/CVE-2020-0796-RCE-POC](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)

---

# 완화 방법

다음 중 하나 이상으로 SMBleed + SMBGhost 모두 해결 가능:

1. **Windows 업데이트 적용** (권장) — 완전히 해결
2. **포트 445 차단** — lateral movement 방지
3. **호스트 격리**
4. **SMB 3.1.1 압축 비활성화** (권장하지 않음)

---

**References**
- [Microsoft CVE-2020-0796](https://portal.msrc.microsoft.com/en-US/security-guidance/advisory/CVE-2020-0796)
- [ZecOps SMBleed Blog](https://blog.zecops.com/vulnerabilities/smbleed-a-new-critical-vulnerability-in-smbv3/)
- [POC: SMBleed](https://github.com/ZecOps/CVE-2020-1206-POC)
- [POC: SMBGhost RCE](https://github.com/ZecOps/CVE-2020-0796-RCE-POC)
